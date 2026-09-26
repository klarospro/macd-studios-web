import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Badge, Button, Input, Textarea, Field, EmptyState, StatCard } from '@/components/admin/ui'
import AgentPanel from '../agents/AgentPanel'
import MediaUpload from './MediaUpload'
import { advance, generateWeekPlan, publishNow, saveItem, setStatus } from './actions'
import type { ContentItem, ContentStatus } from '@/lib/social/types'

export const revalidate = 0
// Publicar un reel en Instagram incluye esperar a que Meta procese el video.
export const maxDuration = 300

const COLUMNS: { status: ContentStatus; label: string; hint: string }[] = [
  { status: 'guion', label: 'Guion', hint: 'Revisa el texto → "Aprobar guion"' },
  { status: 'produccion', label: 'Producción', hint: 'Reels: grábalo y súbelo · Carruseles: se generan solos' },
  { status: 'revision', label: 'Revisión', hint: 'Mira el video/imágenes → "Aprobar"' },
  { status: 'aprobado', label: 'Programado', hint: 'Sale solo a las 19:00 del día indicado' },
  { status: 'error', label: 'Con error', hint: 'Revisa el motivo y reintenta' },
]

const ADVANCE_LABEL: Partial<Record<ContentStatus, string>> = {
  guion: 'Aprobar guion',
  revision: 'Aprobar y programar',
  error: 'Reintentar',
}

