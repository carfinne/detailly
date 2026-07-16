import * as zlib from 'zlib';
import { extractEmbeddedInvoiceXml, isPdf, MAX_INFLATE_BYTES } from './pdf-embedded-xml';

/** Baut ein minimales PDF-Geruest mit EINEM stream…endstream-Block. */
function buildPdf(streamBytes: Buffer, opts: { encrypted?: boolean } = {}): Buffer {
  const trailer = opts.encrypted
    ? 'trailer\n<</Root 1 0 R /Encrypt 9 0 R>>\n%%EOF'
    : 'trailer\n<</Root 1 0 R>>\n%%EOF';
  return Buffer.concat([
    Buffer.from('%PDF-1.6\n'),
    Buffer.from('7 0 obj\n<</Type /EmbeddedFile /Filter /FlateDecode>>\nstream\n'),
    streamBytes,
    Buffer.from('\nendstream\nendobj\n'),
    Buffer.from(trailer),
  ]);
}

const CII_MIN = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument><ram:ID>HYB-1</ram:ID></rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>`;

describe('extractEmbeddedInvoiceXml', () => {
  it('extrahiert Flate-komprimiertes XML aus dem hybriden PDF', () => {
    const pdf = buildPdf(zlib.deflateSync(Buffer.from(CII_MIN)));
    const xml = extractEmbeddedInvoiceXml(pdf);
    expect(xml).toContain('CrossIndustryInvoice');
    expect(xml).toContain('HYB-1');
  });

  it('extrahiert RAW-Flate (inflateRaw-Fallback)', () => {
    const pdf = buildPdf(zlib.deflateRawSync(Buffer.from(CII_MIN)));
    expect(extractEmbeddedInvoiceXml(pdf)).toContain('CrossIndustryInvoice');
  });

  it('liest UNKOMPRIMIERTES eingebettetes XML (Klartext-Stream)', () => {
    const pdf = buildPdf(Buffer.from(CII_MIN));
    expect(extractEmbeddedInvoiceXml(pdf)).toContain('CrossIndustryInvoice');
  });

  it('kein Rechnungs-XML im PDF -> null (nur Fallback, kein Crash)', () => {
    const pdf = buildPdf(zlib.deflateSync(Buffer.from('irgendein anderer PDF-Stream-Inhalt')));
    expect(extractEmbeddedInvoiceXml(pdf)).toBeNull();
  });

  it('verschluesseltes PDF (/Encrypt) -> null', () => {
    const pdf = buildPdf(zlib.deflateSync(Buffer.from(CII_MIN)), { encrypted: true });
    expect(extractEmbeddedInvoiceXml(pdf)).toBeNull();
  });

  it('kein PDF -> null', () => {
    expect(extractEmbeddedInvoiceXml(Buffer.from(CII_MIN))).toBeNull();
    expect(extractEmbeddedInvoiceXml(Buffer.alloc(0))).toBeNull();
  });

  it('Zip-Bomb-Schutz: dekomprimierte Groesse ueber dem Limit -> null (kein OOM)', () => {
    // XML-Start + viele MB Padding -> inflate ueberschreitet maxOutputLength.
    const riesig = Buffer.concat([
      Buffer.from(CII_MIN),
      Buffer.alloc(MAX_INFLATE_BYTES + 2 * 1024 * 1024, 0x20),
    ]);
    const pdf = buildPdf(zlib.deflateSync(riesig));
    expect(extractEmbeddedInvoiceXml(pdf)).toBeNull();
  });
});

describe('isPdf', () => {
  it('erkennt %PDF-Signatur', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdf(Buffer.from('<?xml'))).toBe(false);
  });
});
