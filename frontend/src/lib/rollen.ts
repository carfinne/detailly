// Rollen-Gruppen: EINE Quelle für Sichtbarkeits- und Rechte-Checks im
// Frontend (Navigation, Karten, Seiten). Die eigentliche Wahrheit sind die
// Backend-Guards – diese Listen müssen dazu passen und steuern nur, was
// angezeigt wird.

/** Leitung: darf Verwaltung, Auswertungen, Kosten/Marge sehen. */
export const LEITUNG_ROLLEN = ['platform_admin', 'owner', 'manager'];

/** Empfang/Leitung: bearbeitet Online-Terminanfragen (wie Backend-Endpoint). */
export const EMPFANG_ROLLEN = [...LEITUNG_ROLLEN, 'receptionist'];

/** Inhaber-Ebene: Betriebsdaten und Abo. */
export const INHABER_ROLLEN = ['platform_admin', 'owner'];

/** Detailly-Plattform-Team (Analysen, Marktplatz-Pflege, Support, Abos). */
export const PLATTFORM_ROLLEN = ['platform_admin', 'platform_analyst', 'platform_support'];
