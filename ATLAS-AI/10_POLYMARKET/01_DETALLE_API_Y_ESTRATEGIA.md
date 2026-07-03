# Polymarket — Detalle: API, custodia, edges, riesgo y encaje con BrokerAdapter

Investigado: 2026-07-03. Complementa `00_RESUMEN.md`. Nada de código de producción; solo diseño y pseudocódigo (marcado como tal).

---

## 1. API oficial (estado post-V2, abril 2026)

### 1.1 ALERTA: migración V2 (2026-04-28)
El 28 de abril de 2026 Polymarket desplegó el **CLOB V2**: contratos nuevos, order book reescrito y colateral nuevo (pUSD). Consecuencias confirmadas por docs oficiales (`docs.polymarket.com/v2-migration`):
- Los clientes clásicos `Polymarket/py-clob-client` y `Polymarket/clob-client` están **archivados (2026-05-25) y no funcionales** ("should not be used for new or existing integrations").
- Órdenes firmadas V1 rechazadas: dominio EIP-712 pasa de versión "1" a "2"; struct de orden cambia (fuera `nonce`, `feeRateBps`, `taker`; entra `timestamp` ms, `metadata`, `builder`).
- Fees se cobran on-chain en el match, no embebidas en la orden; modelo de fee dinámico por mercado consultable vía `getClobMarketInfo()`.
- Ningún tutorial/repo/bot anterior a abril 2026 es fiable sin revisión.

### 1.2 Superficie de API
| API | Base | Auth | Uso en Atlas |
|---|---|---|---|
| CLOB REST | `https://clob.polymarket.com` | Pública lectura; L1/L2 para trading | Order book, precios, colocar/cancelar órdenes |
| CLOB WSS | `wss://ws-subscriptions-clob.polymarket.com/ws/market` y `/ws/user` | market: ninguna; user: API key | Book en tiempo real; ciclo de vida de órdenes (MATCHED→CONFIRMED). Heartbeat PING cada 10 s |
| Gamma (metadatos) | `https://gamma-api.polymarket.com` | Ninguna | `/events`, `/markets` — descubrimiento, outcomes, condition/token IDs, volumen, categoría |
| Data API | (sección Data en docs; OpenAPI publicada) | Ninguna para lecturas por address | Posiciones abiertas/cerradas, trades, **valor total del portafolio de una address** (clave para `getEquity`) |

Jerarquía de datos: **Event** (pregunta) → **Market** (outcome binario tradeable, `conditionId`) → **2 tokens ERC-1155** (YES/NO, `tokenId` cada uno). Mercados multi-outcome usan flag `negRisk: true`.

### 1.3 Autenticación
- **L1**: firma EIP-712 con la private key de la wallet → deriva credenciales API.
- **L2**: HMAC-SHA256 con `apiKey/secret/passphrase` derivadas; headers `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_API_KEY`, `POLY_PASSPHRASE`.
- 4 tipos de firma/wallet: `EOA` (0, necesita POL para gas), `POLY_PROXY` (1), `GNOSIS_SAFE` (2), `POLY_1271` (3, "deposit wallet", **recomendado por docs para nuevos usuarios API**).

### 1.4 SDKs oficiales (julio 2026)
- **TypeScript**: `Polymarket/ts-sdk` (monorepo, MIT, activo, **beta**; Node ≥ 24, pnpm). Encaja con nuestro stack Node del VPS.
- **Python**: `Polymarket/py-sdk` → pip `polymarket-client` (`pip install --pre`, **beta**, MIT). Cliente unificado: datos públicos + cuenta + trading + wallet.
- La página de migración menciona además paquetes `@polymarket/clob-client-v2` / `py-clob-client-v2` como ruta de transición; la relación exacta entre estos y los SDK unificados beta: **sin confirmar** (verificar en npm/PyPI antes de elegir).
- Rust: SDK citado en docs; nombre exacto del crate **sin confirmar**.

### 1.5 Órdenes
- **Limit**: GTC, GTD (expiración UTC, mínimo ~1 min; docs sugieren `now + 90 s` para 90 s reales). **Market**: FOK, FAK/IOC. BUY de mercado se especifica en dólares; SELL en shares. Post-only disponible (rechaza si cruzaría el spread).
- **Tick size por mercado** (0,1 / 0,01 / 0,001 / 0,0001; casos especiales p. ej. 0,0025): consultarlo siempre antes de cotizar.
- Rechazos comunes: tick desalineado, balance/allowance insuficiente, orden duplicada, GTD expirada. Abuso intencionado de balance ⇒ blacklist de cuenta.

