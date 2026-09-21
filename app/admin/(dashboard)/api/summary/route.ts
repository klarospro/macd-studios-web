import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/dal'
import { buildAnnualReport } from '@/lib/admin/reports'

/**
 * Resumen de solo lectura para agregadores externos (ej. dashboards/financial.html
 * en la raíz de projects/). Protegido igual que el resto de /admin: proxy.ts exige
 * sesión, y requireSession() la vuelve a validar aquí.
 */
export async function GET(request: Request) {
  const { supabase } = await requireSession()
  const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getFullYear()

  const report = await buildAnnualReport(supabase, year)

  return NextResponse.json({
    year: report.year,
    totalIncome: report.totalIncome,
    totalExpense: report.totalExpense,
    netProfit: report.netProfit,
    balanceSheet: report.balanceSheet,
  })
}
