# Scalping (riesgo medio) conviviendo con TSMOM — resumen (Fase 3/4, diseño)

Estado: **DISEÑO, BLOQUEANTE hasta aprobación de Moisés** — no hay código de producción de scalping. Ninguna operación real hasta validar en demo (ver §7). Este documento es una ADENDA de `00_RESUMEN.md` (reglas núcleo, ya aprobadas 2026-07-02): no las sustituye, añade un segundo motor con su propio sub-presupuesto dentro del mismo techo agregado ya existente. Detalle completo (fórmulas, pseudocódigo, brechas de código a resolver): `03_DETALLE_SCALPING_RIESGO_MEDIO.md`.

Contexto verificado en código antes de proponer nada (regla de oro CLAUDE.md): `engine/src/risk/riskGate.ts`, `engine/src/config/riskConfig.ts` (defaults hoy: 1% por trade, 5% riesgo agregado local, 3 posiciones concurrentes, 3%/10% drawdown diario/total, 4 pérdidas consecutivas — relajado a 12 para TSMOM en `engine/src/live/dailyCycle.ts`), `engine/src/portfolio/portfolioManager.ts` (techo global 4% multi-venue, diseñado y testeado pero **no conectado todavía** al ciclo en vivo). `correlationGroup` existe en `engine/src/domain/types.ts` pero **hoy no se usa** en el risk gate (no agrupa ni limita) — brecha a resolver antes de fiarse de los caps de correlación, tanto para TSMOM como para scalping.

## Parámetros propuestos (riesgo MEDIO — tabla bajo/medio/alto en el detalle)
| Parámetro | Default | Rango | Relación con TSMOM |
|---|---|---|---|
| Riesgo por operación (scalping) | **0.25%** | 0.1%–0.5% | 1/4 del 1% de TSMOM — compensa la mayor frecuencia (heurística conservadora, no fórmula estadística; sin confirmar la relación exacta, pendiente 13_BACKTESTING) |
| Sub-presupuesto dedicado de riesgo abierto (scalping) | **1.5%** del capital | 1–2% | Dedicado, dentro del techo agregado ya existente (NO aditivo por encima) |
| Techo TSMOM sin cambios | ≤3% (3×1%) | — | Como hoy |
| Techo combinado (TSMOM+scalping) | ≤4.5% | — | ≤ 5% local actual (buffer 0.5%) hoy; ≤4% cuando el PortfolioManager multi-venue se active (TSMOM baja a ≤2.5% por el MIN() ya implementado) |
| Máx. posiciones scalping concurrentes | **3** | 3–5 | Contador SEPARADO del de TSMOM (máx. combinado 6 posiciones cuenta) |
| Máx. entradas scalping / día | **30** total, **10**/instrumento | 15–40 total | Nuevo — no existe hoy |
| Kill-switch diario dedicado (scalping) | **-1.5%** intradía atribuible a scalping | 1–2% | Mitad del 3% diario global; pausa SOLO scalping, TSMOM sigue |
| ATR scalping (stop) | período 14, mult. **1.0–1.5x** | — | Más ajustado que el 2.0x de TSMOM (timeframe intradía exacto: sin confirmar) |
| Kelly fraccionado | 1/4, techo absoluto 0.5% | — | Igual regla que 09_RISK; requiere N mín. operaciones (sin confirmar, propuesta 300–500) |
| Pérdidas consecutivas scalping | **5** | 3–6 | Contador separado de TSMOM (12); pausa scalping, reset manual Moisés |
| Cap por grupo de correlación | **2%** combinado (TSMOM+scalping) | 1.5–2.5% | Grupos: {Nasdaq,US30}, {EURUSD,Oro} (provisional, sin confirmar), BTC comodín risk-sentiment |
| Máx. instrumentos mismo sesgo direccional | **3** combinados | — | Evita "corto en todo a la vez" |
| Validación demo mínima antes de capital real | **4–6 semanas Y ≥300 operaciones** | — | Más exigente que TSMOM por sensibilidad a costes |

## Señales de alarma / kill-switches específicos de alta frecuencia
Slippage anómalo (>25–30% de la distancia al stop en 3 operaciones seguidas) · coste total (spread+comisión+slippage) >40% del objetivo medio de beneficio en ventana móvil · caída/atraso de datos (vela/tick sin refrescar >2× el intervalo del timeframe) → bloquear entradas nuevas · latencia señal→orden >2–3s repetida · errores/timeouts de broker: 3 en 5 min (ventana explícita, más ajustada que el "sin confirmar" actual de 09_RISK) · conflicto direccional con posición TSMOM abierta en el mismo símbolo (bloqueo por defecto, ver detalle §4).

## Bloqueantes antes de construir
1. **Nasdaq/US30 no están conectados hoy** (Deriv no los ofrece — comentario explícito en `dailyCycle.ts`); requieren el puente MT5, hoy bloqueado por falta de VPS Windows (`00_FOUNDATION/03`, `11_MT5`). Empezar scalping SOLO en EURUSD/Oro/BTC (venue Deriv ya operativo); añadir índices cuando exista el puente.
2. **Falta atribución por estrategia** en el dominio (`Signal`/`Order`/`Position`/`AccountState` no distinguen TSMOM de scalping hoy) — imprescindible para aplicar sub-presupuestos, contadores de pérdidas y kill-switch diario POR estrategia. Ver diseño en el detalle §2.
3. **`correlationGroup` no se aplica** en `riskGate.evaluate()` hoy (campo presente, sin lógica de agrupación) — implementar antes de confiar en los caps de correlación.
4. **Stops de scalping deben ser órdenes stop reales en el broker**, no solo lógica interna vigilada por el proceso (a diferencia del ciclo diario actual, que revisa una vez al día) — intradía, un fallo de proceso/datos entre revisiones sin stop real en el broker es inaceptable.
5. **Modo demo/paper obligatorio** (regla de oro del proyecto) — cero capital real hasta cumplir la validación del §7 del detalle.

## Sin confirmar
Relación exacta de escalado del % por trade con la frecuencia (heurística, no fórmula validada) · timeframe intradía exacto para ATR (depende de datos disponibles Deriv/MT5) · umbral y método de correlación (igual que 09_RISK, pendiente 13_BACKTESTING con datos reales) · N mínimo de operaciones para activar Kelly en scalping · si el circuit breaker de 5 pérdidas consecutivas será demasiado sensible en la práctica (misma tensión ya anotada para TSMOM en `00_FOUNDATION/00_INDICE_MAESTRO.md`, decidir con datos de demo).

## Fuentes
`09_RISK/00_RESUMEN.md` y `01_DETALLE_FORMULAS_Y_PARAMETROS.md` (reglas núcleo aprobadas, reutilizadas). `14_PORTFOLIOS` (techo global 4%, patrón MIN() de dos niveles). Código real leído en esta sesión: `engine/src/risk/riskGate.ts`, `engine/src/config/riskConfig.ts`, `engine/src/portfolio/portfolioManager.ts`, `engine/src/domain/types.ts`, `engine/src/strategy/tsmom.ts`, `engine/src/live/dailyCycle.ts`, `engine/db/001_trading_audit_log.sql`. Van Tharp / Kelly (1956) / Ed Thorp — igual que 09_RISK, no cifras nuevas sin marcar.
