# Workflows n8n — avisos y correos de Atlas

Importables en tu n8n (`n8n.macdestudios.com`). Reutilizan el VPS existente; no crean infra nueva.

## 1. `atlas-solicitud-telegram.json` — aviso al inscribirse un cliente
Cuando alguien envía el formulario `/atlas/solicitud`, la web hace `POST` a
`{N8N_WEBHOOK_URL}/webhook/atlas-solicitud` con todos los datos y un campo `text` ya
formateado. Este workflow reenvía ese `text` a tu Telegram.

**Pasos para activarlo:**
1. n8n → *Workflows* → *Import from File* → `atlas-solicitud-telegram.json`.
2. En el nodo **Telegram**: crea/enlaza tu credencial *Telegram API* (token de @BotFather)
   y pon tu `chat_id` en el campo `chatId` (reemplaza `PON_AQUI_TU_CHAT_ID`).
3. Guarda y activa (toggle *Active*).
4. En la web (Vercel), define `N8N_WEBHOOK_URL=https://n8n.macdestudios.com` (y opcional
   `N8N_TOKEN`). A partir de ahí, cada solicitud te llega por Telegram con: nombre, correo,
   teléfono, perfil, **importe**, **fecha de la llamada** y mensaje.

> ¿No sabes tu `chat_id`? Escríbele algo a tu bot y visita
> `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` — el `chat.id` sale ahí.

## 2. `atlas-aprobacion-email.json` — correo al aprobar en el panel
Cuando apruebas una solicitud en `/panel/atlas/solicitudes`, la web hace `POST` a
`{N8N_WEBHOOK_URL}/webhook/atlas-aprobacion` con `email`, `subject`, `email_body`,
`name` y `contrato`. Este workflow envía el correo de aprobación al cliente (SMTP) y te
confirma por Telegram.

**Pasos:**
1. Importa `atlas-aprobacion-email.json`.
2. Nodo **Email**: enlaza tu credencial *SMTP* y pon tu correo remitente.
3. Nodo **Telegram**: credencial + `chat_id` (igual que arriba).
4. Guarda y activa.

## Alternativa sin n8n (respaldo)
El endpoint web ya envía **directo a Telegram** si defines `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` en el entorno de la web. Útil para el aviso de solicitud aunque no
montes n8n. (El correo de aprobación sí requiere n8n u otro proveedor de email.)
