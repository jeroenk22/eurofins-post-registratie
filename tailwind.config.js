/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ef: {
          blue:         '#003883',
          'blue-light': '#e8eef8',
          'blue-mid':   '#6271a8',
          orange:       '#ff7b27',
          'orange-light': '#fff3ec',
        },
        mi: {
          green:        '#1a5c2a',
          'green-light':'#edf7ef',
          yellow:       '#f5c800',
          'yellow-light':'#fffbe6',
        },
      },
    },
  },
  plugins: [],
}
