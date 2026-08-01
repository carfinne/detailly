import { buildMetadata } from '@/lib/seo';

// Server-Layout nur für die Metadaten (die Seite selbst ist eine Client-
// Komponente). Öffentliches Bewerbungsformular für Lieferanten – indexierbar.
export const metadata = buildMetadata({
  title: 'Für Großhändler & Lieferanten',
  description:
    'Verkaufe deine Produkte an Aufbereitungs-, Folier- und PPF-Betriebe – direkt im Marktplatz der Detailly-Werkstattsoftware. Jetzt als Lieferant bewerben.',
  path: '/grosshaendler/',
});

export default function GrosshaendlerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
