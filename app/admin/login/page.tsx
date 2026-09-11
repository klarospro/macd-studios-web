import LoginForm from './LoginForm'

export const metadata = { title: 'Panel Financiero — MACD Studios' }

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-[#D4AF37]">MACD STUDIOS</h1>
          <p className="text-zinc-500 text-sm mt-1">Panel financiero privado</p>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
