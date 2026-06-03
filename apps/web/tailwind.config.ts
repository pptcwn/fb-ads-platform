import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: {
        border: 'var(--border)',
      },
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
          DEFAULT: '#000000',     // Vercel Minimalism: true black bg
          50: '#0a0a0a',          // sidebar bg - deep black
          100: '#0f0f0f',         // card bg - minimalist deep gray
          200: '#1a1a1a',         // hover / secondary surface
          300: '#262626',         // border/divider - subtle
          400: '#333333',         // stronger border
          500: '#444444',
        },
        ink: {
          DEFAULT: '#f5f5f5',     // primary text - near white for high contrast
          50: '#e5e5e5',          // secondary text - light gray
          100: '#b0b0b0',         // muted text - medium gray
          200: '#808080',         // placeholder - darker gray
          300: '#606060',         // disabled - muted gray
        },
        accent: {
          DEFAULT: '#0070f3',     // Vercel blue (minimal use)
          hover: '#0060df',
          muted: 'rgba(0, 112, 243, 0.08)',
          border: 'rgba(0, 112, 243, 0.2)',
        },
        success: {
          DEFAULT: '#22c55e',
          muted: 'rgba(34, 197, 94, 0.08)',
          border: 'rgba(34, 197, 94, 0.2)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: 'rgba(245, 158, 11, 0.08)',
          border: 'rgba(245, 158, 11, 0.2)',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: 'rgba(239, 68, 68, 0.08)',
          border: 'rgba(239, 68, 68, 0.2)',
        },
      },
      boxShadow: {
        'border': '0px 0px 0px 1px rgba(255,255,255,0.06)',
        'border-light': '0px 0px 0px 1px rgba(255,255,255,0.03)',
        'border-accent': '0px 0px 0px 1px rgba(0,112,243,0.2)',
        'card': '0px 0px 0px 1px rgba(255,255,255,0.06)',
        'card-hover': '0px 0px 0px 1px rgba(255,255,255,0.10), 0px 2px 4px rgba(0,0,0,0.5)',
        'elevated': '0px 0px 0px 1px rgba(255,255,255,0.06), 0px 4px 12px rgba(0,0,0,0.4)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
