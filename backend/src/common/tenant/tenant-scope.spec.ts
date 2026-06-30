import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  withTenant,
  assertSameTenant,
  findOneScoped,
  assertRefInTenant,
} from './tenant-scope';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Tests fuer die sicherheitskritische Mandantentrennung (Multi-Tenant-Isolation).
 *
 * Es wird KEINE echte DB gebootet: das Repository ist ein simples Objekt mit
 * `findOne: jest.fn()`. Dadurch laedt kein TypeORM-DataSource/better-sqlite3.
 * Geprueft werden die Cross-Tenant-Schutzmechanismen und insbesondere die
 * Existenz-Orakel-Sicherheit (gleiche Fehlermeldung fuer "fremd" und "existiert nicht").
 */
describe('tenant-scope (Mandantentrennung)', () => {
  const user: AuthUser = {
    id: 'u1',
    email: 'chef@betrieb-a.de',
    role: 'owner',
    tenantId: 't1',
  };

  // Minimaler Repository-Mock; nur findOne wird von den getesteten Funktionen genutzt.
  const makeRepo = () => ({ findOne: jest.fn() }) as any;

  describe('withTenant', () => {
    it('setzt tenantId immer aus dem Nutzer', () => {
      const out = withTenant(user, { name: 'Kunde X' });
      expect(out).toEqual({ name: 'Kunde X', tenantId: 't1' });
    });

    it('ueberschreibt einen im Body mitgelieferten tenantId-Wert (kein Body-Vertrauen)', () => {
      const out = withTenant(user, { name: 'Kunde X', tenantId: 'FREMD' } as any);
      expect(out.tenantId).toBe('t1');
    });
  });

  describe('assertSameTenant', () => {
    it('gleicher Tenant -> kein Wurf', () => {
      expect(() => assertSameTenant(user, 't1')).not.toThrow();
    });

    it('fremder Tenant -> NotFoundException', () => {
      expect(() => assertSameTenant(user, 't2')).toThrow(NotFoundException);
    });

    it('null/undefined Tenant -> NotFoundException', () => {
      expect(() => assertSameTenant(user, null)).toThrow(NotFoundException);
      expect(() => assertSameTenant(user, undefined)).toThrow(NotFoundException);
    });
  });

  describe('findOneScoped', () => {
    it('Treffer -> liefert Entity und filtert auf id + tenantId', async () => {
      const repo = makeRepo();
      const entity = { id: 'x1', tenantId: 't1' };
      repo.findOne.mockResolvedValue(entity);

      const out = await findOneScoped(repo, user, 'x1');

      expect(out).toBe(entity);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'x1', tenantId: 't1' } });
    });

    it('kein Treffer -> NotFoundException mit Standardtext', async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      await expect(findOneScoped(repo, user, 'x1')).rejects.toThrow(NotFoundException);
      await expect(findOneScoped(repo, user, 'x1')).rejects.toThrow('Datensatz nicht gefunden');
    });

    it('kein Treffer -> NotFoundException mit eigener Message', async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      await expect(findOneScoped(repo, user, 'x1', 'Auftrag nicht gefunden')).rejects.toThrow(
        'Auftrag nicht gefunden',
      );
    });
  });

  describe('assertRefInTenant', () => {
    it.each([['', 'leerer String'], [null, 'null'], [undefined, 'undefined']])(
      'id %s (%s) -> null OHNE DB-Aufruf (optionale FK)',
      async (id) => {
        const repo = makeRepo();
        const out = await assertRefInTenant(repo, user, id as any, 'Kunde');
        expect(out).toBeNull();
        expect(repo.findOne).not.toHaveBeenCalled();
      },
    );

    it('gueltige Referenz im eigenen Tenant -> Entity, gefiltert auf id + tenantId', async () => {
      const repo = makeRepo();
      const entity = { id: 'c1', tenantId: 't1' };
      repo.findOne.mockResolvedValue(entity);

      const out = await assertRefInTenant(repo, user, 'c1', 'Kunde');

      expect(out).toBe(entity);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 't1' } });
    });

    it('fremder/nicht existierender Datensatz -> BadRequestException mit Label-Message', async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      await expect(assertRefInTenant(repo, user, 'c1', 'Kunde')).rejects.toThrow(
        BadRequestException,
      );
      await expect(assertRefInTenant(repo, user, 'c1', 'Kunde')).rejects.toThrow(
        'Kunde gehoert nicht zum eigenen Betrieb oder existiert nicht',
      );
    });

    it('Existenz-Orakel-Sicherheit: "fremder Betrieb" und "existiert nicht" werfen exakt dieselbe Message', async () => {
      // Fall A: Datensatz existiert, gehoert aber einem fremden Tenant -> findOne (mit tenantId-Filter)
      // liefert null. Fall B: Datensatz existiert gar nicht -> ebenfalls null. Beide Pfade sind aus
      // Sicht des Aufrufers ununterscheidbar, was ein Existenz-Orakel verhindert.
      const repoFremd = makeRepo();
      repoFremd.findOne.mockResolvedValue(null);
      const repoFehlt = makeRepo();
      repoFehlt.findOne.mockResolvedValue(null);

      const msgFremd = await assertRefInTenant(repoFremd, user, 'c1', 'Kunde').catch(
        (e) => e.message,
      );
      const msgFehlt = await assertRefInTenant(repoFehlt, user, 'c999', 'Kunde').catch(
        (e) => e.message,
      );

      expect(msgFremd).toBe(msgFehlt);
    });

    it('Standard-Label "Referenz", wenn keines uebergeben wird', async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      await expect(assertRefInTenant(repo, user, 'c1')).rejects.toThrow(
        'Referenz gehoert nicht zum eigenen Betrieb oder existiert nicht',
      );
    });
  });
});
