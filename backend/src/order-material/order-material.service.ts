import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderMaterial } from './entities/order-material.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../shop/entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { CreateOrderMaterialDto } from './dto/order-material.dto';

/**
 * Materialverbrauch je Auftrag. Erfassen senkt den Produkt-Bestand, Loeschen
 * bucht ihn zurueck – beides als EINE Transaktion (Zeile + Bestand atomar) und
 * mit relativem decrement/increment (kein Lost-Update bei Parallelzugriff).
 * Bestand darf negativ werden: ehrlicher Ueberverbrauch-Hinweis UND symmetrische
 * Rueckbuchung (Loeschen fuehrt exakt zum Ausgangswert zurueck). Tenant-gebunden.
 */
@Injectable()
export class OrderMaterialService {
  constructor(
    @InjectRepository(OrderMaterial) private readonly repo: Repository<OrderMaterial>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Materialliste eines Auftrags (neueste zuerst). */
  async listForOrder(tenantId: string, orderId: string): Promise<OrderMaterial[]> {
    if (!orderId) return [];
    return this.repo.find({ where: { tenantId, orderId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Verbucht Materialverbrauch auf einen Auftrag und senkt den Bestand. Auftrag
   * und Produkt muessen zum eigenen Betrieb gehoeren (Mandantentrennung).
   */
  async add(user: AuthUser, dto: CreateOrderMaterialDto): Promise<OrderMaterial> {
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    const product = (await assertRefInTenant(this.productRepo, user, dto.productId, 'Produkt'))!;
    const menge = Number(dto.menge);

    // Zeile anlegen UND Bestand senken atomar (eine Transaktion). Relativer
    // decrement -> kein Lost-Update, kein Pre-Read, kein Clamp.
    const saved = await this.dataSource.transaction(async (m) => {
      const s = await m.save(
        m.create(OrderMaterial, {
          tenantId: user.tenantId,
          orderId: dto.orderId,
          productId: dto.productId,
          produktName: product.name,
          einheit: product.einheit,
          menge,
          erfasstVon: user.id,
        }),
      );
      await m.decrement(Product, { id: product.id, tenantId: user.tenantId }, 'bestand', menge);
      return s;
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'OrderMaterial',
      entityId: saved.id,
      payload: { orderId: dto.orderId, productId: dto.productId, menge },
    });
    return saved;
  }

  /** Loescht einen Verbrauch und bucht die Menge atomar auf den Bestand zurueck. */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Materialeintrag nicht gefunden');
    const menge = Number(eintrag.menge);

    await this.dataSource.transaction(async (m) => {
      // Nur zurueckbuchen, wenn das Produkt noch existiert (Snapshot haelt die Zeile lesbar).
      const product = await m.findOne(Product, {
        where: { id: eintrag.productId, tenantId: user.tenantId },
      });
      if (product) {
        await m.increment(Product, { id: product.id, tenantId: user.tenantId }, 'bestand', menge);
      }
      await m.remove(eintrag);
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'OrderMaterial',
      entityId: id,
      payload: { productId: eintrag.productId, menge },
    });
    return { success: true };
  }
}
