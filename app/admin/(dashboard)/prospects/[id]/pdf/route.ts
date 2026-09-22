import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { renderProposalPdf } from '@/lib/admin/pdf/ProposalDocument'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireSession()

  const { data: prospect } = await supabase.from('prospects').select('*').eq('id', id).single()
  if (!prospect) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  const pdfBuffer = await renderProposalPdf(prospect)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="propuesta-${prospect.client_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    },
  })
}