### 1.6 Fees (desde marzo 2026)
- **Taker**: fee dinámica `fee ≈ C · baseRate_categoría · (p·(1−p))^exp` — campana con pico en p=0,5 y ~0 cerca de 0,01/0,99. Rates citados por prensa/terceros (~0,75% deportes … 1,80% cripto en p=0,5; geopolítica gratis): **usar siempre el valor por-mercado vía API (`getClobMarketInfo()` / endpoint fee-rate), los números por categoría cambian y son "sin confirmar" como constantes**.
- **Maker**: 0 + programa de rebates (se redistribuye el 100% de las taker fees a makers, según docs del Maker Program).
- Depósito/retiro de pUSD: sin fee de Polymarket (terceros/bridge aparte). Gas: Polygon (POL), mínimo; con proxy/deposit wallets parte va vía relayer (detalle exacto de quién paga gas por tipo de wallet: **sin confirmar**).

---

## 2. Custodia y requisitos

### 2.1 Colateral: pUSD (desde V2)
- **pUSD (Polymarket USD)**: ERC-20 en Polygon respaldado 1:1 por USDC on-chain (antes se usaba USDC.e). Conversión vía "Collateral Onramp"; la UI lo hace automático, por API hay que gestionar el wrap y las **allowances** a los contratos Exchange nuevos.
- Pre-requisitos para operar: allowance de pUSD ≥ coste (para BUY) y allowance del conditional token (para SELL).
- Trading no custodial: los fondos quedan en tu wallet/proxy; el Exchange contract liquida atómicamente.

### 2.2 Restricciones geográficas y KYC (crítico)
- La plataforma internacional bloquea **~33 países**, incluidos EE.UU. (para la internacional), Francia, Alemania, Australia, Singapur (close-only), Taiwán, Tailandia, Polonia (close-only), Bélgica, y jurisdicciones OFAC (Rusia, Irán, Corea del Norte, Cuba, Siria, Bielorrusia, **Venezuela**, Myanmar). Hay restricciones regionales (provincias de Canadá, regiones de Ucrania). La lista exacta cambia: consultar la página oficial de Geographic Restrictions y el **Geoblock API** (`docs.polymarket.com/api-reference/geoblock`) antes de operar.
- EE.UU.: existe plataforma regulada separada (Polymarket US, tras adquisición de QCEX y orden de la CFTC, relanzada dic-2025, KYC completo con SSN). Su API para bots: **sin confirmar**.
- Internacional: sin KYC generalizado, pero Polymarket avanza hacia KYC para volúmenes altos y **congela cuentas detectadas con VPN** (fuentes de prensa; política exacta **sin confirmar**).
- **Acción bloqueante para Atlas**: confirmar jurisdicción legal de Moisés/MACD Studios y su elegibilidad ANTES de fondear una wallet. Venezuela está en la lista de bloqueo OFAC según fuentes citadas.

### 2.3 ¿Modo paper / testnet?
**NO existe sandbox ni testnet oficial** a fecha de hoy. La propia guía de migración V2 dice que se testee "contra producción con wallets pequeñas fondeadas" usando condition IDs de mercados de prueba. El host de staging pre-cutover (`clob-v2.polymarket.com`) ya no es objetivo de integración. El soporte de testnet (Mumbai/Amoy) de los clientes antiguos está muerto junto con ellos.

**Mitigación para cumplir la regla "paper primero" del proyecto** (propuesta, requiere aprobación):
1. **Fase paper interna**: los feeds de datos son públicos sin auth (Gamma + CLOB book + WSS market). Construir un **simulador de fills** (matching contra el book real + fee del mercado + slippage) y correr el detector de edges en shadow-trading N semanas, registrando en Supabase.
2. **Fase micro-real**: wallet dedicada con capital mínimo acordado y `maxAggregateRiskPct` reducido, solo órdenes maker al principio.
3. Solo entonces, capital objetivo.

---

## 3. Detección programática de edges estadísticos

### 3.1 Edge de valor (modelo vs precio)
- Precio del token YES = probabilidad implícita `p_m`. Si un modelo externo estima `p̂`:
  `edgeNeto = p̂ − p_m_ejecutable − fee(p) − slippage`, donde `p_m_ejecutable` es el precio medio ponderado contra el book real (no el mid).
