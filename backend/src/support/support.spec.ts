import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupportService } from './support.service';
import { TicketStatus } from './entities/support-ticket.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformSupportController } from './platform-support.controller';
import { SupportController } from './support.controller';
import { UserRole, TENANT_ROLLEN } from '../users/entities/user.entity';

function makeService(over: { ticket?: any; tickets?: any[]; messages?: any[]; tenants?: any[] } = {}) {
  const ticketRepo: any = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: x.id ?? 'tk1', ...x })),
    find: jest.fn().mockResolvedValue(over.tickets ?? []),
    findOne: jest.fn().mockResolvedValue('ticket' in over ? over.ticket : null),
  };
  const messageRepo: any = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'm1', ...x })),
    find: jest.fn().mockResolvedValue(over.messages ?? []),
  };
  const userRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 'u1', firstName: 'Max', lastName: 'Muster' }),
  };
  const tenantRepo: any = {
    find: jest.fn().mockResolvedValue(over.tenants ?? []),
    findOne: jest.fn().mockResolvedValue({ id: 't1', name: 'Muster GmbH' }),
  };
  const svc = new SupportService(ticketRepo, messageRepo, userRepo, tenantRepo);
  return { svc, ticketRepo, messageRepo };
}

const KUNDE: any = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' };
const DETAILLY: any = { id: 'd1', email: 's@detailly.de', role: 'platform_support', tenantId: 'dt' };

