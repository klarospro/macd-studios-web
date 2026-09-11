import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

const InvoicePayment = z.object({
  kind: z.literal('invoice_payment'),
  invoiceNumber: z.string(),
})

const ServicePurchase = z.object({
  kind: z.literal('service_purchase'),
  serviceName: z.string(),
  amount: z.number().positive(),
  currency: z.enum(['usd', 'eur']).default('usd'),
  customerName: z.string(),
  customerEmail: z.email(),
})

const Investment = z.object({
  kind: z.literal('investment'),
  investmentType: z.enum(['capital_contribution', 'loan']),
  amount: z.number().positive(),
  currency: z.enum(['usd', 'eur']).default('usd'),
  investorName: z.string(),
  investorEmail: z.email(),
})

const BodySchema = z.discriminatedUnion('kind', [InvoicePayment, ServicePurchase, Investment])

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Solicitud inválida' }, { status: 400 })
  }
  const body = parsed.data
  const origin = new URL(request.url).origin
  const stripe = getStripe()

  if (body.kind === 'invoice_payment') {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('invoice_number', body.invoiceNumber).single()
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    if (invoice.status === 'paid') return NextResponse.json({ error: 'Esta factura ya está pagada' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Factura ${invoice.invoice_number}` },
            unit_amount: Math.round(invoice.total * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { kind: 'invoice_payment', invoice_id: invoice.id },
      success_url: `${origin}/pay/${invoice.invoice_number}?status=success`,
      cancel_url: `${origin}/pay/${invoice.invoice_number}?status=cancelled`,
    })
    return NextResponse.json({ url: session.url })
  }

  if (body.kind === 'service_purchase') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: body.customerEmail,
      line_items: [
        {
          price_data: {
            currency: body.currency,
            product_data: { name: body.serviceName },
            unit_amount: Math.round(body.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'service_purchase',
        service_name: body.serviceName,
        customer_name: body.customerName,
        customer_email: body.customerEmail,
      },
      success_url: `${origin}/?purchase=success`,
      cancel_url: `${origin}/?purchase=cancelled`,
    })
    return NextResponse.json({ url: session.url })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: body.investorEmail,
    line_items: [
      {
        price_data: {
          currency: body.currency,
          product_data: {
            name: body.investmentType === 'loan' ? 'Préstamo a MACD Studios LLC' : 'Aporte de capital — MACD Studios LLC',
          },
          unit_amount: Math.round(body.amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'investment',
      investment_type: body.investmentType,
      investor_name: body.investorName,
      investor_email: body.investorEmail,
    },
    success_url: `${origin}/invest?status=success`,
    cancel_url: `${origin}/invest?status=cancelled`,
  })
  return NextResponse.json({ url: session.url })
}
