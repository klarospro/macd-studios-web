# IA: modelos, orquestación y separación de capas

Estado: Fase 2 — decisión tomada. Detalle (tabla de precios, prompt caching, ejemplo de asignación de modelo por subagente): `01_DETALLE_MODELOS_Y_CACHING.md`.

## Qué es / por qué existe
Atlas AI usa modelos Claude (Anthropic) en dos capas distintas: (1) Claude Code como herramienta de desarrollo (orquestador + subagentes que construyen el producto) y (2) — cuando se construya, no antes — features de IA en tiempo de ejecución del propio producto Atlas (explicaciones de riesgo, resúmenes de cartera). Ambas capas son de Anthropic/Claude y deben mantenerse separadas de la capa de IA comercial de MACD STUDIOS, que usa OpenAI para sus bots (Telegram/WhatsApp vía n8n).

## Decisión: qué modelo para qué (recomendación única, no abanico)

| Tarea | Modelo | Por qué |
|---|---|---|
| Sesión interactiva de Claude Code (Moisés) | El que tenga configurado el plan/suscripción de Claude Code (no es una llamada de API facturada por token aparte) | Fuera del alcance de esta decisión — lo gestiona la suscripción de Claude Code, no la API |
| Subagentes (`researcher`, `risk-architect`, `security-reviewer`) — caso por defecto | **Claude Sonnet 5** (`claude-sonnet-5`) | Ya es la convención establecida en `00_FOUNDATION/02_CLAUDE_CODE_ARQUITECTURA.md` (frontmatter `model: sonnet`). Calidad cercana a Opus en tareas de codificación/agénticas a un tercio del coste — el balance correcto para investigación e implementación rutinaria |
| Razonamiento de alto riesgo puntual (diseño del motor de riesgo/Kelly fraccionado en Fase 3, revisión de seguridad antes de producción) | **Claude Opus 4.8** (`claude-opus-4-8`) | Se invoca explícitamente para ese subagente/tarea, no por defecto — el coste ($5/$25 por MTok vs $3/$15 de Sonnet) se justifica solo cuando el coste de un error es alto (dinero real, superficie de seguridad) |
| Features futuras del producto Atlas de alto volumen (si se construyen): clasificación simple, resúmenes cortos, notificaciones | **Claude Haiku 4.5** (`claude-haiku-4-5`) | Más barato/rápido ($1/$5 por MTok); **nunca** para lógica que toque dimensionamiento de posición o decisiones de riesgo sin revisión humana posterior |

Regla práctica: por defecto Sonnet 5. Subir a Opus solo cuando la tarea lo justifique explícitamente (riesgo/seguridad/complejidad alta). Bajar a Haiku solo para volumen alto y bajo riesgo. Nunca usar Haiku para nada que mueva capital.

## Cómo se integran los MCPs con Claude Code
Los MCPs (ver `04_MCP/00_RESUMEN.md`) se declaran en `.mcp.json` o vía `claude mcp add` y aparecen como herramientas adicionales que el modelo activo puede invocar dentro de una sesión — el modelo (Sonnet/Opus) decide cuándo llamarlas, igual que con las herramientas nativas (Read/Bash/etc.). No cambia la elección de modelo; añade capacidades (datos de mercado, consultas a Supabase) al mismo modelo.

## Dónde viven las API keys
- **Claude Code (uso interactivo/subagentes)**: se autentica vía `ant auth login` (perfil OAuth) o la suscripción de Claude Code — no requiere gestionar una API key de Anthropic a mano para el uso diario.
- **Llamadas directas a la API de Anthropic** (si Atlas construye features de producto que llaman `messages.create` fuera de Claude Code): `ANTHROPIC_API_KEY` en variable de entorno del proceso Atlas (Next.js en Vercel → `.env.local` / Vercel env vars), nunca hardcodeada, nunca en el repo — mismo patrón que el resto de secretos de `18_SECURITY/00_RESUMEN.md`.
- **Nunca compartir** la key de Anthropic de Atlas con las credenciales OpenAI de los bots comerciales de MACD, ni en el mismo `.env`, ni en el mismo scope de n8n. Si en el futuro Atlas necesita un bot conversacional (ej. "explícame mi cartera" vía Telegram, reutilizando el patrón de Postgres Chat Memory ya validado en MACD), sus credenciales van con prefijo `atlas_` y usuario de servicio separado, igual que ya exige `18_SECURITY` para trading vs comercial.

## Separación Atlas (Claude) vs bots comerciales MACD (OpenAI)
No es una limitación técnica — es una decisión de aislamiento de seguridad y de coherencia de stack: Atlas se construye con Claude Code como herramienta principal, así que usar Claude también para features de producto evita gestionar dos proveedores de IA con dos sistemas de credenciales para el mismo proyecto. Los bots comerciales de MACD siguen en OpenAI porque ya están en producción funcionando — no se migran sin justificación documentada (regla de oro del proyecto). Ambos stacks son técnicamente válidos; la decisión es no mezclarlos dentro del mismo proceso/credencial/n8n workflow.

## Ventajas / desventajas / costes
- Ventaja: un solo proveedor de IA para todo Atlas simplifica gestión de claves, facturación y observabilidad de coste (todo bajo `platform.claude.com`).
- Desventaja: dependencia de un solo proveedor para la capa de IA de Atlas (mitigado porque el producto principal — trading/riesgo — no depende de generación de lenguaje natural en su lógica core, solo en features auxiliares).
- Coste: sin llamadas de producto todavía (Fase 2). Los únicos costes activos hoy son los ya cubiertos por la suscripción de Claude Code.

## Alternativas
OpenAI (ya usado por MACD comercial) es la alternativa obvia y técnicamente válida — se descarta para la capa de Atlas solo por la razón de separación de arriba, no por incapacidad técnica. Reevaluar si en el futuro hay una razón de coste o capacidad concreta.

## Riesgos
Elegir el modelo equivocado para una tarea de riesgo (ej. usar Haiku para generar lógica de position sizing sin supervisión) puede producir código sutilmente incorrecto — mitigado por el flujo obligatorio ya definido en `CLAUDE.md`: Investigar → Documentar → Aprobación humana → Construir → Testear.

## Mejores prácticas
Declarar el modelo explícitamente en el frontmatter de cada subagente (`model: sonnet` por defecto); no dejarlo implícito. Prompt caching (detalle en `01_DETALLE_MODELOS_Y_CACHING.md`) para cualquier feature futura que reenvíe contexto grande repetido (ej. system prompt largo de un asistente de cartera) — reduce el coste de esas llamadas hasta ~90% en la porción cacheada.

## Sin confirmar
- Si/cuándo Atlas construirá una feature de IA conversacional de cara al cliente (fuera de Claude Code) — no hay fecha ni carpeta asignada aún; cuando se decida, documentar en `05_SKILLS` o `16_AUTOMATION` según corresponda.
- Precios exactos de Anthropic al momento de facturar a un cliente real — la tabla en el detalle está cacheada al 2026-06-24; verificar en `platform.claude.com/docs/en/pricing` antes de cualquier cálculo de coste comprometido.

## Fuentes
Anthropic — catálogo de modelos y precios (cache interno de la skill `claude-api`, 2026-06-24) · `code.claude.com/docs/en/mcp` (integración MCP, oficial) · `00_FOUNDATION/02_CLAUDE_CODE_ARQUITECTURA.md` (convención de subagentes ya establecida) · `18_SECURITY/00_RESUMEN.md` (modelo de secretos).
