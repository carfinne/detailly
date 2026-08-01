import { noindexMetadata } from '@/lib/seo';

// KEIN Suchindex: hinter diesem Link stehen echte Kundendaten (Token-Zugang).
// robots:{index:false,follow:false} als Defense-in-Depth ZUSÄTZLICH zum Disallow
// in robots.ts. Server-Layout, weil die Seite selbst eine Client-Komponente ist
// (dort ist kein export const metadata möglich).
export const metadata = noindexMetadata();

export default function MappeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
