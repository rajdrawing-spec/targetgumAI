import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TargetGum AI Marketing OS',
  description: 'Multi-tenant AI-powered operating system for a digital marketing agency.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
