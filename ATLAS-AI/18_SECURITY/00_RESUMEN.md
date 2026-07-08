# Seguridad — Modelo multi-tenant (Fase 1)

Estado: 🟡 diseño hecho, pendiente aprobación e implementación en Fase 2+.
Detalle extenso (policies RLS de ejemplo, tabla de aislamiento de secretos): `01_DETALLE_MODELO_SEGURIDAD_MULTITENANT.md`.

## 1. Aislamiento entre tenants (clientes SaaS)
- **Qué/por qué**: tabla compartida + columna `tenant_id` + Row Level Security (RLS) en Postgres/Supabase. Patrón oficial soportado por Supabase para SaaS pequeña-mediana (coste bajo, aislamiento a nivel de BD, no solo de código).
- **Cuándo NO**: si un cliente exige aislamiento físico total (regulatorio) — ahí tocaría esquema o proyecto Supabase por tenant (más caro). No es el caso ahora.
- **Claves**: `tenant_id` va en `app_metadata` del JWT (inmutable), nunca en `user_metadata` (editable por el usuario — confirmado por Supabase Docs). `service_role` key **nunca** en cliente/browser ni en workflows públicos: bypassa RLS por completo.
- **Riesgo principal**: tabla nueva sin `enable row level security` o sin `WITH CHECK` en INSERT/UPDATE = fuga entre tenants. Mitigación: checklist obligatorio antes de merge + auditoría periódica de `pg_policies`.
- **Fuente**: Supabase Docs — Row Level Security (oficial), confirmado.

## 2. Separación CRÍTICA: trading (MT5/exchanges) vs comercial MACD
- **Por qué existe la regla**: n8n comercial tiene webhooks públicos; si compartiera almacén de credenciales con el bot de trading, un fallo ahí escalaría a robo de capital real.
- **Mecanismo elegido**: usuarios de sistema Linux distintos (`svc-atlas-trading` / `svc-macd-commercial`) cada uno dueño exclusivo de su directorio de secretos (permisos 600, sin grupo compartido); si se dockeriza, contenedores separados sin volúmenes compartidos; workflows n8n con prefijo `atlas_` en scope/credenciales separadas del resto. Secret manager dedicado (ej. Vault self-hosted) queda como mejora futura — **sin confirmar producto concreto**, pendiente Fase 2/3.
- **Nota de infra**: MT5 exige terminal Windows (VPS Linux actual no sirve) → probablemente VPS Windows aparte, lo que ya separa físicamente ese caso. Exchanges cripto sí pueden compartir el Hetzner Linux con n8n comercial, así que la separación de usuarios/namespaces es obligatoria ahí.
- **Menor privilegio**: el proceso de trading no puede leer secretos comerciales, y viceversa; el backend web Atlas no necesita tocar secretos de trading directamente si puede evitarse.

## 3. Gestión de secretos
- Nunca en Supabase junto a datos de app (Supabase Vault expone el secreto en claro a cualquiera con acceso a la vista `vault.decrypted_secrets`, mismo radio de impacto que el resto de la BD multi-tenant), nunca en el repo (bloqueado por `.claude/hooks/block-secret-writes.sh`), nunca en chat/docs.
- Viven en archivo `.env` con permisos restringidos propiedad del usuario de servicio correspondiente, o secret manager dedicado; inyectados al proceso en arranque, leídos solo por ese proceso.
- Rotación: regular según sensibilidad + inmediata ante sospecha de compromiso (OWASP). Claves de exchange con permisos acotados (solo trading, retiros deshabilitados) y allowlist de IP cuando el exchange lo soporte. Frecuencia exacta: **sin confirmar**, pendiente Fase 3.

## 4. Auditoría para dinero real
- Tabla append-only `trading_audit_log` (tenant_id, actor, acción, params, timestamp, antes/después). RLS: tenant solo lee lo suyo; INSERT solo desde backend de confianza; UPDATE/DELETE revocado para todos (patrón WORM). Registrar también órdenes rechazadas por el motor de riesgo, no solo las ejecutadas.
- Alertas de anomalías: **sin confirmar**, diseño concreto pendiente de Fase 5 (n8n + dashboard).

## Sin confirmar (pendiente de fuente sólida o decisión posterior)
- Producto concreto de secret manager self-hosted para el VPS.
- Si n8n soporta aislamiento de credenciales por "proyecto" suficientemente fuerte para tratarlo como límite de seguridad.
- Frecuencia exacta de rotación de claves de exchange/MT5.
- Mecanismo concreto de alertas sobre anomalías de trading.

## Fuentes oficiales
Supabase Docs (Row Level Security, Vault, RLS Performance) · OWASP Secrets Management Cheat Sheet. Detalle y enlaces en `01_DETALLE_MODELO_SEGURIDAD_MULTITENANT.md`.
