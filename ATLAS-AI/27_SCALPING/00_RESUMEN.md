# Scalping multi-activo — conviviendo con TSMOM diario (investigación)

Estado: 🟡 investigación hecha (2026-07-17), **pendiente aprobación de Moisés antes de construir nada**. No se ha tocado código de producción. Detalle completo (7 puntos, fuentes, cifras): `01_DETALLE_SCALPING_MULTIACTIVO.md`.

## Qué es / por qué existe
Estrategia intradía de holding corto (minutos) que correría EN PARALELO al TSMOM diario ya en producción, bajo el mismo `PortfolioManager`/risk gate (09_RISK) y la misma auditoría WORM. Objetivo de Moisés: cubrir Nasdaq/US30, EURUSD, Oro y BTC con apetito de riesgo MEDIO.

## Veredicto go/no-go por activo (resumen — detalle con cifras en 01_DETALLE)

| Activo | Venue disponible HOY | Veredicto | Motivo principal |
|---|---|---|---|
| EUR/USD | Deriv Multipliers (Native API, ya integrado) | 🟢 GO — solo tras backtest+demo | Coste estimado más bajo (~0,02%/lado, parcialmente confirmado); único activo con infra intradía casi lista |
| Oro (XAU/USD) | Deriv Multipliers (ya integrado) | 🟡 GO CONDICIONADO | Spread retail típico (15-25 "pips" ≈ $0,15-0,25) más ancho; viable solo si el objetivo de scalp supera claramente ese coste — verificar en demo |
| BTC/USD | Deriv Multipliers (ya integrado) | 🟡 GO CONDICIONADO, con cautela | Coste real de Deriv en cripto **sin confirmar**; alta volatilidad ayuda al edge pero también al riesgo — medir con operaciones de prueba antes de dimensionar |
| Nasdaq / US30 | **NO existe hoy** en el adaptador actual (Deriv Native API no los ofrece; solo vía Deriv MT5/Deriv X) | 🔴 NO-GO por ahora | Requeriría el puente MT5/Windows ya bloqueado en `11_MT5` (VPS Windows nueva, no construida) — no es un tema de estrategia, es un tema de infraestructura inexistente |

## Recomendación accionable (en orden)
1. **No activar scalping en real ni en modo `--execute` todavía.** Primero: script de descarga de velas intradía de Deriv (1m/5m, análogo a `fetchDerivHistory.ts`) + backtest con costes realistas y walk-forward (igual metodología que `runDeepValidation.ts` del TSMOM).
2. Empezar SOLO con EUR/USD (mejor coste relativo, mismo adaptador). Oro y BTC en paralelo pero con más cautela documentada.
3. Nasdaq/US30 queda fuera de este ciclo — no construir nada para ellos hasta resolver el bloqueo de MT5/Windows.
4. Arquitectura: el ciclo diario actual (`systemd timer` 1x/día) NO sirve para scalping — hace falta un proceso de larga duración nuevo (`atlas-scalp.service`, no timer oneshot) con su propio `RiskConfig` y, muy probablemente, su propia sub-cuenta lógica dentro del `PortfolioManager` para no competir por el techo de 3 posiciones/4% global del TSMOM. Esto es una **extensión de diseño no trivial** del `PortfolioManager` (hoy 1 Venue = 1 cuenta física, no 1 cuenta física = N sub-estrategias) — requiere diseño propio antes de codificar.
5. Criterio go/no-go a dinero real: igual que TSMOM — mínimo 1 mes en demo con auditoría completa, out-of-sample positivo, y aprobación explícita de Moisés (regla de oro del proyecto).

## Riesgo clave (honesto)
El scalping vive y muere por costes. Con los datos disponibles (parcialmente confirmados), el "breakeven" ronda **~2-4 pips en EUR/USD** y bastante más en Oro — un objetivo de scalp de 5-15 pips deja margen estrecho, no un edge cómodo. Esto choca con la prioridad #1 del proyecto (preservación de capital): si el backtest intradía con costes reales no muestra edge claro y estable out-of-sample, la recomendación es NO construirlo, por muy bien que "se vea" en teoría.

## Fuentes clave
Deriv KID Multipliers Forex (docs.deriv.com/regulatory/kid — comisión ~0,000199 del nocional, parcialmente confirmado); developers.deriv.com (ticks_history, granularidades); Moskowitz-Ooi-Pedersen 2012 + Baltussen et al. 2021 (momentum intradía); Chague-De-Losso-Giovannetti 2020 (day trading retail, 97% pierden dinero). Ver tabla completa en el detalle.
