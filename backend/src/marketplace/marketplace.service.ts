import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Like, MoreThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder, MarketplaceOrderStatus } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { withUniqueRetry } from '../common/unique-retry';
import { MailService } from '../mailer/mail.service';
import { KybService, HochgeladenesDokument } from './kyb.service';
import {
  CreateDealerDto,
  UpdateDealerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateMarketplaceOrderDto,
  PortalProductDto,
  UpdatePortalProductDto,
  HaendlerBewerbungDto,
  MARKTPLATZ_BEREICHE,
} from './dto/marketplace.dto';

/** Kaufmaennisch auf 2 Nachkommastellen runden (Preise/Provisionen). */
const rund2 = (n: number) => Math.round(n * 100) / 100;

/**
 * B2B-Marktplatz (Detailly-kuratiert, plattform-weit). Betriebe sehen den
 * Katalog, klicken zum Haendler (Affiliate) ODER bestellen direkt in der App
 * (Provision fuer den Betreiber). Haendler pflegen Produkte + wickeln
 * Bestellungen ueber das Token-Portal ab; Pflege der Haendler selbst
 * ausschliesslich durch Plattform-Rollen (Controller-Guards).
 */
@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(MarketplaceDealer) private readonly dealerRepo: Repository<MarketplaceDealer>,
    @InjectRepository(MarketplaceProduct) private readonly productRepo: Repository<MarketplaceProduct>,
    @InjectRepository(MarketplaceClick) private readonly clickRepo: Repository<MarketplaceClick>,
    @InjectRepository(MarketplaceOrder) private readonly orderRepo: Repository<MarketplaceOrder>,
    @InjectRepository(MarketplaceOrderItem)
    private readonly orderItemRepo: Repository<MarketplaceOrderItem>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly kyb: KybService,
  ) {}

  // ---------------------------------------------------------------------------
  // Katalog (Kunden-Seite)
  // ---------------------------------------------------------------------------

  /**
   * Kompletter aktiver Katalog in EINEM Aufruf (kuratiert -> ueberschaubar
   * gross): Produkte inkl. Haendlername, Haendlerliste, Kategorien. Das
   * Frontend filtert clientseitig -> sofortige Reaktion ohne Requests.
   */
  async catalog() {
    const [produkte, haendler] = await Promise.all([
      this.productRepo.find({
        where: { aktiv: true },
        order: { klicks: 'DESC', createdAt: 'DESC' },
        take: 1000,
      }),
      // Welle 3: NUR aktiv + freigegeben - beantragte/abgelehnte Bewerbungen
      // tauchen NIE im Katalog auf (Bestand traegt den Default 'freigegeben').
      this.dealerRepo.find({ where: { aktiv: true, status: 'freigegeben' }, order: { name: 'ASC' } }),
    ]);
    const dealerById = new Map(haendler.map((d) => [d.id, d.name]));
    // Legacy-Feld (kann leer sein); die Navigation laeuft ueber bereich+marke.
    const kategorien = [...new Set(produkte.map((p) => p.kategorie).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    );
    return {
      produkte: produkte
        // Produkte deaktivierter Haendler nicht anbieten.
        .filter((p) => dealerById.has(p.dealerId))
        .map((p) => ({ ...p, haendlerName: dealerById.get(p.dealerId)! })),
      haendler: haendler.map((d) => ({
        id: d.id,
        name: d.name,
        beschreibung: d.beschreibung,
        logoUrl: d.logoUrl,
        webseite: d.webseite,
      })),
      kategorien,
    };
  }

  /**
   * Klick auf "Zum Haendler": zaehlt (Einzelklick + atomarer Zaehler) und gibt
   * den Affiliate-Link zurueck – die URL kommt vom Server, nie vom Client.
   */
  async klick(user: AuthUser, productId: string): Promise<{ affiliateUrl: string }> {
    const product = await this.productRepo.findOne({ where: { id: productId, aktiv: true } });
    // Bestellbare Produkte ohne Affiliate-Link haben keinen "Zum Haendler"-Weg.
    if (!product || !product.affiliateUrl) throw new NotFoundException('Produkt nicht gefunden');
    await Promise.all([
      this.clickRepo.save(
        this.clickRepo.create({
          productId: product.id,
          dealerId: product.dealerId,
          tenantId: user.tenantId,
        }),
      ),
      this.productRepo.increment({ id: product.id }, 'klicks', 1),
    ]);
    return { affiliateUrl: product.affiliateUrl };
  }

  // ---------------------------------------------------------------------------
  // In-App-Bestellungen (Betrieb)
  // ---------------------------------------------------------------------------

  /**
   * Bestellung aus dem Warenkorb. Der Korb wird JE HAENDLER in eigene
   * Bestellungen aufgeteilt (jeder Haendler wickelt eigenstaendig ab). Preise
   * und Provisionssatz kommen ausschliesslich vom Server (Snapshot) - der
   * Client liefert nur productId + menge.
   */
  async createOrders(user: AuthUser, dto: CreateMarketplaceOrderDto): Promise<MarketplaceOrder[]> {
    // Doppelte Positionen desselben Produkts zusammenfassen.
    const mengeByProduct = new Map<string, number>();
    for (const p of dto.positionen) {
      mengeByProduct.set(p.productId, (mengeByProduct.get(p.productId) ?? 0) + p.menge);
    }

    const produkte = await this.productRepo.find({
      where: { id: In([...mengeByProduct.keys()]), aktiv: true, bestellbar: true },
    });
    if (produkte.length !== mengeByProduct.size) {
      throw new BadRequestException('Mindestens ein Produkt ist nicht (mehr) bestellbar.');
    }
    const ohnePreis = produkte.find((p) => p.preis == null);
    if (ohnePreis) {
      throw new BadRequestException(`"${ohnePreis.name}" hat keinen festen Preis und ist nicht direkt bestellbar.`);
    }

    const dealerIds = [...new Set(produkte.map((p) => p.dealerId))];
    const dealers = await this.dealerRepo.find({
      where: { id: In(dealerIds), aktiv: true, status: 'freigegeben' },
    });
    if (dealers.length !== dealerIds.length) {
      throw new BadRequestException('Mindestens ein Haendler ist nicht mehr aktiv.');
    }
    const dealerById = new Map(dealers.map((d) => [d.id, d]));

    // Kontakt-/Lieferdaten-Snapshot, identisch fuer alle Teil-Bestellungen.
    const snapshot = {
      tenantId: user.tenantId,
      createdByUserId: user.id,
      kontaktName: dto.kontaktName.trim(),
      kontaktEmail: dto.kontaktEmail.trim(),
      kontaktTelefon: dto.kontaktTelefon?.trim() || null,
      lieferFirma: dto.lieferFirma?.trim() || null,
      lieferStrasse: dto.lieferStrasse?.trim() || null,
      lieferPlz: dto.lieferPlz?.trim() || null,
      lieferOrt: dto.lieferOrt?.trim() || null,
      lieferLand: dto.lieferLand?.trim() || 'DE',
      notiz: dto.notiz?.trim() || null,
    };

    // B5: Der Nummernkreis MP-<Jahr>-<lfd> liegt auf einem GLOBALEN UNIQUE-Index.
    // Ohne withUniqueRetry crashen parallele Bestellungen am Index (500, Bestellung
    // verloren). Retry umschliesst die GESAMTE Transaktion (mehrere Teil-Belege je
    // Haendler), sodass bei Kollision der komplette Nummernblock neu gezogen wird.
    const orders = await withUniqueRetry(() =>
      this.dataSource.transaction(async (em) => {
      const orderRepo = em.getRepository(MarketplaceOrder);
      const itemRepo = em.getRepository(MarketplaceOrderItem);
      const jahr = new Date().getFullYear();
      // Plattformweiter Nummernkreis MP-<Jahr>-<lfd>, PRO JAHR gezaehlt (Jahres-Reset).
      let lfd = await orderRepo.count({ where: { nummer: Like(`MP-${jahr}-%`) } });

      const ergebnis: MarketplaceOrder[] = [];
      for (const dealerId of dealerIds) {
        const dealer = dealerById.get(dealerId)!;
        const dealerProdukte = produkte.filter((p) => p.dealerId === dealerId);

        let summeBrutto = 0;
        let summeProvision = 0;
        const items = dealerProdukte.map((p) => {
          const menge = mengeByProduct.get(p.id)!;
          const zeilenSumme = rund2(Number(p.preis) * menge);
          const provisionBetrag = rund2((zeilenSumme * Number(dealer.provisionSatz)) / 100);
          summeBrutto = rund2(summeBrutto + zeilenSumme);
          summeProvision = rund2(summeProvision + provisionBetrag);
          return itemRepo.create({
            dealerId,
            productId: p.id,
            produktName: p.name,
            einzelpreis: Number(p.preis),
            menge,
            zeilenSumme,
            provisionSatz: Number(dealer.provisionSatz),
            provisionBetrag,
          });
        });

        lfd += 1;
        const order = await orderRepo.save(
          orderRepo.create({
            ...snapshot,
            nummer: `MP-${jahr}-${String(lfd).padStart(4, '0')}`,
            dealerId,
            status: MarketplaceOrderStatus.EINGEGANGEN,
            summeBrutto,
            summeProvision,
          }),
        );
        for (const item of items) item.orderId = order.id;
        await itemRepo.save(items);
        ergebnis.push(order);
      }
      return ergebnis;
      }),
    );

    // Haendler benachrichtigen - fire-and-forget, Bestellung haengt NIE an SMTP.
    for (const order of orders) {
      const dealer = dealerById.get(order.dealerId);
      if (!dealer?.kontaktEmail) continue;
      void this.mail
        .send({
          to: dealer.kontaktEmail,
          subject: `Neue Marktplatz-Bestellung ${order.nummer}`,
          text:
            `Hallo ${dealer.name},\n\n` +
            `ueber den Detailly-Marktplatz ist die Bestellung ${order.nummer} eingegangen ` +
            `(Summe ${Number(order.summeBrutto).toFixed(2)} EUR).\n` +
            `Details und Abwicklung in eurem Haendler-Portal.`,
        })
        .catch((err) => this.logger.warn(`Bestell-Mail fehlgeschlagen: ${err?.message ?? err}`));
    }

    return this.ordersMitPositionen(orders.map((o) => o.id));
  }

  /** Bestellungen des eigenen Betriebs (inkl. Positionen + Haendlername). */
  async listOrdersForTenant(tenantId: string) {
    const orders = await this.orderRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return this.anreichern(orders);
  }

  /** Bestellungen (per Id) inkl. Positionen + Haendlername nachladen. */
  private async ordersMitPositionen(ids: string[]) {
    if (ids.length === 0) return [];
    const orders = await this.orderRepo.find({ where: { id: In(ids) } });
    return this.anreichern(orders);
  }

  /** Positionen + Haendlernamen an eine Bestell-Liste haengen. */
  private async anreichern(orders: MarketplaceOrder[]) {
    if (orders.length === 0) return [];
    const [items, dealers] = await Promise.all([
      this.orderItemRepo.find({ where: { orderId: In(orders.map((o) => o.id)) } }),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return orders.map((o) => ({
      ...o,
      haendlerName: nameById.get(o.dealerId) ?? '—',
      positionen: items.filter((i) => i.orderId === o.id),
    }));
  }

  // ---------------------------------------------------------------------------
  // Haendler-Portal (Capability-Token, kein Login)
  // ---------------------------------------------------------------------------

  /**
   * Haendler per Portal-Token aufloesen. Format-Check VOR dem DB-Zugriff
   * (Anti-Enumeration, wie Freigabe-/Kalender-Token); unbekannt -> 404 ohne
   * Hinweis, ob der Token je existierte.
   */
  private async dealerByToken(token: string): Promise<MarketplaceDealer> {
    const clean = (token ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Portal nicht gefunden');
    const dealer = await this.dealerRepo.findOne({
      where: { uploadToken: clean, aktiv: true, status: 'freigegeben' },
    });
    if (!dealer) throw new NotFoundException('Portal nicht gefunden');
    return dealer;
  }

  /** Portal-Startseite: Haendler-Profil + eigene Produkte + eigene Bestellungen. */
  async portalOverview(token: string) {
    const dealer = await this.dealerByToken(token);
    const [produkte, orders] = await Promise.all([
      this.productRepo.find({ where: { dealerId: dealer.id }, order: { createdAt: 'DESC' } }),
      this.orderRepo.find({
        where: { dealerId: dealer.id },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    ]);
    const items = orders.length
      ? await this.orderItemRepo.find({ where: { orderId: In(orders.map((o) => o.id)) } })
      : [];
    return {
      haendler: {
        id: dealer.id,
        name: dealer.name,
        logoUrl: dealer.logoUrl,
        provisionSatz: dealer.provisionSatz,
      },
      produkte,
      bestellungen: orders.map((o) => ({
        ...o,
        positionen: items.filter((i) => i.orderId === o.id),
      })),
    };
  }

  /** Haendler legt ein eigenes Produkt an (dealerId kommt aus dem Token). */
  async portalCreateProduct(token: string, dto: PortalProductDto): Promise<MarketplaceProduct> {
    const dealer = await this.dealerByToken(token);
    this.assertVertriebsweg(dto);
    return this.productRepo.save(this.productRepo.create({ ...dto, dealerId: dealer.id }));
  }

  /** Haendler bearbeitet ein EIGENES Produkt (fremde -> 404, kein Orakel). */
  async portalUpdateProduct(
    token: string,
    productId: string,
    dto: UpdatePortalProductDto,
  ): Promise<MarketplaceProduct> {
    const dealer = await this.dealerByToken(token);
    const product = await this.productRepo.findOne({
      where: { id: productId, dealerId: dealer.id },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    Object.assign(product, dto);
    this.assertVertriebsweg(product);
    return this.productRepo.save(product);
  }

  /** Mindestens ein Vertriebsweg: bestellbar (mit Preis) ODER Affiliate-Link. */
  private assertVertriebsweg(p: { bestellbar?: boolean; preis?: number; affiliateUrl?: string }) {
    if (p.bestellbar && p.preis == null) {
      throw new BadRequestException('Bestellbare Produkte brauchen einen festen Preis.');
    }
    if (!p.bestellbar && !p.affiliateUrl) {
      throw new BadRequestException(
        'Produkt braucht einen Vertriebsweg: "bestellbar" (mit Preis) oder einen Affiliate-Link.',
      );
    }
  }

  /**
   * Haendler setzt den Status einer EIGENEN Bestellung. Erlaubte Uebergaenge
   * (kein Zuruecksetzen, kein Ent-Stornieren):
   * eingegangen -> bestaetigt|storniert; bestaetigt -> versendet|storniert.
   */
  async portalSetOrderStatus(token: string, orderId: string, status: MarketplaceOrderStatus) {
    const dealer = await this.dealerByToken(token);
    const order = await this.orderRepo.findOne({ where: { id: orderId, dealerId: dealer.id } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');

    const erlaubt: Record<MarketplaceOrderStatus, MarketplaceOrderStatus[]> = {
      [MarketplaceOrderStatus.EINGEGANGEN]: [
        MarketplaceOrderStatus.BESTAETIGT,
        MarketplaceOrderStatus.STORNIERT,
      ],
      [MarketplaceOrderStatus.BESTAETIGT]: [
        MarketplaceOrderStatus.VERSENDET,
        MarketplaceOrderStatus.STORNIERT,
      ],
      [MarketplaceOrderStatus.VERSENDET]: [],
      [MarketplaceOrderStatus.STORNIERT]: [],
    };
    if (!erlaubt[order.status].includes(status)) {
      throw new BadRequestException(`Statuswechsel ${order.status} -> ${status} ist nicht erlaubt.`);
    }
    order.status = status;
    await this.orderRepo.save(order);
    return order;
  }

  // ---------------------------------------------------------------------------
  // Grosshaendler-Bewerbung (oeffentlich) + Betreiber-Review (Welle 3)
  // ---------------------------------------------------------------------------

  /**
   * Nimmt eine oeffentliche Grosshaendler-Bewerbung entgegen. Es entsteht ein
   * Dealer mit status='beantragt' + aktiv=false und OHNE Portal-Token - erst
   * die Betreiber-Freigabe schaltet frei (KEINE Selbst-Freischaltung). Es wird
   * bewusst KEINE Mail automatisch verschickt (Review-before-send). Antwortet
   * ohne Echo der Eingaben.
   *
   * Welle 5 (KYB): Die Gewerbeanmeldung ist PFLICHT. Sie wird VOR dem Speichern
   * geprueft (Magic-Byte/Groesse) und verschluesselt abgelegt; sha256 + Pfad landen
   * am Dealer. Die assistierte Vorpruefung laeuft danach FIRE-AND-FORGET (die
   * Antwort an den Bewerber haengt nie am 60s-Vision-Call).
   */
  async createBewerbung(
    dto: HaendlerBewerbungDto,
    dokument?: HochgeladenesDokument,
  ): Promise<{ ok: true }> {
    // Honeypot: gefuellt => Bot. Erfolg vortaeuschen, NICHTS speichern (auch keine
    // Datei) - gleiches Muster wie die Online-Terminanfrage.
    if (dto.website && dto.website.trim().length > 0) return { ok: true };

    const email = dto.kontaktEmail.trim().toLowerCase();

    // Doppel-Bewerbungs-Guard ZUERST (vor dem Datei-Write): dieselbe E-Mail mit
    // OFFENEM Antrag -> 409, ohne verwaiste Dokument-Datei auf der Platte.
    const offen = await this.dealerRepo.findOne({
      where: { kontaktEmail: email, status: 'beantragt' },
    });
    if (offen) {
      throw new ConflictException(
        'Für diese E-Mail-Adresse liegt bereits eine Bewerbung vor. Wir melden uns, sobald sie geprüft ist.',
      );
    }

    // Dokument pruefen + verschluesselt ablegen (wirft 400 bei fehlend/zu gross/
    // falschem Typ). Ohne gueltiges Dokument entsteht KEINE Bewerbung.
    const { pfad, hash } = await this.kyb.speichereDokument(dokument);

    // Sortiment auf die festen Marktplatz-Bereiche eindampfen (kein Freitext).
    const sortiment = (dto.sortiment ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => MARKTPLATZ_BEREICHE.includes(s));

    const saved = await this.dealerRepo.save(
      this.dealerRepo.create({
        name: dto.name.trim(),
        ansprechpartner: dto.ansprechpartner.trim(),
        kontaktEmail: email,
        ustIdNr: dto.ustIdNr.trim(),
        telefon: dto.telefon?.trim() || undefined,
        webseite: dto.webseite?.trim() || undefined,
        adresse: dto.adresse?.trim() || undefined,
        sortiment: sortiment.length ? sortiment.join(',') : undefined,
        nachricht: dto.nachricht?.trim() || undefined,
        gewerbeanmeldungDatei: pfad,
        dokumentHash: hash,
        status: 'beantragt',
        aktiv: false,
        beantragtAm: new Date(),
        // KEIN uploadToken - der entsteht erst bei der Freigabe.
      }),
    );

    // Assistierte Vorpruefung im Hintergrund (Ampel + Abweichungen). Fehler werden
    // im Service abgefangen; die Bewerbung ist bereits erfolgreich gespeichert.
    void this.kyb.pruefeBewerbung(saved.id);

    return { ok: true };
  }

  /**
   * Laedt + entschluesselt die Gewerbeanmeldung eines Dealers fuer die
   * guard-geschuetzte Review-Vorschau (nur Plattform-Rollen, s. Controller).
   */
  async dokumentAnzeigen(id: string): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer || !dealer.gewerbeanmeldungDatei) {
      throw new NotFoundException('Kein Dokument vorhanden');
    }
    return this.kyb.ladeDokument(dealer.gewerbeanmeldungDatei);
  }

  /** Ist der Plattform-SMTP konfiguriert? (Gleiche Bedingung wie MailService-Transporter.) */
  private mailKonfiguriert(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  /** Basis-URL fuer Links nach draussen (gleiches Muster wie BookingRequestsService). */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  /**
   * Betreiber gibt eine Bewerbung frei: status='freigegeben' + aktiv, Provision
   * (im Review anpassbar, sonst bleibt der gespeicherte Satz/Default 10) und ein
   * frischer Portal-Token. Der Rohwert des Tokens wird NUR hier zurueckgegeben.
   * `mailKonfiguriert` sagt dem Frontend, ob "Link per Mail senden" moeglich ist
   * (sonst Link-Kopier-Dialog).
   */
  async freigeben(
    id: string,
    provisionSatz?: number,
    geprueftVonUserId?: string,
  ): Promise<{
    haendler: { id: string; name: string; kontaktEmail: string | null; provisionSatz: number };
    uploadToken: string;
    portalPfad: string;
    mailKonfiguriert: boolean;
  }> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');

    // KYB-Gate (Welle 5): eine BEWORBENE Freigabe setzt eine gesichtete
    // Gewerbeanmeldung voraus. Direkt (vom Betreiber) angelegte Haendler sind nie
    // 'beantragt' und daher nicht betroffen.
    if (dealer.status === 'beantragt' && !dealer.gewerbeanmeldungDatei) {
      throw new BadRequestException('Freigabe erst nach Upload der Gewerbeanmeldung möglich.');
    }

    const token = crypto.randomBytes(24).toString('hex'); // 192 Bit, passt zum Format-Check
    dealer.status = 'freigegeben';
    dealer.aktiv = true;
    if (provisionSatz != null) dealer.provisionSatz = provisionSatz;
    if (geprueftVonUserId) dealer.kybGeprueftVonUserId = geprueftVonUserId;
    await this.dealerRepo.save(dealer);
    // Token separat per update (Spalte ist select:false - save() wuerde sie nicht anfassen).
    await this.dealerRepo.update(dealer.id, { uploadToken: token });

    return {
      haendler: {
        id: dealer.id,
        name: dealer.name,
        kontaktEmail: dealer.kontaktEmail ?? null,
        provisionSatz: Number(dealer.provisionSatz),
      },
      uploadToken: token,
      portalPfad: `/haendler?t=${token}`,
      mailKonfiguriert: this.mailKonfiguriert(),
    };
  }

  /**
   * Betreiber lehnt eine Bewerbung ab. DSGVO/PII-Sparsamkeit: eine abgelehnte
   * Bewerbung begruendet keine Geschaeftsbeziehung -> nachricht + adresse werden
   * SOFORT genullt (Muster: BookingRequestsService.reject). Name/E-Mail bleiben
   * fuer den Doppel-Bewerbungs-Kontext des Betreibers stehen; ein evtl.
   * vorhandener Token wird entzogen.
   */
  async ablehnen(id: string, geprueftVonUserId?: string): Promise<MarketplaceDealer> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    dealer.status = 'abgelehnt';
    dealer.aktiv = false;
    dealer.nachricht = null as unknown as string;
    dealer.adresse = null as unknown as string;
    // KYB (Welle 5): Ablehnungs-Uhr fuer die 90-Tage-Dokument-Retention setzen und
    // den bescheidenden Plattform-Mitarbeiter festhalten. Das Dokument bleibt bis
    // zur Retention erhalten (Beleg-/Beweisinteresse in der Widerspruchsfrist).
    dealer.abgelehntAm = new Date();
    if (geprueftVonUserId) dealer.kybGeprueftVonUserId = geprueftVonUserId;
    const saved = await this.dealerRepo.save(dealer);
    await this.dealerRepo.update(dealer.id, { uploadToken: null as unknown as string });
    return saved;
  }

  /**
   * Verschickt den Portal-Link an die Kontakt-Adresse des Haendlers - IMMER nur
   * als vom Betreiber BESTAETIGTE Aktion (Review-before-send; der Aufruf kommt
   * ausschliesslich aus dem Freigabe-Dialog). Ohne SMTP -> klarer 400, das
   * Frontend zeigt dann den Link-Kopier-Dialog.
   */
  async sendPortalLinkMail(id: string): Promise<{ ok: true; to: string }> {
    if (!this.mailKonfiguriert()) {
      throw new BadRequestException(
        'Kein Mail-Versand konfiguriert (SMTP). Bitte den Link kopieren und manuell übermitteln.',
      );
    }
    // Token mitladen (select:false) - der Link wird SERVERSEITIG gebaut, nie vom Client geliefert.
    const dealer = await this.dealerRepo
      .createQueryBuilder('d')
      .addSelect('d.uploadToken')
      .where('d.id = :id', { id })
      .getOne();
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    if (!dealer.uploadToken || dealer.status !== 'freigegeben' || !dealer.aktiv) {
      throw new BadRequestException('Der Händler ist nicht freigegeben oder hat keinen Portal-Link.');
    }
    const to = dealer.kontaktEmail?.trim();
    if (!to) throw new BadRequestException('Der Händler hat keine Kontakt-E-Mail hinterlegt.');

    const link = `${this.appBaseUrl()}/haendler?t=${dealer.uploadToken}`;
    const anrede = dealer.ansprechpartner?.trim()
      ? `Hallo ${dealer.ansprechpartner.trim()},`
      : `Hallo ${dealer.name},`;
    try {
      await this.mail.send({
        to,
        subject: 'Ihr Zugang zum Detailly-Marktplatz',
        text:
          `${anrede}\n\n` +
          `willkommen im Detailly-Marktplatz! Ihre Bewerbung wurde freigegeben.\n\n` +
          `Über Ihren persönlichen Portal-Link pflegen Sie Ihre Produkte und wickeln Bestellungen ab:\n` +
          `${link}\n\n` +
          `Bitte behandeln Sie den Link vertraulich - er ist Ihr Zugang (kein separates Passwort).\n\n` +
          `Mit freundlichen Grüßen\nIhr Detailly-Team`,
      });
    } catch (e) {
      this.logger.warn(`Portal-Link-Mail fehlgeschlagen: ${(e as Error).message}`);
      throw new BadRequestException(MailService.describeSmtpError(e));
    }
    return { ok: true, to };
  }

  // ---------------------------------------------------------------------------
  // Pflege (Plattform-Seite)
  // ---------------------------------------------------------------------------

  listDealers(): Promise<MarketplaceDealer[]> {
    return this.dealerRepo.find({ order: { name: 'ASC' } });
  }

  createDealer(dto: CreateDealerDto): Promise<MarketplaceDealer> {
    return this.dealerRepo.save(this.dealerRepo.create({ ...dto }));
  }

  async updateDealer(id: string, dto: UpdateDealerDto): Promise<MarketplaceDealer> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    Object.assign(dealer, dto);
    return this.dealerRepo.save(dealer);
  }

  listProducts(): Promise<MarketplaceProduct[]> {
    return this.productRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createProduct(dto: CreateProductDto): Promise<MarketplaceProduct> {
    const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
    if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    this.assertVertriebsweg(dto);
    return this.productRepo.save(this.productRepo.create({ ...dto }));
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    if (dto.dealerId && dto.dealerId !== product.dealerId) {
      const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
      if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    }
    Object.assign(product, dto);
    this.assertVertriebsweg(product);
    return this.productRepo.save(product);
  }

  /**
   * Portal-Token fuer einen Haendler (neu) ausstellen. Ueberschreibt einen
   * evtl. vorhandenen Token (Rotation bei Leck). Der Rohwert wird NUR hier
   * zurueckgegeben; gespeichert bleibt er Klartext (WHERE-Lookup, wie
   * calendarToken), aber select:false.
   */
  async issueUploadToken(dealerId: string): Promise<{ uploadToken: string; portalPfad: string }> {
    const dealer = await this.dealerRepo.findOne({ where: { id: dealerId } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    const token = crypto.randomBytes(24).toString('hex'); // 192 Bit, passt zum Format-Check
    await this.dealerRepo.update(dealer.id, { uploadToken: token });
    // Query-Param statt dynamischer Route: das Frontend ist ein statischer Export.
    return { uploadToken: token, portalPfad: `/haendler?t=${token}` };
  }

  /** Alle Bestellungen (optional nach Status), inkl. Positionen + Haendlername. */
  async listAllOrders(status?: MarketplaceOrderStatus) {
    const orders = await this.orderRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return this.anreichern(orders);
  }

  /** Admin-Statuswechsel ohne Uebergangs-Beschraenkung (Betreiber-Override). */
  async adminSetOrderStatus(id: string, status: MarketplaceOrderStatus) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    order.status = status;
    await this.orderRepo.save(order);
    return order;
  }

  /**
   * Margen-Report je Haendler: Bestellungen/Umsatz/Provision (stornierte
   * ausgenommen) + Klicks. DIE Sicht fuer den Betreiber (Finn), um je Haendler
   * nachzuvollziehen, wieviel Marge/Affiliate anfaellt.
   */
  async provisionReport() {
    const [orderAgg, klickAgg, dealers] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'bestellungen')
        .addSelect('SUM(o.summeBrutto)', 'umsatz')
        .addSelect('SUM(o.summeProvision)', 'provision')
        .where('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
        .groupBy('o.dealerId')
        .getRawMany<{ dealerId: string; bestellungen: string; umsatz: string; provision: string }>(),
      this.clickRepo
        .createQueryBuilder('k')
        .select('k.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'klicks')
        .groupBy('k.dealerId')
        .getRawMany<{ dealerId: string; klicks: string }>(),
      this.dealerRepo.find({ order: { name: 'ASC' } }),
    ]);
    const orderByDealer = new Map(orderAgg.map((r) => [r.dealerId, r]));
    const klicksByDealer = new Map(klickAgg.map((r) => [r.dealerId, Number(r.klicks)]));

    const zeilen = dealers.map((d) => {
      const o = orderByDealer.get(d.id);
      return {
        dealerId: d.id,
        name: d.name,
        aktiv: d.aktiv,
        provisionSatz: Number(d.provisionSatz),
        bestellungen: Number(o?.bestellungen ?? 0),
        umsatz: rund2(Number(o?.umsatz ?? 0)),
        provision: rund2(Number(o?.provision ?? 0)),
        klicks: klicksByDealer.get(d.id) ?? 0,
      };
    });
    return {
      zeilen,
      summe: {
        bestellungen: zeilen.reduce((s, z) => s + z.bestellungen, 0),
        umsatz: rund2(zeilen.reduce((s, z) => s + z.umsatz, 0)),
        provision: rund2(zeilen.reduce((s, z) => s + z.provision, 0)),
        klicks: zeilen.reduce((s, z) => s + z.klicks, 0),
      },
    };
  }

  /** Affiliate-Statistik: Gesamt/30 Tage + Top-Produkte/-Haendler. */
  async stats() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [gesamt, letzte30Tage, topProdukteRaw, topHaendlerRaw, dealers] = await Promise.all([
      this.clickRepo.count(),
      this.clickRepo.count({ where: { createdAt: MoreThanOrEqual(cutoff) } }),
      this.productRepo.find({ where: { aktiv: true }, order: { klicks: 'DESC' }, take: 5 }),
      this.clickRepo
        .createQueryBuilder('k')
        .select('k.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'klicks')
        .groupBy('k.dealerId')
        .orderBy('klicks', 'DESC')
        .limit(5)
        .getRawMany<{ dealerId: string; klicks: string }>(),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return {
      gesamt,
      letzte30Tage,
      topProdukte: topProdukteRaw.map((p) => ({
        name: p.name,
        haendler: nameById.get(p.dealerId) ?? '—',
        klicks: Number(p.klicks),
      })),
      topHaendler: topHaendlerRaw.map((r) => ({
        name: nameById.get(r.dealerId) ?? '—',
        klicks: Number(r.klicks),
      })),
    };
  }
}
