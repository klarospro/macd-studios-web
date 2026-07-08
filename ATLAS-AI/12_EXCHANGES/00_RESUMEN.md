# Venue principal por mercado — Acciones (MT5) / Forex (Deriv vs MT5) / Predicción (Polymarket)

Estado: investigación 2026-07-07, pendiente aprobación de Moisés antes de elegir bróker(s) concreto(s). Detalle completo (tabla ampliada, TradingView, fuentes): `01_DETALLE_COMPARATIVA_VENUES_PRINCIPALES.md`.
Nota de alcance: esta carpeta se reserva también para exchanges cripto (Binance/Bybit, ver `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md`) — ese subtema sigue ⬜ sin empezar; este documento cubre la pregunta concreta de Moisés sobre venue principal por mercado (acciones/forex/predicción) + fondeos.

## 0. Aclaración previa: TradingView NO es un fondeo ni un broker
Confirmado con fuente oficial (`tradingview.com/support/solutions/43000529348-about-webhooks/`, docs y disclaimers de brokers integrados): TradingView es **charting + alertas**. Un webhook de TradingView solo hace un HTTP POST con el mensaje de la alerta a una URL — **no ejecuta órdenes, no custodia fondos, no es un broker regulado**. El flujo real es: TradingView detecta la señal → webhook → un bot/bridge propio recibe el POST → ESE bot ejecuta la orden en el broker real (MT5 vía EA, Deriv vía Native API, etc.). **No existe forma de "hacer un fondeo con TradingView"**: el fondeo lo da la prop firm sobre una cuenta MT4/MT5 (o similar); TradingView, como mucho, es el origen de la señal que se reenvía a esa cuenta.

## 1. Comparativa (ver tabla completa y fuentes en el detalle)
| Venue | Headless nativo | Compatible con fondeo | Activos | Fiabilidad |
|---|---|---|---|---|
| **Deriv Native API** (forex propio) | Sí (WebSocket, ya operado en este proyecto) | No (Deriv no es prop firm) | Forex, sintéticos, cripto, algo de índices/commodities | Alta — validada end-to-end en 08_TRADING |
| **MT5 retail** (acciones/forex, ej. Pepperstone/IC Markets/Admirals — sin confirmar cuál elegir) | No — exige terminal Windows + EA (o bridge no oficial: MetaApi.cloud) | Sí — vehículo estándar de casi toda prop firm | Forex + stock CFDs + índices + commodities (amplio) | Alta si el broker es serio; depende de terminal Windows como punto de fallo extra |
| **Interactive Brokers** (alternativa acciones reales) | Oficial, headless posible vía IB Gateway (patrón de comunidad, no declarado "headless" literalmente por IBKR) | No — sin producto de fondeo | Acciones/ETFs REALES (no CFD), opciones, futuros | Alta, broker regulado top, pero sin ecosistema de fondeo |
| **Polymarket API/CLOB** (predicción) | Sí (REST/WS + firma de wallet, sin terminal) | No aplica | Solo mercados de predicción binarios | Media — SDKs en beta (post V2, abril 2026), sin testnet oficial |
| **MT5 fondeo** (FTMO, referencia verificada oficialmente) | Igual que MT5 retail | Es la prop firm en sí | Forex + según firm: índices/stocks/commodities | Alta en reglas verificadas, pero cambian sin aviso |

## 2. Recomendación final
- **Acciones/índices**: PRINCIPAL = **MT5** con un bróker retail que ofrezca buena gama de stock CFDs (candidatos a cotizar: Pepperstone, IC Markets, Admirals — **sin confirmar cuál concretamente**), + EA local para automatizar. No hay alternativa headless oficial en el ecosistema MT5 — todos los brokers retail comparten la misma limitación (terminal + EA), la diferencia está en comisiones/activos, no en automatización. Alternativa a evaluar SOLO para capital propio sin fondeo: **Interactive Brokers** (API oficial, más headless-friendly, acciones reales) — pero sin compatibilidad de fondeo, así que no sirve como vehículo de escalado vía prop firm.
- **Forex**: PRINCIPAL = **Deriv Native API** para la cuenta propia de Moisés — ya headless, ya validada en este proyecto, cero infraestructura nueva. MT5 (vía un prop firm tipo FTMO) queda como el vehículo específico para **fondeos de forex**, no como principal, porque Deriv no ofrece fondeos.
- **Predicción**: PRINCIPAL = **Polymarket**, vía su API/CLOB oficial — el más nativamente headless de los tres mercados, con las salvedades ya documentadas en `10_POLYMARKET` (jurisdicción, sin testnet, SDKs en beta).
- **Hub técnico principal**: el motor central (Node/TypeScript, VPS Hetzner Linux ya en uso) sigue siendo el cerebro para Deriv y Polymarket — ambos headless nativos, sin infraestructura nueva. **MT5 (fondeos de forex Y de acciones) es la única pieza que obliga a una VPS Windows separada** corriendo N terminales con EAs puente — un solo hub Windows puede servir tanto a fondeos de forex como de acciones (ver `11_MT5/02_DETALLE_FONDEOS_MT5_MULTICUENTA.md`).

## Sin confirmar
Bróker MT5 retail concreto a elegir para acciones (comisiones/spreads no cotizados); si el prop firm elegido para acciones ofrece drawdown estático (FundedNext se menciona en fuentes secundarias como amplio en instrumentos, no verificado oficialmente); cobertura exacta de instrumentos de la Native API de Deriv vs Deriv X/MT5 (si la Native API cubre acciones reales o solo Deriv X/MT5 las ofrece).

## Fuentes
`tradingview.com/support` (webhooks, oficial). `developers.deriv.com`, `deriv.com/trading-platforms/deriv-mt5` (oficial). `interactivebrokers.com/en/trading/ib-api.php`, `interactivebrokers.github.io/tws-api` (oficial). `docs.polymarket.com` (oficial, ya citado en 10_POLYMARKET). `metaapi.cloud` (tercero, no oficial). Resto de fuentes secundarias de mercado (prop firms MT5) marcadas explícitamente en el detalle.
