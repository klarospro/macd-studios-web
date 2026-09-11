import 'server-only'
import ExcelJS from 'exceljs'
import type { AnnualReport } from './reports'

export async function buildAnnualReportExcel(report: AnnualReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MACD Studios LLC'
  wb.created = new Date()

  const pnlSheet = wb.addWorksheet('P&L')
  pnlSheet.columns = [{ header: 'Categoría', key: 'category', width: 30 }, { header: 'Total USD', key: 'total', width: 16 }]
  pnlSheet.addRow({ category: '— INGRESOS —', total: '' })
  for (const [cat, total] of Object.entries(report.incomeByCategory)) pnlSheet.addRow({ category: cat, total })
  pnlSheet.addRow({ category: 'Total ingresos', total: report.totalIncome })
  pnlSheet.addRow({})
  pnlSheet.addRow({ category: '— GASTOS —', total: '' })
  for (const [cat, total] of Object.entries(report.expenseByCategory)) pnlSheet.addRow({ category: cat, total })
  pnlSheet.addRow({ category: 'Total gastos', total: report.totalExpense })
  pnlSheet.addRow({})
  pnlSheet.addRow({ category: 'Beneficio neto', total: report.netProfit })

  const txSheet = wb.addWorksheet('Transactions')
  txSheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Categoría', key: 'category', width: 24 },
    { header: 'Descripción', key: 'description', width: 36 },
    { header: 'Monto', key: 'amount', width: 12 },
    { header: 'Moneda', key: 'currency', width: 8 },
    { header: 'USD', key: 'usd_amount', width: 12 },
    { header: 'Related party', key: 'related_party_name', width: 20 },
  ]
  for (const tx of report.transactions) {
    txSheet.addRow({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
      currency: tx.currency,
      usd_amount: tx.usd_amount,
      related_party_name: tx.is_related_party ? tx.related_party_name : '',
    })
  }

  const rpSheet = wb.addWorksheet('Form 5472 - Related Party')
  rpSheet.columns = [
    { header: 'Related Party', key: 'party', width: 24 },
    { header: 'Categoría', key: 'category', width: 24 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'USD', key: 'usd_amount', width: 12 },
  ]
  for (const entry of report.relatedParty.byParty) {
    for (const tx of entry.transactions) {
      rpSheet.addRow({ party: entry.name, category: tx.category, date: tx.date, usd_amount: tx.usd_amount })
    }
  }
  rpSheet.addRow({})
  rpSheet.addRow({ party: 'TOTAL', usd_amount: report.relatedParty.grandTotal })

  const bsSheet = wb.addWorksheet('Balance Sheet')
  bsSheet.columns = [{ header: 'Concepto', key: 'k', width: 30 }, { header: 'USD', key: 'v', width: 16 }]
  bsSheet.addRow({ k: 'Balance Mercury', v: report.balanceSheet.mercuryBalance ?? 'N/A' })
  bsSheet.addRow({ k: 'Cuentas por cobrar', v: report.balanceSheet.accountsReceivable })
  bsSheet.addRow({ k: 'Total activos', v: report.balanceSheet.assets })
  bsSheet.addRow({})
  bsSheet.addRow({ k: 'Préstamos pendientes', v: report.balanceSheet.outstandingLoans })
  bsSheet.addRow({ k: 'Total pasivos', v: report.balanceSheet.liabilities })
  bsSheet.addRow({})
  bsSheet.addRow({ k: 'Capital contribuido', v: report.balanceSheet.totalCapitalContributions })
  bsSheet.addRow({ k: 'Distribuciones', v: -report.balanceSheet.totalDistributions })
  bsSheet.addRow({ k: 'Beneficio neto retenido', v: report.netProfit })
  bsSheet.addRow({ k: 'Total equity', v: report.balanceSheet.equity })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
