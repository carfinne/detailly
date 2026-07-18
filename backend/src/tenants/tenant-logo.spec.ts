import { BadRequestException } from '@nestjs/common';
import { TenantsService, erkenneLogoTyp, MAX_LOGO_BYTES } from './tenants.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * "Dein Look" – Logo-Upload (POST/DELETE /tenants/me/logo).
 *
 * Deckt ab:
 *  - Magic-Byte-Pruefung (erkenneLogoTyp): akzeptiert NUR Raster PNG/JPEG/WebP,
 *    lehnt SVG (Inline-XSS-Risiko), GIF, Nicht-Bilder und zu kurze Eingaben ab.
 *  - Service (setLogo/removeLogo): Groessenlimit, Typ-Reject, Normalisierung zur
 *    data:-URL, Zuruecksetzen auf null. tenantId stammt IMMER aus dem Actor.
 */

// --- Testdaten: minimale, gueltige/ungueltige Magic-Byte-Header ---------------
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
const GIF = Buffer.from('GIF89a' + '\0'.repeat(6), 'binary');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('erkenneLogoTyp – Magic-Byte-Pruefung', () => {
  it('akzeptiert echte Raster-Header (PNG/JPEG/WebP) mit korrekter Subtype', () => {
    expect(erkenneLogoTyp(PNG)).toBe('png');
    expect(erkenneLogoTyp(JPEG)).toBe('jpeg');
    expect(erkenneLogoTyp(WEBP)).toBe('webp');
  });

  it('lehnt SVG ab (Inline-data:-URL waere XSS-faehig)', () => {
    expect(erkenneLogoTyp(SVG)).toBeNull();
  });

  it('lehnt GIF und Nicht-Bilder ab', () => {
    expect(erkenneLogoTyp(GIF)).toBeNull();
    expect(erkenneLogoTyp(HTML)).toBeNull();
  });

  it('lehnt zu kurze Eingaben ab', () => {
    expect(erkenneLogoTyp(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(erkenneLogoTyp(Buffer.alloc(0))).toBeNull();
  });
});

describe('TenantsService – setLogo / removeLogo', () => {
  let stored: any;
  let tenantRepo: { findOne: jest.Mock; save: jest.Mock };
  let sevdesk: { loadToken: jest.Mock };
  let mail: { loadSmtpPassword: jest.Mock; invalidateTenant: jest.Mock };
  let audit: { log: jest.Mock };
  let svc: TenantsService;

  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  beforeEach(() => {
    stored = { id: 't1', name: 'Betrieb', country: 'DE', settings: {}, logoUrl: null };
    tenantRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      save: jest.fn().mockImplementation((t: any) => Promise.resolve(t)),
    };
    sevdesk = { loadToken: jest.fn().mockResolvedValue(null) };
    mail = { loadSmtpPassword: jest.fn().mockResolvedValue(null), invalidateTenant: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    svc = new TenantsService(
      {} as any, // DataSource
      tenantRepo as any,
      {} as any, // AuthService
      audit as any,
      mail as any,
      sevdesk as any,
      {} as any, // SubscriptionsService
    );
  });

  it('speichert ein gueltiges PNG als data:-URL und liefert es im Profil zurueck', async () => {
    const profile = await svc.setLogo(user, { buffer: PNG });
    expect(stored.logoUrl).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
    expect(profile.logoUrl).toBe(stored.logoUrl);
    expect(tenantRepo.save).toHaveBeenCalled();
    // Audit protokolliert nur Typ/Groesse – nie die Bytes.
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', action: 'tenant.set_logo' }),
    );
  });

  it('lehnt eine SVG-Datei ab (Magic-Byte-Reject -> 400)', async () => {
    await expect(svc.setLogo(user, { buffer: SVG })).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantRepo.save).not.toHaveBeenCalled();
  });

  it('lehnt Inhalte ab, deren Bytes zu keinem erlaubten Bild passen', async () => {
    await expect(svc.setLogo(user, { buffer: HTML })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setLogo(user, { buffer: GIF })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lehnt fehlende/leere Dateien ab', async () => {
    await expect(svc.setLogo(user, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setLogo(user, { buffer: Buffer.alloc(0) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lehnt zu grosse Dateien ab (> 512 KB)', async () => {
    // Gueltiger PNG-Header, aber ueber dem Limit aufgeblaeht.
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES + 1)]);
    await expect(svc.setLogo(user, { buffer: big })).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantRepo.save).not.toHaveBeenCalled();
  });

  it('removeLogo setzt logoUrl auf null zurueck', async () => {
    stored.logoUrl = `data:image/png;base64,${PNG.toString('base64')}`;
    const profile = await svc.removeLogo(user);
    expect(stored.logoUrl).toBeNull();
    expect(profile.logoUrl).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', action: 'tenant.remove_logo' }),
    );
  });
});
