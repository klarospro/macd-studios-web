# Detalle — Deriv API: endpoints, scopes, secuencia WebSocket

Todo el pseudocódigo/secuencias de este documento son documentación de diseño, NO código de producción. Complementa `00_RESUMEN.md`.

## Conexión
- Endpoint: `wss://ws.derivws.com/websockets/v3?app_id={app_id}&l=EN` (fuente: `legacy-docs.deriv.com/docs/websockets`).
- `app_id`: se registra una vez por aplicación en el dashboard de Deriv (`api.deriv.com` → Register Application). No es secreto por sí mismo (identifica la app, no autentica), pero se trata igualmente como config de entorno (`DERIV_APP_ID`) por higiene.
- Timeout de inactividad: **2 minutos** sin requests/responses → el servidor cierra la conexión. Mitigación: enviar `ping` o `time` periódicamente (ventana recomendada: bastante menor a 2 min, p. ej. cada 30-60s — cifra exacta no fijada por Deriv, decisión de implementación).
- Reconexión: un WebSocket cerrado no se reutiliza; hay que instanciar uno nuevo y repetir `authorize` + volver a suscribir todo (`ticks`, `balance`, `portfolio` con `subscribe:1`). No hay "resume session".
- Tamaño de mensaje: si un mensaje supera 32.767 bytes, el propio WS lo fragmenta automáticamente (transparente para el cliente).

## Autenticación y scopes
| Scope | Qué permite | ¿Necesario para paper trading? |
|---|---|---|
| `read` | Leer datos del cliente (balance, info de cuenta) | Sí |
| `trade` | Crear/cerrar contratos (`buy`, `sell`) | Sí |
| `trading_information` | Leer historial de operaciones (`profit_table`, `statement`) | No (opcional, útil para reporting futuro) |
| `payments` | Cashier: depósitos/retiros | **No — excluir explícitamente** |
| `admin` | Cambiar configuración de cuenta, gestión de tokens | **No — excluir explícitamente** |

- Token: Personal Access Token (PAT) generado por Moisés en su cuenta Deriv (Security & Limits → API token), marcado solo con `read` + `trade` al crearlo. Vive en `DERIV_API_TOKEN` (env var, `.env.local` ya existe). Alternativa OAuth 2.0 (`oauth.binary.com/oauth2/authorize?app_id=...`) es para apps multi-usuario/multi-tenant — se reconsidera en fases posteriores si el SaaS necesita que cada cliente conecte su propia cuenta Deriv; no aplica a este paso (1 cuenta demo de Moisés).
- Llamada de autenticación: `authorize` con el token como parámetro. Debe ser la primera llamada autenticada tras abrir el socket; la respuesta incluye `loginid`, `is_virtual` (confirma que es cuenta demo), `currency`, `balance`, `scopes` concedidos.

## Endpoints clave (ciclo de vida de una orden en paper)
| Paso | Call | Auth requerida | Scope | Notas |
|---|---|---|---|---|
| Autorizar sesión | `authorize` | Token en el propio call | — | Primer call tras conectar |
| Consultar cuenta/balance | `balance` (con `subscribe:1` opcional) | Sí | `read` | `account: "current"` para la cuenta autorizada |
| Obtener precio/ticks | `ticks` / `ticks_history` | No | — (público) | Streaming (`ticks`) o histórico puntual (`ticks_history`) |
| Cotizar contrato antes de comprar | `proposal` | No (pero normalmente se llama ya autenticado) | — (público) | Devuelve `proposal_id` + `ask_price`, insumo de `buy` |
| Enviar orden | `buy` | Sí | `trade` | Usa `proposal_id` devuelto por `proposal`, o parámetros inline con `buy:1` |
| Consultar posiciones abiertas | `portfolio` | Sí | `read` (sin confirmar al 100% contra tabla oficial ítem por ítem; fuentes comunitarias lo sitúan en `read`) | Lista de contratos abiertos con P/L actual |
| Cerrar posición ("cancelar") | `sell` | Sí | `trade` | Deriv no tiene cancelación pre-fill tradicional: los contratos se compran al instante contra una `proposal`; "cancelar" = cerrar (`sell`) una posición ya abierta |
| Consultar límites de API vigentes | `website_status` | No | — (público) | Campo `call_limits`/`api_call_limits`: rate limits dinámicos, sin cifra fija publicada |
| Mantener viva la sesión | `ping` / `time` | No | — | Evita el timeout de 2 min de inactividad |
| Desconectar limpio | `forget_all` + cierre del socket | Sí (forget_all) | — | Cancela todas las suscripciones activas antes de cerrar |

