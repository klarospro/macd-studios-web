/**
 * Plantillas de contrato y correos de Atlas (texto canónico).
 * Copias legibles para editar a mano en `ATLAS-AI/25_TEMPLATES/`.
 *
 * AVISO: borradores de presentación, NO asesoramiento legal. Antes de usarlos con
 * clientes reales deben ser revisados por un abogado (jurisdicción, fiscalidad, etc.).
 */

export interface AtlasApplicant {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  capital?: number | null
  currency?: string | null
  account_type?: string | null
  agenda?: string | null
  created_at?: string | null
}

const PERFIL: Record<string, string> = {
  inversor: 'Inversor — capital gestionado bajo la metodología Atlas',
  accionista: 'Accionista — socio partícipe de la firma',
  plantilla: 'Licencia de plantilla — uso del sistema para cuenta propia',
}

function importe(a: AtlasApplicant): string {
  if (a.capital == null || !Number.isFinite(a.capital)) return 'por confirmar'
  return `${a.capital.toLocaleString('es-ES')} ${a.currency ?? 'USD'}`
}

const hoy = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

/** Contrato de gestión (borrador). Devuelve texto plano con los datos del cliente. */
export function renderContrato(a: AtlasApplicant): string {
  const perfil = PERFIL[a.account_type ?? 'inversor'] ?? PERFIL.inversor
  return `CONTRATO DE GESTIÓN DE CAPITAL — ATLAS · MACD STUDIOS
(Borrador de presentación · sujeto a revisión legal)

Fecha: ${hoy()}

ENTRE:
  ATLAS, unidad de gestión de capital de MACD Studios, operada a través de
  [ATLAS LLC — sociedad en EE. UU., datos de constitución por confirmar] (en adelante, "el Gestor").
Y:
  ${a.name}${a.address ? `, con domicilio en ${a.address}` : ''} (en adelante, "el Cliente").
  Contacto: ${a.email}${a.phone ? ` · ${a.phone}` : ''}.

1. OBJETO
   El Cliente encomienda al Gestor la gestión discrecional de capital bajo la
   metodología Atlas. Perfil contratado: ${perfil}.
   Capital de referencia: ${importe(a)}.

2. DOCTRINA DE GESTIÓN
   La preservación del capital es la primera prioridad, por delante de la
   rentabilidad. El Gestor aplica límites de riesgo explícitos (riesgo por
   operación acotado, control de drawdown y diversificación multi-activo) y opera
   mediante un sistema automatizado supervisado.

3. RIESGO Y AUSENCIA DE GARANTÍA
   Toda inversión conlleva riesgo de pérdida. El Gestor NO garantiza rentabilidad
   alguna. Los resultados pasados no garantizan resultados futuros. Toda operativa
   se valida primero en entornos de prueba (demo/paper).

4. RENDIMIENTOS Y RETIROS
   Los rendimientos se calculan sobre el periodo pactado. El Cliente podrá solicitar
   el retiro de ganancias de forma TRIMESTRAL o ANUAL, según la modalidad elegida,
   mediante el formulario oficial de retiros. Los retiros se ejecutan tras la
   aprobación del Gestor y la verificación de disponibilidad.

5. COMISIONES
   [PENDIENTE DE DEFINIR] — comisión de gestión y/o de éxito (high-water mark).

6. CONFIDENCIALIDAD Y DATOS
   Los datos del Cliente se tratan de forma confidencial y solo para la prestación
   del servicio, conforme a la normativa de protección de datos aplicable.

7. DURACIÓN Y TERMINACIÓN
   [PENDIENTE DE DEFINIR] — plazo mínimo, preaviso de retirada total y condiciones.

8. LEY APLICABLE Y JURISDICCIÓN
   Las inversiones se canalizan a través de la sociedad estadounidense del Gestor
   ([ATLAS LLC], EE. UU.). Ley aplicable y foro: [PENDIENTE DE DEFINIR con el abogado
   según el estado de constitución de la LLC y la residencia del Cliente].

Firmado:

  _______________________          _______________________
  El Gestor (ATLAS · MACD)          ${a.name}

Este documento es un borrador de presentación y no constituye oferta vinculante
ni asesoramiento financiero o legal.`
}

/** Correo de aprobación al cliente (asunto + cuerpo). */
export function renderCorreoAprobacion(a: AtlasApplicant): { subject: string; body: string } {
  const subject = 'ATLAS — Su solicitud ha sido aprobada'
  const body = `Estimado/a ${a.name},

Nos complace comunicarle que su solicitud de acceso a ATLAS ha sido APROBADA.

Resumen de su perfil:
  · Modalidad: ${PERFIL[a.account_type ?? 'inversor'] ?? PERFIL.inversor}
  · Capital de referencia: ${importe(a)}
${a.agenda ? `  · Llamada preferida: ${a.agenda}\n` : ''}
Próximos pasos:
  1. Le enviaremos el contrato de gestión para su revisión y firma.
  2. Coordinaremos una llamada privada para resolver cualquier duda.
  3. Una vez firmado, recibirá acceso a su dashboard de metodología.

Recuerde: la preservación de su capital es nuestra primera doctrina. No prometemos
rentabilidad; sí una gestión seria, disciplinada y transparente.

Un cordial saludo,
El equipo de ATLAS · MACD Studios

Este mensaje no constituye oferta ni asesoramiento financiero. Toda operativa se
valida primero en entornos de prueba.`
  return { subject, body }
}

/** Confirmación de recepción de una solicitud de retiro (al cliente). */
export function renderCorreoRetiro(name: string, periodo: string, monto: string): { subject: string; body: string } {
  return {
    subject: 'ATLAS — Hemos recibido su solicitud de retiro',
    body: `Estimado/a ${name},

Hemos recibido su solicitud de retiro de ganancias (${periodo}) por un importe de ${monto}.

La revisaremos y le confirmaremos la ejecución tras verificar la disponibilidad y el
periodo correspondiente. Le contactaremos con los detalles.

Un cordial saludo,
El equipo de ATLAS · MACD Studios`,
  }
}
