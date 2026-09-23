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
        'workshop-dark': '#0b0f14',
        'workshop-surface': '#151b23',
        'workshop-surface-hover': '#1c2530',
        'workshop-border': '#262f3b',
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
