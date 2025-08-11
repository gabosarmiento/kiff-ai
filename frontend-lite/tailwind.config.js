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
      animation: {
        'spin': 'spin 1s linear infinite',
      }
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
