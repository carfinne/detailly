import { istBildMitMagic } from './orders.service';

/**
 * Magic-Byte-Pruefung beim Foto-Upload: die dekodierten Bytes muessen wirklich
 * zum behaupteten Bildtyp passen (Schutz vor Content-Type-Spoofing / Sniff-XSS).
 */
describe('istBildMitMagic', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const gif = Buffer.from('GIF89a' + '\0'.repeat(6), 'binary');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
  const html = Buffer.from('<html><script>alert(1)</script></html>');

  it('akzeptiert echte Bild-Header', () => {
    expect(istBildMitMagic(png, 'png')).toBe(true);
    expect(istBildMitMagic(jpg, 'jpg')).toBe(true);
    expect(istBildMitMagic(gif, 'gif')).toBe(true);
    expect(istBildMitMagic(webp, 'webp')).toBe(true);
  });

  it('lehnt Inhalt ab, der nicht zum behaupteten Typ passt', () => {
    expect(istBildMitMagic(png, 'jpg')).toBe(false); // PNG-Bytes als JPG deklariert
    expect(istBildMitMagic(html, 'png')).toBe(false); // HTML als PNG
    expect(istBildMitMagic(webp, 'gif')).toBe(false);
  });

  it('lehnt zu kurze/unbekannte Eingaben ab', () => {
    expect(istBildMitMagic(Buffer.from([0x89, 0x50]), 'png')).toBe(false);
    expect(istBildMitMagic(png, 'bmp')).toBe(false);
  });
});
