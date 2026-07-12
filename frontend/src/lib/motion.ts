// Gemeinsamer Motion-Helfer. Bewusst ohne React/DOM-Abhaengigkeit, damit ihn
// sowohl die Landing (page.tsx) als auch App-Komponenten (CountUp) teilen.

/**
 * true, wenn Animationen erwuenscht sind: sowohl die System-Einstellung
 * (prefers-reduced-motion) als auch die persoenliche "Bewegung reduzieren"-
 * Option (Klasse .dl-reduce-motion auf <html>) muessen Bewegung zulassen.
 * SSR-/Export-sicher: ohne window wird false zurueckgegeben.
 */
export function motionOk(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !document.documentElement.classList.contains('dl-reduce-motion')
  );
}
