'use client';

// Geteilte Bausteine des Marktplatz-Shops (Katalog-Seite + Produktdetailseite):
// Herkunfts-Flagge (dependency-frei), Sterne-Aggregat, authentifizierte Galerie-
// Bilder (Buy-Side-Stream über Bearer-Token, lazy), Gradient-Fallback sowie ein
// progressiv-verbessernder View-Transition-Navigator. Bewusst KEINE zusätzliche
// Abhängigkeit – nur Tailwind/SVG/Browser-APIs.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFileUrl } from '@/lib/api';
import type { MarketplaceBestandStatus, MarketplaceProduct } from '@/lib/types';

// ---------------------------------------------------------------------------
// Bereich- & Bestand-Maps (i18n-Keys, crash-sicher via `?? wert`).
// ---------------------------------------------------------------------------

export const BER_KEY: Record<string, string> = {
  folierung: 'marktplatz.bereich.folierung',
  aufbereitung: 'marktplatz.bereich.aufbereitung',
  ppf: 'marktplatz.bereich.ppf',
  sonstiges: 'marktplatz.bereich.sonstiges',
};

export const BESTAND_BADGE: Record<MarketplaceBestandStatus, string> = {
  verfuegbar: 'badge-positive',
  wenig: 'badge-caution',
  ausverkauft: 'badge-danger',
};

export const BESTAND_KEY: Record<MarketplaceBestandStatus, string> = {
  verfuegbar: 'marktplatz.bestand.verfuegbar',
  wenig: 'marktplatz.bestand.wenig',
  ausverkauft: 'marktplatz.bestand.ausverkauft',
};

/** Preis als Zahl (decimal-String tolerant); ohne Preis -> null. */
export function preisWert(p: Pick<MarketplaceProduct, 'preis'>): number | null {
  return p.preis == null ? null : Number(p.preis);
}

// ---------------------------------------------------------------------------
// Herkunfts-Flagge: ISO-3166-1 alpha-2 -> zwei Regional-Indicator-Codepoints.
// Reine Funktion, KEIN Icon-Paket. Ungültig/leer -> leerer String.
// ---------------------------------------------------------------------------

const REGIONAL_A = 0x1f1e6; // Regional Indicator Symbol Letter A
const LETTER_A = 65; // 'A'

/** 'DE' -> 🇩🇪. Ungültige/leere Eingabe -> ''. */
export function flaggeEmoji(iso?: string | null): string {
  const code = (iso ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    REGIONAL_A + (code.charCodeAt(0) - LETTER_A),
    REGIONAL_A + (code.charCodeAt(1) - LETTER_A),
  );
}

