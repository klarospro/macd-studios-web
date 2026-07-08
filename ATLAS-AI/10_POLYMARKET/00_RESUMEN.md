# Polymarket — Resumen (Fase 3)

Estado: investigado (2026-07-03; nota de fan-out multi-wallet añadida 2026-07-07). Detalle completo: `01_DETALLE_API_Y_ESTRATEGIA.md`. Mecánica de fan-out a N wallets propias: `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md` §2.2.

## Qué es
Mayor mercado de predicción on-chain: contratos binarios (YES/NO) que pagan 1 pUSD si el evento ocurre, 0 si no. Order book central (CLOB) híbrido: matching off-chain, settlement on-chain en Polygon. El precio del contrato = probabilidad implícita.

## Por qué existe (para Atlas)
Venue para **edges estadísticos rápidos**: si nuestra probabilidad estimada `p̂` difiere del precio de mercado `p_m` más que fees+slippage, hay valor esperado positivo. Mapea 1:1 al Kelly fraccionado ya implementado en `engine/src/risk/riskGate.ts` (`winProbability = p̂`, `payoffRatio = (1−p_m)/p_m`).

## Cuándo usarlo / cuándo NO
- **Usar**: mercados líquidos, reglas de resolución claras, resolución cercana en el tiempo, edge > coste total (taker fee hasta ~1,8% en p=0,5 + slippage), órdenes maker cuando sea posible.
- **NO usar**: reglas ambiguas (riesgo oráculo UMA), libros ilíquidos, edge < fees, jurisdicción restringida, y **nunca en real sin fase de shadow-trading previa** (no existe testnet oficial — ver Riesgos).

## Ventajas / Desventajas / Costes
- ✅ API pública sin auth para datos (Gamma + CLOB read + WSS market channel); SDKs oficiales; Kelly aplica de forma nativa; pérdida máxima acotada (la prima pagada — "stop" natural en 0).
- ❌ **Breaking change abril 2026 (V2)**: clientes `py-clob-client`/`clob-client` archivados y NO funcionales; SDKs nuevos (`Polymarket/py-sdk`, `Polymarket/ts-sdk`) están en **beta**. Sin sandbox/testnet. Settlement asíncrono (UMA, horas-días). Fees taker desde marzo 2026 en casi todas las categorías.
- 💰 Taker fee dinámica por categoría (curva `p·(1−p)`, pico ~0,75–1,8% en p=0,5; geopolítica gratis); maker 0 + rebates; gas Polygon (POL) según tipo de wallet; colateral **pUSD** (ERC-20 1:1 USDC).

## Alternativas
Kalshi (regulado CFTC, EE.UU., API propia), Manifold (dinero de juego — útil como paper informal), Metaculus (solo forecasting, sin dinero), Drift BET/Azuro (menor liquidez, sin confirmar estado actual).

## Riesgos (top 5)
1. **Legal/geo**: internacional bloquea EE.UU. y ~33 países; VPN ⇒ congelación de fondos. Verificar jurisdicción de Moisés ANTES de fondear (bloqueante).
2. **Sin modo paper oficial**: la regla del proyecto exige demo primero ⇒ mitigar con simulador interno sobre datos reales (feeds públicos) + wallet pequeña después.
3. **Resolución/oráculo UMA**: disputas, reglas ambiguas, voto de holders de UMA puede divergir de los hechos.
4. **Beta de SDKs V2**: API aún estabilizándose; pin de versiones y tests de integración obligatorios.
5. **(2026-07-07) Fan-out multi-wallet**: repartir la misma señal entre varias wallets propias en el MISMO mercado puede auto-competir contra el propio libro (mueve el precio en contra) en mercados poco líquidos — enrutar la oportunidad a UNA sola wallet salvo que el capital exceda la profundidad del libro para esa wallet. Ver `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md` §2.2.

## Mejores prácticas + ejemplo mínimo
Leer reglas del mercado antes de operar; filtrar por liquidez/spread/tiempo a resolución; edge neto = `p̂ − p_m − fee − slippage`; Kelly fraccionado con cap `riskPerTradePct`; `correlationGroup` = event id. Ejemplo: mercado a 0,40, modelo dice 0,50 ⇒ `payoffRatio = 1,5`, Kelly = `0,5 − 0,5/1,5 = 0,167` ⇒ con `kellyFraction 0,25` ⇒ 4,2% (capado por config). Stake = riskAmount; shares = riskAmount/0,40; stop = 0.

## Encaje BrokerAdapter
Sí es modelable como `PolymarketAdapter implements BrokerAdapter` (symbol→tokenId, stopPrice→0, getEquity→pUSD + mark-to-market vía Data API). Fricciones: fills parciales, sin stop-loss nativo, cierre por venta o por redención post-resolución. Diseño en el detalle, sección 6. Para N wallets propias (operador único, fan-out entre venues): cada wallet = una instancia de adaptador con su propia clave/API L2 — técnicamente trivial, ver riesgo de auto-impacto arriba.

## Fuentes oficiales
docs.polymarket.com (CLOB, Gamma, WSS, v2-migration, resolución UMA), help.polymarket.com (fees, geo), github.com/Polymarket (py-sdk, ts-sdk), arXiv 2508.03474 y 2605.00864 (arbitraje). Tabla completa en el detalle.
