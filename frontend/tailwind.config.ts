import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dunkles, elegantes Automotive-Theme
        base: {
          900: '#0b0f1a',
          800: '#11162a',
          700: '#1a2138',
          600: '#232c47',
          500: '#2f3a5c',
        },
        accent: {
          DEFAULT: '#e94560',
          hover: '#d63451',
          soft: 'rgba(233,69,96,0.12)',
        },
        muted: '#8b95b3',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
