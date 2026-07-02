/**
 * Steuer-Konstanten.
 *
 * Deutscher Regel-Mehrwertsteuersatz (19 %) – zentral, damit Auftrags-Kalkulation
 * (OrdersService) und die automatische Auftrags-Anlage aus Online-Anfragen
 * (BookingRequestsService, T-004) garantiert mit demselben Satz rechnen.
 */
export const MWST_SATZ = 0.19;
