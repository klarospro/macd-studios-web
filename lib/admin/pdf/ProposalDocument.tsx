import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { Prospect } from '@/lib/admin/types'

const GOLD = '#D4AF37'
const MUTED = '#6b6b6b'
const BLACK = '#0A0A0A'

const STATUS_LABEL: Record<string, string> = {
  prospecto: 'Prospecto',
  propuesta_enviada: 'Propuesta enviada',
  negociacion: 'En negociación',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: BLACK },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  docTitle: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: GOLD, textAlign: 'right' },
  docMeta: { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 2 },
  goldRule: { height: 2, backgroundColor: GOLD, marginBottom: 24 },
  section: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  boxTitle: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 10, marginBottom: 2 },
  block: { marginBottom: 22 },
  blockTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLACK, marginBottom: 8, borderBottom: `1px solid ${GOLD}`, paddingBottom: 4 },
  body: { fontSize: 10, lineHeight: 1.6, color: '#333' },
  investmentBox: { backgroundColor: '#faf7ee', border: `1px solid ${GOLD}`, borderRadius: 4, padding: 16, alignItems: 'flex-end', marginTop: 8 },
  investmentLabel: { fontSize: 9, color: MUTED, textTransform: 'uppercase' },
  investmentValue: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: GOLD, marginTop: 4 },
  steps: { marginTop: 4 },
  stepRow: { flexDirection: 'row', marginBottom: 6 },
  stepNum: { width: 18, fontSize: 10, fontFamily: 'Helvetica-Bold', color: GOLD },
  stepText: { flex: 1, fontSize: 10, color: '#333' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  signBox: { width: '45%', borderTop: '1px solid #999', paddingTop: 6 },
  signLabel: { fontSize: 8, color: MUTED },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: MUTED, textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 10 },
})

function money(n: number | null, currency: string) {
  if (n == null) return '—'
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function todayPlus(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('es-ES')
}

export function ProposalDocument({ prospect }: { prospect: Prospect }) {
  const ref = `MACD-PROP-${prospect.id.slice(0, 8).toUpperCase()}`
  const issueDate = new Date(prospect.created_at).toLocaleDateString('es-ES')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>MACD STUDIOS LLC</Text>
            <Text style={styles.brandSub}>Wyoming, EE. UU. · EIN 30-1502570</Text>
            <Text style={styles.brandSub}>hola@macdestudios.com · macdestudios.com</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>PROPUESTA</Text>
            <Text style={styles.docMeta}>{ref}</Text>
            <Text style={styles.docMeta}>Emitida: {issueDate}</Text>
            <Text style={styles.docMeta}>Válida hasta: {todayPlus(30)}</Text>
          </View>
        </View>

        <View style={styles.goldRule} />

        <View style={styles.section}>
          <View>
            <Text style={styles.boxTitle}>Cliente potencial</Text>
            <Text style={styles.value}>{prospect.client_name}</Text>
            {prospect.contact && <Text style={styles.value}>{prospect.contact}</Text>}
          </View>
          <View>
            <Text style={styles.boxTitle}>Estado</Text>
            <Text style={styles.value}>{STATUS_LABEL[prospect.status] ?? prospect.status}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Servicio propuesto</Text>
          <Text style={styles.body}>{prospect.service || 'A definir junto al cliente.'}</Text>
        </View>

        {prospect.notes && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Alcance y detalles</Text>
            <Text style={styles.body}>{prospect.notes}</Text>
          </View>
        )}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Inversión</Text>
          <View style={styles.investmentBox}>
            <Text style={styles.investmentLabel}>Total</Text>
            <Text style={styles.investmentValue}>{money(prospect.amount, prospect.currency)}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Próximos pasos</Text>
          <View style={styles.steps}>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>1.</Text>
              <Text style={styles.stepText}>Confirmar el alcance descrito arriba.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>2.</Text>
              <Text style={styles.stepText}>Firmar esta propuesta y coordinar fechas.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>3.</Text>
              <Text style={styles.stepText}>Arranque del proyecto según cronograma acordado.</Text>
            </View>
          </View>
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Por MACD Studios LLC — Moisés Chirino, CEO & Founder</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Por {prospect.client_name}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          MACD Studios LLC — Wyoming, USA — EIN 30-1502570 — Sede operativa: Reus, Tarragona, España.
          {'\n'}
          {ref} — Este documento no constituye factura.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(prospect: Prospect): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument prospect={prospect} />)
}