## Secuencia típica de una orden en paper (texto)
```
1. Conectar WS (app_id)
2. authorize(DERIV_API_TOKEN) → confirmar is_virtual == true (cuenta demo)
3. balance(subscribe:1) → estado inicial de cuenta
4. ticks/ticks_history(symbol) → datos para la estrategia
5. [Risk Gate aprueba señal — ver 09_RISK]
6. proposal(contrato deseado) → proposal_id, ask_price
7. buy(proposal_id, price) → contrato abierto, se registra en trading_audit_log (ENVIADA → EJECUTADA)
8. portfolio() → confirmar posición abierta
9. ... (heartbeat con ping/time cada N segundos) ...
10. sell(contract_id) → cerrar posición cuando corresponda
11. forget_all() + cerrar socket
```

## Rate limits — qué se sabe y qué no
- Deriv **no publica** una cifra fija de requests/minuto: depende del tipo de call y de las condiciones del sistema en cada momento (confirmado: `developers.deriv.com/docs/frequently-asked-questions`).
- Forma correcta de conocer el límite vigente: llamar `website_status` y leer `call_limits`/`api_call_limits` en la respuesta, en vez de asumir un número fijo en el código.
- Exceder el límite devuelve un error de la API (no hay baneo automático inmediato), pero abuso sostenido puede derivar en suspensión temporal o permanente de la app — mapear como evento de circuit breaker (`09_RISK`, regla 5c: "errores/latencia del broker"), tratando cualquier error de rate limit como señal de backoff, no como orden perdida silenciosamente.

## MT5 — por qué queda descartado para este paso
- Deriv MT5 es un terminal MetaTrader 5 (protocolo propio de MetaQuotes, no la Deriv API), requiere Expert Advisor en MQL5 o un puente MT5↔proceso externo.
- Fuente oficial (`deriv.com/trading-platforms/deriv-mt5`): Deriv **no ofrece VPS propio** para MT5 — el usuario debe contratar/mantener su propio VPS (típicamente Windows) para correrlo 24/7.
- Esto coincide con la nota ya registrada en `00_FOUNDATION/03_MCP_TRADING_INVESTIGADO.md`: MT5 exige terminal Windows, infraestructura que no existe hoy en el proyecto (VPS actual es Linux/Hetzner) — bloqueado hasta que haya una razón concreta (ej. acceso a un mercado que la Native API no cubra) que justifique añadir esa infraestructura.

## Fuentes
- `developers.deriv.com/docs/intro/authentication/`, `.../docs/intro/api-overview/`, `.../docs/frequently-asked-questions`, `.../docs/trading/buy/`, `.../docs/trading/proposal/`, `.../docs/data/ticks-history/`, `.../docs/check-website-status`, `.../docs/account-apis` — oficial Deriv.
- `legacy-docs.deriv.com/docs/websockets` — oficial Deriv (legacy, aún online).
- GitHub oficial `deriv-com/deriv-api` (`docs/DerivAPI.md`) — SDK oficial de Deriv.
- `deriv.com/trading-platforms/deriv-mt5` — oficial Deriv (VPS no incluido para MT5).
- `vercel.com/docs/functions/limitations` — oficial Vercel, consultado 2026-07 (duración máxima de Functions).
- `community.deriv.com` — foro comunitario, usado solo de apoyo donde no había página oficial equivalente (marcado explícitamente en el texto donde aplica).
