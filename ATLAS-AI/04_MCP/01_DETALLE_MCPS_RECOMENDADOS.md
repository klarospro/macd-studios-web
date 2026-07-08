# Detalle — configuración de los MCPs recomendados (Fase 2)

Complementa `00_RESUMEN.md`. No instala nada — solo documenta la configuración propuesta para aprobación humana.

## Scopes de Claude Code (referencia oficial)

| Scope | Se carga en | Compartido con equipo | Se guarda en |
|---|---|---|---|
| `local` (por defecto) | Solo el proyecto actual | No | `~/.claude.json` |
| `project` | Solo el proyecto actual | Sí, vía control de versiones | `.mcp.json` en la raíz del repo |
| `user` | Todos los proyectos | No | `~/.claude.json` |

Los servidores `project` (definidos en `.mcp.json`) requieren **aprobación manual** la primera vez que se usan en una sesión interactiva (`claude mcp list` los muestra como `⏸ Pending approval` hasta aprobarlos). Este gate es intencional — no confiar ciegamente en un `.mcp.json` heredado de un clon del repo.

Expansión de variables de entorno en `.mcp.json`: los campos `command`, `args`, `env`, `url` y `headers` soportan `${VAR}` — el valor real vive fuera del repo (shell env / `.env` local), el archivo versionado solo contiene el placeholder.

## 1. CoinGecko MCP

Instalación propuesta (scope local, sin credenciales):

```
claude mcp add --transport http coingecko https://mcp.api.coingecko.com/mcp
```

- Transporte: Streamable HTTP (recomendado por CoinGecko sobre el SSE legacy `/sse`).
- Tier gratuito ("keyless"): rate limit compartido, sin autenticación. Si en el futuro se necesita más cuota, existe tier de pago con API key — **no activar sin justificación de volumen real**.
- Cobertura: precios/market cap/volumen en tiempo real (actualización cada pocos minutos), datos históricos, exchanges, DeFi, NFTs, tendencias — más que suficiente para investigación de Fase 3 (backtesting, diseño de motor de trading) sin comprometer nada a producción todavía.

Fuente: `docs.coingecko.com/docs/mcp-server` (oficial, confirmado).

## 2. Supabase MCP (modo solo lectura)

Instalación propuesta (scope project, token vía variable de entorno):

`.mcp.json` (versionable — no contiene el secreto):
```json
{
  "mcpServers": {
    "supabase-atlas": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>&read_only=true",
      "headers": {
        "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

- `read_only=true` es obligatorio mientras no haya aprobación explícita para permitir escritura vía MCP — ejecuta todo como usuario Postgres de solo lectura.
- `SUPABASE_ACCESS_TOKEN`: Personal Access Token de Supabase, generado con el mínimo alcance necesario (idealmente scoped al proyecto Atlas, no a toda la organización si Supabase lo permite — **sin confirmar** si Supabase soporta PATs scoped por proyecto).
- El token se guarda en el `.env` local del usuario que ejecuta Claude Code (o en `~/.claude.json` si se usa scope `local`/`user` en vez de `project`), nunca en el repo. Coherente con `18_SECURITY/00_RESUMEN.md` — mismo patrón que el resto de secretos del proyecto (permisos restringidos, propiedad del usuario de servicio correspondiente).
- Repo: `github.com/supabase-community/supabase-mcp` — 2.778 estrellas, último push 2026-06-30, no archivado (verificado vía GitHub API el 2026-07-02). Mantenido por la organización Supabase, no un tercero.

## Filesystem MCP — por qué se descarta

El servidor de referencia `@modelcontextprotocol/server-filesystem` expone `read_file`/`write_file`/`list_directory` etc. Claude Code ya tiene Read/Write/Edit/Glob/Grep nativos que hacen lo mismo, con el sistema de permisos de `settings.json` (deny sobre `.env*`/`secrets/**`) ya aplicándose directamente. Instalar el MCP añadiría una segunda vía de acceso a archivos que **no** hereda automáticamente esos `deny` a menos que se configuren aparte — más superficie, cero beneficio funcional. No se recomienda salvo caso de uso muy específico no cubierto por las herramientas nativas (ninguno identificado hoy).

## Candidatos evaluados y diferidos (Fase 3)

| MCP | Repo/fuente | Por qué se difiere |
|---|---|---|
| MT5 (`ariadng/metatrader-mcp-server`) | Comunidad, no oficial | Requiere terminal Windows; VPS Windows aún no decidido (`00_FOUNDATION/03`) |
| Polymarket (`whitmorelabs/polymarket-mcp`, otros) | Comunidad, no oficial | Mantenimiento variable — revisar actividad del repo concreto elegido antes de depender de él |
| Exchange cripto genérico (ccxt) | Sin estándar dominante identificado | Evaluar junto con el diseño del motor de trading en Fase 3 |
| GitHub MCP oficial (`github/github-mcp-server`) | Oficial de GitHub, bien mantenido | No urgente hoy — `git`/`gh` CLI cubren el flujo actual; reconsiderar si aumenta el trabajo con PRs/issues |

## Sin confirmar
- Si Supabase permite PATs con alcance limitado a un solo proyecto (relevante para minimizar el radio de exposición del token del MCP).
- Rate limit exacto del tier gratuito de CoinGecko MCP bajo uso sostenido de Claude Code.
- Política de rotación del `SUPABASE_ACCESS_TOKEN` — pendiente junto con el resto de secretos (ver `18_SECURITY`).

## Fuentes
`code.claude.com/docs/en/mcp` (Anthropic, oficial) · `docs.coingecko.com/docs/mcp-server` (CoinGecko, oficial) · `github.com/supabase-community/supabase-mcp` (Supabase, oficial) · `supabase.com/docs/guides/ai-tools/mcp` (Supabase, oficial).
