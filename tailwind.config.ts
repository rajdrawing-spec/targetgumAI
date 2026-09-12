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
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.25)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.35), 0 1px 2px -1px rgb(0 0 0 / 0.35)',
        'card-hover': '0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 4px 10px -2px rgba(0, 0, 0, 0.3)',
        popover: '0 10px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
        glow: '0 0 25px -4px rgba(229, 37, 42, 0.45)',
      },
    },
  },
  plugins: [],
}

export default config
