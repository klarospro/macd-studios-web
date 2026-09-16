# Detalle — Marco de riesgo para scalping (riesgo medio), conviviendo con TSMOM

Todo el pseudocódigo/interfaces de este documento es DISEÑO, no código de producción. Complementa `02_RESUMEN_SCALPING_RIESGO_MEDIO.md`. Se apoya en `09_RISK/00_RESUMEN.md` + `01_DETALLE_FORMULAS_Y_PARAMETROS.md` (reglas núcleo, ya aprobadas) y en `14_PORTFOLIOS` (gate de dos niveles). Instrumentos objetivo: Nasdaq, US30, EURUSD, Oro (XAU/USD), BTC/USD. Venue hoy: Deriv demo (EURUSD/Oro/BTC — ver `engine/src/live/dailyCycle.ts`); Nasdaq/US30 requieren MT5 (bloqueado, ver `00_FOUNDATION/03`).

## 0. Qué existe hoy en código (verificado antes de proponer)
- `engine/src/config/riskConfig.ts`: `defaultRiskConfig` = 1% riesgo/trade, 1/4 Kelly, 3%/1.5%/10% drawdown diario/escalón/total, 5% riesgo agregado, 3 posiciones concurrentes, 4 pérdidas consecutivas (12 para TSMOM, override en `dailyCycle.ts` línea `CONFIG`), 3 errores de broker.
- `engine/src/risk/riskGate.ts` (`evaluate()`): orden de checks = halt → pérdidas consecutivas → errores de broker → drawdown total → drawdown diario → posiciones concurrentes → sizing (regla 1% techada por Kelly, con reducción a la mitad si se toca el escalón) → exposición agregada. `openAggregateRiskPct()` suma **TODAS** las posiciones abiertas sin distinguir estrategia ni grupo de correlación (`correlationGroup` está en el tipo `Signal`/`Order`/`Position` pero **no se usa** en ningún cálculo del gate hoy).
- `engine/src/portfolio/portfolioManager.ts`: techo GLOBAL 4% sobre capital TOTAL multi-venue, envuelve el gate local — **diseñado y testeado, no conectado** al ciclo en vivo (`dailyCycle.ts` llama a `evaluate()` directo, un solo venue).
- `engine/src/domain/types.ts`: `AccountState` es un estado ÚNICO compartido (equity, drawdown, pérdidas consecutivas, posiciones) — no tiene noción de "estrategia". `Signal`/`Order`/`Position` tampoco.
- `engine/db/001_trading_audit_log.sql`: `trading_audit_log(at, kind, venue_id, symbol, reason, event jsonb)` WORM, INSERT-only. `event` es jsonb → admite campos nuevos sin migración de esquema.

Consecuencia: para aplicar TODO lo que sigue (sub-presupuestos por estrategia, contadores de racha por estrategia, kill-switch diario dedicado, caps de correlación reales) hace falta **extender el dominio**, no solo añadir una estrategia nueva. Ver §2.

## 1. Riesgo por operación — scalping vs TSMOM

```
Riesgo_€_scalping   = Capital_cuenta × RiesgoPct_scalping     (default 0.25%, rango 0.1%–0.5%)
Tamaño_posición     = Riesgo_€_scalping / (Distancia_stop × Valor_por_punto_o_pip)
```

Por qué 0.25% y no el 1% de TSMOM: TSMOM abre pocas operaciones (holding medio 28–120 días según `dailyCycle.ts`, unas pocas por activo al año); scalping abre decenas por día. Si cada trade de scalping arriesgara 1% igual que TSMOM, una racha de 3–4 pérdidas — estadísticamente banal en un día de scalping — agotaría el límite de drawdown diario del 3% (09_RISK regla 3) en minutos, dejando a TSMOM sin margen el resto del día. Bajar el % por trade en proporción a la mayor frecuencia es una **heurística conservadora de gestión de cartera, no una fórmula estadística validada** — se marca así explícitamente, pendiente de ajustar con datos reales de demo (13_BACKTESTING).

Tabla bajo/medio/alto (para justificar "medio" como punto intermedio, no un número aislado):

