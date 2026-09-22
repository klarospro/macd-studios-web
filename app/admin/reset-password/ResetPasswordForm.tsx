'use client'

import { useActionState } from 'react'
import { updatePassword } from './actions'

export default function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
          Contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#D4AF37] transition-colors"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
          Repite la contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
