// Uebergabe der Kalkulation an den Auftrags-Anlage-Flow ("Als Auftrag
// uebernehmen"). Der Nutzer kalkuliert die Positionen und uebernimmt sie mit
// einem Klick in einen vorbefuellten Auftrag – statt jede Zeile von Hand
// abzutippen. Die Nutzdaten reisen ueber sessionStorage (Positionen passen
// nicht sinnvoll in URL-Parameter); der Trigger selbst ist der Query-Param
// `?uebernahme=1` auf der Auftrags-Seite.

/** sessionStorage-Schluessel fuer die Kalkulations-Uebernahme (Kalk -> Auftrag). */
export const UEBERNAHME_STORAGE_KEY = 'detailly_kalk_uebernahme';

/** Eine uebernommene Position (Beschreibung + Menge + Einzelpreis, netto). */
export interface UebernahmePosition {
  beschreibung: string;
  menge: number;
  einzelpreis: number;
}

/** Nutzdaten, die die Kalkulation an den Auftrags-Anlage-Flow uebergibt. */
export interface UebernahmePayload {
  /** ServiceType des Auftrags (aufbereitung | folierung | ppf), aus dem Katalog. */
  serviceType: string;
  items: UebernahmePosition[];
}

/**
 * Baut aus den aktuell angezeigten Kalkulations-Zeilen die Auftrags-Positionen.
 * Jede Kalk-Position ist ein Ganzteil-Preis (keine eigene Mengen-Achse) -> Menge 1,
 * Einzelpreis = exakt der kalkulierte Zeilenpreis. Dadurch gilt per Konstruktion:
 *   Σ (menge × einzelpreis) === Kalkulations-Netto
 * (die Summe der uebernommenen Positionen stimmt mit der Kalkulation ueberein).
 * Die Keramik-Option wird – wenn zugeschaltet – als zusaetzliche Position mit
 * ihrer berechneten Summe angehaengt. Reine Funktion, kein Seiteneffekt.
 */
export function buildUebernahmePayload(input: {
  serviceType: string;
  zeilen: { beschreibung: string; einzelpreis: number }[];
  keramik?: { beschreibung: string; einzelpreis: number } | null;
}): UebernahmePayload {
  const items: UebernahmePosition[] = input.zeilen.map((z) => ({
    beschreibung: z.beschreibung,
    menge: 1,
    einzelpreis: z.einzelpreis,
  }));
  if (input.keramik) {
    items.push({ beschreibung: input.keramik.beschreibung, menge: 1, einzelpreis: input.keramik.einzelpreis });
  }
  return { serviceType: input.serviceType, items };
}

/**
 * Liest + verbraucht (entfernt) die uebergebenen Nutzdaten aus sessionStorage.
 * Defensiv: gesperrter/kaputter Speicher oder Fremdformat -> null (kein Absturz).
 * Sanitisiert die Positionen (Strings/Zahlen), damit nur valide Werte ankommen.
 */
export function consumeUebernahmePayload(): UebernahmePayload | null {
  try {
    const raw = sessionStorage.getItem(UEBERNAHME_STORAGE_KEY);
    sessionStorage.removeItem(UEBERNAHME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UebernahmePayload>;
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((it): it is UebernahmePosition => !!it && typeof it.beschreibung === 'string')
          .map((it) => ({
            beschreibung: String(it.beschreibung),
            menge: Number(it.menge) || 1,
            einzelpreis: Number(it.einzelpreis) || 0,
          }))
      : [];
    if (items.length === 0) return null;
    return {
      serviceType: typeof parsed.serviceType === 'string' ? parsed.serviceType : 'aufbereitung',
      items,
    };
  } catch {
    return null;
  }
}
