/**
 * Zentrale Versions-Konstanten der Rechtsdokumente (AGB / Datenschutzerklaerung /
 * Auftragsverarbeitungsvertrag). Die Registrierung speichert je Betrieb den
 * Zeitpunkt der Zustimmung (SERVERSEITIG) zusammen mit der hier gueltigen Version
 * als revisionssicheren Nachweis (Art. 7 Abs. 1 DSGVO Rechenschaft, Art. 28 AVV).
 *
 * WICHTIG: Wird ein Dokument inhaltlich geaendert, MUSS die zugehoerige Version
 * hier hochgezaehlt werden. So laesst sich spaeter erkennen, welche Betriebe der
 * NEUEN Fassung noch zustimmen muessen (Neuzustimmungs-Kampagne) – der Vergleich
 * `tenant.agbVersion !== AGB_VERSION` liefert die Kandidaten.
 *
 * Format bewusst als schlichter, sortierbarer Datums-String (YYYY-MM-DD) der
 * jeweiligen Fassung – keine DB-Migration noetig, wenn sich nur der Wert aendert.
 */
export const AGB_VERSION = '2026-07-01';
export const DSE_VERSION = '2026-07-01';
export const AVV_VERSION = '2026-07-01';
