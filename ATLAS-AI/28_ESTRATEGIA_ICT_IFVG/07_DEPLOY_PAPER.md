# Despliegue del ciclo PAPER (ICT IFVG, NQ) en el VPS

Objetivo: que `engine/src/live/ictIfvgPaperCycle.ts` corra solo, cada 5 minutos, acumulando operaciones PAPER reales (Yahoo Finance) para juntar más muestra de la que dan los 71 días del backtest — ver `06_VALIDACION_NQ_YAHOO.md`. **No ejecuta nada en ningún broker. No requiere credenciales de IG ni de Deriv.**

## Qué se construyó esta noche
- `engine/src/live/ictIfvgPaperCycle.ts` — probado LOCALMENTE con una corrida real (fetch de Yahoo en vivo, detectó correctamente que era fuera de ventana horaria, guardó `runtime/ictIfvgState.json`). No se ha probado todavía DENTRO de la ventana 9:30-10:10 NY con una señal real disparando.
- `16_AUTOMATION/deploy/atlas-ifvg-cycle.service` + `.timer` — mismo patrón que `atlas-cycle.service`/`atlas-publish.service` ya en producción, adaptado a 5 minutos (la estrategia gestiona la posición todo el día, no solo en la ventana de entrada).

## Diferencia clave con el ciclo de TSMOM ya desplegado
`atlas-cycle.timer` corre 1 vez/día (velas diarias). Esta estrategia necesita 5 minutos porque opera en M5 con ventana horaria estrecha + gestión de TP1/TP2/break-even durante el resto del día. Es exactamente el gap de infraestructura que ya se había anotado en `27_SCALPING/00_RESUMEN.md` ("hace falta un proceso... no timer oneshot diario") — aquí sí se resolvió, con un timer de 5 min en vez de un daemon de larga duración (más simple, mismo resultado: el script es stateless entre ticks, todo el estado vive en `runtime/ictIfvgState.json`).

## Pasos de despliegue (mismo VPS que ya corre atlas-cycle — Hetzner CX32, 167.233.27.69)

Asumiendo que el VPS ya tiene el usuario `atlas`, Node 22 y el repo clonado en `/opt/atlas/ATLAS-AI` (ya hecho para TSMOM, ver `DEPLOY_RUNBOOK.md` §1-4) — **no se repite esa parte**, solo lo nuevo:

```bash
# 1. Traer el código nuevo (esta estrategia) al VPS
cd /opt/atlas/ATLAS-AI && sudo -u atlas git pull
cd engine && sudo -u atlas npm install && sudo -u atlas npm test   # 89/89 deben pasar

# 2. Prueba en seco ANTES de automatizar
cd /opt/atlas/ATLAS-AI/engine
sudo -u atlas node --import tsx src/live/ictIfvgPaperCycle.ts
cat runtime/ictIfvgState.json   # debe existir y tener equity 50000

# 3. Instalar el timer de 5 minutos
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-ifvg-cycle.service /etc/systemd/system/
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-ifvg-cycle.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atlas-ifvg-cycle.timer

# 4. Verificar
systemctl list-timers atlas-ifvg-cycle.timer
journalctl -u atlas-ifvg-cycle.service -n 50 --no-pager
```

## Cómo revisar el progreso (dentro de unos días/semanas)
```bash
cat /opt/atlas/ATLAS-AI/engine/runtime/ictIfvgState.json     # equity actual, posición abierta si hay
cat /opt/atlas/ATLAS-AI/engine/runtime/ictIfvgAudit.jsonl    # una línea JSON por evento (entradas, TP1, cierres, rechazos)
```
Cuando haya una muestra decente (semanas/meses, apuntando a bastante más que los 19-31 trades del backtest de 71 días), pedir que se analice `ictIfvgAudit.jsonl` igual que se analizó el backtest esta noche — mismo estándar de rigor (win rate, PF, walk-forward), antes de considerar demo/real con IG.

## Riesgos y limitaciones declaradas
- **Fuente de precios = Yahoo Finance**, no un feed de broker. Puede fallar, tener desfase, o eventualmente bloquear peticiones frecuentes (864 peticiones/día si corre 24/7 — sin confirmar si Yahoo tolera esto indefinidamente; si empieza a fallar seguido, es la primera sospecha).
- La gestión de TP1/TP2/stop solo mira la ÚLTIMA vela 5M en cada tick — si el timer se salta un tick, un toque intrabar podría no registrarse hasta el siguiente. Aceptable para "acumular muestra", no para ejecución real.
- **No se ha probado con una señal real disparando** (la corrida de esta noche fue fuera de ventana). La primera vez que dispare de verdad conviene revisar `journalctl`/el audit log a mano para confirmar que el comportamiento es el esperado.
- Equity paper (arranca en $50.000) vive solo en `runtime/ictIfvgState.json` — si se borra ese archivo, se reinicia desde cero.

## IMPORTANTE — esto NO se desplegó al VPS esta noche
Se construyó y probó TODO localmente. Tocar el VPS de producción (donde ya corre TSMOM en real/demo) es una acción sobre un sistema compartido — se pidió confirmación explícita antes de tocarlo, ver la conversación. Si Moisés confirma, el despliegue son los 4 pasos de arriba (5-10 minutos).
