import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

// Body: Inter (klar, neutral). Display/Headlines: Sora (modern, technisch,
// passt zum edlen Automotive-Charakter) – bewusst eigenstaendige Paarung.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' });

export const metadata: Metadata = {
  title: 'Detailly',
  description: 'Werkstattsoftware fuer Aufbereitung, Folierung und PPF',
};

// Setzt Theme (hell/dunkel) + Bewegungsreduktion VOR dem ersten Paint aus
// localStorage – verhindert ein Aufblitzen des falschen Themas. Default = dunkel.
const themeInit = `(function(){try{var d=document.documentElement;if(localStorage.getItem('detailly_theme')==='light')d.setAttribute('data-theme','light');if(localStorage.getItem('detailly_reduce_motion')==='1')d.classList.add('dl-reduce-motion');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
