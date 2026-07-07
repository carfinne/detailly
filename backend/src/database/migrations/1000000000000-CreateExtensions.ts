import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legt die PostgreSQL-Extensions an, die das generierte Baseline-Schema
 * voraussetzt. MUSS als allererste Migration laufen: TypeORM emittiert fuer
 * jede uuid-PK (`@PrimaryGeneratedColumn('uuid')`, ~35 Tabellen) ein
 * `DEFAULT uuid_generate_v4()`, und der Abo-Backfill nutzt `gen_random_uuid()`.
 * Ohne die Extensions scheitert bereits das erste `CREATE TABLE` der Baseline.
 *
 * Der feste, absichtlich sehr fruehe Zeitstempel (1000000000000 =
 * 2001-09-09) garantiert, dass diese Migration VOR der spaeter gegen eine
 * frische Postgres-DB generierten Baseline (aktueller Zeitstempel) ausgefuehrt
 * wird. TypeORM sortiert Migrationen nach dem numerischen Praefix.
 *
 * SQLite-Dev nutzt ausschliesslich `synchronize:true` und fuehrt Migrationen
 * nie aus (`migrationsRun` ist nur bei Postgres+production true). Der
 * Dialekt-Guard macht die Migration dort zusaetzlich explizit zum No-op.
 */
export class CreateExtensions1000000000000 implements MigrationInterface {
  name = 'CreateExtensions1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      // SQLite/andere: kein Extension-Konzept -> No-op.
      return;
    }
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    // Konservativ mit IF EXISTS; andere Objekte koennten die Extension noch
    // nutzen, daher kein CASCADE.
    await queryRunner.query('DROP EXTENSION IF EXISTS pgcrypto;');
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
  }
}
