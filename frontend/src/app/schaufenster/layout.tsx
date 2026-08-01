import { buildMetadata } from '@/lib/seo';

// Server-Layout nur für die Metadaten (die Seite selbst ist eine Client-
// Komponente). Öffentliches, PII-freies Schaufenster – indexierbar.
export const metadata = buildMetadata({
  title: 'Schaufenster – Vorher-Nachher-Referenzen',
  description:
    'Echte Vorher-Nachher-Ergebnisse aus Aufbereitung, Folierung und PPF – geteilt von Betrieben, die mit Detailly arbeiten.',
  path: '/schaufenster/',
});

export default function SchaufensterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
