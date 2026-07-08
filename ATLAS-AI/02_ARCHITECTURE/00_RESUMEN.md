# Arquitectura del sistema — Monolito modular vs microservicios

Estado: Fase 1 — decisión tomada

## Qué es
**Monolito modular**: una única aplicación Next.js 15 desplegada como un proceso (o servicio Vercel), pero internamente separada en módulos con fronteras claras (`/trading-engine`, `/risk`, `/dashboard`, `/billing`) que se comunican por funciones/interfaces internas, no por red. **Microservicios**: cada módulo es un servicio independiente con su propio proceso, despliegue y comunicación por red (HTTP/colas).

## Por qué existe esta disyuntiva
Ambos son formas válidas de aislar responsabilidades (trading, riesgo, dashboard, billing) a medida que el producto crece. La pregunta es cuándo el coste de separar en red compensa frente al coste de mantenerlo en un solo proceso.

## Decisión: MONOLITO MODULAR
Next.js 15 (App Router) + TypeScript, organizado en módulos internos con fronteras de dominio (`/lib/trading`, `/lib/risk`, `/lib/billing`), desplegado en Vercel (app) reutilizando el VPS Hetzner CX32 solo para n8n (orquestación/cron) y Supabase como backend de datos con **schema `atlas` separado** del resto de MACD STUDIOS.

## Por qué (justificación)
- **Equipo de 1 persona**: microservicios exigen gestionar N despliegues, N configuraciones, versionado de contratos entre servicios y observabilidad distribuida — coste que un equipo unipersonal no puede sostener sin dejar de construir producto. Fuente: Martin Fowler, "MonolithFirst" — casi todos los sistemas de microservicios exitosos empezaron como monolito; casi todos los que empezaron como microservicios desde cero tuvieron serios problemas. También "MicroservicePremium": el coste operativo de microservicios solo se justifica en sistemas complejos con equipos que pueden absorberlo.
- **VPS compartido con recursos limitados**: Hetzner CX32 = 4 vCPU compartidas, 8 GB RAM, 80 GB disco (confirmado, fuente oficial: hetzner.com/pressroom/new-cx-plans). Ese VPS ya corre n8n + bots comerciales de MACD. Microservicios adicionales (contenedores propios, colas, service mesh) competirían por esos mismos 4 vCPU/8GB, arriesgando degradar los bots comerciales que generan ingresos hoy. Un monolito desplegado en Vercel (fuera del VPS) no compite por esos recursos; el VPS solo aporta n8n para jobs programados (polling de precios, cálculos batch), tal como ya define `00_FOUNDATION/01_INTEGRACION_MACD_STUDIOS.md`.
- **Next.js 15 App Router se presta bien a modularidad interna** sin necesitar red: route groups, `/lib/<dominio>` con barrels, server actions por módulo. Los "límites" entre trading engine, riesgo, dashboard y billing pueden imponerse por convención de carpetas + revisión de imports (ESLint boundaries), no por proceso separado.
- **Coste operativo y de mantenimiento**: un solo pipeline CI/CD, un solo entorno de logs/errores, un solo lugar de configuración de secretos. Consistente con la regla de oro del proyecto (no crear infraestructura nueva sin justificación documentada).
- **Riesgo/seguridad**: dato financiero sensible se beneficia de MENOS superficie de red interna (menos endpoints internos que asegurar), no más. RLS activo desde el día 1 en Supabase (ya definido) cubre el aislamiento de datos sin necesitar servicios separados por cliente.

## Cuándo NO usar esta recomendación
- Si el equipo crece a varios desarrolladores con ownership dedicado por módulo y necesitan desplegar de forma independiente sin bloquearse entre sí.
- Si un módulo concreto tiene requisitos de escalado o runtime radicalmente distintos al resto (p. ej. el trading engine necesita ejecución de baja latencia 24/7 en un proceso persistente con recursos dedicados, mientras el dashboard es serverless bajo demanda) — ahí SÍ se justifica extraer ESE módulo como servicio aparte, mientras el resto sigue siendo monolito.
- Si aparecen requisitos de aislamiento regulatorio fuerte (p. ej. un módulo de billing con alcance PCI que exige aislamiento de red/infra distinto al resto).

## Señales para migrar (extraer un servicio, no reescribir todo)
1. El trading engine necesita correr como proceso persistente (WebSocket a exchanges/MT5 en tiempo real) que no encaja en el modelo serverless de Vercel → candidato a extraerse primero, como proceso propio en el VPS o en un worker dedicado.
2. Los jobs de n8n/cálculo empiezan a saturar el CX32 (uso sostenido de CPU/RAM cerca del límite, medido, no intuido) → separar el motor de cálculo de riesgo/trading a su propio VPS antes que fragmentar en microservicios.
3. Aparece un segundo desarrollador/equipo con necesidad real de desplegar un módulo sin coordinar con el resto.
4. El volumen de datos de mercado (time-series) satura Supabase compartido → entonces se decide "proyecto Supabase separado" (ver decisión pendiente en `01_INTEGRACION_MACD_STUDIOS.md`), lo cual es ortogonal a monolito/microservicios pero es la primera señal de escalado de datos.
5. **(2026-07-07) Escalar a cuentas de fondeo MT5** exige N terminales MT5 en Windows (ver `11_MT5/02_DETALLE_FONDEOS_MT5_MULTICUENTA.md`) — candidato claro a proceso/servicio separado en su propia VPS Windows, distinto del VPS Linux de n8n y del monolito en Vercel. No construir hasta elegir prop firm concreto.

Extraer solo con evidencia concreta (medida), nunca por preferencia arquitectónica. Fuente: consenso de la industria post-Fowler (ver detalle).

## Modelo multi-venue de operador único (2026-07-07, ver `14_PORTFOLIOS`)
La arquitectura de "un operador, N cuentas propias repartidas en varios venues (Deriv/MT5-fondeo/Polymarket)" encaja en el monolito modular sin cambios: el `PortfolioManager` (14_PORTFOLIOS) es un módulo interno más (`/lib/portfolio`) que orquesta N instancias de `BrokerAdapter`. La única extracción de proceso que este modelo fuerza es la ya anotada en el punto 5 (terminales MT5 de fondeo en Windows) — el resto (Deriv Native API, Polymarket API) vive dentro del proceso Node de trading ya extraído al VPS Hetzner (ver `11_MT5/00_RESUMEN.md` §3). Detalle de la mecánica de fan-out a N cuentas: `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md`.

## Sin confirmar
- Límites exactos de CPU/RAM que n8n + bots comerciales consumen hoy en el CX32 (no hay monitorización documentada aún) — necesario para saber cuánto margen real queda antes de que un job de Atlas AI compita por recursos.
- Umbral concreto de volumen de datos de mercado que saturaría el plan gratuito/pagado de Supabase — pendiente de investigar (ya señalado como pendiente en `01_INTEGRACION_MACD_STUDIOS.md`).

Detalle ampliado (fuentes, comparativa, ejemplo de estructura de carpetas): `01_DETALLE_MONOLITO_VS_MICROSERVICIOS.md`.
