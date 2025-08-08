/* eslint-env node */
/* eslint-disable */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        'spin': 'spin 1s linear infinite',
      }
    }
  },
  plugins: [],
};
