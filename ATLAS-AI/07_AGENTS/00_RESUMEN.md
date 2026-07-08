# Subagentes — Fase 2

Estado: ✅ evaluados los 3 subagentes existentes en `.claude/agents/`. Detalle técnico completo (frontmatter, discovery, ejemplos): `01_DETALLE_SUBAGENTES.md`.

## Veredicto de los 3 subagentes existentes

| Subagente | Tools | Model | Veredicto |
|---|---|---|---|
| `researcher` | Read, Grep, Glob, WebFetch, WebSearch, Write | sonnet | Correcto y suficiente para Fase 2. Sin `Edit`/`Bash` = no puede tocar código de producción, alineado con su descripción. `Write` está justificado (guarda `00_RESUMEN.md`). |
| `risk-architect` | Read, Grep, Glob, WebSearch, Write | sonnet | Correcto. Sin `Bash`/`Edit` = no puede tocar el motor de trading directamente, coherente con "diseña antes de que se implemente". |
| `security-reviewer` | Read, Grep, Glob, Bash | sonnet | Funcional pero con un riesgo real: `Bash` **no es de solo lectura** — permite `rm`, `mv`, redirección de escritura (`>`), a diferencia de las restricciones que sí aplica el campo `tools` sobre `Write`/`Edit`. Recomendado acotarlo (ver abajo). |

## Ajustes recomendados (no bloqueantes, para aprobación)
- **`security-reviewer`**: añadir un hook `PreToolUse` (matcher `Bash`) en el propio frontmatter del agente que valide `tool_input.command` y bloquee (exit 2) cualquier comando de escritura/borrado, dejando solo lectura (`grep`, `find`, `ls`, `git log`, `cat`). Es el mismo patrón que el ejemplo oficial "db-reader". Ver plantilla en `01_DETALLE_SUBAGENTES.md`.
- Ninguno de los 3 declara `Agent` en `tools`, así que ya tienen bloqueado por defecto el poder invocar sub-subagentes (confirmado: si `Agent` no está en `tools`, el subagente no puede spawnear otros). No requiere cambio.
- Ninguno fija `permissionMode` explícito — hoy no es un problema porque el `settings.json` del proyecto no usa `bypassPermissions`/`acceptEdits`, pero si algún día se lanzara una sesión así, los subagentes lo heredarían sin poder anularlo (confirmado en doc oficial). Documentar como riesgo latente, no urgente.

## ¿Falta algún subagente para Fase 2/3?
No es necesario crear uno nuevo todavía. `researcher` ya cubre evaluación de MCPs (04_MCP, Fase 2) y `risk-architect` ya cubre position sizing/riesgo (09_RISK, Fase 3). Revisar en Fase 3 si el volumen de vetting de MCPs de trading/exchange (11_MT5, 12_EXCHANGES) crece lo suficiente para justificar un `mcp-vetter` dedicado — hoy sería duplicar a `researcher`.

## Problema operativo: discovery según directorio de lanzamiento (matizado)
La doc oficial confirma que **no es "solo desde la raíz"**, es más preciso: los subagentes de proyecto se descubren **caminando hacia arriba desde el cwd hasta la raíz del repositorio**, escaneando cada `.claude/agents/` en ese camino.
- Lanzar `claude` desde **cualquier subcarpeta dentro de `ATLAS-AI/`** (ej. `02_ARCHITECTURE/`) sí encuentra los 3 subagentes.
- El problema real persiste si `claude` se lanza **fuera** del árbol de `ATLAS-AI` (ej. desde `C:\MACD-STUDIOS`): no hay ruta ascendente que llegue a `ATLAS-AI/.claude/agents/`, así que esos 3 subagentes no están disponibles ahí.
- Mitigación confirmada: `--add-dir <ruta-a-ATLAS-AI>` sí carga su `.claude/agents/`. Alternativa de subagentes a nivel usuario (`~/.claude/agents/`) rompería el aislamiento MACD comercial vs Atlas trading ya definido en `18_SECURITY` — no recomendado.
- Acción sugerida (pendiente de aprobación, no ejecutada): anotar en el README o CLAUDE.md raíz de ATLAS-AI que `claude` debe lanzarse desde dentro del árbol del proyecto.

## Sin confirmar
- Si en la práctica (Windows/PowerShell) el walk-up de discovery se comporta igual que en macOS/Linux — la doc no distingue por SO para este punto.

## Fuentes oficiales
code.claude.com/docs/en/sub-agents (fetch directo, confirmado).
