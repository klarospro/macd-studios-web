import { PageHeader, Card } from '@/components/admin/ui'
import InvestmentForm from '../InvestmentForm'
import { createInvestment } from '../actions'

export default function NewInvestmentPage() {
  return (
    <div>
      <PageHeader title="Nueva inversión / préstamo" />
      <Card className="max-w-3xl">
        <InvestmentForm action={createInvestment} />
      </Card>
    </div>
  )
}
