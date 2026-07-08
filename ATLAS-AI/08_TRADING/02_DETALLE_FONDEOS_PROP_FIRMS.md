# Detalle — Fondeos / Prop Firms: reglas típicas y diseño de estrategia agresiva compatible

Estado: investigación 2026-07-07, pendiente de elegir firm(s) concreto(s) y aprobación de Moisés antes de fondear ninguna cuenta real. Complementa `00_RESUMEN.md`. Referencia principal: FTMO (líder de mercado, única con documentación oficial verificada línea por línea en esta sesión); el resto de firms se cita solo vía fuentes secundarias de comparativa, marcadas como tales.

## 1. Qué es / por qué existe
Una prop firm ("fondeo") da acceso a capital (simulado en fase de evaluación; su naturaleza exacta en fase financiada varía por firm — ver §7) a cambio de superar un "challenge" con objetivos de rentabilidad y reglas de riesgo, y de un reparto de beneficios. Para Atlas: forma de escalar capital operable (objetivo 4, escalabilidad) sin que Moisés/inversores aporten el 100% del capital.

## 2. Reglas típicas confirmadas (FTMO, fuente oficial `ftmo.com/en/trading-objectives/`, consultado 2026-07-07)
| Regla | 1-Step | 2-Step |
|---|---|---|
| Profit target | 10% | Fase 1: 10% / Fase 2: 5% |
| Max daily loss | 3% del capital inicial | 5% del capital inicial |
| Max drawdown total | 10% — **trailing** (end-of-day, puede subir) | 10% — **estático** (fijo desde el inicio) |
| Días mínimos de trading | no exigido | ≥4 días (día = ≥1 posición abierta) |
| Best Day Rule (consistencia) | el mejor día no puede superar el 50% del beneficio de los días positivos (monitorizado, no rompe la regla por sí solo) | igual |
| Profit split (cuenta financiada) | 80-90% para el trader | igual |

Recalculo del daily loss: a las 00:00 hora de servidor (CE(S)T según FTMO). **Estas cifras son de FTMO concretamente — otras firms varían (ver §3) — no asumir que son universales.**

## 3. Variación entre firms (fuentes secundarias, NO oficiales, cambian con frecuencia — verificar contra la web del firm elegido antes de decidir)
- Drawdown **estático** (no sube con ganancias): FTMO, FXIFY, The5ers — más favorable para trend-following porque el colchón no se "come" según se gana.
- Drawdown **trailing** (EOD o intradía): Alpha Futures, Lucid Trading, My Funded Futures, Tradeify, Apex (intradía en algunos programas) — penaliza fuerte al trend-following: el suelo sube con cada nuevo máximo de equity, así que una racha buena no amplía el colchón real tanto como parece.
- EA/automatización: permitido con matices en FTMO, FXIFY (programas concretos), BrightFunded, Darwinex Zero, The5ers, FundingPips (solo "trade managers"), QT Funded (requiere aprobación previa); prohibido o restringido en Alpha Futures, Apex, Maven Trading, Trade The Pool. **Cambia por firm y por fecha — no operar automatizado en ningún firm sin leer su página de reglas vigente ese día.**
- Reglas de consistencia ("Best Day Rule"): no todas las firms la tienen; existen comparativas de mercado de "firms sin consistency rule" pero son fuentes secundarias sujetas a cambio.

## 4. ¿Permiten automatización/EA? — Confirmado oficialmente solo para FTMO
`ftmo.com` confirma (blog + FAQ, no encontrado como página única canónica pero consistente entre varias páginas oficiales): SÍ se permite trading algorítmico/EA, siempre que sea "legítimo" y no incurra en prácticas prohibidas. Prácticas explícitamente prohibidas (`ftmo.com/en/forbidden-trading-practices/`, confirmado):
1. Explotar errores del sistema (precios mal mostrados, delays).
2. Coordinar operaciones manipulativas entre cuentas conectadas (incl. posiciones opuestas simultáneas entre cuentas propias o de terceros).
3. Software/IA/herramientas de ultra-alta velocidad que den ventaja injusta o manipulen.
4. "Gap trading": abrir posiciones dentro de las 2 horas previas al cierre de mercado o alrededor de eventos económicos mayores.
5. Hedging/posiciones opuestas en instrumentos altamente correlacionados para evadir la Best Day Rule.
6. Actividad de servidor excesiva: más de 2000 solicitudes/día por EA/robot.
7. Tamaños de posición desproporcionados respecto al histórico propio de la cuenta.
8. Ceder acceso de la cuenta a terceros / operar la cuenta de otro.
**No hay mención explícita** (en las páginas revisadas) sobre arbitraje de latencia, martingala, o límite de cuántas cuentas propias puede operar simultáneamente un mismo trader con la misma estrategia — tratar como zona gris (§6 de `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md`).

