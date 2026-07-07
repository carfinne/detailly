// Single Source of Truth fuer die Bauteil-Taxonomie (Paket B1 / T-019).
//
// Frueher divergierten drei Listen mit eigenen partId-/zone-Bezeichnern:
//   - 3D  `Scene3D.tsx`         (PARTS,           z. B. `stossfaenger_vorne`)
//   - 2D  `Fallback2D`          (PART_ANCHORS_2D, gleiche 3D-Namen, Teilmenge)
//   - 2D  `FahrzeugDiagramm`    (ZONEN,           z. B. `stossstange_v`)
//
// Diese Datei ist ab jetzt die EINE Quelle: kanonische partId-Liste + deutsche
// Labels + grobe Seiten-Zuordnung. Alle drei Konsumenten referenzieren sie.
//
// WICHTIG — Rueckwaertskompatibilitaet: bereits gespeicherte DamageItems
// (`partId`) und Annahme-Marker (`zone`) tragen die alten Werte. Sie MUESSEN
// weiterhin korrekt aufloesen (Label + Rendering). Dafuer sorgt PART_ID_ALIASES
// (alt -> kanonisch) zusammen mit den alias-toleranten Helfern unten. Es findet
// KEINE Daten-Migration statt; alte Werte werden nur zur Laufzeit aufgeloest.
//
// Kanonik-Entscheidung: die 3D-partIds (`<bauteil>_<seite>` mit vl|vr|hl|hr)
// gelten laut Konzept (docs/KONZEPT_2D_3D_Zusammenfuehrung.md) als kanonisch.
// Sie bleiben daher unveraendert = Identitaet (0 Risiko fuer gespeicherte
// 3D-Schaeden). Die abweichenden 2D-Annahme-Zonen werden per Alias gebrueckt.

export type VehicleSide = 'vorne' | 'hinten' | 'links' | 'rechts' | 'mitte';

export interface VehiclePart {
  /** Kanonische partId. */
  id: string;
  /** Deutsche Anzeige. */
  label: string;
  /** Grobe Lage am Fahrzeug (fuer Filter/Sortierung nutzbar). */
  side: VehicleSide;
  /** Scheibe/Glas statt Blech (Rendering-Hinweis, z. B. 3D-Transparenz). */
  glass?: boolean;
}

// Kanonische Bauteil-Liste. Reihenfolge = fachliche Anordnung Front -> Heck.
export const VEHICLE_PARTS: VehiclePart[] = [
  // --- Front ---
  { id: 'stossfaenger_vorne', label: 'Stoßfänger vorne', side: 'vorne' },
  { id: 'motorhaube', label: 'Motorhaube', side: 'vorne' },
  { id: 'kotfluegel_vl', label: 'Kotflügel vorne links', side: 'links' },
  { id: 'kotfluegel_vr', label: 'Kotflügel vorne rechts', side: 'rechts' },
  { id: 'windschutzscheibe', label: 'Windschutzscheibe', side: 'vorne', glass: true },
  // --- Dach ---
  { id: 'dach', label: 'Dach', side: 'mitte' },
  // --- Tueren ---
  { id: 'tuer_vl', label: 'Tür vorne links', side: 'links' },
  { id: 'tuer_vr', label: 'Tür vorne rechts', side: 'rechts' },
  { id: 'tuer_hl', label: 'Tür hinten links', side: 'links' },
  { id: 'tuer_hr', label: 'Tür hinten rechts', side: 'rechts' },
  // --- Seitenscheiben ---
  { id: 'seitenscheibe_l', label: 'Seitenscheibe links', side: 'links', glass: true },
  { id: 'seitenscheibe_r', label: 'Seitenscheibe rechts', side: 'rechts', glass: true },
  // --- Aussenspiegel ---
  { id: 'aussenspiegel_l', label: 'Außenspiegel links', side: 'links' },
  { id: 'aussenspiegel_r', label: 'Außenspiegel rechts', side: 'rechts' },
  // --- Schweller ---
  { id: 'schweller_l', label: 'Schweller links', side: 'links' },
  { id: 'schweller_r', label: 'Schweller rechts', side: 'rechts' },
  // --- Hintere Seitenwand (= "Kotfluegel hinten"/Radlauf hinten) ---
  { id: 'seitenwand_hl', label: 'Seitenwand hinten links', side: 'links' },
  { id: 'seitenwand_hr', label: 'Seitenwand hinten rechts', side: 'rechts' },
  // --- Heck ---
  { id: 'heckscheibe', label: 'Heckscheibe', side: 'hinten', glass: true },
  { id: 'heckklappe', label: 'Heckklappe', side: 'hinten' },
  { id: 'stossfaenger_hinten', label: 'Stoßfänger hinten', side: 'hinten' },
];

