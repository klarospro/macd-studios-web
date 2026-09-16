# Estrategia A — ICT IFVG en NQ (investigación + construcción, sin fondeo)

Estado: 🟡 construida y con PRIMER backtest real corrido (misma noche, sesión posterior — ver `06_VALIDACION_NQ_YAHOO.md`). Datos reales de NQ vía Yahoo Finance (`NQ=F`), aprobados explícitamente por Moisés. Resultado: edge crudo positivo (PF 1,52-1,81 según coste) pero **muestra insuficiente (19 operaciones, 71 días) y walk-forward inestable** — veredicto: **NI GO NI NO-GO todavía, NO conectar demo/real**. No se ha tocado fondeo (Apex/Lucid/Tradovate) ni ninguna cuenta. Detalle completo: `01_REGLAS_ENTRADA.md`, `02_GESTION_RIESGO.md`, `03_INTEGRACION_ENGINE.md`, `04_PLAN_BACKTEST.md`, `05_PREGUNTAS_ABIERTAS.md`, `06_VALIDACION_NQ_YAHOO.md`.

## Qué es / por qué existe
Estrategia intradía basada en modelo ICT (Inner Circle Trader): Daily Bias por estructura (HH/HL vs LL/LH) en 1D+4H, entrada en el primer IFVG (Inversed Fair Value Gap) válido a favor del bias dentro de una ventana horaria estrecha (9:30–10:10 NY) en NQ (E-mini Nasdaq) 5M. Es la "Estrategia A" del encargo de Moisés — construcción completa (documentación + código + tests + runner de backtest) ANTES de conectar ningún dato real o cuenta, cumpliendo la regla de oro del proyecto (no se opera nada sin edge documentado).

## Parámetros de la especificación (dados por Moisés, no inventados)

| Parámetro | Valor |
|---|---|
| Instrumento | NQ (E-mini Nasdaq), entrada 5M, bias 1D+4H |
| Ventana | 9:30–10:10 NY (primera sesión IFVG) |
| Daily Bias | HH/HL en 1D+4H = UP · LL/LH = DOWN · sin estructura clara = skip día |
| IFVG mínimo | 3–5 puntos NQ, validado por CIERRE de cuerpo (no wick) |
| Filtro de sesión | Solo el PRIMER IFVG válido a favor del bias |
| Confluencia SMT | Opcional en v1 (NQ vs ES, swing 5–8) — construida, no activada por defecto |
| Confluencia POI | Opcional en v1 (Order Block 4H/1D, 50% retracement) — **no construida**, ver preguntas abiertas |
| Riesgo/operación | 0,5% capital (banda 0,5–0,7%, se usa el conservador) |
| Máx. operaciones/día | 2 |
| Kill switch diario | -1% capital → cierra posiciones y detiene entradas |
| Stop | 1,5×ATR(14) 5M o swing relevante, el que quede MÁS LEJOS del entry |
| TP1 | Swing interno más cercano → cierra 50%, mueve stop a break-even |
| TP2 | Siguiente pool de liquidez externa → cierra el resto |
| Break-even | Al romper el primer swing interno a favor (mismo nivel que TP1) |

## Interpretaciones declaradas (donde la spec es ambigua — ver `05_PREGUNTAS_ABIERTAS.md` para el detalle completo)
- **Definición de IFVG usada**: FVG de 3 velas (hueco entre `candles[i-2]` y `candles[i]`) que luego se "invierte" cuando una vela POSTERIOR cierra (precio de cierre, no mecha) más allá del lado contrario del hueco. La entrada usada es el CIERRE de esa vela de inversión — no se implementó lógica de "retest" al volver a la zona, por ser un supuesto adicional no especificado. **Esto es lo más importante a confirmar con Moisés.**
- **Combinación 1D+4H del bias**: se exige que 1D Y 4H den el MISMO bias (HH/HL o LL/LH); si difieren o cualquiera de los dos no tiene estructura clara → skip día (no hay regla de prioridad en la spec).
- **Gap mínimo**: se usó 3 puntos (el extremo más permisivo del rango 3–5 dado), configurable.
- **Swing SMT**: se usó 6 (punto medio del rango 5–8 dado), configurable.
- **NQ point value**: $20/punto por contrato — dato de especificación pública de CME, NO verificado contra fuente oficial esta noche (regla dura: sin navegador). Marcado TODO.

## Estado de construcción
- ✅ FASE 1 — Documentación completa (esta carpeta).
- ✅ FASE 2 — Código TypeScript puro en `engine/src/strategy/ictIfvg/` (bias, ifvg, atr, sizing, session, smt, types, index). Ninguna función con efectos secundarios; nada de `engine/` existente modificado.
- ✅ FASE 3 — Tests unitarios (ver recuento exacto y resultado en `NOCHE_REPORTE.md`).
- ✅ FASE 4 — Runner de backtest completo (`ictIfvgBacktest.ts` + `runIctIfvg.ts` + `runIctIfvgDeepValidation.ts`). **Corrido con datos reales** de NQ (Yahoo Finance, aprobado explícitamente por Moisés en la sesión de la misma noche) tras encontrar y corregir un bug de lookahead que daba 0 operaciones (ver `06_VALIDACION_NQ_YAHOO.md` §0).
- 🟡 Backtest con datos reales HECHO, pero **veredicto NI GO NI NO-GO**: edge crudo positivo, muestra insuficiente (19 ops/71 días) y walk-forward inestable. Ver `06_VALIDACION_NQ_YAHOO.md` para el detalle completo y la recomendación de NO conectar demo/real todavía.
- ⬜ Fondeo (Apex/Lucid/Tradovate): fuera de alcance, sin tocar.

## Cuándo usar / cuándo NO
- Esto NO es una estrategia validada. Es la estructura completa lista para correr en cuanto haya datos reales de NQ 5M (y 1D/4H, y opcionalmente ES 5M para SMT).
- NO conectar a demo/real sin: (1) backtest con datos reales y walk-forward, (2) revisión de `risk-architect`, (3) aprobación explícita de Moisés — misma regla que TSMOM y Liquidity Grab en `13_BACKTESTING`.

## Riesgos y avisos clave
- La definición de IFVG y el punto de entrada exacto son una interpretación propia sobre una spec ambigua (como ya pasó con Liquidity Grab en `27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md` — ahí una única suposición cambió el resultado de -61,7% a +236%). Aquí puede pasar lo mismo con la definición de "cierre de cuerpo" o el punto de entrada tras la inversión. **No confiar en ningún backtest futuro de esta estrategia sin que Moisés confirme la definición exacta de IFVG que tiene en mente.**
- La gestión de TP1/TP2/break-even con cierre parcial (50%/50%) NO tiene equivalente nativo en `riskGate.ts` (que solo gatea la entrada, no conoce objetivos ni cierres parciales) ni en `PaperAdapter`/`BacktestAdapter` (que cierran la posición completa de una vez). El backtest la simula manualmente sin tocar esos archivos (ver `03_INTEGRACION_ENGINE.md`); la ejecución en vivo necesitará un motor de gestión de posición nuevo — no existe hoy.

## Fuentes
Parámetros de la estrategia: dados directamente por Moisés en el encargo (no investigados, no verificados contra fuente externa — regla dura sin navegador esta noche). Patrón de motor/riskGate/auditoría: código real existente en `engine/`. NQ point value ($20/pt): conocimiento general de especificación de contrato CME, sin verificar esta noche — ver TODO en `05_PREGUNTAS_ABIERTAS.md`.