describe('SupportService · Kunden-Seite', () => {
  it('createTicket: tenantId/Ersteller aus dem JWT + erste Nachricht (kunde)', async () => {
    const { svc, ticketRepo, messageRepo } = makeService();
    await svc.createTicket(KUNDE, { betreff: 'Frage zur Rechnung', kategorie: 'abrechnung' as any, text: 'Hallo!' });
    expect(ticketRepo.create.mock.calls[0][0]).toMatchObject({
      tenantId: 't1',
      createdByUserId: 'u1',
      status: TicketStatus.OFFEN,
    });
    expect(messageRepo.create.mock.calls[0][0]).toMatchObject({
      tenantId: 't1',
      autorTyp: 'kunde',
      autorName: 'Max Muster',
      text: 'Hallo!',
    });
  });

  it('getTicket: fremdes/unbekanntes Ticket -> 404 (Mandantentrennung)', async () => {
    const { svc, ticketRepo } = makeService({ ticket: null });
    await expect(svc.getTicket('t1', 'fremd')).rejects.toBeInstanceOf(NotFoundException);
    expect(ticketRepo.findOne).toHaveBeenCalledWith({ where: { id: 'fremd', tenantId: 't1' } });
  });

  it('Kunden-Antwort auf geschlossenes Ticket -> Status wieder "offen"', async () => {
    const ticket = { id: 'tk1', tenantId: 't1', status: TicketStatus.GESCHLOSSEN };
    const { svc, ticketRepo } = makeService({ ticket });
    await svc.addCustomerMessage(KUNDE, 'tk1', 'Noch eine Frage');
    expect(ticket.status).toBe(TicketStatus.OFFEN);
    expect(ticketRepo.save).toHaveBeenCalled();
  });

  it('listForTenant: Query ist HART auf die tenantId gescoped (nur eigene Tickets)', async () => {
    const { svc, ticketRepo } = makeService({ tickets: [{ id: 'tk1', tenantId: 't1' }] });
    await svc.listForTenant('t1');
    expect(ticketRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-Tenant-Haertung: fehlende tenantId ist NIE ein gueltiger Scope.
// (TypeORM 0.3.30 verwirft where:{tenantId:null} still -> sonst Voll-Scan ueber
// ALLE Betriebe. Ein Haendler-Prinzipal hat tenantId=null.)
// ---------------------------------------------------------------------------
describe('SupportService · tenantId-Haertung (Cross-Tenant-Leak-Fix)', () => {
  const OHNE_TENANT: any = { id: 'h1', email: 'h@x.de', role: 'haendler', tenantId: null, dealerId: 'd1' };

  it('createTicket ohne tenantId -> 403, KEINE Query/Insert', async () => {
    const { svc, ticketRepo, messageRepo } = makeService();
    await expect(
      svc.createTicket(OHNE_TENANT, { betreff: 'x', kategorie: 'frage' as any, text: 'y' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ticketRepo.save).not.toHaveBeenCalled();
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('listForTenant(null/undefined) -> 403, KEIN find (kein Voll-Scan)', async () => {
    const { svc, ticketRepo } = makeService({ tickets: [{ id: 'fremd', tenantId: 't2' }] });
    expect(() => svc.listForTenant(null as any)).toThrow(ForbiddenException);
    expect(() => svc.listForTenant(undefined as any)).toThrow(ForbiddenException);
    expect(ticketRepo.find).not.toHaveBeenCalled();
  });

  it('getTicket ohne tenantId -> 403, KEIN findOne', async () => {
    const { svc, ticketRepo } = makeService({ ticket: { id: 'fremd', tenantId: 't2' } });
    await expect(svc.getTicket(null as any, 'fremd')).rejects.toBeInstanceOf(ForbiddenException);
    expect(ticketRepo.findOne).not.toHaveBeenCalled();
  });

  it('addCustomerMessage ohne tenantId -> 403, KEIN Zugriff auf fremdes Ticket', async () => {
    const { svc, ticketRepo } = makeService({ ticket: { id: 'fremd', tenantId: 't2' } });
    await expect(svc.addCustomerMessage(OHNE_TENANT, 'fremd', 'hi')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ticketRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('SupportController · RolesGuard (Kunden-Support nur fuer Betriebs-Rollen)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = SupportController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => SupportController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  it('HAENDLER kommt an KEINE Support-Route (Cross-Tenant-Leak geschlossen)', () => {
    for (const h of [proto.list, proto.create, proto.get, proto.reply]) {
      expect(guard.canActivate(ctxFor(h, UserRole.HAENDLER))).toBe(false);
    }
  });

  it.each(TENANT_ROLLEN)('Betriebs-Rolle %s darf den Kunden-Support nutzen', (role) => {
    expect(guard.canActivate(ctxFor(proto.list, role))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.create, role))).toBe(true);
  });
});

describe('SupportService · Plattform-Seite', () => {
  it('answer: Detailly-Nachricht + Status "beantwortet"', async () => {
    const ticket = { id: 'tk1', tenantId: 't1', status: TicketStatus.OFFEN };
    const { svc, messageRepo } = makeService({ ticket });
    await svc.answer(DETAILLY, 'tk1', 'Gerne helfen wir!');
    expect(messageRepo.create.mock.calls[0][0]).toMatchObject({
      tenantId: 't1', // Nachricht gehoert zum KUNDEN-Tenant, nicht zum Detailly-Tenant
      autorTyp: 'detailly',
    });
    expect(ticket.status).toBe(TicketStatus.BEANTWORTET);
  });

  it('listAll: reichert Tickets um den Betriebsnamen an', async () => {
    const { svc } = makeService({
      tickets: [{ id: 'tk1', tenantId: 't1' }, { id: 'tk2', tenantId: 't2' }],
      tenants: [{ id: 't1', name: 'Muster GmbH' }],
    });
    const res = await svc.listAll();
    expect(res.find((t: any) => t.id === 'tk1')!.betriebName).toBe('Muster GmbH');
    expect(res.find((t: any) => t.id === 'tk2')!.betriebName).toBe('—');
  });
});

describe('PlatformSupportController · RolesGuard (Ebenen-Trennung)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = PlatformSupportController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => PlatformSupportController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  it.each([UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN])(
    'Kunden-Rolle %s kommt NICHT an die Plattform-Ticketliste',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.list, role))).toBe(false);
    },
  );

  it.each([UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST])(
    'Plattform-Rolle %s darf die Ticketliste lesen',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.list, role))).toBe(true);
    },
  );

  it('Analyst darf NICHT antworten (read-only), Support schon', () => {
    expect(guard.canActivate(ctxFor(proto.answer, UserRole.PLATFORM_ANALYST))).toBe(false);
    expect(guard.canActivate(ctxFor(proto.answer, UserRole.PLATFORM_SUPPORT))).toBe(true);
  });
});
