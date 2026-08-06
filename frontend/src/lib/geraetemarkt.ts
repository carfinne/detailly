// Geraete-Gebrauchtmarkt: geteilte Typen, Enums (gespiegelt aus dem Backend
// backend/src/geraetemarkt/geraetemarkt.constants.ts) und Anzeige-Helfer.
//
// Die Wertelisten sind BEWUSST identisch zum Backend gehalten (dort reine
// Code-Konstanten + @IsIn-Validierung, KEIN DB-Enum). Sichtbare Labels laufen
// ausschliesslich ueber i18n-Keys (siehe *_KEY-Maps), nie hartkodiert.

// --- Enums (Spiegel des Backends) -----------------------------------------

/** Geraete-/Ausruestungs-Kategorien – bewusst OHNE Chemie/Verbrauchsstoffe. */
export const GERAETE_KATEGORIEN = [
  'poliermaschine',
  'sauger_extraktor',
  'plotter',
  'ir_kurzwellen_trockner',
  'hebebuehne',
  'folier_werkzeug',
  'druckluft_kompressor',
  'dampfreiniger',
  'messtechnik',
  'sonstiges_geraet',
] as const;
export type GeraeteKategorie = (typeof GERAETE_KATEGORIEN)[number];

/** Nachbarschaftshilfe-Kategorien (Spiegel Backend: HILFE_KATEGORIEN). */
export const HILFE_KATEGORIEN = ['auftragshilfe', 'freie_kapazitaet', 'restmaterial'] as const;
export type HilfeKategorie = (typeof HILFE_KATEGORIEN)[number];

/** Alle zulaessigen Kategorien (Geraete + Nachbarschaftshilfe). */
export const ALLE_KATEGORIEN = [...GERAETE_KATEGORIEN, ...HILFE_KATEGORIEN] as const;

/** Richtung eines Inserats: Angebot („biete") vs. Gesuch („suche"). */
export const INSERAT_ART = ['angebot', 'gesuch'] as const;
export type InseratArt = (typeof INSERAT_ART)[number];

/**
 * Umkreis-Stufen fuer die Suche (grob, Regionsebene; Spiegel Backend:
 * UMKREIS_STUFEN_KM). 0 = nur eigene Region; ''/undefined im UI = ueberall.
 */
export const UMKREIS_STUFEN_KM = [0, 50, 100, 200] as const;
export type UmkreisStufe = (typeof UMKREIS_STUFEN_KM)[number];

/** Zustand eines Geraets. */
export const INSERAT_ZUSTAND = ['neu', 'gebraucht', 'defekt'] as const;
export type InseratZustand = (typeof INSERAT_ZUSTAND)[number];

/** Preis-Modus: fester Preis, Verhandlungsbasis oder Preis auf Anfrage. */
export const PREIS_MODUS = ['fest', 'vb', 'anfrage'] as const;
export type PreisModus = (typeof PREIS_MODUS)[number];

/** Lebenszyklus eines Inserats (vom Verkaeufer gesteuert). */
export const INSERAT_STATUS = ['aktiv', 'reserviert', 'verkauft', 'entfernt'] as const;
export type InseratStatus = (typeof INSERAT_STATUS)[number];

/** Sortier-Reihenfolge des Browse (Backend: BrowseInseratDto.sort). */
export const BROWSE_SORT = ['neu', 'preis_auf', 'preis_ab'] as const;
export type BrowseSort = (typeof BROWSE_SORT)[number];

/** Melde-Gruende (Spiegel des Backends: MELDUNG_GRUND, inkl. Chemie-Verbot). */
export const GERAETE_MELDE_GRUENDE = [
  'chemie_verboten',
  'spam',
  'betrug',
  'unangemessen',
  'sonstiges',
] as const;
export type MeldeGrund = (typeof GERAETE_MELDE_GRUENDE)[number];

