/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a0c',
          card: 'rgba(18, 18, 24, 0.7)',
          accent: '#00f2fe',
          emerald: '#00f5a0',
          dark: '#030303',
          border: 'rgba(255, 255, 255, 0.08)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 242, 254, 0.25)',
        'glow-emerald': '0 0 15px rgba(0, 255, 160, 0.25)',
      }
    },
  },
  plugins: [],
}
