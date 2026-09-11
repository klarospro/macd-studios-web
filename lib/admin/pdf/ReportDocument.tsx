import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { AnnualReport } from '@/lib/admin/reports'

const GOLD = '#D4AF37'
const BLACK = '#0A0A0A'
const MUTED = '#6b6b6b'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: BLACK, marginBottom: 2 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: GOLD, marginTop: 20, marginBottom: 8 },
  sub: { fontSize: 9, color: MUTED, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottom: '1px solid #eee' },
  rowBold: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTop: `1px solid ${GOLD}`, marginTop: 4 },
  label: { fontSize: 9 },
  labelBold: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  value: { fontSize: 9, fontFamily: 'Courier' },
  valueBold: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GOLD },
})

function money(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ReportDocument({ report }: { report: AnnualReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>MACD Studios LLC</Text>
        <Text style={styles.sub}>Informe anual {report.year} — Wyoming, EE. UU. · EIN 30-1502570</Text>

        <Text style={styles.h2}>P&amp;L — Ingresos por categoría</Text>
        {Object.entries(report.incomeByCategory).map(([cat, total]) => (
          <View style={styles.row} key={cat}>
            <Text style={styles.label}>{cat}</Text>
            <Text style={styles.value}>{money(total)}</Text>
          </View>
        ))}
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total ingresos</Text>
          <Text style={styles.valueBold}>{money(report.totalIncome)}</Text>
        </View>

        <Text style={styles.h2}>P&amp;L — Gastos por categoría</Text>
        {Object.entries(report.expenseByCategory).map(([cat, total]) => (
          <View style={styles.row} key={cat}>
            <Text style={styles.label}>{cat}</Text>
            <Text style={styles.value}>{money(total)}</Text>
          </View>
        ))}
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total gastos</Text>
          <Text style={styles.valueBold}>{money(report.totalExpense)}</Text>
        </View>

        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Beneficio neto</Text>
          <Text style={styles.valueBold}>{money(report.netProfit)}</Text>
        </View>

        <Text style={styles.h2}>Balance sheet</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Balance Mercury</Text>
          <Text style={styles.value}>{report.balanceSheet.mercuryBalance != null ? money(report.balanceSheet.mercuryBalance) : 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cuentas por cobrar</Text>
          <Text style={styles.value}>{money(report.balanceSheet.accountsReceivable)}</Text>
        </View>
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total activos</Text>
          <Text style={styles.valueBold}>{money(report.balanceSheet.assets)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={styles.label}>Préstamos pendientes</Text>
          <Text style={styles.value}>{money(report.balanceSheet.outstandingLoans)}</Text>
        </View>
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total pasivos</Text>
          <Text style={styles.valueBold}>{money(report.balanceSheet.liabilities)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={styles.label}>Capital contribuido</Text>
          <Text style={styles.value}>{money(report.balanceSheet.totalCapitalContributions)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Distribuciones</Text>
          <Text style={styles.value}>-{money(report.balanceSheet.totalDistributions)}</Text>
        </View>
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total equity</Text>
          <Text style={styles.valueBold}>{money(report.balanceSheet.equity)}</Text>
        </View>

        <Text style={styles.h2}>Form 5472 — Related party transactions</Text>
        {report.relatedParty.byParty.map((entry) => (
          <View key={entry.name} style={{ marginBottom: 6 }}>
            <View style={styles.row}>
              <Text style={styles.labelBold}>{entry.name}</Text>
              <Text style={styles.valueBold}>{money(entry.total)}</Text>
            </View>
          </View>
        ))}
        <View style={styles.rowBold}>
          <Text style={styles.labelBold}>Total related party</Text>
          <Text style={styles.valueBold}>{money(report.relatedParty.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderReportPdf(report: AnnualReport): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />)
}
