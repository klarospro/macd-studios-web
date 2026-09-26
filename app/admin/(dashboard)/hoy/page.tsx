import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Badge, Button, EmptyState, LinkButton } from '@/components/admin/ui'
import CopyButton from '@/components/admin/CopyButton'
import MediaUpload from '../contenido/MediaUpload'
import { advance, markPublished } from '../contenido/actions'
import { fullCaption } from '@/lib/social/captions'
import type { ContentItem } from '@/lib/social/types'

export const revalidate = 0

const madridDate = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }) // YYYY-MM-DD
}

const CATEGORY_LABEL: Record<string, string> = {
  problema: 'Problema',
  solucion: 'Solución',
  'trabajar-conmigo': 'Trabajar conmigo',
  personal: 'Personal',
}

const STATUS_DOT: Record<string, string> = {
  guion: 'bg-zinc-500',
  produccion: 'bg-amber-400',
  revision: 'bg-sky-400',
  aprobado: 'bg-emerald-400',
  publicado: 'bg-[#D4AF37]',
  error: 'bg-[#e05555]',
}

// Paso en el que está la pieza → qué tiene que hacer Moisés ahora.
function nextAction(item: ContentItem) {
  const cover = item.format === 'carrusel' && item.slides?.[0]?.image_prompt && !item.slides?.[0]?.image
  switch (item.status) {
    case 'guion':
      return 'Revisa el guion y apruébalo.'
    case 'produccion':
      if (item.format === 'reel') return 'Graba el video con el guion de abajo y súbelo.'
      return cover
        ? 'Crea la portada en Gemini con el prompt de abajo y súbela. Después se generan las diapositivas.'
        : 'Las diapositivas se están generando (render:pending).'
    case 'revision':
      return 'Mira el resultado y apruébalo.'
    case 'aprobado':
      return 'Listo. Sale a las 19:00 si las redes están conectadas; si no, publícalo a mano y márcalo.'
    case 'publicado':
      return '✅ Publicado. Responde los comentarios con la palabra clave.'
    case 'error':
      return `Hubo un error: ${item.last_error ?? 'revísalo en Contenido.'}`
    default:
      return ''
  }
}

function Script({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split('\n').filter(Boolean).map((line, i) => {
        const m = line.match(/^(GANCHO|PROBLEMA|SOLUCIÓN|SOLUCION|PRUEBA|CTA):\s*(.*)$/i)
        if (line.startsWith('[')) return <p key={i} className="text-xs text-zinc-500 italic">{line}</p>
        return m ? (
          <p key={i} className="text-lg leading-snug text-white">
            <span className="block text-[11px] tracking-widest text-[#D4AF37] font-semibold">{m[1].toUpperCase()}</span>
            {m[2]}
          </p>
        ) : (
          <p key={i} className="text-lg leading-snug text-white">{line}</p>
        )
      })}
    </div>
  )
}

