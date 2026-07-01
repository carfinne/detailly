import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { OrderMaterial } from '../order-material/entities/order-material.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../shop/entities/product.entity';

export interface Wirtschaftlichkeit {
  netto: number;
  lohnkosten: number;
  materialkosten: number;
  marge: number;
  margeProzent: number | null;
}

/**
 * Deckungsbeitrag je Auftrag: Netto-Auftragswert minus direkte Kosten
 * (Lohn = erfasste Stunden * Stundenlohn; Material = verbrauchte Menge *
 * Einkaufspreis). Sensible BWL-Zahl -> Controller ist Leitung-only.
 * Tenant-getrennt.
 */
@Injectable()
export class ProfitabilityService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderTime) private readonly timeRepo: Repository<OrderTime>,
    @InjectRepository(OrderMaterial) private readonly materialRepo: Repository<OrderMaterial>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async forOrder(tenantId: string, orderId: string): Promise<Wirtschaftlichkeit> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
      select: ['id', 'nettoSumme'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    const netto = round2(Number(order.nettoSumme || 0));

    const [zeiten, materialien] = await Promise.all([
      this.timeRepo.find({ where: { tenantId, orderId }, select: ['userId', 'minuten'] }),
      this.materialRepo.find({ where: { tenantId, orderId }, select: ['productId', 'menge'] }),
    ]);

    // Lohnkosten = Summe(Stunden * Stundenlohn).
    const userIds = [...new Set(zeiten.map((z) => z.userId))];
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds), tenantId }, select: ['id', 'stundenlohn'] })
      : [];
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    const lohnkosten = round2(
      zeiten.reduce((s, z) => s + (Number(z.minuten) / 60) * (lohnById.get(z.userId) ?? 0), 0),
    );

    // Materialkosten = Summe(Menge * Einkaufspreis des aktuellen Produkts).
    const prodIds = [...new Set(materialien.map((m) => m.productId))];
    const products = prodIds.length
      ? await this.productRepo.find({ where: { id: In(prodIds), tenantId }, select: ['id', 'einkaufspreis'] })
      : [];
    const ekById = new Map(products.map((p) => [p.id, Number(p.einkaufspreis ?? 0)]));
    const materialkosten = round2(
      materialien.reduce((s, m) => s + Number(m.menge) * (ekById.get(m.productId) ?? 0), 0),
    );

    const marge = round2(netto - lohnkosten - materialkosten);
    const margeProzent = netto > 0 ? Math.round((marge / netto) * 1000) / 10 : null;

    return { netto, lohnkosten, materialkosten, marge, margeProzent };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