| Nivel | Riesgo/trade | Sub-presupuesto agregado | Máx. concurrentes | Máx. entradas/día |
|---|---|---|---|---|
| Bajo | 0.10%–0.15% | 0.75%–1% | 2 | 15 |
| **Medio (elegido)** | **0.25%** (rango 0.1–0.5%) | **1.5%** (rango 1–2%) | **3** | **30** (10/instrumento) |
| Alto | 0.5%–1% | 2.5%–3% | 5+ | 50+ |

## 2. Presupuesto de riesgo — reparto TSMOM/scalping sin romper el gate global

El gate agregado existente NO se sustituye ni se sube. Se **parte** en dos sub-presupuestos que deben sumar dentro del techo ya vigente:

```
riesgo_abierto_TSMOM     ≤ techo_TSMOM        (≤3%, sin cambios: 3 posiciones × 1%)
riesgo_abierto_scalping  ≤ techo_scalping      (≤1.5%, NUEVO, dedicado)
riesgo_abierto_TSMOM + riesgo_abierto_scalping ≤ techo_agregado_vigente
```

`techo_agregado_vigente` es el que YA existe en el código, en dos capas según el momento del roadmap:
- **Hoy** (un solo venue Deriv, sin PortfolioManager conectado): `defaultRiskConfig.maxAggregateRiskPct` = 5% (local). Con TSMOM ≤3% + scalping ≤1.5% = 4.5% máximo combinado ⇒ buffer de 0.5% sobre el 5% actual, SIN tocar la constante ya aprobada.
- **Cuando se conecte `PortfolioManager`** (multi-venue, ej. índices vía MT5): el techo GLOBAL de 4% (`PortfolioConfig.globalRiskPct`, `14_PORTFOLIOS`) pasa a ser el vinculante vía su `MIN(global, local)` ya implementado. Bajo ese techo, TSMOM queda de facto en ≤2.5% (consecuencia automática del MIN(), no una regla nueva) y scalping conserva su sub-cap fijo de 1.5%, sumando exactamente 4%.

Esto significa que **el sub-presupuesto de scalping (1.5%) es constante**; lo que se ajusta solo es cuánto le queda a TSMOM, y eso ya lo resuelve el mecanismo de dos niveles existente en `portfolioManager.ts` — no hace falta inventar nada ahí, solo añadir el tercer nivel (por-estrategia) descrito abajo.

### Extensión de dominio necesaria (diseño, no implementar todavía)
```ts
// Pseudocódigo de diseño — extiende engine/src/domain/types.ts
type Strategy = "tsmom" | "scalping";

interface Signal { /* ...existente... */ strategy: Strategy }
interface Order  { /* ...existente... */ strategy: Strategy }
interface Position { /* ...existente... */ strategy: Strategy }

interface StrategyState {
  consecutiveLosses: number;
  dailyPnlPct: number;          // P&L intradía atribuible SOLO a esta estrategia
  entriesToday: number;
  tradingHaltedStrategy: boolean; // kill-switch propio, independiente del halt global de cuenta
}

interface AccountState {
  // ...existente...
  byStrategy: Record<Strategy, StrategyState>;
}
```
Con esto, `riskGate.evaluate()` puede calcular `openAggregateRiskPct(account, strategy)` filtrando `openPositions` por `p.strategy === strategy` (hoy suma TODAS sin filtrar) y aplicar el sub-techo correspondiente ANTES del techo combinado. Sin esta extensión, cualquier "presupuesto de scalping" es solo un número en un documento, no algo que el motor pueda hacer cumplir.

## 3. Límites de actividad y kill-switch diario dedicado

| Parámetro | Default | Rango |
|---|---|---|
| Máx. entradas scalping / día (total cuenta) | 30 | 15–40 |
| Máx. entradas scalping / día / instrumento | 10 | 5–15 |
| Máx. posiciones scalping concurrentes | 3 | 3–5 |
| Kill-switch diario dedicado a scalping | **-1.5%** del capital (P&L intradía atribuible solo a scalping) | 1–2% |

