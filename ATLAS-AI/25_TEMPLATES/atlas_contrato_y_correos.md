# Plantillas Atlas — contrato y correos (referencia editable)

> **Fuente canónica:** `lib/atlas-templates.ts` (lo que usa la web). Este archivo es una copia
> legible para redactar/ajustar el texto. Tras editar aquí, traslada los cambios al `.ts`.
>
> ⚠️ **Borradores de presentación — NO asesoramiento legal.** Revisar con un abogado antes de usarlos
> con clientes reales (comisiones, duración, ley aplicable, fiscalidad).

## Datos que se rellenan solos (placeholders)
`nombre`, `email`, `teléfono`, `dirección`, `perfil` (inversor/accionista/plantilla),
`importe` (capital + divisa), `agenda` (fecha de la llamada), `fecha` (hoy).

## 1. Contrato de gestión — `renderContrato()`
Estructura: objeto · doctrina (preservación primero) · riesgo/ sin garantía · rendimientos y retiros
(trimestral/anual) · comisiones [pendiente] · confidencialidad · duración [pendiente] · ley [pendiente]
· firmas. El texto completo vive en `lib/atlas-templates.ts`.

## 2. Correo de aprobación — `renderCorreoAprobacion()`
Asunto: "ATLAS — Su solicitud ha sido aprobada". Cuerpo: resumen del perfil + próximos pasos
(contrato → llamada → acceso al dashboard) + doctrina de preservación.

## 3. Correo de retiro — `renderCorreoRetiro()`
Confirma la recepción de una solicitud de retiro (periodo + importe) y anuncia verificación.

## Recordatorio de flujo (regla de Moisés)
Estos documentos y los **datos de transferencia** se muestran en el panel de **cada cliente** y se
liberan **solo cuando Moisés lo autoriza**. Nunca automático. Ver `24_CLIENTS/RETIROS_FONDO_DISEÑO.md`.
