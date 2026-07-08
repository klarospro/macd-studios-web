# Detalle técnico — Subagentes (confirmado en code.claude.com/docs/en/sub-agents)

## Campos de frontmatter soportados (relevantes para Atlas AI)
Solo `name` y `description` son obligatorios.

| Campo | Uso en nuestros 3 agentes | Nota |
|---|---|---|
| `tools` | Todos lo usan como allowlist explícita | Si se omite, hereda TODAS las tools de la sesión principal — por eso es importante que los 3 lo declaren explícito. |
| `disallowedTools` | Ninguno lo usa | Alternativa a `tools`: denylist en vez de allowlist. Útil para "hereda todo menos Write/Edit". |
| `model` | Los 3 fijan `sonnet` | Alternativas: `opus` (más capaz, más caro), `haiku` (rápido/barato, para lookups simples), `inherit` (usa el modelo de la sesión principal). Orden de resolución: env var `CLAUDE_CODE_SUBAGENT_MODEL` > parámetro por invocación > frontmatter > modelo de la sesión principal. |
| `permissionMode` | Ninguno lo fija | Si el padre usa `bypassPermissions` o `acceptEdits`, el subagente lo hereda y NO puede anularlo aunque fije `permissionMode` propio. Riesgo latente si algún día se lanza una sesión con esos modos. |
| `hooks` | Ninguno lo usa hoy | Se pueden definir hooks (`PreToolUse`, `PostToolUse`, `Stop`→se convierte en `SubagentStop`) que solo corren mientras ese subagente está activo. Es el mecanismo recomendado para acotar `security-reviewer`. |
| `memory` | Ninguno lo usa | Daría memoria persistente entre sesiones (`~/.claude/agent-memory/<nombre>/` o `.claude/agent-memory/<nombre>/`). Podría ser útil a futuro para que `risk-architect` recuerde patrones de riesgo detectados, pero no es prioritario en Fase 2. |
| `isolation: worktree` | Ninguno lo usa | Da al subagente una copia aislada del repo en un git worktree. No aplica hoy porque ATLAS-AI no es un repo git (confirmado en este entorno). |

## Plantilla recomendada para acotar `security-reviewer` (documentación, no producción)
Patrón "db-reader" de la doc oficial, adaptado. Esto es una PROPUESTA para que Moisés apruebe — no se ha creado ningún archivo en `.claude/`:

```yaml
---
name: security-reviewer
description: Revisa credenciales, permisos, superficie de ataque y exposición de secretos antes de cualquier despliegue o conexión a cuentas reales/APIs de dinero. Úsalo antes de cada deploy a producción.
tools: Read, Grep, Glob, Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "${CLAUDE_PROJECT_DIR}/.claude/hooks/validate-readonly-bash.sh"
model: sonnet
---
```

El script `validate-readonly-bash.sh` (propuesto, NO creado) leería `tool_input.command` por stdin y saldría con exit code 2 si detecta verbos de escritura/borrado (`rm`, `mv`, `>`, `>>`, `cp -f` sobre destino fuera de tmp, etc.), siguiendo el mismo patrón que el ejemplo oficial de validación de SQL de solo lectura.

## Discovery de subagentes — detalle confirmado
- Se escanea `.claude/agents/` caminando desde el cwd hacia arriba hasta la raíz del repositorio (git). Si hay varios `.claude/agents/` en el camino con el mismo `name`, gana el más cercano al cwd.
- `--add-dir <ruta>` también carga el `.claude/agents/` de esa ruta añadida.
- Los subagentes se cargan al inicio de sesión; si se edita el archivo `.md` directamente en disco hace falta reiniciar sesión para que el cambio se recoja (a diferencia de crearlos vía `/agents`, que aplica al instante).
- Prioridad cuando hay nombres duplicados entre scopes: managed settings > `--agents` CLI > `.claude/agents/` (proyecto) > `~/.claude/agents/` (usuario) > plugin.

## Sin confirmar
- Comportamiento exacto del walk-up en Windows cuando el directorio no es un repositorio git formal (ATLAS-AI hoy no lo es, según verificación de este entorno) — la doc habla de "raíz del repositorio" sin aclarar el caso sin `.git`.
