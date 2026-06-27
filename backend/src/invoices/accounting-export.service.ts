import { Injectable } from '@nestjs/common';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';

/**
 * Reiner Formatierer fuer den Buchhaltungs-Export (keine DB-Zugriffe, keine
 * Guards – die aufrufende Schicht laedt tenant-scoped und reicht die Objekte
 * hinein). Erzeugt zwei Formate:
 *   - buildCsv:   universelles Semikolon-CSV (UTF-8 + BOM, deutsches Zahlenformat)
 *                 fuer jeden Steuerberater, auch ohne DATEV.
 *   - buildDatev: DATEV "EXTF Buchungsstapel" (CP1252, Soll Debitor an Erloes).
 *
 * Annahme aus dem Datenmodell: eine Rechnung hat GENAU EINEN MwSt-Satz
 * (Invoice.mwstSatz) -> eine Buchungszeile je Rechnung genuegt (kein
 * Misch-Satz-Splitting noetig).
 *
 * WICHTIG (DATEV): Das EXTF-Format ist programmstand-abhaengig. Diese
 * Implementierung folgt der gaengigen Spezifikation (Automatikkonten, BU-Schluessel
 * leer, Belegdatum TTMM, CP1252). Vor Produktiveinsatz mit dem kostenlosen
 * DATEV-Pruefprogramm (developer.datev.de) gegen eine echte Datei validieren.
 */

export interface DatevConfig {
  beraterNr: string;
  mandantNr: string;
  skr: string;
  erloeskonto19: string;
  erloeskonto7: string;
  erloeskonto0: string;
  debitorSammelkonto: string;
}

/** SKR03-Standardwerte – damit der Export ohne Konfiguration funktioniert. */
export const DATEV_DEFAULTS: Omit<DatevConfig, 'beraterNr' | 'mandantNr'> = {
  skr: '03',
  erloeskonto19: '8400',
  erloeskonto7: '8300',
  erloeskonto0: '8195',
  debitorSammelkonto: '1400',
};

