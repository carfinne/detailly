import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isEmail } from 'class-validator';
import { Customer, CustomerType } from './entities/customer.entity';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { limitReachedPayload } from '../subscriptions/plan-entitlements';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CsvDaten, HochgeladeneDatei, parseCsv } from '../common/csv/csv-parse';
import { ImportBericht, ImportZeile, ImportZeilenStatus } from '../common/csv/import-bericht';
import { ImportOptionenDto } from './dto/import.dto';

/**
 * CSV-Import fuer Kunden (T-007) – die groesste Wechselhuerde fuer Betriebe mit
 * Bestandsdaten. Ablauf in zwei Schritten:
 *
 *   1. mode=preview (Default): Datei wird geparst, validiert und gegen den
 *      Bestand abgeglichen – es wird NICHTS geschrieben. Der Bericht zeigt je
 *      Zeile, was passieren wuerde (neu/aktualisiert/uebersprungen/fehler).
 *   2. mode=commit: schreibt in EINER Transaktion; fehlerhafte Zeilen werden
 *      uebersprungen und im Bericht ausgewiesen (kein Alles-oder-Nichts, der
 *      Betrieb soll 480 gute Zeilen nicht wegen 3 kaputten verlieren).
 *
 * Tarif-Limit (P3-1): NEUE Kunden zaehlen gegen maxCustomers – als BULK-Check
 * VOR dem Schreiben (aktive + neue > max -> 403 PLAN_LIMIT_REACHED). Duplikate
 * werden dabei nur gegen AKTIVE Kunden gematcht; deaktivierte/anonymisierte
 * werden nie reaktiviert (sonst liesse sich das Limit per Import umgehen).
 *
 * Bewusst OHNE sevDesk-Sync je Zeile (500 API-Calls in Serie waeren ein
 * Timeout-Risiko); der Abgleich von Bestandsdaten ist dort ein eigenes Thema.
 */

/** Spalten-Aliasse (deutsch/englisch, lowercase) -> Customer-Feld. */
const SPALTEN: Record<string, string> = {
  vorname: 'firstName', firstname: 'firstName',
  nachname: 'lastName', name: 'lastName', lastname: 'lastName',
  firma: 'companyName', firmenname: 'companyName', unternehmen: 'companyName',
  company: 'companyName', companyname: 'companyName',
  email: 'email', 'e-mail': 'email', mail: 'email',
  telefon: 'phone', telefonnummer: 'phone', phone: 'phone', tel: 'phone',
  mobil: 'mobile', handy: 'mobile', mobile: 'mobile',
  strasse: 'street', 'straße': 'street', adresse: 'street', street: 'street',
  plz: 'postalCode', postleitzahl: 'postalCode', zip: 'postalCode', postalcode: 'postalCode',
  ort: 'city', stadt: 'city', city: 'city',
  land: 'country', country: 'country',
  ustid: 'vatNumber', 'ust-id': 'vatNumber', 'ust-idnr': 'vatNumber',
  ustidnr: 'vatNumber', vat: 'vatNumber', vatnumber: 'vatNumber',
  notiz: 'notes', notizen: 'notes', bemerkung: 'notes', notes: 'notes',
  typ: '__typ', type: '__typ', kundentyp: '__typ',
};

const MAX_ZEILEN = 2000;
const MAX_FELD = 255;
const MAX_NOTIZ = 2000;

/**
 * Feldwert entschaerfen: trimmen, fuehrende '='/'@' entfernen (CSV-Formel-
 * Injection – schuetzt spaetere Excel-/DATEV-Exporte; '+' bleibt erhalten,
 * Telefonnummern beginnen legitim damit) und auf Spaltenlaenge kappen.
 */
function putzWert(roh: string, maxLaenge = MAX_FELD): string {
  return (roh ?? '').trim().replace(/^[=@\t]+/, '').slice(0, maxLaenge);
}

function parseTyp(roh: string): CustomerType | null | 'unbekannt' {
  const t = roh.trim().toLowerCase();
  if (!t) return null;
  if (['privat', 'private', 'p'].includes(t)) return CustomerType.PRIVATE;
  if (['firma', 'geschaeft', 'geschäft', 'business', 'gewerblich', 'b'].includes(t)) {
    return CustomerType.BUSINESS;
  }
  return 'unbekannt';
}

interface GeplanteZeile extends ImportZeile {
  /** Zu schreibende Felder (nur bei neu/aktualisiert). */
  daten?: Record<string, string | CustomerType>;
  /** Bestehender Kunde (nur bei aktualisiert). */
  bestandId?: string;
}

