# Preguntas abiertas — Estrategia A (ICT IFVG en NQ)

Ordenadas por impacto en el resultado. Nada de esto bloqueó el trabajo de esta noche (se documentó el supuesto usado y se siguió adelante, regla nocturna: "menos hecho y bien > más hecho y roto" no aplicaba aquí porque SÍ se podía avanzar con una interpretación declarada) — pero cualquier backtest futuro sobre estos datos no vale nada hasta que Moisés confirme o corrija estos puntos.

## 1. [ALTO IMPACTO] ¿Entrada al cierre de la vela de inversión, o retest a la zona?
Lo implementado (`ifvg.ts` + `index.ts`): se entra al CIERRE de la vela cuyo cuerpo confirma la inversión del FVG (cruza el borde contrario). No se espera un "retest" — que el precio vuelva a tocar la zona ya invertida antes de entrar, que es como MUCHA literatura retail de ICT/IFVG enseña la entrada (mejor R:R, pero sin bound de tiempo claro dentro de una ventana de 40 minutos).
**Por qué importa**: en Liquidity Grab (oro), un único supuesto de este tipo movió el resultado de -61,7% a +236% (`27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md`). Es razonable esperar un impacto similar aquí.
**Pregunta**: ¿Moisés tiene una fuente concreta (curso, indicador, screenshot) que defina el punto de entrada exacto? Si es así, la implementación de `ifvg.ts`/`index.ts` puede necesitar cambiar antes de que cualquier backtest signifique algo.

## 2. [ALTO IMPACTO] ¿Qué instrumento de datos exactamente — NQ, MNQ, u otro?
Se asumió NQ (E-mini) con $20/punto. El sizing con 0,5% de riesgo sobre cuentas pequeñas puede dar 0 contratos constantemente con NQ (ver `sizing.test.ts`, un caso con 50.000 USD de capital ya da 0 contratos con un stop de 20 puntos). MNQ ($2/punto) es 10x más flexible para cuentas pequeñas.
**Pregunta**: ¿con qué tamaño de cuenta se planea operar esto, y es NQ o MNQ (o ambos, según capital)?

## 3. [ALTO IMPACTO] Fuente de datos NQ 5M — no existe ninguna conectada al proyecto hoy
Deriv (única API ya integrada) no ofrece Nasdaq en su Native API — mismo bloqueo ya documentado en `27_SCALPING`. No se puede correr NINGÚN backtest real de esta estrategia sin que Moisés aporte los CSV o apruebe una fuente concreta (ver `04_PLAN_BACKTEST.md`).
**Pregunta**: ¿de dónde salen los datos? ¿Moisés tiene acceso a un export de NQ 5M/1D/4H (TradingView, plataforma del broker, proveedor de datos)?

## 4. [MEDIO IMPACTO] Combinación 1D+4H del Daily Bias
Se implementó exigiendo que AMBOS timeframes den el mismo bias (HH/HL o LL/LH), si no → skip. Alternativas razonables no implementadas: que 1D mande solo y 4H solo afine el timing de entrada; o que sea "1D Y 4H NO tienen que coincidir en polaridad, solo no contradecirse".
**Pregunta**: ¿cuál es la jerarquía correcta entre 1D y 4H?

## 5. [MEDIO IMPACTO] Definición exacta de "cierre de cuerpo" para validar el IFVG
Se usó literalmente el precio de CIERRE de la vela contra el borde de la zona (no el rango completo del cuerpo open-close). Es la lectura más simple de "cierre de cuerpo, no mecha", pero existe otra lectura razonable: exigir que TODO el cuerpo (open Y close) esté más allá del borde, no solo el close.
**Pregunta**: ¿confirmar cuál de las dos lecturas es la correcta?

## 6. [MEDIO IMPACTO] Gap mínimo del IFVG: ¿3, 4 o 5 puntos exactos?
La spec da un rango (3-5). Se usó 3 (el extremo más permisivo) como default, configurable vía `IctIfvgParams.minGapPoints`. Un valor más alto reduce el número de señales pero probablemente mejora la calidad.
**Pregunta**: ¿hay un valor único preferido, o se espera que el backtest lo optimice dentro del rango (con el riesgo de sobreajuste que eso implica, ya documentado en `13_BACKTESTING/00_RESUMEN.md`)?

## 7. [MEDIO IMPACTO] Punto value de NQ ($20/punto) sin verificar contra fuente oficial
Es conocimiento general de la especificación de contrato de CME, pero esta noche no se pudo verificar contra `cmegroup.com` ni ninguna fuente oficial (regla dura: sin navegador). Si está mal, todo el sizing en dólares está mal.
**Pregunta / acción**: verificar contra la especificación oficial de CME antes de usar esta cifra para cualquier cosa real (aunque sea demo). Es una verificación de 2 minutos que no se pudo hacer esta noche por regla.

## 8. [BAJO IMPACTO] Swing size de SMT: ¿5, 6, 7 u 8?
Igual que el punto 6 pero para la confluencia SMT (opcional en v1, no conectada). Se usó 6 (punto medio) como default. Baja prioridad porque SMT no está activo en v1.

## 9. [BAJO IMPACTO, pero bloqueante para "A+"] POI / Order Block — no construido
La spec lo marca opcional en v1. No se construyó esta noche (no había tiempo dentro del alcance ya extenso de bias+IFVG+riesgo+backtest). Si Moisés quiere avanzar a la versión "A+" (con SMT obligatorio + POI), hace falta una sesión de investigación/documentación aparte para definir Order Block y el criterio de 50% de retracement, antes de escribir código — regla de oro del proyecto.

## 10. [INFRAESTRUCTURA, no es una pregunta de estrategia] Gestión de posición con TP parcial no existe en el motor en vivo
Ya detallado en `03_INTEGRACION_ENGINE.md` §4. El backtest simula TP1(50%)/BE/TP2 manualmente sin tocar `riskGate`/`BacktestAdapter`, pero el ciclo EN VIVO (`engine/src/live/dailyCycle.ts`) no tiene ningún mecanismo para volver a tocar una posición ya abierta (solo abre y cierra completo). Llevar esta estrategia a demo real necesita ese componente nuevo — no es parte de esta tarea nocturna, pero es la pieza de infraestructura más grande pendiente antes de poder operar esto ni en modo demo.

## 11. [INFRAESTRUCTURA] Conversión size continuo (riskGate) → contratos enteros (NQ), no conectada en el backtest
`sizing.ts` existe y está testeado, pero `ictIfvgBacktest.ts` usa el `size` continuo del riskGate tal cual, sin redondear a contratos enteros. Ver `03_INTEGRACION_ENGINE.md` §5. Si se quiere que los números del backtest reflejen contratos reales (recomendado antes de tomar cualquier decisión con las cifras), hay que enchufar `sizeContracts()` dentro del loop — cambio pequeño, no se hizo esta noche para no exceder el alcance ya grande de la tarea.
