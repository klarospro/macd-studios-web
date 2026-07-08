import type { Metadata } from 'next'
import SolicitudForm from './SolicitudForm'

export const metadata: Metadata = {
  title: 'ATLAS — Solicitud de acceso privado',
  description:
    'Solicite acceso a ATLAS. Revisamos cada solicitud personalmente; al aprobarse recibe el dossier de la firma y acceso a su dashboard de metodología.',
}

export default function SolicitudPage() {
  return (
    <div className="atlas min-h-screen antialiased">
      <SolicitudForm />
    </div>
  )
}
