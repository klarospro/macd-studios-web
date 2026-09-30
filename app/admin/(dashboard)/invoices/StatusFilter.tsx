'use client'

import { Select } from '@/components/admin/ui'

export function StatusFilter({ status }: { status?: string }) {
  return (
    <form className="mb-4">
      <Select name="status" defaultValue={status ?? ''} className="max-w-xs" onChange={(e) => e.currentTarget.form?.submit()}>
        <option value="">Todos los estados</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </Select>
    </form>
  )
}
