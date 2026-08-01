import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: login-gebundenes Händler-Portal (role=haendler) mit
// Betriebsdaten und Bestellungen. robots:{index:false,follow:false} als
// Defense-in-Depth ZUSÄTZLICH zum Disallow in robots.ts. Server-Layout, weil die
// Seite selbst eine Client-Komponente ist.
export const metadata = noindexMetadata();

export default function HaendlerPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
