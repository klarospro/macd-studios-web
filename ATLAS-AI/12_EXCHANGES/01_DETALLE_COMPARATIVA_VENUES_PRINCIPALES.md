# Detalle — Comparativa de venues principales por mercado (acciones, forex, predicción) + fondeos

Estado: investigación 2026-07-07, respuesta directa a pregunta de Moisés. Complementa `00_RESUMEN.md`. Se apoya en investigación previa de `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md`, `10_POLYMARKET/00_RESUMEN.md`, `11_MT5/00_RESUMEN.md` y `11_MT5/02_DETALLE_FONDEOS_MT5_MULTICUENTA.md`.

## 1. TradingView — qué es realmente (fuente oficial)
Confirmado en `tradingview.com/support/solutions/43000529348-about-webhooks/`: "A TradingView webhook notifies your external app when an alert is triggered... send data via an HTTP POST request to a URL you provide." Es decir: **TradingView solo entrega un mensaje HTTP cuando salta una alerta**. No ejecuta órdenes, no gestiona posiciones, no custodia fondos, no está regulado como broker. Confirmado también por el propio ecosistema de brokers integrados con TradingView (ej. página de soporte de Moomoo sobre su integración): "TradingView is not a broker... the connected broker provides the means for execution and custody of funds... is not regulated as a broker."

**Consecuencia directa para el plan de Moisés**: "hacer fondeos con TradingView" no es una operación que exista — el fondeo (challenge, cuenta financiada, reglas de drawdown) lo otorga la prop firm sobre una cuenta MT4/MT5/cTrader concreta. Lo único que TradingView puede aportar es ser el ORIGEN de una señal (ej. una estrategia Pine Script con alertas) que se reenvía por webhook a un bot/bridge propio, el cual entonces sí ejecuta en el broker/cuenta de fondeo real. Ese bridge NO es un producto de TradingView — hay servicios de terceros no oficiales (Autoview, TradingConnector, webhooks propios a un VPS con EA) que hacen ese puente, con el mismo tipo de riesgo de "tercero no auditado" ya señalado para MT5 en `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md`.
**Recomendación**: si en algún momento se usa TradingView (p. ej. para validar visualmente una señal o generar alertas complementarias), tratarlo SIEMPRE como fuente de señal, nunca como ejecutor — la señal debe pasar igualmente por el risk gate (09_RISK) y el `BrokerAdapter` correspondiente antes de tocar una cuenta real, exactamente igual que cualquier otra señal del motor.

## 2. Acciones/índices — MT5 y alternativas

### 2.1 MT5 retail (visión general, no específico de un broker)
Todos los brokers retail que ofrecen MT5 (Pepperstone, IC Markets, Admirals, XM, y decenas más) comparten la MISMA limitación de automatización: no hay API REST/WebSocket oficial del broker — la única vía "oficial" de MetaQuotes es correr un EA (MQL5) DENTRO del terminal MT5, que debe estar corriendo 24/7 (Windows, o Wine sin garantías). No existe diferenciación de "viabilidad de automatización" entre brokers MT5 — la diferencia entre ellos está en:
- **Comisiones/spreads**: varían por broker y no se cotizaron en esta sesión (sin confirmar cifras concretas).
- **Gama de stock CFDs disponibles**: varía; algunos brokers retail tienen decenas de acciones US/EU, otros cientos.
- **Regulación/jurisdicción**: relevante para elegibilidad de Moisés (España/UE) — sin confirmar cuál de estos brokers acepta clientes españoles con qué régimen regulatorio exacto.
**Automatización sin terminal**: solo vía bridges NO oficiales (`MetaApi.cloud` — confirmado como servicio de terceros, no producto de MetaQuotes, ofrece API REST/WebSocket sobre un terminal MT5 corriendo en SU infraestructura cloud, soporta "any MetaTrader broker"; `MTsocketAPI` — similar, de terceros). Ambos añaden un intermediario con acceso a las credenciales/operativa de la cuenta — evaluar el riesgo de custodia/API keys de ese tercero antes de usarlos, especialmente en cuentas de fondeo donde ceder acceso a terceros puede violar las reglas del prop firm (`08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md` §4, punto 8: "ceder acceso de cuenta a terceros" está expresamente prohibido en FTMO).