- Fuentes de `p̂` por categoría: deportes (modelos Elo/poisson, líneas de casas), macro/finanzas (datos oficiales, vol implícita para mercados "BTC > X el día D"), clima (NWS/ECMWF), política (agregadores de encuestas). La calibración histórica de Polymarket es buena en agregado pero con sesgo favorito-longshot en los extremos (Wolfers & Zitzewitz; literatura clásica de prediction markets) — los longshots tienden a estar sobrepreciados.
- Umbral mínimo: exigir `edgeNeto > 0` tras costes Y `edge anualizado = edgeNeto / T_resolución` alto — esto operacionaliza el objetivo "proposiciones rápidas": preferir mercados que resuelven en horas/días.

### 3.2 Arbitraje estructural
- **Intra-mercado**: `ask(YES) + ask(NO) < 1 − fees` ⇒ comprar ambos y hacer merge/redimir ⇒ beneficio sin riesgo de dirección (queda riesgo de ejecución y de resolución). Simétrico con bids > 1 si ya se tienen posiciones.
- **Multi-outcome (negRisk)**: `Σ ask(YES_i) < 1` o `Σ bid(YES_i) > 1` en eventos de outcome único. El paper arXiv 2508.03474 documenta que estas desviaciones ocurren en Polymarket y son explotadas; arXiv 2605.00864 (NBA, 75M snapshots del book) encuentra retorno mediano de ~101 bps en ejecución combinatoria pero muestra que el "jackpot teórico" nunca se captura entero (latencia + profundidad). Conclusión: el arbitraje puro existe pero es carrera de latencia; para Atlas es más realista como **filtro de sanidad** (si Σ≠1 persistente, el mercado está mal preciado y conviene revisar) que como estrategia principal desde un VPS genérico.
- **Cross-venue** (Polymarket vs Kalshi): documentado en literatura; añade riesgo legal/operativo doble. Fuera de alcance por ahora.

### 3.3 Filtros de liquidez y ejecución
- Profundidad mínima en best bid/ask y spread máximo (vía book REST/WSS) antes de aceptar una señal.
- Estimar slippage con el book: coste real de ejecutar `size` = walk del book, no precio top.
- Preferir órdenes **maker** (fee 0 + rebates) cuando el edge no decae rápido; FAK cuando sí.
- Métricas de seguimiento: Brier score / log-loss del modelo `p̂` vs resoluciones reales (misma métrica usada en la literatura, p. ej. PolySwarm arXiv 2604.03888) — si el modelo no está mejor calibrado que el mercado, no hay edge y se apaga la estrategia.

---

## 4. Modelo de riesgo (mapeo al riskGate existente)

### 4.1 Kelly binario = exactamente nuestro `riskGate`
Comprar YES a precio `p_m` con probabilidad estimada `p̂`:
- `winProbability = p̂`
- `payoffRatio b = (1 − p_m) / p_m` (ganas `1−p_m` por cada `p_m` arriesgado)
- Kelly: `f* = p̂ − (1−p̂)/b = (p̂ − p_m)/(1 − p_m)` — es literalmente `kellyEdge()` de `engine/src/risk/riskGate.ts`. Con `kellyFraction` y el cap `riskPerTradePct` ya existentes, no hay que tocar la fórmula.
- Para "vender" YES: comprar el token NO a `1 − p_m` con `winProbability = 1 − p̂`. Simetría total; el adaptador solo necesita elegir el token correcto.
- Ajuste recomendado: usar `p_m` con fee incluida y descontar incertidumbre del modelo (shrinkage de `p̂` hacia `p_m`) antes de pasar la señal — Kelly es hipersensible a sobreestimar `p̂`.

### 4.2 Stop y tamaño
No hay stop-loss nativo, pero un binario tiene pérdida máxima estructural = prima pagada:
- `entryPrice = p_m`, `stopPrice = 0` ⇒ `stopDistance = p_m` ⇒ `size = riskAmount / p_m` = nº de shares, y `riskAmount` = prima total. Coherente sin cambios en `riskGate.evaluate()`.
- Stop "blando" opcional (salir si el precio cae a X) es una regla del executor, no del gate; con libros finos puede no ser ejecutable — el riesgo presupuestado debe seguir siendo la prima entera.

