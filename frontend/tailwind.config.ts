import type { Config } from 'tailwindcss';

// Detailly Design-System (eigenstaendig entwickelt).
// Edles, dunkles Automotive-Theme mit EINER Akzentfarbe (warmes Kupfer/Bernstein).
// Bewusst anders als Wettbewerber: keine konkurrierenden Mehrfach-Markenfarben,
// stattdessen ruhige neutrale Flaechen + ein einziger metallischer Akzent.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // Farben als CSS-Variablen (Kanal-Format "R G B" -> /<alpha-value> bleibt
      // nutzbar). Die konkreten Werte je Thema (dunkel = Default, hell) stehen in
      // globals.css unter :root bzw. [data-theme='light']. So re-themed die ganze
      // App ueber EIN Wurzel-Attribut, ohne dass Komponenten angefasst werden.
      colors: {
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          750: 'rgb(var(--ink-750) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
        },
        chrome: {
          50: 'rgb(var(--chrome-50) / <alpha-value>)',
          100: 'rgb(var(--chrome-100) / <alpha-value>)',
          200: 'rgb(var(--chrome-200) / <alpha-value>)',
          300: 'rgb(var(--chrome-300) / <alpha-value>)',
          400: 'rgb(var(--chrome-400) / <alpha-value>)',
          500: 'rgb(var(--chrome-500) / <alpha-value>)',
          600: 'rgb(var(--chrome-600) / <alpha-value>)',
        },
        copper: {
          DEFAULT: 'rgb(var(--copper-500) / <alpha-value>)',
          50: 'rgb(var(--copper-50) / <alpha-value>)',
          300: 'rgb(var(--copper-300) / <alpha-value>)',
          400: 'rgb(var(--copper-400) / <alpha-value>)',
          500: 'rgb(var(--copper-500) / <alpha-value>)',
          600: 'rgb(var(--copper-600) / <alpha-value>)',
          700: 'rgb(var(--copper-700) / <alpha-value>)',
          soft: 'var(--copper-soft)',
          glow: 'var(--copper-glow)',
        },
        positive: { DEFAULT: 'rgb(var(--positive) / <alpha-value>)', soft: 'var(--positive-soft)' },
        caution: { DEFAULT: 'rgb(var(--caution) / <alpha-value>)', soft: 'var(--caution-soft)' },
        danger: { DEFAULT: 'rgb(var(--danger) / <alpha-value>)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'rgb(var(--info) / <alpha-value>)', soft: 'var(--info-soft)' },
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
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        glow: 'var(--shadow-glow)',
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
        'fade-in': 'fade-in 0.35s cubic-bezier(0.2, 0, 0, 1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      // Bewegungs-System: eine "emphasized"-Signaturkurve + abgestufte Dauern.
      transitionTimingFunction: {
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '220': '220ms',
      },
    },
  },
  plugins: [],
};

export default config;