/** Moderations-Status eines Inserats (Betreiber-Sicht; Backend: MODERATION_STATUS). */
export const MODERATION_STATUS = ['ok', 'verborgen', 'entfernt'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

/** Bearbeitungs-Status einer Meldung (Backend: MELDUNG_STATUS). */
export const MELDUNG_STATUS = ['offen', 'erledigt', 'verworfen'] as const;
export type MeldungStatus = (typeof MELDUNG_STATUS)[number];

/** Sentinel-„Melder" fuer automatische System-Meldungen (Backend: SYSTEM_MELDER_ID). */
export const SYSTEM_MELDER_ID = 'system';

/** Standard-Seitengroesse des Browse (Backend-Default: 24, max 60). */
export const BROWSE_LIMIT = 24;

/** Max. Bilder je Inserat (Backend: MAX_BILDER_PRO_INSERAT). */
export const MAX_BILDER = 8;

/** Preis-Obergrenze zum Tippfehler-Schutz (Backend: MAX_INSERAT_PREIS). */
export const MAX_PREIS = 1_000_000;

// --- Datentypen -----------------------------------------------------------

/** Referenz auf ein Galerie-Bild (fuer den auth Bild-Stream). */
export interface InseratBildRef {
  id: string;
  sortIndex?: number;
}

/**
 * Oeffentliche (kontaktfreie) Projektion eines Inserats fuer Browse/Detail.
 * `bilder` ist optional: liefert das Backend Bild-Referenzen mit, zeigt die UI
 * die Galerie – sonst greift der Gradient-Fallback.
 */
export interface InseratPublicView {
  id: string;
  titel: string;
  beschreibung: string;
  /** Richtung (angebot/gesuch). Bestand/aeltere Antworten ohne Feld -> angebot. */
  art?: string;
  kategorie: string;
  zustand: string;
  preis: number | string | null;
  preisModus: string;
  plzRegion: string | null;
  ort: string | null;
  status: string;
  createdAt: string;
  ablaufAm: string | null;
  bilder?: InseratBildRef[];
}

/** Volle Sicht auf ein EIGENES Inserat (Superset der oeffentlichen Sicht). */
export interface InseratFull extends InseratPublicView {
  tenantId?: string;
  userId?: string;
  moderationStatus?: string;
  updatedAt?: string;
}

/** Offengelegter Verkaeufer-Kontakt (Reveal-Endpunkt). */
export interface KontaktReveal {
  betriebsname: string;
  email: string | null;
  telefon: string | null;
  anschrift: string | null;
}

/** Paginierte Browse-Antwort (Backend: PaginatedResult<InseratPublicView>). */
export interface BrowseResult {
  data: InseratPublicView[];
  total: number;
  page: number;
  limit: number;
}

/** Generische paginierte Antwort (Backend: PaginatedResult<T>). */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Betreiber-Moderation (Plattform-Rollen) ------------------------------

/** Eine Meldung (Betreiber-Sicht; Backend-Entity GeraeteInseratMeldung). */
export interface GeraeteMeldung {
  id: string;
  inseratId: string;
  melderTenantId: string;
  melderUserId: string;
  grund: string;
  kommentar: string | null;
  status: string;
  bearbeitetVonUserId: string | null;
  bearbeitetAm: string | null;
  createdAt: string;
}

/** Meldung + Kurz-Projektion des betroffenen Inserats (Backend: MeldungMitInserat). */
export interface MeldungMitInserat {
  meldung: GeraeteMeldung;
  inserat: {
    id: string;
    tenantId: string;
    titel: string;
    status: string;
    moderationStatus: string;
  } | null;
}

/** Volles Inserat in der Betreiber-Moderation (inkl. verborgene/entfernte). */
export interface ModerationInserat extends InseratFull {
  moderationStatus: string;
}

// --- Anzeige-Maps (i18n-Keys) ---------------------------------------------

export const KATEGORIE_KEY: Record<string, string> = {
  poliermaschine: 'geraetemarkt.kategorie.poliermaschine',
  sauger_extraktor: 'geraetemarkt.kategorie.sauger_extraktor',
  plotter: 'geraetemarkt.kategorie.plotter',
  ir_kurzwellen_trockner: 'geraetemarkt.kategorie.ir_kurzwellen_trockner',
  hebebuehne: 'geraetemarkt.kategorie.hebebuehne',
  folier_werkzeug: 'geraetemarkt.kategorie.folier_werkzeug',
  druckluft_kompressor: 'geraetemarkt.kategorie.druckluft_kompressor',
  dampfreiniger: 'geraetemarkt.kategorie.dampfreiniger',
  messtechnik: 'geraetemarkt.kategorie.messtechnik',
  sonstiges_geraet: 'geraetemarkt.kategorie.sonstiges_geraet',
  auftragshilfe: 'geraetemarkt.kategorie.auftragshilfe',
  freie_kapazitaet: 'geraetemarkt.kategorie.freie_kapazitaet',
  restmaterial: 'geraetemarkt.kategorie.restmaterial',
};

/** i18n-Key je Richtung (Angebot/Gesuch). */
export const ART_KEY: Record<string, string> = {
  angebot: 'geraetemarkt.art.angebot',
  gesuch: 'geraetemarkt.art.gesuch',
};

/** Badge-Klasse je Richtung (Gesuch faellt bewusst staerker auf). */
export const ART_BADGE: Record<string, string> = {
  angebot: 'badge-info',
  gesuch: 'badge-caution',
};

/** i18n-Key je Umkreis-Stufe (grob, ehrlich beschriftet). '' = ueberall. */
export const UMKREIS_KEY: Record<string, string> = {
  '': 'geraetemarkt.umkreis.ueberall',
  '0': 'geraetemarkt.umkreis.nurRegion',
  '50': 'geraetemarkt.umkreis.km50',
  '100': 'geraetemarkt.umkreis.km100',
  '200': 'geraetemarkt.umkreis.km200',
};

export const ZUSTAND_KEY: Record<string, string> = {
  neu: 'geraetemarkt.zustand.neu',
  gebraucht: 'geraetemarkt.zustand.gebraucht',
  defekt: 'geraetemarkt.zustand.defekt',
};

/** Badge-Klasse je Zustand (kein sichtbarer Text – bleibt lokal). */
export const ZUSTAND_BADGE: Record<string, string> = {
  neu: 'badge-positive',
  gebraucht: 'badge-info',
  defekt: 'badge-caution',
};

export const STATUS_KEY: Record<string, string> = {
  aktiv: 'geraetemarkt.status.aktiv',
  reserviert: 'geraetemarkt.status.reserviert',
  verkauft: 'geraetemarkt.status.verkauft',
  entfernt: 'geraetemarkt.status.entfernt',
};

export const STATUS_BADGE: Record<string, string> = {
  aktiv: 'badge-positive',
  reserviert: 'badge-caution',
  verkauft: 'badge-neutral',
  entfernt: 'badge-danger',
};

export const PREIS_MODUS_KEY: Record<string, string> = {
  fest: 'geraetemarkt.preisModus.fest',
  vb: 'geraetemarkt.preisModus.vb',
  anfrage: 'geraetemarkt.preisModus.anfrage',
};

export const MELDE_GRUND_KEY: Record<string, string> = {
  chemie_verboten: 'geraetemarkt.melden.grund.chemie_verboten',
  spam: 'geraetemarkt.melden.grund.spam',
  betrug: 'geraetemarkt.melden.grund.betrug',
  unangemessen: 'geraetemarkt.melden.grund.unangemessen',
  sonstiges: 'geraetemarkt.melden.grund.sonstiges',
};

export const MODERATION_STATUS_KEY: Record<string, string> = {
  ok: 'plattformGeraetemarkt.modStatus.ok',
  verborgen: 'plattformGeraetemarkt.modStatus.verborgen',
  entfernt: 'plattformGeraetemarkt.modStatus.entfernt',
};

export const MODERATION_STATUS_BADGE: Record<string, string> = {
  ok: 'badge-positive',
  verborgen: 'badge-caution',
  entfernt: 'badge-danger',
};

export const MELDUNG_STATUS_KEY: Record<string, string> = {
  offen: 'plattformGeraetemarkt.meldStatus.offen',
  erledigt: 'plattformGeraetemarkt.meldStatus.erledigt',
  verworfen: 'plattformGeraetemarkt.meldStatus.verworfen',
};

export const MELDUNG_STATUS_BADGE: Record<string, string> = {
  offen: 'badge-caution',
  erledigt: 'badge-positive',
  verworfen: 'badge-neutral',
};

// --- Helfer ---------------------------------------------------------------

/** API-Pfad (relativ zu /api/v1) fuer den auth Bild-Stream eines Inserats. */
export function bildStreamPath(inseratId: string, bildId: string): string {
  return `/geraetemarkt/inserate/${inseratId}/bilder/${bildId}`;
}

/** Primaerbild eines Inserats (niedrigster sortIndex, sonst erstes). */
export function primaerBild(inserat: InseratPublicView): InseratBildRef | null {
  const bilder = inserat.bilder;
  if (!bilder || bilder.length === 0) return null;
  return [...bilder].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))[0];
}

/** Grober Standort als Text: "PLZ-Region · Ort" – best effort, sonst null. */
export function regionText(inserat: { plzRegion: string | null; ort: string | null }): string | null {
  const teile = [inserat.plzRegion ? `${inserat.plzRegion}…` : '', inserat.ort ?? '']
    .map((s) => s.trim())
    .filter(Boolean);
  return teile.length ? teile.join(' · ') : null;
}
