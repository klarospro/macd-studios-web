# Detalle técnico — Hooks (confirmado en code.claude.com/docs/en/hooks)

## Eventos relevantes para el set recomendado

| Evento | Cuándo dispara | ¿Puede bloquear (exit 2)? |
|---|---|---|
| `PreToolUse` | Antes de que se ejecute una llamada a herramienta | Sí — impide la llamada |
| `PostToolUse` | Después de que una llamada a herramienta tuvo éxito | No bloquea; stderr se muestra a Claude como error |
| `PreCompact` | Antes de comprimir el contexto | Sí — impide la compactación |
| `SessionStart` | Al iniciar/reanudar sesión | No aplica a bloqueo |
| `Stop` / `SubagentStop` | Cuando Claude/un subagente termina de responder | Sí — impide que pare |

## Exit codes (confirmado)
- **Exit 0**: éxito. Si hay JSON en stdout, se procesa (permite control fino vía `hookSpecificOutput`/`decision`).
- **Exit 2**: bloquea la acción en eventos bloqueables (`PreToolUse`, `PreCompact`, `Stop`, etc.). El mensaje de `stderr` se le muestra a Claude como razón del bloqueo. Es el exit code que ya usa `block-secret-writes.sh` — correcto.
- **Cualquier otro exit code**: error no bloqueante; la ejecución continúa, se registra en el log de debug.

## Formato de configuración en `settings.json` (ya usado correctamente por el hook existente)
Anidación de 3 niveles: evento → grupo con `matcher` → lista de handlers.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/bash-secret-guard.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- `${CLAUDE_PROJECT_DIR}` resuelve siempre a la raíz del proyecto, independientemente del cwd desde el que se lanzó `claude` — corrige el problema de la ruta relativa `./...` usada hoy en el hook 1.
- El campo `if` permite condicionar el hook a un patrón de permiso concreto sin tener que parsear todo dentro del script, ej. `"if": "Bash(git commit:*)"` para el hook de test/lint-gate (hook #6 del resumen).

## Matcher patterns (confirmado)
- `"*"`, `""` u omitido = coincide con todo.
- Solo alfanumérico/`_`/`-`/espacios/`,`/`|` = coincidencia exacta o lista (`Edit|Write`, `Bash`).
- Cualquier otro carácter = regex sin anclar (ej. `^Notebook`, `mcp__.*__write.*`).
- Para `PreToolUse`/`PostToolUse` el matcher compara contra el **nombre de la tool** (`Bash`, `Edit`, `Write`, `mcp__servidor__tool`).

## Propuesta de patrón ampliado para `block-secret-writes.sh` (documentación, NO editado en `.claude/`)
El regex actual es `\.env|secrets/|credential`. Propuesta de ampliación para cubrir el pedido explícito del usuario ("credenciales MT5-exchanges"):

```
\.env|secrets/|credential|mt5|exchange|api[_-]?key|apikey|token|broker
```

A revisar con Moisés: este patrón amplio puede generar falsos positivos (ej. un archivo legítimo `exchange-rate-utils.ts`). Alternativa más segura: mantener el matching por **ruta** (`secrets/`, `**/credentials*`, `**/*mt5*`, `**/*exchange*keys*`) en vez de por substring libre, para reducir falsos positivos.

## Nota Windows / PowerShell
Doc oficial confirma soporte de hooks en PowerShell añadiendo `"shell": "powershell"` en la entrada del hook, para que el `command` se interprete con PowerShell en vez de `sh -c`. Relevante porque el entorno de Moisés es Windows con PowerShell como shell primario (Bash tool disponible vía Git Bash, según configuración de este entorno). **Sin confirmar**: si el VPS Hetzner (Linux) donde corre n8n también ejecutará Claude Code — si es así, el `.sh` actual es correcto ahí; si Claude Code se usa principalmente desde el Windows local de Moisés, migrar a `.ps1` sería más robusto y no depender de que Git Bash esté instalado.

## Sin confirmar
- Comportamiento exacto de deduplicación y ejecución en paralelo de hooks múltiples en Windows.
- Si el test suite del proyecto (aún no definido — Next.js 15 / TS) ya tiene un comando único invocable desde un hook `PreToolUse` de `git commit` (hook #6) — pendiente de que exista la infraestructura de testing (carpeta `21_TESTING`, Fase 6).
