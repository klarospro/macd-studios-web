# Integración con el motor — Estrategia A (ICT IFVG en NQ)

Cómo se enchufa el código nuevo al `engine/` existente, y qué NO se modificó.

## 0. Nota sobre rutas: la spec pedía `engine/strategies/...` y `engine/domain/...`
La tarea nocturna especificaba rutas tipo `engine/domain/types.ts` y `engine/strategies/ictIfvg/index.ts` con tests en `__tests__/`. El `engine/` real usa `engine/src/...` (con `src/`) y las estrategias existentes (`liquidityGrab.ts`, `tsmom.ts`, `atlasCore.ts`) son archivos planos en `engine/src/strategy/` con sus tests CO-UBICADOS como `*.test.ts` en la misma carpeta — no hay ninguna carpeta `__tests__/` en todo el repo. La regla dura #5 dice explícitamente "sigue el patrón existente", así que se priorizó ESO sobre las rutas literales del encargo. Todo el código nuevo vive en:

```
engine/src/strategy/ictIfvg/       (funciones puras de la estrategia)
  types.ts / bias.ts / bias.test.ts
  ifvg.ts / ifvg.test.ts
  atr.ts / atr.test.ts
  sizing.ts / sizing.test.ts
  session.ts / session.test.ts
  smt.ts
  index.ts

engine/src/backtest/               (igual que liquidityGrab: estrategia y backtest en carpetas separadas)
  ictIfvgBacktest.ts                (loop de backtest + métricas)
  runIctIfvg.ts                     (CLI runner, lee CSV, imprime resultados)
```

Ningún archivo existente de `engine/` fue modificado (confirmar con `git status` — regla dura #5 y #2).

## 1. `riskGate.ts` (NO modificado)
`findIctIfvgSignal()` (en `index.ts`) produce un `Signal` estándar (`{ symbol, side, entryPrice, stopPrice, correlationGroup }`), exactamente la misma forma que usan `liquidityGrabSignal` y `tsmomSignal`. El backtest (`ictIfvgBacktest.ts`) llama a `evaluate(config, account, signal)` tal cual — la MISMA función que ya usan los otros dos backtests y que usaría el ciclo en vivo. El `riskGate` decide aprobar/rechazar y calcula el `size` (continuo, ver §3) exactamente igual que para cualquier otra estrategia.

## 2. `auditLog.ts` (NO modificado, no conectado todavía)
El tipo `AuditEvent` ya cubre `order_placed`/`order_rejected`/`order_failed`/`position_closed` — genérico, no necesita cambios para esta estrategia. El backtest de esta noche NO instancia un `AuditLog` (igual que `liquidityGrabBacktest.ts`, que tampoco lo hace — el patrón existente solo audita en el ciclo EN VIVO, `engine/src/live/dailyCycle.ts`, no en los backtests). Cuando esta estrategia pase a demo, se conectará al `ConsoleAuditLog`/Supabase existente sin cambios — es responsabilidad del ciclo en vivo, no de la estrategia.

## 3. `PaperAdapter.ts` / `BrokerAdapter.ts` (NO modificados)
No se tocaron. El backtest usa `BacktestAdapter` (ya existente, `engine/src/backtest/backtestAdapter.ts`) exactamente como `liquidityGrabBacktest.ts`.

## 4. El problema real: `riskGate`/`BacktestAdapter` no modelan TP1/TP2/break-even
Esto es lo más importante de esta sección.

- `riskGate.evaluate()` solo gatea la ENTRADA (calcula `size` y aprueba/rechaza). No conoce objetivos.
- `Position`/`Order` (en `domain/types.ts`) no tienen campo de take-profit ni de cierre parcial.
- `BacktestAdapter.closePosition(id)` cierra TODA la posición de una vez, calculando el PnL con el `size` guardado en el `Position`.

Para simular TP1 (cierre del 50%) + break-even + TP2 (cierre del resto) **sin tocar ninguno de esos archivos**, `ictIfvgBacktest.ts` hace lo siguiente (ver el código para el detalle exacto):
1. Abre la posición completa vía `adapter.placeOrder()` (fill real del riskGate).
2. Al tocar TP1: calcula manualmente el PnL de la mitad usando el precio actual y `position.entryPrice`, lo suma al equity con `adapter.charge(-pnl)` (método público ya existente — `charge` resta, así que se pasa el valor negado para sumar), y MUTA los campos `size`/`riskAmount` del objeto `Position` en memoria (el adapter expone la referencia real vía `openPositions`, no una copia — no hace falta tocar la clase).
3. La segunda mitad se cierra normalmente con `adapter.closePosition()`, que ahora calcula el PnL correcto porque `position.size` ya quedó reducido al 50%.

Esto es una solución de backtest, no de motor. **Para operar esto en vivo hace falta un componente de gestión de posición nuevo que hoy NO existe** en `engine/src/live/` (el `dailyCycle.ts` actual dispara UNA orden por señal y no vuelve a tocarla hasta cerrarla del todo). Construirlo no entraba en el alcance de esta noche (regla: solo funciones puras + no tocar `engine/` existente) — es el primer TODO de infraestructura para cuando esta estrategia pase de backtest a demo. Ver `05_PREGUNTAS_ABIERTAS.md`.

## 5. Sizing: contratos (NQ) vs. `size` continuo del riskGate
`riskGate.evaluate()` calcula `size = riskAmount / distancia_de_stop_en_precio` — una cantidad continua, correcta para CFD/forex donde el PnL es `size × movimiento_de_precio`. Para NQ (futuros, contratos enteros, $20/punto), la conversión es:

```
contratos_equivalentes = size_del_riskGate / pointValue
```

`sizing.ts` NO hace esta conversión automáticamente (para no adivinar qué querría Moisés) — expone `sizeContracts()` como una función independiente y pura que calcula contratos enteros directamente desde `equity/riskPct/stopPoints/pointValue`, redondeando siempre hacia abajo. El backtest de esta noche usa el `size` continuo del riskGate tal cual (igual que los otros backtests) — **no convierte a contratos enteros dentro del backtest**, así que los números de PnL en USD del backtest son "como si" el instrumento permitiera tamaño fraccionario. Esto es una simplificación declarada: para que el backtest refleje contratos enteros reales (y el efecto de redondeo, que puede ser significativo con capital pequeño — ver los tests de `sizing.test.ts` dones 250 USD de riesgo dan 0 contratos), haría falta enchufar `sizeContracts()` dentro del loop del backtest. **No se hizo esta noche** — ver TODO en `05_PREGUNTAS_ABIERTAS.md`. Es una limitación conocida y documentada, no un descuido.

## 6. `PortfolioManager` (14_PORTFOLIOS) — no conectado
La señal lleva `correlationGroup: "nasdaq_index"` para que, cuando esta estrategia conviva con otras (TSMOM, scalping ya documentado en `27_SCALPING`), el `PortfolioManager` la trate como correlacionada. No se instanció `PortfolioManager` en el backtest de esta noche — se probó contra `riskGate.evaluate()` directamente, igual que `runLiquidityGrab.ts` y los runners de TSMOM.

## 7. `.claude/agents/` — subagentes disponibles no usados esta noche
La tarea se ejecutó en la sesión principal sin delegar a `researcher`/`risk-architect`/`security-reviewer` (la instrucción nocturna daba parámetros ya decididos por Moisés, no había investigación nueva que hacer, y no se toca ninguna credencial ni deploy). Cuando esta estrategia pase a revisión de riesgo antes de demo, corresponde invocar `risk-architect` sobre `02_GESTION_RIESGO.md` — ver recomendación en `NOCHE_REPORTE.md`.
