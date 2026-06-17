import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceItemDto } from './dto/invoice.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { nextSequentialNumber } from '../common/numbering';

const MWST_SATZ = 0.19;

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly audit: AuditService,
    private readonly sevdesk: SevdeskService,
  ) {}

  private buildItems(dtoItems: InvoiceItemDto[]): InvoiceItem[] {
    return dtoItems.map((i) =>
      this.itemRepo.create({
        beschreibung: i.beschreibung,
        menge: i.menge,
        einzelpreis: i.einzelpreis,
        gesamtpreis: Number(i.menge) * Number(i.einzelpreis),
      }),
    );
  }

  private totals(items: InvoiceItem[]) {
    const netto = items.reduce((sum, i) => sum + Number(i.gesamtpreis), 0);
    const mwst = Math.round(netto * MWST_SATZ * 100) / 100;
    const brutto = Math.round((netto + mwst) * 100) / 100;
    return { netto, mwst, brutto };
  }

  private prefix(art: InvoiceKind): string {
    return art === InvoiceKind.ANGEBOT ? 'AN' : 'RE';
  }

  findAll(tenantId: string, query: { art?: InvoiceKind; status?: InvoiceStatus } = {}) {
    const where: Record<string, unknown> = { tenantId };
    if (query.art) where.art = query.art;
    if (query.status) where.status = query.status;
    return this.repo.find({ where, relations: ['items'], order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!invoice) throw new NotFoundException('Beleg nicht gefunden');
    return invoice;
  }

  async create(user: AuthUser, dto: CreateInvoiceDto): Promise<Invoice> {
    const art = dto.art ?? InvoiceKind.RECHNUNG;
    const nummer = await nextSequentialNumber(this.repo, user.tenantId, this.prefix(art));
    const items = this.buildItems(dto.items);
    const t = this.totals(items);

    const invoice = this.repo.create({
      tenantId: user.tenantId,
      nummer,
      art,
      customerId: dto.customerId,
      orderId: dto.orderId,
      status: InvoiceStatus.ENTWURF,
      datum: new Date(),
      leistungsdatum: new Date(),
      hinweis: dto.hinweis,
      items,
      ...t,
    });
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Invoice',
      entityId: saved.id,
      payload: { nummer, art, brutto: t.brutto },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  /** Erzeugt aus einem Auftrag eine Rechnung (oder Angebot) inkl. Positionen. */
  async createFromOrder(user: AuthUser, orderId: string, art = InvoiceKind.RECHNUNG): Promise<Invoice> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId: user.tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');

    const items: InvoiceItemDto[] = (order.items ?? []).map((i) => ({
      beschreibung: i.beschreibung,
      menge: Number(i.menge),
      einzelpreis: Number(i.einzelpreis),
    }));
    if (Number(order.materialkosten) > 0) {
      items.push({ beschreibung: 'Materialkosten', menge: 1, einzelpreis: Number(order.materialkosten) });
    }

    return this.create(user, { customerId: order.customerId, orderId: order.id, art, items });
  }

  async update(user: AuthUser, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    if (dto.items) {
      await this.itemRepo.delete({ invoiceId: id });
      invoice.items = this.buildItems(dto.items).map((i) => {
        i.invoiceId = id;
        return i;
      });
      Object.assign(invoice, this.totals(invoice.items));
    }
    if (dto.hinweis !== undefined) invoice.hinweis = dto.hinweis;
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Invoice',
      entityId: id,
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async changeStatus(user: AuthUser, id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    invoice.status = status;

    // Beim Stellen einer Rechnung (offen) sevdesk-Stub anstossen.
    if (status === InvoiceStatus.OFFEN && invoice.art === InvoiceKind.RECHNUNG) {
      const sevdeskId = await this.sevdesk.createInvoice(invoice);
      if (sevdeskId) invoice.sevdeskInvoiceId = sevdeskId;
    }
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Invoice',
      entityId: id,
      payload: { status },
    });
    return saved;
  }
}
