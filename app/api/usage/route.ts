import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { anthropicCost, recordUsage } from '@/lib/admin/usage'

// Entrada de consumo para apps externas al panel (Viernes, macd-content, Max/n8n, apps nuevas).
//   POST /api/usage   Authorization: Bearer $USAGE_INGEST_SECRET
//   Body: un objeto o un array (máx 100). Si provider=anthropic y no mandas cost_usd, se calcula
//   con los tokens y el modelo.
const Row = z.object({
  provider: z.string().min(1).max(40),
  app: z.string().min(1).max(60),
  feature: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  cache_read_tokens: z.number().int().nonnegative().optional(),
  cache_write_tokens: z.number().int().nonnegative().optional(),
  web_searches: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().max(10_000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const secret = process.env.USAGE_INGEST_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = z.union([Row, z.array(Row).max(100)]).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'body inválido' }, { status: 400 })

  const rows = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
  for (const r of rows) {
    const cost =
      r.cost_usd ??
      (r.provider === 'anthropic' && r.model
        ? anthropicCost(r.model, {
            input_tokens: r.input_tokens,
            output_tokens: r.output_tokens,
            cache_read_input_tokens: r.cache_read_tokens,
            cache_creation_input_tokens: r.cache_write_tokens,
            server_tool_use: { web_search_requests: r.web_searches },
          })
        : 0)
    await recordUsage({ ...r, cost_usd: Number(cost.toFixed(6)) })
  }
  return NextResponse.json({ ok: true, recorded: rows.length })
}
