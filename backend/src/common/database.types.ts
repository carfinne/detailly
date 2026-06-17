/**
 * Datenbank-Kompatibilitaet zwischen SQLite (Demo) und PostgreSQL (Produktion).
 *
 * SQLite kennt weder den `enum`- noch den `jsonb`-Spaltentyp und auch kein
 * `timestamptz`. Damit dieselben Entities auf beiden Treibern laufen, mappen
 * wir die kritischen Spaltentypen anhand der ENV-Variable `DB_TYPE`.
 */
export const isSqlite = (): boolean =>
  (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'sqlite';

/** Enum-Spalten: Postgres `enum`, SQLite `simple-enum` (intern varchar). */
export const enumColumnType = (): 'enum' | 'simple-enum' =>
  isSqlite() ? 'simple-enum' : 'enum';

/** JSON-Spalten: Postgres `jsonb`, SQLite `simple-json` (intern text). */
export const jsonColumnType = (): 'jsonb' | 'simple-json' =>
  isSqlite() ? 'simple-json' : 'jsonb';

/** Zeitstempel mit Zeitzone: Postgres `timestamptz`, SQLite `datetime`. */
export const timestampColumnType = (): 'timestamptz' | 'datetime' =>
  isSqlite() ? 'datetime' : 'timestamptz';

/** Dezimalspalten verhalten sich gleich, hier zentral fuer evtl. Anpassungen. */
export const decimalColumnType = (): 'decimal' => 'decimal';
