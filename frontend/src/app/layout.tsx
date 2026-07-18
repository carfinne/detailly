import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';

// Body: Inter (klar, neutral). Display/Headlines: Sora (modern, technisch,
// passt zum edlen Automotive-Charakter) – bewusst eigenstaendige Paarung.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' });

export const metadata: Metadata = {
  title: {
    default: 'Detailly – Die Werkstatt-Software für Aufbereitung, Folierung & PPF',
    template: '%s · Detailly',
  },
  description:
    'Kunden, Fahrzeuge, Aufträge, Plantafel, 3D-Schadenserfassung und GoBD-konforme Rechnungen – alles in einer Software. DSGVO-konform, ohne Installation, 14 Tage kostenlos testen.',
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
const themeInit = `(function(){try{var d=document.documentElement;if(localStorage.getItem('detailly_theme')==='light')d.setAttribute('data-theme','light');if(localStorage.getItem('detailly_reduce_motion')==='1')d.classList.add('dl-reduce-motion');}catch(e){}})();`;

// Registriert den Service-Worker rein progressiv: nur im Browser, erst nach load,
// mit Fehler-Catch. Blockiert nie den ersten Render.
const swRegister = `(function(){if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${sora.variable}`}>
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
