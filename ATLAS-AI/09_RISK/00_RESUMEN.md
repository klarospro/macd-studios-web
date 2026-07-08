# Gestión de riesgo — reglas núcleo (Fase 3, paso 1)

Estado: diseño hecho, pendiente aprobación de Moisés antes de activar (incluso en paper) el risk gate en el motor.
Prioridad del producto (CLAUDE.md): 1) preservación de capital, 2) gestión de riesgo — estas reglas son el núcleo de ambas.
Detalle completo (fórmulas, tablas, orden de evaluación del risk gate): `01_DETALLE_FORMULAS_Y_PARAMETROS.md`.

## 1. Riesgo por operación (position sizing)
Qué/por qué: % del capital que se pierde si salta el stop-loss; acota el daño de una sola operación pase lo que pase.
Cálculo: `Riesgo_€ = Capital × Riesgo%` · `Tamaño = Riesgo_€ / |Entrada − Stop|` (ajustado a valor de pip/tick del instrumento).
Default: **1%** (rango 0.5%–2%) — heurística estándar de la industria (Van Tharp, position sizing), NO ley matemática probada.
Cuándo NO: nunca sin stop-loss definido — no operar sin stop.
Riesgo: slippage/gaps hacen que la pérdida real supere la distancia al stop calculada.

## 2. Kelly fraccionado
Qué: fracción óptima de capital para crecimiento geométrico, dado edge conocido: `f* = p − (1−p)/b`.
Por qué NUNCA Kelly completo: asume p (prob. acierto) y b (ratio ganancia/pérdida) EXACTOS; en trading real son estimaciones con error — Kelly completo con edge sobreestimado produce drawdowns de ruina. Fuente: Kelly (1956); Ed Thorp aplicó fracciones reducidas en la práctica por este motivo.
Default: **1/4 Kelly** mientras el edge no esté validado con muestra grande y out-of-sample; máximo **1/2 Kelly** con edge validado. Nunca por encima de 1/2.
Uso: techo teórico adicional — se aplica siempre el MENOR entre Kelly fraccionado y el límite duro de la regla 1, nunca Kelly solo.
Cuándo NO: sin historial suficiente para estimar p y b con confianza (N mínimo: sin confirmar) → usar solo la regla 1 (% fijo).
Riesgo: no-estacionariedad del edge; las operaciones sucesivas no son independientes como asume la fórmula clásica.

## 3. Drawdown máximo (diario y total)
Default diario: **3%** (rango 2–5%) → al tocarlo, no se abren operaciones nuevas el resto del día (las abiertas se gestionan, no se liquidan por esto).
Default total (desde máximo histórico de equity): **10%** (rango 8–15%) → HALT total del sistema (kill-switch), requiere revisión manual de Moisés para reanudar.
Escalón intermedio: al 50% del límite diario, reducir automáticamente el riesgo por operación a la mitad.
Por qué: recuperarse de una pérdida grande exige una ganancia proporcionalmente mayor (−20% requiere +25%; −50% requiere +100%) — cortar pronto es más barato que "esperar".
Cuándo NO: sin excepciones — junto con el circuit breaker, es la regla más innegociable del sistema.
Riesgo: parar justo antes de un rebote tiene coste real, aceptado frente al riesgo de ruina; no recalibrar el límite ad-hoc tras una mala racha.

## 4. Exposición concurrente máxima y correlación
Cálculo: `Riesgo_agregado = Σ riesgo_€ de posiciones abiertas` ≤ techo (default **5%**, rango 4–6%) aunque cada posición cumpla la regla 1 individualmente. Nº máx. de posiciones concurrentes: default **3** (rango 3–5).
Correlación: instrumentos con `|ρ| > 0.7` (umbral y método de cálculo exacto: sin confirmar) cuentan como UNA sola posición a efectos del techo agregado.
Por qué: dos posiciones "independientes" en instrumentos correlacionados son en la práctica una sola apuesta mayor de lo que el sizing individual sugiere.
Riesgo: correlaciones calculadas con pocos datos o en régimen distinto subestiman el riesgo real (en crisis, "todo cae junto").

## 5. Circuit breakers / kill-switch
Condiciones (defaults): (a) límite de pérdida diaria alcanzado; (b) **4** pérdidas consecutivas (rango 3–5); (c) errores/latencia del broker — default 3 fallos/timeouts en ventana corta (ventana exacta: sin confirmar, depende de límites reales de la API de Deriv); (d) excepción no controlada en el risk gate → fail-safe CERRADO (si el gate falla, la orden NO se envía).
Por qué: un sistema automatizado sin freno puede materializar pérdidas más rápido de lo que un humano reacciona.
Reset: manual, por Moisés, tras revisar causa raíz — nunca automático.
Riesgo aceptado: falsos positivos (parar por un blip de red) cuestan poco frente al coste de un falso negativo.

## 6. Risk gate — dónde encaja
Toda orden (real o paper) pasa por validación ANTES de llegar al adaptador de broker, en orden: circuit breakers → drawdown diario/total → exposición agregada/correlación → sizing (regla 1 techada por Kelly fraccionado). Si cualquier check falla, la orden se RECHAZA, se registra en `trading_audit_log` (append-only, 18_SECURITY) con motivo y regla disparada, y NO se envía al broker. Flujo completo en 08_TRADING.

## Sin confirmar
- N mínimo de operaciones históricas para activar Kelly fraccionado con confianza estadística razonable.
- Umbral exacto y método de cálculo de correlación (ventana temporal, Pearson u otra medida).
- Ventana temporal exacta del circuit breaker de errores/latencia (depende de límites reales de la API de Deriv, no verificados en esta sesión).
- Todas las cifras de riesgo/drawdown son defaults conservadores de práctica estándar, no cifras exigidas por regulación ni garantía matemática de resultado — sujetas a aprobación de Moisés y ajuste con datos reales de backtesting (13_BACKTESTING).

## Fuentes
Kelly, J.L. (1956) "A New Interpretation of Information Rate" — confirmado. Ed Thorp, aplicación de Kelly fraccionado en trading/apuestas — confirmado como práctica reconocida, fracción exacta varía por fuente. Van Tharp, position sizing (1–2% por operación) — convención ampliamente citada en literatura de trading de sistemas, sin fuente académica única que la demuestre óptima. Documentación oficial de Deriv API: NO consultada en esta sesión.
