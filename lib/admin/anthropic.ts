import 'server-only'

// Mismo patrón que group365 (app/api/anthropic/index.ts) — fetch directo, sin SDK.
export async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  model = 'claude-sonnet-5',
  maxTokens = 1200
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada en macd-studios/.env.local')

  const systemParts: string[] = []
  const chatMessages: Array<{ role: string; content: string }> = []
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content)
    else chatMessages.push(m)
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
      messages: chatMessages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}
