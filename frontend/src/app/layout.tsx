import type { Metadata, Viewport } from 'next';
import { Inter, Sora, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

// Body: Inter (klar, neutral). Display/Headlines: Sora (modern, technisch,
// passt zum edlen Automotive-Charakter) – bewusst eigenstaendige Paarung.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' });
// Arabisch (RTL): Inter/Sold decken KEINE arabischen Glyphen (nur latin-Subset).
// Noto Sans Arabic wird – wie Inter/Sora – von next/font zur Build-Zeit
// selbst-gehostet (kein zusaetzliches npm-Paket, eigenes unicode-range fuer
// Arabisch). Als CSS-Variable --font-arabic; globals.css stellt sie unter
// dir="rtl"/lang="ar" der Schrift-Kaskade voran.
const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const APP_TITLE = 'Detailly – Die Werkstatt-Software für Aufbereitung, Folierung & PPF';
const APP_DESCRIPTION =
  'Kunden, Fahrzeuge, Aufträge, Plantafel, 3D-Schadenserfassung und GoBD-konforme Rechnungen – alles in einer Software. DSGVO-konform, ohne Installation, 14 Tage kostenlos testen.';

export const metadata: Metadata = {
  // Löst relative OG-/Canonical-URLs gegen die konfigurierbare Basis-URL auf.
  // NEXT_PUBLIC_SITE_URL MUSS vor dem Go-Live gesetzt werden (siehe lib/seo.ts)!
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_TITLE,
    template: '%s · Detailly',
  },
  description: APP_DESCRIPTION,
  // Selbst-Kanonisierung der Startseite. Jede öffentliche Unterseite überschreibt
  // dies mit ihrem eigenen Pfad (buildMetadata in lib/seo.ts).
  alternates: { canonical: '/' },
  // Open Graph / Twitter als globaler Standard – damit geteilte Links (WhatsApp,
  // soziale Netze) auch auf noch nicht einzeln gepflegten Seiten ordentlich
  // aussehen. Öffentliche Unterseiten überschreiben Titel/Beschreibung/URL.
  openGraph: {
    type: 'website',
    siteName: 'Detailly',
    locale: 'de_DE',
    url: SITE_URL,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [{ url: '/icon.svg' }],
  },
  twitter: {
    card: 'summary',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ['/icon.svg'],
  },
  // PWA: Manifest (erzeugt <link rel="manifest">) + Favicon aus dem Marken-Icon.
  // apple-touch-icon zeigt best-effort auf das SVG (iOS bevorzugt PNG 180x180 –
  // offener Design-Task, siehe PR); harmlos, falls iOS es ignoriert.
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

// Theme-Color der Browser-/Status-Leiste an das Farbschema gekoppelt: dunkler
// Ink-Grund (#0B0D11 = --ink-900 dunkel) bzw. heller App-Grund (#ECEFF4 =
// --ink-900 im Hell-Thema). Statischer Export -> kein Hydration-Mismatch.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0D11' },
    { media: '(prefers-color-scheme: light)', color: '#ECEFF4' },
  ],
};

// Setzt Theme (hell/dunkel) + Bewegungsreduktion VOR dem ersten Paint aus
// localStorage – verhindert ein Aufblitzen des falschen Themas. Default = dunkel.
// Zusaetzlich: Schreibrichtung VOR dem ersten Paint aus der gespeicherten Sprache
// ableiten (Arabisch = RTL), damit das Layout beim Reload nicht von LTR nach RTL
// springt. Muss mit dirForLang() im i18n-Provider konsistent bleiben.
const themeInit = `(function(){try{var d=document.documentElement;if(localStorage.getItem('detailly_theme')==='light')d.setAttribute('data-theme','light');if(localStorage.getItem('detailly_reduce_motion')==='1')d.classList.add('dl-reduce-motion');var l=localStorage.getItem('detailly.lang');if(l==='ar'){d.lang='ar';d.dir='rtl';}}catch(e){}})();`;

// Registriert den Service-Worker rein progressiv: nur im Browser, erst nach load,
// mit Fehler-Catch. Blockiert nie den ersten Render.
const swRegister = `(function(){if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" dir="ltr" className={`${inter.variable} ${sora.variable} ${notoArabic.variable}`}>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
