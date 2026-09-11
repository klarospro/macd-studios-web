import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/admin/supabase-proxy'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const { supabase, getResponse } = createSupabaseProxyClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = pathname === '/admin/login'

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return getResponse()
}

export const config = {
  matcher: ['/admin/:path*'],
}
