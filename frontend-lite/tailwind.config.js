/* eslint-env node */
/* eslint-disable */
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Ensure dark styles apply only when our app sets data-theme="dark"
  // This prevents auto-switching based on system preference on pages using `dark:` classes
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      // Motion tokens
      transitionTimingFunction: {
        live: 'cubic-bezier(.22,.61,.36,1)', // snappy ease
      },
      transitionDuration: {
        fast: '150ms',
        base: '220ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        spin: 'spin 1s linear infinite',
        'fade-up': 'fade-up .38s var(--ease-live, cubic-bezier(.22,.61,.36,1)) both',
        pop: 'pop .18s ease-out both',
      },
      boxShadow: {
        lift: '0 12px 32px -12px rgb(0 0 0 / 0.18)',
      },
    }
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      "lofi",
      {
        kiff: {
          "primary": "#2563eb",
          "primary-content": "#ffffff",
          "secondary": "#9333ea",
          "accent": "#22c55e",
          "neutral": "#1f2937",
          "base-100": "#ffffff",
          "base-200": "#f3f4f6",
          "base-300": "#e5e7eb",
          "info": "#38bdf8",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        }
      },
      "light",
      "dark"
    ],
    logs: false,
  },
};
