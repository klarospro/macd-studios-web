# ATLAS AI — Reglas del proyecto (MACD STUDIOS)

Plataforma SaaS de gestión automatizada de capital. Módulo hermano de MACD STUDIOS, reutilizando infraestructura ya operativa (no crear infra nueva salvo justificación documentada).

## Infraestructura ya existente (REUTILIZAR, no duplicar)
- VPS: Hetzner CX32, 167.233.27.69, n8n en n8n.macdestudios.com
- BD: Supabase (Postgres). Memoria de chat: Postgres Chat Memory vía Session Pooler IPv4
- Deploy: GitHub (klarospro) → Vercel (team eliuchirino-3369s-projects) auto-deploy
- Automatización: n8n para bots (Telegram/WhatsApp), no Typebot (abandonado, dead end)
- Dev: Next.js 15, TypeScript, Tailwind v4, Framer Motion
- Terminal: PowerShell, `claude` desde C:\MACD-STUDIOS

## Regla de oro
NO se escribe código de producción sin investigación documentada en `01_RESEARCH/` o la carpeta numerada correspondiente que la justifique. Si falta, decirlo y proponer investigar primero.

## Objetivo del producto (en este orden)
1. Preservación de capital 2. Gestión de riesgo 3. Automatización 4. Escalabilidad 5. Diversificación 6. Documentación 7. Reutilización 8. Comercialización SaaS

## Flujo de trabajo obligatorio
Investigar → Documentar en la carpeta numerada → Aprobación humana (Moisés) → Construir → Testear → Desplegar.
Usa subagentes para investigación pesada (no contaminar el contexto principal). Usa Skills para procedimientos repetibles. Usa Hooks para reglas innegociables (bloquear escritura de secretos, lint antes de commit).

## Optimización de tokens (obligatorio)
- CLAUDE.md se mantiene corto (<200 líneas). Cualquier detalle recurrente va a un Skill, no aquí.
- Investigación profunda/lectura de muchos archivos o docs → delegar a subagente (`.claude/agents/`), nunca en la sesión principal.
- Cada carpeta numerada tiene un `00_RESUMEN.md` de máx. 1 página; el detalle completo vive en archivos aparte que solo se cargan si hacen falta.
- Nunca cargar una carpeta entera de golpe: pedir el índice primero (`00_FOUNDATION/00_INDICE_MAESTRO.md`).
- Mantén un índice maestro actualizado; no re-investigar lo ya documentado.

## Seguridad (no negociable)
- Credenciales NUNCA en chat, código ni docs. Solo variables de entorno / secret manager.
- `.env`, `secrets/**`, credenciales MT5/exchanges → denegar lectura por defecto en permisos de Claude Code.
- Toda integración con dinero real requiere: modo paper/demo primero, límites de riesgo explícitos, logs de auditoría.

## Prioridad de fuentes
Documentación oficial > papers académicos > repos de referencia con estrellas/mantenimiento activo > blogs. Si algo no está confirmado, se marca como "sin confirmar" — nunca se improvisa.

## Subagentes disponibles (ver `.claude/agents/`)
- `researcher`: investiga y resume en la carpeta numerada correspondiente, no toca código de producción.
- `risk-architect`: diseña/revisa reglas de gestión de riesgo y position sizing.
- `security-reviewer`: revisa credenciales, permisos, superficie de ataque antes de cualquier deploy.

## Estado del proyecto
Ver `00_FOUNDATION/00_INDICE_MAESTRO.md` y `ROADMAP_FASES.md` para la fase actual. No saltar de fase sin cerrar la anterior.
