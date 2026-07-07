import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { StockMovement, MovementType } from './entities/stock-movement.entity';
import { PurchaseOrder, PurchaseOrderStatus } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Rental } from './entities/rental.entity';
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
import { withUniqueRetry } from '../common/unique-retry';

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

  findProducts(tenantId: string, includeInactive = false): Promise<Product[]> {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.aktiv = true;
    // take: Sicherheitsventil (T-009), kein Produktlimit - auch Dropdown-Quelle
    // (Materialkarte am Auftrag), daher grosszuegig bemessen.
    return this.productRepo.find({ where, order: { name: 'ASC' }, take: 1000 });
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
    const products = await this.findProducts(tenantId);
    return products.filter((p) => Number(p.bestand) <= Number(p.mindestbestand));
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

  findMovements(tenantId: string, productId?: string): Promise<StockMovement[]> {
    const where: Record<string, unknown> = { tenantId };
    if (productId) where.productId = productId;
    return this.movementRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
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

  findPurchaseOrders(tenantId: string, status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    // take: Sicherheitsventil (T-009) - laedt die items-Relation mit, daher
    // wichtig, die Zeilenzahl zu begrenzen (neueste zuerst).
    return this.poRepo.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: 500,
    });
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
      const builtItems = await this.buildPoItems(user, dto.items);
      await this.poItemRepo.delete({ purchaseOrderId: id });
      po.items = builtItems.map((i) => {
        i.purchaseOrderId = id;
        return i;
      });
      po.summe = this.poSumme(po.items);
    }
    if (dto.lieferant !== undefined) po.lieferant = dto.lieferant;
    if (dto.notiz !== undefined) po.notiz = dto.notiz;
    await this.poRepo.save(po);
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
    if (status === PurchaseOrderStatus.FREIGEGEBEN) po.freigegebenVon = user.id;

    // Bei Lieferung Lagerbestand der verknuepften Produkte erhoehen.
    if (status === PurchaseOrderStatus.GELIEFERT) {
      for (const item of po.items ?? []) {
        if (!item.productId) continue;
        const product = await this.productRepo.findOne({
          where: { id: item.productId, tenantId: user.tenantId },
        });
        if (product) {
          product.bestand = Number(product.bestand) + Number(item.menge);
          await this.productRepo.save(product);
          await this.movementRepo.save(
            this.movementRepo.create({
              tenantId: user.tenantId,
              productId: product.id,
              typ: MovementType.ZUGANG,
              menge: item.menge,
              grund: `Lieferung Bestellung ${po.nummer}`,
              userId: user.id,
            }),
          );
        }
      }
    }

    po.status = status;
    const saved = await this.poRepo.save(po);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'PurchaseOrder',
      entityId: id,
      payload: { status },
    });
    return saved;
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
    return this.rentalRepo.save(
      this.rentalRepo.create({
        ...dto,
        tenantId: user.tenantId,
        von: new Date(dto.von),
        bis: new Date(dto.bis),
      }),
    );
  }
}
