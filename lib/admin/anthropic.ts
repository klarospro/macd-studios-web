import 'server-only'
import { recordAnthropic, type AnthropicUsage } from './usage'

// Mismo patrón que group365 (app/api/anthropic/index.ts) — fetch directo, sin SDK.

type Block = { type: string; text?: string }

function splitSystem(messages: Array<{ role: string; content: string }>) {
  const systemParts: string[] = []
  const chatMessages: Array<{ role: string; content: unknown }> = []
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content)
    else chatMessages.push(m)
  }
  return { system: systemParts.join('\n\n'), chatMessages }
}

// Une TODOS los bloques de texto: con Sonnet 5 el razonamiento viene activado por defecto y el
// primer bloque puede ser "thinking" (vacío), así que content[0].text no basta.
function textOf(content: Block[] | undefined) {
  return (content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim()
}

async function post(body: Record<string, unknown>) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada en macd-studios/.env.local')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ content: Block[]; stop_reason: string; usage?: AnthropicUsage }>
}

export async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  model = 'claude-sonnet-5',
  maxTokens = 1200,
  feature = 'sin-etiqueta'
): Promise<string> {
  const { system, chatMessages } = splitSystem(messages)
  const data = await post({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: chatMessages,
  })
  await recordAnthropic(model, data.usage, feature)
  return textOf(data.content)
}

// Igual, pero Claude puede buscar en la web (herramienta del servidor de Anthropic).
// Si la búsqueda agota su bucle interno devuelve stop_reason "pause_turn": se reenvía la
// conversación con la respuesta parcial y el servidor continúa donde lo dejó.
export async function callAnthropicWithWebSearch(
  messages: Array<{ role: string; content: string }>,
  { model = 'claude-sonnet-5', maxTokens = 16000, maxSearches = 8, feature = 'busqueda-web' } = {}
): Promise<string> {
  const { system, chatMessages } = splitSystem(messages)
  const convo = [...chatMessages]
  const texts: string[] = []

  for (let turn = 0; turn < 4; turn++) {
    const data = await post({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
      messages: convo,
    })
    await recordAnthropic(model, data.usage, feature)
    texts.push(textOf(data.content))
    if (data.stop_reason !== 'pause_turn') break
    convo.push({ role: 'assistant', content: data.content })
  }
  return texts.join('\n').trim()
}
