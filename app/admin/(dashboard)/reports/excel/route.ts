import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { buildAnnualReport } from '@/lib/admin/reports'
import { buildAnnualReportExcel } from '@/lib/admin/excel-report'

export async function GET(request: Request) {
  const { supabase } = await requireSession()
  const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear()

  const report = await buildAnnualReport(supabase, year)
  const buffer = await buildAnnualReportExcel(report)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="MACD-Studios-Informe-${year}.xlsx"`,
    },
  })
}
