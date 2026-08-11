# PROMPT PARA CLAUDE CODE — Implementacion de cartera multi-sleeve en el motor de trading

## Rol
Eres el desarrollador principal del motor de trading. Tu tarea es implementar
un cambio estructural en el codigo existente: convertir el sistema actual en
una cartera de tres sleeves (Core, Intradia, EventScalp) integrados con la
infraestructura ya construida. NO construyas nada desde cero: primero explora
el repositorio, identifica los modulos existentes (motor de senales, RiskGate,
portafolio, auditoria, web, onboarding, Telegram, Supabase) y reutilizalos.

## Contexto del sistema
- Broker: Deriv, cuenta DEMO (API/MT5). El paso a real se decide despues y
  requiere aprobacion explicita; no lo prepares ni lo habilites.
- Limites regulatorios ESMA (Espana): apalancamiento maximo 1:30 en divisas
  mayores y 1:20 en oro. Deben respetarse SIEMPRE en el sizing de cada orden
  de los tres sleeves.
- En Deriv no existe order flow real (DOM/footprint). Usa como proxy el
  volumen por ticks y las rupturas de rango con confirmacion de volumen.
- El objetivo del sistema NO es predecir el mercado: es ejecutar reglas frias
  con riesgo acotado. Nada de rentabilidades fijas ni garantizadas.

## Tarea 1 — Asignacion de margen entre sleeves
- Sleeve A "Core" (Trend + Carry): 40% del margen.
- Sleeve B "Intradia" (Breakout + volumen): 30% del margen.
- Sleeve C "EventScalp" (Noticias macro): 30% del margen.
- El margen de un sleeve en reposo NO se reasigna a otro sleeve: queda como
  colchon. Prohibido apalancar la cartera para aprovechar margen libre.
- Regla de solapamiento: nunca mantener posicion simultanea de dos sleeves
  sobre el mismo instrumento en la misma direccion. Si ocurre, se cierra la
  del sleeve de menor prioridad (orden: C > B > A).

## Tarea 2 — Sleeve A "Core" (Trend + Carry), horizonte semanal
- Trend: 12-15 mercados disponibles en Deriv (indices, oro, petroleo, gas,
  FX mayores) con senales EWMA 50/100/200 o Donchian, revision semanal.
- Carry: 3 pares long y 3 short por diferencial de swaps, rebalanceo mensual.
- Vol-target 10% anualizado: si la volatilidad realizada supera el objetivo,
  reducir tamano proporcionalmente.

## Tarea 3 — Sleeve B "Intradia" (Breakout + volumen), horizonte diario
- Diseno objetivo: win rate 65-75% con TP medio >= 0.8x el stop medio, de
  modo que la expectancy sea positiva y el profit factor >= 1.3 tras costes.
  El win rate es consecuencia del diseno, no el objetivo.
- Entradas, solo con confirmacion de volumen:
  1) ORB: ruptura del rango de apertura (primeros 15-30 min de Londres/NY)
     con volumen > 1.5x la media de la misma hora.
  2) Ruptura del rango de la sesion previa (maximos/minimos) con retest del
     nivel roto.
  3) Breakout de maximos/minimos de 1-4 horas en activos con ATR creciente.
- Maximo 1-3 trades/dia y 10/semana. Si los dos primeros trades del dia son
  perdedores, el sleeve para el dia.
- Stop 0.5-1xATR, TP segun el diseno de win rate, un solo intento por setup,
  sin reentrada al mismo nivel el mismo dia.
- No operar en los 15 minutos previos ni posteriores a un evento de alto
  impacto: ese territorio es del Sleeve C, no del B.

## Tarea 4 — Sleeve C "EventScalp" (Noticias macro)
- Solo eventos de alto impacto (3 estrellas): CPI, NFP, FOMC, ECB, BoE, PIB,
  PMI flash. Maximo 2 eventos/dia y 5/semana. Si coinciden dos eventos de
  alto impacto, no operar.
- La IA clasifica la sorpresa (actual vs consenso, magnitud y direccion) y
  puntua; NUNCA decide sola: el motor ejecuta las reglas.
- Entrada entre 60 y 120 segundos tras la publicacion, SOLO si:
  1) el spread volvio a <= 1.5x el spread normal del activo, y
  2) el momentum confirma la direccion (> 0.3xATR en los primeros 15-30 s).
- Un solo trade por evento. Stop 0.5xATR, TP 1.2R. Prohibido anadir
  posiciones, promediar o usar martingala.

## Tarea 5 — RiskGate compartido (obligatorio, no negociable)
- Circuit breakers de cartera: perdida de 2% en el dia -> pausa de TODA la
  cartera hasta el dia siguiente; 5% en la semana -> pausa semanal.
- Breakers por sleeve: B para tras dos perdidas seguidas en el dia; C para
  con perdida de 2% del capital del sleeve.
- Sizing: riesgo por trade de 0.25-0.5% del capital del sleeve, verificando
  que el nocional respeta ESMA (1:30 FX / 1:20 oro) en cada orden.
- Rechazar cualquier senal si el spread supera 1.5x lo normal del activo.

## Tarea 6 — Auditoria y comunicacion
- Registrar en Supabase CADA operacion de los tres sleeves: sleeve, evento o
  setup, timestamp exacto, precio de entrada/salida, spread, slippage, PnL
  y puntuacion de la IA (en C). Notificar cada operacion por Telegram.
- Resumen semanal automatico por sleeve y por cartera: trades, win rate,
  expectancy, profit factor, drawdown y comparacion contra los criterios de
  paso.

## Tarea 7 — Modo demo y criterios de paso (Fase 1)
- Ejecutar en demo durante 4 semanas registrando TODO.
- Criterios por sleeve para pasar a la siguiente fase: expectancy > 0 tras
  costes, profit factor >= 1.3 (B y C), minimo 20 eventos (C) y 40 trades
  (B), drawdown < 10% de la cartera. Si un sleeve no cumple, queda en demo
  o se cancela SIN arrastrar a los demas.

## Restricciones duras
- No prometer ni configurar rentabilidades fijas o mensuales garantizadas.
- No superar ESMA, no martingala, no promediar, no reentrar en el mismo
  setup el mismo dia, no operar noticias de bajo impacto.
- No pasar a capital real sin aprobacion explicita y revision legal previa.
- No borrar ni romper funcionalidad existente (auditoria, onboarding, web,
  Telegram, Supabase): integra, no sustituyas.

## Forma de trabajar (Claude Code)
1. Antes de tocar nada, explora el repositorio y describe en un resumen como
   esta organizado el codigo actual (modulos, dependencias, convenciones).
2. Usa las convenciones y el estilo del codigo existente. No introduzcas
   frameworks ni librerias nuevas sin justificarlo y preguntar antes.
3. Separa TODA la configuracion (porcentajes, limites, breakes, parametros
   de entrada) en un archivo YAML unico, fuera del codigo.
4. Trabaja en pasos pequenos y verificables. Al terminar cada tarea, indica
   que archivos tocaste y que probaste.
5. Si algo no esta claro en el codigo existente (por ejemplo, como se
   conecta el motor con Deriv o como se escribe en Supabase), pregunta antes
   de asumir.

## Entregables finales
1. Codigo de los tres sleeves integrado en el motor existente.
2. Config YAML con todos los parametros separados del codigo.
3. Registro de auditoria funcional en Supabase + alertas Telegram.
4. Resumen semanal automatico por sleeve y cartera.
5. Checklist de verificacion: cada criterio de paso de la Fase 1, con su
   estado (pendiente / implementado / verificable en demo).
