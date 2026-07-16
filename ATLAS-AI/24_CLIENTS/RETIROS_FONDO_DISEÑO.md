# Diseño — Onboarding, contratos y retiros "como un fondo"

Estado: 🟡 Fase 1 construida (solo-solicitud + admin). Auth de cliente y panel-por-cliente = pendientes.
Fecha: 2026-07-11.

## Principio innegociable (regla de Moisés)
**Moisés autoriza SIEMPRE, manualmente.** Nada se envía al cliente ni se mueve dinero de forma
automática. El sistema solo *registra solicitudes*, *notifica* y *prepara documentos*; la liberación
de contrato, datos de transferencia y el pago los **autoriza Moisés** desde el panel.

## Flujo completo (fondo)
1. **Inscripción** — el cliente envía `/atlas/solicitud` (con calendario para la llamada).
   → se guarda en `atlas_applications` y **avisa a Moisés por Telegram** (n8n / directo) con nombre,
   correo, teléfono, perfil, **importe** y fecha de llamada.
2. **Aprobación** — Moisés aprueba en `/panel/atlas/solicitudes`.
   → se generan **contrato** y **correo de aprobación** (`lib/atlas-templates.ts`). Puede revisarlos,
   copiarlos y enviarlos (modal "Contrato/Correo"). Al aprobar, dispara n8n `atlas-aprobacion`.
3. **Alta de acceso del cliente** *(pendiente — requiere auth)* — cuando Moisés autoriza, al cliente le
   **llega un correo con su usuario**; el cliente **fija una contraseña segura** y entra a **SU panel
   privado** con sus **inversiones y progreso**. Mecanismo previsto: Supabase Auth (invitación por email /
   magic link → set password). Solo cuando Moisés autoriza, en ese panel se le liberan: su contrato para
   firmar, su dashboard de metodología y los **datos de transferencia** (cuenta de la LLC) para aportar o
   recibir capital. Nada de esto es automático.
4. **Retiros** — el cliente solicita retiro de ganancias en `/atlas/retiro` (trimestral o anual).
   → se guarda en `atlas_withdrawals`, **avisa a Moisés** y aparece en `/panel/atlas/retiros`.
   Moisés: **Aprobar → Marcar pagado** (o Rechazar). El pago lo ejecuta él; el sistema solo lleva el
   registro/auditoría del estado. **Ningún pago automático.**

## Construido en esta fase
- Formularios: `/atlas/solicitud` (con calendario), `/atlas/retiro` (trimestral/anual).
- APIs: `/api/atlas/solicitud`, `/api/atlas/retiro` (crean + notifican); `/api/atlas/solicitudes`,
  `/api/atlas/retiros` (admin, gate `ATLAS_ADMIN_SECRET`).
- Paneles admin: `/panel/atlas/solicitudes` (con modal contrato/correo), `/panel/atlas/retiros`.
- Plantillas: `lib/atlas-templates.ts` (contrato + correo aprobación + correo retiro). Copias en
  `25_TEMPLATES/`. **Borradores — requieren revisión legal antes de uso real.**
- n8n: `16_AUTOMATION/n8n/` (aviso solicitud→Telegram, aprobación→email+Telegram, y `atlas-retiro`).
- BD: `engine/db/006_atlas_withdrawals.sql` (correr en Supabase).

## PENDIENTE (siguiente fase — requiere tu OK)
- **Auth de cliente (Supabase Auth)** para el panel-por-cliente: sin esto, los documentos/datos de
  transferencia no pueden mostrarse de forma privada a cada cliente. Es el bloqueador principal.
- **Liberación autorizada**: campo/acción "autorizar entrega de contrato" y "autorizar datos de
  transferencia" por cliente, controlado por Moisés (nunca automático).
- **Cálculo de ganancias** por periodo (high-water mark, comisión) — lógica financiera a documentar
  con `risk-architect` antes de construir. Hoy el importe del retiro lo indica el cliente y lo verifica
  Moisés a mano.
- Datos legales del contrato pendientes: comisiones, duración/terminación, ley y jurisdicción.

## Estructura legal (plan de Moisés)
Las inversiones se canalizarán a través de una **LLC en Estados Unidos** (sociedad del Gestor) para
operar con cobertura legal. Implicaciones a resolver con abogado/contable antes de recibir dinero real:
- La LLC es la parte "Gestor" del contrato y la **titular de la cuenta** a la que se transfiere.
- Los "datos de transferencia" que se liberan al cliente = cuenta bancaria de la LLC (fuera del repo).
- Definir estado de constitución (p. ej. Delaware/Wyoming/New Mexico), fiscalidad y KYC/AML.
- Todo esto es requisito PREVIO a mover dinero real; hasta entonces, solo demo/registro.

## Auth de cliente (a construir, requiere tu OK + env)
- Supabase Auth. Al aprobar: crear/invitar usuario → email con enlace para fijar contraseña segura.
- Ruta protegida `/inversor` (o `/panel/inversor`) que muestra a cada cliente SUS inversiones y progreso
  (leyendo su fila en Supabase con RLS por `auth.uid()`).
- Bloqueador conocido: requiere `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el
  entorno del web, y el hook de seguridad impide editar `.env.local` → los pone Moisés en Vercel.

## Seguridad / dinero
- Ninguna credencial ni dato bancario en código o git. Los "datos de transferencia" viven fuera del
  repo y solo se muestran al cliente tras autorización de Moisés.
- Toda transición de estado queda registrada (`status` + `updated_at`). Auditoría real de pagos =
  pendiente de definir con el flujo contable.
