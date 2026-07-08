# Integración con MACD STUDIOS — no duplicar infraestructura

## Qué ya existe y se reutiliza
- **VPS Hetzner CX32** (167.233.27.69) con n8n en n8n.macdestudios.com → Atlas AI usa el MISMO n8n para orquestación (bots, alertas, webhooks), añadiendo workflows nuevos, no una segunda instancia.
- **Supabase** → mismo proyecto o proyecto nuevo (a decidir en Fase 1) pero mismo patrón: RLS pensado desde el inicio (a diferencia del proyecto de leads, donde se desactivó RLS para escritura de n8n — para Atlas, al manejar datos de capital/riesgo, RLS SÍ debe estar activo desde el día 1).
- **GitHub → Vercel** auto-deploy: Atlas AI como repo nuevo bajo klarospro, mismo equipo Vercel, subdominio propio (p.ej. atlas.macdestudios.com o app separada).
- **Postgres Chat Memory vía Session Pooler (IPv4)**: patrón ya validado para memoria de bots — reutilizable si Atlas necesita un bot conversacional (Telegram/WhatsApp) para reportes de cartera.
- **Next.js 15 + TypeScript + Tailwind v4 + Framer Motion**: mismo stack que GROUP 360, así el dashboard de Atlas puede compartir componentes/patrones de diseño.

## Qué NO se reutiliza / se hace distinto
- Typebot: descartado (ya fue dead end en MACD). No usar para Atlas tampoco.
- RLS desactivado: válido para leads (bajo riesgo), NO válido para datos financieros de Atlas.
- Credenciales de trading (MT5, exchanges): nunca en el mismo lugar que credenciales de marketing/leads. Namespace y secretos separados aunque el VPS sea el mismo.

## Separación lógica dentro del mismo VPS
- n8n: workflows de Atlas con prefijo `atlas_` para no mezclarse con los workflows comerciales de MACD.
- Supabase: schema separado (`atlas` schema) o proyecto separado si el volumen de datos de trading lo justifica (a confirmar en Fase 1 — pendiente investigar límites de Supabase gratuito/pago para time-series de mercado).
- Recursos del VPS: monitorizar que los workflows de Atlas (que pueden ser más intensivos: polling de precios, cálculos) no degraden el rendimiento de los bots comerciales de MACD. Pendiente decidir si Atlas necesita su propio VPS más adelante (NO crear uno ahora — reutilizar hasta que haya evidencia de que hace falta).

## Decisión pendiente (Fase 1)
¿Supabase: mismo proyecto con schema nuevo, o proyecto nuevo? Justificar con: volumen esperado de datos de mercado, aislamiento de seguridad, coste.
