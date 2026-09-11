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
