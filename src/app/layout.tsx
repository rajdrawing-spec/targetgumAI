import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  fallback: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  fallback: ['IBM Plex Mono', 'Consolas', 'monospace'],
})

export const metadata: Metadata = {
  title: 'TargetGum AI Marketing OS — Precision Marketing Terminal',
  description: 'Precision AI Advertising, Social Media Management, and Unified Marketing Telemetry Platform.',
  icons: {
    icon: '/logo.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} dark h-full bg-[#09090B]`}
    >
      <body className="min-h-full flex flex-col bg-[#09090B] text-[#F8F8FA] font-sans antialiased selection:bg-[#E5252A] selection:text-[#FFFFFF]">
        {children}
      </body>
    </html>
  )
}
