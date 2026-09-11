import { PageHeader, Card, Badge } from '@/components/admin/ui'

const ENV_CHECKS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase anon key' },
  { key: 'ADMIN_EMAIL', label: 'Email autorizado del panel' },
  { key: 'MERCURY_API_TOKEN', label: 'Mercury API token' },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key' },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret' },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key' },
  { key: 'RESEND_API_KEY', label: 'Resend API key (envío de facturas)' },
]

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" />

      <Card className="max-w-2xl">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">MACD Studios LLC</h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Entidad</dt>
            <dd>MACD Studios LLC — Wyoming, EE. UU.</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">EIN</dt>
            <dd>30-1502570</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Tipo fiscal</dt>
            <dd>Foreign-owned U.S. disregarded entity — Form 5472 + pro forma 1120</dd>
          </div>
        </dl>
      </Card>

      <Card className="max-w-2xl">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Integraciones</h2>
        <ul className="space-y-2 text-sm">
          {ENV_CHECKS.map(({ key, label }) => {
            const configured = !!process.env[key]
            return (
              <li key={key} className="flex items-center justify-between border-b border-[#1a1a1a] pb-2">
                <span className="text-zinc-300">{label}</span>
                <Badge tone={configured ? 'positive' : 'muted'}>{configured ? 'Configurado' : 'Pendiente'}</Badge>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-zinc-600 mt-4">
          Las variables pendientes se rellenan en <code className="text-zinc-500">.env.local</code> (y en Vercel para producción).
        </p>
      </Card>
    </div>
  )
}
