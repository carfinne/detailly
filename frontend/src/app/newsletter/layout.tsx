import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: Newsletter-Bestätigung/-Abmeldung sind token-/personenbezogene
// Vorgänge ohne Content-Wert. Dieses Layout deckt via Vererbung
// /newsletter/bestaetigen/ UND /newsletter/abmelden/ ab.
// robots:{index:false,follow:false} als Defense-in-Depth ZUSÄTZLICH zum Disallow
// in robots.ts. Server-Layout, weil die Seiten selbst Client-Komponenten sind.
export const metadata = noindexMetadata();

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
