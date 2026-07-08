# Detalle — Supabase: schema nuevo vs proyecto separado

## Qué es / por qué existe la disyuntiva
Supabase permite (a) crear un `schema` nuevo (`atlas`) dentro de un proyecto Postgres existente, o (b) crear un proyecto Supabase independiente (Postgres + Auth + Storage propios). Ambas son formas válidas de aislar datos dentro de la misma organización.

## Cuándo usar cada una
- **Schema nuevo en mismo proyecto:** cuando el volumen es pequeño/medio, se puede convivir bajo el mismo compute, y se quiere evitar coste/gestión duplicada.
- **Proyecto separado:** cuando se necesita aislamiento fuerte de seguridad/compliance (ej. datos financieros regulados), o el volumen/carga de un dominio puede degradar al otro, o se prevé facturar/gestionar el producto de forma independiente (SaaS propio).

## Datos oficiales verificados (Supabase docs, jul-2026)

### Planes y tamaño de BD
| Plan | Precio base | BD incluida | Extra storage | Proyectos |
|---|---|---|---|---|
| Free | $0/mes | 500 MB (entra en modo solo-lectura al superarlo); "1 GB" de disco total asignado | — | Límite de **2 proyectos activos** por owner/admin, se pausan tras 1 semana de inactividad |
| Pro | **$25/mes** (fuente: pricing) | **8 GB** de disco incluidos por proyecto | **$0.125/GB** extra | Sin proyectos ilimitados; cada proyecto adicional consume compute propio |

Fuente: https://supabase.com/pricing

### Autoscaling de disco (planes de pago)
- Se expande automáticamente al llegar al 90% de uso, +50% cada vez (ej. 8GB → 12GB).
- Máx. 4 modificaciones automáticas por ventana de 24h.
- Si se llega al 95% y se agotó la cuota de modificación → proyecto entra en modo solo-lectura.
- Redimensionado manual permitido hasta 60 TB (Pro/Team).

Fuente: https://supabase.com/docs/guides/platform/database-size

### Conexiones por tier de compute (Pro)
| Tier | Precio/mes | RAM | Conexiones directas | Pooler (Supavisor) |
|---|---|---|---|---|
| Micro (incluido con Pro vía $10 crédito) | ~$10 | 1 GB | 60 | 200 |
| Small | ~$15 | 2 GB | 90 | 400 |
| Medium | ~$60 | 4 GB | 120 | 600 |

Fuente: https://supabase.com/docs/guides/platform/compute-and-disk

### Facturación por organización, no por proyecto
- Supabase factura **por organización**, no por proyecto individual; las cuotas (bandwidth, storage, etc.) se suman a nivel de organización.
- Cada proyecto lanzado tiene su propio Postgres dedicado y **suma coste de compute** (ej. cada proyecto Pro adicional arrastra mínimo el Micro de $10/mes si se supera el crédito incluido).
- Fuente: https://supabase.com/docs/guides/platform/org-based-billing — "sin confirmar": el texto no especifica límite máximo de proyectos por organización en Pro (a diferencia del límite explícito de 2 en Free).

## Análisis para Atlas AI

**(1) Volumen esperado:** Atlas manejará series temporales de precios/mercado, órdenes y métricas de cartera — este tipo de dato crece de forma continua y puede alcanzar varios GB/mes si se hace polling frecuente sin políticas de retención/downsampling. Un schema nuevo en el proyecto actual de MACD (leads/marketing, previsiblemente pequeño) conviviría sin problema mientras el volumen sea bajo, pero el crecimiento de time-series es el riesgo principal a monitorizar.

**(2) Aislamiento de seguridad:** un `schema` nuevo dentro del MISMO proyecto comparte el mismo cluster Postgres, el mismo panel de Auth/API keys y el mismo Session Pooler que ya usan los bots comerciales. RLS por schema mitiga el acceso a nivel de fila, pero **no aísla** brechas a nivel de proyecto (una key de service_role comprometida del proyecto de leads vería ambos schemas). Un proyecto separado da aislamiento real: credenciales, API keys, Auth y compute completamente independientes — relevante porque Atlas maneja datos financieros (capital, órdenes) y el proyecto de leads ya tiene RLS desactivado para escritura de n8n (superficie de riesgo mayor si comparten proyecto).

**(3) Coste:** proyecto separado en Pro implica pagar el ciclo base **$25/mes** de la organización solo si aún no existe uno Pro (MACD ya debería estar en Pro dado que usa producción con bots comerciales — sin confirmar si ya está en Pro o Free), más el compute dedicado (mínimo Micro, ~$10/mes, con $10/mes de crédito ya incluido en el Pro plan, por lo que el coste incremental real de un proyecto Micro adicional puede ser ~$0 si el crédito no está ya consumido por el proyecto existente, o hasta $10/mes si sí lo está). Esto es sustancialmente más barato que el riesgo de mezclar datos financieros con datos de marketing.

