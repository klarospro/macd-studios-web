import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card } from '@/components/admin/ui'
import AgentPanel from './AgentPanel'
import {
  runMarketingAgent,
  runNewProjectAgent,
  runUpdatesAgent,
  runProductionAgent,
  runCeoAgent,
} from './actions'

export const revalidate = 0

export default async function AgentsPage() {
  await requireSession()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agentes"
        subtitle="Equipo de IA de MACD Studios — cada uno con acceso a datos reales del panel, ninguno inventa cifras."
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-white font-medium">🎯 Ventas — Max</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Ya está corriendo en Telegram (@macdstudios_bot), fuera de este panel. Responde clientes, cotiza y avisa
            cuando un lead está caliente. Se administra desde n8n, no desde aquí.
          </p>
        </Card>

        <AgentPanel
          title="📣 Marketing"
          description="3 ideas de contenido para redes, listas para grabar esta semana."
          fields={[{ name: 'brief', placeholder: 'Tema (opcional) — ej: el nuevo Restaurant OS' }]}
          action={runMarketingAgent}
        />

        <AgentPanel
          title="🆕 Nuevos proyectos"
          description="Describe lo que pide un cliente potencial y te sugiere plan + borrador de propuesta."
          fields={[{ name: 'description', placeholder: 'Qué pide el cliente…' }]}
          action={runNewProjectAgent}
          buttonLabel="Sugerir"
        />

        <AgentPanel
          title="🏗️ Producción"
          description="Checklist de entrega según el plan que compró el cliente."
          fields={[
            { name: 'client_name', placeholder: 'Nombre del cliente' },
            { name: 'plan', placeholder: 'Plan comprado', type: 'select', options: ['Esencial', 'Profesional', 'Premium', 'Restaurant OS Básico', 'Restaurant OS Profesional', 'Restaurant OS Enterprise IA'] },
          ]}
          action={runProductionAgent}
        />

        <AgentPanel
          title="📊 Actualizaciones"
          description="Resumen de qué se movió esta semana en todos tus proyectos (datos reales de GitHub)."
          action={runUpdatesAgent}
        />

        <AgentPanel
          title="👔 CEO — briefing"
          description="Qué necesita tu atención esta semana: cobros pendientes, propuestas estancadas."
          action={runCeoAgent}
        />
      </div>
    </div>
  )
}
