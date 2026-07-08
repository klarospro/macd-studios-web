# MCP de trading — investigación inicial (Fase 0)

Estado: exploratorio. NINGUNO de estos se conecta a cuentas reales sin pasar por Fase 3 (modo demo primero) y aprobación explícita.

## MetaTrader 5 (Forex/CFD)
Varios servidores MCP de comunidad activos en 2026, ninguno oficial de MetaQuotes:
- `Qoyyuum/mcp-metatrader5-server` (Python, uv) — expone initialize/login/símbolos/velas/órdenes, incluye guías de recursos (`mt5://trading_guide`, etc.)
- `ariadng/metatrader-mcp-server` — más completo: 32 herramientas, servidor de cotizaciones WebSocket en tiempo real, skill de Claude incluida, soporta ejecución remota vía SSE (VPS Windows con MT5 instalado + Claude Code conectándose por HTTP).

**Limitación crítica confirmada:** MT5 requiere el terminal corriendo en Windows. Nuestro VPS de n8n es Linux (Hetzner). Esto significa que un bróker/MT5 necesitaría una VPS Windows aparte (o Wine, sin garantías) — **no se puede meter en el mismo Hetzner CX32 Linux sin más investigación**. Pendiente para Fase 3: evaluar VPS Windows dedicado solo si se prioriza Forex/CFD, o descartar MT5 si el foco inicial es cripto.

**Advertencia de seguridad de la propia comunidad:** el protocolo MCP no incluye autenticación por defecto; si se expone un servidor MT5 por red, hay que restringir por firewall/IP o túnel SSH. Nunca exponer sin esto.

## Polymarket (mercados de predicción)
Existen varios MCP de comunidad (ej. `whitmorelabs/polymarket-mcp`, `fernandezpablo85/polymarket-mcp`) con herramientas de: estimación de slippage, escaneo de liquidez, detección de arbitraje, feeds de precio, inteligencia de wallet y riesgo de portfolio. Ninguno es oficial de Polymarket. Nivel de mantenimiento variable — revisar actividad del repo antes de depender de uno en producción.

## Binance / Exchanges cripto
No se encontró un MCP "Binance" único y dominante — el ecosistema cripto tiene muchas herramientas dispersas (terminales de inteligencia on-chain, bots de funding-rate arbitrage, trackers de whales) más que un MCP estándar de trading spot/futuros. Pendiente Fase 3: evaluar si conviene un MCP genérico de exchange (ccxt-based) en vez de uno específico de Binance.

## Conclusión Fase 0
No instalar nada todavía. Para Fase 3: empezar por UNO (probablemente cripto vía exchange con API bien documentada, por ser Linux-friendly, antes que MT5 que exige Windows) y validar en modo demo antes de sumar más.
