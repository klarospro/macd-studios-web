# Infraestructura y DevOps — Convivencia de Atlas AI con MACD STUDIOS

Estado: Fase 1 — hecho. Detalle extenso: `01_DETALLE_SUPABASE_SCHEMA_VS_PROYECTO.md`.

## Qué es
El conjunto de decisiones para que Atlas AI (SaaS de gestión de capital) use la infraestructura ya operativa de MACD STUDIOS (VPS Hetzner CX32 con n8n, Supabase, GitHub→Vercel) sin degradar `macdestudios.com` ni los bots comerciales activos.

## Por qué existe
Atlas introduce cargas nuevas (polling de mercado, cálculos) y datos sensibles (capital, órdenes) sobre infraestructura que ya sirve tráfico comercial en producción. Sin aislamiento explícito, un fallo o pico de carga de Atlas puede romper servicios que generan ingresos hoy.

## Decisiones de convivencia

**n8n (mismo VPS, misma instancia):** workflows de Atlas con prefijo `atlas_`. Activar `N8N_CONCURRENCY_PRODUCTION_LIMIT` para no dejar que picos de Atlas saturen las ejecuciones production de los bots comerciales. Migrar a **queue mode** (worker separado, mismo VPS) cuando el polling introduzca latencia perceptible en los bots — no antes.

**Vercel/GitHub:** repo nuevo bajo `klarospro`, mismo equipo Vercel, subdominio propio (`atlas.macdestudios.com` o dominio propio del SaaS). Deploy independiente evita que un build roto de Atlas tumbe `macdestudios.com`.

**Supabase — decisión pendiente resuelta: PROYECTO SEPARADO, no schema nuevo.**
Criterio decisivo: RLS debe estar activo desde el día 1 para datos financieros, y el proyecto de leads existente ya tiene RLS desactivado para escritura de n8n. Compartir proyecto expondría los datos de capital/órdenes de Atlas al mismo compute, Auth y API keys que un sistema con superficie de riesgo mayor. Un schema no aísla eso; un proyecto separado sí (credenciales, Auth y compute independientes). El coste incremental es bajo: plan Pro $25/mes de base (si el proyecto de leads no está ya en Pro — sin confirmar), compute Micro ~$10/mes parcialmente cubierto por el crédito de $10/mes incluido en Pro.

**VPS separado para Atlas — NO ahora.** Señales concretas para reconsiderar:
- CPU/RAM del CX32 sostenidamente >80% con Atlas en carga normal (no picos), tras haber aplicado queue mode + límites de concurrencia.
- Atlas pasa de modo paper/demo a dinero real y se requiere aislamiento físico de fallos frente a los bots comerciales.
- El volumen de conexiones Postgres/pooler de Atlas se acerca al límite del compute tier contratado y compite con los bots por conexiones.

## Ventajas / desventajas
- Ventaja: cero infraestructura nueva en VPS/n8n, coste incremental mínimo en Supabase, aislamiento de seguridad real donde más importa (datos financieros).
- Desventaja: doble mantenimiento de proyectos Supabase (migraciones, backups) y necesidad de monitorizar recursos del VPS compartido activamente.

## Riesgos
- Sin monitorización activa del CX32, un polling agresivo de precios puede degradar los bots comerciales antes de notarlo.
- Sin confirmar si el proyecto Supabase de leads está en Free o Pro — condiciona el coste incremental real del proyecto nuevo de Atlas.

## Sin confirmar (ver detalle completo)
- Plan actual (Free/Pro) del proyecto Supabase de leads.
- Límite máximo de proyectos por organización en Supabase Pro.
- Si el crédito de compute de $10/mes de Pro es por organización o por proyecto.
- Valor por defecto exacto de `QUEUE_WORKER_CONCURRENCY` en n8n (tomado de fuente secundaria).
- Specs de RAM exactas del CX32 contratado (Hetzner publica 4 vCPU/8GB como estándar de catálogo, no verificado contra la cuenta real).

## Fuentes oficiales
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/compute-and-disk
- https://supabase.com/docs/guides/platform/org-based-billing
- https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/control-concurrency
- https://docs.n8n.io/hosting/scaling/queue-mode/
