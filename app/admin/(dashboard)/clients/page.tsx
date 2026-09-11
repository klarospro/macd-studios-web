import Link from 'next/link'
import { requireSession } from '@/lib/admin/dal'
import { PageHeader, LinkButton, Table, Th, Td, EmptyState, Badge, Input } from '@/components/admin/ui'
import type { Client } from '@/lib/admin/types'

export const revalidate = 0

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { supabase } = await requireSession()
  const { q } = await searchParams

  let query = supabase.from('clients').select('*').order('created_at', { ascending: false })
  if (q) {
    query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
  }
  const { data: clients } = await query

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clients?.length ?? 0} cliente(s)`}
        action={<LinkButton href="/admin/clients/new">+ Nuevo cliente</LinkButton>}
      />

      <form className="mb-4">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre, empresa o email…" className="max-w-sm" />
      </form>

      {!clients?.length ? (
        <EmptyState title="Sin clientes todavía" hint="Crea tu primer cliente para empezar a facturar." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Empresa</Th>
              <Th>Email</Th>
              <Th>País</Th>
              <Th>Moneda</Th>
            </tr>
          </thead>
          <tbody>
            {(clients as Client[]).map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <Td>
                  <Link href={`/admin/clients/${c.id}`} className="text-white hover:text-[#D4AF37] font-medium">
                    {c.name}
                  </Link>
                </Td>
                <Td className="text-zinc-400">{c.company || '—'}</Td>
                <Td className="text-zinc-400">{c.email || '—'}</Td>
                <Td className="text-zinc-400">{c.country || '—'}</Td>
                <Td>
                  <Badge tone="muted">{c.preferred_currency}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
