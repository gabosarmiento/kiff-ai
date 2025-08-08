/* eslint-env node */
/* eslint-disable */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('@kiff/ui/tailwind.preset.cjs')],
  theme: { extend: {} },
  plugins: [],
};