function ItemCard({ item }: { item: ContentItem }) {
  const slidesText = (item.slides ?? []).map((s) => (s.body ? `${s.title} | ${s.body}` : s.title)).join('\n')
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={item.format === 'reel' ? 'gold' : 'default'}>{item.format}</Badge>
        {item.pillar && <Badge tone="muted">{item.pillar}</Badge>}
        <span className="text-xs text-zinc-500 ml-auto">{item.scheduled_for ?? 'sin fecha'}</span>
      </div>
      <h3 className="text-white font-medium mt-2">{item.title}</h3>
      {item.hook && <p className="text-sm text-[#D4AF37] mt-1">“{item.hook}”</p>}
      <p className="text-xs text-zinc-600 mt-1">
        {item.platforms.join(' + ')}
        {item.ai_cost_usd != null && ` · IA $${Number(item.ai_cost_usd).toFixed(2)}`}
      </p>

      {item.last_error && <p className="text-xs text-[#e05555] mt-2">{item.last_error}</p>}

      {item.format === 'reel' && item.media_url && (
        <video src={item.media_url} controls preload="metadata" className="mt-3 rounded-lg w-full max-h-80 bg-black" />
      )}
      {item.format === 'carrusel' && !!item.media_urls?.length && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {item.media_urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      <details className="mt-3 group">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-white">Ver / editar</summary>
        <form action={saveItem} className="space-y-3 mt-3">
          <input type="hidden" name="id" value={item.id} />
          <Field label="Título">
            <Input name="title" defaultValue={item.title} />
          </Field>
          <Field label="Gancho">
            <Input name="hook" defaultValue={item.hook ?? ''} />
          </Field>
          {item.format === 'reel' ? (
            <>
              <Field label="Guion para grabar" hint="Una línea por frase; la primera es el gancho">
                <Textarea name="script" rows={5} defaultValue={item.script ?? ''} />
              </Field>
              <Field label="Plano de fondo (IA)" hint="En inglés. Lo genera Higgsfield al renderizar; vacío = fondo de marca">
                <Textarea name="visual_prompt" rows={2} defaultValue={item.visual_prompt ?? ''} />
              </Field>
            </>
          ) : (
            <Field label="Diapositivas" hint="Una por línea: Título | texto">
              <Textarea name="slides" rows={6} defaultValue={slidesText} />
            </Field>
          )}
          <Field label="Caption">
            <Textarea name="caption" rows={4} defaultValue={item.caption ?? ''} />
          </Field>
          <Field label="CTA">
            <Input name="cta" defaultValue={item.cta ?? ''} />
          </Field>
          <Field label="Hashtags">
            <Input name="hashtags" defaultValue={item.hashtags ?? ''} />
          </Field>
          <Field label="Fecha de publicación">
            <Input name="scheduled_for" type="date" defaultValue={item.scheduled_for ?? ''} />
          </Field>
          <Button type="submit" variant="secondary">
            Guardar cambios
          </Button>
        </form>
      </details>

      <div className="flex flex-wrap gap-2 mt-4">
        {ADVANCE_LABEL[item.status] && (
          <form action={advance}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit">{ADVANCE_LABEL[item.status]}</Button>
          </form>
        )}
        {(item.status === 'produccion' || item.status === 'revision') && <MediaUpload itemId={item.id} format={item.format} />}
        {item.status === 'aprobado' && (
          <form action={publishNow}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" variant="secondary">
              Publicar ahora
            </Button>
          </form>
        )}
        {item.status === 'revision' && (
          <form action={setStatus}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="status" value="produccion" />
            <Button type="submit" variant="secondary">
              Rehacer
            </Button>
          </form>
        )}
        <form action={setStatus} className="ml-auto">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="status" value="descartado" />
          <Button type="submit" variant="danger">
            Descartar
          </Button>
        </form>
      </div>
    </Card>
  )
}

export default async function ContenidoPage() {
  const { supabase } = await requireSession()

  const [{ data: items }, { data: published }] = await Promise.all([
    supabase
      .from('content_items')
      .select('*')
      .in('status', COLUMNS.map((c) => c.status))
      .order('scheduled_for', { ascending: true, nullsFirst: false }),
    supabase
      .from('content_items')
      .select('id, title, format, published_at, platforms, last_error')
      .eq('status', 'publicado')
      .order('published_at', { ascending: false })
      .limit(10),
  ])

  const all = (items ?? []) as ContentItem[]
  const today = new Date().toISOString().slice(0, 10)
  const scheduled = all.filter((i) => i.status === 'aprobado')
  const nextDate = scheduled[0]?.scheduled_for
  const coveredDays = new Set(scheduled.map((i) => i.scheduled_for)).size

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contenido"
        subtitle="Motor de contenido: el agente propone, tú apruebas, el sistema publica 1 pieza al día en Instagram y TikTok."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Guiones por revisar" value={all.filter((i) => i.status === 'guion').length} tone="gold" />
        <StatCard label="En producción / revisión" value={all.filter((i) => i.status === 'produccion' || i.status === 'revision').length} />
        <StatCard
          label="Días programados"
          value={coveredDays}
          hint={nextDate ? `próxima: ${nextDate}${nextDate === today ? ' (hoy 19:00)' : ''}` : 'nada programado'}
          tone={coveredDays >= 3 ? 'positive' : 'negative'}
        />
        <StatCard label="Publicadas" value={published?.length ?? 0} hint="últimas 10" />
      </div>

      <AgentPanel
        title="🧠 Plan de la semana"
        description="El estratega crea 7 piezas: 3 guiones de reel para que los grabes tú y 4 carruseles (datos curiosos y tutoriales) que se generan solos."
        fields={[{ name: 'focus', placeholder: 'Foco opcional — ej: inmobiliarias que pierden leads de Idealista' }]}
        action={generateWeekPlan}
        buttonLabel="Generar 7 piezas"
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        {COLUMNS.filter((c) => c.status !== 'error' || all.some((i) => i.status === 'error')).map((col) => {
          const colItems = all.filter((i) => i.status === col.status)
          return (
            <section key={col.status} className="space-y-3">
              <div>
                <h2 className="text-sm font-medium text-white">
                  {col.label} <span className="text-zinc-600">({colItems.length})</span>
                </h2>
                <p className="text-xs text-zinc-600">{col.hint}</p>
              </div>
              {colItems.length ? colItems.map((i) => <ItemCard key={i.id} item={i} />) : <EmptyState title="Vacío" />}
            </section>
          )
        })}
      </div>

      {!!published?.length && (
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Publicado recientemente</h2>
          <Card className="divide-y divide-[#1a1a1a] p-0">
            {published.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <Badge tone={p.format === 'reel' ? 'gold' : 'default'}>{p.format}</Badge>
                <span className="text-white flex-1">{p.title}</span>
                {p.last_error && <span className="text-xs text-[#e05555]">{p.last_error}</span>}
                <span className="text-zinc-500 text-xs">{p.published_at?.slice(0, 10)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
