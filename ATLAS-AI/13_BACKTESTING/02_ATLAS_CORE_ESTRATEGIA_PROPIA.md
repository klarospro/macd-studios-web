# ATLAS CORE — estrategia propia diseñada y validada (2026-08-11)

Estado: **construida y medida sobre 25 años reales**. No aprobada para operar.
Código: `engine/src/strategy/atlasCore.ts`, `engine/src/backtest/atlasCoreBacktest.ts`,
`engine/src/backtest/runAtlasCore.ts`, `engine/src/scripts/fetchLongHistory.ts`. 12 tests (41 en total).
Reproducible: `npm run fetch:long && npm run backtest:core`.

## Encargo
Diseñar una estrategia propia en lugar de seguir validando propuestas externas (que dieron NO-GO
en `27_SCALPING/02` y `27_SCALPING/03`), y medirla honestamente.

## Tesis de diseño
Tres fracasos previos comparten causa: buscar una SEÑAL mejor en marcos temporales cortos, donde
los costes se comen la ventaja. Atlas Core no busca mejor señal: busca mejor **construcción de
cartera**, que es donde la literatura documenta robustez.

1. **Ensemble de horizontes** (63/126/252 días) en vez de un lookback único → elimina la mayor
   fuente de sobreajuste (¿por qué 100 días y no 90?).
2. **Dimensionamiento por volatilidad inversa** con objetivo de volatilidad de cartera → cada
   mercado aporta riesgo comparable, en vez de "1% nominal" que significa cosas distintas en BTC
   y en EUR/USD.
3. **Universo amplio y diversificado**: 28 instrumentos, 7 clases de activo (renta variable, FX,
   metales, energía, bonos, agrícolas, cripto).
4. **Señal continua ajustada por riesgo** en vez de ±1 → la posición escala con la convicción.
5. **Banda de no-negociación + rebalanceo mensual** → control de costes.

## Datos
28 instrumentos, 25 años (2001-08 → 2026-08), cierres diarios de Yahoo Finance. 8.428 días tras
alinear calendarios. Deriv se descartó como fuente: solo sirve ~1 año de velas diarias.

## Resultado principal (coste 2 bps sobre rotación)

| Métrica | Atlas Core | S&P 500 (comprar y mantener) |
|---|---|---|
| Retorno anual (CAGR) | **+6,8%** | +8,6% |
| Volatilidad | 14,1% | 16,4% |
| **Sharpe** | **0,42** | 0,45 |
| Máxima caída | 33,7% | 56,8% |
| Meses negativos | 46% | 35% |
| Peor mes | -12,0% | -16,9% |
| **Correlación con el S&P 500** | **-0,03** | 1,00 |
| Retorno total 25 años | +394% | — |

**No bate a comprar y mantener el S&P 500 por sí sola.** Su valor real es la correlación ~0:
es un flujo de retorno independiente, útil COMO DIVERSIFICADOR de una cartera, no como sustituto.

## Dos bugs propios encontrados y corregidos (por qué importa contarlos)
1. **Calendarios sin normalizar**: Yahoo marca cada mercado con su hora de apertura local (Nikkei
   00:00 UTC, S&P 13:30 UTC). Al unir calendarios salían 39.305 "días" en vez de 8.428, y un
   "lookback de 21 barras" dejaba de ser 21 días. Detectado porque la rotación diaria daba 41%,
   cifra imposible. Corregido truncando a medianoche UTC (test de regresión incluido).
2. **Rotación del 52% diario** con señal de signo: cada giro de un horizonte movía la posición un
   50% de golpe. Corregido con señal continua + banda de no-negociación + rebalanceo mensual →
   rotación 6,4%/día.

Ambos habrían producido un veredicto falso. La cifra de rotación fue el detector.

## Estudio de ablación (qué aporta cada decisión)

| Variante | CAGR | Sharpe | MaxDD |
|---|---|---|---|
| **Atlas Core completo** | **+6,8%** | **0,42** | 33,7% |
| Señal de signo (±1) en vez de continua | +5,7% | 0,35 | 43,5% |
| Rebalanceo diario en vez de mensual | +3,9% | 0,28 | 38,9% |
| Sin vol targeting (peso igual) | +2,0% | 0,33 | 18,8% |
| Sin ensemble (1 horizonte) | +7,1% | 0,42 | 43,6% |
| Solo 5 instrumentos (Atlas hoy) | +8,6% | 0,65 | 20,3% |

**Lo que la ablación confirma**: la señal continua, el rebalanceo mensual y el vol targeting
aportan de verdad.
**Lo que la ablación REFUTA**: el ensemble de horizontes no aporta Sharpe (0,42 vs 0,42), solo
reduce la caída máxima (33,7% vs 43,6%). Y sobre todo, **mi tesis de diversificación no se
sostiene en esta muestra**: la versión concentrada de 5 instrumentos da mejor Sharpe (0,65).
Explicación probable —no verificada— es que esos 5 incluyen BTC y Oro, que tuvieron tendencias
enormes en el periodo, y con N=5 cada uno recibe mucho más presupuesto de riesgo. No es un
resultado en el que apoyarse hacia delante, pero **tampoco puedo afirmar que los datos respalden
mi tesis**: no lo hacen.

## Walk-forward — la parte incómoda

| Periodo | CAGR | Sharpe |
|---|---|---|
| 2001-2007 | +11,4% | 0,72 |
| 2007-2012 | +3,2% | 0,23 |
| 2012-2017 | +2,6% | 0,21 |
| 2017-2021 | **-2,7%** | **-0,08** |
| 2021-2026 | **-2,7%** | **-0,09** |

**Los últimos ~8 años son negativos.** Coincide con la sequía documentada del seguimiento de
tendencia desde 2011. Quien monte esto hoy debe asumir que puede estar entrando en un régimen
malo que ya dura casi una década.

Perfil mensual completo: 292 meses · 54% positivos, 46% negativos · peor mes -12,0% ·
**hasta 80 meses seguidos sin recuperar máximos**.

## Sensibilidad a costes
Aguanta bien: +6,1% a 5 bps y +5,0% a 10 bps (sigue positivo). Contraste con las estrategias
intradía anteriores, que morían a 0,2-2 bps. **Esa es la diferencia estructural**: rotar el 6%
diario en vez de operar 933 veces al año.

## Conclusión honesta
Esto es lo que da una estrategia sistemática bien construida, medida sin trampas, sobre 25 años:
**~7% anual, Sharpe 0,4, caídas del 34%, casi la mitad de los meses en rojo y hasta 6,5 años sin
ver un máximo nuevo.** No es 10% mensual y no hay ajuste de parámetros que lo convierta en eso.

Su argumento de inversión NO es "rinde mucho", es "rinde de forma independiente al mercado"
(correlación -0,03). Eso tiene valor real en una cartera, pero es un argumento distinto al que
se estaba buscando.

## Limitaciones (sin resolver)
- Futuros continuos de Yahoo: no se modelan los vencimientos/roll; introduce error no cuantificado.
- Sesgo de selección: elegí 28 mercados líquidos que existen HOY. Un universo elegido en 2001
  habría sido distinto.
- Coste modelado como bps sobre rotación; sin slippage por tamaño ni impacto de mercado.
- **No es ejecutable hoy**: no pasa por `riskGate` (que es por-orden con stop, no por-peso), y
  Deriv no ofrece la mayoría de estos 28 mercados. Llevarlo a real exige decidir venue y adaptar
  la capa de riesgo — trabajo no hecho.
- Ninguna validación en demo. Cero capital real hasta cumplir el criterio de `09_RISK`.
