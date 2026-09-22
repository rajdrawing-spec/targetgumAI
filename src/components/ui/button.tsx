import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  // 2026-09-22 (docs/DECISIONS.md, Duolingo-style redesign): `primary`
  // and `destructive` get a tactile "press" shadow (a solid offset that
  // collapses on :active, like a physical button) instead of a flat hover
  // color change - shared here so it applies everywhere <Button> is used,
  // not just the Growth Map.
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color,filter] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-press hover:brightness-105 active:translate-y-[2px] active:shadow-press-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        outline: 'border-2 border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        destructive:
          'bg-destructive text-primary-foreground shadow-[0_3px_0_0_rgba(185,28,28,1)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(185,28,28,1)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
