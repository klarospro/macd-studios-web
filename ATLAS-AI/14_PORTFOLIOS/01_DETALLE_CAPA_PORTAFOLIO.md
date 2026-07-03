# Detalle — Capa de Portafolio (asignación de capital multi-venue)

Todo el pseudocódigo de este documento es documentación de diseño, NO código de producción. Complementa `00_RESUMEN.md`. Se apoya en 09_RISK y en `engine/src/broker/brokerAdapter.ts`.

## 1. Modelo de entidades
```
Venue                      // una cuenta operable en un broker concreto
  id                       // "deriv-demo-1", "polymarket-1", "mt5-funded-ftmo-1"
  adapter: BrokerAdapter   // el "enchufe" ya existente
  estilo: "estadistico" | "institucional"   // Polymarket vs MT5/CFD
  capitalAsignado          // € que Moisés destina a este venue
  limiteLocal              // reglas 09_RISK propias del venue
  limiteExterno?           // reglas del prop firm (solo cuentas de fondeo): dd diario/total, etc.

PortfolioManager           // la "plantilla maestra"
  venues: Venue[]
  capitalTotal()           // Σ equity real de cada venue (normalizado a USD)
  riesgoAbiertoGlobal()    // Σ riskAmount de posiciones abiertas de todos los venues
  presupuestoRiesgoGlobal  // techo de riesgo agregado sobre el capital TOTAL
```

El `PortfolioManager` se sitúa por ENCIMA del `TradingEngine` por-venue actual. No sustituye al risk gate: lo envuelve.

## 2. Riesgo de dos niveles (regla central del diseño)
Una orden se aprueba solo si pasa AMBOS filtros, en este orden:

```
1. Gate GLOBAL (PortfolioManager):
   - riesgoAbiertoGlobal() + riesgo_nuevo ≤ presupuestoRiesgoGlobal   (sobre capital TOTAL)
   - el venue no supera su capitalAsignado ni su sub-techo
   - si es cuenta de fondeo: respetar el limiteExterno MÁS ESTRICTO (del prop firm)
2. Gate LOCAL (riskGate de 09_RISK, ya implementado):
   - sizing regla 1, Kelly fraccionado, drawdown de la cuenta, breakers, correlación intra-venue
```
Motivo: tres cuentas al 5% local cada una = 15% de riesgo real sobre el total. El gate global impide eso. El límite efectivo de cada orden es el MÍNIMO de todos los techos aplicables (global, sub-venue, local, externo del prop firm).

## 3. Política de asignación de capital (decisión de Moisés)
| Opción | Cómo | Cuándo |
|---|---|---|
| **Fija (recomendada para empezar)** | Moisés fija importes por venue (su ejemplo: 2k/3k/resto). El manager solo respeta esos topes. | Ahora — sin edges validados. Simple, transparente, conservadora. |
| Dinámica por edge (Kelly entre venues) | Asignar más riesgo donde el edge estadístico esperado es mayor; repartir el presupuesto global proporcional al edge. | Solo tras 13_BACKTESTING con edges validados out-of-sample. |
| Risk-parity | Igualar la contribución de riesgo de cada venue. | Alternativa intermedia; requiere estimar volatilidad/correlación fiables. |

Recomendación: **empezar fija**, migrar a dinámica cuando haya datos. No dar por hecho que sabemos el edge antes de medirlo.

## 4. Correlación cross-venue (postura honesta)
- Estimar la correlación entre una apuesta de Polymarket ("¿gana X las elecciones?") y una posición de forex/índices es **muy poco fiable** con los datos disponibles.
- Postura conservadora inicial: NO afirmar diversificación que no podemos probar. Se asume correlación implícita fijando el **techo global más ajustado que la suma de sub-techos** (colchón). Refinar con datos reales en 13_BACKTESTING.
- Dentro de un mismo venue, la correlación intra-instrumento ya la cubre 09_RISK (regla 4).

## 5. Heterogeneidad de "riesgo" entre venues — por qué la abstracción aguanta
- Polymarket: riesgo = USDC que se pierde si el mercado resuelve en contra (acotado al stake; encaja con `winProbability`/`payoffRatio` + Kelly del riskGate).
- MT5/CFD/futuros: riesgo = tamaño × distancia al stop.
- Ambos se reducen a **riskAmount en moneda de cuenta** — que ya es el campo `riskAmount` del dominio (`engine/src/domain/types.ts`). El manager solo suma `riskAmount` normalizados a USD. La abstracción del dominio actual ya soporta esto sin cambios de tipos.

## 6. Flujo de una oportunidad (pseudocódigo de diseño)
```
function evaluarOportunidad(oportunidad):
    venuesCandidatos = venues donde la oportunidad es operable (por estilo/instrumento)
    para cada venue en venuesCandidatos (orden por edge esperado desc):
        riesgo_propuesto = sizingLocal(venue, oportunidad)          // 09_RISK
        si NO gateGlobal.permite(venue, riesgo_propuesto):  continuar/saltar venue
        decision = venue.engine.handleSignal(...)                    // gate local + adaptador + auditoría
        registrar en auditoría de portafolio (además de la de venue)
    si ningún venue admitió: auditar "sin_capacidad_portafolio"
```
- El objetivo "entrar en todas las cuentas a la vez" se cumple iterando venues candidatos mientras el gate global tenga presupuesto — no es un único venue, es reparto hasta agotar el techo global.

## 7. Estado y reconciliación
- El `capitalTotal()` y `riesgoAbiertoGlobal()` NO se asumen: se leen del equity real de cada adaptador (`getEquity`) y de las posiciones abiertas reportadas por cada broker. Divergencia entre estado interno y broker → evento de circuit breaker (fail-safe), nunca se opera sobre estado desincronizado.
- Auditoría de dos niveles: cada orden deja rastro en la auditoría del venue Y en la del portafolio (asignación aplicada, techo global antes/después).

## 8. Qué NO cubre (diferido)
- Implementación (código) — siguiente paso solo tras aprobación.
- Cálculo real de correlación cross-venue → 13_BACKTESTING con datos.
- Rebalanceo automático de capital entre venues (mover dinero) — fuera de alcance inicial; el manager reparte RIESGO, no transfiere fondos entre brokers.
- Reglas exactas de cada prop firm de fondeo → documentar por-proveedor cuando se elija uno.

## Fuentes
09_RISK/00_RESUMEN.md y 01_DETALLE (reglas núcleo aprobadas, internas). Arquitectura de fondos multi-estrategia / asignación de riesgo por presupuesto — práctica estándar de la industria, sin cifra única canónica. Parámetros numéricos = defaults conservadores, sin confirmar hasta backtesting.