El kill-switch diario de scalping es la MITAD del límite diario global de 3% (09_RISK regla 3) — deja el otro 1.5% de "colchón diario" disponible para TSMOM (que ya lo consume muy raramente por su baja frecuencia) y para el margen de error del propio cálculo. Al tocarlo: **se pausa SOLO scalping** el resto del día (`tradingHaltedStrategy = true` en `StrategyState`); TSMOM sigue operando con su propio drawdown diario intacto, salvo que el drawdown TOTAL de cuenta (3% agregado real, no solo scalping) también se haya tocado, en cuyo caso aplica el halt GLOBAL ya existente (09_RISK regla 3, afecta a todo). Reset: manual, por Moisés, mismo patrón que el resto de breakers — nunca automático, ni siquiera al día siguiente sin revisión.

## 4. Correlaciones — caps y no doblar exposición con TSMOM

### 4.1 Grupos de correlación (provisionales — sin confirmar con datos reales, pendiente 13_BACKTESTING)
| Grupo | Instrumentos | Razonamiento |
|---|---|---|
| `equity_risk` | Nasdaq, US30 | Correlación mecánica muy alta entre índices de acciones EE.UU. (\|ρ\|>0.9 típico) — cuentan como UNA posición a efectos de techo. |
| `usd_dollar_bloc` | EURUSD, Oro (XAU/USD) | Ambos reaccionan a la fuerza/debilidad del USD, con frecuencia en la misma dirección relativa al dólar — **relación régimen-dependiente, sin confirmar con datos propios**. |
| `risk_sentiment_wildcard` | BTC | Trata por defecto como independiente; en shocks macro "risk-off" ha mostrado co-movimiento con Nasdaq (ej. 2022) — no se asume correlación permanente, pero el cap direccional (§4.2) lo cubre igualmente si el mercado se mueve así en la práctica. |

```
Riesgo_grupo = Σ riskAmount(posiciones TSMOM + scalping) cuyo símbolo ∈ grupo
Riesgo_grupo ≤ techo_grupo   (default 2% del capital, rango 1.5–2.5%)
```

### 4.2 Cap direccional (evitar "corto en todo a la vez")
```
Nº instrumentos con el MISMO signo (todos largos o todos cortos), combinando TSMOM + scalping ≤ 3
```
Si ya hay 3 posiciones (de cualquier estrategia) en la misma dirección, no se abre una 4ª aunque cumpla el resto de reglas — se rechaza con motivo `concentracion_direccional`.

### 4.3 Interacción con posiciones TSMOM en el MISMO símbolo (evitar doblar exposición o auto-hedge no intencional)
Antes de aprobar una señal de scalping en un símbolo donde TSMOM ya tiene posición abierta:
```
si dirección_scalping == dirección_TSMOM:
    permitir, PERO el riesgo combinado en ESE símbolo (TSMOM + scalping) no puede superar
    un techo por-símbolo (default 1.5%, rango 1–2%) — evita que ambas estrategias sumen
    una apuesta direccional mayor de lo que cada una cree individualmente.
si dirección_scalping == opuesta a dirección_TSMOM:
    RECHAZAR por defecto, motivo "conflicto_direccional".
    (Un auto-hedge no intencional paga spread/comisión en ambas patas por una posición neta
    casi nula — coste seguro, beneficio esperado ~0. Si Moisés quiere permitir cobertura
    intencional, requiere flag explícito de configuración, no comportamiento por defecto.)
```

## 5. Position sizing por trade de scalping (stop, ATR, Kelly)

Reutiliza LA MISMA fórmula y módulo que TSMOM (`riskGate.ts`, `atrProxy()` de `tsmom.ts`), con parámetros propios:

