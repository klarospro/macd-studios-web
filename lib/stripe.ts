import 'server-only'
import Stripe from 'stripe'

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY no está configurado en .env.local')
    }
    client = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return client
}
