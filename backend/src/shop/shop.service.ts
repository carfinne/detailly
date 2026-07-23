import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, Not, LessThan, MoreThan } from 'typeorm';
import { Product } from './entities/product.entity';
import { StockMovement, MovementType } from './entities/stock-movement.entity';
import { PurchaseOrder, PurchaseOrderStatus } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Rental, RentalStatus } from './entities/rental.entity';
import { Customer } from '../customers/entities/customer.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  StockMovementDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  CreateRentalDto,
  PurchaseOrderItemDto,
} from './dto/shop.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';
import { clampPageQuery, PaginatedResult } from '../common/util/pagination';
import { withUniqueRetry } from '../common/unique-retry';
import { FOLIEN_VORLAGEN } from './folien-vorlagen';

// Obergrenzen des ABWAERTSKOMPATIBLEN Array-Pfads (ohne page/limit). Ersetzen die
// frueheren `take`-Sicherheitsventile; mit page/limit ist die Liste vollstaendig
// durchblaetterbar (behebt den stillen Datenverlust bei grossem Lager, AP-P1).
const MAX_ARRAY_PRODUCTS = 1000;
const MAX_ARRAY_MOVEMENTS = 100;
const MAX_ARRAY_PURCHASE_ORDERS = 500;

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockMovement) private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(PurchaseOrder) private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem) private readonly poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(Rental) private readonly rentalRepo: Repository<Rental>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Lager: atomare Bestandsbuchung (tenant-scoped) ----------

  /**
   * Atomarer Lagerzugang: `bestand = bestand + menge` direkt in der DB (kein
   * Read-Modify-Write in JS -> kein Lost Update). Immer tenant-scoped.
   */
  private async addStock(
    m: EntityManager,
    tenantId: string,
    productId: string,
    menge: number,
  ): Promise<void> {
    await m
      .createQueryBuilder()
      .update(Product)
      .set({ bestand: () => 'bestand + :menge' })
      .where('id = :id AND tenantId = :tenantId', { id: productId, tenantId })
      .setParameter('menge', menge)
      .execute();
  }

  /**
   * Atomarer Lagerabgang, fail-closed: `bestand = bestand - menge` NUR wenn
   * `bestand >= menge` (konditionales UPDATE). Liefert false bei affected=0
   * (nicht genug Bestand) -> kein Negativbestand. Immer tenant-scoped.
   */
  private async subtractStock(
    m: EntityManager,
    tenantId: string,
    productId: string,
    menge: number,
  ): Promise<boolean> {
    const res = await m
      .createQueryBuilder()
      .update(Product)
      .set({ bestand: () => 'bestand - :menge' })
      .where('id = :id AND tenantId = :tenantId AND bestand >= :menge', { id: productId, tenantId })
      .setParameter('menge', menge)
      .execute();
    return (res.affected ?? 0) > 0;
  }

  // ---------- Produkte / Lager ----------

  /** Interner Array-Pfad: bis MAX_ARRAY_PRODUCTS Produkte (Dropdowns/lowStock). */
  private productsArray(
    tenantId: string,
    includeInactive: boolean,
    kategorie?: string,
  ): Promise<Product[]> {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.aktiv = true;
    if (kategorie) where.kategorie = kategorie;
    return this.productRepo.find({ where, order: { name: 'ASC' }, take: MAX_ARRAY_PRODUCTS });
  }

  /**
   * Produkte/Lager auflisten. ABWAERTSKOMPATIBEL: ohne page/limit das bisherige
   * Array (auch Dropdown-Quelle: Materialkarte am Auftrag); MIT page/limit eine
   * paginierte Antwort {data,total,page,limit}. Immer tenant-scoped. Optional auf
   * eine Kategorie gefiltert (z. B. 'folie' fuer die Folien-Bibliothek).
   */
  findProducts(
    tenantId: string,
    query: { includeInactive?: boolean; page?: number; limit?: number; kategorie?: string } = {},
  ): Promise<Product[] | PaginatedResult<Product>> {
    if (query.page == null && query.limit == null) {
      return this.productsArray(tenantId, query.includeInactive ?? false, query.kategorie);
    }
    const where: Record<string, unknown> = { tenantId };
    if (!query.includeInactive) where.aktiv = true;
    if (query.kategorie) where.kategorie = query.kategorie;
    const { page, limit, skip, take } = clampPageQuery(query);
    return this.productRepo
      .findAndCount({ where, order: { name: 'ASC' }, skip, take })
      .then(([data, total]) => ({ data, total, page, limit }));
  }

  async findProduct(tenantId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    return product;
  }

  createProduct(user: AuthUser, dto: CreateProductDto): Promise<Product> {
    return this.productRepo.save(this.productRepo.create({ ...dto, tenantId: user.tenantId }));
  }

  async updateProduct(user: AuthUser, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProduct(user.tenantId, id);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async removeProduct(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const product = await this.findProduct(user.tenantId, id);
    product.aktiv = false;
    await this.productRepo.save(product);
    return { success: true };
  }

  async lowStock(tenantId: string): Promise<Product[]> {
    const products = await this.productsArray(tenantId, false);
    return products.filter((p) => Number(p.bestand) <= Number(p.mindestbestand));
  }

  /** Idempotenz-Schluessel einer Folienvorlage: (hersteller, serie, finish, breiteCm). */
  private folienKey(p: {
    hersteller?: string;
    serie?: string;
    finish?: string;
    breiteCm?: number | string;
  }): string {
    return [p.hersteller ?? '', p.serie ?? '', p.finish ?? '', Number(p.breiteCm ?? 0)].join('|');
  }

  /**
   * Importiert den kuratierten Folien-Vorlagenkatalog als Produkte des Betriebs
   * (kategorie 'folie', bestand 0, EK/VK bleiben beim Default 0 -> pflegt der
   * Betrieb). Idempotent: existiert bereits ein Produkt gleicher
   * (hersteller, serie, finish, breiteCm) im Tenant, wird die Vorlage
   * uebersprungen. Immer tenant-scoped.
   */
  async importFolienVorlagen(user: AuthUser): Promise<{ angelegt: number; uebersprungen: number }> {
    const tenantId = user.tenantId;
    // Bestehende Folien-Produkte des Tenants als Schluesselmenge laden (tenant-scoped).
    const vorhanden = await this.productRepo.find({
      where: { tenantId, kategorie: 'folie' },
      select: ['hersteller', 'serie', 'finish', 'breiteCm'],
    });
    const bekannt = new Set(vorhanden.map((p) => this.folienKey(p)));

    const toCreate: Product[] = [];
    let uebersprungen = 0;
    for (const vorlage of FOLIEN_VORLAGEN) {
      for (const finish of vorlage.finishes) {
        const key = this.folienKey({
          hersteller: vorlage.hersteller,
          serie: vorlage.serie,
          finish,
          breiteCm: vorlage.breiteCm,
        });
        if (bekannt.has(key)) {
          uebersprungen++;
          continue;
        }
        bekannt.add(key); // schuetzt zusaetzlich gegen Duplikate innerhalb des Katalogs
        toCreate.push(
          this.productRepo.create({
            tenantId,
            name: `${vorlage.hersteller} ${vorlage.serie} ${finish} (${vorlage.breiteCm} cm)`,
            kategorie: 'folie',
            hersteller: vorlage.hersteller,
            serie: vorlage.serie,
            finish,
            breiteCm: vorlage.breiteCm,
            einheit: vorlage.einheit,
            bestand: 0,
          }),
        );
      }
    }
    if (toCreate.length) await this.productRepo.save(toCreate);
    return { angelegt: toCreate.length, uebersprungen };
  }

  async recordMovement(user: AuthUser, productId: string, dto: StockMovementDto) {
    // H1: Bestandsbuchung + Bewegungsbeleg in EINER Transaktion; der Bestand wird
    // atomar in der DB veraendert (nicht in JS gerechnet) -> parallele Buchungen
    // gehen nicht mehr verloren (kein Lost Update). Bestand & Historie bleiben konsistent.
    return this.dataSource.transaction(async (m) => {
      // Existenz + Tenant-Zugehoerigkeit pruefen (findProduct-Semantik in der Tx).
      const product = await m.findOne(Product, { where: { id: productId, tenantId: user.tenantId } });
      if (!product) throw new NotFoundException('Produkt nicht gefunden');

      const menge = Number(dto.menge);
      if (dto.typ === MovementType.INVENTUR) {
        // Inventur setzt den absoluten Bestand (kein additives Delta).
        await m.update(Product, { id: productId, tenantId: user.tenantId }, { bestand: menge });
      } else if (dto.typ === MovementType.ZUGANG) {
        await this.addStock(m, user.tenantId, productId, menge);
      } else {
        // ABGANG fail-closed: bucht nur, wenn genug Bestand da ist.
        const ok = await this.subtractStock(m, user.tenantId, productId, menge);
        if (!ok) {
          throw new BadRequestException('Nicht genuegend Bestand fuer diese Abgangsbuchung.');
        }
      }

      const movement = await m.save(
        m.create(StockMovement, {
          tenantId: user.tenantId,
          productId,
          typ: dto.typ,
          menge: dto.menge,
          grund: dto.grund,
          userId: user.id,
        }),
      );
      // Aktuellen Bestand nach der atomaren Buchung nachladen (fuer die Antwort).
      const updated = await m.findOne(Product, { where: { id: productId, tenantId: user.tenantId } });
      return { product: updated, movement };
    });
  }

  /**
   * Lagerbewegungen auflisten. ABWAERTSKOMPATIBEL: ohne page/limit das bisherige
   * Array (gedeckelt), MIT page/limit vollstaendig durchblaetterbar. Tenant-scoped,
   * optional auf ein Produkt gefiltert.
   */
  findMovements(
    tenantId: string,
    query: { productId?: string; page?: number; limit?: number } = {},
  ): Promise<StockMovement[] | PaginatedResult<StockMovement>> {
    const where: Record<string, unknown> = { tenantId };
    if (query.productId) where.productId = query.productId;
    if (query.page == null && query.limit == null) {
      return this.movementRepo.find({ where, order: { createdAt: 'DESC' }, take: MAX_ARRAY_MOVEMENTS });
    }
    const { page, limit, skip, take } = clampPageQuery(query);
    return this.movementRepo
      .findAndCount({ where, order: { createdAt: 'DESC' }, skip, take })
      .then(([data, total]) => ({ data, total, page, limit }));
  }

  // ---------- Bestellungen / Freigaben ----------

  private async buildPoItems(user: AuthUser, dtoItems: PurchaseOrderItemDto[]): Promise<PurchaseOrderItem[]> {
    const items: PurchaseOrderItem[] = [];
    for (const i of dtoItems) {
      // Mandantentrennung: verknuepfte Produkt-ID muss zum eigenen Betrieb gehoeren
      // (sonst Cross-Tenant-Reference-Injection ueber Bestellpositionen).
      await assertRefInTenant(this.productRepo, user, i.productId, 'Produkt');
      items.push(
        this.poItemRepo.create({
          productId: i.productId,
          beschreibung: i.beschreibung,
          menge: i.menge,
          einzelpreis: i.einzelpreis,
          gesamtpreis: Number(i.menge) * Number(i.einzelpreis),
        }),
      );
    }
    return items;
  }

  private poSumme(items: PurchaseOrderItem[]): number {
    return items.reduce((sum, i) => sum + Number(i.gesamtpreis), 0);
  }

  /**
   * Bestellungen auflisten (inkl. items-Relation). ABWAERTSKOMPATIBEL: ohne
   * page/limit das bisherige Array (gedeckelt), MIT page/limit vollstaendig
   * durchblaetterbar. Tenant-scoped, optional nach Status gefiltert.
   */
  findPurchaseOrders(
    tenantId: string,
    query: { status?: PurchaseOrderStatus; page?: number; limit?: number } = {},
  ): Promise<PurchaseOrder[] | PaginatedResult<PurchaseOrder>> {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.page == null && query.limit == null) {
      return this.poRepo.find({
        where,
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: MAX_ARRAY_PURCHASE_ORDERS,
      });
    }
    const { page, limit, skip, take } = clampPageQuery(query);
    return this.poRepo
      .findAndCount({ where, relations: ['items'], order: { createdAt: 'DESC' }, skip, take })
      .then(([data, total]) => ({ data, total, page, limit }));
  }

  async findPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!po) throw new NotFoundException('Bestellung nicht gefunden');
    return po;
  }

  async createPurchaseOrder(user: AuthUser, dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const items = await this.buildPoItems(user, dto.items);
    const po = this.poRepo.create({
      tenantId: user.tenantId,
      // nummer wird unten in der Retry-Schleife gezogen (C1).
      nummer: '',
      lieferant: dto.lieferant,
      notiz: dto.notiz,
      erstelltVon: user.id,
      status: PurchaseOrderStatus.ENTWURF,
      summe: this.poSumme(items),
      items,
    });
    // C1: Nummernvergabe serialisieren. Die BE-Nummer wird INNERHALB der Retry-
    // Schleife gezogen; kollidiert der Unique-Index (tenantId, nummer), wird nach
    // dem Commit der Konkurrenz neu gezaehlt und erneut gespeichert.
    const saved = await withUniqueRetry(async () => {
      po.nummer = await nextSequentialNumber(this.poRepo, user.tenantId, 'BE');
      return this.poRepo.save(po);
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'PurchaseOrder',
      entityId: saved.id,
      payload: { nummer: saved.nummer, summe: saved.summe },
    });
    return this.findPurchaseOrder(user.tenantId, saved.id);
  }

  async updatePurchaseOrder(user: AuthUser, id: string, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const po = await this.findPurchaseOrder(user.tenantId, id);
    if (po.status !== PurchaseOrderStatus.ENTWURF) {
      throw new BadRequestException('Nur Entwuerfe koennen bearbeitet werden.');
    }
    if (dto.items) {
      // buildPoItems validiert Produkte (Lesezugriff) und bleibt VOR der
      // Transaktion; die neuen Positionen nur im Speicher vorbereiten.
      const builtItems = await this.buildPoItems(user, dto.items);
      po.items = builtItems.map((i) => {
        i.purchaseOrderId = id;
        return i;
      });
      po.summe = this.poSumme(po.items);
    }
    if (dto.lieferant !== undefined) po.lieferant = dto.lieferant;
    if (dto.notiz !== undefined) po.notiz = dto.notiz;
    // Bei geaenderten Positionen: alte Positionen loeschen UND die Bestellung
    // (inkl. neuer Positionen via Cascade) in EINER Transaktion speichern. Sonst
    // koennte ein Absturz zwischen delete und save eine Bestellung OHNE
    // Positionen hinterlassen. Ohne Positionsaenderung genuegt der einfache save.
    if (dto.items) {
      await this.dataSource.transaction(async (m) => {
        await m.delete(PurchaseOrderItem, { purchaseOrderId: id });
        await m.save(po);
      });
    } else {
      await this.poRepo.save(po);
    }
    return this.findPurchaseOrder(user.tenantId, id);
  }

  /** Status-Workflow der Bestellung. Freigabe nur durch manager/owner (im Controller geprueft). */
  async changePurchaseOrderStatus(
    user: AuthUser,
    id: string,
    status: PurchaseOrderStatus,
  ): Promise<PurchaseOrder> {
    const po = await this.findPurchaseOrder(user.tenantId, id);
    const erlaubt: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      [PurchaseOrderStatus.ENTWURF]: [PurchaseOrderStatus.EINGEREICHT],
      [PurchaseOrderStatus.EINGEREICHT]: [PurchaseOrderStatus.FREIGEGEBEN, PurchaseOrderStatus.ABGELEHNT],
      [PurchaseOrderStatus.FREIGEGEBEN]: [PurchaseOrderStatus.BESTELLT],
      [PurchaseOrderStatus.BESTELLT]: [PurchaseOrderStatus.GELIEFERT],
      [PurchaseOrderStatus.GELIEFERT]: [],
      [PurchaseOrderStatus.ABGELEHNT]: [],
    };
    if (!erlaubt[po.status]?.includes(status)) {
      throw new BadRequestException(`Statuswechsel von "${po.status}" zu "${status}" nicht erlaubt.`);
    }

    // H6 Vier-Augen-Prinzip: Wer eine Bestellung erstellt hat, darf sie nicht
    // selbst freigeben (Kollusions-/Fehlerschutz bei Ausgaben). Die Freigabe muss
    // von einer anderen Person als dem Ersteller kommen.
    if (status === PurchaseOrderStatus.FREIGEGEBEN && po.erstelltVon === user.id) {
      throw new ForbiddenException(
        'Vier-Augen-Prinzip: Eine Bestellung darf nicht von der Person freigegeben werden, die sie erstellt hat.',
      );
    }
    const vorher = po.status;

    // H2: Statuswechsel als konditionaler Flip in einer Transaktion. Genau ein
    // paralleler Aufruf gewinnt (affected=1); nur der Gewinner bucht bei
    // GELIEFERT den Lagerzugang (in derselben Transaktion, atomar) -> keine
    // Doppel-Lieferung. Muster analog booking-requests.service.accept().
    const gewonnen = await this.dataSource.transaction(async (m) => {
      const patch: Partial<PurchaseOrder> = { status };
      if (status === PurchaseOrderStatus.FREIGEGEBEN) patch.freigegebenVon = user.id;
      const flip = await m.update(
        PurchaseOrder,
        { id, tenantId: user.tenantId, status: vorher },
        patch,
      );
      if (!flip.affected) return false;

      // Bei Lieferung Lagerbestand der verknuepften Produkte atomar erhoehen.
      if (status === PurchaseOrderStatus.GELIEFERT) {
        for (const item of po.items ?? []) {
          if (!item.productId) continue;
          // Produkt tenant-scoped; nur vorhandene buchen.
          const product = await m.findOne(Product, {
            where: { id: item.productId, tenantId: user.tenantId },
          });
          if (!product) continue;
          await this.addStock(m, user.tenantId, item.productId, Number(item.menge));
          await m.save(
            m.create(StockMovement, {
              tenantId: user.tenantId,
              productId: item.productId,
              typ: MovementType.ZUGANG,
              menge: item.menge,
              grund: `Lieferung Bestellung ${po.nummer}`,
              userId: user.id,
            }),
          );
        }
      }
      return true;
    });

    // Race verloren (paralleler Wechsel war schneller): aktuellen Stand ohne
    // eigene Nebenwirkungen zurueckgeben (kein zweites Audit, keine Doppelbuchung).
    if (!gewonnen) return this.findPurchaseOrder(user.tenantId, id);

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'PurchaseOrder',
      entityId: id,
      payload: { status },
    });
    return this.findPurchaseOrder(user.tenantId, id);
  }

  // ---------- Vermietung ----------

  findRentals(tenantId: string): Promise<Rental[]> {
    // take: Sicherheitsventil (T-009), neueste zuerst.
    return this.rentalRepo.find({ where: { tenantId }, order: { von: 'DESC' }, take: 500 });
  }

  async createRental(user: AuthUser, dto: CreateRentalDto): Promise<Rental> {
    // Mandantentrennung: verknuepfte Produkt-/Kunden-ID muss zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection: Vermietung an fremden Kunden/Produkt).
    await assertRefInTenant(this.productRepo, user, dto.productId, 'Produkt');
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');

    const von = new Date(dto.von);
    const bis = new Date(dto.bis);
    // Plausibilitaet: Rueckgabe muss nach dem Beginn liegen (kein leerer/negativer
    // Zeitraum).
    if (!(bis.getTime() > von.getTime())) {
      throw new BadRequestException('Das Rueckgabedatum muss nach dem Startdatum liegen.');
    }

    // H5: Doppelvermietung verhindern. Ueberschneidungspruefung + Insert laufen in
    // EINER Transaktion (analog Lager-Muster), damit zwei parallele Buchungen
    // desselben Produkts fuer ueberlappende Zeitraeume nicht beide durchgehen.
    // Zwei Zeitraeume ueberlappen genau dann, wenn (bestehend.von < neu.bis) UND
    // (bestehend.bis > neu.von). Bereits zurueckgegebene Vermietungen (ZURUECK)
    // belegen das Produkt nicht mehr und blockieren daher nicht.
    return this.dataSource.transaction(async (m) => {
      const overlap = await m.findOne(Rental, {
        where: {
          tenantId: user.tenantId,
          productId: dto.productId,
          status: Not(RentalStatus.ZURUECK),
          von: LessThan(bis),
          bis: MoreThan(von),
        },
      });
      if (overlap) {
        throw new ConflictException('Das Produkt ist im gewaehlten Zeitraum bereits vermietet.');
      }
      return m.save(
        m.create(Rental, {
          ...dto,
          tenantId: user.tenantId,
          von,
          bis,
        }),
      );
    });
  }

  /**
   * Statuswechsel einer Vermietung (Uebergabe/Rueckgabe). Erlaubte Transitionen:
   * reserviert -> aktiv | zurueck, aktiv -> zurueck. Konditionaler Flip analog
   * changePurchaseOrderStatus: das UPDATE greift nur, wenn der Status noch dem
   * gelesenen Stand entspricht - bei parallelem Wechsel gewinnt genau ein
   * Aufruf, der Verlierer liefert den aktuellen Stand ohne eigenes Audit.
   * Immer tenant-scoped (keine Nebenwirkungen auf den Lagerbestand).
   */
  async updateRentalStatus(user: AuthUser, id: string, status: RentalStatus): Promise<Rental> {
    const rental = await this.rentalRepo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!rental) throw new NotFoundException('Vermietung nicht gefunden');

    const erlaubt: Record<RentalStatus, RentalStatus[]> = {
      [RentalStatus.RESERVIERT]: [RentalStatus.AKTIV, RentalStatus.ZURUECK],
      [RentalStatus.AKTIV]: [RentalStatus.ZURUECK],
      [RentalStatus.ZURUECK]: [],
    };
    if (!erlaubt[rental.status]?.includes(status)) {
      throw new BadRequestException(
        `Statuswechsel von "${rental.status}" zu "${status}" nicht erlaubt.`,
      );
    }

    const flip = await this.rentalRepo.update(
      { id, tenantId: user.tenantId, status: rental.status },
      { status },
    );
    if (flip.affected) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'status_change',
        entityType: 'Rental',
        entityId: id,
        payload: { status },
      });
    }
    const aktuell = await this.rentalRepo.findOne({ where: { id, tenantId: user.tenantId } });
    return aktuell ?? rental;
  }
}
