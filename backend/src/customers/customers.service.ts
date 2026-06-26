import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    private readonly audit: AuditService,
    private readonly sevdesk: SevdeskService,
  ) {}

  async findAll(
    tenantId: string,
    query: { search?: string; page?: number; limit?: number; includeInactive?: boolean } = {},
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 25);
    const qb = this.repo.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });

    if (!query.includeInactive) qb.andWhere('c.isActive = :active', { active: true });
    if (query.search) {
      qb.andWhere(
        '(c.firstName LIKE :s OR c.lastName LIKE :s OR c.companyName LIKE :s OR c.email LIKE :s OR c.phone LIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Kunde nicht gefunden');
    return customer;
  }

  /**
   * Leichte, UNGEKAPPTE Liste aller aktiven Kunden (nur Namens-Spalten) fuer
   * Auswahl-Dropdowns/Namens-Maps. Behebt den Bug, dass Dropdowns ueber den
   * Listen-Cap (100) hinaus stumm Kunden verloren ("mein Kunde fehlt").
   */
  selectList(tenantId: string): Promise<Customer[]> {
    return this.repo
      .createQueryBuilder('c')
      .select(['c.id', 'c.type', 'c.firstName', 'c.lastName', 'c.companyName'])
      .where('c.tenantId = :tenantId AND c.isActive = :active', { tenantId, active: true })
      .orderBy('c.lastName', 'ASC')
      .addOrderBy('c.companyName', 'ASC')
      .getMany();
  }

  async create(user: AuthUser, dto: CreateCustomerDto): Promise<Customer> {
    const customer = this.repo.create({ ...dto, tenantId: user.tenantId });
    const saved = await this.repo.save(customer);

    const sevdeskId = await this.sevdesk.syncContact(saved);
    if (sevdeskId && sevdeskId !== saved.sevdeskContactId) {
      saved.sevdeskContactId = sevdeskId;
      await this.repo.save(saved);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Customer',
      entityId: saved.id,
      payload: { name: saved.companyName || `${saved.firstName} ${saved.lastName}` },
    });
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(user.tenantId, id);
    Object.assign(customer, dto);
    const saved = await this.repo.save(customer);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Customer',
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  /** Soft-Delete: Kunde wird deaktiviert, nicht geloescht. */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const customer = await this.findOne(user.tenantId, id);
    customer.isActive = false;
    await this.repo.save(customer);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'Customer',
      entityId: id,
    });
    return { success: true };
  }
}
