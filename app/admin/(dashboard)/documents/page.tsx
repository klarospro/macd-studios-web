import { requireSession } from '@/lib/admin/dal'
import { listDocuments, getSignedDocumentUrls, type DocumentKind } from '@/lib/admin/storage'
import { PageHeader, Table, Th, Td, EmptyState, Badge } from '@/components/admin/ui'

export const revalidate = 0

const KINDS: DocumentKind[] = ['invoices', 'receipts', 'contracts']

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; year?: string }>
}) {
  const { supabase } = await requireSession()
  const { kind, year } = await searchParams

  const kindsToFetch = kind ? [kind as DocumentKind] : KINDS
  const lists = await Promise.all(kindsToFetch.map((k) => listDocuments(supabase, k)))
  let files = lists.flat()

  if (year) {
    files = files.filter((f) => (f.created_at ?? '').startsWith(year))
  }

  files.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  const signedUrls = await getSignedDocumentUrls(
    supabase,
    files.map((f) => f.path)
  )

  const years = [...new Set(files.map((f) => (f.created_at ?? '').slice(0, 4)).filter(Boolean))].sort().reverse()

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Recibos, contratos y PDFs de factura — la carpeta central para el informe anual"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <a href="/admin/documents" className={`text-xs px-3 py-1.5 rounded-lg ${!kind ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/5 text-zinc-400'}`}>
          Todos
        </a>
        {KINDS.map((k) => (
          <a
            key={k}
            href={`/admin/documents?kind=${k}${year ? `&year=${year}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${kind === k ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/5 text-zinc-400'}`}
          >
            {k}
          </a>
        ))}
        {years.map((y) => (
          <a
            key={y}
            href={`/admin/documents?year=${y}${kind ? `&kind=${kind}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-lg ${year === y ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/5 text-zinc-400'}`}
          >
            {y}
          </a>
        ))}
      </div>

      {!files.length ? (
        <EmptyState title="Sin documentos todavía" hint="Se archivan automáticamente al enviar facturas, subir recibos o contratos." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th>Fecha</Th>
              <Th>Tamaño</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.path} className="hover:bg-white/[0.02]">
                <Td className="text-white">{f.name}</Td>
                <Td>
                  <Badge tone="muted">{f.kind}</Badge>
                </Td>
                <Td className="text-zinc-500">{f.created_at?.slice(0, 10) ?? '—'}</Td>
                <Td className="text-zinc-500">{formatBytes(f.metadata?.size)}</Td>
                <Td>
                  {signedUrls.get(f.path) && (
                    <a href={signedUrls.get(f.path)} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline text-sm">
                      Descargar
                    </a>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