// Schneller Zugriff nach kanonischer id.
const PART_BY_ID: Record<string, VehiclePart> = Object.fromEntries(
  VEHICLE_PARTS.map((p) => [p.id, p]),
);

/**
 * Alias-Map: alte/abweichende partId- bzw. zone-Werte -> kanonische id.
 *
 * Quelle der Alt-Werte: die frueheren `FahrzeugDiagramm`-ZONEN. Alle 3D-partIds
 * sind bereits kanonisch (Identitaet) und brauchen KEINEN Alias. Nur hier
 * gelistete Alt-Werte werden umgebogen; unbekannte Werte reicht der Helfer
 * unveraendert durch (nie "unsichtbar").
 */
export const PART_ID_ALIASES: Record<string, string> = {
  // Stoßstange (2D) == Stoßfänger (kanonisch)
  stossstange_v: 'stossfaenger_vorne',
  stossstange_h: 'stossfaenger_hinten',
  // Windschutz-Kurzform
  windschutz: 'windschutzscheibe',
  // Seitenfenster (2D) == Seitenscheibe (kanonisch)
  fenster_l: 'seitenscheibe_l',
  fenster_r: 'seitenscheibe_r',
  // Spiegel-Kurzform
  spiegel_l: 'aussenspiegel_l',
  spiegel_r: 'aussenspiegel_r',
  // "Kotfluegel hinten" (2D-Annahme) und "Seitenwand hinten" (3D-Kanon) meinen
  // dieselbe hintere Seitenpartie/den Radlauf hinten. Fachlich nicht 100 %
  // deckungsgleich, aber die beste konservative Zuordnung -> kanonische
  // Seitenwand, damit Alt-Marker ein sinnvolles Label behalten.
  kotfluegel_hl: 'seitenwand_hl',
  kotfluegel_hr: 'seitenwand_hr',
};

/** Loest eine (evtl. veraltete) partId/zone auf die kanonische id auf. */
export function canonicalPartId(id: string | null | undefined): string {
  if (!id) return '';
  if (PART_BY_ID[id]) return id; // bereits kanonisch
  return PART_ID_ALIASES[id] ?? id; // Alias oder unveraendert durchreichen
}

/**
 * Deutsches Label zu einer partId/zone – alias-tolerant. Faellt auf die
 * (kanonisierte) id zurueck, falls kein Label bekannt ist, damit ein Wert nie
 * leer bzw. "unsichtbar" wird.
 */
export function partLabel(id: string | null | undefined): string {
  if (!id) return '';
  const canonical = canonicalPartId(id);
  return PART_BY_ID[canonical]?.label ?? canonical;
}

/** Volle kanonische Bauteil-Definition (alias-tolerant), sonst undefined. */
export function getVehiclePart(id: string | null | undefined): VehiclePart | undefined {
  if (!id) return undefined;
  return PART_BY_ID[canonicalPartId(id)];
}

/** Alle kanonischen partIds (z. B. fuer Whitelist/Tests). */
export const VEHICLE_PART_IDS: string[] = VEHICLE_PARTS.map((p) => p.id);
