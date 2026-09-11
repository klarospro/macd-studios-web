'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37] transition-colors"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37] transition-colors"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#D4AF37] text-[#0A0A0A] font-semibold rounded-lg px-4 py-2.5 hover:bg-[#E8C766] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
