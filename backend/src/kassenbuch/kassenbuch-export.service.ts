import { Injectable } from '@nestjs/common';
import { berlinDatumDe } from './kassenbuch-zeit';

/**
 * Anzeige-Zeile fuer den Kassenbuch-Export. Bewusst entkoppelt von der Entity:
 * die Service-Schicht loest `stornoVonNummer` (die laufende Nummer des
 * stornierten Originals) fuer die Lesbarkeit auf und reicht reine Werte hinein.
 */
export interface KassenbuchExportRow {
  laufendeNummer: number;
  datum: Date | string;
  typ: string;
  zweck: string;
  belegNummer: string | null;
  kategorie: string | null;
  betrag: number | string;
  mwstSatz: number | string;
  kassenbestandNach: number | string;
  festgeschrieben: boolean;
  stornoVonNummer: number | null;
}

/**
 * Reiner Formatierer fuer den GoBD-tauglichen Kassenbuch-Export (keine
 * DB-Zugriffe, keine Guards – die aufrufende Schicht laedt tenant-scoped und
 * reicht die Zeilen hinein). Semikolon-CSV, UTF-8 + BOM, deutsches
 * Zahlen-/Datumsformat, damit Steuerberater/Excel es direkt oeffnen koennen.
 *
 * SICHERHEIT (CSV-/Formel-Injection, analog invoices/accounting-export #204):
 * jede Text-Zelle laeuft durch neutralize()/csv() – Zellen, die mit = + - @ Tab
 * oder CR beginnen (und keine reine Zahl sind), bekommen ein fuehrendes
 * Apostroph, damit Excel/LibreOffice sie NICHT als Formel (DDE/Exfiltration)
 * auswertet. Defense am Sink -> unabhaengig von der Datenquelle.
 */
@Injectable()
export class KassenbuchExportService {
  /** Baut das Kassenbuch als CSV-Buffer (BOM, Semikolon, CRLF, DE-Format). */
  buildCsv(rows: KassenbuchExportRow[]): Buffer {
    const SEP = ';';
    const header = [
      'Lfd. Nr.',
      'Datum',
      'Typ',
      'Zweck',
      'Belegnummer',
      'Kategorie',
      'Einnahme',
      'Ausgabe',
      'MwSt-Satz',
      'Kassenbestand',
      'Status',
      'Storno zu Nr.',
    ];
    const zeilen = [header.join(SEP)];
    for (const e of rows) {
      const istEinnahme = e.typ === 'einnahme';
      zeilen.push(
        [
          String(e.laufendeNummer),
          this.datumDe(e.datum),
          this.csv(istEinnahme ? 'Einnahme' : 'Ausgabe'),
          this.csv(e.zweck),
          this.csv(e.belegNummer ?? ''),
          this.csv(e.kategorie ?? ''),
          istEinnahme ? this.betrag(e.betrag) : '',
          istEinnahme ? '' : this.betrag(e.betrag),
          this.betrag(e.mwstSatz),
          this.betrag(e.kassenbestandNach),
          this.csv(e.festgeschrieben ? 'Festgeschrieben' : 'Entwurf'),
          e.stornoVonNummer != null ? String(e.stornoVonNummer) : '',
        ].join(SEP),
      );
    }
    // BOM (Excel-Umlaute) + CRLF-Zeilenenden.
    const text = '﻿' + zeilen.join('\r\n') + '\r\n';
    return Buffer.from(text, 'utf-8');
  }

  /** Betrag mit Komma als Dezimaltrenner, 2 Nachkommastellen, ohne Tausenderpunkt. */
  private betrag(v: number | string): string {
    return Number(v).toFixed(2).replace('.', ',');
  }

  /**
   * Belegdatum 'DD.MM.YYYY' in Berliner Wanduhrzeit (nicht Server-Lokalzeit) –
   * sonst stuende auf UTC-Prod ein um Mitternacht gebuchter Beleg am falschen Tag.
   */
  private datumDe(d?: Date | string | null): string {
    return berlinDatumDe(d ?? null);
  }

  /**
   * Verhindert CSV-/Formel-Injection: eine Text-Zelle, die mit = + - @ Tab oder
   * CR beginnt (und KEINE reine Zahl ist), bekommt ein fuehrendes Apostroph.
   * Betraege/Zahlen (auch negative, dt. Format) bleiben unveraendert.
   */
  private neutralize(v: string): string {
    if (!/^[=+\-@\t\r]/.test(v)) return v;
    if (/^[+-]?[\d.,]+$/.test(v)) return v; // echte Zahl -> nicht anfassen
    return `'${v}`;
  }

  /** CSV-Feld escapen (RFC-4180-Stil): bei ; " oder Umbruch quoten + " verdoppeln. */
  private csv(s: string): string {
    const v = this.neutralize(String(s ?? ''));
    return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }
}
