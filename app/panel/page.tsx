import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PanelGrid from './PanelGrid'

export const revalidate = 0

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function PanelPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (token !== process.env.PANEL_SECRET) {
    redirect('/?panel=locked')
  }

  const { data: drafts } = await supabase
    .from('content_generated')
    .select('*, products(title, image_url, category)')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: stats } = await supabase
    .from('orders')
    .select('total, profit, fulfillment_status')

  const totalRevenue = stats?.reduce((s, o) => s + (o.total || 0), 0) || 0
  const totalProfit = stats?.reduce((s, o) => s + (o.profit || 0), 0) || 0
  const pendingOrders = stats?.filter(o => o.fulfillment_status === 'pending').length || 0

  const { data: pendingContent } = await supabase
    .from('content_generated')
    .select('id', { count: 'exact' })
    .eq('status', 'draft')

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="border-b border-[#D4AF37]/20 pb-6 mb-8">
          <h1 className="font-display text-3xl text-[#D4AF37]">@camiysanti — Panel</h1>
          <p className="text-zinc-500 text-sm mt-1">macdestudios.com/panel · Aprobación de contenido IA</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Ingresos totales" value={`${totalRevenue.toFixed(0)}€`} />
          <StatCard label="Beneficio" value={`${totalProfit.toFixed(0)}€`} />
          <StatCard label="Pedidos pendientes" value={pendingOrders} alert={pendingOrders > 0} />
          <StatCard label="Contenido a revisar" value={pendingContent?.length || 0} alert={(pendingContent?.length || 0) > 0} />
        </div>

        {/* Panel de contenido */}
        <h2 className="text-[#D4AF37] font-semibold text-lg mb-4">
          Pendientes de aprobación ({drafts?.length || 0})
        </h2>

        {!drafts?.length ? (
          <div className="border border-[#222] rounded-xl p-10 text-center text-zinc-600">
            Sin contenido pendiente. Camí está descansando.
          </div>
        ) : (
          <PanelGrid items={drafts} token={token!} />
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      <div className={`text-2xl font-bold ${alert ? 'text-[#D4AF37]' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-zinc-600 mt-1">{label}</div>
    </div>
  )
}
