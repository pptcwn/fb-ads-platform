import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '1.00', letterSpacing: '-0.05em', fontWeight: '600' }],
        'heading': ['32px', { lineHeight: '1.25', letterSpacing: '-0.04em', fontWeight: '600' }],
        'subheading': ['24px', { lineHeight: '1.33', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      letterSpacing: {
        'tight-geist': '-0.02em',
        'tighter': '-0.03em',
        'tightest': '-0.05em',
      },
      colors: {
        surface: {
          DEFAULT: '#000000',     // Vercel true black bg
          50: '#0a0a0a',          // sidebar bg
          100: '#111111',         // card bg
          200: '#1a1a1a',         // hover / secondary surface
          300: '#222222',         // border surface
          400: '#333333',         // stronger border
          500: '#444444',
        },
        ink: {
          DEFAULT: '#ededed',     // primary text
          50: '#d4d4d4',          // secondary text
          100: '#aaaaaa',         // muted text
          200: '#888888',         // placeholder
          300: '#666666',         // disabled
        },
        accent: {
          DEFAULT: '#0070f3',     // Vercel blue
          hover: '#0060df',
          muted: 'rgba(0, 112, 243, 0.10)',
          border: 'rgba(0, 112, 243, 0.25)',
        },
        // Vercel workflow colors
        develop: {
          DEFAULT: '#0a72ef',     // develop blue
          muted: 'rgba(10, 114, 239, 0.10)',
        },
        preview: {
          DEFAULT: '#de1d8d',     // preview pink
          muted: 'rgba(222, 29, 141, 0.10)',
        },
        ship: {
          DEFAULT: '#ff5b4f',     // ship red
          muted: 'rgba(255, 91, 79, 0.10)',
        },
        success: {
          DEFAULT: '#22c55e',
          muted: 'rgba(34, 197, 94, 0.10)',
          border: 'rgba(34, 197, 94, 0.25)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: 'rgba(245, 158, 11, 0.10)',
          border: 'rgba(245, 158, 11, 0.25)',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: 'rgba(239, 68, 68, 0.10)',
          border: 'rgba(239, 68, 68, 0.25)',
        },
      },
      boxShadow: {
        // Vercel shadow-as-border technique
        'border': '0px 0px 0px 1px rgba(255,255,255,0.08)',
        'border-light': '0px 0px 0px 1px rgba(255,255,255,0.05)',
        'border-accent': '0px 0px 0px 1px rgba(0,112,243,0.35)',
        'card': '0px 0px 0px 1px rgba(255,255,255,0.08), 0px 2px 2px rgba(0,0,0,0.3)',
        'card-hover': '0px 0px 0px 1px rgba(255,255,255,0.12), 0px 2px 4px rgba(0,0,0,0.4)',
        'elevated': '0px 0px 0px 1px rgba(255,255,255,0.08), 0px 4px 12px rgba(0,0,0,0.4)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
