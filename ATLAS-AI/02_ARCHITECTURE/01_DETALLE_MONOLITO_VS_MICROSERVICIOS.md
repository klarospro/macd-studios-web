# Detalle: Monolito modular vs microservicios para Atlas AI

## Contexto evaluado
- Equipo: 1 persona (Moisés).
- Stack fijado: Next.js 15 (App Router) + TypeScript + Supabase + Tailwind v4 + Framer Motion.
- Infra a reutilizar: VPS Hetzner CX32 (4 vCPU compartidas, 8 GB RAM, 80 GB disco — confirmado, hetzner.com/pressroom/new-cx-plans), corriendo ya n8n + bots comerciales de MACD STUDIOS. Deploy vía GitHub → Vercel.
- Módulos funcionales previstos: trading engine, gestión de riesgo, dashboard, SaaS billing.
- Prioridad de producto (CLAUDE.md): preservación de capital > riesgo > automatización > escalabilidad > diversificación > documentación > reutilización > comercialización.

## Comparativa

| Criterio | Monolito modular | Microservicios |
|---|---|---|
| Coste de mantenimiento con 1 persona | Bajo: un repo, un pipeline, un runtime | Alto: N repos/servicios, versionado de contratos, debugging distribuido |
| Uso de recursos del VPS CX32 (4vCPU/8GB compartidos con n8n+bots) | Ninguno adicional si la app vive en Vercel; el VPS solo corre n8n | Cada servicio propio compite por CPU/RAM del mismo VPS, riesgo de degradar bots comerciales que ya generan ingresos |
| Velocidad de iteración inicial | Alta (sin overhead de red entre módulos) | Baja al inicio: hay que diseñar contratos de API antes de saber si el dominio es estable |
| Aislamiento de fallos | Un fallo grave puede afectar a toda la app (mitigable con buenas prácticas de módulos y manejo de errores) | Un servicio caído no tumba a los demás, pero introduce fallos de red/latencia nuevos que no existían |
| Seguridad de datos financieros | Menor superficie de red interna que asegurar; RLS de Supabase cubre aislamiento de datos | Más endpoints internos = más superficie de ataque, requiere mTLS/gateway adicional |
| Escalado independiente por módulo | No nativo (aunque Next.js permite server actions/edge functions con escalado propio en Vercel) | Nativo, pero irrelevante con 1 usuario/equipo pequeño y tráfico bajo-medio |
| Coste de infraestructura | El actual (VPS ya pagado + Vercel + Supabase) | Requeriría orquestación adicional (contenedores, colas, posible service mesh) — coste no presupuestado |

## Fuentes
- Martin Fowler, "MonolithFirst" — https://martinfowler.com/bliki/MonolithFirst.html — confirma que casi todos los sistemas de microservicios exitosos documentados empezaron como monolito, y que empezar con microservicios desde cero suele terminar en problemas serios, salvo con equipos que ya tienen experiencia previa en microservicios (no es el caso aquí).
- Martin Fowler, "MicroservicePremium" — https://martinfowler.com/bliki/MicroservicePremium.html — el coste de gestión de un conjunto de servicios ("premium") solo se justifica en sistemas de complejidad alta con equipos capaces de absorberlo; para sistemas simples/medianos favorece monolito.
- Hetzner, especificaciones oficiales CX32 — https://www.hetzner.com/pressroom/new-cx-plans/ y https://www.hetzner.com/cloud/regular-performance — 4 vCPU compartidas, 8 GB RAM, 80 GB disco, 20 TB tráfico, 1 IPv4.
- Consenso comunitario (no oficial pero convergente entre múltiples fuentes independientes) sobre modular monolith y señales de extracción: equipos por debajo de ~20 desarrolladores rara vez justifican el overhead de microservicios; extraer solo cuando hay evidencia medida (no intuición) de necesidad de escalado, aislamiento operativo real (p. ej. GPU dedicada, PCI) o necesidad de despliegue independiente por equipo dedicado. Fuentes consultadas: getdx.com/blog/monolithic-vs-microservices, embeddeduse.com (Extracting Microservices from a Modular Monolith), dev.to (varios artículos sobre migración monolito → modular monolith → microservicios). Estas últimas se marcan como "sin confirmar" en el sentido de que no son fuente oficial/normativa, pero son consistentes entre sí y con la postura de Fowler.

## Cómo imponer modularidad dentro del monolito (recomendación práctica, no código de producción)
- Un módulo de dominio por carpeta bajo `/lib`: `trading/`, `risk/`, `billing/`, cada uno exponiendo una API interna explícita (barrel `index.ts`) y sin imports cruzados directos a los internos de otro módulo.
- El dashboard (`/app`) consume solo las APIs internas expuestas, nunca el detalle interno de `trading/` o `risk/`.
- Reglas de import (ESLint boundaries o similar) para que un módulo no importe archivos internos de otro — esto es lo que Fowler señala como el requisito real para poder extraer un microservicio más adelante sin reescritura completa.
- Separación de datos desde ahora: schema `atlas` propio en Supabase con RLS activo, para que si algún día se extrae un servicio, el límite de datos ya esté trazado.

## Cuándo NO conviene el monolito (ampliado)
- Un segundo perfil técnico se incorpora con ownership exclusivo de un módulo y necesidad de desplegar sin coordinar — la fricción de coordinación en un monorepo empieza a doler más que el overhead de separar.
- El trading engine requiere un proceso de larga duración con conexión persistente (WebSocket a exchanges/MT5) incompatible con el modelo serverless de Vercel — este es, con la información actual, el candidato más probable a convertirse en el primer servicio extraído (viviría en el VPS o en un worker dedicado), mientras dashboard/billing siguen en el monolito Next.js/Vercel.
- Un módulo tiene requisitos de cumplimiento (p. ej. PCI para billing) que exigen aislamiento de infraestructura distinto al resto.

## Sin confirmar
- Consumo real actual de CPU/RAM de n8n + bots comerciales en el CX32 — no hay dato de monitorización citado en la documentación existente del proyecto.
- Límites de Supabase (plan actual) para volumen de datos de time-series de mercado — señalado como pendiente en `00_FOUNDATION/01_INTEGRACION_MACD_STUDIOS.md`, no investigado en esta pasada.
- Si Vercel (plan actual del equipo) soporta procesos de larga duración con WebSocket persistente para un futuro trading engine, o si eso obligaría a mover esa pieza al VPS desde el principio — requiere investigación específica de límites de Vercel Functions/Fluid Compute antes de diseñar el módulo de trading engine (Fase 3).