```
ATR_scalping   = atrProxy(precios_intradía, i, periodo=14)   // mismo proxy, alimentado con velas intradía
Distancia_stop = ATR_scalping × atrMult_scalping              // atrMult 1.0–1.5 (vs 2.0 de TSMOM: stops más ajustados)
Riesgo_€       = Capital × riskPct_scalping (0.25% default, techo absoluto 0.5%)
Tamaño         = Riesgo_€ / Distancia_stop
```
- Timeframe intradía exacto (M1/M5/M15) para el ATR: **sin confirmar** — depende de qué granularidad de velas ofrezcan Deriv/MT5 y de qué frecuencia de scalping se valide en demo. Pendiente 13_BACKTESTING.
- **Piso mínimo de distancia al stop**: un stop más ajustado que el spread medio del instrumento convierte el riesgo teórico (%) en riesgo real mayor, porque el slippage de entrada/salida pesa más como fracción de un stop pequeño. Regla: `Distancia_stop ≥ k × spread_medio_instrumento` (k sin confirmar, medir spreads reales antes de fijarlo) — si el ATR sugiere un stop más ajustado que ese piso, o se amplía el stop (reduciendo tamaño) o no se opera esa señal.
- **Kelly fraccionado**: misma regla que 09_RISK (`f_usado = 1/4 × f*`, nunca por encima), con techo absoluto adicional propio de scalping de 0.5% (nunca superar aunque Kelly sugiera más, coherente con "riesgo medio"). Requiere N mínimo de operaciones para estimar `p`/`b` con confianza — propuesta 300–500 operaciones out-of-sample (sin confirmar valor exacto, pendiente 13_BACKTESTING); hasta entonces usar solo el 0.25% fijo, Kelly desactivado.

## 6. Kill-switches y circuit breakers de alta frecuencia (además de los de 09_RISK, que siguen aplicando)

| Condición | Default | Acción |
|---|---|---|
| Pérdidas consecutivas EN SCALPING | 5 (rango 3–6) | Pausa SOLO scalping (contador separado del 12 de TSMOM); reset manual Moisés |
| Slippage anómalo | >25–30% de la distancia al stop, en 3 operaciones seguidas | Pausa scalping + alerta (posible problema de liquidez/broker) |
| Coste total (spread+comisión+slippage) vs objetivo de beneficio | >40% del beneficio medio esperado, ventana móvil (N operaciones: sin confirmar) | Pausa scalping (el edge neto de costes puede haberse agotado) |
| Caída/atraso de datos | vela/tick sin refrescar >2× el intervalo esperado del timeframe elegido | Bloquear ENTRADAS nuevas (no fiarse de precio stale); posiciones abiertas dependen de que el stop ya esté puesto como orden real en el broker (ver requisito abajo) |
| Latencia señal→orden | >2–3s, repetida (umbral de repetición: sin confirmar) | Pausa scalping + alerta |
| Errores/timeouts de broker | 3 en 5 minutos (ventana explícita — más ajustada que el "sin confirmar" actual de 09_RISK, adecuada a la cadencia de scalping) | Pausa scalping; si es problema de conectividad de venue, también afecta a TSMOM en ese venue |
| Reset de cualquier breaker de scalping | — | Manual, solo Moisés, tras revisar causa raíz — igual política que 09_RISK, nunca automático |

**Requisito de ejecución no negociable**: los stops de scalping deben enviarse como **órdenes stop reales en el broker** (no solo vigilancia interna del proceso), a diferencia del ciclo diario actual (`dailyCycle.ts`) que gestiona salidas revisando una vez al día — a la cadencia de scalping, un fallo de proceso o de datos entre revisiones sin un stop real puesto en el broker es un riesgo de cola inaceptable. Esto es una brecha de implementación a resolver ANTES de construir el motor de scalping, no un detalle menor.

**Tensión conocida (igual que TSMOM, anotada honestamente)**: con win rate esperado bajo-medio típico de scalping, una racha de 5 pérdidas puede ser estadísticamente frecuente y parar el sistema a menudo — mismo dilema ya registrado para TSMOM en `00_FOUNDATION/00_INDICE_MAESTRO.md` (breaker de 4 pérdidas vs win rate ~30-45%). Decidir el umbral definitivo con datos reales de demo, no a priori.

## 7. Modo demo/paper obligatorio antes de real

