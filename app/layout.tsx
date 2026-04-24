import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { CityProvider } from '@/context/CityContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Meows of Mumbai',
  description: "A community map of Mumbai's stray cats",
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
