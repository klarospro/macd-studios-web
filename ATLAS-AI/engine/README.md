# Atlas Engine (motor de trading — modo paper)

Proceso Node.js/TypeScript de larga duración (corre en el VPS Hetzner, no en Vercel — ver `11_MT5/00_RESUMEN.md`). Implementa el diseño aprobado en `08_TRADING` y `09_RISK`. **Solo modo paper. Nada de dinero real.**

## Estructura

```
src/
  config/riskConfig.ts     Parámetros de riesgo aprobados (1% riesgo, 1/4 Kelly, drawdown, breakers)
  domain/types.ts          Signal, Order, Position, AccountState, RiskDecision
  risk/riskGate.ts         Validación obligatoria previa a toda orden
  risk/riskGate.test.ts    Tests del risk gate
  broker/brokerAdapter.ts  Interfaz común (broker intercambiable)
  broker/paperAdapter.ts   Adaptador en memoria (sin credenciales)
  broker/derivDemoAdapter.ts  Esqueleto Deriv (WebSocket) — pendiente de implementar
  audit/auditLog.ts        Registro append-only (órdenes ejecutadas y RECHAZADAS)
  engine.ts                señal → risk gate → adaptador → auditoría
```

## Uso

```
cd engine
npm install
npm run typecheck
npm test
```

## Estado

- ✅ Núcleo agnóstico de broker: risk gate, sizing, breakers, auditoría, ciclo de vida en paper con `PaperAdapter`.
- ✅ `DerivDemoAdapter`: WebSocket completo contra cuenta demo — `connect/authorize` (guard `is_virtual==1`), `getEquity` (`balance`), `placeOrder` (`proposal`+`buy` con Multipliers) y `closePosition` (`sell` con reintento ante "Waiting for entry tick"). Validado end-to-end con `npm run smoke:deriv`. Scope del token: `read` + `trade` únicamente.
- Mapeo `Order`→Deriv (decisión de demo): producto **Multiplier** (`MULTUP`/`MULTDOWN`), `amount = riskAmount` con `basis: stake` (pérdida máx. acotada al stake), `multiplier` de config (`DERIV_MULTIPLIER`, default 100). `entryPrice`/`stopPrice` no se envían (Deriv abre a mercado). El broker de dinero real usará su propio mapeo.

## Seguridad

- El token de Deriv se lee de `DERIV_API_TOKEN` (variable de entorno / `.env.local`), nunca en el código ni en git.
- Toda orden pasa por `riskGate.evaluate` antes de enviarse; los rechazos se registran en la auditoría.