function TodayCard({ item, label }: { item: ContentItem; label: string }) {
  const caption = fullCaption(item)
  const coverPrompt = item.slides?.[0]?.image_prompt
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-zinc-500">{label}</span>
        <Badge tone={item.format === 'reel' ? 'gold' : 'default'}>{item.format === 'reel' ? 'Reel (grabas tú)' : 'Carrusel'}</Badge>
        {item.category && <Badge tone="muted">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>}
        {item.cta_keyword && <Badge tone="positive">Palabra: {item.cta_keyword}</Badge>}
      </div>

      <div>
        <h2 className="text-xl text-white font-medium">{item.title}</h2>
        <p className="text-sm text-[#D4AF37] mt-2">👉 {nextAction(item)}</p>
      </div>

      {item.format === 'reel' && item.script && (
        <div className="bg-[#0A0A0A] border border-[#222] rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Guion para grabar</span>
            <CopyButton text={item.script} />
          </div>
          <Script text={item.script} />
        </div>
      )}

      {item.format === 'carrusel' && coverPrompt && (
        <div className="bg-[#0A0A0A] border border-[#222] rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Portada · prompt para Gemini</span>
            <CopyButton text={`${coverPrompt}. Vertical 4:5 aspect ratio, no text, no letters, no logos.`} label="Copiar prompt" />
          </div>
          <p className="text-sm text-zinc-300">{coverPrompt}</p>
          <p className="text-xs text-zinc-600 mt-2">
            Ábrelo en gemini.google.com → pide la imagen → descárgala → súbela aquí. El texto lo pone la plantilla, no la IA.
          </p>
          {item.slides?.[0]?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.slides[0].image} alt="Portada" className="mt-3 h-40 rounded-lg" />
          )}
        </div>
      )}

      {item.format === 'reel' && item.media_url && (
        <video src={item.media_url} controls preload="metadata" className="rounded-xl w-full max-h-96 bg-black" />
      )}
      {item.format === 'carrusel' && !!item.media_urls?.length && (
        <div>
          <div className="flex gap-2 overflow-x-auto">
            {item.media_urls.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" download title={`Diapositiva ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-48 rounded-lg" />
              </a>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-1">Toca cada imagen para abrirla y guardarla.</p>
        </div>
      )}

      <div className="bg-[#0A0A0A] border border-[#222] rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs uppercase tracking-widest text-zinc-500">Caption + hashtags</span>
          <CopyButton text={caption} />
        </div>
        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{caption}</p>
      </div>

      {!!item.stories?.length && (
        <div className="bg-[#0A0A0A] border border-[#222] rounded-xl p-4">
          <span className="text-xs uppercase tracking-widest text-zinc-500">Stories de hoy</span>
          <ol className="mt-3 space-y-3">
            {item.stories.map((s, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-[#D4AF37] font-semibold tabular-nums">{i + 1}</span>
                <div className="flex-1">
                  <Badge tone={s.tipo === 'hand-raiser' ? 'gold' : 'muted'}>{s.tipo}</Badge>
                  <p className="text-sm text-white mt-1">{s.texto}</p>
                  {s.sticker && <p className="text-xs text-zinc-500 mt-0.5">Sticker: {s.sticker}</p>}
                </div>
                <CopyButton text={s.texto} label="" />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(item.status === 'guion' || item.status === 'revision') && (
          <form action={advance}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit">{item.status === 'guion' ? 'Aprobar guion' : 'Aprobar'}</Button>
          </form>
        )}
        {item.status === 'produccion' && item.format === 'reel' && <MediaUpload itemId={item.id} format="reel" />}
        {item.format === 'carrusel' && coverPrompt && item.status !== 'publicado' && (
          <MediaUpload itemId={item.id} format="carrusel" mode="cover" />
        )}
        {item.status !== 'publicado' && (
          <form action={markPublished}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" variant="secondary">
              Ya lo publiqué
            </Button>
          </form>
        )}
        <Link href="/admin/contenido" className="text-xs text-zinc-500 hover:text-white self-center ml-auto">
          Editar en Contenido →
        </Link>
      </div>
    </Card>
  )
}

export default async function HoyPage() {
  const { supabase } = await requireSession()
  const today = madridDate(0)
  const weekEnd = madridDate(6)

  const { data } = await supabase
    .from('content_items')
    .select('*')
    .gte('scheduled_for', madridDate(-1))
    .lte('scheduled_for', weekEnd)
    .neq('status', 'descartado')
    .order('scheduled_for')

  const items = (data ?? []) as ContentItem[]
  const todays = items.filter((i) => i.scheduled_for === today)
  const tomorrow = items.filter((i) => i.scheduled_for === madridDate(1))
  const days = Array.from({ length: 7 }, (_, i) => madridDate(i))

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Hoy"
        subtitle={new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })}
        action={<LinkButton href="/admin/contenido" variant="secondary">Plan de la semana</LinkButton>}
      />

      {/* Semana de un vistazo */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const it = items.find((i) => i.scheduled_for === d)
          const wd = new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' })
          return (
            <div
              key={d}
              className={`rounded-lg border p-2 text-center ${d === today ? 'border-[#D4AF37]/60 bg-[#D4AF37]/5' : 'border-[#222]'}`}
              title={it?.title ?? 'Sin pieza'}
            >
              <div className="text-[11px] uppercase text-zinc-500">{wd}</div>
              <div className="text-sm text-white tabular-nums">{d.slice(8)}</div>
              <div className="flex justify-center mt-1.5">
                <span className={`h-2 w-2 rounded-full ${it ? STATUS_DOT[it.status] ?? 'bg-zinc-600' : 'bg-transparent border border-zinc-700'}`} />
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">{it ? (it.format === 'reel' ? 'reel' : 'carrusel') : '—'}</div>
            </div>
          )
        })}
      </div>

      {todays.length ? (
        todays.map((it) => <TodayCard key={it.id} item={it} label="Para hoy" />)
      ) : (
        <EmptyState
          title="No hay nada programado para hoy"
          hint="Ve a Contenido → Generar 7 piezas, o adelanta la de mañana."
        />
      )}

      {tomorrow.map((it) => (
        <TodayCard key={it.id} item={it} label="Mañana (adelanta si puedes)" />
      ))}

      <p className="text-xs text-zinc-600">
        Rutina: grabar o preparar la pieza de hoy → subirla → stories a lo largo del día (1 hand-raiser mínimo) → responder cada
        comentario con la palabra clave por DM.
      </p>
    </div>
  )
}
