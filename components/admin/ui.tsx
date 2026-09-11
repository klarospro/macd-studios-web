import { cn } from '@/lib/utils'
import Link from 'next/link'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('bg-[#111] border border-[#222] rounded-2xl p-5', className)}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-white">{title}</h1>
        {subtitle && <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'gold' | 'wine' | 'positive' | 'negative'
}) {
  const toneClass =
    tone === 'gold'
      ? 'text-[#D4AF37]'
      : tone === 'wine'
        ? 'text-[#e05555]'
        : tone === 'positive'
          ? 'text-emerald-400'
          : tone === 'negative'
            ? 'text-[#e05555]'
            : 'text-white'

  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn('text-2xl font-semibold mt-1.5 tabular-nums', toneClass)}>{value}</div>
      {hint && <div className="text-xs text-zinc-600 mt-1">{hint}</div>}
    </Card>
  )
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'gold' | 'wine' | 'positive' | 'negative' | 'muted' }) {
  const toneClass =
    {
      default: 'bg-white/10 text-zinc-300',
      gold: 'bg-[#D4AF37]/15 text-[#D4AF37]',
      wine: 'bg-[#8B1A1A]/20 text-[#e05555]',
      positive: 'bg-emerald-500/15 text-emerald-400',
      negative: 'bg-[#8B1A1A]/20 text-[#e05555]',
      muted: 'bg-white/5 text-zinc-500',
    }[tone]

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', toneClass)}>
      {children}
    </span>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-[#222] rounded-2xl p-10 text-center">
      <div className="text-zinc-500">{title}</div>
      {hint && <div className="text-zinc-700 text-sm mt-1">{hint}</div>}
    </div>
  )
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        variant === 'primary'
          ? 'bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#E8C766]'
          : 'bg-white/5 text-white border border-[#222] hover:bg-white/10'
      )}
    >
      {children}
    </Link>
  )
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#E8C766]',
        variant === 'secondary' && 'bg-white/5 text-white border border-[#222] hover:bg-white/10',
        variant === 'danger' && 'bg-[#8B1A1A]/20 text-[#e05555] border border-[#8B1A1A]/30 hover:bg-[#8B1A1A]/30',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full bg-[#0A0A0A] border border-[#222] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37] transition-colors placeholder:text-zinc-700',
        props.className
      )}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full bg-[#0A0A0A] border border-[#222] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37] transition-colors',
        props.className
      )}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full bg-[#0A0A0A] border border-[#222] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37] transition-colors placeholder:text-zinc-700',
        props.className
      )}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-700 mt-1">{hint}</span>}
    </label>
  )
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-[#222] rounded-2xl">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('text-left font-medium text-xs uppercase tracking-wide text-zinc-500 px-4 py-3 border-b border-[#222]', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 border-b border-[#1a1a1a]', className)}>{children}</td>
}

export function money(n: number | null | undefined, currency: string = 'USD') {
  const symbol = currency === 'EUR' ? '€' : '$'
  const v = n ?? 0
  const [int, dec] = Math.abs(v).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${v < 0 ? '-' : ''}${symbol}${grouped}.${dec}`
}
