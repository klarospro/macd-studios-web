'use client'

import { useActionState, useMemo, useState } from 'react'
import { Field, Input, Select, Textarea, Button, Table, Th, Td, money } from '@/components/admin/ui'
import type { Client, Invoice, InvoiceItem, InvoiceStatus } from '@/lib/admin/types'

type Line = { description: string; quantity: number; unit_price: number; tax_rate: number }

const EMPTY_LINE: Line = { description: '', quantity: 1, unit_price: 0, tax_rate: 0 }
const PAYMENT_METHODS = ['Wire Transfer', 'Stripe', 'PayPal', 'Crypto', 'Cash']
const STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

const LINE_TEMPLATES = [
  { label: 'Página web', description: 'Desarrollo de página web' },
  { label: 'App', description: 'Desarrollo de aplicación' },
  { label: 'Automatización', description: 'Sistema de automatización' },
  { label: 'Sistema automático', description: 'Sistema automático / bot 24-7' },
  { label: 'Servicio', description: 'Servicio profesional' },
  { label: 'Préstamo', description: 'Préstamo' },
  { label: 'Inversión', description: 'Inversión de capital' },
]

export default function InvoiceForm({
  clients,
  invoice,
  items,
  action,
}: {
  clients: Pick<Client, 'id' | 'name' | 'company'>[]
  invoice?: Invoice
  items?: InvoiceItem[]
  action: (prev: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [lines, setLines] = useState<Line[]>(
    items?.length
      ? items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate }))
      : [EMPTY_LINE]
  )
  const [currency, setCurrency] = useState(invoice?.currency ?? 'USD')

  const totals = useMemo(() => {
    let subtotal = 0
    let tax = 0
    for (const l of lines) {
      const lineSubtotal = (l.quantity || 0) * (l.unit_price || 0)
      subtotal += lineSubtotal
      tax += lineSubtotal * ((l.tax_rate || 0) / 100)
    }
    return { subtotal, tax, total: subtotal + tax }
  }, [lines])

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const form = e.currentTarget
        const itemsInput = form.elements.namedItem('items') as HTMLInputElement
        itemsInput.value = JSON.stringify(lines)
      }}
      className="space-y-6"
    >
      <input type="hidden" name="items" />

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Cliente *">
          <Select name="client_id" defaultValue={invoice?.client_id ?? ''} required>
            <option value="" disabled>
              Selecciona un cliente
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Moneda">
          <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={invoice?.status ?? 'draft'}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de emisión">
          <Input type="date" name="issue_date" defaultValue={invoice?.issue_date ?? today} required />
        </Field>
        <Field label="Fecha de vencimiento">
          <Input type="date" name="due_date" defaultValue={invoice?.due_date ?? today} required />
        </Field>
        <Field label="Método de pago">
          <Select name="payment_method" defaultValue={invoice?.payment_method ?? ''}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-400">Líneas de servicio</h3>
          <div className="flex items-center gap-2">
            <Select
              className="w-48"
              value=""
              onChange={(e) => {
                const template = LINE_TEMPLATES.find((t) => t.label === e.target.value)
                if (template) setLines((p) => [...p, { ...EMPTY_LINE, description: template.description }])
              }}
            >
              <option value="" disabled>
                Plantilla…
              </option>
              {LINE_TEMPLATES.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])}>
              + Añadir línea
            </Button>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Descripción</Th>
              <Th className="w-24">Cant.</Th>
              <Th className="w-32">Precio</Th>
              <Th className="w-24">Imp. %</Th>
              <Th className="w-32 text-right">Total</Th>
              <Th className="w-10"></Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <Td>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="Descripción del servicio"
                    required
                  />
                </Td>
                <Td>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </Td>
                <Td>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                  />
                </Td>
                <Td>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.tax_rate}
                    onChange={(e) => updateLine(i, { tax_rate: Number(e.target.value) })}
                  />
                </Td>
                <Td className="text-right tabular-nums">
                  {money(line.quantity * line.unit_price * (1 + line.tax_rate / 100), currency)}
                </Td>
                <Td>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                      className="text-zinc-600 hover:text-[#e05555]"
                    >
                      ×
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="flex justify-end mt-3">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Impuesto</span>
              <span className="tabular-nums">{money(totals.tax, currency)}</span>
            </div>
            <div className="flex justify-between text-white font-semibold text-base pt-1 border-t border-[#222]">
              <span>Total</span>
              <span className="tabular-nums text-[#D4AF37]">{money(totals.total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      <Field label="Notas / términos de pago">
        <Textarea name="notes" rows={3} defaultValue={invoice?.notes ?? ''} />
      </Field>

      {state?.error && (
        <p className="text-sm text-[#e05555] bg-[#8B1A1A]/10 border border-[#8B1A1A]/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : invoice ? 'Guardar cambios' : 'Crear factura'}
      </Button>
    </form>
  )
}
