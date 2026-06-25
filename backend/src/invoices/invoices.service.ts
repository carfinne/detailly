import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceItemDto } from './dto/invoice.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicePdfService } from './invoice-pdf.service';

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

  private totals(items: InvoiceItem[]) {
    const netto = items.reduce((sum, i) => sum + Number(i.gesamtpreis), 0);
    const mwst = Math.round(netto * MWST_SATZ * 100) / 100;
    const brutto = Math.round((netto + mwst) * 100) / 100;
    return { netto, mwst, brutto };
  }

  private prefix(art: InvoiceKind): string {
    return art === InvoiceKind.ANGEBOT ? 'AN' : 'RE';
  }

  findAll(tenantId: string, query: { art?: InvoiceKind; status?: InvoiceStatus } = {}) {
    const where: Record<string, unknown> = { tenantId };
    if (query.art) where.art = query.art;
    if (query.status) where.status = query.status;
    return this.repo.find({ where, relations: ['items'], order: { createdAt: 'DESC' } });
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
    const nummer = await nextSequentialNumber(this.repo, user.tenantId, this.prefix(art));
    const items = this.buildItems(dto.items);
    const t = this.totals(items);

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
  async createFromOrder(user: AuthUser, orderId: string, art = InvoiceKind.RECHNUNG): Promise<Invoice> {
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

    return this.create(user, { customerId: order.customerId, orderId: order.id, art, items });
  }

  async update(user: AuthUser, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    if (dto.items) {
      await this.itemRepo.delete({ invoiceId: id });
      invoice.items = this.buildItems(dto.items).map((i) => {
        i.invoiceId = id;
        return i;
      });
      Object.assign(invoice, this.totals(invoice.items));
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
  async buildPdf(tenantId: string, id: string): Promise<{ buffer: Buffer; nummer: string }> {
    const invoice = await this.findOne(tenantId, id);
    const customer = await this.customerRepo.findOne({
      where: { id: invoice.customerId, tenantId },
    });
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const buffer = await this.pdf.render(invoice as any, customer as any, tenant as any);
    return { buffer, nummer: invoice.nummer };
  }

  /** Markiert eine Rechnung als bezahlt und erfasst das Zahldatum. */
  async markPaid(user: AuthUser, id: string): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
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

  /** Erhoeht die Mahnstufe (max 3). Nur ein Zaehler - kein Mahnbrief/Versand. */
  async raiseMahnstufe(user: AuthUser, id: string): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    invoice.mahnstufe = Math.min((invoice.mahnstufe ?? 0) + 1, 3);
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'mahnstufe',
      entityType: 'Invoice',
      entityId: id,
      payload: { mahnstufe: invoice.mahnstufe },
    });
    return saved;
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
