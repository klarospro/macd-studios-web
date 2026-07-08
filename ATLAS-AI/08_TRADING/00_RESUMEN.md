# Motor de trading — arquitectura en modo paper (Fase 3, paso 1)

Estado: diseño hecho, pendiente aprobación de Moisés. Modo actual: 100% PAPER/DEMO (cuenta Deriv-Demo, dinero virtual). Ninguna cuenta real se conecta sin aprobación explícita de Moisés con los límites de 09_RISK ya escritos y aprobados.
Detalle (interfaz del adaptador, ciclo de vida completo, esquema de auditoría): `01_DETALLE_ADAPTADOR_Y_CICLO_DE_VIDA.md`. Fondeos/prop firms (reglas, automatización, diseño de estrategia compatible): `02_DETALLE_FONDEOS_PROP_FIRMS.md` (investigación 2026-07-07).

## 1. Adaptador de broker
Qué: interfaz común `BrokerAdapter` que implementa cada broker: conectar, autenticar, cotizar, enviar orden, consultar posiciones/cuenta, cancelar orden, desconectar. Vive en `lib/trading/adapters/` dentro del monolito modular (decisión ya tomada en 02_ARCHITECTURE).
Por qué abstraerlo: la estrategia y el risk gate NUNCA deben saber qué broker hay detrás — permite sustituir Deriv por MT5/exchanges sin tocar estrategia ni riesgo, y habilita un adaptador simulado/mock para testing sin llamar a ningún broker real.
Deriv ahora: API WebSocket de Deriv (`api.deriv.com`), cuenta Deriv-Demo (dinero virtual), requiere `app_id` y token de API — endpoints exactos, formato de autenticación y límites de tasa: **sin confirmar**, pendiente de verificar contra la documentación oficial de Deriv al implementar el adaptador (siguiente paso de Fase 3, no este).
Después: MT5 (11_MT5 — bloqueado por requisito de terminal Windows, ver 00_FOUNDATION/03) y exchanges cripto (12_EXCHANGES) implementan el mismo `BrokerAdapter`.

## 2. Ciclo de vida de una orden en paper
1. Estrategia genera señal (instrumento, dirección, entrada, stop, take-profit) — módulo de estrategia, sin acceso a ejecución.
2. Risk gate (09_RISK) evalúa en orden: circuit breakers → drawdown → exposición/correlación → sizing (regla 1% techada por Kelly fraccionado). Si rechaza → paso 4b.
3. Si aprueba: se envía la orden con el tamaño ya calculado al adaptador de broker (Deriv-Demo) — orden real en el servidor demo de Deriv, dinero virtual, condiciones de mercado reales; se registra el fill/confirmación del broker.
4a. Toda orden ENVIADA (aprobada) se registra en `trading_audit_log`.
4b. Toda orden RECHAZADA por el risk gate se registra igualmente, con motivo y regla que la disparó — nunca se descarta sin dejar rastro.

## 3. Separación de responsabilidades
- `lib/trading/strategy/`: genera señales; no llama al broker ni puede saltarse el risk gate.
- `lib/trading/risk/` (09_RISK): valida y calcula tamaño; sin acceso directo al mercado.
- `lib/trading/execution/`: solo llama al `BrokerAdapter` con órdenes YA aprobadas; no decide si operar.
- Fronteras impuestas por convención de carpetas + ESLint boundaries (mismo patrón que 02_ARCHITECTURE), no por proceso separado — coherente con la decisión de monolito modular.

## 4. Auditoría
Cada evento (señal, resultado del risk gate, orden enviada, fill, orden rechazada) se escribe en `trading_audit_log` (append-only, WORM, RLS por tenant — definido en 18_SECURITY): `tenant_id, actor, acción, params, timestamp, estado antes/después`. INSERT solo desde backend de confianza; UPDATE/DELETE revocado para todos. Las órdenes rechazadas llevan además `motivo` y `regla_disparada`.

## 5. Fondeos / prop firms (resumen — detalle en `02_DETALLE_FONDEOS_PROP_FIRMS.md`)
FTMO (única fuente verificada oficialmente en esta sesión): profit target 10%/5% por fase, max daily loss 3-5%, max drawdown total 10% (trailing en 1-Step, estático en 2-Step), ≥4 días mínimos de trading (2-Step), EA/algo trading SÍ permitido con restricciones (no exploit de errores, no manipulación multi-cuenta, no gap trading, límite 2000 requests/día, no ceder acceso a terceros). Reglas varían MUCHO por firm y cambian sin aviso — verificar siempre contra la web oficial del firm elegido. Para no violar el drawdown con una racha normal de trend-following: preferir firms con drawdown ESTÁTICO, buffer interno al 50-70% del límite del firm (no operar al límite exacto), sizing más conservador que el 1% propio, y ajustar a la "Best Day Rule" (consistencia) si el firm la tiene.

## 6. Diferido a pasos siguientes de Fase 3
- **11_MT5**: conexión real a MT5 — requiere VPS Windows aparte (ver 00_FOUNDATION/03) — no se aborda aquí. Para cuentas de FONDEO específicamente, ver `11_MT5/02_DETALLE_FONDEOS_MT5_MULTICUENTA.md`.
- **12_EXCHANGES**: adaptador para testnet de exchange cripto (Binance/Bybit) — no se aborda aquí.
- **13_BACKTESTING**: motor de simulación histórica, distinto de "paper" (backtesting usa datos pasados; paper usa mercado en vivo con dinero virtual) — no se aborda aquí.
- **Conexión a cuentas reales**: bloqueada hasta aprobación explícita de Moisés con los límites de 09_RISK ya aprobados y en producción.

## Sin confirmar
- Endpoints exactos, formato de autenticación y límites de tasa de la API de Deriv.
- Si Vercel (serverless) soporta bien una conexión WebSocket persistente a Deriv, o si el motor necesita extraerse como proceso propio en el VPS (señal ya anotada en 02_ARCHITECTURE, sin resolver).
- Formato/prefijo exacto de las cuentas demo de Deriv.
- Firm(s) de fondeo concreto(s) que usará Moisés — ver `02_DETALLE_FONDEOS_PROP_FIRMS.md` para todo lo que depende de esta decisión.

## Fuentes
Documentación oficial de Deriv API (api.deriv.com): NO consultada en esta sesión — prioridad #1 de fuente para el siguiente paso de implementación. 02_ARCHITECTURE/00_RESUMEN.md (monolito modular, ya confirmado). 18_SECURITY/00_RESUMEN.md (patrón de auditoría append-only, ya confirmado). `ftmo.com/en/trading-objectives/` y `ftmo.com/en/forbidden-trading-practices/` (fondeos, confirmado 2026-07-07) — ver `02_DETALLE_FONDEOS_PROP_FIRMS.md` para el resto de fuentes.
