import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, StatCard, Table, Th, Td, EmptyState, Badge, Button } from '@/components/admin/ui'
import AgentPanel from '../agents/AgentPanel'
import SyncButton from './SyncButton'
import { analyzeProfile, deleteReference, disconnect, runBenchmark, scanReferenceAccount } from './actions'
import { discoveryConfigured } from '@/lib/social/references'
import { igConfigured } from '@/lib/social/instagram'
import { ttConfigured } from '@/lib/social/tiktok'
import type { SocialAccount, SocialPost } from '@/lib/social/types'

export const revalidate = 0
// El benchmark investiga en la web (1-3 min).
export const maxDuration = 300

const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('es-ES'))

const PLATFORMS = [
  {
    id: 'instagram' as const,
    label: 'Instagram',
    configured: igConfigured,
    envs: 'INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET',
  },
  {
    id: 'tiktok' as const,
    label: 'TikTok',
    configured: ttConfigured,
    envs: 'TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET',
  },
]

// Mini gráfica de seguidores (SVG en servidor, sin librerías).
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="text-xs text-zinc-700 mt-3">La gráfica aparece tras 2 días de datos.</div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28 - 1}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-12 mt-3">
      <polyline points={pts} fill="none" stroke="#D4AF37" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default async function RedesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase } = await requireSession()
  const sp = await searchParams

  const [{ data: accounts }, { data: posts }, { data: metrics }, { data: analyses }, { data: references }] = await Promise.all([
    supabase.from('social_accounts').select('*'),
    supabase.from('social_posts').select('*').order('posted_at', { ascending: false }).limit(100),
    supabase.from('social_metrics_daily').select('*').order('date').limit(180),
    supabase.from('social_analyses').select('id, created_at, summary').order('created_at', { ascending: false }).limit(1),
    supabase.from('social_references').select('id, username, niche, followers, media_count, analysis, scanned_at').order('followers', { ascending: false }),
  ])

  const byPlatform = new Map((accounts as SocialAccount[] | null)?.map((a) => [a.platform, a]))
  const allPosts = (posts ?? []) as SocialPost[]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const last30 = allPosts.filter((p) => p.posted_at && new Date(p.posted_at) >= cutoff)
  const views30 = last30.reduce((s, p) => s + (p.views ?? 0), 0)
  const inter30 = last30.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0), 0)
  const top = [...allPosts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Redes"
        subtitle="Instagram y TikTok conectados por API: métricas diarias, mejores publicaciones y análisis del perfil."
        action={accounts?.length ? <SyncButton /> : undefined}
      />

      {sp.ok && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          {sp.ok === 'instagram' ? 'Instagram' : 'TikTok'} conectado y sincronizado.
        </p>
      )}
      {sp.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {sp.error.endsWith('sin-configurar')
            ? 'Faltan las claves de la app en Vercel (ver abajo).'
            : `No se pudo conectar: ${sp.error}`}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => {
          const acc = byPlatform.get(p.id)
          const series = (metrics ?? []).filter((m) => m.platform === p.id && m.followers != null).map((m) => m.followers as number)
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-white font-medium">{p.label}</h2>
                  {acc ? (
                    <p className="text-sm text-zinc-400 mt-0.5">
                      @{acc.username} · {n(acc.followers)} seguidores · {n(acc.posts_count)} publicaciones
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500 mt-0.5">Sin conectar</p>
                  )}
                </div>
                {acc ? <Badge tone="positive">conectado</Badge> : <Badge tone="muted">—</Badge>}
              </div>

              {acc && <Sparkline values={series} />}
              {acc?.last_error && <p className="text-xs text-[#e05555] mt-2">Último error: {acc.last_error}</p>}
              {acc?.last_synced_at && (
                <p className="text-xs text-zinc-600 mt-2">
                  Sincronizado: {new Date(acc.last_synced_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                {p.configured() ? (
                  // <a> y no <Link>: es una ruta de API que redirige fuera del sitio (OAuth).
                  <a
                    href={`/api/social/${p.id}/connect`}
                    className={
                      acc
                        ? 'inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white border border-[#222] hover:bg-white/10'
                        : 'inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#E8C766]'
                    }
                  >
                    {acc ? 'Reconectar' : `Conectar ${p.label}`}
                  </a>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Para conectar, añade en Vercel: <code className="text-zinc-300">{p.envs}</code>
                  </p>
                )}
                {acc && (
                  <form action={disconnect}>
                    <input type="hidden" name="platform" value={p.id} />
                    <Button variant="danger" type="submit">
                      Desconectar
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Seguidores totales"
          value={n((accounts ?? []).reduce((s, a) => s + (a.followers ?? 0), 0))}
          tone="gold"
        />
        <StatCard label="Publicaciones (30 días)" value={last30.length} hint="objetivo: 30 (1 al día)" />
        <StatCard label="Vistas (30 días)" value={n(views30)} />
        <StatCard
          label="Interacción (30 días)"
          value={views30 ? `${((inter30 / views30) * 100).toFixed(1)}%` : '—'}
          hint="likes + coment. + compartidos + guardados / vistas"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <AgentPanel
          title="🚀 Benchmark viral"
          description="Investiga en la web a los creadores que más crecen en tu nicho, los compara con tus números y te da playbook, ganchos y 3 experimentos. Tarda 1-3 min."
          fields={[{ name: 'focus', placeholder: 'Foco opcional — ej: inmobiliarias en España, agentes de IA en TikTok' }]}
          action={runBenchmark}
          buttonLabel="Investigar"
        />
        <AgentPanel
          title="🔍 Analizar mi perfil"
          description="Diagnóstico con tus números reales, bio nueva, patrones de lo que funciona y plan de 14 días."
          action={analyzeProfile}
          buttonLabel="Analizar"
        />
        <Card>
          <h2 className="text-white font-medium">Último análisis</h2>
          {analyses?.[0] ? (
            <>
              <p className="text-xs text-zinc-600 mt-1">
                {new Date(analyses[0].created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
              </p>
              <pre className="whitespace-pre-wrap text-sm text-zinc-300 mt-3 font-sans leading-relaxed max-h-[28rem] overflow-y-auto">
                {analyses[0].summary}
              </pre>
            </>
          ) : (
            <p className="text-sm text-zinc-500 mt-1">Todavía no hay análisis.</p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-white font-medium">Cuentas de referencia</h2>
          <p className="text-sm text-zinc-500">
            Cuentas que crecieron en el nicho: el agente extrae sus patrones y el estratega los usa al crear tu plan semanal.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <AgentPanel
            title="📡 Escanear cuenta"
            description={
              discoveryConfigured()
                ? 'Solo cuentas profesionales (Business o Creator). Lee sus últimas 40 publicaciones.'
                : 'Pendiente: añadir IG_DISCOVERY_TOKEN e IG_DISCOVERY_USER_ID en Vercel (ver docs/MOTOR_CONTENIDO.md).'
            }
            fields={[
              { name: 'username', placeholder: '@usuario' },
              { name: 'niche', placeholder: 'Nicho (opcional) — ej: inmobiliaria, agencia IA' },
            ]}
            action={scanReferenceAccount}
            buttonLabel="Escanear"
          />
          <div className="space-y-3">
            {!references?.length ? (
              <EmptyState title="Sin referencias todavía" hint="Empieza con 3-5 cuentas de tu nicho que hayan crecido este año." />
            ) : (
              references.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`https://instagram.com/${r.username}`} target="_blank" rel="noreferrer" className="text-white font-medium hover:text-[#D4AF37]">
                      @{r.username}
                    </a>
                    {r.niche && <Badge tone="muted">{r.niche}</Badge>}
                    <span className="text-xs text-zinc-500">
                      {n(r.followers)} seguidores · {n(r.media_count)} pubs
                    </span>
                    <form action={deleteReference} className="ml-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-xs text-zinc-600 hover:text-[#e05555]">
                        quitar
                      </button>
                    </form>
                  </div>
                  {r.analysis && (
                    <details className="mt-2">
                      <summary className="text-xs text-zinc-400 cursor-pointer hover:text-white">Ver patrones</summary>
                      <pre className="whitespace-pre-wrap text-sm text-zinc-300 mt-2 font-sans leading-relaxed">{r.analysis}</pre>
                    </details>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Mejores publicaciones (por vistas)</h2>
        {!top.length ? (
          <EmptyState title="Sin publicaciones sincronizadas" hint="Conecta una cuenta y aparecerán aquí." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Red</Th>
                <Th>Fecha</Th>
                <Th>Publicación</Th>
                <Th className="text-right">Vistas</Th>
                <Th className="text-right">Likes</Th>
                <Th className="text-right">Coment.</Th>
                <Th className="text-right">Compart.</Th>
                <Th className="text-right">Guard.</Th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Badge tone={p.platform === 'instagram' ? 'gold' : 'default'}>{p.platform}</Badge>
                  </Td>
                  <Td className="text-zinc-500 whitespace-nowrap">{p.posted_at?.slice(0, 10) ?? '—'}</Td>
                  <Td className="max-w-md">
                    {p.permalink ? (
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="text-white hover:text-[#D4AF37] line-clamp-2">
                        {p.caption || '(sin texto)'}
                      </a>
                    ) : (
                      <span className="line-clamp-2">{p.caption || '(sin texto)'}</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{n(p.views)}</Td>
                  <Td className="text-right tabular-nums">{n(p.likes)}</Td>
                  <Td className="text-right tabular-nums">{n(p.comments)}</Td>
                  <Td className="text-right tabular-nums">{n(p.shares)}</Td>
                  <Td className="text-right tabular-nums">{n(p.saves)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
