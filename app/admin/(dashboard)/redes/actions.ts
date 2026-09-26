'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'
import { callAnthropic, callAnthropicWithWebSearch } from '@/lib/admin/anthropic'
import { MACD_BUSINESS_CONTEXT } from '@/lib/admin/business-context'
import { MACD_GROWTH_CONTEXT } from '@/lib/admin/growth-context'
import { discoveryConfigured, scanReference, summarizeScan } from '@/lib/social/references'
import { syncAll } from '@/lib/social/sync'
import { deleteToken } from '@/lib/social/tokens'
import type { AgentState } from '../agents/actions'
import type { SocialAccount, SocialPost } from '@/lib/social/types'

export async function syncNow() {
  await requireSession()
  const r = await syncAll()
  revalidatePath('/admin/redes')
  return r
}

export async function disconnect(formData: FormData) {
  const { supabase } = await requireSession()
  const platform = String(formData.get('platform'))
  if (platform !== 'instagram' && platform !== 'tiktok') return
  await deleteToken(platform)
  await supabase.from('social_accounts').delete().eq('platform', platform)
  revalidatePath('/admin/redes')
}

const rate = (p: SocialPost) => {
  const inter = (p.likes ?? 0) + (p.comments ?? 0) * 2 + (p.shares ?? 0) * 3 + (p.saves ?? 0) * 3
  return p.views ? inter / p.views : 0
}

function postLine(p: SocialPost) {
  const caption = (p.caption ?? '').replace(/\s+/g, ' ').slice(0, 140)
  return `- [${p.platform} ${p.media_type ?? ''} ${p.posted_at?.slice(0, 10) ?? ''}] vistas=${p.views ?? '?'} likes=${p.likes ?? '?'} coment=${p.comments ?? '?'} compartidos=${p.shares ?? '?'} guardados=${p.saves ?? '?'} interacción=${(rate(p) * 100).toFixed(1)}% · "${caption}"`
}

