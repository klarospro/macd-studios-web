# CARTERA MULTI-SLEEVE — implementación y hallazgos (2026-08-11)

Estado: **construida, probada y DESPLEGADA en el VPS sobre Deriv DEMO**.
Encargo: `27_SCALPING/04_CARTERA_MULTI_SLEEVE.md`.
Código: `engine/src/{config,risk,portfolio,strategy,live,reporting,audit}`, `engine/config/atlas.yaml`.
205 tests, typecheck limpio. Reproducible: `npm test` · `npm run cycle:sleeves` (dry-run).

## Qué se construyó

| Tarea | Módulo | Estado |
|---|---|---|
| 1 · Margen entre sleeves | `portfolio/sleeveAllocator.ts` | ✅ 40/30/30, colchón no reasignable, no-solapamiento |
| 2 · Sleeve A Core | `strategy/sleeveCore.ts` | ✅ EWMA 50/100/200 o Donchian + vol-target 10%. Carry DESACTIVADO |
| 3 · Sleeve B Intradía | `strategy/sleeveIntradia.ts` | ✅ ORB, rango previo con retest, breakout horario |
| 4 · Sleeve C EventScalp | `strategy/sleeveEventScalp.ts` | ✅ código listo; **sin calendario cargado** |
| 5 · RiskGate compartido | `risk/sleeveRiskGate.ts` + `risk/esma.ts` | ✅ breakers, ESMA por nocional, spread, topes |
| 6 · Auditoría y avisos | `audit/sleeveTrade.ts`, `live/telegramSleeve.ts`, `reporting/` | ✅ tablas creadas en Supabase |
| 7 · Checklist Fase 1 | `reporting/sleeveMetrics.ts` | ✅ distingue "no cumple" de "muestra insuficiente" |

Toda la configuración vive en `engine/config/atlas.yaml`. El loader **aborta al
arrancar** si el margen no suma 1, si se intenta reasignar el margen ocioso,
apalancar el margen libre o relajar los topes ESMA de FX mayor y oro.

## Cuatro hallazgos medidos que cambiaron el diseño

Ninguno es una opinión: los cuatro salen de sondas contra la cuenta demo
VRTC4942159 (`npm run sonda:volumen` · `sonda:universo` · `sonda:operabilidad`).

### 1. El recuento de ticks de Deriv NO mide participación

EUR/USD, oro y BTC devuelven estadísticas **idénticas**: media 59 ticks/min,
máximo exactamente 60, misma dispersión. Deriv emite **1 tick por segundo a
cadencia fija**. Tres mercados distintos no pueden tener la misma distribución.

**Consecuencia**: la "confirmación de volumen" que la Tarea 3 exige en las tres
entradas del Sleeve B **no se puede calcular**; el filtro no dispararía nunca.

**Sustitución**: EXPANSIÓN DE RANGO — recorrido de la vela > 1,5× el recorrido
medio de la MISMA hora en jornadas anteriores. Responde a la misma pregunta
(¿hay fuerza real detrás de la ruptura?) con un dato que en Deriv sí es real.
Comparar contra la misma hora sigue siendo imprescindible: la apertura de
Londres siempre se mueve más que la madrugada asiática.

### 2. Tener datos NO implica poder operar

`sonda:universo` daba 23 instrumentos con histórico diario. `sonda:operabilidad`
—que pide una proposal real— reduce el universo a **13**. Diez símbolos
devuelven velas perfectas y aun así responden *"Trading is not offered for this
asset"*: NZD/USD, platino, paladio, Brent y **los seis índices bursátiles**.

**Se confirma la nota previa de 27_SCALPING**: los índices son solo feed de
precios en la API nativa de Deriv. **El bloqueante de MT5 / VPS Windows para
operar índices SIGUE EN PIE.** (Una lectura intermedia de esta sesión afirmó lo
contrario basándose solo en el histórico; era incorrecta.)

Universo operable: 6 FX mayores, 3 cruces, oro, plata, BTC, ETH.

### 3. El presupuesto de riesgo no ve la correlación

La primera pasada real abrió 15 posiciones del Core, y varias eran la misma
apuesta: corto EUR/USD + largo USD/JPY + largo USD/CHF + largo USD/CAD son
todas "largo dólar". Cada una pasaba el gate con su 0,5% y el conjunto quedaba
concentrado sin que ningún límite protestara.

**Añadido**: `posiciones_max` y `posiciones_max_por_clase` (clase ESMA) por
sleeve. Verificado: 12 posiciones, FX mayor cortado en 4.

### 4. Deriv no expone bid/ask en Multipliers

No hay spread consultable: el coste viaja como `commission` en la proposal. La
regla de "spread > 1,5× lo normal" se alimenta de esa cifra, que es la magnitud
que la regla pretende vigilar. Anotado en `derivDemoAdapter.costeApertura`.

## Despliegue

- `atlas-cycle.timer` (bot anterior, TSMOM diario) **detenido y deshabilitado**.
  Su fichero de estado llevaba desde el 2026-07-08 declarando 3 posiciones
  abiertas que Deriv ya había cerrado: llevaba más de un mes desincronizado.
- `atlas-sleeves.timer` **activo**, dispara `atlas-sleeves.service` cada 5 min.
  `oneshot`, usuario `atlas`, `--execute` sobre la cuenta DEMO.
- Tablas `atlas_sleeve_trades` y `atlas_sleeve_weekly` creadas (RLS sin
  políticas: solo `service_role`).

## Pendiente antes de que la Fase 1 cuente de verdad

1. **Calendario del Sleeve C vacío** → no operará ni un evento hasta cargar
   `eventscalp.sorpresa.eventos_programados` (o enchufar una API). Sin eso no
   alcanzará nunca los 20 eventos que exige su criterio de paso.
2. **Sleeve B necesita ~10 jornadas de velas M5** para la media de recorrido
   por hora. Hasta entonces rechaza por diseño (fallo seguro).
3. **Telegram sigue sin token** en el `.env.local` del VPS: el código envía,
   pero sin `TELEGRAM_BOT_TOKEN` no sale nada. No rompe el ciclo.
4. **Confirmar la apertura real con mercados abiertos**: el despliegue se hizo
   a las 21:46 UTC, en la ventana de rollover en que Deriv suspende Multipliers.
   El timer reintenta cada 5 min; verificar en el log que abre posiciones.
5. **Resumen semanal**: el módulo existe y está probado, pero no hay todavía un
   disparador que lo envíe los lunes.

## Decisiones tomadas sin consulta (documentadas para revisión)

- **Prioridad de cierre ante solapamiento**: el prompt dice "orden: C > B > A".
  Se interpreta como el orden en que se CIERRAN (EventScalp primero, Core el
  más protegido). Invertir `cartera.prioridad_cierre` es el único cambio si la
  intención era la contraria.
- **`puntuacion_minima` del Sleeve C: 0,05, no 0,5.** Un 0,5 exige que el dato
  se desvíe un 50% del consenso (un IPC de 4,5% frente a un consenso de 3,0%):
  una sorpresa histórica. Con ese umbral el sleeve no operaría nunca.
- **Carry desactivado**: Deriv no publica diferenciales de swap por API. No se
  opera un diferencial que no se puede medir.
- **Calendario manual** por YAML en vez de una API de pago, con la interfaz
  `EconomicCalendar` lista para sustituirlo sin tocar la estrategia.