### 2.2 Alternativa: Interactive Brokers (acciones REALES, no CFD)
API oficial (`interactivebrokers.com/en/trading/ib-api.php`, `interactivebrokers.github.io/tws-api`): TWS API en Python/Java/C++/C#, permite automatizar estrategias, consultar cuenta/posiciones en tiempo real, y colocar órdenes programáticamente. Existen dos clientes: TWS (con interfaz visual) e **IB Gateway** (mínimo, sin configuración compleja, pensado para integraciones). Ejecución headless: la comunidad documenta ampliamente correr IB Gateway en un contenedor Docker con IBC gestionando el login (patrón extendido en la industria, **no es una declaración oficial de IBKR de "modo headless"**, pero es el patrón estándar de facto). Cubre acciones/ETFs REALES (no CFD), opciones, futuros — mercado y régimen distintos a MT5.
**Limitación clave para este proyecto**: IBKR NO tiene producto de "fondeo"/challenge — es un broker tradicional que requiere capital propio depositado, cuenta de margen, KYC/compliance más estricto, posibles comisiones/mínimos de inactividad (cifras no cotizadas, sin confirmar). Útil SOLO si Moisés decide operar acciones con capital 100% propio sin buscar apalancamiento vía prop firm.

### 2.3 Recomendación acciones
Si el objetivo incluye escalar con fondeos → **MT5 es la única vía viable** (ningún prop firm de acciones ofrece IBKR ni una API propia sin terminal, según lo investigado). Elegir el broker/prop firm MT5 concreto queda pendiente de cotizar comisiones/activos (sin confirmar). Si se quiere una cuenta 100% propia de acciones reales sin depender de terminal Windows, IBKR es la alternativa más sólida y oficial — pero es un camino PARALELO, no sustituye al MT5 de fondeo.

## 3. Forex — Deriv Native API vs MT5

### 3.1 Deriv Native API (ya investigado y validado en 08_TRADING/11_MT5)
Headless nativo (WebSocket puro, sin terminal), ya operado end-to-end en modo demo en este proyecto. Cubre forex entre sus 250+ instrumentos (confirmado por `deriv.com/trading-platforms/deriv-mt5`: "Forex, Stocks & More" en su descripción de plataformas; la Native API de contratos (`api.deriv.com`) es la vía histórica de Deriv para forex/sintéticos/commodities/cripto — **sin confirmar explícitamente si CUBRE acciones reales o si esas solo están en Deriv X/MT5**, matiz relevante señalado también en `00_RESUMEN.md`). Deriv **no ofrece producto de fondeo/prop firm** (no es su modelo de negocio) — por tanto solo sirve como venue de **capital propio**, nunca como vehículo de escalado vía fondeo.

### 3.2 MT5 para forex (rol: solo fondeos)
Mismo bloqueo de automatización que en acciones (terminal + EA, sin API oficial). Su único rol en el mercado forex dentro de este modelo es ser el vehículo de las **cuentas de fondeo** (FTMO y comparables casi siempre operan sobre MT4/MT5).

### 3.3 Recomendación forex
**Deriv Native API = PRINCIPAL** para la cuenta propia (cero fricción, ya validada, cero infraestructura nueva). **MT5 = vehículo de fondeo forex**, en paralelo, no en sustitución.

## 4. Polymarket — predicción (resumen de lo ya investigado en 10_POLYMARKET)
API pública oficial (CLOB + Gamma + WSS), SDKs oficiales (`Polymarket/py-sdk`, `Polymarket/ts-sdk`, en beta tras la migración V2 de abril 2026), autenticación por firma de wallet (L1→L2), sin necesidad de terminal ni proceso de terceros — el más nativamente headless de los tres mercados. Apto como **PRINCIPAL de predicción**, con las salvedades ya documentadas: verificar jurisdicción de Moisés antes de fondear, no existe testnet oficial (mitigar con simulador interno), SDKs en beta (pin de versiones obligatorio), riesgo de resolución vía oráculo UMA. No aplica el concepto de "fondeo" a Polymarket (no hay prop firms de mercados de predicción, sin confirmar que exista alguno).

