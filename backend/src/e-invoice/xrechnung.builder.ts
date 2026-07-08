/**
 * XRechnung-3.0-Builder (UBL-Invoice, reine Funktion – keine DB, keine Guards).
 *
 * Erzeugt aus einer bereits TENANT-SCOPED geladenen Rechnung ein XRechnung-XML
 * nach EN 16931 / UBL Invoice-2. Die aufrufende Schicht (EInvoiceService) laedt
 * Invoice/Customer/Tenant mandantensicher und reicht die Objekte hier hinein –
 * so bleibt die Mandantentrennung vollstaendig im Service (Vorbild:
 * invoice-pdf.ts / accounting-export.service.ts).
 *
 * BEWUSST OHNE npm-Paket: Das XML wird aus Template-Strings mit sauberem
 * XML-Escaping gebaut (kein xmlbuilder o. Ae.), damit `npm ci` in der CI nicht
 * durch eine neue Abhaengigkeit bricht.
 *
 * Verifizierte Spec (Stand 2026-07): XRechnung 3.0 (KoSIT). Pflicht-Header:
 *   - CustomizationID = urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0
 *   - ProfileID       = urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
 * Quellen: KoSIT xrechnung-testsuite (UBL-Beispiele), xeinkauf.de English
 * Summary v3.0.2. Zusaetzlich beruecksichtigte XRechnung-spezifische Regeln:
 *   - BR-DE-15: Kaeuferreferenz (BT-10) muss vorhanden sein.
 *   - BT-34:    Elektronische Adresse des Verkaeufers (Pflicht seit 3.0.1).
 *   - BR-DE-6/7: Verkaeufer-Kontakt Telefon (BT-42) + E-Mail (BT-43).
 *   - BR-DE-1:  Zahlungsanweisungen (BG-16) muessen vorhanden sein.
 *   - BR-DE-3/4 + BR-DE-8/9: PLZ/Ort bei Verkaeufer UND Kaeufer.
 *   - BR-S-02:  Standardsatz -> Verkaeufer-USt-IdNr (BT-31) ODER Steuernr (BT-32).
 *
 * WICHTIG (vor Go-Live): Dieses XML ist gegen den Spec-Text gebaut, aber NICHT
 * gegen den offiziellen KoSIT-Validator geprueft (hier technisch nicht moeglich).
 * Vor dem Produktiveinsatz MUSS eine echte Datei gegen den KoSIT-Validator
 * (Schematron 3.0.x) UND gegen einen echten Empfaenger (B2G-Portal / Peppol)
 * getestet werden. Siehe offene Punkte im Ticket-Protokoll.
 */
import { UnprocessableEntityException } from '@nestjs/common';

export const XRECHNUNG_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
export const XRECHNUNG_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

/** Handelsrechnung (UNCL1001-Teilmenge, BR-DE-17 erlaubt u. a. 380). */
const INVOICE_TYPE_CODE = '380';
/** SEPA-Ueberweisung (UNCL4461). */
const PAYMENT_MEANS_CODE = '58';
/**
 * Mengeneinheit je Position. Wir fuehren (noch) keine Einheit je Position ->
 * neutraler UN/ECE-Rec-20-Code "C62" (= one / Stueck-neutral). Offener Punkt:
 * echte Einheiten je Leistung koennten spaeter gemappt werden.
 */
const DEFAULT_UNIT_CODE = 'C62';

// --- Struktur-Typen (entkoppeln vom Entity, erleichtern Tests) --------------
export interface XrInvoiceItem {
  beschreibung?: string | null;
  menge?: number | string | null;
  einzelpreis?: number | string | null;
  gesamtpreis?: number | string | null;
}

export interface XrInvoice {
  nummer?: string | null;
  art?: string | null; // 'rechnung' | 'angebot'
  datum?: Date | string | null;
  faelligkeitsdatum?: Date | string | null;
  netto?: number | string | null;
  mwst?: number | string | null;
  brutto?: number | string | null;
  mwstSatz?: number | string | null;
  items?: XrInvoiceItem[] | null;
  // DSGVO/GoBD-Empfaenger-Snapshot (bei Art.17-Anonymisierung eingefroren).
  empfaengerName?: string | null;
  empfaengerVatNumber?: string | null;
}

