import { Toaster } from 'sonner'
import { requireSession } from '@/lib/admin/dal'
import Sidebar from './Sidebar'

export const metadata = { title: 'Panel Financiero — MACD Studios' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      <Sidebar email={user.email ?? ''} />
      <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: { background: '#111', border: '1px solid #222', color: '#fff' },
        }}
      />
    </div>
  )
}
