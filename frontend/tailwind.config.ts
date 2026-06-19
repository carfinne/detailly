import type { Config } from 'tailwindcss';

// Detailly Design-System (eigenstaendig entwickelt).
// Edles, dunkles Automotive-Theme mit EINER Akzentfarbe (warmes Kupfer/Bernstein).
// Bewusst anders als Wettbewerber: keine konkurrierenden Mehrfach-Markenfarben,
// stattdessen ruhige neutrale Flaechen + ein einziger metallischer Akzent.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Neutrale, tief-anthrazite Flaechen (leicht blau-graphitfarbener Unterton).
        ink: {
          950: '#070809', // tiefster Hintergrund
          900: '#0B0D11', // App-Hintergrund
          850: '#101319', // erhöhte Flaeche
          800: '#151922', // Karten
          750: '#1B202B', // Karten (hover/alt)
          700: '#232936', // Rahmen kraeftig
          600: '#2E3543', // Rahmen
          500: '#3A4252', // Trennlinien hell
        },
        // Text-Hierarchie auf dunklem Grund (WCAG-geprueft).
        chrome: {
          50: '#F4F6FA', // primärer Text
          200: '#C4CAD6', // sekundärer Text
          400: '#8A93A6', // gedämpfter Text
          600: '#5A6273', // Platzhalter / tertiär
        },
        // EINZIGER Akzent: warmes Kupfer/Bernstein (metallisch, automotive).
        copper: {
          DEFAULT: '#E8923B',
          50: '#FBEFE1',
          300: '#F2B877',
          400: '#EDA455',
          500: '#E8923B',
          600: '#D27C26',
          700: '#A85F18',
          soft: 'rgba(232,146,59,0.12)',
          glow: 'rgba(232,146,59,0.28)',
        },
        // Semantische Farben (nur wo fachlich noetig).
        positive: { DEFAULT: '#4FB477', soft: 'rgba(79,180,119,0.14)' },
        caution: { DEFAULT: '#E0A93B', soft: 'rgba(224,169,59,0.14)' },
        danger: { DEFAULT: '#E06A6A', soft: 'rgba(224,106,106,0.14)' },
        info: { DEFAULT: '#5B9BD5', soft: 'rgba(91,155,213,0.14)' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.7)',
        pop: '0 24px 60px -20px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(232,146,59,0.35), 0 8px 30px -8px rgba(232,146,59,0.25)',
      },
      backgroundImage: {
        'copper-grad': 'linear-gradient(135deg, #F2B877 0%, #E8923B 45%, #D27C26 100%)',
        'ink-fade': 'linear-gradient(180deg, rgba(21,25,34,0.9) 0%, rgba(11,13,17,0.6) 100%)',
        'hairline': 'linear-gradient(90deg, transparent, rgba(232,146,59,0.5), transparent)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'count-up': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
