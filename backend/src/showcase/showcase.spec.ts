import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShowcaseService, resolveShowcaseFile } from './showcase.service';
import { ShowcaseItem } from './entities/showcase-item.entity';
import { TenantStatus } from '../tenants/entities/tenant.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Sicherheits-/Rechtskritische Logik des oeffentlichen Schaufensters:
 *  - Consent-Pflicht: veroeffentlicht=true NUR mit bestaetigtem Kunden-Einverstaendnis.
 *  - PII-Ausschluss: der oeffentliche Payload enthaelt WEDER Kundenname/Kennzeichen/
 *    Auftragsnummer NOCH interne Felder (tenantId, Datei-Pfade, Consent-Nachweis).
 *  - Widerruf: zurueckgezogen/geloescht -> oeffentlich 404.
 *  - Bild-Endpunkt: traversal-sicher + nur veroeffentlichte Eintraege.
 *  - Tenant-Isolation: Queries strikt (tenantId, shareToken) gescoped.
 *  - shareToken unguessable (48 hex) + nicht enumerierbar (Formatpruefung vor DB).
 * Reine Unit-Tests mit gemockten Repositories/Services (keine DB, kein Nest-Bootstrap).
 */

const SLUG = 'glanzwerk';

/** Ein Betrieb, der das Feature hat + aktiv ist. */
const tenant = {
  id: 'TENANT-A',
  name: 'Glanzwerk Aufbereitung',
  logoUrl: null,
  status: TenantStatus.ACTIVE,
};

/**
 * Voll ausgestatteter, VEROEFFENTLICHTER Eintrag – mit internen Feldern, die der
 * oeffentliche Payload NIEMALS durchreichen darf.
 */
function publishedItem(overrides: Partial<ShowcaseItem> = {}): ShowcaseItem {
  return {
    id: 'ITEM-1',
    tenantId: 'TENANT-A',
    titel: 'Mercedes S-Klasse Vollfolierung',
    beschreibung: 'Komplett foliert in Frozen Grey.',
    gewerk: 'folie',
    vorherPfad: '/private-uploads/schaufenster/TENANT-A/aaaa.webp',
    nachherPfad: '/private-uploads/schaufenster/TENANT-A/bbbb.webp',
    veroeffentlicht: true,
    shareToken: 'a'.repeat(48),
    reihenfolge: 0,
    kundeEinverstaendnis: true,
    einverstaendnisAm: new Date('2026-07-20T10:00:00Z'),
    einverstaendnisHinweis: 'Kunde Max Mustermann, Kennzeichen B-XY-1234, hat schriftlich zugestimmt.',
    createdAt: new Date('2026-07-20T09:00:00Z'),
    updatedAt: new Date('2026-07-20T09:00:00Z'),
    ...overrides,
  } as ShowcaseItem;
}

function makeService() {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve({ id: x.id ?? 'NEW', ...x })),
    remove: jest.fn((x: any) => Promise.resolve(x)),
  };
  const tenantRepo = { findOne: jest.fn().mockResolvedValue({ ...tenant }) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const subscriptions = { hasFeatureForTenant: jest.fn().mockResolvedValue(true) };
  const svc = new ShowcaseService(
    repo as any,
    tenantRepo as any,
    audit as any,
    subscriptions as any,
  );
  return { svc, repo, tenantRepo, audit, subscriptions };
}

const userA: AuthUser = { id: 'U1', email: 'a@a.de', role: 'owner', tenantId: 'TENANT-A' };

