import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInseratDto, UpdateInseratStatusDto, BrowseInseratDto } from './dto/inserat.dto';

const VALID = {
  titel: 'Rupes LHR21',
  beschreibung: 'Poliermaschine, wenig genutzt',
  kategorie: 'poliermaschine',
  zustand: 'gebraucht',
  preisModus: 'fest',
  preis: 250,
  plzRegion: '20',
  ort: 'Hamburg',
  gewerblichBestaetigt: true,
};

async function errorsFor(obj: any, Dto: any = CreateInseratDto): Promise<string[]> {
  const errs = await validate(plainToInstance(Dto, obj));
  return errs.map((e) => e.property);
}

describe('CreateInseratDto · Validierung', () => {
  it('valides Inserat -> keine Fehler', async () => {
    expect(await errorsFor(VALID)).toHaveLength(0);
  });

  it('Kategorie ausserhalb der Whitelist (z. B. Chemie) -> 400 auf kategorie', async () => {
    expect(await errorsFor({ ...VALID, kategorie: 'chemie' })).toContain('kategorie');
    expect(await errorsFor({ ...VALID, kategorie: 'reinigungschemie' })).toContain('kategorie');
  });

  it('gewerblichBestaetigt=false -> 400 (muss true sein)', async () => {
    expect(await errorsFor({ ...VALID, gewerblichBestaetigt: false })).toContain('gewerblichBestaetigt');
  });

  it('gewerblichBestaetigt fehlt -> 400', async () => {
    const { gewerblichBestaetigt, ...ohne } = VALID;
    expect(await errorsFor(ohne)).toContain('gewerblichBestaetigt');
  });

  it('preisModus=fest ohne preis -> 400 auf preis (Pflicht-Konsistenz)', async () => {
    const { preis, ...ohnePreis } = VALID;
    expect(await errorsFor({ ...ohnePreis, preisModus: 'fest' })).toContain('preis');
  });

  it('preisModus=anfrage ohne preis -> OK (preis darf fehlen)', async () => {
    const { preis, ...ohnePreis } = VALID;
    expect(await errorsFor({ ...ohnePreis, preisModus: 'anfrage' })).toHaveLength(0);
  });

  it('plzRegion mit 3 Ziffern / Strasse -> 400 (nur 2-stellige Region)', async () => {
    expect(await errorsFor({ ...VALID, plzRegion: '201' })).toContain('plzRegion');
    expect(await errorsFor({ ...VALID, plzRegion: 'Hafenstr 1' })).toContain('plzRegion');
  });

  it('negativer preis -> 400', async () => {
    expect(await errorsFor({ ...VALID, preis: -5 })).toContain('preis');
  });
});

describe('UpdateInseratStatusDto · Validierung', () => {
  it.each(['aktiv', 'reserviert', 'verkauft', 'entfernt'])('erlaubt Status %s', async (status) => {
    const errs = await validate(plainToInstance(UpdateInseratStatusDto, { status }));
    expect(errs).toHaveLength(0);
  });

  it('unbekannter Status -> 400', async () => {
    const errs = await validate(plainToInstance(UpdateInseratStatusDto, { status: 'geloescht' }));
    expect(errs.map((e) => e.property)).toContain('status');
  });
});

describe('BrowseInseratDto · Validierung (Query)', () => {
  it('transformiert Query-Strings (page/limit/preis) und akzeptiert Filter', async () => {
    const dto = plainToInstance(BrowseInseratDto, {
      page: '2', limit: '10', kategorie: 'plotter', preisMin: '50', sort: 'preis_auf',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.preisMin).toBe(50);
  });

  it('unbekannter sort-Wert -> 400', async () => {
    const errs = await validate(plainToInstance(BrowseInseratDto, { sort: 'zufall' }));
    expect(errs.map((e) => e.property)).toContain('sort');
  });
});
