import 'server-only'

/**
 * Tasa de cambio EUR→USD. Usa exchangerate-api.com; si EXCHANGE_RATE_API_KEY está
 * configurada usa el endpoint con key (más fiable), si no cae al endpoint abierto v4
 * (gratuito, sin key, algo menos preciso pero suficiente).
 */
export async function getEurUsdRate(): Promise<number> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY

  const url = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/pair/EUR/USD`
    : `https://api.exchangerate-api.com/v4/latest/EUR`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`exchange rate API error ${res.status}`)
    const data = await res.json()

    const rate = apiKey ? data.conversion_rate : data.rates?.USD
    if (typeof rate !== 'number') throw new Error('respuesta inesperada de la API de tipo de cambio')

    return rate
  } catch {
    // Fallback conservador si la API externa falla — evita romper la creación de facturas.
    return 1.08
  }
}

export async function convertToUsd(amount: number, currency: string): Promise<{ usdAmount: number; rate: number }> {
  if (currency === 'USD') return { usdAmount: amount, rate: 1 }
  const rate = await getEurUsdRate()
  return { usdAmount: Math.round(amount * rate * 100) / 100, rate }
}