## 5. Fondeos — compatibilidad con automatización y con drawdown estático
- **FTMO** (única fuente verificada oficialmente en esta sesión, ver `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md`): EA/automatización SÍ permitida con restricciones concretas; drawdown ESTÁTICO en el programa 2-Step (mejor para trend-following), TRAILING en 1-Step. Instrumentos: forex + lo que confirme su programa de acciones/índices (no verificado en detalle en esta sesión específicamente para stock CFDs de FTMO).
- **Otros firms mencionados en fuentes secundarias (NO verificadas oficialmente esta sesión)**: FundedNext se cita como el de mayor amplitud de instrumentos incluyendo stock CFDs individuales (Apple, Amazon, Tesla, Meta, Google) junto a forex/cripto; varios firms ofrecen programas con drawdown estático (Blueberry Funded, Velotrade PRO 1-Step) — **verificar cada uno contra su web oficial antes de decidir, estas cifras cambian**.
- **Automatización**: en NINGÚN prop firm MT5 investigado existe una API pública propia — todos comparten la limitación de terminal + EA. La "compatibilidad con automatización" no es un criterio que diferencie entre firms de forma técnica; lo que sí varía por firm es si SU REGLAMENTO permite EAs (sí en FTMO, FXIFY, The5ers, BrightFunded, Darwinex Zero; no o restringido en Alpha Futures, Apex, Maven Trading, Trade The Pool — fuentes secundarias, ver `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md` §3).
- **Recomendación**: elegir el/los firm(s) por (a) si su reglamento oficial permite EA, (b) drawdown estático si la estrategia es de tendencia, (c) gama de instrumentos (forex vs stock CFDs) según qué mercado se quiera fondear — y confirmar los tres puntos contra la web oficial del firm antes de comprometer el fee del challenge.

## 6. Hub técnico — consolidado
- **VPS Linux Hetzner (ya en uso)**: sigue siendo el hogar del motor central (Node/TypeScript) para Deriv (Native API) y Polymarket (API pura) — ninguno de los dos necesita Windows ni terminal.
- **VPS Windows (nueva, solo si se activan fondeos MT5)**: necesaria para correr N terminales MT5 con EA — sirve TANTO a fondeos de forex COMO de acciones (un solo hub Windows, no uno por mercado). Confirma y amplía la señal ya anotada en `02_ARCHITECTURE/00_RESUMEN.md` punto 5.
- **Interactive Brokers (si se activa acciones propias sin fondeo)**: puede correr headless (IB Gateway + Docker/IBC) en el MISMO VPS Linux — no necesita Windows, a diferencia de MT5. Esto lo hace más barato de operar en infraestructura si Moisés decide tener una pata de acciones reales sin fondeo, aunque no sustituye al MT5 de fondeo.

## Sin confirmar (lista explícita)
- Bróker MT5 retail concreto para acciones (comisiones, spreads, elegibilidad para clientes españoles).
- Si la Native API de Deriv (contratos WebSocket) cubre acciones reales, o si esas solo están disponibles vía Deriv X/MT5.
- Si FTMO (u otro firm concreto elegido) permite stock CFDs y con qué condiciones de drawdown.
- Coste/fiabilidad de un bridge no oficial (MetaApi.cloud, MTsocketAPI) si se decide automatizar MT5 sin EA local — no evaluado en profundidad.
- Comisiones y mínimos de cuenta de Interactive Brokers para el caso de uso concreto de Atlas.

## Fuentes
`tradingview.com/support/solutions/43000529348-about-webhooks/` (oficial, confirmado). `developers.deriv.com`, `deriv.com/trading-platforms/deriv-mt5` (oficial). `interactivebrokers.com/en/trading/ib-api.php`, `interactivebrokers.github.io/tws-api/introduction.html` (oficial). `docs.polymarket.com` (oficial, ya citado extensamente en `10_POLYMARKET`). `metaapi.cloud` (tercero, no oficial, confirmado explícitamente como no-oficial). `ftmo.com/en/trading-objectives/`, `ftmo.com/en/forbidden-trading-practices/` (oficial, ya citado en `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md`). Fuentes secundarias de mercado sobre otros prop firms (aquafutures.io, goatfundedtrader.com, velotrade.com, atlasfunded.com) — marcadas explícitamente como NO oficiales, solo contexto comparativo.