export interface XrCustomer {
  type?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface XrTenant {
  name?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  /** §14-Daten (verschluesselt gespeichert): steuernummer/ustId/iban/bic/bankname. */
  settings?: Record<string, unknown> | null;
}

// --- Formatter/Escaping ------------------------------------------------------

/**
 * XML-Escaping fuer Element-Inhalt UND Attributwerte. Zusaetzlich werden in
 * XML-1.0 ungueltige Steuerzeichen entfernt (Defense-in-depth gegen kaputte
 * Eingaben aus verschluesselten Feldern).
 */
export function escapeXml(value: unknown): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Geldbetrag als UBL-decimal: Punkt als Trenner, exakt 2 Nachkommastellen. */
function money(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Menge als UBL-decimal (bis 4 Nachkommastellen, ohne unnoetige Nullen). */
function qty(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 10000) / 10000);
}

/** Prozentsatz als UBL-decimal (ohne unnoetige Nullen, z. B. 19 / 7 / 0). */
function pct(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

/** Datum als ISO YYYY-MM-DD (lokale Kalenderteile, konsistent zur PDF-Anzeige). */
function isoDate(v?: Date | string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Liest einen getrimmten String aus tenant.settings (untypisiert/verschluesselt). */
function setting(tenant: XrTenant, key: string): string {
  const v = (tenant.settings as Record<string, unknown> | undefined | null)?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** VAT-Kategorie (BT-118/BT-151): Standardsatz S, 0 % -> Z (Nullsatz). */
function vatCategory(satz: number): 'S' | 'Z' {
  return satz > 0 ? 'S' : 'Z';
}

/** Anzeigename des Kaeufers (DSGVO-Snapshot hat Vorrang vor dem Live-Kunden). */
function buyerName(invoice: XrInvoice, customer: XrCustomer | null): string {
  const snap = str(invoice.empfaengerName);
  if (snap) return snap;
  if (!customer) return '';
  if (customer.type === 'business' || str(customer.companyName)) return str(customer.companyName);
  return [str(customer.firstName), str(customer.lastName)].filter(Boolean).join(' ');
}

function indent(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');
}

// --- Pflichtdaten-Guard ------------------------------------------------------

/**
 * Sammelt fehlende Pflichtfelder fuer eine gueltige XRechnung. Liefert eine
 * Liste menschenlesbarer Labels (leere Liste = alles vorhanden). NIE ungueltiges
 * XML ausliefern -> der Aufrufer wirft bei nicht-leerer Liste 422.
 */
export function collectMissingXRechnungFields(
  invoice: XrInvoice,
  tenant: XrTenant | null,
  customer: XrCustomer | null,
): string[] {
  const missing: string[] = [];
  const t = tenant ?? {};

  // Rechnung selbst
  if (!str(invoice.nummer)) {
    missing.push('Rechnungsnummer (Rechnung ist noch ein Entwurf – bitte zuerst festsetzen)');
  }
  if (!isoDate(invoice.datum)) missing.push('Rechnungsdatum');
  if (!invoice.items || invoice.items.length === 0) missing.push('mindestens eine Rechnungsposition');

  // Verkaeufer (Betrieb / Einstellungen §14)
  if (!str(t.name)) missing.push('Betrieb: Name');
  if (!str(t.postalCode)) missing.push('Betrieb: PLZ');
  if (!str(t.city)) missing.push('Betrieb: Ort');
  if (!str(t.email)) missing.push('Betrieb: E-Mail (elektronische Adresse, Pflicht in der XRechnung)');
  if (!str(t.phone)) missing.push('Betrieb: Telefon (Pflicht-Kontakt in der XRechnung)');
  if (!setting(t, 'steuernummer') && !setting(t, 'ustId')) {
    missing.push('Betrieb: Steuernummer oder USt-IdNr (mindestens eine)');
  }
  if (!setting(t, 'iban')) missing.push('Betrieb: IBAN (für die Zahlungsangaben)');

  // Kaeufer (Kunde)
  if (!buyerName(invoice, customer)) missing.push('Kunde: Name');
  if (!str(customer?.postalCode)) missing.push('Kunde: PLZ');
  if (!str(customer?.city)) missing.push('Kunde: Ort');

  return missing;
}

// --- XML-Bausteine -----------------------------------------------------------

function amountEl(tag: string, v: number | string | null | undefined): string {
  return `<${tag} currencyID="EUR">${money(v)}</${tag}>`;
}

function postalAddress(o: {
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  const zeilen: string[] = [];
  const strasse = str(o.street);
  if (strasse) zeilen.push(`<cbc:StreetName>${escapeXml(strasse)}</cbc:StreetName>`);
  zeilen.push(`<cbc:CityName>${escapeXml(str(o.city))}</cbc:CityName>`);
  zeilen.push(`<cbc:PostalZone>${escapeXml(str(o.postalCode))}</cbc:PostalZone>`);
  const land = str(o.country) || 'DE';
  zeilen.push(
    `<cac:Country><cbc:IdentificationCode>${escapeXml(land)}</cbc:IdentificationCode></cac:Country>`,
  );
  return `<cac:PostalAddress>\n${indent(zeilen.join('\n'), 2)}\n</cac:PostalAddress>`;
}

function partyTaxScheme(companyId: string, scheme: 'VAT' | 'FC'): string {
  return [
    '<cac:PartyTaxScheme>',
    `  <cbc:CompanyID>${escapeXml(companyId)}</cbc:CompanyID>`,
    `  <cac:TaxScheme><cbc:ID>${scheme}</cbc:ID></cac:TaxScheme>`,
    '</cac:PartyTaxScheme>',
  ].join('\n');
}

function sellerParty(tenant: XrTenant): string {
  const name = str(tenant.name);
  const email = str(tenant.email);
  const phone = str(tenant.phone);
  const ustId = setting(tenant, 'ustId');
  const steuernummer = setting(tenant, 'steuernummer');

  const inner: string[] = [];
  inner.push(`<cbc:EndpointID schemeID="EM">${escapeXml(email)}</cbc:EndpointID>`);
  // BR-CO-26: Verkaeufer braucht BT-29/BT-30/BT-31 (BT-32/Steuernr zaehlt NICHT).
  // Bei Steuernummer-only (keine USt-IdNr -> kein BT-31) ergaenzen wir BT-29 als
  // PartyIdentification. UBL-Party-Sequence: NACH EndpointID, VOR PartyName.
  if (!ustId && steuernummer) {
    inner.push(
      `<cac:PartyIdentification><cbc:ID>${escapeXml(steuernummer)}</cbc:ID></cac:PartyIdentification>`,
    );
  }
  inner.push(`<cac:PartyName><cbc:Name>${escapeXml(name)}</cbc:Name></cac:PartyName>`);
  inner.push(postalAddress(tenant));
  // BT-31 USt-IdNr -> TaxScheme VAT; BT-32 Steuernummer -> TaxScheme FC.
  if (ustId) inner.push(partyTaxScheme(ustId, 'VAT'));
  if (steuernummer) inner.push(partyTaxScheme(steuernummer, 'FC'));
  inner.push(
    `<cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName></cac:PartyLegalEntity>`,
  );
  inner.push(
    [
      '<cac:Contact>',
      `  <cbc:Name>${escapeXml(name)}</cbc:Name>`,
      `  <cbc:Telephone>${escapeXml(phone)}</cbc:Telephone>`,
      `  <cbc:ElectronicMail>${escapeXml(email)}</cbc:ElectronicMail>`,
      '</cac:Contact>',
    ].join('\n'),
  );

  return [
    '<cac:AccountingSupplierParty>',
    '  <cac:Party>',
    indent(inner.join('\n'), 4),
    '  </cac:Party>',
    '</cac:AccountingSupplierParty>',
  ].join('\n');
}

function buyerParty(invoice: XrInvoice, customer: XrCustomer | null): string {
  const name = buyerName(invoice, customer);
  const email = str(customer?.email);
  const vat = str(invoice.empfaengerVatNumber) || str(customer?.vatNumber);

  const inner: string[] = [];
  if (email) inner.push(`<cbc:EndpointID schemeID="EM">${escapeXml(email)}</cbc:EndpointID>`);
  inner.push(
    postalAddress({
      street: customer?.street,
      city: customer?.city,
      postalCode: customer?.postalCode,
      country: customer?.country,
    }),
  );
  if (vat) inner.push(partyTaxScheme(vat, 'VAT'));
  inner.push(
    `<cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName></cac:PartyLegalEntity>`,
  );

  return [
    '<cac:AccountingCustomerParty>',
    '  <cac:Party>',
    indent(inner.join('\n'), 4),
    '  </cac:Party>',
    '</cac:AccountingCustomerParty>',
  ].join('\n');
}

function paymentMeans(tenant: XrTenant): string {
  const iban = setting(tenant, 'iban');
  const bic = setting(tenant, 'bic');
  const kontoName = setting(tenant, 'bankname') || str(tenant.name);

  const account: string[] = [`<cbc:ID>${escapeXml(iban)}</cbc:ID>`];
  if (kontoName) account.push(`<cbc:Name>${escapeXml(kontoName)}</cbc:Name>`);
  if (bic) {
    account.push(
      `<cac:FinancialInstitutionBranch><cbc:ID>${escapeXml(bic)}</cbc:ID></cac:FinancialInstitutionBranch>`,
    );
  }
  return [
    '<cac:PaymentMeans>',
    `  <cbc:PaymentMeansCode>${PAYMENT_MEANS_CODE}</cbc:PaymentMeansCode>`,
    '  <cac:PayeeFinancialAccount>',
    indent(account.join('\n'), 4),
    '  </cac:PayeeFinancialAccount>',
    '</cac:PaymentMeans>',
  ].join('\n');
}

/**
 * Zahlungsbedingungen (BG-16 / BT-20). Erfuellt BR-CO-25 (bei PayableAmount > 0 muss
 * DueDate ODER PaymentTerms/Note vorhanden sein), wenn KEIN Faelligkeitsdatum gesetzt
 * ist. Text aus dem Zahlungsziel-Setting abgeleitet; beginnt bewusst NIE mit '#'
 * (sonst greift die XRechnung-Skonto-Regel BR-DE-18).
 */
function paymentTerms(tenant: XrTenant): string {
  const tageRaw = setting(tenant, 'rechnungZahlungszielTage');
  const tage = /^\d+$/.test(tageRaw) ? Number(tageRaw) : 0;
  const note =
    tage > 0 ? `Zahlbar innerhalb von ${tage} Tagen ohne Abzug.` : 'Zahlbar sofort ohne Abzug.';
  return ['<cac:PaymentTerms>', `  <cbc:Note>${escapeXml(note)}</cbc:Note>`, '</cac:PaymentTerms>'].join(
    '\n',
  );
}

function taxTotal(netto: number | string, mwst: number | string, satz: number): string {
  const cat = vatCategory(satz);
  return [
    '<cac:TaxTotal>',
    `  ${amountEl('cbc:TaxAmount', mwst)}`,
    '  <cac:TaxSubtotal>',
    `    ${amountEl('cbc:TaxableAmount', netto)}`,
    `    ${amountEl('cbc:TaxAmount', mwst)}`,
    '    <cac:TaxCategory>',
    `      <cbc:ID>${cat}</cbc:ID>`,
    `      <cbc:Percent>${pct(satz)}</cbc:Percent>`,
    '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '    </cac:TaxCategory>',
    '  </cac:TaxSubtotal>',
    '</cac:TaxTotal>',
  ].join('\n');
}

function legalMonetaryTotal(
  netto: number | string,
  brutto: number | string,
): string {
  return [
    '<cac:LegalMonetaryTotal>',
    `  ${amountEl('cbc:LineExtensionAmount', netto)}`,
    `  ${amountEl('cbc:TaxExclusiveAmount', netto)}`,
    `  ${amountEl('cbc:TaxInclusiveAmount', brutto)}`,
    `  ${amountEl('cbc:PayableAmount', brutto)}`,
    '</cac:LegalMonetaryTotal>',
  ].join('\n');
}

function invoiceLine(item: XrInvoiceItem, index: number, satz: number): string {
  const cat = vatCategory(satz);
  const name = str(item.beschreibung) || `Position ${index}`;
  return [
    '<cac:InvoiceLine>',
    `  <cbc:ID>${index}</cbc:ID>`,
    `  <cbc:InvoicedQuantity unitCode="${DEFAULT_UNIT_CODE}">${qty(item.menge)}</cbc:InvoicedQuantity>`,
    `  ${amountEl('cbc:LineExtensionAmount', item.gesamtpreis)}`,
    '  <cac:Item>',
    `    <cbc:Name>${escapeXml(name)}</cbc:Name>`,
    '    <cac:ClassifiedTaxCategory>',
    `      <cbc:ID>${cat}</cbc:ID>`,
    `      <cbc:Percent>${pct(satz)}</cbc:Percent>`,
    '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '    </cac:ClassifiedTaxCategory>',
    '  </cac:Item>',
    '  <cac:Price>',
    `    ${amountEl('cbc:PriceAmount', item.einzelpreis)}`,
    '  </cac:Price>',
    '</cac:InvoiceLine>',
  ].join('\n');
}

// --- Haupt-Einstieg ----------------------------------------------------------

/**
 * Baut das XRechnung-3.0-XML (UBL) fuer eine Rechnung. Wirft
 * `UnprocessableEntityException` (422) mit klarer Meldung, wenn Pflichtfelder
 * fehlen – so wird NIE ungueltiges XML ausgeliefert.
 */
export function buildXRechnungXml(
  invoice: XrInvoice,
  tenant: XrTenant | null,
  customer: XrCustomer | null,
): string {
  const missing = collectMissingXRechnungFields(invoice, tenant, customer);
  if (missing.length > 0) {
    throw new UnprocessableEntityException(
      `Für die XRechnung fehlen Pflichtangaben: ${missing.join(', ')}. ` +
        'Bitte in den Einstellungen (§14-Firmendaten) bzw. beim Kunden ergänzen.',
    );
  }

  const t = tenant as XrTenant;
  const satz = Number(invoice.mwstSatz ?? 0);
  const items = invoice.items ?? [];
  // BR-DE-15: Kaeuferreferenz (BT-10). Ohne eigenes Leitweg-ID-/Referenzfeld
  // fallen wir auf die Rechnungsnummer zurueck (nicht-leer, schema-valide).
  // Offener Punkt: fuer B2G-Empfaenger muss hier die echte Leitweg-ID stehen.
  const buyerReference = str(invoice.nummer);

  const header: string[] = [];
  header.push(`<cbc:CustomizationID>${XRECHNUNG_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
  header.push(`<cbc:ProfileID>${XRECHNUNG_PROFILE_ID}</cbc:ProfileID>`);
  header.push(`<cbc:ID>${escapeXml(str(invoice.nummer))}</cbc:ID>`);
  header.push(`<cbc:IssueDate>${isoDate(invoice.datum)}</cbc:IssueDate>`);
  const due = isoDate(invoice.faelligkeitsdatum);
  if (due) header.push(`<cbc:DueDate>${due}</cbc:DueDate>`);
  header.push(`<cbc:InvoiceTypeCode>${INVOICE_TYPE_CODE}</cbc:InvoiceTypeCode>`);
  header.push('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>');
  header.push(`<cbc:BuyerReference>${escapeXml(buyerReference)}</cbc:BuyerReference>`);

  const body: string[] = [
    header.join('\n'),
    sellerParty(t),
    buyerParty(invoice, customer),
    paymentMeans(t),
    // BR-CO-25: Ohne DueDate ersatzweise PaymentTerms/Note (BT-20) ausgeben.
    // UBL-Sequence: PaymentTerms NACH PaymentMeans, VOR TaxTotal.
    ...(due ? [] : [paymentTerms(t)]),
    taxTotal(invoice.netto ?? 0, invoice.mwst ?? 0, satz),
    legalMonetaryTotal(invoice.netto ?? 0, invoice.brutto ?? 0),
    ...items.map((item, i) => invoiceLine(item, i + 1, satz)),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
      ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
      ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    indent(body.join('\n'), 2),
    '</ubl:Invoice>',
    '',
  ].join('\n');
}
