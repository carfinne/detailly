import { Reflector } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { PlatformSecurityController } from './platform-security.controller';
import { PlatformSecurityService } from './platform-security.service';

/**
 * Rollen-Gate + Auditierung des Betreiber-Bereichs platform/security/* (Sentinel
 * Teil 2). Tenant-Isolation ist heilig: die Sperr-Endpunkte sind PLATFORM_ADMIN
 * vorbehalten; Analyst/Support duerfen NUR lesen.
 */
describe('PlatformSecurity – Rollen-Gate (RolesGuard gegen die echten @Roles-Metadaten)', () => {
  const guard = new RolesGuard(new Reflector());

  function canActivate(handler: (...a: any[]) => unknown, role: string | undefined): boolean {
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role, tenantId: 't' } : undefined, url: '/platform/security', method: 'POST' }) }),
      getHandler: () => handler,
      getClass: () => PlatformSecurityController,
    };
    return guard.canActivate(ctx);
  }

  const proto = PlatformSecurityController.prototype;

  it('LESEN (events/summary/blocks): alle drei Plattform-Rollen duerfen', () => {
    for (const role of [UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT]) {
      expect(canActivate(proto.events, role)).toBe(true);
      expect(canActivate(proto.summary, role)).toBe(true);
      expect(canActivate(proto.blocks, role)).toBe(true);
    }
  });

  it('LESEN: Nicht-Plattform-Rolle (owner) wird abgewiesen (403)', () => {
    expect(canActivate(proto.events, UserRole.OWNER)).toBe(false);
    expect(canActivate(proto.summary, UserRole.MANAGER)).toBe(false);
    expect(canActivate(proto.blocks, undefined)).toBe(false); // gar nicht eingeloggt
  });

  it('SPERREN (POST/DELETE): NUR PLATFORM_ADMIN – Analyst/Support abgewiesen', () => {
    expect(canActivate(proto.createBlock, UserRole.PLATFORM_ADMIN)).toBe(true);
    expect(canActivate(proto.removeBlock, UserRole.PLATFORM_ADMIN)).toBe(true);

    expect(canActivate(proto.createBlock, UserRole.PLATFORM_ANALYST)).toBe(false);
    expect(canActivate(proto.createBlock, UserRole.PLATFORM_SUPPORT)).toBe(false);
    expect(canActivate(proto.removeBlock, UserRole.PLATFORM_ANALYST)).toBe(false);
    expect(canActivate(proto.removeBlock, UserRole.OWNER)).toBe(false);
  });
});

describe('PlatformSecurityService – manuelle Sperren sind auditiert', () => {
  function makeSut() {
    const eventRepo = {} as any;
    const ipBlocks = {
      block: jest.fn(async (i: any) => ({ id: 'b1', ip: i.ip, ...i })),
      unblock: jest.fn(async (id: string) => ({ id, ip: '203.0.113.9', active: false })),
      list: jest.fn(),
      countActive: jest.fn(),
    };
    const events = { record: jest.fn() };
    const audit = { log: jest.fn(async () => undefined) };
    const svc = new PlatformSecurityService(eventRepo, ipBlocks as any, events as any, audit as any);
    return { svc, ipBlocks, events, audit };
  }

  it('manualBlock: setzt Sperre, protokolliert ip_block-Event UND AuditService', async () => {
    const { svc, ipBlocks, events, audit } = makeSut();
    await svc.manualBlock({
      ip: '203.0.113.9',
      reason: 'manuell verdaechtig',
      severity: 'warn',
      durationMs: 60_000,
      admin: { id: 'admin-1', tenantId: 'plat-tenant' },
    });
    expect(ipBlocks.block).toHaveBeenCalledTimes(1);
    expect(ipBlocks.block.mock.calls[0][0].createdBy).toBe('admin-1');
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ip_block', ip: '203.0.113.9', userId: 'admin-1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'security_ip_block', userId: 'admin-1', entityType: 'IpBlock' }),
    );
  });

  it('manualBlock ohne Dauer -> dauerhafte Sperre (expiresAt null)', async () => {
    const { svc, ipBlocks } = makeSut();
    await svc.manualBlock({ ip: '203.0.113.9', reason: 'dauerhaft', admin: { id: 'a', tenantId: 't' } });
    expect(ipBlocks.block.mock.calls[0][0].expiresAt).toBeNull();
  });

  it('manualUnblock: hebt auf, protokolliert ip_unblock-Event UND AuditService', async () => {
    const { svc, events, audit } = makeSut();
    const res = await svc.manualUnblock('b1', { id: 'admin-1', tenantId: 't' });
    expect(res).not.toBeNull();
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'ip_unblock', userId: 'admin-1' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'security_ip_unblock' }));
  });

  it('manualUnblock auf unbekannte id -> null (Controller wandelt in 404)', async () => {
    const { svc, ipBlocks, audit } = makeSut();
    ipBlocks.unblock.mockResolvedValueOnce(null);
    const res = await svc.manualUnblock('weg', { id: 'a', tenantId: 't' });
    expect(res).toBeNull();
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('PlatformSecurityController.removeBlock – 404 bei fehlender Sperre', () => {
  it('wirft NotFound, wenn der Service null liefert', async () => {
    const service = { manualUnblock: jest.fn(async () => null) } as any;
    const controller = new PlatformSecurityController(service);
    await expect(
      controller.removeBlock('weg', { id: 'a', role: 'platform_admin', tenantId: 't' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
