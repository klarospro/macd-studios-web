# Detalle técnico — Skills (confirmado en code.claude.com/docs/en/skills)

## Campos de frontmatter relevantes para las 4 skills propuestas

| Campo | Uso propuesto | Nota |
|---|---|---|
| `description` | Todas | Crítico: Claude decide si invocar la skill según esto. Poner el caso de uso principal primero (se trunca a 1536 caracteres en el listado). |
| `disable-model-invocation: true` | `pre-deploy-security-check`, `anadir-workflow-n8n-atlas` (opcional) | Solo el humano puede invocarla con `/nombre`; Claude no la dispara por iniciativa propia. Correcto para acciones con efecto en producción/dinero real. |
| `context: fork` | `nueva-investigacion`, `pre-deploy-security-check` | Corre en un subagente aislado; el contenido de la skill se convierte en el prompt del subagente. No ve el historial de la conversación principal. |
| `agent` | `nueva-investigacion` → `researcher`; `pre-deploy-security-check` → `security-reviewer` | Especifica qué subagente ejecuta el fork. Si se omite, usa `general-purpose`. |
| `allowed-tools` | `actualizar-indice-maestro` (acotar a `Read`, `Edit` sobre el índice) | Pre-aprueba tools sin pedir permiso cada vez mientras la skill está activa; no restringe, solo pre-autoriza. |
| `arguments` / `$ARGUMENTS` | `nueva-investigacion $carpeta` | Permite pasar la carpeta objetivo como argumento posicional (`/nueva-investigacion 04_MCP`). |

## Plantilla ilustrativa de `nueva-investigacion` (documentación, NO creada en `.claude/`)

```yaml
---
name: nueva-investigacion
description: Investiga un tema para una carpeta numerada de ATLAS-AI y documenta el 00_RESUMEN.md siguiendo la plantilla obligatoria del proyecto. Usar al empezar cualquier carpeta marcada pendiente en el indice maestro.
context: fork
agent: researcher
arguments: [carpeta, tema]
---

Investiga "$tema" para la carpeta $carpeta de ATLAS-AI.
Sigue la plantilla obligatoria (que es / por que existe / cuando usarlo /
cuando NO / ventajas / desventajas / riesgos / mejores practicas / fuentes
oficiales). Marca "sin confirmar" lo que no tenga fuente solida. Escribe
NN_CARPETA/00_RESUMEN.md (max 1 pagina) + detalle aparte si hace falta.
```

## Diferencia clave entre `context: fork` en una skill vs `skills:` en un subagente
Confirmado por la doc oficial — son direcciones opuestas del mismo mecanismo:

| Enfoque | System prompt | Tarea | También carga |
|---|---|---|---|
| Skill con `context: fork` | Del tipo de agente (`agent:`) | El contenido del SKILL.md | CLAUDE.md, salvo que el agente sea Explore/Plan |
| Subagente con campo `skills:` | El cuerpo markdown del subagente | El mensaje de delegación de Claude | Skills precargadas + CLAUDE.md |

Para `nueva-investigacion` usamos el primer enfoque: la skill define la tarea concreta, y `researcher` (ya existente) aporta el system prompt y las tools.

## Sin confirmar
- Rendimiento/latencia real de encadenar `context: fork` + `agent: researcher` con `WebFetch`/`WebSearch` en investigaciones largas — no medido en este repo, solo documentado como posible por la fuente oficial.
