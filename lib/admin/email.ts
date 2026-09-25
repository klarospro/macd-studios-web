import 'server-only'
import { Resend } from 'resend'

let client: Resend | null = null
function getResend(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurado en .env.local')
    }
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  total,
  currency,
  dueDate,
  pdfBuffer,
  payLink,
}: {
  to: string
  invoiceNumber: string
  total: number
  currency: string
  dueDate: string
  pdfBuffer: Buffer
  payLink?: string
}) {
  const resend = getResend()
  const from = process.env.RESEND_FROM || 'facturacion@macdestudios.com'
  const symbol = currency === 'EUR' ? '€' : '$'

  await resend.emails.send({
    from,
    to,
    subject: `Factura ${invoiceNumber} — MACD Studios LLC`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#0A0A0A; color:#f5f5f5; padding:32px;">
        <h2 style="color:#D4AF37; margin-bottom:4px;">MACD Studios LLC</h2>
        <p style="color:#999; margin-top:0;">Factura ${invoiceNumber}</p>
        <p>Adjuntamos la factura ${invoiceNumber} por un total de <strong>${symbol}${total.toFixed(2)}</strong>,
        con vencimiento el ${dueDate}.</p>
        ${payLink ? `<p><a href="${payLink}" style="background:#D4AF37;color:#0A0A0A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Pagar factura</a></p>` : ''}
        <p style="color:#666; font-size:12px; margin-top:32px;">MACD Studios LLC — Wyoming, EE. UU.</p>
      </div>
    `,
    attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer }],
  })
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const CONTACTO_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  llamada: 'una llamada',
  email: 'email',
}

// Confirmación automática al lead que pide la auditoría gratis desde la web.
export async function sendAuditConfirmationEmail({
  to,
  nombre,
  contacto,
}: {
  to: string
  nombre: string
  contacto: string
}) {
  const resend = getResend()
  const from = process.env.RESEND_FROM_CONTACT || 'MACD Studios <hola@macdestudios.com>'
  const via = CONTACTO_LABEL[contacto] ?? 'email'

  await resend.emails.send({
    from,
    to,
    replyTo: process.env.ADMIN_EMAIL || undefined,
    subject: 'Recibimos tu solicitud de auditoría — MACD Studios',
    html: `
      <div style="font-family: Arial, sans-serif; background:#0A0A0A; color:#f5f5f5; padding:32px;">
        <h2 style="color:#D4AF37; margin-bottom:4px;">MACD Studios</h2>
        <p>Saludos, ${escapeHtml(nombre)}.</p>
        <p>Recibimos tu solicitud de <strong>auditoría gratis</strong>. Vamos a estudiar tu caso y te
        contactamos por <strong>${via}</strong> para agendar una llamada, donde te mostramos dónde se te
        escapan clientes y cómo solucionarlo.</p>
        <p>Si quieres adelantarte, puedes hablar ya con Max, nuestro asistente, en
        <a href="https://t.me/macdstudios_bot" style="color:#D4AF37;">t.me/macdstudios_bot</a>.</p>
        <p>— Moisés, MACD Studios</p>
        <p style="color:#666; font-size:12px; margin-top:32px;">Recibes este correo porque solicitaste una auditoría en macdestudios.com.</p>
      </div>
    `,
  })
}