### 4.3 Riesgos específicos y encaje de límites
| Riesgo | Descripción | Control en Atlas |
|---|---|---|
| Resolución/oráculo (UMA) | Propuesta + bond (~$750) + ventana de disputa de 2 h; 2 disputas ⇒ voto de holders UMA (4–6 días); resultado puede divergir de los hechos; reglas ambiguas = pérdida total posible | Solo mercados con reglas objetivas y fuente de verdad clara; excluir mercados en disputa; tratar resolución como evento binario sin cobertura |
| Liquidez | Books finos; salir antes de resolución puede ser imposible sin slippage brutal | Filtros de profundidad; asumir hold-to-resolution en el sizing |
| Settlement asíncrono | Capital bloqueado hasta resolución (+2 h mínimo de ventana UMA) | Contar posiciones abiertas como riesgo vivo en `maxAggregateRiskPct` hasta la redención |
| Correlación | Outcomes del mismo evento y mercados del mismo tema se mueven juntos | `correlationGroup = eventId` (o slug de tema); el gate ya limita por grupo/agregado |
| Contraparte/protocolo | Smart contracts nuevos (V2, 2 meses en producción), pUSD como wrapper | Exposición total a Polymarket capada como un venue más del asignador multi-venue; retirar beneficios periódicamente |
| Legal/geo | Ver §2.2 | Bloqueante hasta confirmar jurisdicción |

`maxAggregateRiskPct` a nivel portafolio multi-venue: la suma de `riskAmount` de posiciones Polymarket (= primas vivas) entra en el mismo agregado que el riesgo abierto de Deriv/fondeo, con un sub-cap por venue (p. ej. "Polymarket ≤ X% del equity total", valor a aprobar por Moisés — no se propone cifra sin análisis).

---

## 5. Encaje con `BrokerAdapter` (diseño, no código)

Sí es modelable con la interfaz actual de `engine/src/broker/brokerAdapter.ts` sin romperla:

| Interfaz | Análogo Polymarket | Fricción |
|---|---|---|
| `name` | `"polymarket"` | — |
| `connect()` | Derivar creds L2, abrir WSS user+market, verificar allowances pUSD/CTF | Setup one-time de wallet/allowances queda fuera del ciclo normal |
| `getEquity()` | pUSD libre + mark-to-market de posiciones (Data API: portfolio value, o bids del book) | Valoración de posiciones ilíquidas es estimada, no realizable |
| `placeOrder(order)` | `symbol` → `tokenId`; market FAK para entrar (o limit GTC maker) | **Fills parciales**: `Position` debe crearse con el tamaño realmente ejecutado (escuchar user channel MATCHED→CONFIRMED), no el pedido |
| `Position` | `entryPrice` = precio medio de fill; `stopPrice = 0`; `riskAmount` = prima; `size` = shares | El estado terminal puede ser "resuelto" además de "cerrado" |
| `closePosition(id)` | Vender shares (FAK) o, post-resolución, redimir el token ganador | Cierre no garantizado a precio razonable; la redención es una tx on-chain, asíncrona |
| `disconnect()` | Cancelar GTC vivas + cerrar WSS | — |

Fricciones estructurales a decidir en fase de diseño del adaptador:
1. **Ciclo de vida extra**: además de open/closed, existe `resolved/redeemable`. Opciones: (a) el adaptador lo abstrae y "cierra" la posición al redimir, o (b) se amplía `Position` con un estado. Recomendación: (a) para no tocar el dominio todavía.
2. **Órdenes limit maker**: `placeOrder` actual asume ejecución inmediata (devuelve `Position`). Para estrategia maker haría falta un estado "orden pendiente" (cambio de interfaz) o restringir v1 del adaptador a FAK/FOK taker. Recomendación v1: solo taker FAK, maker en v2.
3. **Unidades**: `size` = shares (1 share paga 1 pUSD); equity en pUSD≈USD, consistente con el resto del engine.

Pseudocódigo (ilustrativo, NO producción):
```
señal = { symbol: tokenId_YES, side: "buy", entryPrice: askEjecutable,
          stopPrice: 0, correlationGroup: eventId,
          winProbability: p̂_shrunk, payoffRatio: (1−askConFee)/askConFee }
decision = riskGate.evaluate(config, account, señal)
si approved → FAK BUY por decision.order.riskAmount dólares → Position con fill real
```

---

## 6. Recomendación de siguiente paso
1. Resolver el bloqueante legal (§2.2) — sin esto no se fondea nada.
2. Aprobar el plan paper de 3 fases (§2.3) y el sub-cap de venue (§4.3).
3. Spike de solo-lectura (sin dinero): conectar Gamma + WSS market desde el VPS, calcular edges/arbitrajes en shadow y medir Brier score del modelo antes de diseñar el adaptador definitivo.

---

