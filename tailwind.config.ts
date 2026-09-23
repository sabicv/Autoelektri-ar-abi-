import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Industrial dark "workshop mode" for the mechanic dashboard.
        // Kept far apart on purpose: background near-black, cards
        // noticeably lighter, so the toggle reads as an obvious change.
        'workshop-dark': '#070a0d',
        'workshop-surface': '#1a222c',
        'workshop-surface-hover': '#242f3d',
        'workshop-border': '#33404f',
        'alarm-red': '#dc2626',
        'electric-blue': '#0ea5ff',
        // Explicit job-status semantic colors.
        status: {
          collected: '#059669',
          progress: '#d97706',
          alarm: '#dc2626',
          diagnostic: '#0ea5ff',
        },
      },
      boxShadow: {
        lift: '0 8px 24px -8px rgb(0 0 0 / 0.18)',
        'lift-dark': '0 8px 24px -8px rgb(0 0 0 / 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
