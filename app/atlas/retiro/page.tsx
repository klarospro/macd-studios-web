import type { Metadata } from 'next'
import RetiroForm from './RetiroForm'

export const metadata: Metadata = {
  title: 'ATLAS — Solicitud de retiro de ganancias',
  description: 'Solicita el retiro de tus ganancias (trimestral o anual) gestionadas por ATLAS.',
}

export default function RetiroPage() {
  return (
    <div className="atlas min-h-screen antialiased">
      <RetiroForm />
    </div>
  )
}
