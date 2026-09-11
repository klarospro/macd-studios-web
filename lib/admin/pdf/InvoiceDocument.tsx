import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { Client, Invoice, InvoiceItem } from '@/lib/admin/types'
import { getTaxComplianceNote } from '@/lib/admin/invoice-tax-note'

// Fuentes estándar (Helvetica) en vez de registrar Playfair/Inter por URL remota — evita que
// la generación de PDF dependa de una llamada de red a Google Fonts en cada request.
const GOLD = '#D4AF37'
const WINE = '#8B1A1A'
const BLACK = '#0A0A0A'
const MUTED = '#6b6b6b'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: BLACK },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  invoiceTitle: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: GOLD, textAlign: 'right' },
  invoiceMeta: { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 2 },
  goldRule: { height: 2, backgroundColor: GOLD, marginBottom: 20 },
  section: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 10, marginBottom: 2 },
  table: { borderTop: `1px solid #ddd`, borderBottom: `1px solid #ddd`, marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f7f3ea', paddingVertical: 6, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderTop: '1px solid #eee' },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase' },
  td: { fontSize: 9 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colTax: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totals: { alignSelf: 'flex-end', width: 220, marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${GOLD}` },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLACK },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GOLD },
  statusBadge: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  notes: { marginTop: 24, fontSize: 8, color: MUTED, lineHeight: 1.5 },
  taxNote: { marginTop: 12, fontSize: 8, color: MUTED, lineHeight: 1.5, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: MUTED, textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 10 },
})

const STATUS_COLOR: Record<string, string> = {
  draft: '#999',
  sent: '#2563eb',
  paid: '#16a34a',
  overdue: WINE,
  cancelled: '#666',
}

function money(n: number, currency: string) {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${n.toFixed(2)}`
}

export function InvoiceDocument({
  invoice,
  client,
  items,
}: {
  invoice: Invoice
  client: Client | null
  items: InvoiceItem[]
}) {
  const taxNote = getTaxComplianceNote(client)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>MACD STUDIOS LLC</Text>
            <Text style={styles.brandSub}>Wyoming, EE. UU. · EIN 30-1502570</Text>
            <Text style={styles.brandSub}>hola@macdestudios.com</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURA</Text>
            <Text style={styles.invoiceMeta}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>Emitida: {invoice.issue_date}</Text>
            <Text style={styles.invoiceMeta}>Vence: {invoice.due_date}</Text>
          </View>
        </View>

        <View style={styles.goldRule} />

        <View style={styles.section}>
          <View>
            <Text style={styles.label}>Facturar a</Text>
            <Text style={styles.value}>{client?.name ?? '—'}</Text>
            {client?.company && <Text style={styles.value}>{client.company}</Text>}
            {client?.tax_id && <Text style={styles.value}>Tax ID: {client.tax_id}</Text>}
            {client?.address && <Text style={styles.value}>{client.address}</Text>}
            {(client?.city || client?.country) && (
              <Text style={styles.value}>{[client?.city, client?.state, client?.country].filter(Boolean).join(', ')}</Text>
            )}
            {client?.email && <Text style={styles.value}>{client.email}</Text>}
          </View>
          <View>
            <Text style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[invoice.status]}22`, color: STATUS_COLOR[invoice.status] }]}>
              {invoice.status.toUpperCase()}
            </Text>
            {invoice.payment_method && (
              <Text style={[styles.value, { marginTop: 8 }]}>Método: {invoice.payment_method}</Text>
            )}
            {invoice.currency === 'EUR' && (
              <Text style={styles.value}>Tipo de cambio: 1 EUR = {invoice.exchange_rate} USD</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colPrice]}>Precio</Text>
            <Text style={[styles.th, styles.colTax]}>Impuesto</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {items.map((item) => (
            <View style={styles.tableRow} key={item.id}>
              <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>{money(item.unit_price, invoice.currency)}</Text>
              <Text style={[styles.td, styles.colTax]}>{item.tax_rate}%</Text>
              <Text style={[styles.td, styles.colTotal]}>{money(item.line_total, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(invoice.subtotal, invoice.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Impuesto</Text>
            <Text style={styles.totalValue}>{money(invoice.tax_total, invoice.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{money(invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.label}>Notas / términos de pago</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {taxNote && (
          <View style={styles.taxNote}>
            <Text>{taxNote}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          MACD Studios LLC — Foreign-owned U.S. disregarded entity. Este documento se conserva como
          registro contable conforme a los requisitos de IRS Form 5472.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(invoice: Invoice, client: Client | null, items: InvoiceItem[]): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} client={client} items={items} />)
}
