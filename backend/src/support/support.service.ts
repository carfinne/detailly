import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SupportTicket, TicketStatus } from './entities/support-ticket.entity';
import { SupportMessage, AutorTyp } from './entities/support-message.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateTicketDto } from './dto/support.dto';

/**
 * Support-Anfragen der Kunden an Detailly. Kunden-Seite ist strikt
 * tenant-getrennt; die Plattform-Seite (Detailly-Team) sieht alle Tickets.
 * Antwortet der Kunde, geht das Ticket wieder auf "offen"; antwortet Detailly,
 * auf "beantwortet".
 */
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportMessage) private readonly messageRepo: Repository<SupportMessage>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Anzeigename des Absenders (Snapshot fuer den Verlauf). */
  private async anzeigeName(user: AuthUser): Promise<string> {
    const u = await this.userRepo.findOne({
      where: { id: user.id },
      select: ['id', 'firstName', 'lastName'],
    });
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || user.email;
  }

  // ---------------------------------------------------------------------------
  // Kunden-Seite (tenant-getrennt)
  // ---------------------------------------------------------------------------

  async createTicket(user: AuthUser, dto: CreateTicketDto): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        tenantId: user.tenantId,
        createdByUserId: user.id,
        betreff: dto.betreff.trim(),
        kategorie: dto.kategorie,
        status: TicketStatus.OFFEN,
      }),
    );
    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId: user.tenantId,
        ticketId: ticket.id,
        autorTyp: AutorTyp.KUNDE,
        autorName: await this.anzeigeName(user),
        text: dto.text.trim(),
      }),
    );
    return ticket;
  }

  listForTenant(tenantId: string): Promise<SupportTicket[]> {
    return this.ticketRepo.find({ where: { tenantId }, order: { updatedAt: 'DESC' } });
  }

  /** Ticket + Verlauf, tenant-gebunden (fremd/unbekannt -> 404). */
  async getTicket(tenantId: string, id: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException('Anfrage nicht gefunden');
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id },
      order: { createdAt: 'ASC' },
    });
    return { ...ticket, messages };
  }

  /** Kunden-Antwort: Nachricht anhaengen; Ticket geht (wieder) auf "offen". */
  async addCustomerMessage(user: AuthUser, id: string, text: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!ticket) throw new NotFoundException('Anfrage nicht gefunden');
    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        autorTyp: AutorTyp.KUNDE,
        autorName: await this.anzeigeName(user),
        text: text.trim(),
      }),
    );
    ticket.status = TicketStatus.OFFEN;
    await this.ticketRepo.save(ticket);
    return this.getTicket(user.tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Plattform-Seite (Detailly-Team, betriebsuebergreifend)
  // ---------------------------------------------------------------------------

  /** Alle Tickets (optional nach Status), angereichert um den Betriebsnamen. */
  async listAll(status?: TicketStatus) {
    const where = status ? { status } : {};
    const tickets = await this.ticketRepo.find({ where, order: { updatedAt: 'DESC' }, take: 500 });
    const tenantIds = [...new Set(tickets.map((t) => t.tenantId))];
    const tenants = tenantIds.length
      ? await this.tenantRepo.find({ where: { id: In(tenantIds) }, select: ['id', 'name'] })
      : [];
    const nameById = new Map(tenants.map((t) => [t.id, t.name]));
    return tickets.map((t) => ({ ...t, betriebName: nameById.get(t.tenantId) ?? '—' }));
  }

  /** Ticket + Verlauf fuer die Plattform (ohne Tenant-Filter). */
  async getForPlatform(id: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Anfrage nicht gefunden');
    const [messages, tenant] = await Promise.all([
      this.messageRepo.find({ where: { ticketId: ticket.id }, order: { createdAt: 'ASC' } }),
      this.tenantRepo.findOne({ where: { id: ticket.tenantId }, select: ['id', 'name'] }),
    ]);
    return { ...ticket, messages, betriebName: tenant?.name ?? '—' };
  }

  /** Detailly-Antwort: Nachricht anhaengen; Ticket geht auf "beantwortet". */
  async answer(user: AuthUser, id: string, text: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Anfrage nicht gefunden');
    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        autorTyp: AutorTyp.DETAILLY,
        autorName: `Detailly Support (${await this.anzeigeName(user)})`,
        text: text.trim(),
      }),
    );
    ticket.status = TicketStatus.BEANTWORTET;
    await this.ticketRepo.save(ticket);
    return this.getForPlatform(id);
  }

  /** Status setzen (Plattform, z. B. schliessen). */
  async setStatus(id: string, status: TicketStatus) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Anfrage nicht gefunden');
    ticket.status = status;
    await this.ticketRepo.save(ticket);
    return ticket;
  }
}
