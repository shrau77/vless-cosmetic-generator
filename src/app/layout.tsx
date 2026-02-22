import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VLESS Config Generator',
  description: 'Профессиональный генератор VLESS конфигураций с косметическими настройками',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
