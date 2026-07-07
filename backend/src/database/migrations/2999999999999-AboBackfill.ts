import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Abo-Backfill fuer Bestands-Tenants (Paket P3-8, Plan B3 / REVIEW §2).
 *
 * ⚠️ MUSS gegen eine frische Postgres-Instanz im Runbook-Schritt verifiziert
 *    werden (docs/RUNBOOK_P3-8_BASELINE.md). Diese Migration wurde ohne echten
 *    PG-Lauf geschrieben; das SQL ist reines Postgres (gen_random_uuid, now()).
 *
 * Zweck: Das Zugriffsmodell erwartet pro Tenant genau eine `subscriptions`-Zeile
 * (`subscriptions.tenantId` ist UNIQUE). Sobald die fail-closed-Abo-Sperre
 * scharf ist, liefert jeder Tenant OHNE Zeile `access='blocked'`. Dieser
 * Backfill legt fuer jeden Tenant ohne Abo genau eine Default-Zeile an:
 *   planId  = NULL      (kein Tarif -> keine Scheinbindung, kein Zahlanspruch)
 *   status  = 'trial'   (fail-open: TRIAL ohne trialEndsAt = Vollzugriff)
 *   KEIN trialEndsAt    (NULL -> evaluateSubscription() sperrt NICHT)
 * So wird kein Bestandsbetrieb ausgesperrt.
 *
 * Idempotenz: `INSERT ... SELECT ... WHERE NOT EXISTS` respektiert das
 * UNIQUE(tenantId) und ist beliebig oft wiederholbar. Neue Tenants aus dem
 * Registrierungspfad (die bereits eine TRIAL-Zeile erhalten) werden dadurch
 * ebenfalls nicht doppelt bespielt.
 *
 * Fester ferner Zeitstempel (2999999999999): garantiert Lauf NACH der Baseline
 * (die bei Generierung einen aktuellen Zeitstempel zwischen 1000000000000 und
 * dieser Zahl bekommt). Ohne die Tabelle `subscriptions` wuerde dieser INSERT
 * sonst scheitern.
 *
 * SQLite-Dev fuehrt Migrationen nie aus (synchronize-only). Der Dialekt-Guard
 * macht die Migration dort explizit zum No-op.
 */
export class AboBackfill2999999999999 implements MigrationInterface {
  name = 'AboBackfill2999999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    // Alle NOT-NULL-Spalten explizit bedienen:
    //   id (uuid-PK), "tenantId" (UNIQUE), status, "cancelAtPeriodEnd",
    //   createdAt/updatedAt. planId bleibt bewusst NULL.
    await queryRunner.query(`
      INSERT INTO subscriptions
        (id, "tenantId", "planId", status, "cancelAtPeriodEnd", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), t.id, NULL, 'trial', false, now(), now()
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    // Konservativer Rollback: nur die vom Backfill erzeugten Default-Zeilen
    // entfernen (trial + planId IS NULL). Manuell zugewiesene Tarife oder
    // spaeter gebuchte Abos (planId gesetzt / anderer Status) bleiben unberuehrt.
    await queryRunner.query(`
      DELETE FROM subscriptions
      WHERE "planId" IS NULL
        AND status = 'trial';
    `);
  }
}