@Injectable()
export class AccountingExportService {
  // ---------------------------------------------------------------------------
  // Universelles CSV
  // ---------------------------------------------------------------------------
  buildCsv(invoices: Invoice[], customerById: Map<string, Customer>): Buffer {
    const SEP = ';';
    const header = [
      'Belegnummer',
      'Belegdatum',
      'Leistungsdatum',
      'Kunde',
      'Netto',
      'MwSt-Satz',
      'MwSt-Betrag',
      'Brutto',
      'Status',
      'Zahldatum',
    ];
    const zeilen = [header.join(SEP)];
    for (const inv of invoices) {
      zeilen.push(
        [
          this.csv(inv.nummer ?? ''),
          this.datumDe(inv.datum),
          this.datumDe(inv.leistungsdatum ?? inv.datum),
          this.csv(this.kundeName(inv, customerById)),
          this.betrag(inv.netto),
          String(this.satz(inv)),
          this.betrag(inv.mwst),
          this.betrag(inv.brutto),
          this.csv(inv.status),
          inv.zahldatum ? this.datumDe(inv.zahldatum) : '',
        ].join(SEP),
      );
    }
    // BOM, damit Excel die UTF-8-Umlaute korrekt anzeigt; CRLF-Zeilenenden.
    const text = '﻿' + zeilen.join('\r\n') + '\r\n';
    return Buffer.from(text, 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // DATEV EXTF Buchungsstapel
  // ---------------------------------------------------------------------------
  buildDatev(
    invoices: Invoice[],
    customerById: Map<string, Customer>,
    cfg: DatevConfig,
    von: Date,
    bis: Date,
  ): Buffer {
    const SEP = ';';
    const erzeugt = this.zeitstempel(new Date());
    const wjBeginn = `${von.getFullYear()}0101`;
    const bezeichnung = `Ausgangsrechnungen ${this.datumIso(von)}-${this.datumIso(bis)}`;

    // Kopfzeile (Formatversion 13). Reihenfolge exakt einhalten; hintere Felder leer.
    const kopf = [
      '"EXTF"',
      '700', // Schnittstellen-Version
      '21', // Kategorie Buchungsstapel
      '"Buchungsstapel"',
      '13', // Formatversion des Layouts
      erzeugt,
      '',
      '"DTLY"',
      '"Detailly"',
      '',
      this.num(cfg.beraterNr),
      this.num(cfg.mandantNr),
      wjBeginn,
      '4', // Sachkontenlaenge
      this.datumIso(von),
      this.datumIso(bis),
      this.dq(bezeichnung),
      '',
      '1', // Buchungstyp Finanzbuchfuehrung
      '',
      '0', // Festschreibung aus -> Berater kann korrigieren
      '"EUR"',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(SEP);

    // Spaltenueberschriften (die praktisch relevanten 14 Spalten).
    const captions = [
      'Umsatz (ohne Soll/Haben-Kz)',
      'Soll/Haben-Kennzeichen',
      'WKZ Umsatz',
      'Kurs',
      'Basisumsatz',
      'WKZ Basisumsatz',
      'Konto',
      'Gegenkonto (ohne BU-Schlüssel)',
      'BU-Schlüssel',
      'Belegdatum',
      'Belegfeld 1',
      'Belegfeld 2',
      'Skonto',
      'Buchungstext',
    ].join(SEP);

    const zeilen = [kopf, captions];
    for (const inv of invoices) {
      const gegenkonto = this.erloeskonto(inv, cfg);
      const buchungstext = `Rechnung ${inv.nummer ?? ''} ${this.kundeName(inv, customerById)}`.trim().slice(0, 60);
      zeilen.push(
        [
          this.betrag(inv.brutto), // Umsatz (brutto, Komma, ohne Vorzeichen)
          '"S"', // Soll: Forderung gegen Debitor
          '"EUR"',
          '',
          '',
          '',
          this.num(cfg.debitorSammelkonto), // Konto = Debitor-Sammelkonto
          this.num(gegenkonto), // Gegenkonto = Erloeskonto (Automatik)
          '', // BU-Schluessel leer (Automatikkonto traegt die USt)
          this.datumTtmm(inv.datum), // Belegdatum TTMM
          this.dq(inv.nummer ?? ''), // Belegfeld 1 = Rechnungsnummer
          '',
          '',
          this.dq(buchungstext),
        ].join(SEP),
      );
    }

    // DATEV erwartet CP1252 + CRLF. Node 'latin1' = ISO-8859-1 (deckt deutsche
    // Umlaute ab; das Format enthaelt kein Euro-Zeichen).
    const text = zeilen.join('\r\n') + '\r\n';
    return Buffer.from(this.toLatin1(text), 'latin1');
  }

  // ---------------------------------------------------------------------------
  // Helfer
  // ---------------------------------------------------------------------------
  private satz(inv: Invoice): number {
    return Math.round(Number(inv.mwstSatz ?? 19));
  }

  private erloeskonto(inv: Invoice, cfg: DatevConfig): string {
    switch (this.satz(inv)) {
      case 7:
        return cfg.erloeskonto7;
      case 0:
        return cfg.erloeskonto0;
      default:
        return cfg.erloeskonto19;
    }
  }

  private kundeName(inv: Invoice, customerById: Map<string, Customer>): string {
    // Bei DSGVO-Anonymisierung haelt der Empfaenger-Snapshot den korrekten Namen.
    if (inv.empfaengerName && inv.empfaengerName.trim()) return inv.empfaengerName.trim();
    const c = customerById.get(inv.customerId);
    if (!c) return 'Unbekannt';
    const name =
      c.type === CustomerType.BUSINESS
        ? c.companyName
        : [c.firstName, c.lastName].filter(Boolean).join(' ');
    return (name && name.trim()) || 'Unbekannt';
  }

  /** Betrag mit Komma als Dezimaltrenner, 2 Nachkommastellen, ohne Tausenderpunkt. */
  private betrag(v: number | string): string {
    return Number(v).toFixed(2).replace('.', ',');
  }

  private datumDe(d?: Date | string | null): string {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  private datumIso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

  private datumTtmm(d?: Date | string | null): string {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}${p(date.getMonth() + 1)}`;
  }

  private zeitstempel(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}000`;
  }

  /** Numerisches Feld (Konto/Nummer): nur Ziffern, sonst leer. */
  private num(v?: string): string {
    const s = (v ?? '').replace(/\D/g, '');
    return s;
  }

  /** Text in DATEV-Anfuehrungszeichen; interne " entfernen (DATEV-robust). */
  private dq(s: string): string {
    return `"${String(s).replace(/"/g, '')}"`;
  }

  /** CSV-Feld escapen (RFC-4180-Stil): bei ; " oder Umbruch quoten + " verdoppeln. */
  private csv(s: string): string {
    const v = String(s ?? '');
    return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  /** Zeichen ausserhalb Latin-1 (z.B. Euro-Zeichen) defensiv ersetzen. */
  private toLatin1(s: string): string {
    return s.replace(/[^ -ÿ]/g, '?');
  }
}