Ninguna operación de scalping con dinero real sin: (a) mínimo **4–6 semanas** en demo, (b) mínimo **300 operaciones** ejecutadas (para que Kelly y las métricas de coste tengan base estadística mínima), (c) **edge neto de costes positivo y out-of-sample** (no solo bruto — scalping es mucho más sensible a spread/comisión/slippage que TSMOM por su frecuencia), (d) revisión manual de Moisés de los circuit breakers disparados durante la demo (si se disparó constantemente, hay que decidir si es ruido de umbral o señal real de que la estrategia no tiene edge suficiente). Más exigente que el criterio general del producto ("demo 1 mes, gate ≥60%") precisamente por la sensibilidad a costes.

## 8. Auditoría — qué se registra por cada trade de scalping (WORM/Supabase)

Reutiliza `trading_audit_log` (`engine/db/001_trading_audit_log.sql`, columnas `at, kind, venue_id, symbol, reason, event jsonb`, WORM/INSERT-only) — el campo `event` es jsonb, así que los campos nuevos NO requieren migración de esquema. Se añade `strategy` dentro de `event` (y opcionalmente como columna propia indexada si el volumen de scalping lo justifica — sin confirmar, evaluar cuando haya datos de volumen real).

Campos mínimos por evento de scalping (además de los ya existentes en `AuditEvent`):
- `strategy`: `"scalping"` (para distinguir de `"tsmom"` en todas las consultas).
- `timeframe` usado para la señal (M1/M5/M15 — el que finalmente se valide).
- `entryPrice`, `stopPrice`, `takeProfitPrice` (scalping SIEMPRE tiene TP explícito, a diferencia de TSMOM que sale por giro de tendencia).
- `atrValue`, `atrMult`, `stopDistance` usados en el cálculo de tamaño.
- `riskPctAplicado` (tras cualquier reducción por escalón de drawdown), `riskAmount`, `size`.
- `expectedSlippage` vs `realizedSlippage` (entrada y salida, cuando se conozcan).
- `spreadEnEntrada`, coste estimado (spread+comisión+slippage) en € y como % del riesgo.
- `holdingTimeSeconds` real, una vez cerrada la posición.
- `correlationGroup`, y si aplica, `conflictoDireccionalConTsmom: true/false` (motivo de rechazo si bloqueada por §4.3).
- `consecutiveLossesScalpingAlMomento`, `dailyPnlPctScalpingAlMomento`, `entriesTodayAlMomento` — snapshot del estado usado para la decisión (permite auditar por qué se aprobó/rechazó sin recalcular a mano).
- `killSwitchStateScalping` (activo/inactivo) en el momento de la decisión.
- `latencyMs` (de generación de señal a envío de orden), `dataFeedAgeMs` (antigüedad del último tick/vela usado).

Nuevo tipo de evento recomendado (extensión de `AuditEvent` en `engine/src/audit/auditLog.ts`, diseño):
```ts
| { kind: "kill_switch_triggered"; at: string; venueId?: string; strategy: Strategy;
    trigger: string; valueAtTrigger: number; thresholdConfigured: number }
```
para que cada disparo de breaker quede como evento propio, consultable, y no solo implícito en los rechazos de órdenes siguientes.

## Fuentes
Mismas que `09_RISK/00_RESUMEN.md`/`01_DETALLE` (Kelly 1956, Ed Thorp, Van Tharp — heurísticas de práctica estándar, no óptimas probadas) y `14_PORTFOLIOS` (patrón de gate de dos niveles, techo global 4%). Código real citado en este documento, leído en esta sesión: `engine/src/risk/riskGate.ts`, `engine/src/config/riskConfig.ts`, `engine/src/portfolio/portfolioManager.ts`, `engine/src/domain/types.ts`, `engine/src/strategy/tsmom.ts`, `engine/src/live/dailyCycle.ts`, `engine/src/audit/auditLog.ts`, `engine/db/001_trading_audit_log.sql`. Ninguna cifra de esta adenda está validada con datos reales de scalping — todas son defaults conservadores sujetos a aprobación de Moisés y ajuste posterior en `13_BACKTESTING`.
