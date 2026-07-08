# Runbook — desplegar el bot Atlas 24/7 en el VPS Hetzner

Objetivo: que el ciclo de trading (Deriv DEMO) corra **solo, todos los días, sin tu portátil**,
publicando a Supabase y avisando por Telegram. Cadencia: 1 vez/día a las **00:05 UTC** (tras el
cierre de la vela diaria). La estrategia usa velas diarias, así que ésta es la cadencia correcta.

> **Seguridad:** todo esto es sobre la cuenta **DEMO** de Deriv (dinero ficticio). El adaptador
> aborta si el token NO es de una cuenta virtual (`derivDemoAdapter.ts:42`). Nunca pegues secretos
> en el chat, en git ni en estos archivos: van solo en `/opt/atlas/ATLAS-AI/.env.local` en el VPS.

VPS: Hetzner CX32 · `167.233.27.69` (mismo que n8n/macdestudios.com — no tocar lo existente).

---

## 1. Entrar al VPS y crear usuario de servicio

```bash
ssh root@167.233.27.69

# Usuario sin privilegios para correr el bot (aislado de root y de n8n).
adduser --system --group --home /opt/atlas atlas
mkdir -p /opt/atlas && chown atlas:atlas /opt/atlas
```

## 2. Node.js 22 LTS (si no está ya en el VPS)

```bash
node --version   # si ya sale v20+ salta este paso
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
which node npm   # anota las rutas: normalmente /usr/bin/node y /usr/bin/npm
```

Si `npm` NO está en `/usr/bin`, edita `ExecStart=` en los `.service` con la ruta real.

## 3. Traer el código

El repo es privado (GitHub `klarospro`). Opción A (deploy key de solo lectura, recomendada):

```bash
sudo -u atlas ssh-keygen -t ed25519 -f /opt/atlas/.ssh/id_ed25519 -N ""
sudo -u atlas cat /opt/atlas/.ssh/id_ed25519.pub
# → pega esa clave como Deploy Key (read-only) en el repo de GitHub, luego:
sudo -u atlas git clone git@github.com:klarospro/<REPO>.git /opt/atlas/ATLAS-AI
```

Opción B (rápida, con Personal Access Token de solo lectura):

```bash
sudo -u atlas git clone https://<PAT>@github.com/klarospro/<REPO>.git /opt/atlas/ATLAS-AI
```

## 4. Instalar dependencias

```bash
cd /opt/atlas/ATLAS-AI/engine
sudo -u atlas npm install
sudo -u atlas npm test   # 15/15 deben pasar antes de seguir
```

## 5. Secretos: crear `.env.local` en el VPS

```bash
sudo -u atlas nano /opt/atlas/ATLAS-AI/.env.local
```

Contenido mínimo (rellena los valores; NO los pongas en git ni en el chat):

```
# Deriv — cuenta DEMO (el adaptador rechaza tokens no-virtuales)
DERIV_API_TOKEN=      # token DEMO, scope read + trade (NUNCA payments/admin)
DERIV_APP_ID=1089
DERIV_MULTIPLIER=100

# Supabase — para dashboard + auditoría (service key = solo backend, nunca en el front)
SUPABASE_SERVICE_KEY=    # de Project Settings → API → service_role
# SUPABASE_URL=          # opcional; si falta se deriva del JWT del service key

# Telegram — aviso de cada entrada (o usa N8N_WEBHOOK_URL en su lugar)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

```bash
chmod 600 /opt/atlas/ATLAS-AI/.env.local
```

## 6. Crear tablas en Supabase (una sola vez)

En el SQL Editor del proyecto Atlas, corre en orden:
`engine/db/001_trading_audit_log.sql` (crea `trading_audit_log` + `equity_log`),
`engine/db/003_atlas_positions.sql`, `engine/db/004_positions_pnl.sql`.

## 7. Prueba en seco ANTES de automatizar (sin --execute)

```bash
cd /opt/atlas/ATLAS-AI/engine
sudo -u atlas --preserve-env npm run cycle:daily
```

Debe: conectar a Deriv demo, imprimir equity, calcular señales por instrumento y publicar el
snapshot. Si eso funciona, prueba UNA ejecución real en demo y verifica los tres canales:

```bash
sudo -u atlas npm run cycle:daily -- --execute
# Verifica: (1) llegó el aviso a Telegram, (2) equity_log/atlas_positions en Supabase,
# (3) engine/runtime/audit.jsonl tiene el order_placed.
```

## 8. Instalar el timer diario (systemd)

```bash
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-cycle.service /etc/systemd/system/
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-cycle.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atlas-cycle.timer

# Verificar
systemctl list-timers atlas-cycle.timer     # próxima ejecución = mañana 00:05 UTC
systemctl start atlas-cycle.service          # forzar una corrida ya, para probar el servicio
journalctl -u atlas-cycle.service -n 50 --no-pager
```

## 9. (Opcional) Dashboard en vivo entre ciclos

Solo si quieres que el equity/P&L se refresque cada 5 min (no opera, solo publica):

```bash
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-publish.service /etc/systemd/system/
cp /opt/atlas/ATLAS-AI/16_AUTOMATION/deploy/atlas-publish.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atlas-publish.timer
```

## 10. Operación diaria

```bash
journalctl -u atlas-cycle.service -n 100 --no-pager   # ver la última corrida
systemctl list-timers 'atlas-*'                        # cuándo corre la próxima
```

Para **parar el bot**: `systemctl disable --now atlas-cycle.timer atlas-publish.timer`.
Para actualizar el código: `cd /opt/atlas/ATLAS-AI && sudo -u atlas git pull && cd engine && sudo -u atlas npm install`.

---

## Notas de diseño (por qué así)
- **Timer systemd, no daemon 24/7**: la señal solo cambia al cerrar la vela diaria, así que un
  proceso permanente gastaría recursos sin cambiar decisiones. `oneshot` + timer es lo correcto.
- **Riesgo topado en el broker**: en Deriv usamos Multipliers; la pérdida máxima por posición está
  acotada al stake (`derivDemoAdapter.ts:108`), así que no hace falta un monitor de stops intradía.
- **Deriv cierra el WS a los ~2 min de inactividad**: por eso conectamos, corremos y desconectamos
  en cada vuelta, en vez de mantener un socket abierto (decisión ya documentada en `11_MT5`).
- **Aislamiento**: usuario `atlas` sin privilegios, systemd endurecido (`ProtectSystem=strict`),
  no toca root ni el n8n existente.
