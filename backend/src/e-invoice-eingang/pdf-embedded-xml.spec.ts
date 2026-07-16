import * as zlib from 'zlib';
import {
  extractEmbeddedInvoiceXml,
  isPdf,
  MAX_STREAM_INFLATE_BYTES,
  MAX_PDF_STREAMS,
} from './pdf-embedded-xml';

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

/** Baut ein PDF mit VIELEN stream…endstream-Bloecken (je gleicher Inhalt). */
function buildMultiStreamPdf(block: Buffer, count: number): Buffer {
  const teile: Buffer[] = [Buffer.from('%PDF-1.6\n')];
  for (let i = 0; i < count; i++) {
    teile.push(Buffer.from(`${i} 0 obj\n<</Filter /FlateDecode>>\nstream\n`));
    teile.push(block);
    teile.push(Buffer.from('\nendstream\nendobj\n'));
  }
  teile.push(Buffer.from('trailer\n<</Root 1 0 R>>\n%%EOF'));
  return Buffer.concat(teile);
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
      Buffer.alloc(MAX_STREAM_INFLATE_BYTES + 2 * 1024 * 1024, 0x20),
    ]);
    const pdf = buildPdf(zlib.deflateSync(riesig));
    expect(extractEmbeddedInvoiceXml(pdf)).toBeNull();
  });
});

describe('extractEmbeddedInvoiceXml – DoS-Haertung (kein Event-Loop-Freeze)', () => {
  it('viele kleine Nicht-Rechnungs-Streams (> MAX_PDF_STREAMS) -> schnell null', () => {
    // Weit mehr Bloecke als die Grenze; Blockzahl-Deckel muss greifen.
    const block = zlib.deflateSync(Buffer.from('x'.repeat(2048)));
    const pdf = buildMultiStreamPdf(block, MAX_PDF_STREAMS * 3);
    const t0 = Date.now();
    const res = extractEmbeddedInvoiceXml(pdf);
    const dt = Date.now() - t0;
    expect(res).toBeNull();
    expect(dt).toBeLessThan(2000); // kein Sekunden-Hang (Repro war ~30 s)
  });

  it('viele hochkomprimierte grosse Streams -> aggregiertes Budget stoppt schnell', () => {
    // Jeder Stream entpackt zu ~2 MB Nullen -> nach wenigen Streams ist das
    // aggregierte Budget (MAX_TOTAL_INFLATE_BYTES) erschoepft.
    const block = zlib.deflateSync(Buffer.alloc(2 * 1024 * 1024, 0));
    const pdf = buildMultiStreamPdf(block, 200);
    const t0 = Date.now();
    const res = extractEmbeddedInvoiceXml(pdf);
    const dt = Date.now() - t0;
    expect(res).toBeNull();
    expect(dt).toBeLessThan(2000);
  });

  it('legitime Rechnung wird trotz Haertung weiterhin extrahiert', () => {
    const pdf = buildPdf(zlib.deflateSync(Buffer.from(CII_MIN)));
    expect(extractEmbeddedInvoiceXml(pdf)).toContain('CrossIndustryInvoice');
  });
});

describe('isPdf', () => {
  it('erkennt %PDF-Signatur', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdf(Buffer.from('<?xml'))).toBe(false);
  });
});
