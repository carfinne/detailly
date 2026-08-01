import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: token-gebundenes Händler-Portal (?t=…) mit Betriebsdaten –
// Produkte, Bestellungen und Provisionssatz hinter einem geheimen Link. Das ist
// KEINE Marketing-Seite (entgegen der ursprünglichen Auftragsliste).
// robots:{index:false,follow:false} als Defense-in-Depth ZUSÄTZLICH zum Disallow
// in robots.ts. Server-Layout, weil die Seite selbst eine Client-Komponente ist.
export const metadata = noindexMetadata();

export default function HaendlerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