describe('ShowcaseService · Consent-Pflicht (Bildveroeffentlichung)', () => {
  it('veroeffentlicht ohne Consent -> 400 (kein veroeffentlicht=true)', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(publishedItem({ veroeffentlicht: false, kundeEinverstaendnis: false, shareToken: null }));
    await expect(
      svc.setPublish(userA, 'ITEM-1', { veroeffentlicht: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Kein save mit veroeffentlicht=true durchgekommen.
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('veroeffentlicht MIT Consent -> setzt veroeffentlicht=true, shareToken + Nachweis-Zeitstempel', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(publishedItem({ veroeffentlicht: false, kundeEinverstaendnis: false, shareToken: null, einverstaendnisAm: null }));
    const res = await svc.setPublish(userA, 'ITEM-1', {
      veroeffentlicht: true,
      kundeEinverstaendnis: true,
      einverstaendnisHinweis: 'Kunde hat schriftlich zugestimmt.',
    });
    expect(res.veroeffentlicht).toBe(true);
    expect(res.kundeEinverstaendnis).toBe(true);
    expect(res.einverstaendnisAm).not.toBeNull();
    // shareToken erzeugt: 48 hex (nicht erratbar).
    const saved = repo.save.mock.calls[0][0];
    expect(saved.shareToken).toMatch(/^[a-f0-9]{48}$/);
  });

  it('Zurueckziehen braucht keinen Consent und setzt veroeffentlicht=false', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(publishedItem());
    const res = await svc.setPublish(userA, 'ITEM-1', { veroeffentlicht: false });
    expect(res.veroeffentlicht).toBe(false);
  });
});

describe('ShowcaseService · Oeffentlicher Payload ist PII-FREI', () => {
  it('Galerie: KEIN Kundenname/Kennzeichen/Auftragsnummer, keine internen Felder', async () => {
    const { svc, repo } = makeService();
    repo.find.mockResolvedValue([publishedItem()]);
    const res = await svc.publicGallery(SLUG);
    const json = JSON.stringify(res);
    // Explizit: die im Consent-Nachweis / internen Feldern steckende PII taucht NIE auf.
    expect(json).not.toContain('Max Mustermann');
    expect(json).not.toContain('B-XY-1234');
    expect(json).not.toContain('TENANT-A'); // interne Tenant-ID
    expect(json).not.toContain('ITEM-1'); // interne Row-ID
    expect(json).not.toContain('private-uploads'); // Datei-Pfad
    expect(json).not.toContain('einverstaendnis'); // Consent-Nachweis
    expect(json).not.toContain('kundeEinverstaendnis');
    // Nur die freigegebenen Item-Felder sind gesetzt (strikte Objekt-Form).
    expect(Object.keys(res.items[0]).sort()).toEqual(
      ['beschreibung', 'bildNachher', 'bildVorher', 'gewerk', 'shareToken', 'titel'].sort(),
    );
    // Betriebs-Meta ist auf die Whitelist begrenzt.
    expect(Object.keys(res.betrieb).sort()).toEqual(['logoUrl', 'name'].sort());
    // Bild-URLs zeigen auf den token-scoped Public-Endpunkt (kein Roh-Pfad).
    expect(res.items[0].bildVorher).toBe(
      `/public/schaufenster/${SLUG}/${'a'.repeat(48)}/bild/vorher`,
    );
    expect(res.items[0].bildNachher).toContain('/bild/nachher');
  });

  it('Einzel-Item: identische PII-freie Whitelist', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(publishedItem());
    const res = await svc.publicItem(SLUG, 'a'.repeat(48));
    const json = JSON.stringify(res);
    expect(json).not.toContain('Max Mustermann');
    expect(json).not.toContain('B-XY-1234');
    expect(json).not.toContain('private-uploads');
    expect(Object.keys(res.item).sort()).toEqual(
      ['beschreibung', 'bildNachher', 'bildVorher', 'gewerk', 'shareToken', 'titel'].sort(),
    );
  });
});

describe('ShowcaseService · Widerruf/Loeschung -> oeffentlich 404', () => {
  it('zurueckgezogener Eintrag: findOne(veroeffentlicht:true) leer -> 404', async () => {
    const { svc, repo } = makeService();
    // Simuliert: die veroeffentlicht=true-Query findet nichts (Item ist zurueckgezogen).
    repo.findOne.mockResolvedValue(null);
    await expect(svc.publicItem(SLUG, 'a'.repeat(48))).rejects.toBeInstanceOf(NotFoundException);
    // Query MUSS veroeffentlicht:true UND den Tenant enthalten.
    const arg = repo.findOne.mock.calls[0][0];
    expect(arg.where).toMatchObject({ veroeffentlicht: true, tenantId: 'TENANT-A' });
  });

  it('geloeschter Eintrag: Bild-Endpunkt -> 404', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(null);
    await expect(
      svc.resolvePublicImagePath(SLUG, 'a'.repeat(48), 'vorher'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ShowcaseService · Feature-Gate der Public-Routen (404 statt 403-Orakel)', () => {
  it('ohne Tarif-Feature -> 404, ohne die Item-Query auch nur zu stellen', async () => {
    const { svc, repo, subscriptions } = makeService();
    subscriptions.hasFeatureForTenant.mockResolvedValue(false);
    await expect(svc.publicGallery(SLUG)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('inaktiver Betrieb -> 404', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...tenant, status: TenantStatus.INACTIVE });
    await expect(svc.publicGallery(SLUG)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unbekannter Slug -> 404', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(null);
    await expect(svc.publicGallery(SLUG)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ShowcaseService · shareToken nicht enumerierbar + Tenant-Isolation', () => {
  it('ungueltiges Token-Format -> 404 OHNE Item-DB-Treffer (kein Enumerieren)', async () => {
    const { svc, repo } = makeService();
    await expect(svc.publicItem(SLUG, 'zzz')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.publicItem(SLUG, '../../secret')).rejects.toBeInstanceOf(NotFoundException);
    // Der Item-Repo wird bei Formatmuell NIE befragt.
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('Item-Query ist strikt (tenantId, shareToken, veroeffentlicht) gescoped', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockResolvedValue(publishedItem());
    await svc.publicItem(SLUG, 'a'.repeat(48));
    const arg = repo.findOne.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      shareToken: 'a'.repeat(48),
      tenantId: 'TENANT-A',
      veroeffentlicht: true,
    });
  });
});

describe('resolveShowcaseFile · Traversal-Sicherheit + Tenant-Ordner', () => {
  const path = require('path');
  const CWD = process.cwd();
  // Erwarteter Tenant-Ordner ueber dieselbe resolve-Semantik (plattformunabhaengig,
  // inkl. evtl. Laufwerksbuchstabe unter Windows).
  const tenantDir = path.resolve(CWD, 'private-uploads', 'schaufenster', 'TENANT-A');
  const sep = path.sep;

  it('normaler Dateiname bleibt im Tenant-Ordner', () => {
    const abs = resolveShowcaseFile('TENANT-A', '/private-uploads/schaufenster/TENANT-A/aaaa.webp', CWD)!;
    expect(abs.startsWith(tenantDir + sep)).toBe(true);
    expect(abs.endsWith('aaaa.webp')).toBe(true);
  });

  it('../-Traversal bricht NICHT aus dem Tenant-Ordner aus (nur basename zaehlt)', () => {
    const abs = resolveShowcaseFile('TENANT-A', '../../../../etc/passwd', CWD)!;
    // Landet unter .../TENANT-A/passwd – NIE bei /etc/passwd.
    expect(abs.startsWith(tenantDir + sep)).toBe(true);
    expect(abs.endsWith(sep + 'passwd')).toBe(true);
    expect(abs).not.toContain(`${sep}etc${sep}passwd`);
  });

  it('absoluter Fremdpfad wird auf den basename im Tenant-Ordner reduziert', () => {
    const abs = resolveShowcaseFile('TENANT-A', '/etc/shadow', CWD)!;
    expect(abs.startsWith(tenantDir + sep)).toBe(true);
    expect(abs.endsWith(sep + 'shadow')).toBe(true);
  });

  it('leerer Pfad -> null', () => {
    expect(resolveShowcaseFile('TENANT-A', '', CWD)).toBeNull();
  });

  it('verschiedene Tenants liefern verschiedene Ordner (Isolation)', () => {
    const a = resolveShowcaseFile('TENANT-A', 'x.webp', CWD)!;
    const b = resolveShowcaseFile('TENANT-B', 'x.webp', CWD)!;
    expect(a).not.toEqual(b);
  });
});
