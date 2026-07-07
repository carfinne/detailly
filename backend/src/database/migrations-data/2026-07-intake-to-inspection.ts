/**
 * EINMALIGER Daten-Umzug: `vehicle_intakes` -> `damage_inspections` + `damage_items`.
 *
 * Aufruf:  ts-node -r tsconfig-paths/register \
 *            src/database/migrations-data/2026-07-intake-to-inspection.ts
 *          (Postgres: DB_TYPE=postgres + DB_* setzen; Dev-Default: SQLite `detailly.db`)
 *
 * BEWUSST KEIN TypeORM-Schema-Migrationsskript: ein reiner, idempotenter Datenumzug,
 * der VOR der Intake-Abloesung und VOR der Baseline (P3-8) einmalig laeuft. Er liest
 * `vehicle_intakes` per rohem SQL (nicht ueber die VehicleIntake-Entity), damit das
 * Skript auch NACH der Loeschung des Intake-Moduls noch kompiliert und lauffaehig ist.
 *
 * Sicherheit / REVIEW §3:
 *  - Tenant-scoped je Zeile: `tenantId` wird 1:1 aus der Quellzeile uebernommen,
 *    NIE aus einer Fremdquelle. Alle Inserts tragen die tenantId der Quellzeile.
 *  - (a) ALLE Zielwerte EXPLIZIT setzen: inspection.status='abgeschlossen', typ='annahme';
 *    item.positionMode='2d', origin='neu', status='offen'. Nie auf Entity-Defaults verlassen.
 *  - (b) art/schweregrad gegen die Enums validieren, unbekannte -> sonstiges/mittel,
 *    Original in notiz protokollieren (siehe intake-marker-mapping.ts).
 *  - (c) Waisen-Schutz: existiert customerId (tenant-scoped) nicht mehr in `customers`,
 *    wird der Intake UEBERSPRUNGEN + als "uebersprungen (Kunde fehlt)" protokolliert.
 *  - (d) Idempotenz ueber clientUuid='intake:<id>' (Inspektion) bzw.
 *    'intake:<id>:<markerId>' (Item); vor jedem Insert per SELECT geprueft. Das Skript
 *    ist strikt SEQUENTIELL und als SINGLE-INSTANCE auszufuehren (kein Parallellauf) –
 *    die Idempotenz ist SELECT-dann-INSERT ohne DB-Unique-Constraint.
 *
 * Das Skript schreibt NUR neue Zeilen und aendert/loescht `vehicle_intakes` NICHT.
 * Rollback = Inspektionen mit clientUuid LIKE 'intake:%' loeschen; Alt-Tabelle bleibt.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from '../data-source-options';
import { DamageInspection } from '../../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../../inspection/entities/damage-item.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Customer } from '../../customers/entities/customer.entity';
import {
  IntakeMarker,
  inspectionClientUuid,
  itemClientUuid,
  mapMarkerToDamageItemFields,
} from './intake-marker-mapping';

dotenv.config();

/** Roh gelesene `vehicle_intakes`-Zeile (nur die benoetigten Spalten). */
interface IntakeRow {
  id: string;
  tenantId: string;
  customerId: string;
  vehicleId: string | null;
  orderId: string | null;
  kmStand: number | null;
  tankstand: number | null;
  marker: unknown; // SQLite: JSON-String, Postgres: bereits geparstes Array
  notiz: string | null;
  createdAt: Date | string | null;
}

/** Ergebnis-Bericht des Laufs (auch fuer Tests/Logging). */
export interface MigrationReport {
  intakesGesamt: number;
  inspektionenErstellt: number;
  inspektionenUebersprungenVorhanden: number;
  intakesUebersprungenKundeFehlt: number;
  markerGesamt: number;
  itemsErstellt: number;
  itemsUebersprungenVorhanden: number;
  itemsGemappt: number; // art/schweregrad auf Fallback gemappt
}

