# Reglas de entrada — Estrategia A (ICT IFVG en NQ)

Detalle técnico de `00_RESUMEN.md`. Implementado en `engine/src/strategy/ictIfvg/`.

## 1. Instrumento y timeframes
- Instrumento: NQ (E-mini Nasdaq-100 futures).
- Entrada: velas 5M (M5).
- Bias: velas 1D (diario) + 4H.
- Confluencia SMT (opcional v1): ES (E-mini S&P 500), mismo timeframe que la señal evaluada.

## 2. Daily Bias (estructura 1D + 4H)
Regla dada: HH/HL (higher high + higher low) en 1D+4H = UP. LL/LH (lower low + lower high) = DOWN. Si no hay bias claro → skip el día completo (no se opera).

**Implementación (`bias.ts`)**: detección de swings fractales (ala configurable, default 2 barras a cada lado — el mismo algoritmo que ya usa `liquidityGrab.ts` en el motor, sin reutilizar el código para mantener el módulo autocontenido). Se comparan los DOS últimos swing highs confirmados y los DOS últimos swing lows confirmados:
- Último high > anterior high Y último low > anterior low → `UP`
- Último high < anterior high Y último low < anterior low → `DOWN`
- Cualquier otra combinación (o menos de 2 highs/lows confirmados) → `NONE`

**Supuesto declarado (no está en la spec, decidido por necesidad)**: el bias combinado 1D+4H exige que AMBOS timeframes coincidan. Si 1D dice UP pero 4H da NONE o DOWN → bias final `NONE` (skip). Ver `05_PREGUNTAS_ABIERTAS.md` — puede que Moisés quiera que 4H solo "confirme dirección" sin exigir su propia estructura HH/HL, o que 1D mande y 4H solo afine el timing de entrada.

**Responsabilidad anti-lookahead**: `bias.ts` es una función pura — recibe exactamente las velas que ya pasaron (no sabe qué es "hoy"). Es responsabilidad del caller (runner de backtest o ciclo en vivo) pasar solo velas 1D/4H con timestamp anterior al día que se está evaluando.

## 3. Detección de IFVG (Inversed Fair Value Gap)
**Definición usada (declarada, ver `05_PREGUNTAS_ABIERTAS.md` para las alternativas descartadas)**:

1. **FVG (Fair Value Gap) de 3 velas**: para velas `i-2, i-1, i`, si `high(i-2) < low(i)` hay un hueco alcista de tamaño `low(i) - high(i-2)`; si `low(i-2) > high(i)` hay un hueco bajista de tamaño `low(i-2) - high(i)`. Se descartan huecos menores a `minGapPoints` (parámetro, 3–5 según spec; se usó **3** por defecto — el extremo más permisivo).
2. **Inversión**: un FVG alcista (zona `[high(i-2), low(i)]`, se esperaba que actuara de soporte) se considera "invertido" en la primera vela posterior cuyo **cierre** (no mecha) queda por DEBAJO del borde inferior de la zona — el soporte falló y la zona pasa a interpretarse como resistencia. Espejo para un FVG bajista: se invierte cuando una vela cierra por ENCIMA del borde superior de la zona (pasa a soporte).
3. **Dirección de la operación tras la inversión**: FVG alcista invertido → sesgo bajista (`sell`). FVG bajista invertido → sesgo alcista (`buy`). Esto es lo que la spec llama "IFVG a favor del bias": solo se opera si esta dirección coincide con el Daily Bias.
4. **"Cierre de cuerpo, no mecha"**: se interpretó literalmente como usar el precio de CIERRE de la vela (parte del cuerpo) contra el borde de la zona, en vez del high/low de la vela (la mecha). No se exige que la vela entera (open Y close) esté fuera de la zona — solo el close.
5. **Entrada**: al CIERRE de la vela que confirma la inversión (paso 2). **No se implementó un "retest" de vuelta a la zona invertida antes de entrar** — es una simplificación deliberada dado que la ventana de sesión es de solo 40 minutos (8 velas de 5M) y un retest no tiene bound de tiempo definido en la spec. Es la interpretación con más impacto en el resultado si Moisés esperaba lo contrario — ver pregunta abierta #1.

## 4. Ventana horaria
9:30–10:10 AM hora de Nueva York (America/New_York, con DST manejado vía `Intl.DateTimeFormat` de Node — sin librería nueva). Solo se buscan señales dentro de esa ventana; fuera de ella, no hay entrada aunque exista una inversión IFVG válida. Se filtran también fines de semana (sin datos de futuros, pero la función lo comprueba igualmente).

## 5. "Solo el primer IFVG válido de la sesión a favor del bias"
La función pura `detectIfvgAt` solo evalúa inversiones que se CONFIRMAN exactamente en la barra `now` (comparando con la barra anterior, para no re-disparar en cada vela mientras el precio se queda fuera de la zona). El runner de backtest / ciclo en vivo, al no volver a buscar señales mientras ya hay una posición abierta ese día (mismo patrón que `liquidityGrabBacktest.ts`), garantiza que solo se toma la primera. No hace falta estado adicional dentro de las funciones puras.

## 6. Confluencia SMT (opcional v1, obligatoria en A+)
Divergencia entre NQ y ES: uno de los dos activos marca un nuevo extremo (HH o LL) que el otro NO confirma en el mismo punto de swing. Implementado en `smt.ts` con `swingWing` configurable (default 6, punto medio del rango 5–8 dado). **No está conectado a `findIctIfvgSignal` en v1** — la spec lo marca opcional en v1, así que se deja como función independiente y un flag `useSmtConfluence` reservado en `IctIfvgParams` sin usar todavía.

## 7. Confluencia POI (Order Block, 50% retracement)
**No construida esta noche.** La spec la marca opcional en v1 y no llegó a tiempo dentro del alcance de esta tarea nocturna (que ya cubre bias + IFVG + gestión de riesgo completos). Ver `05_PREGUNTAS_ABIERTAS.md`.
