/**
 * Bruecke Inspektion -> Auftrag ("Als Auftrag uebernehmen", Welle 2-A).
 *
 * Reine, DB-freie Abbildungslogik: aus den dokumentierten Schaeden einer
 * 3D-Inspektion wird EIN Positionsvorschlag je Schaden gebaut. Der aufrufende
 * Service laedt Inspektion + Schaeden tenant-scoped und uebergibt die bereits
 * geladenen Objekte – die Mandantentrennung bleibt in der Service-Schicht.
 *
 * WICHTIG: Hier wird NICHTS erfunden. Ist am Schaden keine `kostenSchaetzung`
 * gepflegt, ist der Einzelpreis 0 und die Position als "Preis fehlt" markiert –
 * die UI weist den Nutzer darauf hin, die Preise vor dem Speichern zu ergaenzen.
 * Der Vorschlag ist ein READ-ONLY-Projekt: er legt KEINEN Auftrag an. Angelegt
 * wird erst nach Bestaetigung im vorbefuellten Anlage-Dialog (POST /orders).
 */

/** Deutsche Labels der Schadensart (Spiegel der DamageArt-Enums). */
const ART_LABEL: Record<string, string> = {
  kratzer: 'Kratzer',
  delle: 'Delle',
  steinschlag: 'Steinschlag',
  lackschaden: 'Lackschaden',
  rost: 'Rost',
  riss: 'Riss',
  bruch: 'Bruch',
  verzogen: 'Verzogen',
  fehlteil: 'Fehlteil',
  sonstiges: 'Sonstiges',
};

/** Minimale Sicht auf die Inspektion (kein Entity-Koppeln). */
export interface UebernahmeInspektionInput {
  customerId: string;
  vehicleId?: string | null;
}

/** Minimale Sicht auf einen dokumentierten Schaden. */
export interface UebernahmeSchadenInput {
  partId?: string | null;
  partLabel?: string | null;
  art?: string | null;
  notiz?: string | null;
  /** decimal aus der DB -> kommt i. d. R. als String (oder null). */
  kostenSchaetzung?: string | number | null;
}

/** Eine vorgeschlagene Auftrags-Position aus genau EINEM Schaden. */
export interface UebernahmePosition {
  beschreibung: string;
  menge: number;
  einzelpreis: number;
  /** true = am Schaden war keine kostenSchaetzung gepflegt (Einzelpreis = 0). */
  preisFehlt: boolean;
}

/** Vorbefuellungs-Nutzdaten fuer den Auftrags-Anlage-Dialog. */
export interface InspektionUebernahme {
  /** Default-Leistungsart des Auftrags (Schadenreparatur -> Aufbereitung). */
  serviceType: string;
  customerId: string;
  vehicleId: string | null;
  /** true = mindestens eine Position ohne gepflegten Preis -> UI-Hinweis. */
  preiseUnvollstaendig: boolean;
  items: UebernahmePosition[];
}

/**
 * Verdichtet einen Schaden zu einer lesbaren Positions-Beschreibung, z. B.
 * "Kotflügel vorne links — Kratzer" bzw. mit Notiz
 * "Kotflügel vorne links — Kratzer (Streifer 20 cm)".
 */
export function schadenBeschreibung(item: UebernahmeSchadenInput): string {
  const bauteil = (item.partLabel || item.partId || 'Fahrzeug').trim();
  const art = ART_LABEL[item.art ?? ''] ?? (item.art ? String(item.art) : 'Schaden');
  const basis = `${bauteil} — ${art}`;
  const notiz = item.notiz?.trim();
  return notiz ? `${basis} (${notiz})` : basis;
}

/**
 * Normalisiert die decimal-Kostenschaetzung zu einem endlichen Betrag >= 0.
 * null/''/NaN/negativ -> 0 (nichts erfinden). Liefert zusaetzlich, ob ein
 * gepflegter Preis fehlte (fuer den UI-Hinweis).
 */
function preisAusSchaetzung(wert: string | number | null | undefined): {
  einzelpreis: number;
  preisFehlt: boolean;
} {
  if (wert === null || wert === undefined || wert === '') {
    return { einzelpreis: 0, preisFehlt: true };
  }
  const n = Number(wert);
  if (!Number.isFinite(n) || n < 0) return { einzelpreis: 0, preisFehlt: true };
  return { einzelpreis: n, preisFehlt: false };
}

/**
 * Baut den Positionsvorschlag aus einer Inspektion + ihren Schaeden. Genau EINE
 * Position je Schaden (Menge 1). Reine Funktion, kein Seiteneffekt, kein DB-Zugriff.
 */
export function buildInspektionUebernahme(
  inspektion: UebernahmeInspektionInput,
  schaeden: UebernahmeSchadenInput[],
): InspektionUebernahme {
  const items: UebernahmePosition[] = schaeden.map((s) => {
    const { einzelpreis, preisFehlt } = preisAusSchaetzung(s.kostenSchaetzung);
    return {
      beschreibung: schadenBeschreibung(s),
      menge: 1,
      einzelpreis,
      preisFehlt,
    };
  });
  return {
    // Schadenreparatur laeuft fachlich unter Aufbereitung; im Dialog aenderbar.
    serviceType: 'aufbereitung',
    customerId: inspektion.customerId,
    vehicleId: inspektion.vehicleId ?? null,
    preiseUnvollstaendig: items.some((it) => it.preisFehlt),
    items,
  };
}
