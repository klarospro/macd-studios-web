import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { buildAnnualReport } from '@/lib/admin/reports'
import { renderReportPdf } from '@/lib/admin/pdf/ReportDocument'

export async function GET(request: Request) {
  const { supabase } = await requireSession()
  const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear()

  const report = await buildAnnualReport(supabase, year)
  const pdfBuffer = await renderReportPdf(report)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="MACD-Studios-Informe-${year}.pdf"`,
    },
  })
}
