# Skills — Fase 2

Estado: ✅ recomendación inicial (ninguna creada todavía en `.claude/skills/`, la carpeta existe vacía). Detalle técnico (frontmatter, plantillas): `01_DETALLE_SKILLS.md`.

Skills recomendadas, priorizadas. Ninguna se ha creado — quedan para aprobación de Moisés.

## 1. `nueva-investigacion` (prioridad más alta)
- **Dispara**: al iniciar investigación de una carpeta numerada nueva o pendiente (`⬜` en el índice maestro), manual (`/nueva-investigacion 04_MCP`) o cuando Claude detecta la petición ("investiga X para la carpeta NN").
- **Qué hace**: aplica la plantilla obligatoria (qué es / por qué / cuándo sí-no / ventajas-desventajas / riesgos / mejores prácticas / fuentes), delega la investigación pesada al subagente `researcher` (`context: fork`, `agent: researcher`) para no ensuciar el contexto principal, y escribe `00_RESUMEN.md` (+ detalle si hace falta).
- **Por qué skill y no prompt suelto**: es el mismo procedimiento repetido en las 26 carpetas del roadmap; como prompt suelto se reescribe (y degrada) cada vez, como skill la plantilla vive en un solo sitio versionado.

## 2. `pre-deploy-security-check`
- **Dispara**: manualmente antes de un `git push` a main o de un deploy a Vercel/VPS (`disable-model-invocation: true` — solo lo dispara el humano, no Claude por iniciativa propia, porque tiene efecto de gate antes de producción).
- **Qué hace**: invoca `security-reviewer` (`context: fork`) para escanear secretos hardcodeados, permisos MCP demasiado amplios y `.env` colado en el diff; sintetiza hallazgos críticos/bloqueantes.
- **Por qué skill y no solo un hook**: el hook (`PreToolUse` sobre `git push`) solo puede permitir/denegar de forma binaria y determinista; el skill orquesta un análisis más rico delegando a un subagente que razona sobre el contenido. Se complementan: hook = gate duro, skill = análisis previo.

## 3. `anadir-workflow-n8n-atlas`
- **Dispara**: al crear un workflow n8n nuevo en el VPS con prefijo `atlas_` (relevante desde ya para preparar Fase 5, aunque su ejecución completa es de 16_AUTOMATION).
- **Qué hace**: checklist fijo — nombrar con prefijo `atlas_`, usar credenciales del scope `svc-atlas-trading` (nunca `svc-macd-commercial`, ver `18_SECURITY/00_RESUMEN.md`), y registrar el workflow en `16_AUTOMATION`.
- **Por qué skill**: procedimiento con checklist que se repetirá en cada integración nueva; como skill evita que el aislamiento de credenciales documentado se olvide o se reinvente cada vez.

## 4. `actualizar-indice-maestro` (prioridad menor, posible fusión con #1)
- **Dispara**: tras cerrar cualquier carpeta con `00_RESUMEN.md` nuevo.
- **Qué hace**: relee el estado de las 26 carpetas y regenera la tabla de `00_FOUNDATION/00_INDICE_MAESTRO.md`.
- **Por qué skill**: mecánico y de bajo riesgo, se beneficia de `allowed-tools` acotado (solo Read+Edit sobre ese archivo). Nota: podría integrarse como paso final de `nueva-investigacion` en vez de ser independiente — decidir al implementar.

## Sin confirmar
Ninguno de los detalles de frontmatter usados arriba requiere marcarse así — están confirmados en la doc oficial (ver `01_DETALLE_SKILLS.md`). Sin confirmar: comportamiento exacto de `context: fork` combinado con `agent: researcher` (subagente custom, no built-in) en la práctica de este repo — no probado aún, solo documentado por la fuente oficial.

## Fuentes oficiales
code.claude.com/docs/en/skills (fetch directo, confirmado).
