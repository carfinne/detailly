import { buildMetadata } from '@/lib/seo';

// Server-Layout nur für die Metadaten (die Seite selbst ist eine Client-
// Komponente). Öffentliche Registrierung – indexierbar.
export const metadata = buildMetadata({
  title: 'Kostenlos registrieren',
  description:
    'Detailly 14 Tage kostenlos testen – ohne Kreditkarte. Die Werkstatt-Software für Aufbereitung, Folierung und PPF ist in Minuten startklar.',
  path: '/registrieren/',
});

export default function RegistrierenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
