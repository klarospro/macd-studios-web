# Detalle — Dashboards multi-tenant de solo lectura (plantilla / accionista / ahorro) con RLS en Supabase

Estado: diseño propuesto 2026-07-07, pendiente aprobación de Moisés antes de construir. No hay código de producción derivado de este documento. Se apoya en `18_SECURITY/00_RESUMEN.md` (RLS ya decidido como patrón) y en `19_INFRASTRUCTURE/00_RESUMEN.md` (proyecto Supabase separado ya decidido).

## 1. Premisa
Los clientes NUNCA operan ni conectan APIs — solo consumen datos de solo lectura (dashboard web y/o informe mensual por correo vía n8n). Esto simplifica mucho el modelo de datos frente a un SaaS donde el cliente tiene acciones que ejecutar: aquí el 100% de las políticas RLS de cliente son `SELECT`, nunca `INSERT`/`UPDATE`/`DELETE` (esas operaciones solo las hace el backend de confianza/n8n con `service_role`, nunca el cliente).

## 2. Modelo de datos (propuesta, nombres orientativos)
```
tenants
  id, tipo_cliente ("plantilla" | "accionista" | "ahorro"), nombre, estado, creado_en

tenant_users                       -- vínculo usuario Supabase Auth ↔ tenant
  user_id (FK auth.users), tenant_id (FK tenants), rol ("owner" | "viewer"), creado_en

-- Vistas materializadas/derivadas por tipo de cliente (nunca las tablas crudas de trading_audit_log directamente):
tenant_portfolio_snapshot          -- foto periódica de equity/rendimiento asignado a ESE tenant
  tenant_id, fecha, equity_asignado, rendimiento_pct_periodo, rendimiento_pct_acumulado

tenant_statements                  -- informes mensuales generados (PDF/HTML) — enlaza con el envío n8n
  tenant_id, periodo, url_informe, enviado_en

tenant_capital_movements           -- depósitos/retiros del tenant (solo lectura para el cliente; escritura solo backend)
  tenant_id, tipo ("deposito" | "retiro"), monto, fecha, estado
```
Los tenants NO tienen acceso a `trading_audit_log`, `venues`, tokens/credenciales de brókers, ni al detalle operación-a-operación del motor — solo a datos AGREGADOS y ya calculados a nivel de su propia asignación de capital. Esto es una capa de agregación deliberada entre el motor (08_TRADING/14_PORTFOLIOS) y lo que ve el cliente, coherente con "operador único controla todo, clientes solo ven resultados".

## 3. `tenant_id` y rol — dónde vive
Igual que ya decidido en `18_SECURITY/00_RESUMEN.md`: `tenant_id` (y el `rol`) van en `app_metadata` del JWT (inmutable por el usuario), nunca en `user_metadata`. Un usuario puede pertenecer a un solo tenant en la v1 (un cliente = un tenant); si en el futuro una misma persona es accionista Y tiene un producto "ahorro" a la vez, se modela como dos filas en `tenant_users` (mismo `user_id`, distinto `tenant_id`), no mezclando tipos dentro de un tenant.

## 4. Políticas RLS (patrón, no código final)
- `tenant_portfolio_snapshot`, `tenant_statements`, `tenant_capital_movements`: `SELECT` con `USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))`. Sin política de `INSERT`/`UPDATE`/`DELETE` para el rol autenticado normal — esas operaciones se hacen únicamente desde el backend con `service_role` (que bypassa RLS, nunca expuesto a cliente/browser, ya definido en `18_SECURITY`).
- Diferenciación por `tipo_cliente` dentro del propio dashboard (capa de aplicación, no solo RLS): un tenant "plantilla" puede no tener `tenant_portfolio_snapshot` en absoluto (no gestiona capital, solo compró la licencia) — sus datos son de uso de producto/licencia, tabla distinta (`tenant_license` — fuera de alcance de este documento, pertenece a facturación/billing).
- Un tenant "accionista" ve además el desglose 50/50 (beneficio bruto del período, su 50%, retenciones si aplica) — campo adicional en `tenant_portfolio_snapshot` o tabla derivada `tenant_profit_split`.
- Un tenant "ahorro" ve el calendario de retiros 2-5% y el histórico de informes mensuales — usa `tenant_capital_movements` + `tenant_statements`.
- Índices obligatorios en `tenant_id` de cada tabla con RLS (recomendación oficial de Supabase — la ausencia de índice en la columna referenciada por la política es "el mayor asesino de rendimiento" en RLS, confirmado por Supabase Docs).

