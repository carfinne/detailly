import { TenantExportService } from './tenant-export.service';
import { User } from '../users/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Betriebs-Gesamtexport: streamt alle tenant-eigenen Daten als eine JSON-Datei,
 * strikt tenant-scoped, und schliesst Geheimnisse (Passwort-Hashes, Tokens) aus.
 * Reiner Unit-Test mit gemockter DataSource + Capture-Sink.
 */

const USER: AuthUser = { id: 'u1', email: 'chef@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

describe('TenantExportService.streamExport', () => {
  it('schliesst Geheimnisse aus und ist tenant-scoped', async () => {
    const capturedWheres: unknown[] = [];

    const getRepository = jest.fn((entity: unknown) => {
      if (entity === Tenant) {
        return {
          findOne: jest.fn(async () => ({
            id: 't1',
            name: 'Werkstatt A',
            slug: 'werkstatt-a',
            sevdeskApiToken: 'SEV-SECRET', // select waere nicht dabei, hier defensiv
          })),
        };
      }
      if (entity === User) {
        return {
          find: jest.fn(async (q: any) => {
            capturedWheres.push(q?.where);
            return [
              {
                id: 'u1',
                email: 'chef@betrieb.de',
                passwordHash: 'HASH-SECRET',
                totpSecret: 'TOTP-SECRET',
                tenantId: 't1',
              },
            ];
          }),
        };
      }
      if (entity === Customer) {
        return {
          find: jest.fn(async (q: any) => {
            capturedWheres.push(q?.where);
            return [{ id: 'c1', firstName: 'Max', tenantId: 't1' }];
          }),
        };
      }
      // Alle uebrigen Entitaeten: leer.
      return { find: jest.fn(async () => []) };
    });

    const dataSource = { getRepository } as any;
    const audit = { log: jest.fn() } as any;
    const svc = new TenantExportService(dataSource, audit);

    let out = '';
    const sink = { write: (c: string) => (out += c), end: jest.fn() };
    await svc.streamExport(USER, sink);

    // Gueltiges JSON.
    const parsed = JSON.parse(out);
    expect(parsed.tenantId).toBe('t1');
    expect(Array.isArray(parsed.mitarbeiter)).toBe(true);
    expect(Array.isArray(parsed.kunden)).toBe(true);

    // Geheimnisse duerfen NICHT im Export erscheinen.
    expect(out).not.toContain('HASH-SECRET');
    expect(out).not.toContain('TOTP-SECRET');
    expect(out).not.toContain('SEV-SECRET');
    expect(out).not.toContain('passwordHash');
    // Fachdaten sind da.
    expect(parsed.mitarbeiter[0].email).toBe('chef@betrieb.de');
    expect(parsed.kunden[0].firstName).toBe('Max');

    // tenant-scoped: jede Sammel-Query filtert auf tenantId.
    for (const w of capturedWheres) {
      expect(w).toMatchObject({ tenantId: 't1' });
    }

    // Export wird protokolliert (PII-frei).
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'gdpr_tenant_export', tenantId: 't1' }),
    );
    expect(sink.end).toHaveBeenCalled();
  });
});
