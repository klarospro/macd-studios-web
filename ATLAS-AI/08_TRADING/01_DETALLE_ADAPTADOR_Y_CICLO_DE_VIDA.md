# Detalle: interfaz del adaptador de broker y ciclo de vida de una orden en paper

Todo el pseudocódigo de este documento es documentación de diseño, NO código de producción.

## Interfaz `BrokerAdapter` (pseudocódigo)
```
interface BrokerAdapter:
    conectar(credenciales) -> ConexionEstado
    autenticar() -> SesionInfo
    obtener_cotizacion(instrumento) -> Precio
    obtener_cuenta() -> { balance, equity, moneda, tipo_cuenta }   // tipo_cuenta: demo | real
    enviar_orden(instrumento, direccion, tamaño, stop, take_profit) -> OrdenResultado
    obtener_posiciones() -> [Posicion]
    cancelar_orden(orden_id) -> boolean
    desconectar() -> void
```
- Cada broker (Deriv, futuros MT5/exchanges) implementa esta interfaz sin exponer detalles propios (formato de mensajes WebSocket, autenticación específica) al resto del sistema.
- El módulo de ejecución (`lib/trading/execution/`) solo conoce esta interfaz, nunca el broker concreto.
- Un `MockBrokerAdapter` (simulación pura en memoria, sin llamada de red) sirve para tests unitarios y para 13_BACKTESTING; el `DerivDemoAdapter` implementa la misma interfaz contra la cuenta Deriv-Demo real (llamadas de red reales, dinero virtual).

## Deriv — notas de implementación (a verificar, sin confirmar en esta sesión)
- Protocolo: WebSocket (`api.deriv.com`, según conocimiento general no verificado contra la documentación oficial en esta sesión).
- Requiere registro de aplicación (`app_id`) y autenticación por token de API u OAuth — mecanismo exacto: sin confirmar.
- Cuenta demo: dinero virtual, misma infraestructura de mercado que la cuenta real — confirmar en documentación oficial antes de implementar si el comportamiento de fills/slippage es representativo del real.
- Límites de tasa (rate limits) y códigos de error: sin confirmar — deben mapearse explícitamente a los circuit breakers de 09_RISK (regla 5, "errores/latencia del broker") antes de activar el motor.

## Ciclo de vida de una orden — diagrama de flujo (texto)
```
[Estrategia] --señal--> [Risk Gate] --rechazo--> [trading_audit_log: RECHAZADA]
                              |
                          aprobación
                              v
                      [Ejecución / BrokerAdapter]
                              |
                    ----------------------
                    |                    |
              [Deriv-Demo API]    [trading_audit_log: ENVIADA]
                    |
              [fill / confirmación]
                    |
              [trading_audit_log: EJECUTADA]
```
- La señal NUNCA llega directamente a `Ejecución` — el Risk Gate es un paso obligatorio, no opcional, ni siquiera en paper.
- Un fallo de red/timeout al llamar al broker se trata como evento de circuit breaker (09_RISK regla 5), no como una orden "perdida" silenciosamente.

## Esquema de auditoría (`trading_audit_log`, definido en 18_SECURITY, campos usados por el motor)
| Campo | Ejemplo de valor |
|---|---|
| `tenant_id` | id del cliente/cuenta dentro del SaaS |
| `actor` | `strategy:<nombre>` / `system:risk_gate` / `system:execution` |
| `accion` | `SEÑAL_GENERADA` / `ORDEN_RECHAZADA` / `ORDEN_ENVIADA` / `ORDEN_EJECUTADA` |
| `params` | instrumento, dirección, tamaño calculado, stop, take-profit, riesgo % aplicado |
| `motivo` (solo rechazos) | ej. `"drawdown_diario_excedido"`, `"circuit_breaker_perdidas_consecutivas"` |
| `regla_disparada` (solo rechazos) | referencia a la regla de 09_RISK que causó el rechazo |
| `timestamp` | UTC, con precisión suficiente para reconstruir el orden de eventos |
| `estado_antes` / `estado_despues` | snapshot relevante (ej. equity antes/después, drawdown acumulado) |

INSERT solo desde backend de confianza; UPDATE/DELETE revocado para todos (patrón WORM, ya definido en 18_SECURITY). Las órdenes rechazadas se auditan con el mismo rigor que las ejecutadas — es el principal mecanismo de trazabilidad para revisar si el risk gate está funcionando como se diseñó.

## Qué NO cubre este documento (diferido)
- Implementación real del `DerivDemoAdapter` (código de producción, siguiente paso de Fase 3, requiere primero verificar documentación oficial de Deriv).
- Motor de backtesting histórico (13_BACKTESTING) — reutilizará la misma interfaz `BrokerAdapter` vía un `HistoricalReplayAdapter`, pero el diseño de ese adaptador no se aborda aquí.
- Persistencia/latencia real de WebSocket en Vercel serverless — señal ya anotada como decisión diferida en 02_ARCHITECTURE.
