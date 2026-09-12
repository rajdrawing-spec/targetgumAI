import type { Metadata } from 'next'
import { Space_Grotesk, IBM_Plex_Mono, Public_Sans } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} ${publicSans.variable} dark h-full bg-[#09090B]`}
    >
      <body className="min-h-full flex flex-col bg-[#09090B] text-[#F4F4F6] font-sans antialiased selection:bg-[#E5252A] selection:text-[#FFFFFF]">
        {children}
      </body>
    </html>
  )
}
