import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { igExchangeCode } from '@/lib/social/instagram'
import { ttExchangeCode } from '@/lib/social/tiktok'
import { syncInstagram, syncTikTok } from '@/lib/social/sync'

export const maxDuration = 120

export async function GET(req: NextRequest, ctx: RouteContext<'/api/social/[platform]/callback'>) {
  await requireSession()
  const { platform } = await ctx.params
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/admin/redes?${q}`, req.url))
    res.cookies.delete({ name: `oauth_state_${platform}`, path: '/api/social' })
    return res
  }

  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  if (params.get('error')) return back(`error=${encodeURIComponent(params.get('error_description') || params.get('error')!)}`)
  if (!code || !state || state !== req.cookies.get(`oauth_state_${platform}`)?.value) {
    return back('error=estado-oauth-invalido')
  }

  const redirectUri = `${req.nextUrl.origin}/api/social/${platform}/callback`
  try {
    if (platform === 'instagram') {
      // Instagram a veces añade "#_" al code.
      await igExchangeCode(code.replace(/#_$/, ''), redirectUri)
      await syncInstagram()
    } else if (platform === 'tiktok') {
      await ttExchangeCode(code, redirectUri)
      await syncTikTok()
    } else {
      return back('error=plataforma-desconocida')
    }
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : 'fallo al conectar')}`)
  }
  return back(`ok=${platform}`)
}
