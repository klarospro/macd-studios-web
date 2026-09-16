# Gestión de riesgo — Estrategia A (ICT IFVG en NQ)

Detalle técnico de `00_RESUMEN.md`. Coherente con `09_RISK` (preservación de capital > todo lo demás) y con el `riskGate.ts` real del motor, que NO se modifica.

## 1. Riesgo por operación
0,5% del capital (banda dada: 0,5–0,7%; se usa el extremo conservador, 0,5%, como default). Configurable vía `IctIfvgParams.riskPerTradePct`.

## 2. Sizing (contratos, no unidades continuas)
`riskGate.evaluate()` calcula un `size` continuo (`riskAmount / distancia_al_stop`), pensado para instrumentos tipo CFD/forex donde el tamaño de posición es una cantidad continua. **NQ se opera en CONTRATOS enteros**, con valor de $20 por punto por contrato (E-mini Nasdaq — dato de especificación pública, no verificado contra fuente oficial esta noche, ver `05_PREGUNTAS_ABIERTAS.md`).

`sizing.ts` NO modifica ni reemplaza el sizing del `riskGate` — añade una función pura adicional, `sizeContracts()`, que calcula directamente desde equity/riesgo%/distancia de stop en puntos/valor del punto, redondeando SIEMPRE hacia abajo (`Math.floor`) al entero de contratos más cercano. Redondear hacia abajo nunca excede el riesgo aprobado — es la dirección segura. Si el riesgo resultante no alcanza para 1 contrato completo, el resultado es 0 contratos (edge case cubierto en tests) y la señal se descarta (no se abre posición fraccionaria).

Ver `03_INTEGRACION_ENGINE.md` para cómo se concilian las dos nociones de "size" (la del `riskGate`, en unidades de precio, y la de `sizing.ts`, en contratos).

## 3. Stop
`max(1,5 × ATR(14) del 5M, distancia al swing high/low relevante)` — literalmente: se calculan las DOS distancias candidatas (ATR y swing estructural) y se usa la que queda **más lejos** del precio de entrada (el stop más ancho de los dos, no el más ajustado). Esto es lo que dice la spec ("el más lejano de los dos") y es coherente con la prioridad #1 del proyecto (preservación de capital: un stop demasiado ajustado se salta por ruido, como ya se documentó como causa estructural del NO-GO de Liquidity Grab en oro).

Si no hay ningún swing confirmado disponible en la ventana de datos (`relevantSwingStop` devuelve `null`), se usa solo el stop de ATR — documentado como fallback en el código, no silencioso.

## 4. Take-profit y break-even (gestión de posición, no vive en `riskGate.ts`)
- **TP1**: swing interno más cercano en la dirección de la operación (el primer swing HH/LL relevante entre el entry y el siguiente nivel). Al tocarlo: cierra el 50% de la posición y mueve el stop de la mitad restante a break-even (precio de entrada).
- **TP2**: el siguiente pool de liquidez externa (el swing MÁS ALEJADO después del usado como TP1, en la misma dirección). Al tocarlo: cierra el 50% restante.
- **Fallback documentado**: si no hay un segundo swing disponible para TP2 (dato insuficiente), el backtest cierra la mitad restante al final de la jornada de trading (no se inventa un nivel). Esto está marcado explícitamente en la salida del backtest (`outcome: "day_end_no_tp2"`), no se mezcla silenciosamente con un cierre por TP2 real.
- **Break-even**: se dispara en el MISMO nivel que TP1 (la spec dice "al romper el primer swing interno a favor", que es la misma definición usada para TP1).

**Importante — límite de la infraestructura actual**: `riskGate.ts` no modela objetivos ni cierres parciales (su tipo `Order`/`Position` no tiene campo de take-profit). `PaperAdapter` y `BacktestAdapter` cierran una posición completa de una sola vez. La gestión de TP1/TP2/break-even se implementa ENTERAMENTE en el runner de backtest (`ictIfvgBacktest.ts`), simulando el cierre parcial ajustando manualmente el `size`/`riskAmount` del objeto `Position` en memoria tras TP1 (sin tocar la clase `BacktestAdapter`). **Para llevar esto a vivo hace falta un componente de gestión de posición nuevo que hoy NO existe** (ver `03_INTEGRACION_ENGINE.md` y `05_PREGUNTAS_ABIERTAS.md`) — no se construyó esta noche por alcance (regla: solo funciones puras + no tocar `engine/` existente).

## 5. Límites operativos
- **Máximo 2 operaciones/día.** Aplicado en el loop del backtest (mismo patrón que `maxTradesPerDay` en `liquidityGrabBacktest.ts`), no dentro de las funciones puras de la estrategia.
- **Kill switch diario: -1% de capital.** Al alcanzar esa pérdida acumulada del día: se fuerza el cierre de cualquier posición abierta (motivo `daily_loss_kill_switch` en el audit log) y se bloquean nuevas entradas hasta el día siguiente.

**Relación con `riskGate.dailyDrawdownPct`**: el `riskGate` YA tiene un campo `dailyDrawdownPct` que bloquea nuevas entradas al superar el umbral (regla ya existente, reutilizada tal cual — se configura `dailyDrawdownPct: 0.01` en el `RiskConfig` pasado al backtest, sin tocar `riskGate.ts`). Pero el `riskGate` NO cierra posiciones abiertas por sí solo (solo veta nuevas). El cierre forzado de posiciones abiertas al llegar al -1% es lógica NUEVA en `ictIfvgBacktest.ts`, no en el motor.

## 6. Correlación
`correlationGroup` de la señal: `"nasdaq_index"` (para que el `PortfolioManager`, cuando se integre, no lo trate como no-correlacionado con otras estrategias sobre Nasdaq/tecnología si llegan a convivir en la misma cartera — ver `14_PORTFOLIOS`). No se activa `PortfolioManager` esta noche; la señal solo se probó contra `riskGate.evaluate()` directamente, igual que hacen los backtests existentes de Liquidity Grab y TSMOM.

## 7. Circuit breakers heredados del motor (sin cambios)
`maxConsecutiveLosses`, `maxBrokerErrors`, `totalDrawdownPct`, `maxAggregateRiskPct`, `maxConcurrentPositions` — se usan los valores de `defaultRiskConfig` salvo `riskPerTradePct` (0,005) y `dailyDrawdownPct`/`dailyDrawdownReducePct` (ajustados al -1% de la spec), igual que hace `runLiquidityGrab.ts` con su propio `SPEC_CONFIG`. **Nota heredada de `13_BACKTESTING/00_RESUMEN.md`**: con un win rate bajo (habitual en estrategias de ruptura/reversión intradía), el breaker de pérdidas consecutivas (default 4) puede parar el sistema a menudo — mismo aviso que ya existe para TSMOM, pendiente de decidir con Moisés si aplica aquí también.
