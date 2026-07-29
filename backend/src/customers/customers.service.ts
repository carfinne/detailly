import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { clampPageQuery } from '../common/util/pagination';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    private readonly audit: AuditService,
    private readonly sevdesk: SevdeskService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async findAll(
    tenantId: string,
    query: { search?: string; page?: number; limit?: number; includeInactive?: boolean } = {},
  ) {
    // T-010: zentraler Clamp (Default 50 statt frueher 25, untere Klammer gegen
    // limit=0/negativ). Der einzige Listen-Consumer (kunden/page.tsx) sendet
    // explizit limit=100 - die Default-Aenderung ist dort unsichtbar.
    const { page, limit, skip, take } = clampPageQuery(query);
    const qb = this.repo.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });

    if (!query.includeInactive) qb.andWhere('c.isActive = :active', { active: true });
    if (query.search) {
      // LIKE-Platzhalter (% und _) sowie den Escape-Backslash selbst maskieren,
      // damit Nutzereingaben literal gesucht werden (kein Wildcard-Missbrauch/
      // Info-Inferenz). Konsistent zu SearchService (ESCAPE '\'). Parameter-
      // Binding schuetzt ohnehin vor SQL-Injection; hier geht es um die Semantik.
      const escaped = query.search.replace(/[\\%_]/g, (c) => `\\${c}`);
      qb.andWhere(
        "(c.firstName LIKE :s ESCAPE '\\' OR c.lastName LIKE :s ESCAPE '\\' OR " +
          "c.companyName LIKE :s ESCAPE '\\' OR c.email LIKE :s ESCAPE '\\' OR " +
          "c.phone LIKE :s ESCAPE '\\')",
        { s: `%${escaped}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Kunde nicht gefunden');
    return customer;
  }

  /**
   * Kunden-Kontingent des Betriebs fuer die UX (Muster: EmployeesService.getUsage):
   * `used` = aktuell zaehlende (AKTIVE) Kunden, tenant-scoped – exakt dieselbe
   * Zaehlregel wie die Durchsetzung in create()/update(), damit Anzeige und
   * Server-Block nie auseinanderlaufen. `limit` = maxCustomers des Tarifs
   * (`null` = unbegrenzt bzw. kein Tarif -> die UI blendet die Kontingent-Anzeige aus).
   * Bewusst UNGEFILTERT (kein Suchbegriff): das Kontingent zaehlt alle aktiven
   * Kunden, nicht die aktuell gefilterte Listenansicht.
   */
  async getUsage(tenantId: string): Promise<{ used: number; limit: number | null }> {
    const used = await this.repo.count({ where: { tenantId, isActive: true } });
    const limit = await this.subscriptions.getLimit(tenantId, 'maxCustomers');
    return { used, limit };
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
    // Tarif-Limit (maxCustomers), tenant-scoped: nur AKTIVE Kunden zaehlen –
    // deaktivierte (z. B. DSGVO-anonymisierte) geben ihren Platz frei.
    const aktiveKunden = await this.repo.count({
      where: { tenantId: user.tenantId, isActive: true },
    });
    await this.subscriptions.assertLimit(user.tenantId, 'maxCustomers', aktiveKunden);

    const customer = this.repo.create({ ...dto, tenantId: user.tenantId });
    const saved = await this.repo.save(customer);

    // sevDesk-Kontakt best effort anlegen (Token pro Betrieb; ohne Token No-op).
    // Fehler duerfen die Kundenanlage NICHT blockieren.
    try {
      const token = await this.sevdesk.loadToken(user.tenantId);
      if (token) {
        const sevdeskId = await this.sevdesk.syncContact({ tenantId: user.tenantId, token }, saved);
        if (sevdeskId && sevdeskId !== saved.sevdeskContactId) {
          saved.sevdeskContactId = sevdeskId;
          await this.repo.save(saved);
        }
      }
    } catch {
      /* best effort */
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
    // Reaktivierung = Anlage-Aequivalent fuers Tarif-Limit: sonst liesse sich
    // maxCustomers per Deaktivieren/Reaktivieren umgehen. Gleiche Zaehlweise
    // wie in create() (nur aktive Kunden, tenant-scoped).
    if (dto.isActive === true && customer.isActive === false) {
      const aktiveKunden = await this.repo.count({
        where: { tenantId: user.tenantId, isActive: true },
      });
      await this.subscriptions.assertLimit(user.tenantId, 'maxCustomers', aktiveKunden);
    }
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
