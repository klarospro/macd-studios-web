# Hooks — Fase 2

Estado: ✅ set recomendado documentado, partiendo del hook ya existente `.claude/hooks/block-secret-writes.sh`. Detalle técnico (eventos, exit codes, JSON de ejemplo): `01_DETALLE_HOOKS.md`.

## Set de hooks recomendado

| # | Hook | Evento (matcher) | Qué bloquea | Por qué es regla innegociable (no convención) |
|---|---|---|---|---|
| 1 | `block-secret-writes.sh` (ya existe, refinar) | `PreToolUse` (`Write\|Edit`) | Escritura en `.env*`, `secrets/**`, `*credential*` | Convención = depende de que el modelo "se acuerde"; hook = determinista, exit code 2 garantiza el bloqueo con 0 tokens de modelo. |
| 2 | Ampliar patrón del hook 1 | mismo | Añadir `mt5`, `exchange`, `api[_-]?key`, `apikey`, `token`, `broker` al regex actual (`\.env\|secrets/\|credential`) | El pedido explícito del usuario ("credenciales MT5-exchanges") no está cubierto hoy por el patrón — solo cubre `.env`/`secrets`/`credential`. |
| 3 | `deny` de lectura en `settings.json` (ya existe) | Permisos, no hook | `.env*`, `secrets/**`, `**/credentials*` | Más fuerte que un hook: hace el archivo invisible a Claude directamente en vez de confiar en que se bloquee al intentar leerlo. |
| 4 | Bash-secret-guard (nuevo, recomendado) | `PreToolUse` (`Bash`) | Comandos que redirijan (`>`, `>>`, `tee`) hacia rutas de secretos/credenciales, o que vuelquen su contenido al output | El hook 1 solo cubre las tools `Write`/`Edit` — un `echo $KEY > .env` vía Bash lo esquiva por completo hoy. |
| 5 | Lint/format post-edición (nuevo, del roadmap) | `PostToolUse` (`Edit\|Write`, archivos `.ts/.tsx`) | No bloquea; corre linter/formatter automáticamente | Debe pasar SIEMPRE tras cada edición sin que el modelo decida si "hace falta" — determinista y sin coste de tokens de modelo. |
| 6 | Test/lint gate antes de commit (nuevo, del roadmap) | `PreToolUse` (`Bash`, `if: "Bash(git commit:*)"`) | Bloquea el commit si falla el test suite/lint | El CLAUDE.md raíz de ATLAS-AI lo pide explícito ("lint/test antes de commit"); sin el hook, depende de que el modelo se acuerde de correrlo. |
| 7 | `PreCompact` backup (ya recomendado en 00_FOUNDATION/02, no implementado) | `PreCompact` | No bloquea; guarda snapshot del transcript antes de comprimir | Prioridad menor (continuidad/auditoría, no seguridad de secretos) — útil en investigaciones largas de `researcher`. |

## Hallazgo técnico confirmado (ajuste al hook existente)
El `command` del hook 1 en `settings.json` usa ruta relativa: `./.claude/hooks/block-secret-writes.sh`. La doc oficial confirma que los hooks se ejecutan con el **cwd que tenga Claude Code en ese momento**, no necesariamente la raíz del proyecto. Si `claude` se lanza desde una subcarpeta, esa ruta relativa puede no resolver. Recomendado: usar el placeholder oficial `${CLAUDE_PROJECT_DIR}/.claude/hooks/block-secret-writes.sh`, que sí resuelve siempre a la raíz del proyecto.

## Nota de entorno (Windows)
El hook actual es un script `.sh`. La doc oficial documenta soporte específico para hooks en PowerShell (`shell: powershell` en la entrada del hook) para Windows. **Sin confirmar**: si `block-secret-writes.sh` se ejecuta hoy correctamente en Windows sin depender de Git Bash instalado — si el entorno de destino no garantiza Git Bash, más robusto reescribirlo como `.ps1` con `shell: powershell`.

## Sin confirmar
- Comportamiento exacto de deduplicación/paralelismo de hooks en Windows.
- Si el `if` condicional (ej. `"if": "Bash(git commit:*)"`) filtra igual de fiable en PowerShell que en bash — no verificado en este repo, solo documentado por la fuente oficial genérica.

## Fuentes oficiales
code.claude.com/docs/en/hooks (fetch directo, confirmado).
