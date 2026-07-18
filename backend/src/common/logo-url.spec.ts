import { sanitizeLogoUrl } from './logo-url';

/**
 * Gemeinsame Logo-Whitelist fuer ALLE oeffentlichen Egress-Stellen (Tracking,
 * Uebergabe-Mappe Web+PDF, Mitgliederliste, Buchungsportal). Muss http(s) und
 * validierte Raster-data:-URLs durchlassen, aber jedes script-faehige/fremde
 * Schema (SVG, text/html, javascript:) zu null machen.
 */
describe('sanitizeLogoUrl', () => {
  it('akzeptiert absolute http(s)-URLs unveraendert', () => {
    expect(sanitizeLogoUrl('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
    expect(sanitizeLogoUrl('http://example.de/l.jpg')).toBe('http://example.de/l.jpg');
  });

  it('akzeptiert validierte data:image-Raster (png/jpeg/webp, base64)', () => {
    expect(sanitizeLogoUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(sanitizeLogoUrl('data:image/jpeg;base64,/9j/4AAQ=')).toBe('data:image/jpeg;base64,/9j/4AAQ=');
    expect(sanitizeLogoUrl('data:image/webp;base64,UklGRg==')).toBe('data:image/webp;base64,UklGRg==');
  });

  it('lehnt SVG-data-URLs ab (script-faehig -> XSS)', () => {
    expect(sanitizeLogoUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(sanitizeLogoUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull();
  });

  it('lehnt text/html, javascript: und sonstige Schemata ab', () => {
    expect(sanitizeLogoUrl('data:text/html;base64,PGgxPg==')).toBeNull();
    expect(sanitizeLogoUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeLogoUrl('data:image/png;utf8,<svg>')).toBeNull(); // kein ;base64,
    expect(sanitizeLogoUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('lehnt leere/ungueltige Eingaben ab', () => {
    expect(sanitizeLogoUrl(null)).toBeNull();
    expect(sanitizeLogoUrl(undefined)).toBeNull();
    expect(sanitizeLogoUrl('')).toBeNull();
    expect(sanitizeLogoUrl('   ')).toBeNull();
    expect(sanitizeLogoUrl('not-a-url')).toBeNull();
  });
});
