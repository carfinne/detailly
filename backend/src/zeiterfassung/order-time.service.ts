import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { OrderTime } from './entities/order-time.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { CreateOrderTimeDto, UpdateOrderTimeDto } from './dto/order-time.dto';

/** Rollen, die fremde Eintraege verwalten / fuer andere erfassen duerfen. */
const LEITUNG_ROLLEN = ['platform_admin', 'owner', 'manager'];

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

  /**
   * Arbeitszeiten-Export als CSV fuers Lohnbuero (NUR Leitung – enthaelt
   * Loehne; der Controller gated per @Roles). Detailzeilen je Buchung +
   * Summenblock je Mitarbeiter. Lohnkosten = aktueller Stundenlohn * Dauer.
   */
  async buildPayrollCsv(
    tenantId: string,
    von?: string,
    bis?: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const where: Record<string, unknown> = { tenantId };
    const vonD = von ? new Date(von) : null;
    const bisD = bis ? new Date(bis) : null;
    if (bisD) bisD.setHours(23, 59, 59, 999); // inklusiver Endtag
    if (vonD && bisD) where.datum = Between(vonD, bisD);
    else if (vonD) where.datum = MoreThanOrEqual(vonD);
    else if (bisD) where.datum = LessThanOrEqual(bisD);

    const rows = await this.repo.find({ where, order: { userId: 'ASC', datum: 'ASC' } });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In(userIds), tenantId },
          select: ['id', 'firstName', 'lastName', 'stundenlohn'],
        })
      : [];
    const orders = orderIds.length
      ? await this.orderRepo.find({ where: { id: In(orderIds), tenantId }, select: ['id', 'auftragsnummer'] })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id]),
    );
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    const auftragById = new Map(orders.map((o) => [o.id, o.auftragsnummer]));

    const SEP = ';';
    const csv = (s: unknown) => {
      const v = String(s ?? '');
      return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const num = (n: number) => Number(n).toFixed(2).replace('.', ',');
    const datumDe = (d: Date) => {
      const x = new Date(d);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
    };

    const zeilen = [['Mitarbeiter', 'Datum', 'Auftrag', 'Notiz', 'Stunden', 'Stundenlohn', 'Lohnkosten'].join(SEP)];
    const summe = new Map<string, { name: string; std: number; kosten: number }>();
    let gesamtStd = 0;
    let gesamtKosten = 0;
    for (const r of rows) {
      const std = Number(r.minuten) / 60;
      const lohn = lohnById.get(r.userId) ?? 0;
      const kosten = Math.round(std * lohn * 100) / 100;
      const name = nameById.get(r.userId) ?? '—';
      zeilen.push(
        [
          csv(name),
          datumDe(r.datum),
          csv(auftragById.get(r.orderId) ?? ''),
          csv(r.notiz ?? ''),
          num(std),
          num(lohn),
          num(kosten),
        ].join(SEP),
      );
      const agg = summe.get(r.userId) ?? { name, std: 0, kosten: 0 };
      agg.std += std;
      agg.kosten += kosten;
      summe.set(r.userId, agg);
      gesamtStd += std;
      gesamtKosten += kosten;
    }

    // Summenblock je Mitarbeiter (durch Leerzeile getrennt).
    zeilen.push('');
    zeilen.push('Summe je Mitarbeiter');
    zeilen.push(['Mitarbeiter', 'Stunden', 'Lohnkosten'].join(SEP));
    for (const agg of summe.values()) {
      zeilen.push([csv(agg.name), num(agg.std), num(agg.kosten)].join(SEP));
    }
    zeilen.push(['Gesamt', num(gesamtStd), num(gesamtKosten)].join(SEP));

    // BOM fuer korrekte Umlaut-Darstellung in Excel; CRLF-Zeilenenden.
    const buffer = Buffer.from('﻿' + zeilen.join('\r\n') + '\r\n', 'utf-8');
    const range = [von, bis].filter(Boolean).join('_') || 'alle';
    return { buffer, filename: `Arbeitszeiten_${range}.csv`, contentType: 'text/csv; charset=utf-8' };
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
