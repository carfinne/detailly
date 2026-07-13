import { appPath } from '@/lib/api';

/**
 * Dezenter Rechts-Footer der oeffentlichen Tenant-Seiten (Buchung/Status/Beleg).
 * Verlinkt das Impressum DES BETRIEBS (§ 5 DDG: auf jeder Seite erreichbar, max.
 * zwei Klicks). Der Link braucht den Betriebs-Slug; ohne Slug (Edge-Fall) bleibt
 * der Footer leer, statt auf ein falsches Impressum zu zeigen.
 *
 * Bewusst deutsch (kein i18n): das gesamte oeffentliche Buchungsportal ist
 * deutschsprachig, und die Impressums-Inhalte sind ohnehin Betriebsdaten.
 */
export function PublicLegalFooter({ slug }: { slug?: string | null }) {
  const s = (slug ?? '').trim();
  if (!s) return null;
  return (
    <footer className="mt-8 flex items-center justify-center">
      <a
        href={`${appPath('/impressum/betrieb/')}?b=${encodeURIComponent(s)}`}
        className="link-muted text-xs"
      >
        Impressum
      </a>
    </footer>
  );
}
