import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { CityProvider } from '@/context/CityContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '🐾 Meows',
  description: 'A community map of stray cats around the world. Add photos, stories, and discover cats near you.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='85'>🐱</text></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#fffaf8]`}>
        <CityProvider>
          <Navbar />
          {children}
        </CityProvider>
      </body>
    </html>
  )
}
