/**
 * Geteilte IP-Helfer (Sentinel Teil 2). Bewusst frei von Nest-/DB-Abhaengigkeiten,
 * damit sie in Middleware, Service UND Tests direkt nutzbar sind.
 *
 * Die Loopback-Logik ist IDENTISCH zur (privaten) Variante im LoginGuardService
 * aus Teil 1 – Teil 1 bleibt unberuehrt (kein Refactoring seiner getesteten
 * Interna), die neue Abwehr nutzt diese geteilten Helfer.
 */

/** Leert IPv4-mapped-IPv6-Praefix (::ffff:) + normalisiert (trim/lowercase). */
export function normalizeIp(ip: string | undefined | null): string {
  let s = (ip ?? '').trim().toLowerCase();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}

/** Loopback? (127.0.0.0/8, ::1, localhost). */
export function isLoopback(ip: string | undefined | null): boolean {
  const s = normalizeIp(ip);
  return s === '::1' || s === 'localhost' || s.startsWith('127.');
}

/**
 * Haertungssichere Allowlist-Ausnahme (identisch zum LoginGuard): ausgenommen
 * ist eine Anfrage NUR, wenn der ECHTE Socket-Peer loopback ist UND die (ggf.
 * ueber trust proxy aufgeloeste) Client-IP ebenfalls loopback ist.
 *
 * Warum beide? Der Socket-Peer ist nicht ueber X-Forwarded-For faelschbar; ein
 * gespoofter `X-Forwarded-For: 127.0.0.1` bei public Socket faellt daher nie in
 * die Ausnahme. Zugleich bleibt der Schutz hinter einem Same-Host-Reverse-Proxy
 * (Socket = 127.0.0.1) fuer echte Remote-Clients (Client-IP != loopback) aktiv –
 * sonst wuerde jede Anfrage hinter dem Proxy als loopback durchgewinkt.
 */
export function isAllowlistedPeer(
  clientIp: string | undefined | null,
  socketIp: string | undefined | null,
): boolean {
  return !!socketIp && isLoopback(socketIp) && isLoopback(clientIp);
}
