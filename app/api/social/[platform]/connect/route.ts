import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireSession } from '@/lib/admin/dal'
import { igAuthorizeUrl, igConfigured } from '@/lib/social/instagram'
import { ttAuthorizeUrl, ttConfigured } from '@/lib/social/tiktok'

// Inicia el OAuth. El `state` va en una cookie httpOnly y se comprueba en el callback (CSRF).
export async function GET(req: NextRequest, ctx: RouteContext<'/api/social/[platform]/connect'>) {
  await requireSession()
  const { platform } = await ctx.params
  const redirectUri = `${req.nextUrl.origin}/api/social/${platform}/callback`
  const state = randomBytes(16).toString('hex')

  let url: string
  if (platform === 'instagram' && igConfigured()) url = igAuthorizeUrl(redirectUri, state)
  else if (platform === 'tiktok' && ttConfigured()) url = ttAuthorizeUrl(redirectUri, state)
  else return NextResponse.redirect(new URL(`/admin/redes?error=${platform}-sin-configurar`, req.url))

  const res = NextResponse.redirect(url)
  res.cookies.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/social',
  })
  return res
}
