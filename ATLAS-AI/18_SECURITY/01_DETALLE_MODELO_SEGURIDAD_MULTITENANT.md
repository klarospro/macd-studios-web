# Detalle — Modelo de seguridad multi-tenant (Fase 1)

Complementa `00_RESUMEN.md`. Fuentes primarias: Supabase Docs (RLS, Vault), OWASP Secrets Management Cheat Sheet, OWASP ASVS (principio de menor privilegio).

---

## 1. Aislamiento entre tenants (clientes SaaS) — modelo de datos

### Patrón elegido: tabla compartida + `tenant_id` + RLS (shared-table multi-tenancy)

Confirmado por Supabase Docs: es uno de los dos patrones soportados (el otro es esquema/proyecto por tenant, más caro). Para una SaaS pequeña-mediana como Atlas AI es el recomendado por coste, con aislamiento aplicado a nivel de base de datos (no solo en código de aplicación).

**Estructura:**
```sql
-- Toda tabla de negocio lleva tenant_id
create table portfolios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ...
);

alter table portfolios enable row level security; -- obligatorio, sin esto la policy no aplica

create policy "tenant_isolation_select"
on portfolios for select
using (
  (select auth.uid()) is not null
  and tenant_id = (select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
);

create policy "tenant_isolation_insert"
on portfolios for insert
with check (
  tenant_id = (select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
);
```

Puntos confirmados en Supabase Docs:
- `tenant_id` debe guardarse en `app_metadata` del usuario (inmutable, se setea server-side vía Auth Hook), **nunca** en `user_metadata` (editable por el propio usuario — permitiría auto-asignarse otro tenant).
- Sin policy = sin acceso (RLS deniega por defecto). Sin `enable row level security`, la policy no se aplica aunque exista.
- `auth.uid()` puede ser `null` si no hay sesión; una comparación con `null` es `false` en SQL, así que conviene el guard explícito `auth.uid() IS NOT NULL` para evitar bypasses sutiles.
- Envolver `auth.uid()`/`auth.jwt()` en `(select ...)` cachea el resultado por query — mejora de rendimiento confirmada por Supabase (documentado hasta 94-99% en sus benchmarks).
- Indexar `tenant_id` (y `user_id`) — sin índice, RLS puede degradar mucho el rendimiento en tablas grandes.

### Riesgos de fuga entre tenants y mitigación

| Riesgo | Mitigación |
|---|---|
| Tabla nueva sin RLS activado | Checklist obligatorio antes de merge: `enable row level security` + al menos 1 policy por operación (select/insert/update/delete). Query de auditoría periódica contra `pg_policies` / `pg_tables` para detectar tablas sin RLS. |
| Policy que confía en `user_metadata` | Regla dura: solo `app_metadata` para claims de autorización. |
| Falta `WITH CHECK` en INSERT/UPDATE | Un usuario podría escribir filas con `tenant_id` ajeno. Toda policy de escritura lleva `WITH CHECK`, no solo `USING`. |
| `service_role` key expuesta en cliente | Ver sección 2. `service_role` bypassa RLS totalmente — confirmado por Supabase Docs ("never be used in the browser or exposed to customers"). |
| JWT desactualizado tras cambio de tenant/rol | Forzar refresh de sesión al cambiar `app_metadata`; no cachear JWT más de la duración de sesión estándar de Supabase Auth. |

### Patrón de claves

- **Cliente (browser/app)**: solo `anon`/`publishable` key + JWT del usuario autenticado. Todo el acceso pasa por RLS.
- **`service_role` key**: SOLO en backend de confianza (job programado, función server-side que ya validó el tenant por otra vía). Nunca en variables `NEXT_PUBLIC_*`, nunca en n8n si el workflow es alcanzable públicamente sin autenticación adicional, nunca en el repo.
- Regla operativa: cualquier uso de `service_role` debe poder justificarse por qué RLS no era suficiente ahí — si la respuesta es "es más cómodo", es un red flag.

---

## 2. Separación CRÍTICA: credenciales de trading vs credenciales comerciales MACD

### Contexto de riesgo específico de Atlas