/** Lokalisierter Ländername via Intl.DisplayNames; Fallback = ISO-Code. */
export function landName(iso: string | null | undefined, lang: string): string {
  const code = (iso ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Herkunfts-Chip: Flagge (dekorativ) + Ländername. Auf Systemen ohne Flaggen-
 * Rendering (z. B. Windows) bleibt der Ländername als klarer Kontext stehen.
 */
export function Herkunft({
  iso,
  lang,
  className,
}: {
  iso: string | null | undefined;
  lang: string;
  className?: string;
}) {
  const flag = flaggeEmoji(iso);
  const name = landName(iso, lang);
  if (!name) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      {flag && (
        <span aria-hidden="true" className="leading-none">
          {flag}
        </span>
      )}
      <span>{name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sterne-Aggregat: 5 Sterne mit partieller Kupfer-Füllung (halbe Sterne exakt).
// ---------------------------------------------------------------------------

function SternRow({ className }: { className: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Bewertungs-Aggregat. `label` (aria) beschreibt Schnitt + Anzahl. Ohne
 * Bewertungen (anzahl<=0) rendert nichts – der Aufrufer zeigt dann optional
 * einen dezenten "neu"-Hinweis.
 */
export function Sterne({
  schnitt,
  anzahl,
  label,
  compact,
  className,
}: {
  schnitt: number;
  anzahl: number;
  label: string;
  /** Ohne Zahl-Suffix (nur die Sterne). */
  compact?: boolean;
  className?: string;
}) {
  if (!anzahl || anzahl <= 0) return null;
  const pct = Math.max(0, Math.min(100, (schnitt / 5) * 100));
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={label} aria-label={label}>
      <span className="relative inline-flex">
        <SternRow className="text-ink-600" />
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
          <SternRow className="text-copper" />
        </span>
      </span>
      {!compact && (
        <span className="text-xs text-chrome-500">
          {schnitt.toFixed(1)} <span className="text-chrome-600">({anzahl})</span>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bilder: eleganter Gradient-Fallback + authentifizierter, lazy Galerie-Stream.
// ---------------------------------------------------------------------------

/** API-Pfad des Galerie-Bild-Streams (Buy-Side, tenant-geschützt, cached). */
export function bildPfad(productId: string, imageId: string): string {
  return `/marketplace/products/${productId}/bild/${imageId}`;
}

/** Gradient-Kachel mit Produkt-Initiale – ruhiger Platzhalter ohne Bild. */
export function GradientFallback({ text, className }: { text?: string; className?: string }) {
  return (
    <div className={`grid h-full w-full place-items-center bg-copper-grad ${className ?? ''}`}>
      <span className="font-display text-5xl font-bold text-ink-950/70">
        {(text?.charAt(0) || '?').toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Galerie-Bild über die authentifizierte Stream-Route. <img src> sendet keinen
 * Bearer-Header, deshalb per fetch als Blob (Object-URL, bei Unmount/Wechsel
 * freigegeben). Lazy: der fetch startet erst, wenn die Kachel in Sichtnähe kommt
 * (IntersectionObserver) – so lädt ein großes Raster nicht alle Bilder sofort.
 */
export function StreamBild({
  path,
  alt,
  className,
  fallback,
  eager,
}: {
  path: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
  /** Sofort laden (z. B. Detail-Hero „above the fold"). */
  eager?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sichtbar, setSichtbar] = useState(!!eager);
  const wrapRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<string | null>(null);

  // Sichtbarkeit beobachten (nur solange noch nicht geladen).
  useEffect(() => {
    if (sichtbar) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSichtbar(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSichtbar(true);
          io.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sichtbar]);

  // Blob laden, sobald sichtbar; Object-URL sauber freigeben.
  useEffect(() => {
    if (!sichtbar) return;
    let aktiv = true;
    setFailed(false);
    authedFileUrl(path)
      .then((u) => {
        if (!aktiv) {
          URL.revokeObjectURL(u);
          return;
        }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = u;
        setSrc(u);
      })
      .catch(() => {
        if (aktiv) setFailed(true);
      });
    return () => {
      aktiv = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setSrc(null);
    };
  }, [sichtbar, path]);

  return (
    <div ref={wrapRef} className="h-full w-full">
      {failed ? (
        fallback
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- authentifizierter Blob-Stream
        <img src={src} alt={alt} className={className} />
      ) : (
        <div className="skeleton h-full w-full rounded-none" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Primärbild einer Produktkarte: bevorzugt das erste Galerie-Bild über die
 * authentifizierte Stream-Route; fällt auf ein externes `bildUrl` und zuletzt
 * auf den Gradient-Platzhalter zurück.
 */
export function KatalogBild({
  p,
  className,
  eager,
}: {
  p: MarketplaceProduct;
  className?: string;
  eager?: boolean;
}) {
  const [extKaputt, setExtKaputt] = useState(false);
  const cls =
    className ??
    'h-full w-full object-cover transition-transform duration-220 ease-emphasized group-hover:scale-[1.04]';
  const bildId = p.bilder && p.bilder.length > 0 ? p.bilder[0].id : null;

  if (bildId) {
    return (
      <StreamBild
        path={bildPfad(p.id, bildId)}
        alt={p.name}
        className={cls}
        eager={eager}
        fallback={<GradientFallback text={p.name} />}
      />
    );
  }
  if (p.bildUrl && !extKaputt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- externes Händler-Bild, statischer Export
      <img
        src={p.bildUrl}
        alt={p.name}
        loading="lazy"
        onError={() => setExtKaputt(true)}
        className={cls}
      />
    );
  }
  return <GradientFallback text={p.name} />;
}

// ---------------------------------------------------------------------------
// Bewegung: reduced-motion-Hook + View-Transition-Navigator (progressive enh.).
// ---------------------------------------------------------------------------

/** True, wenn der Nutzer „Bewegung reduzieren" gewählt hat. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

type StartViewTransition = (cb: () => void) => void;

/**
 * Navigations-Hook für Liste->Detail. Nutzt die View-Transitions-API, wenn
 * verfügbar und Bewegung erlaubt ist (sanfter Crossfade/Morph), sonst normale
 * Navigation (unsere Mount-Animationen greifen als CSS-Fallback).
 */
export function useViewNav(): (href: string) => void {
  const router = useRouter();
  const reduced = useReducedMotion();
  return useCallback(
    (href: string) => {
      const doc = typeof document !== 'undefined'
        ? (document as unknown as { startViewTransition?: StartViewTransition })
        : null;
      if (doc?.startViewTransition && !reduced) {
        doc.startViewTransition(() => router.push(href));
      } else {
        router.push(href);
      }
    },
    [router, reduced],
  );
}
