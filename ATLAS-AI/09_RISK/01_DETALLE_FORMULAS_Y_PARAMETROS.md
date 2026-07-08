# Detalle: fórmulas, parámetros y orden de evaluación del risk gate

## 1. Riesgo por operación → tamaño de posición
```
Riesgo_€            = Capital_cuenta × Riesgo%_operación
Distancia_stop      = |Precio_entrada − Precio_stop_loss|   (en unidades del instrumento)
Tamaño_posición     = Riesgo_€ / (Distancia_stop × Valor_por_punto_o_pip)
```
- `Valor_por_punto_o_pip` depende del instrumento/contrato (forex, sintético, cripto) — se obtiene de las especificaciones del broker (Deriv), no se asume fijo.
- El resultado se redondea SIEMPRE hacia abajo al tamaño mínimo negociable del instrumento (nunca hacia arriba, para no exceder el riesgo objetivo).
- Tabla de referencia de rango/default:

| Parámetro | Rango | Default |
|---|---|---|
| Riesgo % por operación | 0.5% – 2% | 1% |

## 2. Kelly fraccionado
```
f*        = p − (1 − p) / b        (Kelly completo, Kelly 1956)
f_usado   = fracción × f*          (fracción ∈ [1/4, 1/2])
Riesgo%_operación_final = MIN(Riesgo%_regla_1, f_usado)
```
- `p` = probabilidad histórica de acierto de la estrategia (win rate), `b` = ratio ganancia media / pérdida media.
- El resultado de Kelly NUNCA sustituye al límite duro de la regla 1; se usa el menor de los dos siempre.
- Si `f*` ≤ 0 (edge negativo o nulo) → no operar, tamaño 0, independientemente de la regla 1.

| Parámetro | Rango | Default |
|---|---|---|
| Fracción de Kelly | 1/4 – 1/2 | 1/4 (hasta validar edge con muestra grande + out-of-sample) |
| Tamaño mínimo de muestra para estimar p, b | sin confirmar | pendiente 13_BACKTESTING |

Peligros específicos de Kelly (ampliado):
- Sensibilidad extrema a errores de estimación de `b`: un `b` sobreestimado en 20% puede llevar a `f*` sobredimensionado en múltiplos, no en proporción lineal.
- Asume apuestas independientes e idénticamente distribuidas — el trading real tiene autocorrelación (rachas) y regímenes de mercado cambiantes.
- Kelly completo maximiza crecimiento esperado a costa de varianza altísima (drawdowns intermedios de 50%+ son posibles matemáticamente incluso con edge real positivo) — motivo directo del uso de fracciones reducidas en gestión de fondos cuantitativos (Ed Thorp).

## 3. Drawdown — matemática de recuperación
| Pérdida | Ganancia necesaria para recuperar |
|---|---|
| 10% | 11.1% |
| 20% | 25% |
| 30% | 42.9% |
| 50% | 100% |

- Cálculo: `Ganancia_necesaria = Pérdida / (1 − Pérdida)`.
- Justifica por qué el límite total (10%) se fija bien por debajo de umbrales donde la recuperación se vuelve exponencialmente más cara.

| Parámetro | Rango | Default | Acción al tocarlo |
|---|---|---|---|
| Drawdown diario | 2% – 5% | 3% | No abrir operaciones nuevas el resto del día |
| Escalón intermedio (mitad del diario) | — | 1.5% | Reducir riesgo por operación a la mitad |
| Drawdown total (desde máximo histórico de equity) | 8% – 15% | 10% | HALT total, revisión manual obligatoria de Moisés |

## 4. Exposición concurrente y correlación
```
Riesgo_agregado = Σ Riesgo_€(posición_i)   para todas las posiciones abiertas
```
| Parámetro | Rango | Default |
|---|---|---|
| Riesgo agregado máximo | 4% – 6% | 5% |
| Nº máx. posiciones concurrentes | 3 – 5 | 3 |
| Umbral de correlación "alta" | sin confirmar | referencia provisional \|ρ\| > 0.7 |

- Instrumentos por encima del umbral de correlación se agrupan como una sola unidad de riesgo: `Riesgo_grupo = Σ Riesgo_€(instrumentos del grupo)`, y ese grupo no puede por sí solo superar el techo agregado.
- Método de cálculo de correlación (ventana temporal, retornos diarios vs intradía, Pearson vs Spearman): sin confirmar, se decide con datos reales en 13_BACKTESTING.

## 5. Circuit breakers — tabla resumen
| Condición | Default | Acción |
|---|---|---|
| Pérdida diaria acumulada ≥ límite diario | 3% capital | Bloquear nuevas órdenes el resto del día |
| Pérdidas consecutivas | 4 (rango 3–5) | Pausar y requerir revisión manual |
| Fallos/timeouts de conexión al broker en ventana corta | 3 (ventana: sin confirmar) | Pausar envío de órdenes, alertar |
| Excepción no controlada en risk gate | cualquiera | Fail-safe cerrado: NO enviar orden, alertar |
| Reset de cualquier breaker | — | Manual, solo Moisés, tras revisión de causa raíz |

## 6. Orden de evaluación del risk gate (pseudocódigo de documentación, no producción)
```
function evaluar_orden(señal):
    si circuit_breaker_activo():             return RECHAZAR("circuit_breaker")
    si drawdown_diario_o_total_excedido():    return RECHAZAR("drawdown")
    tamaño_base   = calcular_tamaño_regla_1(señal, riesgo_pct=1%)
    tamaño_kelly  = calcular_tamaño_kelly(señal, fraccion=1/4)   // si hay historial suficiente
    tamaño_final  = min(tamaño_base, tamaño_kelly)
    si excede_exposicion_agregada_o_correlacion(tamaño_final):
        tamaño_final = ajustar_o_rechazar(tamaño_final)
        si tamaño_final == 0:                return RECHAZAR("exposicion_correlacion")
    return APROBAR(tamaño_final)
```
Toda salida (APROBAR o RECHAZAR) se escribe en `trading_audit_log` — ver 08_TRADING para el ciclo de vida completo y el esquema de auditoría.

## Fuentes
Kelly, J.L. (1956), "A New Interpretation of Information Rate", Bell System Technical Journal — confirmado, fórmula original. Ed Thorp — aplicación práctica de fracciones de Kelly en apuestas/inversión, ampliamente citado — confirmado como práctica reconocida, fracción exacta recomendada varía según fuente/contexto (mercado vs apuestas discretas). Matemática de recuperación de drawdown — cálculo estándar (`p/(1-p)`), verificable independientemente, no requiere cita externa. Van Tharp — heurística de 1-2% de riesgo por operación — convención de práctica estándar ampliamente citada en literatura de trading de sistemas, no probada como óptima matemáticamente. Umbral de correlación 0.7 — cifra de referencia común en literatura de portfolio management, tratar como punto de partida, no como estándar validado para este producto — sin confirmar.
