import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { withSequentialNumber } from '../common/numbering';

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
  ) {}

  // ---------- Produkte / Lager ----------

  findProducts(tenantId: string, includeInactive = false): Promise<Product[]> {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.aktiv = true;
    return this.productRepo.find({ where, order: { name: 'ASC' } });
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

  /**
   * Aendert den Lagerbestand ATOMAR (eine einzige UPDATE-Anweisung) statt per
   * Read-Modify-Write – damit parallele Buchungen sich nicht gegenseitig
   * ueberschreiben (Lost Update; auf PostgreSQL real, auf SQLite durch
   * serialisierte Writes ohnehin). Mit `guardNonNegative` wird NUR gebucht, wenn
   * der Bestand danach >= 0 bliebe. Rueckgabe: wurde gebucht?
   */
  private async adjustStock(
    tenantId: string,
    productId: string,
    delta: number,
    guardNonNegative = false,
  ): Promise<boolean> {
    const qb = this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ bestand: () => '"bestand" + :delta' })
      .where('"id" = :id AND "tenantId" = :tid');
    if (guardNonNegative) qb.andWhere('"bestand" + :delta >= 0');
    qb.setParameters({ id: productId, tid: tenantId, delta });
    const res = await qb.execute();
    return (res.affected ?? 0) > 0;
  }

  async recordMovement(user: AuthUser, productId: string, dto: StockMovementDto) {
    // Existenz + Mandantenzugehoerigkeit sicherstellen (404 bei fremd/unbekannt).
    await this.findProduct(user.tenantId, productId);
    const menge = Number(dto.menge);
    if (dto.typ === MovementType.ZUGANG) {
      await this.adjustStock(user.tenantId, productId, menge);
    } else if (dto.typ === MovementType.ABGANG) {
      const gebucht = await this.adjustStock(user.tenantId, productId, -menge, true);
      if (!gebucht) {
        throw new BadRequestException('Nicht genug Bestand fuer diesen Abgang.');
      }
    } else {
      // Inventur setzt den absoluten Bestand (DTO erzwingt menge >= 0).
      await this.productRepo.update({ id: productId, tenantId: user.tenantId }, { bestand: menge });
    }
    const product = await this.findProduct(user.tenantId, productId);
    const movement = await this.movementRepo.save(
      this.movementRepo.create({
        tenantId: user.tenantId,
        productId,
        typ: dto.typ,
        menge: dto.menge,
        grund: dto.grund,
        userId: user.id,
      }),
    );
    return { product, movement };
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
    return this.poRepo.find({ where, relations: ['items'], order: { createdAt: 'DESC' } });
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
      nummer: '',
      lieferant: dto.lieferant,
      notiz: dto.notiz,
      erstelltVon: user.id,
      status: PurchaseOrderStatus.ENTWURF,
      summe: this.poSumme(items),
      items,
    });
    // Bestellnummer kollisionssicher vergeben (UNIQUE-Index + Retry).
    const saved = await withSequentialNumber(this.poRepo, user.tenantId, 'BE', (nummer) => {
      po.nummer = nummer;
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

  /** Status-Workflow der Bestellung. Freigabe nur durch manager/franchise_owner (im Controller geprueft). */
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
    if (status === PurchaseOrderStatus.FREIGEGEBEN) {
      // Vier-Augen-Prinzip: Wer die Bestellung erstellt hat, darf sie nicht selbst
      // freigeben (Funktionstrennung bei Beschaffungsfreigaben).
      if (po.erstelltVon && po.erstelltVon === user.id) {
        throw new ForbiddenException(
          'Vier-Augen-Prinzip: Eine selbst erstellte Bestellung darf nicht von derselben Person freigegeben werden.',
        );
      }
      po.freigegebenVon = user.id;
    }

    // Bei Lieferung Lagerbestand der verknuepften Produkte erhoehen.
    if (status === PurchaseOrderStatus.GELIEFERT) {
      for (const item of po.items ?? []) {
        if (!item.productId) continue;
        const product = await this.productRepo.findOne({
          where: { id: item.productId, tenantId: user.tenantId },
        });
        if (product) {
          // Atomar erhoehen (kein Read-Modify-Write -> kein Lost Update).
          await this.adjustStock(user.tenantId, product.id, Number(item.menge));
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
    return this.rentalRepo.find({ where: { tenantId }, order: { von: 'DESC' } });
  }

  async createRental(user: AuthUser, dto: CreateRentalDto): Promise<Rental> {
    // Mandantentrennung: verknuepfte Produkt-/Kunden-ID muss zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection: Vermietung an fremden Kunden/Produkt).
    await assertRefInTenant(this.productRepo, user, dto.productId, 'Produkt');
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');

    const von = new Date(dto.von);
    const bis = new Date(dto.bis);
    if (Number.isNaN(von.getTime()) || Number.isNaN(bis.getTime())) {
      throw new BadRequestException('Ungueltiges Datum (von/bis).');
    }
    if (bis <= von) {
      throw new BadRequestException('Das Bis-Datum muss nach dem Von-Datum liegen.');
    }

    // Doppelvermietung verhindern: keine ueberlappende, noch nicht zurueckgegebene
    // Vermietung desselben Produkts ([von,bis) ueberschneidet sich mit [von2,bis2)).
    const konflikt = await this.rentalRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tid', { tid: user.tenantId })
      .andWhere('r.productId = :pid', { pid: dto.productId })
      .andWhere('r.status != :zurueck', { zurueck: RentalStatus.ZURUECK })
      .andWhere('r.von < :bis AND r.bis > :von', { von, bis })
      .getCount();
    if (konflikt > 0) {
      throw new ConflictException(
        'Dieses Produkt ist im gewaehlten Zeitraum bereits vermietet oder reserviert.',
      );
    }

    return this.rentalRepo.save(
      this.rentalRepo.create({
        ...dto,
        tenantId: user.tenantId,
        von,
        bis,
      }),
    );
  }
}
