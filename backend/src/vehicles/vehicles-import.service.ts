import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CsvDaten, HochgeladeneDatei } from '../common/csv/csv-parse';
import { ImportBericht, ImportZeile, ImportZeilenStatus } from '../common/csv/import-bericht';
import { MAX_FELD, MAX_NOTIZ, parseImportDatei, putzWert } from '../common/csv/import-helpers';
import { ImportOptionenDto } from '../customers/dto/import.dto';

/**
 * CSV-Import fuer Fahrzeuge (T-007). Gleiches Preview/Commit-Muster wie der
 * Kunden-Import; die Kunden-Zuordnung laeuft ueber die Spalte "KundeEmail"
 * (der Betrieb importiert also erst Kunden, dann Fahrzeuge).
 *
 * Mandantentrennung: gematcht wird ausschliesslich gegen AKTIVE Kunden des
 * EIGENEN Betriebs – eine fremde customerId kann nie entstehen, weil die
 * Zuordnung serverseitig aus der E-Mail aufgeloest wird.
 *
 * Kein Tarif-Limit: fuer Fahrzeuge existiert keines (nur maxUsers/maxLocations/
 * maxCustomers, siehe plan-entitlements.ts). Duplikate (gleicher Kunde +
 * gleiches Kennzeichen bzw. gleiche VIN) werden uebersprungen – ein "update"
 * gibt es hier bewusst nicht (Fahrzeuge aendern sich ueber die Fahrzeugakte).
 */

const SPALTEN: Record<string, string> = {
  kundeemail: '__kundeEmail', 'kunde-email': '__kundeEmail', kundenemail: '__kundeEmail',
  kunde: '__kundeEmail', email: '__kundeEmail', 'e-mail': '__kundeEmail',
  marke: 'make', hersteller: 'make', make: 'make',
  modell: 'model', model: 'model',
  variante: 'variant', variant: 'variant',
  baujahr: '__jahr', jahr: '__jahr', year: '__jahr',
  farbe: 'color', color: 'color',
  kennzeichen: 'licensePlate', nummernschild: 'licensePlate',
  licenseplate: 'licensePlate', 'license-plate': 'licensePlate',
  vin: 'vin', fin: 'vin', fahrgestellnummer: 'vin',
  notiz: 'notes', notizen: 'notes', bemerkung: 'notes', notes: 'notes',
};

/** Kennzeichen/VIN fuer den Duplikat-Vergleich normalisieren. */
function normKennung(roh: string): string {
  return (roh || '').replace(/[\s-]+/g, '').toUpperCase();
}

interface GeplanteZeile extends ImportZeile {
  daten?: Record<string, string | number>;
}