n8n ya aloja workflows comerciales (leads/marketing) con webhooks expuestos públicamente en `n8n.macdestudios.com`. Si las credenciales de trading (MT5/exchanges) vivieran en el mismo almacén de credenciales que esos workflows, una vulnerabilidad en un workflow público (inyección, webhook mal protegido, dependencia comprometida) podría escalar a robo de capital real. Esta es la razón concreta de exigir separación dura, no solo "buenas prácticas" genéricas.

Nota de infraestructura (de `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md`): MT5 requiere terminal Windows; el VPS Hetzner actual es Linux. Esto probablemente obliga a un VPS Windows separado para MT5 — lo cual ya da separación física para ese caso. Pero exchanges cripto (API REST/WebSocket, Linux-friendly) sí podrían correr en el mismo Hetzner CX32 que n8n comercial, así que la separación descrita abajo es obligatoria para ese escenario.

### Mecanismo recomendado (accionable, de menor a mayor coste/complejidad)

1. **Usuarios de sistema Linux distintos**: `svc-atlas-trading` y `svc-macd-commercial` (o equivalente). Cada uno dueño exclusivo de su propio directorio de secretos con permisos `600`/`700`, sin grupo compartido. El proceso del bot de trading corre como `svc-atlas-trading` y no tiene permiso de lectura sobre los archivos de `svc-macd-commercial`, y viceversa.
2. **Namespaces/credential stores separados en n8n** (si ambos usan la misma instancia n8n): workflows de Atlas con prefijo `atlas_` (ya definido en `01_INTEGRACION_MACD_STUDIOS.md`) + credenciales de trading registradas en un "proyecto"/scope separado si n8n lo soporta (**sin confirmar**: pendiente verificar en la versión de n8n desplegada si el aislamiento de credenciales por proyecto es suficientemente fuerte para tratarlo como límite de seguridad, o si conviene una instancia n8n separada solo para trading).
3. **Contenedores separados** (recomendado si se dockeriza): el bot de trading y los workflows comerciales corren en contenedores distintos, cada uno con su propio `env_file`/Docker secret, sin volúmenes compartidos. Esto añade aislamiento a nivel de proceso/kernel namespace, no solo de permisos de archivo.
4. **Secret manager dedicado** (recomendado a medida que crezca el número de secretos/clientes): un gestor de secretos self-hosted con políticas de acceso por namespace (ej. HashiCorp Vault OSS, o alternativas más ligeras) donde `atlas-trading/*` solo es legible por el token de servicio del bot de trading y `macd-commercial/*` solo por el de los workflows comerciales, con auditoría de acceso integrada. **Sin confirmar**: no se ha evaluado aún un producto concreto para este VPS — queda pendiente de decisión en Fase 2 (carpeta `06_HOOKS`/`19_INFRASTRUCTURE`), evaluando coste-beneficio frente a la opción más simple de `.env` + usuarios de sistema separados, que ya cumple el requisito mínimo de aislamiento.

### Principio de menor privilegio — quién puede leer qué

| Secreto | Puede leerlo | NO puede leerlo |
|---|---|---|
| API key exchange/MT5 (trading) | Proceso del bot de trading (usuario `svc-atlas-trading`) | Workflows n8n comerciales, backend web Atlas, Supabase, cualquier proceso corriendo como otro usuario |
| Credenciales comerciales (leads, WhatsApp/Telegram bots MACD) | Workflows n8n comerciales (usuario `svc-macd-commercial`) | Bot de trading, dashboard Atlas |
| `service_role` de Supabase (app Atlas) | Backend Atlas de confianza (jobs server-side) | Cliente/browser, n8n comercial, bot de trading (no necesita tocar Supabase directamente si puede evitarse) |

### Superficie de ataque

El componente de mayor superficie expuesta es n8n comercial (webhooks públicos). Regla: **ningún workflow con endpoint público debe tener, ni directa ni indirectamente (por ejemplo vía una credencial "genérica" reutilizada), acceso a secretos de trading.** Esto se verifica auditando qué credenciales están asociadas a qué workflows.

---

## 3. Gestión de secretos — dónde viven, rotación, runtime

