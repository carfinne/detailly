import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, UpdateOrderDto, OrderItemDto } from './dto/order.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { nextSequentialNumber } from '../common/numbering';

const MWST_SATZ = 0.19;

/** Erlaubte Statusuebergaenge im Auftrags-Workflow. */
const STATUS_UEBERGAENGE: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.ANGEFRAGT]: [OrderStatus.KALKULIERT, OrderStatus.STORNIERT],
  [OrderStatus.KALKULIERT]: [OrderStatus.BESTAETIGT, OrderStatus.STORNIERT],
  [OrderStatus.BESTAETIGT]: [OrderStatus.IN_ARBEIT, OrderStatus.STORNIERT],
  [OrderStatus.IN_ARBEIT]: [OrderStatus.QUALITAETSKONTROLLE, OrderStatus.STORNIERT],
  [OrderStatus.QUALITAETSKONTROLLE]: [OrderStatus.FERTIG, OrderStatus.IN_ARBEIT],
  [OrderStatus.FERTIG]: [OrderStatus.ABGERECHNET],
  [OrderStatus.ABGERECHNET]: [],
  [OrderStatus.STORNIERT]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    private readonly audit: AuditService,
  ) {}

  /** Berechnet Positionssummen sowie Netto/MwSt/Brutto eines Auftrags. */
  private calculate(items: OrderItem[], materialkosten = 0) {
    const positionsSumme = items.reduce((sum, item) => {
      item.gesamtpreis = Number(item.menge) * Number(item.einzelpreis);
      return sum + item.gesamtpreis;
    }, 0);
    const nettoSumme = positionsSumme + Number(materialkosten || 0);
    const mwstBetrag = Math.round(nettoSumme * MWST_SATZ * 100) / 100;
    const gesamtpreis = Math.round((nettoSumme + mwstBetrag) * 100) / 100;
    return { nettoSumme, mwstBetrag, gesamtpreis };
  }

  private buildItems(dtoItems: OrderItemDto[] = []): OrderItem[] {
    return dtoItems.map((i) =>
      this.itemRepo.create({
        beschreibung: i.beschreibung,
        typ: i.typ,
        menge: i.menge,
        einzelpreis: i.einzelpreis,
        gesamtpreis: Number(i.menge) * Number(i.einzelpreis),
      }),
    );
  }

  async findAll(tenantId: string, query: { status?: OrderStatus; customerId?: string } = {}) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    return this.repo.find({ where, relations: ['items'], order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    return order;
  }

  async create(user: AuthUser, dto: CreateOrderDto): Promise<Order> {
    const auftragsnummer = await nextSequentialNumber(this.repo, user.tenantId, 'AU');
    const items = this.buildItems(dto.items);
    const totals = this.calculate(items, dto.materialkosten);

    const order = this.repo.create({
      tenantId: user.tenantId,
      auftragsnummer,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      assignedUserId: dto.assignedUserId,
      locationId: dto.locationId,
      serviceType: dto.serviceType,
      materialkosten: dto.materialkosten ?? 0,
      arbeitsstunden: dto.arbeitsstunden ?? 0,
      geplanterStart: dto.geplanterStart ? new Date(dto.geplanterStart) : null,
      geplantesEnde: dto.geplantesEnde ? new Date(dto.geplantesEnde) : null,
      internerHinweis: dto.internerHinweis,
      bilderVorher: dto.bilderVorher ?? [],
      bilderNachher: dto.bilderNachher ?? [],
      items,
      ...totals,
    });

    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Order',
      entityId: saved.id,
      payload: { auftragsnummer, gesamtpreis: totals.gesamtpreis },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(user.tenantId, id);

    if (dto.items) {
      await this.itemRepo.delete({ orderId: id });
      order.items = this.buildItems(dto.items).map((i) => {
        i.orderId = id;
        return i;
      });
    }

    const assignable: (keyof UpdateOrderDto)[] = [
      'customerId',
      'vehicleId',
      'assignedUserId',
      'locationId',
      'serviceType',
      'materialkosten',
      'arbeitsstunden',
      'internerHinweis',
      'bilderVorher',
      'bilderNachher',
    ];
    for (const key of assignable) {
      if (dto[key] !== undefined) (order as any)[key] = dto[key];
    }
    if (dto.geplanterStart !== undefined)
      order.geplanterStart = dto.geplanterStart ? new Date(dto.geplanterStart) : null;
    if (dto.geplantesEnde !== undefined)
      order.geplantesEnde = dto.geplantesEnde ? new Date(dto.geplantesEnde) : null;

    const totals = this.calculate(order.items ?? [], order.materialkosten);
    Object.assign(order, totals);

    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Order',
      entityId: id,
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async changeStatus(user: AuthUser, id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(user.tenantId, id);
    const erlaubt = STATUS_UEBERGAENGE[order.status] ?? [];
    if (order.status !== status && !erlaubt.includes(status)) {
      throw new BadRequestException(
        `Statuswechsel von "${order.status}" zu "${status}" ist nicht erlaubt.`,
      );
    }
    const vorher = order.status;
    order.status = status;
    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Order',
      entityId: id,
      payload: { von: vorher, nach: status },
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const order = await this.findOne(user.tenantId, id);
    await this.repo.remove(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'Order',
      entityId: id,
    });
    return { success: true };
  }
}