## Recomendación
**Proyecto Supabase separado para Atlas AI**, no schema nuevo en el proyecto existente. Criterio decisivo: RLS activo desde el día 1 para datos financieros es el requisito no negociable del proyecto, y compartir proyecto con el sistema de leads (que ya tiene RLS desactivado para escritura de n8n) crea una superficie de ataque compartida a nivel de compute/Auth/API-keys que un schema no puede mitigar. El coste incremental (Micro ~$10/mes, parcialmente o totalmente cubierto por el crédito de Pro) es bajo comparado con el riesgo. Reevaluar solo si en el futuro se demuestra que el volumen de time-series es tan bajo y el aislamiento tan poco crítico que no justifica el segundo compute — pero eso va contra el requisito ya fijado de RLS estricto para capital.

## Riesgos
- Doble mantenimiento de proyectos Supabase (migraciones, backups, monitorización) — mitigar con Infra as Code / migrations versionadas por repo.
- Coste incremental si el proyecto de leads no está en Pro (habría que confirmarlo antes de decidir definitivamente el tier).

## Sin confirmar
- Si el proyecto Supabase actual de MACD (leads) está en plan Free o Pro.
- Límite máximo de proyectos por organización en plan Pro (Supabase docs no lo especifica explícitamente).
- Si el crédito de $10/mes de compute del plan Pro es por organización o por proyecto (la documentación consultada no lo aclara con precisión suficiente para citar cifra exacta).
- Conexiones exactas disponibles vía Session Pooler IPv4 para el compute tier actualmente contratado por MACD (no verificado en esta investigación, depende del panel del proyecto real).

## Fuentes oficiales
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/compute-and-disk
- https://supabase.com/docs/guides/platform/org-based-billing

---

# Detalle — n8n: aislamiento de workflows y control de concurrencia

## Prefijo `atlas_`
Convención de nombres, no aislamiento técnico real: separa visualmente los workflows de Atlas de los comerciales en el mismo n8n. No limita CPU/memoria por sí sola.

## Control de recursos real (verificado en docs oficiales de n8n)
- Modo por defecto (regular, un solo proceso): variable `N8N_CONCURRENCY_PRODUCTION_LIMIT` limita ejecuciones production concurrentes (activadas por webhook/trigger). Deshabilitado por defecto; se activa con `export N8N_CONCURRENCY_PRODUCTION_LIMIT=20`. Solo afecta ejecuciones production, no manuales ni sub-workflows.
  Fuente: https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency
- Para aislamiento más fuerte, n8n soporta **queue mode**: separa un proceso "main" (editor, webhooks, triggers) de procesos "worker" que ejecutan el trabajo pesado. Permite escalar workers independientemente y evitar que un workflow intensivo bloquee al resto.
  - `QUEUE_WORKER_CONCURRENCY` controla cuántas ejecuciones simultáneas maneja un worker (default citado en fuentes secundarias: 10 — sin confirmar contra doc oficial exacta).
  - Requiere Postgres (no SQLite) como backend — ya cumplido, MACD usa Supabase Postgres.
  Fuente: https://docs.n8n.io/hosting/scaling/queue-mode/ (confirmado que existe la página; contenido detallado tomado de resultados de búsqueda, no de fetch directo del cuerpo — tratar como "medianamente confirmado")

## Recomendación para el VPS CX32 compartido
1. Corto plazo (ahora): usar prefijo `atlas_` + `N8N_CONCURRENCY_PRODUCTION_LIMIT` para evitar que un pico de ejecuciones de Atlas (polling de precios) sature el n8n main process que también sirve los bots comerciales.
2. Monitorizar CPU/RAM del CX32 (4 vCPU / 8GB según specs Hetzner CX32) con `htop`/`docker stats` mientras Atlas esté en fase paper/demo, antes de activar polling de alta frecuencia.
3. Señal para migrar a **queue mode** (todavía en el mismo VPS, sin crear infraestructura nueva): cuando el polling de mercado de Atlas empiece a introducir latencia perceptible en la respuesta de los bots de Telegram/WhatsApp.
4. Señal para VPS separado (ver 00_RESUMEN.md): cuando queue mode + límites de concurrencia ya no basten, es decir CPU/RAM del CX32 sostenidamente >80% con Atlas en carga normal (no picos), o cuando Atlas pase de paper a real money y se quiera aislamiento físico de fallos.

## Sin confirmar
- Valor por defecto exacto de `QUEUE_WORKER_CONCURRENCY` (tomado de fuente secundaria, no de fetch directo al cuerpo de la doc oficial).
- Specs exactas de RAM del Hetzner CX32 contratado por MACD (Hetzner publica CX32 como 4 vCPU/8GB en su tabla de precios estándar, pero no se ha verificado el plan contratado específico en esta investigación).

## Fuentes oficiales
- https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency
- https://docs.n8n.io/hosting/scaling/queue-mode/
