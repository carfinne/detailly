import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: interne Sperr-/Statusseite eines Kontos (kein Content-Wert).
// robots:{index:false,follow:false} als Defense-in-Depth ZUSÄTZLICH zum Disallow
// in robots.ts. Server-Layout, weil die Seite selbst eine Client-Komponente ist.
export const metadata = noindexMetadata();

export default function AboGesperrtLayout({ children }: { children: React.ReactNode }) {
  return children;
}
