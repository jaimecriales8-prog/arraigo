import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Arraigo — Panel de Control',
  description: 'Sistema de monitoreo de arresto domiciliario',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
