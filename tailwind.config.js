/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sub: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'aurora-1': 'auroraOne 14s ease-in-out infinite alternate',
        'aurora-2': 'auroraTwo 18s ease-in-out infinite alternate',
        'aurora-3': 'auroraThree 20s ease-in-out infinite alternate',
        'pulse-subtle': 'pulseSubtle 6s ease-in-out infinite',
      },
      keyframes: {
        auroraOne: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(60px, -40px) scale(1.15)' },
          '100%': { transform: 'translate(-30px, 50px) scale(0.95)' },
        },
        auroraTwo: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(-70px, 60px) scale(1.2)' },
          '100%': { transform: 'translate(40px, -30px) scale(0.9)' },
        },
        auroraThree: {
          '0%': { transform: 'translate(0px, 0px) scale(0.9)' },
          '50%': { transform: 'translate(40px, 50px) scale(1.1)' },
          '100%': { transform: 'translate(-50px, -30px) scale(1.05)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.75' },
        },
      },
    },
  },
  plugins: [],
}
