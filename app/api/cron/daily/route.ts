import { NextRequest, NextResponse } from 'next/server'
import { syncAll } from '@/lib/social/sync'
import { publishDue } from '@/lib/social/publish'

// Cron diario de Vercel (vercel.json): sincroniza métricas y publica lo aprobado para hoy.
// Vercel manda `Authorization: Bearer $CRON_SECRET`; sin esa variable no corre nada.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const published = await publishDue().catch((e) => [{ error: e instanceof Error ? e.message : String(e) }])
  const synced = await syncAll()
  return NextResponse.json({ published, synced })
}
