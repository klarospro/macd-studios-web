# ROADMAP DE FASES — ATLAS AI

Regla: no se avanza de fase sin que Moisés apruebe el resumen de la anterior. Cada fase la ejecuta preferentemente un subagente `researcher` para no gastar contexto de la sesión principal.

## FASE 0 — Fundación (HECHA en esta entrega)
- Estructura de carpetas creada
- CLAUDE.md con reglas e infraestructura existente
- Investigación inicial: Claude Code (hooks/skills/subagentes) + MCP de trading disponibles
- Estado: ✅ listo para revisar

## FASE 1 — Arquitectura y decisiones base
Carpetas: 02_ARCHITECTURE, 19_INFRASTRUCTURE, 18_SECURITY
- Decidir patrón (monolito modular vs microservicios) para una SaaS pequeña-mediana en el mismo VPS
- Definir cómo convive Atlas AI con n8n/Supabase/Vercel sin romper macdestudios.com
- Modelo de seguridad: gestión de secretos, aislamiento por cliente (multi-tenant)

## FASE 2 — MCP + Claude Code operativo
Carpetas: 04_MCP, 03_AI, 07_AGENTS, 05_SKILLS, 06_HOOKS
- Elegir MCPs reales a instalar (empezar por 1-2 probados, no 20 de golpe)
- Crear subagentes y skills iniciales (research, risk, security)
- Hooks de seguridad: bloquear escritura en .env/secrets, lint/test antes de commit

## FASE 3 — Motor de trading y riesgo (núcleo del producto)
Carpetas: 08_TRADING, 09_RISK, 11_MT5, 12_EXCHANGES, 10_POLYMARKET, 13_BACKTESTING
- Empezar SOLO en modo demo/paper. Definir reglas de riesgo (tamaño de posición, drawdown máx, Kelly fraccionado) antes de cualquier ejecución real
- MT5 MCP y exchange MCPs se investigan pero NO se conectan a cuentas reales sin aprobación explícita

## FASE 4 — Portfolios y Dashboard
Carpetas: 14_PORTFOLIOS, 15_DASHBOARD
- KPIs: capital, drawdown, Sharpe, Sortino, correlación, alertas
- Reutilizar patrón del dashboard de GROUP 360 (Next.js 15 + Supabase) como base de diseño

## FASE 5 — Automatización y SaaS
Carpetas: 16_AUTOMATION, 17_SAAS
- n8n para orquestación (mismo VPS), Stripe para suscripciones, roles/permisos multi-cliente

## FASE 6 — Testing, Deploy, Documentación, Marketing, Clientes, Templates
Carpetas: 21_TESTING, 22_DEPLOYMENT, 20_DOCUMENTATION, 23_MARKETING, 24_CLIENTS, 25_TEMPLATES, 26_KNOWLEDGE_BASE

---
**Instrucción para Claude Code al iniciar:** lee este roadmap + CLAUDE.md, confirma en qué fase está el proyecto revisando qué carpetas tienen `00_RESUMEN.md`, y continúa desde ahí. No repitas investigación ya documentada.
