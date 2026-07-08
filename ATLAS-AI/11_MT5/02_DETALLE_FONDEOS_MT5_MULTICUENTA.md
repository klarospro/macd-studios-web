# Detalle — MT5 para cuentas de FONDEO (distinto del CFD propio de Deriv)

Estado: investigación 2026-07-07. Aclara un matiz importante sobre la decisión ya tomada en `00_RESUMEN.md` ("usar Native API, no MT5"), que aplicaba al CFD propio de Deriv, NO a cuentas de fondeo de terceros (prop firms, ver `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md`).

## 1. El matiz
`00_RESUMEN.md` de esta carpeta decide correctamente evitar MT5 para el trading CFD directo de Moisés en Deriv, porque Deriv ofrece una Native API (WebSocket) que cubre ese caso sin terminal Windows. **Ese razonamiento no aplica a las cuentas de fondeo (prop firms)**: casi ninguna prop firm ofrece una API pública equivalente — entregan una cuenta MT4/MT5 (o cTrader) y el trader debe operar ese terminal, manual o vía EA. No hay "Native API de la prop firm" que sustituya al terminal.

## 2. Automatización disponible para cuentas de fondeo MT5
- **Oficial de MetaQuotes**: el único producto de gestión multi-cuenta oficial es el plugin server-side **MAMM** (Multi-Asset Management Module, `metatrader5.com/en/news/1383`, `metaquotes.net/en/company/news/4844`), licenciado a BRÓKERES/gestores profesionales para operar cuentas de INVERSORES desde una cuenta máster. No está disponible para un trader retail/fondeado operando SUS PROPIAS cuentas en un bróker que no es él mismo — no aplica a nuestro caso.
- **EA local (MQL5)**: la vía estándar y soportada: un Expert Advisor corriendo DENTRO del terminal MT5 de cada cuenta, en una máquina Windows. Para automatizar desde el motor central (Node/TypeScript), el EA necesita un puente hacia afuera del terminal (archivo compartido, named pipes, socket local, o llamada HTTP saliente si el firm lo permite — MQL5 soporta `WebRequest()` a URLs en una allowlist configurada en el terminal).
- **Proyectos comunitarios NO oficiales** (ya detectados en `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md`): `ariadng/metatrader-mcp-server` (32 herramientas, servidor de cotizaciones WS, ejecución remota vía SSE desde VPS Windows) y servicios de terceros tipo MetaApi.cloud que exponen una API REST/WS sobre un terminal MT5 real. Ninguno es oficial de MetaQuotes ni del prop firm — añaden un tercero con acceso potencial a operar la cuenta (superficie de riesgo adicional, sin auditar).

## 3. Implicación de infraestructura
Escalar a N cuentas de fondeo MT5 requiere **N terminales MT5 corriendo en Windows** (una VPS Windows, posiblemente varias instancias de terminal en la misma VPS si los recursos alcanzan — sin confirmar cuántas instancias soporta razonablemente una VPS Windows de gama media). Esto reabre, ahora con justificación concreta, el bloqueo ya anotado en `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md` ("MT5 requiere Windows, VPS Linux actual no sirve"). Coherente con `02_ARCHITECTURE/00_RESUMEN.md` §"señales para migrar": esto sería un candidato claro a servicio/proceso separado del monolito, corriendo en su propia VPS Windows, NO en el Hetzner Linux ni en Vercel.

## 4. Recomendación
No construir nada de esto hasta que Moisés elija un prop firm concreto y confirme (a) si ese firm permite automatización/EA, (b) si ofrece alguna vía distinta a MT4/MT5 (algunos firms de futuros sí tienen webhook/API propio, ver `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md` §3), y (c) el coste/tamaño de la VPS Windows necesaria. Hasta entonces, este documento queda como mapa de opciones, no como plan aprobado.

## Sin confirmar
- Cuántos terminales MT5 soporta razonablemente una sola VPS Windows sin degradar la ejecución.
- Coste de una VPS Windows adecuada (Hetzner y otros proveedores ofrecen Windows, pero no se ha cotizado en esta sesión).
- Fiabilidad/auditoría de `ariadng/metatrader-mcp-server` o de proveedores tipo MetaApi.cloud — ninguno se ha evaluado en profundidad ni probado.

## Fuentes
`metatrader5.com/en/news/1383`, `metaquotes.net/en/company/news/4844` (MAMM oficial, confirmado que es para brókeres/gestores, no retail). `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md` (bloqueo Windows, proyecto comunitario detectado). `11_MT5/01_DETALLE_API_DERIV.md` (contraste: por qué Deriv sí tiene Native API y no necesita esto).
