# Detalle — modelos Claude, precios y prompt caching

Complementa `00_RESUMEN.md`. Cifras cacheadas al 2026-06-24 (fuente: catálogo interno de modelos de Anthropic) — **verificar en `platform.claude.com/docs/en/pricing` antes de usar en cualquier cálculo de coste comprometido con cliente**.

## Tabla de modelos (referencia para Atlas)

| Modelo | ID | Contexto | Input $/1M tokens | Output $/1M tokens | Uso recomendado en Atlas |
|---|---|---|---|---|---|
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5.00 | $25.00 | Razonamiento de alto riesgo puntual (motor de riesgo, revisión de seguridad) |
| Claude Sonnet 5 | `claude-sonnet-5` | 1M | $3.00 (intro $2.00 hasta 2026-08-31) | $15.00 (intro $10.00) | Por defecto: subagentes, investigación, construcción de producto |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | $1.00 | $5.00 | Volumen alto, bajo riesgo (clasificación simple, resúmenes cortos) — nunca lógica de riesgo/capital |

Nota: estas cifras aplican a llamadas directas a la API de Anthropic (`messages.create`). El uso de Claude Code en modo interactivo (sesión de Moisés) se factura vía la suscripción de Claude Code, no por estas tarifas por token.

## Ejemplo de asignación de modelo por subagente (frontmatter)

```
---
name: researcher
description: Investiga y documenta en la carpeta numerada correspondiente.
tools: Read, Grep, Glob, WebFetch, WebSearch
model: sonnet
---
```

Para un subagente que requiera razonamiento de mayor riesgo (ejemplo futuro, `risk-architect` revisando la lógica final de Kelly fraccionado antes de aprobar Fase 3 a producción):

```
---
name: risk-architect
description: Diseña y revisa reglas de gestión de riesgo y position sizing. Usar model opus solo para la revisión final antes de aprobación humana.
tools: Read, Grep, Glob
model: opus
---
```

La regla no es "risk-architect siempre usa Opus" — es "escalar a Opus en el paso de mayor riesgo dentro del flujo, no en cada invocación rutinaria".

## Prompt caching — cuándo aplica a Atlas

Prompt caching (`cache_control: {type: "ephemeral"}`) reduce el coste de reenviar el mismo contexto grande en llamadas sucesivas a la API de Anthropic. Relevante **solo si/cuando Atlas construye una feature de producto** que llama a la API directamente con un prefijo grande y estable (ej. un system prompt largo para "explícame mi cartera", o un documento de contexto financiero reutilizado en varias preguntas del mismo usuario). No aplica al uso de Claude Code en sí — Anthropic gestiona esa capa internamente.

Reglas clave si se implementa:
- Es un match de prefijo exacto — cualquier byte distinto en el prefijo invalida el caché desde ese punto en adelante.
- Lectura de caché cuesta ~0.1× el precio normal de input; escritura cuesta ~1.25× (TTL 5 min) o ~2× (TTL 1 hora).
- Se amortiza a partir de la 2ª-3ª llamada con el mismo prefijo dentro del TTL — no vale la pena para una sola llamada.
- No poner timestamps, IDs de sesión ni contenido variable al principio del prompt — invalida todo lo que va después.

## Fuentes
Catálogo de modelos y precios: cache interno de la skill `claude-api` (2026-06-24), basado en documentación oficial de Anthropic (`platform.claude.com/docs/en/pricing`, `platform.claude.com/docs/en/about-claude/models/overview`). Guía de prompt caching: documentación oficial de Anthropic (`platform.claude.com/docs/en/build-with-claude/prompt-caching`).

## Sin confirmar
- Precios exactos vigentes al momento de cualquier facturación real a cliente (la tabla de arriba es una instantánea, no una fuente en vivo).
- Si el precio introductorio de Sonnet 5 ($2.00/$10.00) seguirá vigente después del 2026-08-31.
