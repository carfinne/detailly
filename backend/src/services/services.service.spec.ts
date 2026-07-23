import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ServiceCategory } from './entities/service-item.entity';
import { STARTER_KATALOG } from './starter-catalog';

/**
 * Starter-Katalog-Import (Pilot-Onboarding). Reine Mocks (keine DB): ein
 * Repo-Mock mit find/create/save. Prueft Anlegen tenant-scoped, Gewerk-Filter,
 * Idempotenz (Namensgleichheit, case-insensitiv) und die Gewerk-Validierung.
 */
describe('ServicesService – Starter-Katalog', () => {
  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  const AUF = STARTER_KATALOG[ServiceCategory.AUFBEREITUNG].length;
  const FOL = STARTER_KATALOG[ServiceCategory.FOLIERUNG].length;
  const PPF = STARTER_KATALOG[ServiceCategory.PPF].length;

  /** Repo-Mock: `existingNames` = bereits vorhandene Leistungen des Tenants. */
  function makeRepo(existingNames: string[] = []) {
    const saved: any[] = [];
    const find = jest.fn().mockResolvedValue(existingNames.map((name) => ({ name })));
    const create = jest.fn((o: any) => o);
    const save = jest.fn(async (arr: any[]) => {
      const withIds = arr.map((o, i) => ({ ...o, id: `new-${i}` }));
      saved.push(...withIds);
      return withIds;
    });
    return { saved, find, create, save };
  }

  describe('starterCatalog() (Vorschau)', () => {
    it('liefert genau die drei Starter-Gewerke mit korrekten Zaehlungen', () => {
      const svc = new ServicesService(makeRepo() as any);
      const res = svc.starterCatalog();
      expect(res.gewerke.map((g) => g.gewerk)).toEqual(['aufbereitung', 'folierung', 'ppf']);
      const byGewerk = Object.fromEntries(res.gewerke.map((g) => [g.gewerk, g.anzahl]));
      expect(byGewerk).toEqual({ aufbereitung: AUF, folierung: FOL, ppf: PPF });
      // Jede Gruppe traegt ihre Leistungsliste (Vorschau).
      expect(res.gewerke[0].leistungen).toHaveLength(AUF);
      // sonstiges hat KEINEN Katalog.
      expect(res.gewerke.some((g) => (g.gewerk as string) === 'sonstiges')).toBe(false);
    });
  });

  describe('importStarter() – Anlegen tenant-scoped', () => {
    it('legt alle Leistungen des Gewerks mit user.tenantId + korrekter Kategorie an', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [ServiceCategory.AUFBEREITUNG]);

      expect(res.importiert).toBe(AUF);
      expect(res.uebersprungen).toBe(0);
      expect(res.items).toHaveLength(AUF);
      // Tenant-Isolation: jede angelegte Leistung traegt die tenantId des Nutzers.
      expect(repo.saved.every((s) => s.tenantId === 't1')).toBe(true);
      // Gewerk-Zuordnung: kategorie == gewaehltes Gewerk.
      expect(repo.saved.every((s) => s.kategorie === 'aufbereitung')).toBe(true);
      expect(repo.saved.every((s) => s.aktiv === true)).toBe(true);
      // Bestandsabgleich erfolgt tenant-scoped.
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1' } }),
      );
    });

    it('Gewerk-Filter: nur PPF -> ausschliesslich PPF-Leistungen', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [ServiceCategory.PPF]);

      expect(res.importiert).toBe(PPF);
      expect(repo.saved.every((s) => s.kategorie === 'ppf')).toBe(true);
      const ppfNames = new Set(STARTER_KATALOG[ServiceCategory.PPF].map((l) => l.name));
      expect(repo.saved.every((s) => ppfNames.has(s.name))).toBe(true);
    });

    it('mehrere Gewerke -> Summe der Leistungen', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [
        ServiceCategory.AUFBEREITUNG,
        ServiceCategory.FOLIERUNG,
      ]);
      expect(res.importiert).toBe(AUF + FOL);
      expect(repo.saved).toHaveLength(AUF + FOL);
    });

    it('doppeltes Gewerk im Array wird entdoppelt (kein Doppel-Anlegen)', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [
        ServiceCategory.PPF,
        ServiceCategory.PPF,
      ]);
      expect(res.importiert).toBe(PPF);
    });
  });

  describe('importStarter() – Idempotenz (Namensgleichheit)', () => {
    it('doppelter Import dupliziert nicht: alle vorhanden -> 0 neu, alle uebersprungen', async () => {
      const alleNamen = STARTER_KATALOG[ServiceCategory.AUFBEREITUNG].map((l) => l.name);
      const repo = makeRepo(alleNamen);
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [ServiceCategory.AUFBEREITUNG]);

      expect(res.importiert).toBe(0);
      expect(res.uebersprungen).toBe(AUF);
      expect(res.items).toEqual([]);
      // Nichts anzulegen -> save wird nicht aufgerufen.
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('Idempotenz ist case-/whitespace-insensitiv', async () => {
      const ersterName = STARTER_KATALOG[ServiceCategory.PPF][0].name;
      // Gleicher Name, andere Schreibweise + zusaetzliche Leerzeichen.
      const repo = makeRepo(['  ' + ersterName.toUpperCase() + ' ']);
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [ServiceCategory.PPF]);

      expect(res.importiert).toBe(PPF - 1);
      expect(res.uebersprungen).toBe(1);
      expect(repo.saved.some((s) => s.name === ersterName)).toBe(false);
    });

    it('teilweiser Bestand: nur die fehlenden werden angelegt', async () => {
      const einName = STARTER_KATALOG[ServiceCategory.FOLIERUNG][0].name;
      const repo = makeRepo([einName]);
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [ServiceCategory.FOLIERUNG]);

      expect(res.importiert).toBe(FOL - 1);
      expect(res.uebersprungen).toBe(1);
    });
  });

  describe('importStarter() – Gewerk-Validierung', () => {
    it('leere Gewerk-Wahl -> BadRequest, kein Anlegen', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      await expect(svc.importStarter(user, [])).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('unbekanntes Gewerk wird herausgefiltert -> effektiv leer -> BadRequest', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      await expect(
        svc.importStarter(user, ['sonstiges' as any]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('Mix aus gueltig + ungueltig: nur das gueltige Gewerk wird uebernommen', async () => {
      const repo = makeRepo();
      const svc = new ServicesService(repo as any);
      const res = await svc.importStarter(user, [
        ServiceCategory.PPF,
        'sonstiges' as any,
      ]);
      expect(res.importiert).toBe(PPF);
      expect(repo.saved.every((s) => s.kategorie === 'ppf')).toBe(true);
    });
  });
});
