import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'
import { convertToUsd } from '@/lib/admin/exchange-rate'
import { generateInvoiceNumber } from '@/lib/admin/invoice-number'

export async function POST(request: Request) {
  const stripe = getStripe()
  const signature = request.headers.get('stripe-signature')
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? '', process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature inválida: ${err instanceof Error ? err.message : ''}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    await handleCheckoutCompleted(session)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind
  const amountTotal = (session.amount_total ?? 0) / 100
  const currency = (session.currency ?? 'usd').toUpperCase()

  if (kind === 'invoice_payment') {
    const invoiceId = session.metadata?.invoice_id
    if (!invoiceId) return

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('category', 'Client Payment')
      .maybeSingle()
    if (existingTx) return

    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (!invoice) return

    await supabase
      .from('invoices')
      .update({ status: 'paid', stripe_payment_id: session.payment_intent as string, payment_method: 'Stripe' })
      .eq('id', invoiceId)

    const { usdAmount, rate } = await convertToUsd(invoice.total, invoice.currency)
    await supabase.from('transactions').insert({
      date: new Date().toISOString().slice(0, 10),
      type: 'income',
      category: 'Client Payment',
      description: `Pago factura ${invoice.invoice_number} (Stripe)`,
      amount: invoice.total,
      currency: invoice.currency,
      usd_amount: usdAmount,
      exchange_rate: rate,
      invoice_id: invoiceId,
    })
    return
  }

  if (kind === 'service_purchase') {
    const serviceName = session.metadata?.service_name ?? 'Servicio MACD Studios'
    const customerName = session.metadata?.customer_name ?? 'Cliente web'
    const customerEmail = session.metadata?.customer_email ?? session.customer_details?.email ?? null

    // Evita duplicar si Stripe reintenta el webhook para la misma sesión.
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('stripe_payment_id', session.id)
      .maybeSingle()
    if (existingInvoice) return

    let clientId: string
    const { data: existingClient } = customerEmail
      ? await supabase.from('clients').select('id').eq('email', customerEmail).maybeSingle()
      : { data: null }

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ name: customerName, email: customerEmail })
        .select('id')
        .single()
      if (error || !newClient) return
      clientId = newClient.id
    }

    const today = new Date().toISOString().slice(0, 10)
    const invoiceNumber = await generateInvoiceNumber(supabase)

    const { data: invoice } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        invoice_number: invoiceNumber,
        issue_date: today,
        due_date: today,
        currency,
        exchange_rate: currency === 'EUR' ? (await convertToUsd(1, 'EUR')).rate : 1,
        subtotal: amountTotal,
        tax_total: 0,
        total: amountTotal,
        status: 'paid',
        payment_method: 'Stripe',
        stripe_payment_id: session.id,
      })
      .select('id')
      .single()
    if (!invoice) return

    await supabase.from('invoice_items').insert({
      invoice_id: invoice.id,
      description: serviceName,
      quantity: 1,
      unit_price: amountTotal,
      tax_rate: 0,
      sort_order: 0,
    })

    const { usdAmount, rate } = await convertToUsd(amountTotal, currency)
    await supabase.from('transactions').insert({
      date: today,
      type: 'income',
      category: 'Client Payment',
      description: `Compra web: ${serviceName} — ${customerName}`,
      amount: amountTotal,
      currency,
      usd_amount: usdAmount,
      exchange_rate: rate,
      invoice_id: invoice.id,
    })
    return
  }

  if (kind === 'investment') {
    const investmentType = (session.metadata?.investment_type as 'capital_contribution' | 'loan') ?? 'capital_contribution'
    const investorName = session.metadata?.investor_name ?? 'Inversor web'
    const investorEmail = session.metadata?.investor_email ?? null

    const { data: existing } = await supabase.from('investments').select('id').eq('notes', `stripe:${session.id}`).maybeSingle()
    if (existing) return

    const { data: investment, error } = await supabase
      .from('investments')
      .insert({
        investor_name: investorName,
        relationship: 'external',
        type: investmentType,
        amount: amountTotal,
        currency,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        notes: `stripe:${session.id}${investorEmail ? ` — ${investorEmail}` : ''}`,
      })
      .select('id')
      .single()
    if (error || !investment) return

    const { usdAmount, rate } = await convertToUsd(amountTotal, currency)
    await supabase.from('transactions').insert({
      date: new Date().toISOString().slice(0, 10),
      type: 'income',
      category: investmentType === 'capital_contribution' ? 'Third-Party Investment' : 'Investor Loan',
      description: `${investmentType === 'loan' ? 'Préstamo' : 'Inversión'} vía web — ${investorName}`,
      amount: amountTotal,
      currency,
      usd_amount: usdAmount,
      exchange_rate: rate,
      investment_id: investment.id,
      is_related_party: false,
    })
  }
}