@Injectable()
export class VehiclesImportService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly audit: AuditService,
  ) {}

  async importCsv(
    user: AuthUser,
    datei: HochgeladeneDatei,
    optionen: ImportOptionenDto,
  ): Promise<ImportBericht> {
    const modus = optionen.mode === 'commit' ? 'commit' : 'preview';

    const csv: CsvDaten = parseImportDatei(datei);

    const zuordnung: (string | null)[] = csv.header.map((h) => SPALTEN[h] ?? null);
    const ignorierteSpalten = [
      ...new Set(csv.headerOriginal.filter((_, i) => zuordnung[i] === null && csv.headerOriginal[i] !== '')),
    ];
    const erkannte = new Set(zuordnung.filter(Boolean) as string[]);
    for (const [pflicht, label] of [
      ['__kundeEmail', 'KundeEmail'],
      ['make', 'Marke'],
      ['model', 'Modell'],
    ] as const) {
      if (!erkannte.has(pflicht)) {
        throw new BadRequestException(
          `Pflichtspalte "${label}" fehlt in der Kopfzeile. Erwartet werden: KundeEmail, Marke, Modell ` +
            '(optional: Kennzeichen, VIN, Baujahr, Farbe, Variante, Notiz).',
        );
      }
    }

    // Kunden-Zuordnung: aktive Kunden mit E-Mail, tenant-scoped.
    const kunden = await this.customerRepo.find({
      where: { tenantId: user.tenantId, isActive: true },
      select: ['id', 'email'],
    });
    const kundeProEmail = new Map<string, string[]>();
    for (const kunde of kunden) {
      const email = kunde.email?.trim().toLowerCase();
      if (!email) continue;
      const liste = kundeProEmail.get(email) ?? [];
      liste.push(kunde.id);
      kundeProEmail.set(email, liste);
    }

    // Bestehende Fahrzeuge fuer den Duplikat-Abgleich (Soft-Delete bleibt aussen vor).
    const bestand = await this.repo.find({ select: ['id', 'customerId', 'licensePlate', 'vin'], where: { tenantId: user.tenantId } });
    const vorhanden = new Set<string>();
    for (const fahrzeug of bestand) {
      const kennzeichen = normKennung(fahrzeug.licensePlate);
      const vin = normKennung(fahrzeug.vin);
      if (kennzeichen) vorhanden.add(`${fahrzeug.customerId}|kz:${kennzeichen}`);
      if (vin) vorhanden.add(`${fahrzeug.customerId}|vin:${vin}`);
    }

    const geplant: GeplanteZeile[] = [];
    const inDatei = new Set<string>();
    for (const zeile of csv.zeilen) {
      geplant.push(this.klassifiziere(zeile, zuordnung, kundeProEmail, vorhanden, inDatei));
    }

    if (modus === 'commit') {
      await this.repo.manager.transaction(async (em) => {
        for (const zeile of geplant) {
          if (zeile.status === 'neu' && zeile.daten) {
            await em.save(em.create(Vehicle, { ...zeile.daten, tenantId: user.tenantId }));
          }
        }
      });
    }

    const zaehle = (status: ImportZeilenStatus) => geplant.filter((z) => z.status === status).length;
    const bericht: ImportBericht = {
      modus,
      encoding: csv.encoding,
      trennzeichen: csv.trennzeichen,
      gesamt: geplant.length,
      neu: zaehle('neu'),
      aktualisiert: 0,
      uebersprungen: zaehle('uebersprungen'),
      fehler: zaehle('fehler'),
      ignorierteSpalten,
      zeilen: geplant.map(({ zeile, name, status, hinweis }) => ({
        zeile,
        name,
        status,
        ...(hinweis ? { hinweis } : {}),
      })),
    };

    if (modus === 'commit') {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'vehicle.import',
        entityType: 'Vehicle',
        // Nur Zaehlwerte protokollieren (kein Dateiname – kann PII tragen).
        payload: {
          gesamt: bericht.gesamt,
          neu: bericht.neu,
          uebersprungen: bericht.uebersprungen,
          fehler: bericht.fehler,
        },
      });
    }
    return bericht;
  }

  private klassifiziere(
    zeile: { nr: number; felder: string[] },
    zuordnung: (string | null)[],
    kundeProEmail: Map<string, string[]>,
    vorhanden: Set<string>,
    inDatei: Set<string>,
  ): GeplanteZeile {
    const werte: Record<string, string> = {};
    let kundeEmail = '';
    let jahrRoh = '';
    for (let i = 0; i < zuordnung.length; i++) {
      const ziel = zuordnung[i];
      if (!ziel) continue;
      const roh = zeile.felder[i] ?? '';
      if (ziel === '__kundeEmail') {
        if (roh.trim()) kundeEmail = roh.trim().toLowerCase();
      } else if (ziel === '__jahr') {
        if (roh.trim()) jahrRoh = roh.trim();
      } else {
        const wert = putzWert(roh, ziel === 'notes' ? MAX_NOTIZ : MAX_FELD);
        if (wert) werte[ziel] = wert;
      }
    }

    const anzeigeName =
      [werte.make, werte.model].filter(Boolean).join(' ') +
      (werte.licensePlate ? ` (${werte.licensePlate})` : '');
    const fertig = (status: ImportZeilenStatus, hinweis?: string, rest?: Partial<GeplanteZeile>): GeplanteZeile => ({
      zeile: zeile.nr,
      name: anzeigeName || `Zeile ${zeile.nr}`,
      status,
      ...(hinweis ? { hinweis } : {}),
      ...rest,
    });

    if (!kundeEmail) return fertig('fehler', 'Kunden-E-Mail fehlt (Spalte KundeEmail)');
    if (!werte.make) return fertig('fehler', 'Marke fehlt');
    if (!werte.model) return fertig('fehler', 'Modell fehlt');

    // Baujahr (optional): unplausible Werte lieber melden als still verwerfen.
    let jahr: number | undefined;
    if (jahrRoh) {
      jahr = Number.parseInt(jahrRoh, 10);
      if (!Number.isInteger(jahr) || jahr < 1900 || jahr > 2100) {
        return fertig('fehler', `Unplausibles Baujahr "${jahrRoh}"`);
      }
    }

    // Kunden-Zuordnung ueber E-Mail (nur eigener Betrieb, nur aktive Kunden).
    const kundenIds = kundeProEmail.get(kundeEmail) ?? [];
    if (kundenIds.length === 0) {
      return fertig('fehler', `Kein Kunde mit E-Mail "${kundeEmail}" gefunden – bitte zuerst Kunden importieren`);
    }
    if (kundenIds.length > 1) {
      return fertig('fehler', `E-Mail "${kundeEmail}" ist nicht eindeutig (${kundenIds.length} Kunden)`);
    }
    const customerId = kundenIds[0];

    // Duplikate: gleicher Kunde + gleiches Kennzeichen ODER gleiche VIN.
    const schluessel: string[] = [];
    const kennzeichen = normKennung(werte.licensePlate ?? '');
    const vin = normKennung(werte.vin ?? '');
    if (kennzeichen) schluessel.push(`${customerId}|kz:${kennzeichen}`);
    if (vin) schluessel.push(`${customerId}|vin:${vin}`);
    if (schluessel.some((s) => vorhanden.has(s))) {
      return fertig('uebersprungen', 'Fahrzeug existiert bereits (Kennzeichen/VIN)');
    }
    if (schluessel.some((s) => inDatei.has(s))) {
      return fertig('uebersprungen', 'Doppelt in der Datei (Kennzeichen/VIN)');
    }
    for (const s of schluessel) inDatei.add(s);

    const daten: Record<string, string | number> = { ...werte, customerId };
    if (jahr !== undefined) daten.year = jahr;
    return fertig('neu', undefined, { daten });
  }
}
