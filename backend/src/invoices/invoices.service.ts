import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { MailService } from '../mailer/mail.service';
import { istFestgesetzt, statuswechselErlaubt } from './invoice-rules';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceItemDto } from './dto/invoice.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicePdfService } from './invoice-pdf.service';
import { MAHN_TITEL } from './invoice-pdf';

const MWST_SATZ = 0.19;

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
    private readonly sevdesk: SevdeskService,
    private readonly pdf: InvoicePdfService,
    private readonly mail: MailService,
  ) {}

  private buildItems(dtoItems: InvoiceItemDto[]): InvoiceItem[] {
    return dtoItems.map((i) =>
      this.itemRepo.create({
        beschreibung: i.beschreibung,
        menge: i.menge,
        einzelpreis: i.einzelpreis,
        // Kaufmaennisch auf Cent runden, damit die persistierte Zeilensumme (decimal 10,2)
        // mit dem aus diesen Zeilen gebildeten netto uebereinstimmt -> PDF geht auf.
        gesamtpreis: Math.round(Number(i.menge) * Number(i.einzelpreis) * 100) / 100,
      }),
    );
  }

  /** Summen aus den Zeilen. `satzProzent` ist der MwSt-Satz in Prozent (Default 19). */
  private totals(items: InvoiceItem[], satzProzent: number = MWST_SATZ * 100) {
    const netto = items.reduce((sum, i) => sum + Number(i.gesamtpreis), 0);
    const mwst = Math.round(netto * (Number(satzProzent) / 100) * 100) / 100;
    const brutto = Math.round((netto + mwst) * 100) / 100;
    return { netto, mwst, brutto };
  }

  private prefix(art: InvoiceKind): string {
    return art === InvoiceKind.ANGEBOT ? 'AN' : 'RE';
  }

  findAll(tenantId: string, query: { art?: InvoiceKind; status?: InvoiceStatus } = {}) {
    // Listen-Projektion: nur Tabellen-Spalten. KEINE items-Relation und KEINE
    // verschluesselten Felder (hinweis/empfaenger*) -> kein Join + kein
    // AES-Decrypt pro Zeile (Haupt-Latenzquelle bei Volumen) + kein Daten-Leck.
    const qb = this.repo
      .createQueryBuilder('i')
      .select([
        'i.id',
        'i.nummer',
        'i.art',
        'i.customerId',
        'i.orderId',
        'i.status',
        'i.datum',
        'i.netto',
        'i.mwst',
        'i.brutto',
        'i.mwstSatz',
        'i.faelligkeitsdatum',
        'i.zahlungsziel',
        'i.zahldatum',
        'i.mahnstufe',
        'i.versendetAm',
        'i.createdAt',
      ])
      .where('i.tenantId = :tenantId', { tenantId });
    if (query.art) qb.andWhere('i.art = :art', { art: query.art });
    if (query.status) qb.andWhere('i.status = :status', { status: query.status });
    return qb.orderBy('i.createdAt', 'DESC').getMany();
  }

  async findOne(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!invoice) throw new NotFoundException('Beleg nicht gefunden');
    return invoice;
  }

  async create(user: AuthUser, dto: CreateInvoiceDto): Promise<Invoice> {
    // Mandantentrennung: verknuepfte Kunden-/Auftrags-ID muss zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection: Beleg fuer fremden Kunden/Auftrag).
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    const art = dto.art ?? InvoiceKind.RECHNUNG;
    // Angebot: Nummer sofort. Rechnung: NULL (Entwurf) – die lueckenlose
    // RE-Nummer wird erst bei der Festsetzung (changeStatus -> Offen) vergeben.
    const nummer =
      art === InvoiceKind.ANGEBOT
        ? await nextSequentialNumber(this.repo, user.tenantId, 'AN', { nummerFeld: 'nummer' })
        : null;
    const items = this.buildItems(dto.items);
    const mwstSatz = dto.mwstSatz ?? MWST_SATZ * 100; // Default 19 %
    const t = this.totals(items, mwstSatz);

    const datum = new Date();
    // Faelligkeit ist ein reines Rechnungs-Konzept (Angebote haben kein Zahlungsziel).
    const zahlungsziel = art === InvoiceKind.RECHNUNG ? dto.zahlungsziel ?? 14 : undefined;
    const faelligkeitsdatum =
      zahlungsziel != null
        ? new Date(datum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000)
        : undefined;

    const invoice = this.repo.create({
      tenantId: user.tenantId,
      nummer,
      art,
      customerId: dto.customerId,
      orderId: dto.orderId,
      status: InvoiceStatus.ENTWURF,
      datum,
      leistungsdatum: datum,
      zahlungsziel,
      faelligkeitsdatum,
      hinweis: dto.hinweis,
      mwstSatz,
      items,
      ...t,
    });
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Invoice',
      entityId: saved.id,
      payload: { nummer, art, brutto: t.brutto },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  /** Erzeugt aus einem Auftrag eine Rechnung (oder Angebot) inkl. Positionen. */
  async createFromOrder(
    user: AuthUser,
    orderId: string,
    art = InvoiceKind.RECHNUNG,
    mwstSatz?: number,
  ): Promise<Invoice> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId: user.tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');

    const items: InvoiceItemDto[] = (order.items ?? []).map((i) => ({
      beschreibung: i.beschreibung,
      menge: Number(i.menge),
      einzelpreis: Number(i.einzelpreis),
    }));
    if (Number(order.materialkosten) > 0) {
      items.push({ beschreibung: 'Materialkosten', menge: 1, einzelpreis: Number(order.materialkosten) });
    }

    // Satz nur uebernehmen, wenn gueltig (0/7/19) – sonst Default 19 % in create().
    const satz = [0, 7, 19].includes(Number(mwstSatz)) ? Number(mwstSatz) : undefined;
    return this.create(user, { customerId: order.customerId, orderId: order.id, art, items, mwstSatz: satz });
  }

  async update(user: AuthUser, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    // GoBD-Aenderungssperre: eine festgesetzte (gestellte) Rechnung ist
    // unveraenderlich - Korrektur nur per Storno + neue Rechnung.
    if (istFestgesetzt(invoice.art, invoice.status)) {
      throw new ConflictException(
        'Festgesetzte Rechnung ist unveraenderlich - bitte stornieren und neu erstellen.',
      );
    }
    if (dto.mwstSatz !== undefined) invoice.mwstSatz = dto.mwstSatz;
    if (dto.items) {
      await this.itemRepo.delete({ invoiceId: id });
      invoice.items = this.buildItems(dto.items).map((i) => {
        i.invoiceId = id;
        return i;
      });
    }
    // Bei geaenderten Positionen ODER geaendertem Satz: Summen neu mit dem
    // tatsaechlichen Satz der Rechnung berechnen (nicht stur 19 %).
    if (dto.items || dto.mwstSatz !== undefined) {
      Object.assign(invoice, this.totals(invoice.items, Number(invoice.mwstSatz)));
    }
    if (dto.hinweis !== undefined) invoice.hinweis = dto.hinweis;
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Invoice',
      entityId: id,
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async changeStatus(user: AuthUser, id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    if (!statuswechselErlaubt(invoice.art, invoice.status, status)) {
      throw new ConflictException(
        `Statuswechsel "${invoice.status}" -> "${status}" ist fuer diese Rechnung nicht erlaubt.`,
      );
    }

    // GoBD: Bei der Festsetzung (Entwurf -> Offen) bekommt die Rechnung ihre
    // lueckenlose RE-Nummer (falls noch keine vorhanden).
    if (
      status === InvoiceStatus.OFFEN &&
      invoice.art === InvoiceKind.RECHNUNG &&
      !invoice.nummer
    ) {
      invoice.nummer = await nextSequentialNumber(this.repo, user.tenantId, 'RE', {
        nummerFeld: 'nummer',
      });
    }

    invoice.status = status;
    // Konsistenz: jeder Weg nach 'bezahlt' erfasst das Zahldatum (auch der generische
    // Statuswechsel, nicht nur POST /:id/bezahlt).
    if (status === InvoiceStatus.BEZAHLT && !invoice.zahldatum) {
      invoice.zahldatum = new Date();
    }

    // Beim Stellen einer Rechnung (offen) sevdesk-Stub anstossen.
    if (status === InvoiceStatus.OFFEN && invoice.art === InvoiceKind.RECHNUNG) {
      const sevdeskId = await this.sevdesk.createInvoice(invoice);
      if (sevdeskId) invoice.sevdeskInvoiceId = sevdeskId;
    }
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Invoice',
      entityId: id,
      payload: { status },
    });
    return saved;
  }

  /**
   * Rendert die PDF eines Belegs. Laedt die Invoice tenant-scoped (findOne wirft
   * NotFound bei Fremd-/Nichtexistenz) und zusaetzlich Customer (im selben Tenant)
   * + Tenant (Absender). Gibt einen PDF-Buffer zurueck.
   */
  /** Laedt Invoice (tenant-scoped, items) + Customer + Tenant fuer PDF/Versand. */
  private async loadContext(tenantId: string, id: string) {
    const invoice = await this.findOne(tenantId, id);
    const customer = await this.customerRepo.findOne({
      where: { id: invoice.customerId, tenantId },
    });
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return { invoice, customer, tenant };
  }

  async buildPdf(tenantId: string, id: string): Promise<{ buffer: Buffer; nummer: string }> {
    const { invoice, customer, tenant } = await this.loadContext(tenantId, id);
    const buffer = await this.pdf.render(invoice as any, customer as any, tenant as any);
    return { buffer, nummer: invoice.nummer ?? 'Entwurf' };
  }

  /**
   * Versendet den Beleg als PDF-Anhang per E-Mail an die Kunden-Adresse. Nur Belege
   * MIT Nummer (Angebot hat sie ab Anlage; Rechnung erst nach Festsetzung) – ein
   * Rechnungs-Entwurf ohne Nummer wird abgelehnt. Stornierte Belege ebenfalls.
   * Setzt versendetAm. Ohne SMTP (Dev) loggt MailService nur – Status wird trotzdem
   * gesetzt, damit der Ablauf testbar bleibt.
   */
  async sendByEmail(user: AuthUser, id: string): Promise<Invoice> {
    const { invoice, customer, tenant } = await this.loadContext(user.tenantId, id);
    if (invoice.status === InvoiceStatus.STORNIERT) {
      throw new BadRequestException('Ein stornierter Beleg kann nicht versendet werden.');
    }
    if (!invoice.nummer) {
      throw new BadRequestException(
        'Bitte die Rechnung zuerst festsetzen (Nummer vergeben), bevor sie versendet wird.',
      );
    }
    const email = customer?.email?.trim();
    if (!email) {
      throw new BadRequestException('Der Kunde hat keine E-Mail-Adresse hinterlegt.');
    }

    const buffer = await this.pdf.render(invoice as any, customer as any, tenant as any);
    const { subject, html, text } = this.buildBelegMail(invoice, customer, tenant);
    await this.mail.send({
      to: email,
      subject,
      html,
      text,
      attachments: [{ filename: `${invoice.nummer}.pdf`, content: buffer }],
    });

    await this.repo.update({ id, tenantId: user.tenantId }, { versendetAm: new Date() });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'email_sent',
      entityType: 'Invoice',
      entityId: id,
      payload: { nummer: invoice.nummer, to: email },
    });
    return this.findOne(user.tenantId, id);
  }

  /** Baut Betreff + HTML/Text der Beleg-Mail (Angebot oder Rechnung). */
  private buildBelegMail(invoice: Invoice, customer: Customer | null, tenant: Tenant | null) {
    const istAngebot = invoice.art === InvoiceKind.ANGEBOT;
    const doc = istAngebot ? 'Angebot' : 'Rechnung';
    const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';
    const brutto = this.formatEuro(Number(invoice.brutto));
    const subject = `${doc} ${invoice.nummer} von ${betrieb}`;

    const zeilen: string[] = [this.kundenAnrede(customer), ''];
    if (istAngebot) {
      zeilen.push(`anbei erhalten Sie unser Angebot ${invoice.nummer} über ${brutto}.`);
      zeilen.push('Bei Fragen oder zur Beauftragung melden Sie sich gerne bei uns.');
    } else {
      zeilen.push(`anbei erhalten Sie Ihre Rechnung ${invoice.nummer} über ${brutto}.`);
      if (invoice.faelligkeitsdatum) {
        zeilen.push(`Wir bitten um Zahlung bis zum ${this.formatDatum(invoice.faelligkeitsdatum)}.`);
      }
    }
    zeilen.push('', 'Das Dokument finden Sie im PDF-Anhang.', '', 'Mit freundlichen Grüßen', betrieb);
    return { subject, html: this.linesToHtml(zeilen), text: zeilen.join('\n') };
  }

  /** Baut Betreff + HTML/Text einer Mahnung/Zahlungserinnerung. */
  private buildMahnungMail(
    invoice: Invoice,
    customer: Customer | null,
    tenant: Tenant | null,
    stufe: number,
    zahlbarBis: Date,
  ) {
    const titel = MAHN_TITEL[stufe] ?? 'Zahlungserinnerung';
    const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';
    const brutto = this.formatEuro(Number(invoice.brutto));
    const subject = `${titel}: Rechnung ${invoice.nummer} von ${betrieb}`;

    const zeilen: string[] = [this.kundenAnrede(customer), ''];
    if (stufe <= 1) {
      zeilen.push(`unsere Rechnung ${invoice.nummer} über ${brutto} ist bei uns noch offen.`);
      zeilen.push('Falls Sie bereits gezahlt haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.');
    } else {
      zeilen.push(`zu unserer Rechnung ${invoice.nummer} über ${brutto} liegt uns noch kein Zahlungseingang vor.`);
    }
    zeilen.push(`Wir bitten um Ausgleich bis zum ${this.formatDatum(zahlbarBis)}.`);
    zeilen.push('', 'Die Einzelheiten finden Sie im PDF-Anhang.', '', 'Mit freundlichen Grüßen', betrieb);
    return { subject, html: this.linesToHtml(zeilen), text: zeilen.join('\n') };
  }

  private linesToHtml(zeilen: string[]): string {
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">${zeilen
      .map((z) => (z === '' ? '<br/>' : `<p style="margin:0 0 4px">${this.escapeHtml(z)}</p>`))
      .join('')}</div>`;
  }

  private kundenAnrede(customer: Customer | null): string {
    const name =
      customer?.type === CustomerType.BUSINESS
        ? customer?.companyName
        : [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');
    return name ? `Guten Tag ${name},` : 'Guten Tag,';
  }

  private formatEuro(value: number): string {
    return `${value.toFixed(2).replace('.', ',')} €`;
  }

  private formatDatum(d: Date): string {
    const date = new Date(d);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  private escapeHtml(s: string): string {
    return s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
    );
  }

  /** Markiert eine Rechnung als bezahlt und erfasst das Zahldatum. */
  async markPaid(user: AuthUser, id: string): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    // Nur gestellte (offene) Rechnungen koennen bezahlt werden – ein Entwurf
    // muss erst festgesetzt werden (sonst Rechnung ohne Nummer).
    if (!statuswechselErlaubt(invoice.art, invoice.status, InvoiceStatus.BEZAHLT)) {
      throw new ConflictException(
        'Nur gestellte (offene) Rechnungen koennen als bezahlt markiert werden.',
      );
    }
    invoice.status = InvoiceStatus.BEZAHLT;
    invoice.zahldatum = new Date();
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'mark_paid',
      entityType: 'Invoice',
      entityId: id,
      payload: { zahldatum: invoice.zahldatum },
    });
    return saved;
  }

  /** Tage, die eine Rechnung ueber ihre (ggf. abgeleitete) Faelligkeit hinaus ist. */
  private tageUeberfaellig(inv: Invoice): number {
    const tag = 24 * 60 * 60 * 1000;
    const faellig = inv.faelligkeitsdatum
      ? new Date(inv.faelligkeitsdatum).getTime()
      : inv.datum
        ? new Date(inv.datum).getTime() + (inv.zahlungsziel ?? 14) * tag
        : null;
    if (faellig == null) return 0;
    return Math.max(0, Math.floor((Date.now() - faellig) / tag));
  }

  /**
   * Mahnt eine offene Rechnung: erhoeht die Mahnstufe (max 3), rendert das
   * passende Mahn-/Erinnerungs-PDF und versendet es per E-Mail an den Kunden.
   * Nur offene Rechnungen (mit Nummer); Angebote/Entwuerfe/stornierte -> 400.
   * Ohne SMTP (Dev) loggt MailService nur – Stufe wird trotzdem erhoeht.
   */
  async mahnen(user: AuthUser, id: string): Promise<Invoice> {
    const { invoice, customer, tenant } = await this.loadContext(user.tenantId, id);
    if (invoice.art !== InvoiceKind.RECHNUNG) {
      throw new BadRequestException('Nur Rechnungen können gemahnt werden.');
    }
    if (invoice.status !== InvoiceStatus.OFFEN || !invoice.nummer) {
      throw new BadRequestException('Nur gestellte, offene Rechnungen können gemahnt werden.');
    }
    const email = customer?.email?.trim();
    if (!email) {
      throw new BadRequestException('Der Kunde hat keine E-Mail-Adresse hinterlegt.');
    }

    const neueStufe = Math.min((invoice.mahnstufe ?? 0) + 1, 3);
    const mahndatum = new Date();
    const zahlbarBis = new Date(mahndatum.getTime() + 7 * 24 * 60 * 60 * 1000);

    const buffer = await this.pdf.renderMahnung(invoice as any, customer as any, tenant as any, {
      mahnstufe: neueStufe,
      mahndatum,
      zahlbarBis,
      tageUeberfaellig: this.tageUeberfaellig(invoice),
    });
    const { subject, html, text } = this.buildMahnungMail(invoice, customer, tenant, neueStufe, zahlbarBis);
    const dateiTitel = (MAHN_TITEL[neueStufe] ?? 'Mahnung').replace(/[^A-Za-z0-9]+/g, '-');
    await this.mail.send({
      to: email,
      subject,
      html,
      text,
      attachments: [{ filename: `${dateiTitel}_${invoice.nummer}.pdf`, content: buffer }],
    });

    await this.repo.update({ id, tenantId: user.tenantId }, { mahnstufe: neueStufe });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'mahnung_sent',
      entityType: 'Invoice',
      entityId: id,
      payload: { mahnstufe: neueStufe, to: email },
    });
    return this.findOne(user.tenantId, id);
  }

  /**
   * Mahnliste: offene Rechnungen, deren Faelligkeit ueberschritten ist. Tenant-scoped
   * via where {tenantId, status: OFFEN, art: RECHNUNG}. Effektive Faelligkeit =
   * gespeichertes faelligkeitsdatum, sonst (Altbestand) aus datum + zahlungsziel
   * (Default 14 Tage) abgeleitet, damit alte offene Rechnungen ohne gesetztes
   * Faelligkeitsdatum nicht durch die Mahnliste fallen. Vergleich bewusst in JS
   * (TypeORM-Date-Vergleich ist treiberabhaengig).
   */
  async mahnliste(tenantId: string): Promise<Array<Invoice & { tageUeberfaellig: number }>> {
    const offene = await this.repo.find({
      where: { tenantId, status: InvoiceStatus.OFFEN, art: InvoiceKind.RECHNUNG },
      relations: ['items'],
    });
    const now = Date.now();
    const tag = 24 * 60 * 60 * 1000;
    const faelligVon = (inv: Invoice): number | null => {
      if (inv.faelligkeitsdatum) return new Date(inv.faelligkeitsdatum).getTime();
      if (inv.datum) return new Date(inv.datum).getTime() + (inv.zahlungsziel ?? 14) * tag;
      return null;
    };
    return offene
      .map((inv) => ({ inv, faellig: faelligVon(inv) }))
      .filter((x) => x.faellig != null && x.faellig < now)
      .map(({ inv, faellig }) => ({
        ...inv,
        tageUeberfaellig: Math.floor((now - (faellig as number)) / tag),
      }))
      .sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);
  }
}
