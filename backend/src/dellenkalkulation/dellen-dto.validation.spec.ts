import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetDellenPreismatrixDto } from './dto/dellen-preismatrix.dto';
import { SetDellenMarkerDto } from './dto/dellen-marker.dto';

/**
 * DTO-Validierung (Review-Runde 2): sichert die Schranken ab, die die
 * ValidationPipe VOR dem Service durchsetzt – @Max gegen numeric-overflow,
 * @Min(1) fuer Zuschlagsfaktoren, @ArrayMinSize/@ArrayMaxSize. Reines
 * class-validator (kein Nest-Bootstrap).
 */
describe('Dellenkalkulation-DTO-Validierung', () => {
  const validMatrix = {
    basis1Euro: 35,
    basis2Euro: 55,
    basis5Euro: 80,
    basisGolfball: 120,
    basisGroesser: 170,
    kantenFaktor: 1.5,
    aluFaktor: 1.4,
    lackschadenAufschlag: 60,
    mindestpauschale: 0,
    anfahrtspauschale: 0,
    hagelStaffel: [
      { maxDellen: 5, pauschale: 250 },
      { maxDellen: null, pauschale: 1100 },
    ],
  };

  async function fehlerFelder(cls: any, obj: unknown): Promise<string[]> {
    const errors = await validate(plainToInstance(cls, obj) as object);
    return errors.map((e) => e.property);
  }

  describe('SetDellenPreismatrixDto', () => {
    it('gueltige Matrix -> keine Fehler', async () => {
      expect(await fehlerFelder(SetDellenPreismatrixDto, validMatrix)).toEqual([]);
    });

    it('Basispreis ueber @Max -> Fehler (numeric-overflow-Schutz)', async () => {
      const felder = await fehlerFelder(SetDellenPreismatrixDto, {
        ...validMatrix,
        basis1Euro: 1_000_000_000,
      });
      expect(felder).toContain('basis1Euro');
    });

    it('Faktor 0 -> Fehler (@Min(1): Zuschlagsfaktoren sind >= 1)', async () => {
      expect(
        await fehlerFelder(SetDellenPreismatrixDto, { ...validMatrix, kantenFaktor: 0 }),
      ).toContain('kantenFaktor');
      expect(
        await fehlerFelder(SetDellenPreismatrixDto, { ...validMatrix, aluFaktor: 0 }),
      ).toContain('aluFaktor');
    });

    it('Faktor ueber @Max(10) -> Fehler', async () => {
      expect(
        await fehlerFelder(SetDellenPreismatrixDto, { ...validMatrix, aluFaktor: 50 }),
      ).toContain('aluFaktor');
    });

    it('leere Hagel-Staffel -> Fehler (@ArrayMinSize(1))', async () => {
      expect(
        await fehlerFelder(SetDellenPreismatrixDto, { ...validMatrix, hagelStaffel: [] }),
      ).toContain('hagelStaffel');
    });

    it('mehr als 20 Staffel-Stufen -> Fehler (@ArrayMaxSize(20))', async () => {
      const viele = Array.from({ length: 21 }, (_, i) => ({ maxDellen: i + 1, pauschale: 100 }));
      expect(
        await fehlerFelder(SetDellenPreismatrixDto, { ...validMatrix, hagelStaffel: viele }),
      ).toContain('hagelStaffel');
    });
  });

  describe('SetDellenMarkerDto', () => {
    const marker = { bauteil: 'tuer_vl', positionMode: '3d' };

    it('bis 500 Marker -> keine Fehler', async () => {
      const markers = Array.from({ length: 500 }, () => ({ ...marker }));
      expect(await fehlerFelder(SetDellenMarkerDto, { markers })).toEqual([]);
    });

    it('mehr als 500 Marker -> Fehler aus der Pipe (@ArrayMaxSize(500))', async () => {
      const markers = Array.from({ length: 501 }, () => ({ ...marker }));
      expect(await fehlerFelder(SetDellenMarkerDto, { markers })).toContain('markers');
    });
  });
});
