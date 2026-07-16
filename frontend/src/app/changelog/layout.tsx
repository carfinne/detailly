import type { Metadata } from 'next';

// Server-Layout nur fuer die Metadaten (die Seite selbst ist eine Client-
// Komponente wegen i18n). Sauberer Seitentitel fuer die oeffentliche Route.
export const metadata: Metadata = {
  title: 'Was ist neu',
  description:
    'Versionshistorie und Produkt-Updates von Detailly – neue Funktionen, Verbesserungen und Korrekturen der Werkstatt-Software für Aufbereitung, Folierung und PPF.',
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
