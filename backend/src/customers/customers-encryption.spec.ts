import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { isEncrypted, resetEncryptionKeyCache } from '../common/crypto/encryption';

/**
 * REAL-DB-Integration (In-Memory-SQLite) fuer die Feld-Verschluesselung der
 * sensiblen Kunden-Adressfelder (notes/street/postalCode). Bewusst KEIN Mock:
 * nur ein echter Repository-Round-trip beweist, dass der ValueTransformer korrekt
 * an der Entity haengt (Schreiben -> Chiffretext, Lesen -> Klartext) UND dass
 * markerloser Altbestand OHNE Migration verlustfrei weiterlebt.
 *
 * WICHTIG: firstName/lastName/companyName/email/phone/mobile/city bleiben
 * UNVERSCHLUESSELT (Kundensuche via LIKE). Das wird hier mitgeprueft, damit eine
 * versehentliche Verschluesselung dieser Felder auffliegt.
 */
describe('Customer · Feld-Verschluesselung (Real-DB)', () => {
  let ds: DataSource;
  let repo: Repository<Customer>;

  beforeAll(async () => {
    process.env.DATA_ENC_KEY = 'a'.repeat(64); // deterministischer Test-Key
    resetEncryptionKeyCache();
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Customer],
    });
    await ds.initialize();
    repo = ds.getRepository(Customer);
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    delete process.env.DATA_ENC_KEY;
    resetEncryptionKeyCache();
  });

  beforeEach(async () => {
    await ds.synchronize(true); // frisches Schema je Test
  });

  /** Roh-Wert direkt aus der DB-Spalte lesen (umgeht den Transformer). */
  async function rohSpalte(id: string, spalte: string): Promise<string | null> {
    const rows = await ds.query(`SELECT "${spalte}" AS w FROM customers WHERE id = ?`, [id]);
    return rows[0]?.w ?? null;
  }

  // (a) WICHTIGSTER TEST: Altbestand (markerloser Klartext) bleibt nach dem
  // Einschalten der Verschluesselung unveraendert lesbar -> KEIN Datenverlust.
  it('(a) Altbestand-Klartext in notes/street/postalCode wird unveraendert gelesen', async () => {
    // Zeile anlegen und die Spalten per RAW-SQL mit Klartext OHNE Marker
    // ueberschreiben – exakt der Zustand vor der Umstellung.
    const c = await repo.save(repo.create({ tenantId: 'T1', lastName: 'Muster' }));
    await ds.query(
      'UPDATE customers SET notes = ?, street = ?, "postalCode" = ? WHERE id = ?',
      ['Kunde zahlt bar', 'Altstraße 7', '10115', c.id],
    );

    // Spalten enthalten wirklich Klartext (kein Marker) ...
    expect(isEncrypted(await rohSpalte(c.id, 'notes'))).toBe(false);
    expect(isEncrypted(await rohSpalte(c.id, 'street'))).toBe(false);

    // ... und werden ueber das Repository verlustfrei zurueckgegeben.
    const geladen = await repo.findOneOrFail({ where: { id: c.id } });
    expect(geladen.notes).toBe('Kunde zahlt bar');
    expect(geladen.street).toBe('Altstraße 7');
    expect(geladen.postalCode).toBe('10115');
  });

  // (b) Neu geschriebene Werte liegen VERSCHLUESSELT in der DB und lesen sich
  // korrekt zurueck.
  it('(b) Neu geschriebene Werte liegen als Chiffretext vor, lesen sich korrekt zurueck', async () => {
    const c = await repo.save(
      repo.create({
        tenantId: 'T1',
        lastName: 'Geheim',
        city: 'Berlin', // NICHT verschluesselt
        notes: 'VIP – Rabatt 10%',
        street: 'Musterstraße 12a',
        postalCode: '80331',
      }),
    );

    // Raw-Spalten: die drei sensiblen Felder tragen den Marker und NICHT den Klartext.
    const rohNotes = await rohSpalte(c.id, 'notes');
    const rohStreet = await rohSpalte(c.id, 'street');
    const rohPlz = await rohSpalte(c.id, 'postalCode');
    expect(isEncrypted(rohNotes)).toBe(true);
    expect(isEncrypted(rohStreet)).toBe(true);
    expect(isEncrypted(rohPlz)).toBe(true);
    expect(rohNotes).not.toContain('Rabatt');
    expect(rohStreet).not.toContain('Musterstraße');

    // city bleibt Klartext (nicht verschluesselt) – sonst waere die Suche kaputt.
    expect(await rohSpalte(c.id, 'city')).toBe('Berlin');
    expect(isEncrypted(await rohSpalte(c.id, 'lastName'))).toBe(false);

    // Repository-Read liefert die Klartexte zurueck.
    const geladen = await repo.findOneOrFail({ where: { id: c.id } });
    expect(geladen.notes).toBe('VIP – Rabatt 10%');
    expect(geladen.street).toBe('Musterstraße 12a');
    expect(geladen.postalCode).toBe('80331');
    expect(geladen.city).toBe('Berlin');
  });

  // Laengen-Nachweis: selbst ein maximal langer street-Wert (CSV-Cap MAX_FELD=255)
  // passt verschluesselt in die vorhandene (unbegrenzte) `character varying`-Spalte
  // und round-trippt. Beweist konkret, dass KEINE Schema-Aenderung noetig ist.
  it('langer street-Wert (255 Zeichen) round-trippt verschluesselt', async () => {
    const lang = 'S'.repeat(255);
    const c = await repo.save(repo.create({ tenantId: 'T1', lastName: 'Lang', street: lang }));
    const roh = await rohSpalte(c.id, 'street');
    expect(isEncrypted(roh)).toBe(true);
    // 7 (Marker) + 4*ceil((28+255)/3) = 7 + 380 = 387 Zeichen Chiffretext.
    expect((roh as string).length).toBe(387);
    const geladen = await repo.findOneOrFail({ where: { id: c.id } });
    expect(geladen.street).toBe(lang);
  });
});