## 5. Diseño de estrategia agresiva PERO compatible (para no violar el drawdown con una racha normal de trend-following)
El objetivo del producto prioriza preservación de capital y gestión de riesgo por encima de agresividad — en cuentas de fondeo esto es aún más crítico porque violar el límite externo del firm = **perder la cuenta entera**, no solo el capital arriesgado en esa operación.
1. **Preferir firms con drawdown estático** para estrategias de tendencia (TSMOM, ya en `13_BACKTESTING`): el trailing erosiona el colchón real justo cuando la estrategia por fin gana. Recomendación, no regla absoluta — depende también del profit split y coste del challenge.
2. **Buffer interno más estricto que el límite del firm**: parar de operar (soft-halt propio) al 50-70% del daily loss permitido por el firm, nunca operar "hasta el límite exacto" — un slippage/gap puede cruzar el límite y perder la cuenta. Esto es ADICIONAL al circuit breaker de `09_RISK` (regla 5), no lo sustituye.
3. **Sizing por operación más conservador que el 1% propio**: en cuenta de fondeo, el "coste" de perder no es solo el 1% sino el riesgo de perder TODA la cuenta si se acumulan pérdidas hasta el límite — considerar un tope adicional (p. ej. 0.5% por operación, o el mínimo entre 1% y una fracción del daily loss restante) mientras la estrategia no tenga edge validado con datos reales (13_BACKTESTING).
4. **Consistency/Best Day Rule vs trend-following**: una estrategia de tendencia gana típicamente en 2-3 días grandes al mes — esto puede violar la regla de consistencia sin romper ninguna regla de riesgo real. Mitigación: (a) elegir firms sin esta regla, o (b) tomar beneficio parcial escalonado en el día ganador en vez de dejar correr toda la posición, o (c) aceptar operar más días pequeños para diluir el ratio antes de solicitar el payout.
5. **Circuit breaker de pérdidas consecutivas** (09_RISK regla 5b, ya configurable por venue): en cuentas de fondeo, mantener el umbral MÁS bajo que en cuenta propia (no relajarlo como se hizo para TSMOM en cuenta propia — decisión de `13_BACKTESTING`), porque el coste de una racha de pérdidas aquí es perder el fondeo completo.
6. **Mínimo de días de trading**: si el firm exige ≥4 días con ≥1 posición, una estrategia de baja frecuencia (TSMOM) debe planificarse para tocar mercado esos días mínimos aunque sea con tamaño reducido — verificar que esto no fuerce operar sin señal real (nunca forzar una entrada solo para cumplir el mínimo de días; usar tamaño simbólico dentro del sizing normal si hace falta).

## 6. Ventajas / Desventajas / Costes
- Ventajas: capital apalancado sin aportar el 100% propio; pérdida acotada al fee del challenge si se falla; escalable a N cuentas/firms.
- Desventajas: reglas cambian sin aviso ("Prop firm rules change frequently — sometimes without notice", confirmado por fuentes de mercado 2026); dependencia de un tercero no regulado como entidad de crédito; profit split reduce el beneficio neto; riesgo de perder el fee si se viola una regla por error humano o técnico (bug del motor).
- Costes: fee del challenge (importe **sin confirmar** — varía por firm y tamaño de cuenta, se determina al elegir firm), posible fee de reset tras fallar, spread/comisión propios del firm (superiores o iguales a un bróker CFD directo).

## 7. Riesgo de contraparte — punto crítico, sin confirmar
**Sin confirmar y crítico**: en la fase de evaluación el capital es simulado (confirmado, "Initial Simulated Capital" en la terminología oficial de FTMO). En la cuenta YA FINANCIADA, el modelo exacto (si el firm opera con capital propio real del firm, o sigue siendo una cuenta simulada con el firm pagando el "profit share" desde su propia caja) **varía por firm y no se confirmó en esta sesión para ningún firm concreto**. Esto importa para el aislamiento de riesgo del portafolio (`14_PORTFOLIOS`): el "capital asignado" a un venue de fondeo no es necesariamente capital que Moisés puede perder más allá del fee del challenge, pero tampoco es capital de clientes en el sentido de `17_SAAS` — aclarar esto por firm antes de contarlo como "capital gestionado" de cara a clientes/informes.

## 8. Alternativas
- Capital 100% propio (Deriv u otro bróker CFD, ya en uso): sin reglas externas, pero sin apalancamiento de capital de terceros.
- Futuros firms (Apex, Tradeify, My Funded Futures): reglas de drawdown mayormente trailing, distinto mercado (futuros, no forex/CFD).
- No fondearse y crecer solo con capital propio + de accionistas/inversores directos (vía la estructura de `17_SAAS`).

## 9. Mejores prácticas
- Leer las reglas oficiales del firm ELEGIDO directamente en su web antes de automatizar — las comparativas de terceros (usadas en este documento para contexto de mercado) cambian y no son vinculantes.
- Confirmar por soporte del firm, por escrito, la política sobre EA/automatización y sobre operar múltiples cuentas propias con la misma estrategia antes de escalar.
- Empezar con 1 cuenta, validar el ciclo completo (challenge → verificación → financiada → primer payout) antes de escalar a N cuentas o N firms.
- El motor de riesgo interno (09_RISK) siempre debe ser MÁS estricto que el límite externo del firm, nunca igual ni más laxo.
- Diversificar entre firms distintos, no solo entre cuentas del mismo firm (ver `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md` §3).

## Sin confirmar (resumen)
- Firm(s) concreto(s) que usará Moisés — determina todo lo demás (reglas exactas, coste, si permite automatización).
- Coste exacto del challenge y de resets.
- Naturaleza exacta del capital en cuenta financiada (real del firm vs simulado con profit-share) por firm.
- Política exacta de cada firm sobre N cuentas propias del mismo trader con la misma estrategia.
- Si existe alguna vía de API/webhook oficial en algún firm de futuros (mencionadas en fuentes secundarias, no verificadas oficialmente aquí).

## Fuentes
Oficiales (confirmado, consultadas 2026-07-07): `ftmo.com/en/trading-objectives/`, `ftmo.com/en/forbidden-trading-practices/`, `ftmo.com/en/faq/`. Secundarias de mercado (NO oficiales, usadas solo para contexto comparativo, sujetas a cambio): the5ers.com/blog, thepropfirmguide.com, traderssecondbrain.com, jptradingcapital.com — citadas explícitamente donde se usan, nunca como fuente de una cifra que se vaya a codificar sin re-verificar contra la web oficial del firm elegido.