@Injectable()
export class CustomersImportService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async importCsv(
    user: AuthUser,
    datei: HochgeladeneDatei,
    optionen: ImportOptionenDto,
  ): Promise<ImportBericht> {
    const modus = optionen.mode === 'commit' ? 'commit' : 'preview';
    const duplikate = optionen.duplikate === 'update' ? 'update' : 'skip';

    // 1) Parsen (Encoding/Trennzeichen tolerant); Parser-Fehler -> 400.
    let csv: CsvDaten;
    try {
      csv = parseCsv(datei);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (csv.zeilen.length === 0) {
      throw new BadRequestException('Die Datei enthaelt keine Datenzeilen (nur eine Kopfzeile).');
    }
    if (csv.zeilen.length > MAX_ZEILEN) {
      throw new BadRequestException(
        `Zu viele Zeilen (${csv.zeilen.length}). Bitte die Datei in Teile mit maximal ${MAX_ZEILEN} Zeilen aufteilen.`,
      );
    }

    // 2) Kopfzeile zuordnen; unbekannte Spalten nur melden, nicht ablehnen.
    const zuordnung: (string | null)[] = csv.header.map((h) => SPALTEN[h] ?? null);
    const ignorierteSpalten = [
      ...new Set(csv.headerOriginal.filter((_, i) => zuordnung[i] === null && csv.headerOriginal[i] !== '')),
    ];
    const erkannte = new Set(zuordnung.filter(Boolean) as string[]);
    if (!erkannte.has('lastName') && !erkannte.has('companyName')) {
      throw new BadRequestException(
        'Keine Namensspalte gefunden. Die Kopfzeile braucht mindestens "Nachname" (oder "Name") ' +
          'oder "Firma". Weitere erkannte Spalten: Vorname, E-Mail, Telefon, Mobil, Strasse, PLZ, Ort, Land, USt-Id, Notiz, Typ.',
      );
    }

    // 3) Bestand laden (nur AKTIVE Kunden, tenant-scoped) fuer Duplikat-Abgleich.
    const bestand = await this.repo.find({
      where: { tenantId: user.tenantId, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'companyName'],
    });
    const proSchluessel = new Map<string, Customer[]>();
    const merke = (schluessel: string, kunde: Customer) => {
      if (!schluessel) return;
      const liste = proSchluessel.get(schluessel) ?? [];
      liste.push(kunde);
      proSchluessel.set(schluessel, liste);
    };
    for (const kunde of bestand) {
      if (kunde.email?.trim()) merke(`email:${kunde.email.trim().toLowerCase()}`, kunde);
      if (kunde.companyName?.trim()) merke(`firma:${kunde.companyName.trim().toLowerCase()}`, kunde);
      if (kunde.firstName?.trim() || kunde.lastName?.trim()) {
        merke(
          `name:${(kunde.firstName ?? '').trim().toLowerCase()}|${(kunde.lastName ?? '').trim().toLowerCase()}`,
          kunde,
        );
      }
    }

    // 4) Zeilen klassifizieren (rein, ohne Schreiben).
    const geplant: GeplanteZeile[] = [];
    const inDatei = new Map<string, number>(); // Schluessel -> Zeilennummer des Erstauftretens
    for (const zeile of csv.zeilen) {
      geplant.push(this.klassifiziere(zeile, zuordnung, duplikate, proSchluessel, inDatei));
    }

    // 5) Tarif-Limit als BULK-Check: nur NEUE Kunden verbrauchen Plaetze.
    const neuAnzahl = geplant.filter((z) => z.status === 'neu').length;
    const aktiveKunden = bestand.length;
    const max = await this.subscriptions.getLimit(user.tenantId, 'maxCustomers');
    const frei = max === null ? null : Math.max(0, max - aktiveKunden);
    const ueberschritten = max !== null && neuAnzahl > (frei as number);
    if (modus === 'commit' && ueberschritten) {
      throw new ForbiddenException(
        limitReachedPayload(
          'maxCustomers',
          max as number,
          aktiveKunden,
          `Der Import wuerde ${neuAnzahl} neue Kunden anlegen, frei sind nur noch ${frei}. ` +
            'Datei verkleinern oder Tarif erhoehen.',
        ),
      );
    }

    // 6) Commit: in EINER Transaktion schreiben (Fehlerzeilen bleiben aussen vor).
    if (modus === 'commit') {
      await this.repo.manager.transaction(async (em) => {
        for (const zeile of geplant) {
          if (zeile.status === 'neu' && zeile.daten) {
            await em.save(em.create(Customer, { ...zeile.daten, tenantId: user.tenantId }));
          } else if (zeile.status === 'aktualisiert' && zeile.daten && zeile.bestandId) {
            // Nur befuellte Felder ueberschreiben; isActive wird NIE angefasst.
            await em.update(
              Customer,
              { id: zeile.bestandId, tenantId: user.tenantId },
              zeile.daten,
            );
          }
        }
      });
    }

    const bericht = this.baueBericht(modus, csv, geplant, ignorierteSpalten, {
      max,
      aktiv: aktiveKunden,
      frei,
      ueberschritten,
    });

    if (modus === 'commit') {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'customer.import',
        entityType: 'Customer',
        // Nur Zaehlwerte protokollieren (keine personenbezogenen Werte).
        payload: {
          gesamt: bericht.gesamt,
          neu: bericht.neu,
          aktualisiert: bericht.aktualisiert,
          uebersprungen: bericht.uebersprungen,
          fehler: bericht.fehler,
          datei: datei.originalname ?? '',
        },
      });
    }
    return bericht;
  }

  /** Ordnet eine Datenzeile ein: neu / aktualisiert / uebersprungen / fehler. */
  private klassifiziere(
    zeile: { nr: number; felder: string[] },
    zuordnung: (string | null)[],
    duplikate: 'skip' | 'update',
    proSchluessel: Map<string, Customer[]>,
    inDatei: Map<string, number>,
  ): GeplanteZeile {
    // Werte einsammeln (letzte befuellte Spalte gewinnt bei Doppel-Zuordnung).
    const werte: Record<string, string> = {};
    let typRoh = '';
    for (let i = 0; i < zuordnung.length; i++) {
      const ziel = zuordnung[i];
      if (!ziel) continue;
      const roh = zeile.felder[i] ?? '';
      if (ziel === '__typ') {
        if (roh.trim()) typRoh = roh;
      } else {
        const wert = putzWert(roh, ziel === 'notes' ? MAX_NOTIZ : MAX_FELD);
        if (wert) werte[ziel] = wert;
      }
    }

    const anzeigeName =
      werte.companyName ||
      [werte.firstName, werte.lastName].filter(Boolean).join(' ') ||
      werte.email ||
      `Zeile ${zeile.nr}`;
    const fertig = (status: ImportZeilenStatus, hinweis?: string, rest?: Partial<GeplanteZeile>): GeplanteZeile => ({
      zeile: zeile.nr,
      name: anzeigeName,
      status,
      ...(hinweis ? { hinweis } : {}),
      ...rest,
    });

    // Pflicht: Nachname ODER Firma.
    if (!werte.lastName && !werte.companyName) {
      return fertig('fehler', 'Nachname oder Firma erforderlich');
    }
    // E-Mail-Format (wenn angegeben) – kaputte Adressen frueh sichtbar machen.
    if (werte.email && !isEmail(werte.email)) {
      return fertig('fehler', `Ungueltige E-Mail-Adresse: "${werte.email}"`);
    }
    // Kundentyp: explizit, sonst aus Firma abgeleitet.
    const typ = parseTyp(typRoh);
    if (typ === 'unbekannt') {
      return fertig('fehler', `Unbekannter Typ "${typRoh.trim()}" (erlaubt: privat/firma)`);
    }
    const daten: Record<string, string | CustomerType> = {
      ...werte,
      type: typ ?? (werte.companyName ? CustomerType.BUSINESS : CustomerType.PRIVATE),
    };

    // Duplikat-Schluessel: E-Mail ist der staerkste Anker, sonst Firma bzw. Name.
    const schluessel = werte.email
      ? `email:${werte.email.toLowerCase()}`
      : werte.companyName
        ? `firma:${werte.companyName.toLowerCase()}`
        : `name:${(werte.firstName ?? '').toLowerCase()}|${(werte.lastName ?? '').toLowerCase()}`;

    // Doppelt in der Datei selbst?
    const ersteZeile = inDatei.get(schluessel);
    if (ersteZeile !== undefined) {
      return fertig('uebersprungen', `Doppelt in der Datei (wie Zeile ${ersteZeile})`);
    }
    inDatei.set(schluessel, zeile.nr);

    // Duplikat im Bestand?
    const treffer = proSchluessel.get(schluessel) ?? [];
    if (treffer.length === 0) return fertig('neu', undefined, { daten });
    if (treffer.length > 1) {
      return fertig('uebersprungen', 'Mehrere bestehende Kunden passen – bitte manuell pruefen');
    }
    if (duplikate === 'update') {
      return fertig('aktualisiert', 'Bestehender Kunde wird mit den befuellten Feldern aktualisiert', {
        daten,
        bestandId: treffer[0].id,
      });
    }
    return fertig('uebersprungen', 'Kunde existiert bereits');
  }

  private baueBericht(
    modus: 'preview' | 'commit',
    csv: { encoding: string; trennzeichen: string; zeilen: unknown[] },
    geplant: GeplanteZeile[],
    ignorierteSpalten: string[],
    limit: { max: number | null; aktiv: number; frei: number | null; ueberschritten: boolean },
  ): ImportBericht {
    const zaehle = (status: ImportZeilenStatus) => geplant.filter((z) => z.status === status).length;
    return {
      modus,
      encoding: csv.encoding,
      trennzeichen: csv.trennzeichen,
      gesamt: geplant.length,
      neu: zaehle('neu'),
      aktualisiert: zaehle('aktualisiert'),
      uebersprungen: zaehle('uebersprungen'),
      fehler: zaehle('fehler'),
      ignorierteSpalten,
      limit,
      // Interna (daten/bestandId) verlassen den Server nicht.
      zeilen: geplant.map(({ zeile, name, status, hinweis }) => ({
        zeile,
        name,
        status,
        ...(hinweis ? { hinweis } : {}),
      })),
    };
  }
}
