/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050814',
          900: '#070B19',
          850: '#0A1128',
          800: '#0F1A36',
          700: '#16234D',
          600: '#1E3066',
        },
        cyan: {
          neon: '#00F2FE',
          electric: '#00D2FF',
          glow: 'rgba(0, 242, 254, 0.25)',
        },
        aquablue: {
          DEFAULT: '#4FACFE',
          dark: '#0072FF',
        },
        status: {
          normal: '#00E676',
          warning: '#FFB300',
          critical: '#FF1744',
          offline: '#607D8B',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 242, 254, 0.35)',
        'neon-cyan-lg': '0 0 25px rgba(0, 242, 254, 0.5)',
        'neon-red': '0 0 15px rgba(255, 23, 68, 0.4)',
        'neon-amber': '0 0 15px rgba(255, 179, 0, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 242, 254, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 242, 254, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
