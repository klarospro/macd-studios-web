'use server'

import { requireSession } from '@/lib/admin/dal'
import { callAnthropic } from '@/lib/admin/anthropic'
import { MACD_BUSINESS_CONTEXT } from '@/lib/admin/business-context'
import { TRACKED_PROJECTS, getGithubStatus } from '@/lib/admin/project-status'

export type AgentState = { output?: string; error?: string } | undefined

function fail(e: unknown): AgentState {
  return { error: e instanceof Error ? e.message : 'Error inesperado' }
}

// ── Marketing ────────────────────────────────────────────────────────────
export async function runMarketingAgent(_prev: AgentState, formData: FormData): Promise<AgentState> {
  await requireSession()
  const brief = String(formData.get('brief') || '').trim()

  try {
    const output = await callAnthropic([
      {
        role: 'system',
        content: `${MACD_BUSINESS_CONTEXT}\n\nEres el agente de marketing de MACD Studios. Genera 3 ideas de contenido para redes (Instagram/TikTok/Facebook), concretas y listas para grabar/publicar esta semana. Cada idea: gancho (primeras 2 líneas), formato (reel/carrusel/story), y CTA. Nada de teoría genérica.`,
      },
      {
        role: 'user',
        content: brief || 'Dame 3 ideas de contenido para esta semana, tema libre según lo que mejor venda.',
      },
    ])
    return { output }
  } catch (e) {
    return fail(e)
  }
}

// ── Nuevos proyectos ─────────────────────────────────────────────────────
export async function runNewProjectAgent(_prev: AgentState, formData: FormData): Promise<AgentState> {
  await requireSession()
  const description = String(formData.get('description') || '').trim()
  if (!description) return { error: 'Describe qué pide el cliente potencial.' }

  try {
    const output = await callAnthropic([
      {
        role: 'system',
        content: `${MACD_BUSINESS_CONTEXT}\n\nEres el agente de nuevos proyectos de MACD Studios. Dado lo que pide un cliente potencial, devuelve en texto plano (sin markdown): 1) qué plan/producto encaja mejor y por qué, 2) un borrador de 2-3 frases para el campo "Servicio" de una propuesta, 3) una nota corta de alcance/riesgo a confirmar antes de cotizar en firme.`,
      },
      { role: 'user', content: description },
    ])
    return { output }
  } catch (e) {
    return fail(e)
  }
}

// ── Actualizaciones ──────────────────────────────────────────────────────
export async function runUpdatesAgent(_prev: AgentState, _formData: FormData): Promise<AgentState> {
  await requireSession()

  try {
    const rows = await Promise.all(
      TRACKED_PROJECTS.map(async (p) => ({ project: p, github: await getGithubStatus(p) }))
    )
    const summary = rows
      .map(({ project, github }) =>
        github.ok
          ? `${project.name}: último commit "${github.message}" (${github.authorDate.slice(0, 10)})`
          : `${project.name}: sin datos (${github.reason})`
      )
      .join('\n')

    const output = await callAnthropic([
      {
        role: 'system',
        content:
          'Eres el agente de actualizaciones de MACD Studios. Con la lista de proyectos y su último commit real, escribe un resumen ejecutivo de 5-8 líneas: qué se movió esta semana, qué proyecto lleva más tiempo sin actividad (posible foco de atención), sin inventar nada que no esté en los datos.',
      },
      { role: 'user', content: summary },
    ])
    return { output }
  } catch (e) {
    return fail(e)
  }
}

// ── Producción ───────────────────────────────────────────────────────────
export async function runProductionAgent(_prev: AgentState, formData: FormData): Promise<AgentState> {
  await requireSession()
  const clientName = String(formData.get('client_name') || '').trim()
  const plan = String(formData.get('plan') || '').trim()
  if (!clientName || !plan) return { error: 'Falta el nombre del cliente o el plan.' }

  try {
    const output = await callAnthropic([
      {
        role: 'system',
        content: `${MACD_BUSINESS_CONTEXT}\n\nEres el agente de producción de MACD Studios. Dado un cliente y el plan que compró, devuelve un checklist numerado (texto plano) de los pasos concretos para entregarlo, en orden, basado EXACTAMENTE en lo que incluye ese plan — sin agregar nada que el plan no tenga.`,
      },
      { role: 'user', content: `Cliente: ${clientName}\nPlan comprado: ${plan}` },
    ])
    return { output }
  } catch (e) {
    return fail(e)
  }
}

// ── CEO (briefing) ───────────────────────────────────────────────────────
export async function runCeoAgent(_prev: AgentState, _formData: FormData): Promise<AgentState> {
  const { supabase } = await requireSession()

  try {
    const [{ data: pendingInvoices }, { data: prospects }] = await Promise.all([
      supabase.from('invoices').select('total, currency').in('status', ['sent', 'overdue']),
      supabase.from('prospects').select('status'),
    ])

    const invoicesTotal = (pendingInvoices ?? []).length
    const prospectsByStatus = (prospects ?? []).reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    }, {})

    const dataSummary = `Facturas pendientes de cobro: ${invoicesTotal}.\nPropuestas por estado: ${
      Object.entries(prospectsByStatus)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'sin propuestas todavía'
    }.`

    const output = await callAnthropic([
      {
        role: 'system',
        content:
          'Eres el agente de briefing ejecutivo de MACD Studios (no tomas decisiones por tu cuenta, sintetizas). Con estos datos reales, escribe 4-6 líneas: qué necesita atención de Moisés esta semana (cobros, propuestas estancadas, etc.). Directo, sin relleno. No inventes cifras que no te di.',
      },
      { role: 'user', content: dataSummary },
    ])
    return { output }
  } catch (e) {
    return fail(e)
  }
}
