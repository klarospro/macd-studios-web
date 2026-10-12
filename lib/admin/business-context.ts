import { createSupabaseServerClient } from '@/lib/admin/supabase-server'
import {
  getPlazoEntrega,
  PLAZO_ENTREGA_POR_DEFECTO,
  type PlazoEntrega,
} from '@/lib/admin/settings'

// Contexto de negocio compartido por los 5 agentes de /admin/agents — condensado del
// mismo material que ya usa "Max" (el bot de ventas en n8n) para que todos hablen
// del mismo negocio, sin inventar servicios o precios distintos.
//
// El plazo de entrega sale de la tabla `settings` (migración 0007) para poder cambiarlo
// sin desplegar: usa getBusinessContext(). La constante de abajo es el texto con el
// plazo por defecto, para quien lo necesite de forma síncrona.
function buildBusinessContext(plazo: PlazoEntrega): string {
  return `
MACD STUDIOS — agencia de automatización con IA en Reus, Tarragona (España). LLC en Wyoming, EIN 30-1502570.
Hace sistemas a medida: webs, CRM a medida, automatizaciones (recordatorios, informes, facturas,
pedidos a proveedores), bots con IA en WhatsApp/Telegram, citas y reservas, y marketing y redes.

PRECIOS — REGLA: en todo lo público (posts, anuncios, guiones, mensajes a leads, bots) NUNCA se dan
precios. Siempre "presupuesto a medida según lo que necesites, sin compromiso", y se deriva a Moisés
por WhatsApp (+34 623 47 47 06). Los planes públicos son Esencial, Profesional y Sistema completo, sin cifras.
Referencia INTERNA, solo para orientar propuestas en el panel (no publicar ni citar):
- Esencial: 0€ inicial + 290€/mes — web + bot básico + SEO
- Profesional: 700€ inicial + 390€/mes — + CRM + automatizaciones + citas + reportes
- Sistema completo (antes Premium): 1.500€ inicial + 590€/mes — + web premium + ads + redes + consultoría 2h/mes; un sistema de gestión a medida se cotiza aparte
Extras: redes sociales +200€/mes, ads 15% de inversión, llamadas IA +100€/mes, multi-local +80€/mes.

HOSTELERÍA — MACD Restaurant OS (TPV, carta QR con pago desde la mesa, stock, caja, VeriFactu,
asistente de WhatsApp y gerente por Telegram). Primer cliente: Santo Cali (bar-club en Reus),
contratado y en instalación en octubre de 2026. Se puede ofrecer a otros locales, siempre con
presupuesto a medida. No citar lo que pagó Santo Cali.

NICHO PRIORITARIO PARA CAPTACIÓN: inmobiliarias. Proyectos reales como referencia: Santo Cali
(hostelería), GROUP 360 (automatización completa) y Vida Nueva Reus (eventos). Demos: inmobiliaria,
clínica dental y restaurante. ATLAS no se menciona en la comunicación de MACD.

PLAZO Y GARANTÍA — sí se dicen en público (a diferencia de los precios): el sistema está
funcionando en ${plazo.diasMaximo} días como máximo, y si sale antes, mejor. Garantía:
"${plazo.garantiaPublica}". Importante al decirlo: el contador arranca cuando el cliente
entrega sus datos (textos, logo, accesos), no el día de la firma. No prometer plazos más
cortos que ${plazo.diasMaximo} días para un caso concreto sin que lo confirme Moisés.

GANCHO DE CAPTACIÓN: auditoría gratis ("cuántos clientes pierdes por contestar tarde"), sin bonos de descuento.

DEMOS: dental (aurora-dental-demo-yr9e.vercel.app), restaurante (pizza-studio-demo.vercel.app),
inmobiliaria (vista-inmobiliaria-demo-5w7y.vercel.app), agencia (macdestudios.com).

TONO: directo, cercano, sin relleno corporativo. Nada de "estimado cliente" ni frases genéricas de IA.
`.trim()
}

/** Contexto con el plazo por defecto (15 días). Para usos síncronos y como fallback. */
export const MACD_BUSINESS_CONTEXT = buildBusinessContext(PLAZO_ENTREGA_POR_DEFECTO)

/**
 * Contexto con el plazo real guardado en `settings`. Es lo que deben usar los agentes:
 * así cambiar el plazo en la base de datos se refleja sin tocar código.
 * Solo se puede llamar dentro de una request (usa las cookies de la sesión).
 */
export async function getBusinessContext(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient()
    return buildBusinessContext(await getPlazoEntrega(supabase))
  } catch {
    return MACD_BUSINESS_CONTEXT
  }
}
