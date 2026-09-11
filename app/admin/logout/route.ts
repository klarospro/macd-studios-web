import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/admin/supabase-server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/admin/login', request.url))
}