## 5. Separación del motor (crítico, ya coherente con decisiones previas)
El motor de trading (`08_TRADING`, `14_PORTFOLIOS`) escribe en sus propias tablas (`trading_audit_log`, estado de venues) con `service_role` desde el backend de confianza (proceso en el VPS/monolito). Un JOB periódico (n8n o un cron del backend) **calcula y agrega** esos datos hacia `tenant_portfolio_snapshot` por tenant, aplicando la regla de asignación de capital de `14_PORTFOLIOS` (qué % del capital total/resultado corresponde a cada tenant). Los tenants NUNCA leen las tablas del motor directamente — leen solo las tablas agregadas ya calculadas. Esto acota el "radio de explosión" de un fallo de RLS: aunque una política de tenant fallara, el peor caso es ver el snapshot agregado de OTRO tenant, nunca el detalle operativo del motor ni credenciales.

## 6. Informe mensual por correo (producto "ahorro")
n8n (ya en uso, prefijo `atlas_` según `19_INFRASTRUCTURE`) lee `tenant_statements`/`tenant_portfolio_snapshot` con una credencial de servicio (no `service_role` de Supabase expuesta en n8n si es evitable — usar una vista/función RPC restringida o una API key de solo lectura con permisos mínimos) y envía el informe por correo. Mantener esto fuera del alcance de RLS de cliente (es un job de backend, no una sesión de usuario).

## 7. Ventajas / Desventajas
- Ventajas: RLS activo desde el día 1 (ya decidido como patrón del proyecto), separación limpia motor↔cliente, mismo patrón para los 3 tipos de cliente con solo variar qué tablas/columnas expone cada uno.
- Desventajas/costes: job de agregación adicional que hay que mantener y auditar (si calcula mal el reparto, el cliente ve un número incorrecto); doble modelo de datos (crudo del motor + agregado de cliente) añade complejidad de sincronización.

## 8. Riesgos
- Confundir "capital asignado a un tenant" con "capital real en el venue" — el snapshot agregado debe reconciliarse periódicamente contra el equity real reportado por los adaptadores (mismo principio que `01_DETALLE_CAPA_PORTAFOLIO.md` §7, "nunca se opera sobre estado desincronizado" — aquí aplica a "nunca se informa al cliente con datos desincronizados").
- Exponer sin querer una columna sensible (ej. IDs de venue, nombres de brókers) en una tabla que el cliente lee — revisar cada tabla/vista expuesta a `tenant_*` columna por columna antes de dar acceso.

## Sin confirmar
- Diseño final de facturación/licencias para el tipo "plantilla" (tabla `tenant_license` no desarrollada aquí — pertenece a un tema de billing no investigado en esta sesión).
- Mecanismo exacto de reconciliación automática entre snapshot agregado y equity real (frecuencia, alertas si diverge).
- Si conviene usar funciones RPC de Postgres en vez de vistas directas para el acceso de n8n (menor superficie, más control) — decisión de implementación, no de esta investigación.

## Fuentes
`supabase.com/docs/guides/database/postgres/row-level-security` (RLS oficial), `supabase.com/features/row-level-security` (patrones de multi-tenant, índices en columnas de política — confirmado). `18_SECURITY/00_RESUMEN.md` y `19_INFRASTRUCTURE/00_RESUMEN.md` (decisiones ya tomadas en este proyecto, reutilizadas aquí). `14_PORTFOLIOS/01_DETALLE_CAPA_PORTAFOLIO.md` (origen de los datos agregados por tenant).
