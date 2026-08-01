import { buildMetadata } from '@/lib/seo';

// Server-Layout nur für die Metadaten (die Seite selbst ist eine Client-
// Komponente). Öffentliche Login-Seite – indexierbar.
export const metadata = buildMetadata({
  title: 'Anmelden',
  description:
    'Melde dich bei Detailly an – der Werkstatt-Software für Aufbereitung, Folierung und PPF.',
  path: '/login/',
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
