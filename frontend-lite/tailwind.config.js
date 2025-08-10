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
  plugins: [],
};
