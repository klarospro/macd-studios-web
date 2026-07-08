# Capa de Portafolio — asignación de capital multi-venue (diseño)

Estado: **diseño propuesto, pendiente aprobación de Moisés** antes de construir. No hay código de producción todavía.
Detalle completo (arquitectura, pseudocódigo, riesgo de dos niveles, cuentas de fondeo): `01_DETALLE_CAPA_PORTAFOLIO.md`. Fan-out a N cuentas propias por venue (mecánica técnica Deriv/Polymarket/MT5-fondeo): `02_DETALLE_FANOUT_MULTICUENTA.md` (investigación 2026-07-07).
Contexto: es la "plantilla maestra" que convierte varios adaptadores de broker (Deriv/Polymarket/MT5/fondeo) en una sola cartera gestionada. Se apoya en 09_RISK (reglas núcleo) y en la interfaz `BrokerAdapter` (`engine/`).

## Modelo de operador único (confirmado, 2026-07-07)
UN solo operador (Moisés) controla TODO el capital en SUS PROPIAS cuentas (Deriv, MT5/fondeos, Polymarket) repartido en N venues. El capital agrupado de clientes se diversifica ENTRE esas cuentas propias — los clientes NUNCA conectan API ni operan nada, solo ven resultados agregados (ver `17_SAAS`). "Fan-out" = repartir UNA señal ya aprobada por el risk gate entre N cuentas propias, no dar acceso a terceros.

## Qué es
Una capa por encima de los `BrokerAdapter` que ve el **capital y el riesgo agregados de TODOS los venues juntos**, reparte un presupuesto de riesgo entre ellos y decide en cuál(es) entrar ante una oportunidad — bajo un único techo de riesgo global.

## Por qué existe
Hoy el risk gate razona **por cuenta** (equity de una sola cuenta). El objetivo del producto es subir el capital total con la mejor gestión de riesgo repartiendo entre venues (ej. 10k → 2k Polymarket, 3k MT5, resto en fondeo). Sin esta capa, tres cuentas al 5% de riesgo cada una son 15% de riesgo real sobre el total, sin que nadie lo vea.

## Cuándo usarlo / cuándo NO
- SÍ: en cuanto haya ≥2 venues activos con capital real repartido.
- NO (todavía): con un solo venue, el risk gate por-cuenta actual basta. No añadir complejidad antes de tiempo.

## Ventajas / desventajas / costes
- Ventajas: techo de riesgo global real, diversificación entre venues no correlacionados, un solo cerebro reutilizable.
- Desventajas/costes: la correlación entre venues tan distintos (predicción vs CFD) es difícil de estimar con datos fiables; añade una capa de estado que debe reconciliarse con el equity real de cada broker. Escalar a N cuentas de MT5-fondeo exige infraestructura Windows nueva (ver `02_DETALLE_FANOUT_MULTICUENTA.md` §2.3).

## Alternativas
- Operar cada venue por separado con su propio límite (lo de hoy) — simple pero ciego al riesgo total.
- Un solo venue y no diversificar — descarta el objetivo del producto.

## Riesgos
- **Cuentas de fondeo** tienen reglas de drawdown EXTERNAS (del prop firm) más estrictas que las nuestras; violarlas = perder la cuenta. La capa debe respetar el límite más estricto de cada venue, no solo el nuestro.
- Correlación oculta: en un shock "risk-off" varios venues pueden caer juntos aunque parezcan independientes → el techo global se fija más ajustado que la suma de techos por venue.
- Divisa: Polymarket opera en USDC, otros en la moneda de la cuenta → todo se normaliza a una moneda común (USD) antes de sumar.
- **Nuevo (fan-out)**: repartir la misma señal entre varias wallets Polymarket del mismo mercado puede auto-competir el precio; enrutar cada oportunidad a UN solo venue por "familia de mercado" salvo que el capital exceda la profundidad de un solo libro. Escalar a N cuentas del MISMO prop firm con la misma estrategia es zona gris contractual — verificar con soporte del firm (ver `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md` y `02_DETALLE_FANOUT_MULTICUENTA.md` §3).

## Mejores prácticas + ejemplo mínimo
- Riesgo de **dos niveles**: una orden debe pasar el risk gate LOCAL del venue Y el gate GLOBAL de portafolio.
- Empezar con **asignación fija por venue** definida por Moisés (su ejemplo son importes fijos) + techo de riesgo global; pasar a asignación dinámica por edge solo cuando 13_BACKTESTING valide edges reales.
- Ejemplo: total 10k, techo global 5% = 500€ de riesgo abierto máx. simultáneo entre TODOS los venues, aunque cada venue tenga su propio sub-techo.
- Fan-out concurrente (no secuencial) entre venues candidatos, con circuit breaker por-venue independiente del HALT global (ver `02_DETALLE_FANOUT_MULTICUENTA.md` §4).

## Decisiones tomadas (delegadas por Moisés 2026-07-03, defaults de demo, ajustables con datos)
- **Política de asignación: FIJA** para empezar (Moisés fija importes por venue). Migración a dinámica por edge solo tras validar edges en demo/13_BACKTESTING.
- **Techo de riesgo global: 4%** del capital TOTAL (más conservador que el 5% per-cuenta, como colchón por correlación cross-venue desconocida). El límite efectivo de cada orden = MÍNIMO(global 4%, sub-techo del venue, gate local 09_RISK, límite externo del prop firm).
- **Drawdown a nivel portafolio**: espeja 09_RISK sobre el capital total (3% diario / 10% total, HALT global), y CADA venue conserva además el suyo (crítico en cuentas de fondeo).
- **Correlación cross-venue**: diferida a 13_BACKTESTING con datos reales; hasta entonces se asume vía el colchón del techo global.

## Sin confirmar (requieren dato real o confirmación de Moisés)
- Importes concretos por venue (los pone Moisés según capital real; ejemplo guía: 2k Poly / 3k MT5 / resto fondeo).
- Método exacto de correlación cross-venue (diferido a 13_BACKTESTING).
- Viabilidad y coste del puente técnico para N cuentas MT5-fondeo (ver `02_DETALLE_FANOUT_MULTICUENTA.md`).
- Política exacta de cada prop firm sobre operar N cuentas propias con la misma estrategia simultánea.

## Fuentes
Diseño derivado de 09_RISK (reglas núcleo aprobadas) y de arquitectura estándar de fondos multi-estrategia. Parámetros numéricos = defaults conservadores, no cifras validadas — sujetos a backtesting (13_BACKTESTING) y aprobación de Moisés. Fan-out: `metatrader5.com/en/news/1383` (MAMM oficial), `ftmo.com/en/forbidden-trading-practices/`, `docs.polymarket.com` — ver `02_DETALLE_FANOUT_MULTICUENTA.md` para el detalle completo.
