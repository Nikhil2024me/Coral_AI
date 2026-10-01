/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
        silkscreen: ['"Silkscreen"', 'monospace'],
        vt323: ['"VT323"', 'monospace'],
        display: ['"Press Start 2P"', 'monospace'],
        sub: ['"Silkscreen"', 'monospace'],
      },
      colors: {
        brand: {
          dark: '#080511',
          card: 'rgba(21, 13, 37, 0.65)',
          border: 'rgba(168, 85, 247, 0.16)',
          borderHover: 'rgba(192, 132, 252, 0.45)',
          accent: '#9333ea',
          accentLight: '#c084fc',
          glow: '#7c3aed',
        },
      },
      boxShadow: {
        'glow-subtle': '0 0 60px -15px rgba(147, 51, 234, 0.35)',
        'glass': '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'retro-btn': '0 5px 0 #334155, 0 10px 20px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
