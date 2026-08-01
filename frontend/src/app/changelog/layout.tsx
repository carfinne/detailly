import { buildMetadata } from '@/lib/seo';

// Server-Layout nur fuer die Metadaten (die Seite selbst ist eine Client-
// Komponente wegen i18n). Sauberer Seitentitel + OG/Canonical fuer die Route.
export const metadata = buildMetadata({
  title: 'Was ist neu',
  description:
    'Versionshistorie und Produkt-Updates von Detailly – neue Funktionen, Verbesserungen und Korrekturen der Werkstatt-Software für Aufbereitung, Folierung und PPF.',
  path: '/changelog/',
});

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
