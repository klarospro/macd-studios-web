# Model Context Protocol — qué instalar en Fase 2

Estado: Fase 2 — decisión tomada. Parte de `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md` (Fase 0); no se repite esa investigación aquí.
Detalle de configuración, fuentes y ejemplos: `01_DETALLE_MCPS_RECOMENDADOS.md`.

## Qué es / por qué existe
MCP (Model Context Protocol) es el estándar abierto con el que Claude Code conecta a herramientas y fuentes de datos externas (bases de datos, APIs, dashboards) sin tener que copiar/pegar contexto a mano. Cada servidor MCP expone "tools" que el modelo puede invocar durante una sesión.

## Decisión: instalar 2 MCPs YA, difiere el resto a Fase 3

### 1. CoinGecko MCP (oficial, remoto, solo lectura) — INSTALAR YA
Qué hace: precios, market cap, volumen y datos on-chain de +15.000 criptomonedas vía la API pública de CoinGecko.
- Madurez: oficial de CoinGecko (`docs.coingecko.com/docs/mcp-server`, paquete npm `@coingecko/coingecko-mcp`), servidor hospedado (`mcp.api.coingecko.com`) + opción self-host.
- Permisos: ninguno — nivel gratuito "keyless" sin API key, solo lectura, sin herramientas de escritura.
- Superficie de riesgo: mínima. Sin credenciales que gestionar, sin acceso a filesystem/bash, sin custodia de fondos. Único riesgo genérico de MCP: prompt injection vía datos externos (advertencia oficial de Claude Code) — irrelevante aquí porque el dato es numérico (precios), no texto libre a ejecutar.
- Encaje con `18_SECURITY`: no aplica modelo de secretos (no hay secreto que proteger). Instalar en **scope local** (personal) inicialmente vía `claude mcp add --transport http coingecko https://mcp.api.coingecko.com/mcp`.

### 2. Supabase MCP (oficial, modo solo-lectura) — INSTALAR YA
Qué hace: permite a Claude Code inspeccionar schema, políticas RLS y ejecutar queries de solo lectura contra el proyecto Supabase separado de Atlas (decisión ya tomada en `19_INFRASTRUCTURE/00_RESUMEN.md`).
- Madurez: repo oficial `supabase-community/supabase-mcp` (org Supabase) — **2.778 estrellas, último push 2026-06-30, no archivado** (verificado vía GitHub API). Mantenimiento activo confirmado.
- Permisos: token de acceso personal (PAT) de Supabase, con flag `read_only=true` (query param o CLI) — ejecuta todas las queries como usuario Postgres de solo lectura.
- Superficie de riesgo: si el token se filtra, solo permite lectura del proyecto Supabase de Atlas (ya aislado de datos comerciales de MACD por decisión de Fase 1). Sin `read_only`, expondría escritura — **no activar** hasta que el equipo lo necesite y lo apruebe explícitamente.
- Encaje con `18_SECURITY`: el PAT vive en variable de entorno local (`.env` del usuario que corre Claude Code), referenciado en `.mcp.json` como `${SUPABASE_ACCESS_TOKEN}` (expansión de variables soportada nativamente — el placeholder es seguro de commitear, el valor real nunca). Coherente con la regla "credenciales nunca en chat/código/docs".

### Por qué NO filesystem MCP
Claude Code ya trae herramientas nativas (Read/Write/Edit/Glob/Grep) con su propio sistema de permisos (deny explícito sobre `.env`/`secrets/**` ya definido en `18_SECURITY`). Añadir el servidor MCP de referencia `filesystem` sería redundante y solo suma superficie de ataque sin beneficio — no se instala.

### Diferido a Fase 3 (regla del roadmap: no MT5/exchanges reales sin aprobación)
- **MT5 MCP** (`ariadng/metatrader-mcp-server`, `Qoyyuum/mcp-metatrader5-server`): requiere terminal Windows — infraestructura (VPS Windows) aún no decidida. Ver `00_FOUNDATION/03`.
- **Polymarket MCP**: comunitario, mantenimiento variable, ninguno oficial — evaluar actividad de repo concreto antes de depender de él.
- **MCP de exchange cripto genérico (ccxt-based)**: no hay estándar dominante; evaluar en Fase 3 junto con el motor de trading.
- **GitHub MCP**: no urgente — `git`/`gh` CLI vía Bash ya cubren las necesidades actuales de Claude Code; reconsiderar si el flujo de PRs/issues se vuelve pesado.

## Ventajas / desventajas / costes de este enfoque
- Ventaja: cero coste (ambos MCPs elegidos son gratuitos en el tier usado), cero credenciales de alto riesgo, arranque mínimo — cumple la regla "empezar por 1-2 MCPs probados, no 20 de golpe".
- Desventaja: no cubre aún necesidades de trading real (deliberado — corresponde a Fase 3 con aprobación explícita).

## Riesgos generales de MCP (aplican a cualquier servidor futuro)
El protocolo MCP no impone autenticación por defecto; un servidor mal configurado o expuesto en red es un vector de ataque. Los servidores de terceros (no oficiales) requieren verificar confianza antes de conectar — advertencia oficial de Claude Code.

## Mejores prácticas
Scope `local` para servidores personales sin secretos de equipo; scope `project` (`.mcp.json` versionado) solo cuando el secreto se referencia por variable de entorno, nunca en claro. Claude Code exige aprobación manual antes de usar servidores de scope `project` definidos en `.mcp.json` — no se salta ese gate.

## Sin confirmar
- Límite de rate del tier gratuito de CoinGecko MCP bajo uso sostenido — sin confirmar, revisar si Atlas empieza a hacer polling frecuente en Fase 3.
- Si el PAT de Supabase de solo lectura necesita rotación periódica — sin confirmar, pendiente de definir frecuencia junto con el resto de secretos (ver `18_SECURITY/00_RESUMEN.md`).

## Fuentes
Oficiales: `code.claude.com/docs/en/mcp` (Anthropic, confirmado), `docs.coingecko.com/docs/mcp-server` (CoinGecko, confirmado), `github.com/supabase-community/supabase-mcp` (Supabase, confirmado vía GitHub API 2026-07-02). Detalle en `01_DETALLE_MCPS_RECOMENDADOS.md`.
