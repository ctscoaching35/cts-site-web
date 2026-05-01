import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette officielle CTS — non négociable
        teal: {
          DEFAULT: '#0C6E5F',
          dark: '#085044',
          light: '#138F7C',
        },
        indigo: {
          DEFAULT: '#2F2D4E',
          dark: '#1F1D38',
          soft: '#3F3D6A',
        },
        sand: {
          DEFAULT: '#F3F7F0',
          dark: '#E8EFE3',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'sans-serif'],
        display: ['var(--font-montserrat)', 'sans-serif'],
      },
      letterSpacing: {
        'cts': '0.15em',
        'cts-tight': '0.08em',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 1.2s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
