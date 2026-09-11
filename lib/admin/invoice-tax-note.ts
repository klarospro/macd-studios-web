const US_ALIASES = ['US', 'USA', 'UNITED STATES', 'ESTADOS UNIDOS']
const SPAIN_ALIASES = ['ES', 'SPAIN', 'ESPAÑA', 'ESPANA']

/**
 * MACD Studios LLC no está establecida en la UE ni cobra sales tax de EE. UU. en servicios
 * digitales/profesionales. Devuelve la mención legal que debe aparecer en la factura según el
 * país del cliente (obligatoria y no opcional para España/UE por RD 1619/2012 — mención expresa
 * de inversión del sujeto pasivo). Null cuando el cliente es de EE. UU. (no aplica IVA/VAT).
 */
export function getTaxComplianceNote(client: { country?: string | null } | null | undefined): string | null {
  const country = client?.country?.trim().toUpperCase()
  if (!country || US_ALIASES.includes(country)) return null

  if (SPAIN_ALIASES.includes(country)) {
    return (
      'Operación no sujeta a IVA español — Inversión del sujeto pasivo (Art. 69.Uno.1º LIVA). ' +
      'Servicio prestado por MACD Studios LLC, entidad no establecida en la Unión Europea. ' +
      'El destinatario debe autoliquidar el IVA correspondiente en España.'
    )
  }

  return (
    'Servicio prestado por MACD Studios LLC (EE. UU.), entidad no establecida en la Unión Europea. ' +
    'Esta factura no incluye IVA/VAT local; el cliente es responsable de aplicar, si corresponde, el ' +
    'mecanismo de inversión del sujeto pasivo o autoliquidación de impuestos en su jurisdicción.'
  )
}