- **Dónde NO viven nunca**: en Supabase junto a datos de app, en el repo (bloqueado además por el hook `.claude/hooks/block-secret-writes.sh`), en chat/docs, en variables `NEXT_PUBLIC_*`.
  - Razonamiento sobre Supabase Vault (confirmado por Supabase Docs): Vault permite guardar secretos cifrados en Postgres, pero "cualquiera con acceso a la vista `vault.decrypted_secrets` ve el secreto en claro" — el control de acceso depende de los mismos grants de Postgres que gobiernan el resto de la app. Mezclar credenciales de capital real en la misma base de datos multi-tenant amplía el radio de impacto de cualquier fallo de RLS o de un rol con permisos excesivos. Conclusión de arquitectura (no es una recomendación explícita de Supabase, es una inferencia de riesgo): usar un almacén de secretos separado del Postgres de la app para credenciales de trading.
- **Dónde sí viven**: archivo de entorno restringido (permisos `600`, propietario `svc-atlas-trading`) o secret manager dedicado (ver sección 2, punto 4), inyectado al proceso en arranque — nunca leído por el código de la app web ni versionado.
- **Rotación**: OWASP recomienda rotación regular escalada a la sensibilidad del secreto, y rotación inmediata ante sospecha de compromiso o baja de alguien con acceso. Para claves de exchange: usar permisos de API acotados (solo trading, **retiros/withdrawals deshabilitados**), y allowlist de IP restringida a la IP del VPS cuando el exchange lo soporte. Frecuencia concreta de rotación programada: **sin confirmar** — pendiente decidir en Fase 3 según qué exchanges se usen y si soportan rotación sin downtime.
- **Quién/qué las lee en runtime**: únicamente el proceso del bot de trading, bajo su propio usuario de sistema/contenedor. Nunca el backend del dashboard Atlas ni n8n comercial.

---

## 4. Auditoría y detección para acciones con dinero real

- Tabla de auditoría append-only (`trading_audit_log` o similar), con `tenant_id`, actor (humano o bot), acción, parámetros, timestamp, estado antes/después.
- RLS en la tabla de auditoría: tenant puede `SELECT` solo sus propias filas; `INSERT` solo desde el backend de confianza (no directamente desde el cliente); revocar `UPDATE`/`DELETE` a todos los roles salvo, como mucho, un rol de superadmin muy restringido — esto aproxima un patrón WORM (write-once) a nivel de Postgres.
- Registrar también los intentos de orden **rechazados** por el motor de riesgo (límites definidos en Fase 3), no solo las ejecutadas — necesario para detectar intentos de saltarse límites.
- Alertas sobre anomalías (tamaño de posición fuera de rango, fallos repetidos, acceso desde IP inesperada): **sin confirmar / pendiente diseño concreto** — se abordará en Fase 5 (`16_AUTOMATION`) apoyándose en n8n + el dashboard, no hay una fuente oficial que prescriba el mecanismo exacto.

---

## Fuentes

- Supabase Docs — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security (oficial)
- Supabase Docs — Vault: https://supabase.com/docs/guides/database/vault (oficial)
- Supabase Docs — RLS Performance and Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv (oficial)
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html (oficial)
- Patrón `tenant_id` en `app_metadata`: contrastado en múltiples guías de terceros (makerkit.dev, AntStack, comunidad Supabase en GitHub Discussions) que citan el mismo comportamiento documentado por Supabase — tratado como confirmado porque coincide con el comportamiento oficial de `auth.jwt()`/`app_metadata` documentado por Supabase, pero el patrón de multi-tenancy en sí (no la primitiva `app_metadata`) no tiene una página única "oficial" dedicada — **sin confirmar como guía oficial única**, sí como práctica ampliamente validada por la comunidad y consistente con la documentación oficial de las primitivas usadas.
- Elección de producto concreto de secret manager self-hosted (HashiCorp Vault OSS u otro): **sin confirmar** — no evaluado en profundidad, pendiente de decisión en Fase 2/Fase 3.
- n8n: aislamiento de credenciales por "proyecto"/scope: **sin confirmar** — pendiente verificar en la documentación de la versión de n8n desplegada en el VPS.
