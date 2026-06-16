/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── خطوط النظام ──────────────────────────────────────────────────────
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        cairo:   ['Cairo', 'sans-serif'],
      },
      // ── نظام الألوان ─────────────────────────────────────────────────────
      colors: {
        brand: {
          // Professional crimson — warm, trustworthy
          red:        '#C0392B',
          'red-light':'#E74C3C',
          'red-soft': 'rgba(192,57,43,0.08)',
          // Royal / institutional blue — confident, educational
          blue:        '#1A56DB',
          'blue-light':'#2563EB',
          'blue-soft': 'rgba(26,86,219,0.08)',
          white:       '#FFFFFF',
        },
        // Landing Page surface tokens
        lp: {
          bg:          '#FFFFFF',
          'bg-subtle': '#F8FAFF',
          'bg-muted':  '#F1F5F9',
          surface:     '#FFFFFF',
          border:      '#E2E8F0',
          'border-strong': '#CBD5E1',
          'text-primary':   '#0F172A',
          'text-secondary': '#475569',
          'text-muted':     '#94A3B8',
        },
        // Dark Dashboard palette — unchanged
        dark: {
          900: '#070B14',
          800: '#0D1117',
          700: '#131A27',
          600: '#1A2235',
          500: '#243044',
          400: '#2E3D55',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          strong:  'rgba(255,255,255,0.12)',
          border:  'rgba(255,255,255,0.10)',
        },
        neon: {
          blue: '#1A56DB',
          red:  '#E74C3C',
          cyan: '#00F5D4',
        },
      },
      // ── Glassmorphism Backdrop ────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
      // ── الظلال ───────────────────────────────────────────────────────────
      boxShadow: {
        'glass':       '0 8px 32px rgba(0,0,0,0.36)',
        'neon-blue':   '0 0 20px rgba(26,86,219,0.30)',
        'neon-red':    '0 0 20px rgba(192,57,43,0.35)',
        'card-hover':  '0 20px 60px rgba(0,0,0,0.5)',
        'inner-glow':  'inset 0 1px 0 rgba(255,255,255,0.1)',
        // Landing page shadows
        'lp-card':     '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'lp-hover':    '0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        'lp-blue':     '0 4px 16px rgba(26,86,219,0.20)',
        'lp-red':      '0 4px 16px rgba(192,57,43,0.18)',
      },
      // ── الحركات ──────────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.6s ease forwards',
        'slide-up':   'slideUp 0.5s ease forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
}
