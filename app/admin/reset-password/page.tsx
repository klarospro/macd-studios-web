import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/admin/supabase-server'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata = { title: 'Nueva contraseña — MACD Studios' }

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login?error=recovery_link_invalid')
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-[#D4AF37]">MACD STUDIOS</h1>
          <p className="text-zinc-500 text-sm mt-1">Pon tu contraseña nueva</p>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  )
}
