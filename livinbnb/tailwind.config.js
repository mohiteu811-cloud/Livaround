/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f4ddb1',
          300: '#ecc47f',
          400: '#e3a54d',
          500: '#d98a2e',
          600: '#c07022',
          700: '#9f551e',
          800: '#82451f',
          900: '#6b3a1d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
