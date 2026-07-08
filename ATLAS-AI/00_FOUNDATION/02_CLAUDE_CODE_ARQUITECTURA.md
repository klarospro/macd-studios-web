# Claude Code: arquitectura operativa para Atlas AI

Fuente: documentación oficial Claude Code + guías de la comunidad (2026). Confirmado por múltiples fuentes independientes.

## Los 4 primitivos y cuándo usar cada uno
| Primitivo | Qué es | Coste de tokens | Úsalo para |
|---|---|---|---|
| **CLAUDE.md** | Contexto que se carga SIEMPRE, cada turno | Alto si es largo (recurrente) | Reglas que deben ser verdad siempre (ya hecho: `/CLAUDE.md`) |
| **Skills** (`.claude/skills/<nombre>/SKILL.md`) | Procedimiento bajo demanda; solo la descripción se carga siempre, el cuerpo solo si se invoca | Bajo hasta que se usa | Workflows repetibles (ej. "cómo documentar una fase", "checklist de riesgo") |
| **Subagentes** (`.claude/agents/`) | Instancia de Claude con contexto propio y aislado, devuelve solo el resumen | Alto coste fijo por invocación, pero AISLADO del contexto principal | Investigación pesada, lectura de muchos archivos, revisión de código/seguridad |
| **Hooks** (`.claude/hooks/` o `settings.json`) | Script determinista que se ejecuta en eventos (PreToolUse, PostToolUse, SessionStart...) | CERO tokens de modelo (lo ejecuta el harness, no Claude) | Reglas innegociables: bloquear escritura de secretos, lint automático, backups antes de compactar contexto |

Regla práctica confirmada por varias fuentes: si tiene que ser verdad SIEMPRE → CLAUDE.md. Si es un procedimiento que solo aplica a veces → Skill. Si debe ejecutarse sí o sí sin que el modelo pueda saltárselo → Hook. Si llenaría el contexto principal → Subagente.

## Reglas de tokens confirmadas (oficial)
- CLAUDE.md recomendado: **menos de 200 líneas**. El nuestro ya cumple.
- Skills: la descripción siempre está en contexto, pero el contenido completo solo se carga al invocarse. Una vez invocado, se queda en contexto el resto de la sesión (no se re-lee). Al compactar automáticamente, Claude Code conserva los primeros 5.000 tokens de cada skill invocado, con presupuesto combinado de 25.000 tokens para todos los skills reactivados.
- Subagentes: contexto propio, ideal para "explorar 50 archivos" sin ensuciar la sesión principal. Devuelven solo un resumen.
- Punto dulce de subagentes concurrentes: 3-5 según fuentes de la comunidad (no oficial, pero consistente entre varias fuentes).

## Estructura de subagente (`.claude/agents/nombre.md`)
```
---
name: researcher
description: Investiga un tema y documenta el resumen en la carpeta numerada correspondiente. Úsalo para lecturas pesadas de documentación externa.
tools: Read, Grep, Glob, WebFetch, WebSearch
model: sonnet
---
Eres un investigador senior para Atlas AI. Tu única salida es un resumen documentado
siguiendo el formato de 01_RESEARCH (qué es / por qué existe / cuándo usarlo / cuándo no /
ventajas / desventajas / riesgos / fuentes oficiales). No escribes código de producción.
```

## Estructura de skill (`.claude/skills/nombre/SKILL.md`)
Frontmatter mínimo: `name`, `description` (crítico — Claude decide si usarlo según esto). Cuerpo conciso, en imperativo ("haz X"), no explicativo ("esto sirve para..."). Cada línea es coste recurrente una vez invocado.

## Hooks recomendados para Atlas AI (fase 2, a implementar)
- `PreToolUse` con matcher en Write/Edit → bloquear escritura en `.env`, `secrets/**`, cualquier archivo con credenciales MT5/exchange.
- `PostToolUse` → lint/format automático tras editar código.
- `PreCompact` → backup de la conversación antes de comprimir contexto (importante en investigaciones largas).
- Permisos (`settings.json`): `deny` explícito sobre `.env*`, `secrets/**` — más seguro que confiar en que el hook lo bloquee, porque los hace invisibles a Claude directamente.

## Fuentes
Documentación oficial: code.claude.com/docs/en/skills. Guías comunitarias contrastadas (abril-junio 2026): ofox.ai, levelup.gitconnected.com, smartscope.blog, buildthisnow.com, totalum.app, alexop.dev.

## Sin confirmar
- Soporte multi-agente ("Agent Teams") mencionado por una fuente comunitaria — no está en la documentación oficial revisada aquí. Verificar antes de diseñar workflows que dependan de ello.
