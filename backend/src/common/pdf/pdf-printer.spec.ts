import { createRobotoPrinter, renderPdf } from './pdf-printer';

/**
 * Gemeinsamer PDF-Helfer (aus der 3-fach-Duplikation extrahiert). Diese Tests
 * belegen, dass der Printer die Roboto-Fonts registriert und renderPdf einen
 * echten, nicht-leeren PDF-Buffer liefert (%PDF-Header). pdfmake ist pure JS,
 * daher ohne DB/nativen Treiber im Jest-Lauf renderbar.
 */
describe('pdf-printer (gemeinsamer Helfer)', () => {
  it('createRobotoPrinter registriert alle vier Roboto-Varianten', () => {
    const printer = createRobotoPrinter();
    expect(printer).toBeDefined();
    const roboto = printer.fontDescriptors?.Roboto;
    expect(roboto).toBeDefined();
    expect(roboto.normal).toContain('Roboto-Regular.ttf');
    expect(roboto.bold).toContain('Roboto-Medium.ttf');
    expect(roboto.italics).toContain('Roboto-Italic.ttf');
    expect(roboto.bolditalics).toContain('Roboto-MediumItalic.ttf');
  });

  it('renderPdf liefert einen nicht-leeren PDF-Buffer mit %PDF-Header', async () => {
    const printer = createRobotoPrinter();
    const buffer = await renderPdf(printer, {
      content: [{ text: 'Detailly Test – Umlaute äöü und Euro €' }],
      defaultStyle: { font: 'Roboto' },
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(400);
    // PDF-Signatur am Dateianfang.
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