## 7. Tabla de fuentes

| # | Fuente | Tipo | Qué confirma |
|---|---|---|---|
| 1 | [docs.polymarket.com — CLOB Introduction](https://docs.polymarket.com/developers/CLOB/introduction) | Oficial | Arquitectura CLOB híbrida, host `clob.polymarket.com`, auth L1/L2, tipos de firma |
| 2 | [docs.polymarket.com — Orders](https://docs.polymarket.com/developers/CLOB/orders/orders) | Oficial | GTC/GTD/FOK/FAK, tick sizes, allowances pUSD/CTF, negRisk flag, post-only |
| 3 | [docs.polymarket.com — V2 Migration](https://docs.polymarket.com/v2-migration) | Oficial | Cutover 2026-04-28, EIP-712 v2, pUSD, V1 roto, sin sandbox (test en prod con wallets pequeñas) |
| 4 | [docs.polymarket.com — Gamma API](https://docs.polymarket.com/developers/gamma-markets-api/overview) | Oficial | `gamma-api.polymarket.com`, /events /markets, sin auth |
| 5 | [docs.polymarket.com — WSS](https://docs.polymarket.com/developers/CLOB/websocket/wss-overview) | Oficial | Hosts WSS, canales market/user, auth, heartbeat 10 s |
| 6 | [docs.polymarket.com — Resolution/UMA](https://docs.polymarket.com/developers/resolution/UMA) | Oficial | Bond ~$750, ventana 2 h, escalado a voto UMA 4–6 días, riesgos |
| 7 | [docs.polymarket.com — llms.txt](https://docs.polymarket.com/llms.txt) | Oficial | Data API (positions/trades/portfolio value), Geoblock API, Maker Program; ausencia de sandbox |
| 8 | [github.com/Polymarket/py-clob-client](https://github.com/Polymarket/py-clob-client) | Oficial (archivado) | Cliente V1 Python archivado 2026-05-25, no funcional |
| 9 | [github.com/Polymarket/clob-client](https://github.com/Polymarket/clob-client) | Oficial (archivado) | Cliente V1 TS archivado, no funcional |
| 10 | [github.com/Polymarket/ts-sdk](https://github.com/Polymarket/ts-sdk) | Oficial | SDK TS unificado, beta, MIT, Node ≥24 |
| 11 | [github.com/Polymarket/py-sdk](https://github.com/Polymarket/py-sdk) | Oficial | pip `polymarket-client` (--pre), beta, MIT |
| 12 | [help.polymarket.com — Trading Fees](https://help.polymarket.com/en/articles/13364478-trading-fees) | Oficial | Fórmula taker fee campana p(1−p), maker 0/rebates, geopolítica gratis |
| 13 | [help.polymarket.com — Geographic Restrictions](https://help.polymarket.com/en/articles/13364163-geographic-restrictions) | Oficial | ~33 países bloqueados, close-only, restricciones regionales |
| 14 | [help.polymarket.com — Exchange Upgrade April 28, 2026](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026) | Oficial | Cutover V2, pausa ~1 h, books limpiados |
| 15 | [arXiv 2508.03474 — Unravelling the Probabilistic Forest](https://arxiv.org/abs/2508.03474) | Paper | Arbitraje en Polymarket: condiciones, ocurrencia, explotación |
| 16 | [arXiv 2605.00864 — Arbitrage Analysis in Polymarket NBA Markets](https://arxiv.org/abs/2605.00864) | Paper | 75M snapshots; mediana ~101 bps combinatorio; jackpot teórico no realizable |
| 17 | [arXiv 2604.03888 — PolySwarm](https://arxiv.org/html/2604.03888v1) | Paper | Métricas Brier/log-loss/calibración para evaluar señales en prediction markets |
| 18 | Prensa (KuCoin/BeInCrypto/Phemex, abril 2026) | Terceros | Contexto migración pUSD — **solo contexto, cifras "sin confirmar"** |
| 19 | Prensa/guías (cryptonews, datawallet, 2025-26) | Terceros | Relanzamiento US regulado (QCEX/CFTC, dic-2025), KYC US, política VPN — **"sin confirmar" en detalles** |

Marcados explícitamente **sin confirmar**: rates de fee exactos por categoría como constantes; relación `clob-client-v2` vs `ts-sdk`; nombre del crate Rust; API de Polymarket US regulado; política exacta de VPN/KYC internacional; quién paga gas por tipo de wallet; lista país-a-país definitiva (usar Geoblock API en runtime).
