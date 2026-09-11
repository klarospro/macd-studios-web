'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  LineChart,
  HandCoins,
  FolderOpen,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { href: '/admin/trading', label: 'Trading', icon: LineChart },
  { href: '/admin/investments', label: 'Investments', icon: HandCoins },
  { href: '/admin/documents', label: 'Documents', icon: FolderOpen },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-60 shrink-0 bg-[#0D0D0D] border-r border-[#1c1c1c] md:h-screen md:sticky md:top-0 flex md:flex-col">
      <div className="p-5 border-b border-[#1c1c1c] hidden md:block">
        <div className="font-display text-lg text-[#D4AF37]">MACD STUDIOS</div>
        <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{email}</div>
      </div>

      <nav className="flex-1 flex md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-3 gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0',
                active
                  ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <form action="/admin/logout" method="POST" className="p-3 border-t border-[#1c1c1c] hidden md:block">
        <button
          type="submit"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-[#e05555] hover:bg-[#8B1A1A]/10 transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </form>
    </aside>
  )
}
