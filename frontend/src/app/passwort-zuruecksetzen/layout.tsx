import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: token-gebundenes Passwort-Zurücksetzen (sicherheitsrelevant).
// robots:{index:false,follow:false} als Defense-in-Depth ZUSÄTZLICH zum Disallow
// in robots.ts. Server-Layout, weil die Seite selbst eine Client-Komponente ist.
export const metadata = noindexMetadata();

export default function PasswortZuruecksetzenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