/** Parst die marker-Spalte robust ueber beide Treiber (String vs. Objekt). */
function parseMarker(raw: unknown): IntakeMarker[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as IntakeMarker[];
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as IntakeMarker[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Fuehrt den Umzug ueber eine bereits initialisierte DataSource aus.
 * Getrennt vom CLI-Bootstrap, damit er (theoretisch) auch programmatisch/testbar
 * aufrufbar ist. Verbindung wird NICHT geschlossen.
 */
export async function migrateIntakesToInspections(
  dataSource: DataSource,
): Promise<MigrationReport> {
  const inspectionRepo = dataSource.getRepository(DamageInspection);
  const itemRepo = dataSource.getRepository(DamageItem);
  const auditRepo = dataSource.getRepository(AuditLog);
  const customerRepo = dataSource.getRepository(Customer);

  const report: MigrationReport = {
    intakesGesamt: 0,
    inspektionenErstellt: 0,
    inspektionenUebersprungenVorhanden: 0,
    intakesUebersprungenKundeFehlt: 0,
    markerGesamt: 0,
    itemsErstellt: 0,
    itemsUebersprungenVorhanden: 0,
    itemsGemappt: 0,
  };

  // `vehicle_intakes` per rohem SQL lesen (Entity ist nach der Abloesung weg).
  // Aeltere zuerst, damit die Reihenfolge deterministisch/nachvollziehbar ist.
  const intakes: IntakeRow[] = await dataSource.query(
    'SELECT id, "tenantId", "customerId", "vehicleId", "orderId", ' +
      '"kmStand", "tankstand", marker, notiz, "createdAt" ' +
      'FROM vehicle_intakes ORDER BY "createdAt" ASC',
  );
  report.intakesGesamt = intakes.length;

  for (const intake of intakes) {
    const tenantId = intake.tenantId;
    const inspUuid = inspectionClientUuid(intake.id);

    // (c) Waisen-Schutz: Kunde muss (tenant-scoped) noch existieren.
    const kunde = await customerRepo.findOne({
      where: { id: intake.customerId, tenantId },
    });
    if (!kunde) {
      report.intakesUebersprungenKundeFehlt++;
      // eslint-disable-next-line no-console
      console.warn(
        `[skip] Intake ${intake.id} uebersprungen (Kunde ${intake.customerId} fehlt, tenant ${tenantId}).`,
      );
      continue;
    }

    // (d) Idempotenz: existiert die Inspektion zu diesem Intake schon? (tenant-scoped)
    let inspection = await inspectionRepo.findOne({
      where: { tenantId, clientUuid: inspUuid },
    });

    if (inspection) {
      report.inspektionenUebersprungenVorhanden++;
    } else {
      // (a) ALLE Zielwerte EXPLIZIT: typ='annahme', status='abgeschlossen'.
      inspection = inspectionRepo.create({
        tenantId,
        customerId: intake.customerId,
        vehicleId: intake.vehicleId ?? undefined,
        orderId: intake.orderId ?? undefined,
        typ: 'annahme',
        status: 'abgeschlossen',
        kmStand: intake.kmStand ?? undefined,
        tankstand: intake.tankstand ?? undefined,
        notiz: intake.notiz ?? undefined,
        clientUuid: inspUuid,
      });
      inspection = await inspectionRepo.save(inspection);
      report.inspektionenErstellt++;

      await auditRepo.save(
        auditRepo.create({
          tenantId,
          userId: null as unknown as string,
          action: 'migrate',
          entityType: 'DamageInspection',
          entityId: inspection.id,
          payload: { quelle: 'vehicle_intakes', intakeId: intake.id },
        }),
      );
    }

    // Marker -> DamageItems (je Marker eigener clientUuid, eigene Idempotenz).
    const marker = parseMarker(intake.marker);
    report.markerGesamt += marker.length;

    for (const m of marker) {
      // Ohne Marker-id kann keine stabile Idempotenz gebildet werden -> fallback-id
      // (deterministisch aus Position), damit ein Zweitlauf denselben Schluessel bildet.
      const markerId =
        m.id && String(m.id).length
          ? String(m.id)
          : `${m.ansicht ?? 'x'}_${m.x ?? 0}_${m.y ?? 0}`;
      const itmUuid = itemClientUuid(intake.id, markerId);

      const vorhanden = await itemRepo.findOne({
        where: { tenantId, clientUuid: itmUuid },
      });
      if (vorhanden) {
        report.itemsUebersprungenVorhanden++;
        continue;
      }

      const fields = mapMarkerToDamageItemFields(m);
      if (fields.wurdeGemappt) report.itemsGemappt++;

      const item = itemRepo.create({
        tenantId,
        inspectionId: inspection.id,
        partId: fields.partId,
        partLabel: fields.partLabel ?? undefined,
        positionMode: fields.positionMode,
        ansicht2d: fields.ansicht2d ?? undefined,
        x2d: fields.x2d ?? undefined,
        y2d: fields.y2d ?? undefined,
        origin: fields.origin,
        art: fields.art,
        schweregrad: fields.schweregrad,
        status: fields.status,
        notiz: fields.notiz ?? undefined,
        clientUuid: itmUuid,
      });
      await itemRepo.save(item);
      report.itemsErstellt++;
    }
  }

  return report;
}

/** CLI-Bootstrap: DataSource oeffnen, Umzug fahren, Bericht ausgeben, schliessen. */
async function main(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  try {
    // eslint-disable-next-line no-console
    console.log('Intake -> Inspection Umzug startet (idempotent, tenant-scoped)...');
    const report = await migrateIntakesToInspections(dataSource);
    // eslint-disable-next-line no-console
    console.log('Umzug fertig:');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log(
      `Zusammenfassung: ${report.inspektionenErstellt} Inspektionen neu, ` +
        `${report.itemsErstellt} Schaeden neu, ` +
        `${report.inspektionenUebersprungenVorhanden} Inspektionen bereits vorhanden, ` +
        `${report.intakesUebersprungenKundeFehlt} uebersprungen (Kunde fehlt), ` +
        `${report.itemsGemappt} Schaeden mit Enum-Fallback.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

// Nur ausfuehren, wenn direkt gestartet (nicht bei Import aus einem Test).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Umzug fehlgeschlagen:', err);
    process.exit(1);
  });
}
