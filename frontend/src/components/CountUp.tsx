'use client';

import { useEffect, useRef } from 'react';
import { motionOk } from '@/lib/motion';

/**
 * Zahl zaehlt beim ersten Sichtbarwerden von 0 auf `to` hoch (ease-out-cubic,
 * rAF, IntersectionObserver-getriggert). Der Endwert wird sofort gerendert
 * (No-JS/SEO-/Reduced-Motion-sicher) - nur mit JS UND erlaubter Bewegung wird
 * animiert. Geteilt zwischen Landing (page.tsx) und <StatCard> (Kennzahlen).
 */
export function CountUp({ to, duration = 1300 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionOk() || typeof IntersectionObserver === 'undefined') return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(el);
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            el.textContent = String(Math.round(to * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className="tnum">
      {to}
    </span>
  );
}
