import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--primary) / <alpha-value>)',
        background: 'hsl(var(--bg-page) / <alpha-value>)',
        foreground: 'hsl(var(--text-primary) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: '#FFFFFF',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
          tint: 'hsl(var(--primary-tint) / <alpha-value>)',
        },
        brand: {
          crimson: '#E5252A',
          dark: '#CC1B20',
          onyx: '#09090B',
          surface: '#121215',
          subtle: '#18181C',
          border: '#27272A',
        },
        secondary: {
          DEFAULT: 'hsl(var(--surface-hover) / <alpha-value>)',
          foreground: 'hsl(var(--text-primary) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--surface-hover) / <alpha-value>)',
          foreground: 'hsl(var(--text-secondary) / <alpha-value>)',
        },
        caption: 'hsl(var(--text-muted) / <alpha-value>)',
        accent: {
          DEFAULT: 'hsl(var(--primary-tint) / <alpha-value>)',
          foreground: 'hsl(var(--primary) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--bg-surface) / <alpha-value>)',
          foreground: 'hsl(var(--text-primary) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--sage-text) / <alpha-value>)',
          bg: 'hsl(var(--sage-tint) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--mustard-text) / <alpha-value>)',
          bg: 'hsl(var(--mustard-tint) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.15)',
        },
        info: {
          DEFAULT: 'hsl(var(--dusty-blue-text) / <alpha-value>)',
          bg: 'hsl(var(--dusty-blue-tint) / <alpha-value>)',
        },
        sage: 'hsl(var(--sage) / <alpha-value>)',
        dustyBlue: 'hsl(var(--dusty-blue) / <alpha-value>)',
        mustard: 'hsl(var(--mustard) / <alpha-value>)',
        blush: 'hsl(var(--blush) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
        // 2026-09-22 (docs/DECISIONS.md, Duolingo-style redesign) - softened
        // from a near-opaque dark shadow (0.35 alpha) to a gentle lift that
        // reads on light AND dark surfaces, matching the mockup's soft cards
        // instead of the previous "ops terminal" hard-edged panels.
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 8px 20px -12px rgb(0 0 0 / 0.18)',
        'card-hover': '0 2px 4px 0 rgb(0 0 0 / 0.06), 0 16px 32px -12px rgb(0 0 0 / 0.22)',
        popover: '0 10px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.15)',
        glow: '0 0 25px -4px rgba(229, 37, 42, 0.45)',
        // Tactile "press" shadow for primary buttons - see button.tsx.
        press: '0 3px 0 0 hsl(var(--primary-hover))',
        'press-sm': '0 1px 0 0 hsl(var(--primary-hover))',
      },
      // Growth Map (docs/DECISIONS.md 2026-09-22) - the mascot's idle bob,
      // the "current stage" node's pulse, and the streak flame's flicker.
      // Reached only via `motion-safe:` at call sites, never applied bare.
      keyframes: {
        sway: {
          '0%, 100%': { transform: 'rotate(0deg) translateY(0)' },
          '50%': { transform: 'rotate(-2.5deg) translateY(-4px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(229, 37, 42, 0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgba(229, 37, 42, 0)' },
        },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(-3deg)' },
          '50%': { transform: 'scale(1.12) rotate(3deg)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Lesson engine (docs/DECISIONS.md 2026-09-24): celebration hop,
        // gentle wrong-answer shake, XP pop-in, and falling confetti.
        hop: {
          '0%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-10px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.6) translateY(8px)' },
          '60%': { opacity: '1', transform: 'scale(1.08) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        confetti: {
          '0%': { opacity: '0', transform: 'translateY(-20px) rotate(0deg)' },
          '10%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(220px) rotate(540deg)' },
        },
      },
      animation: {
        sway: 'sway 3.6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 1.8s ease-in-out infinite',
        flicker: 'flicker 1.8s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out both',
        hop: 'hop 0.9s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
        pop: 'pop 0.45s ease-out both',
        confetti: 'confetti 1.8s ease-in forwards',
      },
    },
  },
  plugins: [],
}

export default config
