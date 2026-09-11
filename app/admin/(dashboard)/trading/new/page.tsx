import { PageHeader, Card } from '@/components/admin/ui'
import AccountForm from '../AccountForm'
import { createTradingAccount } from '../actions'

export default function NewTradingAccountPage() {
  return (
    <div>
      <PageHeader title="Nueva cuenta de trading" />
      <Card className="max-w-2xl">
        <AccountForm action={createTradingAccount} />
      </Card>
    </div>
  )
}
