import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderTime } from './entities/order-time.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { CreateOrderTimeDto, UpdateOrderTimeDto } from './dto/order-time.dto';

/** Rollen, die fremde Eintraege verwalten / fuer andere erfassen duerfen. */
const LEITUNG_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

/**
 * Eintrag angereichert um den Mitarbeiternamen (fuer alle) und – NUR fuer die
 * Leitung – die Lohnkosten in € (aus Stundenlohn * Dauer). `kosten` bleibt fuer
 * Mitarbeiter undefiniert (Gehaltsdaten).
 */
export interface OrderTimeView extends OrderTime {
  mitarbeiterName: string;
  kosten?: number;
}

/**
 * Auftragszeiten (Job-Costing). Mitarbeiter erfassen ihre EIGENE Zeit; nur die
 * Leitung darf aendern/loeschen oder fuer andere erfassen. Alles tenant-gebunden.
 */
@Injectable()
export class OrderTimeService {
  constructor(
    @InjectRepository(OrderTime) private readonly repo: Repository<OrderTime>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  private istLeitung(role: string): boolean {
    return LEITUNG_ROLLEN.includes(role);
  }

  /**
   * Reichert Eintraege um den Mitarbeiternamen an (tenant-scoped). `mitKosten`
   * (nur Leitung) ergaenzt die Lohnkosten je Eintrag aus dem Stundenlohn.
   */
  private async decorate(
    tenantId: string,
    rows: OrderTime[],
    mitKosten: boolean,
  ): Promise<OrderTimeView[]> {
    const ids = [...new Set(rows.map((r) => r.userId))];
    const users = ids.length
      ? await this.userRepo.find({
          where: { id: In(ids), tenantId },
          // Stundenlohn (Gehaltsdaten) NUR laden, wenn der Abrufer Leitung ist.
          select: mitKosten
            ? ['id', 'firstName', 'lastName', 'stundenlohn']
            : ['id', 'firstName', 'lastName'],
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id]),
    );
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    return rows.map((r) => {
      const view: OrderTimeView = { ...r, mitarbeiterName: nameById.get(r.userId) ?? '—' };
      if (mitKosten) {
        view.kosten = Math.round((Number(r.minuten) / 60) * (lohnById.get(r.userId) ?? 0) * 100) / 100;
      }
      return view;
    });
  }

  /**
   * Alle Zeiteintraege eines Auftrags (neueste zuerst) + Summe in Minuten. Fuer
   * die Leitung zusaetzlich die Gesamt-Lohnkosten (summeKosten in €).
   */
  async listForOrder(
    user: AuthUser,
    orderId: string,
  ): Promise<{ eintraege: OrderTimeView[]; summeMinuten: number; summeKosten?: number }> {
    if (!orderId) return { eintraege: [], summeMinuten: 0 };
    const mitKosten = this.istLeitung(user.role);
    const rows = await this.repo.find({
      where: { tenantId: user.tenantId, orderId },
      order: { datum: 'DESC', createdAt: 'DESC' },
    });
    const eintraege = await this.decorate(user.tenantId, rows, mitKosten);
    const summeMinuten = rows.reduce((s, r) => s + Number(r.minuten || 0), 0);
    const out: { eintraege: OrderTimeView[]; summeMinuten: number; summeKosten?: number } = {
      eintraege,
      summeMinuten,
    };
    if (mitKosten) {
      out.summeKosten = Math.round(eintraege.reduce((s, e) => s + (e.kosten ?? 0), 0) * 100) / 100;
    }
    return out;
  }

  /**
   * Bucht Arbeitszeit auf einen Auftrag. Mandantentrennung: der Auftrag muss zum
   * eigenen Betrieb gehoeren. `userId` wird NUR fuer die Leitung beachtet – ein
   * normaler Mitarbeiter bucht immer auf sich selbst (Anti-Betrug).
   */
  async create(user: AuthUser, dto: CreateOrderTimeDto): Promise<OrderTimeView> {
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');

    let userId = user.id;
    if (this.istLeitung(user.role) && dto.userId) {
      await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
      userId = dto.userId;
    }

    const eintrag = this.repo.create({
      tenantId: user.tenantId,
      orderId: dto.orderId,
      userId,
      datum: new Date(dto.datum),
      minuten: dto.minuten,
      notiz: dto.notiz,
      erfasstVon: user.id,
    });
    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'OrderTime',
      entityId: saved.id,
      payload: { orderId: dto.orderId, minuten: dto.minuten, fuerUser: userId },
    });
    return (await this.decorate(user.tenantId, [saved], this.istLeitung(user.role)))[0];
  }

  /** Leitung korrigiert einen Eintrag (tenant-scoped). */
  async update(user: AuthUser, id: string, dto: UpdateOrderTimeDto): Promise<OrderTimeView> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Zeiteintrag nicht gefunden');

    // Truthy-Check (nicht !== undefined): ein leerer String wuerde von
    // assertRefInTenant als "keine FK" durchgewunken und den Eintrag verwaisen
    // lassen. Nur ein echter, tenant-validierter Mitarbeiter wird neu gesetzt.
    if (dto.userId) {
      await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
      eintrag.userId = dto.userId;
    }
    if (dto.datum !== undefined) eintrag.datum = new Date(dto.datum);
    if (dto.minuten !== undefined) eintrag.minuten = dto.minuten;
    if (dto.notiz !== undefined) eintrag.notiz = dto.notiz;

    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'OrderTime',
      entityId: id,
    });
    return (await this.decorate(user.tenantId, [saved], this.istLeitung(user.role)))[0];
  }

  /** Leitung loescht einen Eintrag (tenant-scoped). */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Zeiteintrag nicht gefunden');
    await this.repo.remove(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'OrderTime',
      entityId: id,
    });
    return { success: true };
  }
}