// Agente analista: diagnóstico del perfil con datos reales + qué cambiar ya.
export async function analyzeProfile(_prev: AgentState, _fd: FormData): Promise<AgentState> {
  const { supabase } = await requireSession()

  const [{ data: accounts }, { data: posts }, { data: metrics }] = await Promise.all([
    supabase.from('social_accounts').select('*'),
    supabase.from('social_posts').select('*').order('posted_at', { ascending: false }).limit(60),
    supabase.from('social_metrics_daily').select('*').order('date', { ascending: false }).limit(60),
  ])

  if (!accounts?.length) return { error: 'Conecta Instagram o TikTok primero: sin datos reales no hay análisis.' }

  const accText = (accounts as SocialAccount[])
    .map(
      (a) =>
        `${a.platform}: @${a.username} · seguidores=${a.followers ?? '?'} · siguiendo=${a.following ?? '?'} · publicaciones=${a.posts_count ?? '?'}${a.likes_total != null ? ` · likes totales=${a.likes_total}` : ''}`
    )
    .join('\n')
  const sorted = [...((posts ?? []) as SocialPost[])].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
  const { data: refs } = await supabase.from('social_references').select('username, analysis').not('analysis', 'is', null).limit(5)
  const snapshot = {
    cuentas: accText,
    referencias: (refs ?? []).map((r) => `@${r.username}: ${(r.analysis ?? '').slice(0, 900)}`),
    top: sorted.slice(0, 8).map(postLine),
    peores: sorted.slice(-5).map(postLine),
    recientes: ((posts ?? []) as SocialPost[]).slice(0, 10).map(postLine),
    metricas: (metrics ?? []).map((m) => `${m.platform} ${m.date}: seguidores=${m.followers ?? '?'} alcance=${m.reach ?? '?'} vistas=${m.views ?? '?'} visitas_perfil=${m.profile_views ?? '?'}`),
  }

  try {
    const output = await callAnthropic(
      [
        {
          role: 'system',
          content: `${MACD_BUSINESS_CONTEXT}

${MACD_GROWTH_CONTEXT}

Eres el analista de redes de MACD Studios, con el criterio del equipo billion-dollar-ai-team (Hormozi: oferta y gancho; Kennedy: respuesta directa y CTA; Godin: diferenciación; Gary Vee: volumen y nativo de cada plataforma).
Objetivo del perfil: que inmobiliarias y negocios locales pidan la auditoría gratis o prueben a Max. No es tener likes: es generar leads.
Si hay cuentas de referencia, compara el perfil con ellas (qué hacen que nosotros no).
Reglas: usa SOLO los datos que te paso; si un dato falta, dilo. Nada de cifras inventadas. Texto plano, sin markdown con #.
Estructura:
1) DIAGNÓSTICO en 5 líneas (qué funciona, qué no, con números).
2) PERFIL: bio nueva propuesta (máx 150 caracteres), nombre de perfil, enlace y destacadas recomendadas.
3) PATRONES: qué tienen en común las 3 mejores publicaciones (formato, gancho, duración, tema).
4) PLAN 14 DÍAS: 1 publicación diaria, alternando reel y carrusel, con el pilar de cada día.
5) 3 COSAS PARA HACER HOY.`,
        },
        { role: 'user', content: JSON.stringify(snapshot, null, 1) },
      ],
      'claude-sonnet-5',
      2500,
      'analisis-perfil'
    )

    await supabase.from('social_analyses').insert({
      platforms: (accounts as SocialAccount[]).map((a) => a.platform),
      summary: output,
      data_snapshot: snapshot,
    })
    revalidatePath('/admin/redes')
    return { output }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

// Escáner de referencia: lee una cuenta que creció bien y extrae sus patrones replicables.
export async function scanReferenceAccount(_prev: AgentState, fd: FormData): Promise<AgentState> {
  const { supabase } = await requireSession()
  const username = String(fd.get('username') || '').replace(/^@/, '').trim().toLowerCase()
  const niche = String(fd.get('niche') || '').trim() || null
  if (!username) return { error: 'Escribe el @usuario de la cuenta de referencia.' }
  if (!discoveryConfigured())
    return { error: 'Falta configurar IG_DISCOVERY_TOKEN e IG_DISCOVERY_USER_ID en Vercel (ver docs/MOTOR_CONTENIDO.md).' }

  try {
    const scan = await scanReference(username)
    const numbers = summarizeScan(scan)
    const analysis = await callAnthropic(
      [
        {
          role: 'system',
          content: `${MACD_GROWTH_CONTEXT}

Eres el analista de referencias de MACD Studios. Te paso los datos públicos reales de una cuenta de Instagram que está creciendo. Extrae lo que MACD puede REPLICAR (estructuras, no textos). Texto plano, sin #.
1) POR QUÉ CRECE: 3-4 patrones con evidencia numérica de los datos.
2) GANCHOS: las fórmulas de sus 5 mejores aperturas, reescritas como plantillas genéricas ("[situación] a las [hora]…").
3) FORMATO Y RITMO: qué formato rinde más, cuántas por semana, largo de caption, uso de CTA.
4) PERFIL: qué hace bien su bio/enlace.
5) ADAPTACIÓN A MACD: 5 ideas de piezas concretas para nuestro nicho usando esos patrones.
Solo usa los datos dados; no inventes métricas que no están (no hay vistas, solo likes y comentarios).`,
        },
        { role: 'user', content: numbers },
      ],
      'claude-sonnet-5',
      2200,
      'escaner-referencia'
    )

    const { error } = await supabase.from('social_references').upsert(
      {
        username: scan.username.toLowerCase(),
        niche,
        followers: scan.followers_count,
        media_count: scan.media_count,
        posts: scan.posts,
        analysis,
        scanned_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'username' }
    )
    if (error) throw new Error(error.message)
    revalidatePath('/admin/redes')
    return { output: `${numbers.split('\n').slice(0, 5).join('\n')}\n\n${analysis}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

export async function deleteReference(formData: FormData) {
  const { supabase } = await requireSession()
  await supabase.from('social_references').delete().eq('id', String(formData.get('id')))
  revalidatePath('/admin/redes')
}

type BenchmarkCreator = {
  handle: string
  platform: string
  followers?: number | null
  source_url?: string
  why?: string
  patterns?: string[]
  hooks?: string[]
}

// Agente Benchmark: investiga en la web a los creadores que más crecen en el nicho, extrae sus
// patrones y los compara con las métricas reales de MACD. Los creadores quedan guardados como
// referencias → el estratega los usa al generar el plan semanal.
export async function runBenchmark(_prev: AgentState, fd: FormData): Promise<AgentState> {
  const { supabase } = await requireSession()
  const focus = String(fd.get('focus') || '').trim()

  const [{ data: accounts }, { data: posts }] = await Promise.all([
    supabase.from('social_accounts').select('*'),
    supabase.from('social_posts').select('*').order('posted_at', { ascending: false }).limit(40),
  ])
  const ours = (accounts as SocialAccount[] | null)?.length
    ? [
        ...(accounts as SocialAccount[]).map(
          (a) => `${a.platform}: @${a.username} · seguidores=${a.followers ?? '?'} · publicaciones=${a.posts_count ?? '?'}`
        ),
        'Publicaciones recientes:',
        ...((posts ?? []) as SocialPost[]).slice(0, 15).map(postLine),
      ].join('\n')
    : 'Todavía no hay cuentas conectadas: compara solo contra las buenas prácticas y di qué datos faltan.'

  let raw: string
  try {
    raw = await callAnthropicWithWebSearch(
      [
        {
          role: 'system',
          content: `${MACD_BUSINESS_CONTEXT}

${MACD_GROWTH_CONTEXT}

Eres el Agente Benchmark de MACD Studios. Usa la búsqueda web para investigar creadores de contenido de alto nivel que estén creciendo AHORA (último año) en Instagram y TikTok en estos nichos: automatización/IA para negocios, agencias de marketing, y marketing para inmobiliarias. Prioriza cuentas en español (España y LatAm) y añade 1-2 referentes globales si aportan.
Para cada creador (5-7): handle exacto, plataforma, seguidores SOLO si lo encuentras en una fuente (si no, null), URL de la fuente, por qué crece, patrones replicables (formato, duración, ritmo de publicación, estructura, retención, CTA) y 2-3 fórmulas de gancho convertidas en plantilla genérica.
Luego compara con las métricas reales de MACD que te paso: brechas concretas y qué cambiar YA.
Reglas: no inventes cifras ni cuentas; si no puedes verificar algo, dilo. Nada garantiza hacerse viral: habla de aumentar la probabilidad (retención, compartidos, guardados, comentarios). Copiar estructuras, nunca textos ni vídeos ajenos.
Al FINAL de tu respuesta escribe el resultado entre <json> y </json> con esta forma exacta:
{"creators":[{"handle":"","platform":"instagram|tiktok","followers":null,"source_url":"","why":"","patterns":[""],"hooks":[""]}],"comparison":"texto: brechas de MACD vs ellos","playbook":["10 reglas concretas para aumentar alcance"],"hooks":["10 ganchos listos para MACD"],"tests":["3 experimentos para esta semana, con qué métrica medirlos"]}`,
        },
        {
          role: 'user',
          content: `${focus ? `Foco de esta investigación: ${focus}\n\n` : ''}MÉTRICAS REALES DE MACD:\n${ours}`,
        },
      ],
      { maxSearches: 10, feature: 'benchmark' }
    )
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error con la IA' }
  }

  const m = raw.match(/<json>([\s\S]*)<\/json>/)
  let result: {
    creators?: BenchmarkCreator[]
    comparison?: string
    playbook?: string[]
    hooks?: string[]
    tests?: string[]
  }
  try {
    result = JSON.parse(m ? m[1] : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {
    return { error: 'El agente investigó pero no devolvió un resultado legible. Vuelve a intentarlo.' }
  }

  const creators = (result.creators ?? []).filter((c) => c.handle)
  for (const c of creators) {
    const username = c.handle.replace(/^@/, '').trim().toLowerCase()
    await supabase.from('social_references').upsert(
      {
        username,
        niche: `${c.platform} · benchmark`,
        followers: typeof c.followers === 'number' ? c.followers : null,
        analysis: [
          c.why && `POR QUÉ CRECE: ${c.why}`,
          c.patterns?.length && `PATRONES:\n- ${c.patterns.join('\n- ')}`,
          c.hooks?.length && `GANCHOS (plantilla):\n- ${c.hooks.join('\n- ')}`,
          c.source_url && `Fuente: ${c.source_url}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        scanned_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'username' }
    )
  }

  const summary = [
    'BENCHMARK VIRAL',
    `Referentes: ${creators.map((c) => `@${c.handle.replace(/^@/, '')} (${c.platform})`).join(', ') || '—'}`,
    result.comparison && `\nTU CUENTA VS ELLOS:\n${result.comparison}`,
    result.playbook?.length && `\nPLAYBOOK:\n${result.playbook.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    result.hooks?.length && `\nGANCHOS PARA MACD:\n${result.hooks.map((h) => `- ${h}`).join('\n')}`,
    result.tests?.length && `\nEXPERIMENTOS DE ESTA SEMANA:\n${result.tests.map((t) => `- ${t}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n')

  await supabase.from('social_analyses').insert({
    platforms: ['benchmark'],
    summary,
    data_snapshot: result,
  })
  revalidatePath('/admin/redes')
  return { output: summary }
}
