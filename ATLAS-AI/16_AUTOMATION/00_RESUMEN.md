# Automatización — runner de trading 24/7

Estado: 🟢 EN VIVO desde 2026-07-08. El bot corre solo en el VPS Hetzner: `atlas-cycle.timer`
dispara `atlas-cycle.service` cada día a las **00:05 UTC** con `--execute`. Verificado 2026-07-11:
posiciones y equity en Supabase con timestamp 00:05 UTC (el bot operó esa madrugada).
Pendiente menor: activar Telegram (`TELEGRAM_BOT_TOKEN`+chat_id en el `.env.local` del VPS).

## Qué es
Paquete para que el ciclo de trading (Deriv DEMO) corra **solo, todos los días, sin el portátil de
Moisés**, en el VPS Hetzner. No es infra nueva: reutiliza el VPS y Supabase existentes.

## Por qué así (decisiones)
- **Cadencia 1x/día a las 00:05 UTC**, no un daemon permanente. La estrategia usa velas DIARIAS
  (`granularity 86400`); la señal solo cambia al cerrar la vela. Un proceso 24/7 gastaría recursos
  sin cambiar decisiones → `systemd oneshot + timer` es lo correcto.
- **Riesgo topado en el broker**: Deriv Multipliers acota la pérdida máxima al stake
  (`derivDemoAdapter.ts:108`), así que no hace falta monitor de stops intradía en este venue.
- **Conectar→correr→desconectar** cada vuelta: Deriv cierra el WS a los ~2 min de inactividad.

## Artefactos (en `16_AUTOMATION/deploy/`)
- `atlas-cycle.service` + `atlas-cycle.timer` — el ciclo diario (systemd), corre con `--execute`.
- `atlas-publish.service` + `atlas-publish.timer` — OPCIONAL, refresca equity/P&L del dashboard
  cada 5 min entre ciclos (no opera). Script npm nuevo: `publish:live`.
- `DEPLOY_RUNBOOK.md` — pasos SSH: usuario `atlas`, Node 22, clone, `.env.local`, migraciones
  Supabase, prueba en seco, timer.

## Pendiente para Moisés (ejecutar en el VPS)
Seguir `DEPLOY_RUNBOOK.md`. Requisitos: token DEMO de Deriv, `SUPABASE_SERVICE_KEY`, y
`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` (o `N8N_WEBHOOK_URL`). Correr migraciones 001/003/004.
Probar en seco (sin `--execute`) antes de activar el timer.

## Sin confirmar
- Ruta real de `node`/`npm` en el VPS (asumido `/usr/bin`).
- Método de clone del repo privado (deploy key vs PAT) — elegir en el paso 3.
