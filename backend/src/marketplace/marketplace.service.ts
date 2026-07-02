import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { istBildMitMagic } from '../orders/orders.service';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder, MarketplaceOrderStatus } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import {
  MarketplaceSettlement,
  MarketplaceSettlementStatus,
} from './entities/marketplace-settlement.entity';
import { Product } from '../shop/entities/product.entity';
import { StockMovement, MovementType } from '../shop/entities/stock-movement.entity';
import { MarketplaceReview } from './entities/marketplace-review.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { MailService } from '../mailer/mail.service';
import { betriebBestellMail, betriebStatusMail, haendlerBestellMail } from './marketplace-mails';
import {
  CreateDealerDto,
  UpdateDealerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateMarketplaceOrderDto,
  PortalProductDto,
  UpdatePortalProductDto,
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
    @InjectRepository(MarketplaceSettlement)
    private readonly settlementRepo: Repository<MarketplaceSettlement>,
    @InjectRepository(MarketplaceReview)
    private readonly reviewRepo: Repository<MarketplaceReview>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
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
      this.dealerRepo.find({ where: { aktiv: true }, order: { name: 'ASC' } }),
    ]);
    const dealerById = new Map(haendler.map((d) => [d.id, d]));
    const kategorien = [...new Set(produkte.map((p) => p.kategorie))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    );
    return {
      produkte: produkte
        // Produkte deaktivierter Haendler nicht anbieten.
        .filter((p) => dealerById.has(p.dealerId))
        .map((p) => ({
          ...p,
          haendlerName: dealerById.get(p.dealerId)!.name,
          // Effektive Lieferzeit: Produkt-Override, sonst Haendler-Standard.
          lieferzeitTage: p.lieferzeitTage ?? dealerById.get(p.dealerId)!.lieferzeitTage ?? null,
          // Hochgeladenes Bild hat Vorrang; Pfad relativ zur API (serverUrl im Frontend).
          bildPfad: p.bildDatei ? `/public/marketplace/produktbilder/${p.bildDatei}` : null,
        })),
      haendler: haendler.map((d) => ({ id: d.id, name: d.name, logoUrl: d.logoUrl, webseite: d.webseite })),
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
    const dealers = await this.dealerRepo.find({ where: { id: In(dealerIds), aktiv: true } });
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

    const orders = await this.dataSource.transaction(async (em) => {
      const orderRepo = em.getRepository(MarketplaceOrder);
      const itemRepo = em.getRepository(MarketplaceOrderItem);
      const jahr = new Date().getFullYear();
      // Plattformweiter Nummernkreis MP-<Jahr>-<lfd>. count-basiert wie
      // common/numbering.ts (UNIQUE-Index als harter Backstop bei Parallellauf).
      let lfd = await orderRepo.count();

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
    });

    // Haendler + Besteller benachrichtigen - fire-and-forget, Bestellung haengt
    // NIE an SMTP. Erfolg/Fehler der Haendler-Mail wird am Beleg festgehalten
    // (haendlerBenachrichtigtAm/benachrichtigungFehler) -> "Erneut senden".
    for (const order of orders) {
      const dealer = dealerById.get(order.dealerId)!;
      void this.uebermittleAnHaendler(order, dealer);
      void this.orderItemRepo
        .find({ where: { orderId: order.id } })
        .then((items) => this.mail.send(betriebBestellMail(order, items, dealer.name)))
        .catch((err) =>
          this.logger.warn(`Eingangsbestaetigung ${order.nummer} fehlgeschlagen: ${err?.message ?? err}`),
        );
    }

    return this.ordersMitPositionen(orders.map((o) => o.id));
  }

  /**
   * Bestell-Mail an den Haendler senden und das Ergebnis am Beleg festhalten.
   * Kein Throw: Aufrufer (Bestellung/Erneut-senden) entscheiden ueber void/await.
   */
  private async uebermittleAnHaendler(order: MarketplaceOrder, dealer: MarketplaceDealer) {
    if (!dealer.kontaktEmail) {
      await this.orderRepo.update(order.id, {
        benachrichtigungFehler: 'Haendler hat keine Kontakt-E-Mail hinterlegt.',
      });
      return;
    }
    try {
      const items = await this.orderItemRepo.find({ where: { orderId: order.id } });
      await this.mail.send(haendlerBestellMail(dealer, order, items));
      await this.orderRepo.update(order.id, {
        haendlerBenachrichtigtAm: new Date(),
        benachrichtigungFehler: null as unknown as string,
      });
    } catch (err) {
      const grund = String((err as Error)?.message ?? err).slice(0, 500);
      this.logger.warn(`Bestell-Mail ${order.nummer} an Haendler fehlgeschlagen: ${grund}`);
      await this.orderRepo.update(order.id, { benachrichtigungFehler: grund });
    }
  }

  /**
   * Bestell-Mail an den Haendler ERNEUT senden (Betreiber-Aktion nach
   * Zustellfehler oder nachgetragener Kontakt-E-Mail). Wartet auf das
   * Ergebnis, damit das UI direkt Erfolg/Fehler zeigt.
   */
  async resendHaendlerBenachrichtigung(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    const dealer = await this.dealerRepo.findOne({ where: { id: order.dealerId } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    await this.uebermittleAnHaendler(order, dealer);
    return this.orderRepo.findOne({ where: { id: orderId } });
  }

  /**
   * Statuswechsel-Zeitstempel + Tracking uebernehmen und den Betrieb per Mail
   * informieren (fire-and-forget). Gemeinsamer Pfad fuer Portal und Admin.
   */
  private async wendeStatusAn(
    order: MarketplaceOrder,
    status: MarketplaceOrderStatus,
    tracking?: { trackingNummer?: string; trackingUrl?: string },
  ) {
    order.status = status;
    if (status === MarketplaceOrderStatus.BESTAETIGT) order.bestaetigtAm = new Date();
    if (status === MarketplaceOrderStatus.VERSENDET) order.versendetAm = new Date();
    if (status === MarketplaceOrderStatus.STORNIERT) order.storniertAm = new Date();
    if (tracking?.trackingNummer?.trim()) order.trackingNummer = tracking.trackingNummer.trim();
    if (tracking?.trackingUrl?.trim()) order.trackingUrl = tracking.trackingUrl.trim();
    await this.orderRepo.save(order);

    const dealer = await this.dealerRepo.findOne({ where: { id: order.dealerId }, select: ['id', 'name'] });
    void this.mail
      .send(betriebStatusMail(order, dealer?.name ?? '—'))
      .catch((err) =>
        this.logger.warn(`Status-Mail ${order.nummer} fehlgeschlagen: ${err?.message ?? err}`),
      );
    return order;
  }

  /**
   * VERSENDETE Bestellung ins MANDANTEN-Lager buchen (Haendler fuehren KEIN
   * Lager in Detailly): je gewaehlter Position ZUGANG-Movement + Bestand
   * erhoehen - auf ein vorhandenes Shop-Produkt oder ein neu angelegtes
   * (Einkaufspreis = Bestellpreis-Snapshot). `eingelagertAm` verhindert
   * Doppelbuchung. Alles in EINER Transaktion.
   */
  async einlagern(
    user: AuthUser,
    orderId: string,
    dto: { positionen: { itemId: string; productId?: string }[] },
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId, tenantId: user.tenantId } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    if (order.status !== MarketplaceOrderStatus.VERSENDET) {
      throw new BadRequestException('Nur versendete Bestellungen koennen eingelagert werden.');
    }
    if (order.eingelagertAm) {
      throw new BadRequestException('Diese Bestellung wurde bereits eingelagert.');
    }
    const items = await this.orderItemRepo.find({ where: { orderId: order.id } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    // Doppelte itemIds im Request zusammenfassen -> keine Mehrfachbuchung.
    const gewaehlt = new Map(dto.positionen.map((p) => [p.itemId, p]));
    for (const p of gewaehlt.values()) {
      if (!itemById.has(p.itemId)) {
        throw new BadRequestException('Mindestens eine Position gehoert nicht zu dieser Bestellung.');
      }
    }

    await this.dataSource.transaction(async (em) => {
      for (const p of gewaehlt.values()) {
        const item = itemById.get(p.itemId)!;
        let product: Product | null = null;
        if (p.productId) {
          // Mandantentrennung: Ziel-Produkt muss zum eigenen Betrieb gehoeren.
          product = await em.findOne(Product, {
            where: { id: p.productId, tenantId: user.tenantId },
          });
          if (!product) throw new BadRequestException('Ziel-Produkt nicht gefunden.');
        } else {
          product = await em.save(
            em.create(Product, {
              tenantId: user.tenantId,
              name: item.produktName,
              kategorie: 'Marktplatz',
              einkaufspreis: Number(item.einzelpreis),
              bestand: 0,
            }),
          );
        }
        await em.increment(
          Product,
          { id: product.id, tenantId: user.tenantId },
          'bestand',
          Number(item.menge),
        );
        await em.save(
          em.create(StockMovement, {
            tenantId: user.tenantId,
            productId: product.id,
            typ: MovementType.ZUGANG,
            menge: Number(item.menge),
            grund: `Marktplatz ${order.nummer}`,
            userId: user.id,
          }),
        );
      }
      order.eingelagertAm = new Date();
      await em.save(order);
    });
    return order;
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
    const dealer = await this.dealerRepo.findOne({ where: { uploadToken: clean, aktiv: true } });
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
  async portalSetOrderStatus(
    token: string,
    orderId: string,
    status: MarketplaceOrderStatus,
    tracking?: { trackingNummer?: string; trackingUrl?: string },
  ) {
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
    return this.wendeStatusAn(order, status, tracking);
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
  async adminSetOrderStatus(
    id: string,
    status: MarketplaceOrderStatus,
    tracking?: { trackingNummer?: string; trackingUrl?: string },
  ) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    return this.wendeStatusAn(order, status, tracking);
  }

  /**
   * Margen-Report je Haendler: Bestellungen/Umsatz/Provision (stornierte
   * ausgenommen) + Klicks. DIE Sicht fuer den Betreiber (Finn), um je Haendler
   * nachzuvollziehen, wieviel Marge/Affiliate anfaellt.
   */
  async provisionReport(von?: string, bis?: string) {
    const { start, ende } = this.zeitraum(von, bis);
    const orderQb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.dealerId', 'dealerId')
      .addSelect('COUNT(*)', 'bestellungen')
      .addSelect('SUM(o.summeBrutto)', 'umsatz')
      .addSelect('SUM(o.summeProvision)', 'provision')
      .where('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
      .groupBy('o.dealerId');
    const klickQb = this.clickRepo
      .createQueryBuilder('k')
      .select('k.dealerId', 'dealerId')
      .addSelect('COUNT(*)', 'klicks')
      .groupBy('k.dealerId');
    if (start) {
      orderQb.andWhere('o.createdAt >= :start', { start });
      klickQb.andWhere('k.createdAt >= :start', { start });
    }
    if (ende) {
      orderQb.andWhere('o.createdAt <= :ende', { ende });
      klickQb.andWhere('k.createdAt <= :ende', { ende });
    }
    const [orderAgg, klickAgg, dealers] = await Promise.all([
      orderQb.getRawMany<{ dealerId: string; bestellungen: string; umsatz: string; provision: string }>(),
      klickQb.getRawMany<{ dealerId: string; klicks: string }>(),
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

  /** YYYY-MM-DD-Grenzen in inklusive Date-Grenzen (lokal, Tagesanfang/-ende) uebersetzen. */
  private zeitraum(von?: string, bis?: string): { start?: Date; ende?: Date } {
    const start = von ? new Date(`${von}T00:00:00.000`) : undefined;
    const ende = bis ? new Date(`${bis}T23:59:59.999`) : undefined;
    if ((start && isNaN(start.getTime())) || (ende && isNaN(ende.getTime()))) {
      throw new BadRequestException('Ungueltiger Zeitraum (erwartet YYYY-MM-DD).');
    }
    if (start && ende && start > ende) {
      throw new BadRequestException('Zeitraum-Beginn liegt nach dem Ende.');
    }
    return { start, ende };
  }

  // ---------------------------------------------------------------------------
  // Provisions-Export + Abrechnungen (Betreiber)
  // ---------------------------------------------------------------------------

  /** Deutsches Zahlenformat fuer CSV (Komma-Dezimal, 2 Stellen). */
  private static csvZahl(n: number): string {
    return Number(n).toFixed(2).replace('.', ',');
  }

  /** Semikolon-CSV mit UTF-8-BOM + CRLF (Excel-tauglich, wie Buchhaltungs-Export). */
  private static csvDatei(zeilen: string[][]): Buffer {
    const text = '﻿' + zeilen.map((z) => z.join(';')).join('\r\n') + '\r\n';
    return Buffer.from(text, 'utf-8');
  }

  /**
   * Provisions-Export als CSV: eine Zeile je (nicht stornierter) Bestellung im
   * Zeitraum, gruppiert nach Haendler mit Zwischensummen + Gesamtsumme.
   */
  async provisionExport(von?: string, bis?: string): Promise<{ buffer: Buffer; filename: string }> {
    const { start, ende } = this.zeitraum(von, bis);
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
      .orderBy('o.createdAt', 'ASC');
    if (start) qb.andWhere('o.createdAt >= :start', { start });
    if (ende) qb.andWhere('o.createdAt <= :ende', { ende });
    const [orders, dealers, settlements] = await Promise.all([
      qb.getMany(),
      this.dealerRepo.find({ select: ['id', 'name'] }),
      this.settlementRepo.find({ select: ['id', 'nummer'] }),
    ]);
    const dealerName = new Map(dealers.map((d) => [d.id, d.name]));
    const abrechnungNummer = new Map(settlements.map((s) => [s.id, s.nummer]));

    const zeilen: string[][] = [
      ['Haendler', 'Bestellnummer', 'Datum', 'Status', 'Umsatz (EUR)', 'Provision (EUR)', 'Abrechnung'],
    ];
    const z = MarketplaceService.csvZahl;
    // Nach Haendler gruppieren (sortiert nach Name), je Gruppe Zwischensumme.
    const dealerIds = [...new Set(orders.map((o) => o.dealerId))].sort((a, b) =>
      (dealerName.get(a) ?? '').localeCompare(dealerName.get(b) ?? '', 'de'),
    );
    let gesamtUmsatz = 0;
    let gesamtProvision = 0;
    for (const dealerId of dealerIds) {
      const gruppe = orders.filter((o) => o.dealerId === dealerId);
      let umsatz = 0;
      let provision = 0;
      for (const o of gruppe) {
        umsatz = rund2(umsatz + Number(o.summeBrutto));
        provision = rund2(provision + Number(o.summeProvision));
        zeilen.push([
          dealerName.get(dealerId) ?? '—',
          o.nummer,
          new Date(o.createdAt).toLocaleDateString('de-DE'),
          o.status,
          z(Number(o.summeBrutto)),
          z(Number(o.summeProvision)),
          o.abrechnungId ? (abrechnungNummer.get(o.abrechnungId) ?? '') : '',
        ]);
      }
      zeilen.push([`Summe ${dealerName.get(dealerId) ?? '—'}`, '', '', '', z(umsatz), z(provision), '']);
      gesamtUmsatz = rund2(gesamtUmsatz + umsatz);
      gesamtProvision = rund2(gesamtProvision + provision);
    }
    zeilen.push(['Gesamtsumme', '', '', '', z(gesamtUmsatz), z(gesamtProvision), '']);

    const spanne = [von ?? 'Beginn', bis ?? 'heute'].join('_');
    return {
      buffer: MarketplaceService.csvDatei(zeilen),
      filename: `Marktplatz-Provisionen_${spanne}.csv`,
    };
  }

  /**
   * Provisionsabrechnung fuer einen Haendler erstellen: erfasst alle
   * VERSENDETEN, noch nicht abgerechneten Bestellungen im Zeitraum und
   * markiert sie mit der Abrechnung (abrechnungId) -> keine Doppelabrechnung.
   */
  async createSettlement(dto: { dealerId: string; von: string; bis: string }) {
    const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    const { start, ende } = this.zeitraum(dto.von, dto.bis);

    const settlement = await this.dataSource.transaction(async (em) => {
      const orderRepo = em.getRepository(MarketplaceOrder);
      const settlementRepo = em.getRepository(MarketplaceSettlement);

      const qb = orderRepo
        .createQueryBuilder('o')
        .where('o.dealerId = :dealerId', { dealerId: dealer.id })
        .andWhere('o.status = :versendet', { versendet: MarketplaceOrderStatus.VERSENDET })
        .andWhere('o.abrechnungId IS NULL')
        .andWhere('o.createdAt >= :start', { start })
        .andWhere('o.createdAt <= :ende', { ende });
      const offen = await qb.getMany();
      if (offen.length === 0) {
        throw new BadRequestException(
          'Keine abrechenbaren Bestellungen im Zeitraum (nur VERSENDETE, noch nicht abgerechnete zaehlen).',
        );
      }

      const summeUmsatz = rund2(offen.reduce((s, o) => s + Number(o.summeBrutto), 0));
      const summeProvision = rund2(offen.reduce((s, o) => s + Number(o.summeProvision), 0));
      // Nummernkreis MA-<Jahr>-<lfd>, count-basiert wie Bestellungen (UNIQUE-Backstop).
      const lfd = (await settlementRepo.count()) + 1;
      const gespeichert = await settlementRepo.save(
        settlementRepo.create({
          nummer: `MA-${new Date().getFullYear()}-${String(lfd).padStart(4, '0')}`,
          dealerId: dealer.id,
          zeitraumVon: start!,
          zeitraumBis: ende!,
          bestellungen: offen.length,
          summeUmsatz,
          summeProvision,
          status: MarketplaceSettlementStatus.OFFEN,
        }),
      );
      await orderRepo.update(
        { id: In(offen.map((o) => o.id)) },
        { abrechnungId: gespeichert.id },
      );
      return gespeichert;
    });

    return { ...settlement, haendlerName: dealer.name };
  }

  /** Alle Abrechnungen (neueste zuerst), inkl. Haendlername. */
  async listSettlements() {
    const [settlements, dealers] = await Promise.all([
      this.settlementRepo.find({ order: { createdAt: 'DESC' }, take: 500 }),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return settlements.map((s) => ({ ...s, haendlerName: nameById.get(s.dealerId) ?? '—' }));
  }

  /** Abrechnungsstatus vorwaerts schalten: offen -> gestellt -> bezahlt. */
  async setSettlementStatus(id: string, status: MarketplaceSettlementStatus) {
    const settlement = await this.settlementRepo.findOne({ where: { id } });
    if (!settlement) throw new NotFoundException('Abrechnung nicht gefunden');
    const erlaubt: Record<MarketplaceSettlementStatus, MarketplaceSettlementStatus[]> = {
      [MarketplaceSettlementStatus.OFFEN]: [
        MarketplaceSettlementStatus.GESTELLT,
        MarketplaceSettlementStatus.BEZAHLT,
      ],
      [MarketplaceSettlementStatus.GESTELLT]: [MarketplaceSettlementStatus.BEZAHLT],
      [MarketplaceSettlementStatus.BEZAHLT]: [],
    };
    if (!erlaubt[settlement.status].includes(status)) {
      throw new BadRequestException(
        `Statuswechsel ${settlement.status} -> ${status} ist nicht erlaubt.`,
      );
    }
    settlement.status = status;
    return this.settlementRepo.save(settlement);
  }

  /** Einzelabrechnung als CSV (Kopfdaten + eine Zeile je erfasster Bestellung). */
  async settlementExport(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const settlement = await this.settlementRepo.findOne({ where: { id } });
    if (!settlement) throw new NotFoundException('Abrechnung nicht gefunden');
    const [dealer, orders] = await Promise.all([
      this.dealerRepo.findOne({ where: { id: settlement.dealerId }, select: ['id', 'name'] }),
      this.orderRepo.find({ where: { abrechnungId: id }, order: { createdAt: 'ASC' } }),
    ]);
    const z = MarketplaceService.csvZahl;
    const zeilen: string[][] = [
      ['Abrechnung', settlement.nummer],
      ['Haendler', dealer?.name ?? '—'],
      [
        'Zeitraum',
        `${new Date(settlement.zeitraumVon).toLocaleDateString('de-DE')} - ${new Date(settlement.zeitraumBis).toLocaleDateString('de-DE')}`,
      ],
      ['Status', settlement.status],
      [],
      ['Bestellnummer', 'Datum', 'Umsatz (EUR)', 'Provision (EUR)'],
      ...orders.map((o) => [
        o.nummer,
        new Date(o.createdAt).toLocaleDateString('de-DE'),
        z(Number(o.summeBrutto)),
        z(Number(o.summeProvision)),
      ]),
      ['Summe', '', z(Number(settlement.summeUmsatz)), z(Number(settlement.summeProvision))],
    ];
    return {
      buffer: MarketplaceService.csvDatei(zeilen),
      filename: `${settlement.nummer}.csv`,
    };
  }

  // ---------------------------------------------------------------------------
  // Produktbilder (Upload als Data-URL, Auslieferung oeffentlich)
  // ---------------------------------------------------------------------------

  /** Ablage ausserhalb des statischen Mounts; Auslieferung NUR ueber den Controller. */
  private static readonly BILD_DIR = join(process.cwd(), 'private-uploads', 'marketplace');

  /**
   * Produktbild speichern (Validierung wie Auftragsfotos: Data-URL-Format,
   * 5-MB-Deckel, Magic-Byte-Check gegen Sniff-XSS). Zufaelliger Dateiname;
   * altes Bild wird best-effort geloescht.
   */
  private async speichereProduktbild(
    product: MarketplaceProduct,
    dataUrl: string,
  ): Promise<MarketplaceProduct> {
    const match = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(dataUrl);
    if (!match) throw new BadRequestException('Ungueltiges Bildformat (nur Data-URLs erlaubt).');
    const endung = match[2] === 'jpeg' ? 'jpg' : match[2];
    const inhalt = Buffer.from(match[3], 'base64');
    if (inhalt.byteLength > 5 * 1024 * 1024) {
      throw new BadRequestException('Bild zu gross (max. 5 MB).');
    }
    if (!istBildMitMagic(inhalt, endung)) {
      throw new BadRequestException('Datei ist kein gueltiges Bild (Inhalt passt nicht zum Format).');
    }
    await fs.mkdir(MarketplaceService.BILD_DIR, { recursive: true });
    const dateiname = `${crypto.randomUUID()}.${endung}`;
    await fs.writeFile(join(MarketplaceService.BILD_DIR, dateiname), inhalt);
    if (product.bildDatei) {
      void fs.unlink(join(MarketplaceService.BILD_DIR, product.bildDatei)).catch(() => undefined);
    }
    product.bildDatei = dateiname;
    return this.productRepo.save(product);
  }

  /** Haendler laedt ein Bild fuer ein EIGENES Produkt hoch (fremde -> 404). */
  async portalUploadProduktbild(token: string, productId: string, dataUrl: string) {
    const dealer = await this.dealerByToken(token);
    const product = await this.productRepo.findOne({
      where: { id: productId, dealerId: dealer.id },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    return this.speichereProduktbild(product, dataUrl);
  }

  /** Plattform-Team laedt ein Bild fuer ein beliebiges Produkt hoch. */
  async adminUploadProduktbild(productId: string, dataUrl: string) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    return this.speichereProduktbild(product, dataUrl);
  }

  /**
   * Pfad + Content-Type fuer die oeffentliche Bild-Auslieferung. Dateiname
   * strikt validiert (UUID.endung) -> kein Path-Traversal; Katalogbilder sind
   * bewusst unauthentifiziert (nicht sensibel, Portal hat kein Login).
   */
  async produktbildDatei(datei: string): Promise<{ pfad: string; contentType: string }> {
    const match = /^([a-f0-9-]{36})\.(png|jpg|webp|gif)$/.exec((datei ?? '').toLowerCase());
    if (!match) throw new NotFoundException('Bild nicht gefunden');
    const pfad = join(MarketplaceService.BILD_DIR, match[0]);
    try {
      await fs.access(pfad);
    } catch {
      throw new NotFoundException('Bild nicht gefunden');
    }
    const typ = match[2] === 'jpg' ? 'jpeg' : match[2];
    return { pfad, contentType: `image/${typ}` };
  }

  // ---------------------------------------------------------------------------
  // Bewertungen (Kaufnachweis, denormalisierte Aggregate am Produkt)
  // ---------------------------------------------------------------------------

  /**
   * Bewertung abgeben/aktualisieren. Nur mit Kaufnachweis: der Tenant muss
   * eine nicht-stornierte Bestellung mit diesem Produkt haben. Eine Bewertung
   * je Produkt+Tenant (unique) - erneut bewerten ueberschreibt.
   */
  async bewerten(user: AuthUser, productId: string, dto: { sterne: number; kommentar?: string }) {
    const product = await this.productRepo.findOne({ where: { id: productId, aktiv: true } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');

    const gekauft = await this.orderItemRepo
      .createQueryBuilder('i')
      .innerJoin(MarketplaceOrder, 'o', 'o.id = i.orderId')
      .where('i.productId = :productId', { productId })
      .andWhere('o.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
      .getExists();
    if (!gekauft) {
      throw new ForbiddenException('Bewertungen sind nur nach einem Kauf dieses Produkts moeglich.');
    }

    let review = await this.reviewRepo.findOne({
      where: { productId, tenantId: user.tenantId },
    });
    if (review) {
      review.sterne = dto.sterne;
      review.kommentar = dto.kommentar?.trim() || (null as unknown as string);
      review.userId = user.id;
    } else {
      review = this.reviewRepo.create({
        productId,
        tenantId: user.tenantId,
        userId: user.id,
        sterne: dto.sterne,
        kommentar: dto.kommentar?.trim() || null,
      });
    }
    const saved = await this.reviewRepo.save(review);
    await this.aktualisiereBewertungsAggregate(productId);
    return saved;
  }

  /** Oeffentliche (anonymisierte) Bewertungsliste eines Produkts. */
  async reviews(productId: string) {
    const list = await this.reviewRepo.find({
      where: { productId },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
    // Bewusst ohne tenantId/userId: Betriebe sehen nicht, WER bewertet hat.
    return list.map((r) => ({
      id: r.id,
      sterne: r.sterne,
      kommentar: r.kommentar,
      createdAt: r.createdAt,
    }));
  }

  /** Moderation: Bewertung entfernen (Plattform-Team), Aggregate neu rechnen. */
  async adminDeleteReview(id: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Bewertung nicht gefunden');
    await this.reviewRepo.remove(review);
    await this.aktualisiereBewertungsAggregate(review.productId);
    return { success: true };
  }

  /** Denormalisierte Aggregate (Schnitt/Anzahl) am Produkt neu berechnen. */
  private async aktualisiereBewertungsAggregate(productId: string) {
    const agg = await this.reviewRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'anzahl')
      .addSelect('AVG(r.sterne)', 'schnitt')
      .where('r.productId = :productId', { productId })
      .getRawOne<{ anzahl: string; schnitt: string | null }>();
    await this.productRepo.update(
      { id: productId },
      {
        bewertungAnzahl: Number(agg?.anzahl ?? 0),
        bewertungSchnitt: rund2(Number(agg?.schnitt ?? 0)),
      },
    );
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
