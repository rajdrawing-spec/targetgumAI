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
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--primary) / <alpha-value>)',
        background: 'hsl(var(--bg-page) / <alpha-value>)',
        foreground: 'hsl(var(--text-primary) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--bg-surface) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
          tint: 'hsl(var(--primary-tint) / <alpha-value>)',
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
          DEFAULT: 'hsl(var(--rose-text) / <alpha-value>)',
          bg: 'hsl(var(--rose-tint) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--dusty-blue-text) / <alpha-value>)',
          bg: 'hsl(var(--dusty-blue-tint) / <alpha-value>)',
        },
        // Raw swatches (not text-safe on their own - use for dots/icons/
        // borders, not small text) plus the AI-content-only badge color.
        sage: 'hsl(var(--sage) / <alpha-value>)',
        dustyBlue: 'hsl(var(--dusty-blue) / <alpha-value>)',
        mustard: 'hsl(var(--mustard) / <alpha-value>)',
        rose: 'hsl(var(--rose) / <alpha-value>)',
        ai: {
          DEFAULT: 'hsl(var(--lavender-text) / <alpha-value>)',
          bg: 'hsl(var(--lavender-tint) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        popover: '0 4px 16px -4px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
