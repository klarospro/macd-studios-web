# Motor de Contenido y Redes — MACD Studios

Versión 1.0 · 26/09/2026 · Fase A del `PLAN-MAESTRO.md`

> Resumen en una línea: **el agente propone, Moisés aprueba con un clic y el sistema publica
> una pieza al día en Instagram y TikTok, mide qué funciona y lo usa para la siguiente semana.**
> El contexto de crecimiento que comparten los agentes vive en `lib/admin/growth-context.ts`.

---

## 1. Visión

Las redes no están para acumular likes. Están para llenar el CRM (`bot_leads`) de gente que pide
la auditoría gratis o que habla con Max. El contenido es también la prueba de lo que vende MACD:
*"el sistema con el que yo mismo capto clientes"*.

```
Referencias (cuentas que crecieron) ──┐
Tus métricas reales (IG + TikTok) ────┼─► Analista ─► Estratega/Guionista ─► 7 guiones/semana
Diagnóstico comercial (plan §7) ──────┘                                   │
                                                  Moisés aprueba el guion ┘
                                                           ↓
                  Productor: Remotion (hoy) · fal.ai / HeyGen / ElevenLabs (siguiente)
                                                           ↓
                                  Moisés aprueba el video o carrusel (en el panel)
                                                           ↓
                   Publicador: cron diario a las 19:00 (Madrid) → Instagram + TikTok
                                                           ↓
                  Sincronización diaria de métricas → vuelve al Analista (el ciclo se cierra)
```

## 2. Qué hay construido (PR `feat/redes-contenido` + repo `macd-content`)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Base de datos | `supabase/migrations/0003_redes_contenido.sql` | `content_items`, `social_accounts`, `social_tokens` (solo servidor), `social_posts`, `social_metrics_daily`, `social_analyses`, `social_references` y el bucket `content-media` |
| Pantalla Redes | `/admin/redes` | Conectar IG y TikTok (OAuth), seguidores con gráfica, KPIs de 30 días, top publicaciones, **Analizar mi perfil** y **Cuentas de referencia** |
| Pantalla Contenido | `/admin/contenido` | **Generar 7 piezas**, tablero Guion → Producción → Revisión → Programado, edición, subida de archivos y "Publicar ahora" |
| Dashboard | `/admin` | Fila de crecimiento: leads de 30 días, seguidores y piezas programadas |
| Cron diario | `/api/cron/daily` + `vercel.json` (17:00 UTC) | Publica lo aprobado para hoy y sincroniza métricas |
| Plantillas | repo `macd-content` (Remotion) | Reel 1080×1920 y carrusel 1080×1350 con la marca MACD |
| Productor | `macd-content/scripts/render-pending.mjs` | Renderiza lo que está en Producción, lo sube a Storage y lo pasa a Revisión |

### Los agentes y su contexto

| Agente | Lee | Produce |
|---|---|---|
| **Analista** (Analizar mi perfil) | Métricas reales, top y peores publicaciones, referencias | Diagnóstico, bio nueva, patrones y plan de 14 días → `social_analyses` |
| **Escáner de referencias** | Datos públicos de una cuenta Business o Creator | Por qué crece, fórmulas de gancho y adaptación a MACD → `social_references` |
| **Estratega y Guionista** (Generar 7 piezas) | Último análisis, mejores publicaciones, referencias y foco de la semana | 7 `content_items` en Guion, uno por día |
| **Productor** | `content_items` en Producción | MP4 o JPG en Storage |
| **Publicador** (cron) | `content_items` aprobados para hoy | Publicación en IG y TikTok, y el error si lo hay |

Todos cargan `MACD_BUSINESS_CONTEXT` (qué vende MACD) y `MACD_GROWTH_CONTEXT` (cómo crecemos).
Si cambia la estrategia, se cambian esos dos archivos, no cada prompt por separado.

## 3. Escáner de cuentas de referencia

- **Cómo:** con Instagram **Business Discovery**, la API oficial de Meta. Lee datos públicos
  (seguidores, últimas 40 publicaciones con likes, comentarios, texto y formato) de cualquier
  cuenta **Business o Creator**. No usa scraping, que viola los términos y quema la cuenta.
- **Límite:** Business Discovery no da vistas ni alcance de otras cuentas, solo likes y
  comentarios. El agente lo sabe y no inventa esos datos.
- **Requisito de Meta:** solo existe en *Instagram API con Facebook Login*, que es distinta de la
  conexión que usamos para publicar. Hace falta que tu cuenta de IG esté vinculada a una Página
  de Facebook. Variables: `IG_DISCOVERY_TOKEN` e `IG_DISCOVERY_USER_ID`.
- **Qué se hace con los datos:** se copian **estructuras** (fórmulas de gancho, ritmo y formato),
  nunca textos, videos ni marcas ajenas.
- **Primeras referencias recomendadas:** 3–5 cuentas de tu nicho (agencias de IA y automatización
  en español, e inmobiliarias con contenido fuerte) que hayan crecido este año. Las eliges tú o se
  las pides al analista.

## 4. Generación de video, imagen, avatar y voz (siguiente paso, requiere saldo)

**Veredicto sobre `wide-trace/open-higgsfield`** (revisado el 26/09): **no se usa.**
- Es una interfaz web para la API de pago de **Higgsfield**, no un motor propio. La clave y el
  gasto siguen yendo a Higgsfield.
- **No tiene licencia**, así que legalmente no se puede copiar su código a un producto.
- Está pensado para que una persona genere a mano. Nosotros necesitamos que lo haga un agente.
- La versión alojada (openhiggsfield.ai) pide tu clave de la plataforma: **no pegarla ahí.**

**Decisión:** los agentes llaman directamente a las APIs, sin intermediarios:

| Necesidad | Servicio | Por qué |
|---|---|---|
| Video de IA (planos, b-roll) e imágenes | **fal.ai** (Kling, Seedance, Veo y Flux con una sola clave) | Pago por uso, sin suscripción, API documentada y los mismos modelos que Higgsfield. **Alternativa:** API de Higgsfield si sale más barata por clip. |
| Avatar de Moisés hablando | **HeyGen API** | Avatar a partir de 2–5 minutos de video tuyo a cámara |
| Voz (avatar y Viernes) | **ElevenLabs** | Voz clonada o de catálogo; la misma cuenta sirve para el bot Viernes |
| Montaje con la marca | **Remotion** (ya hecho) | Une avatar, b-roll, subtítulos y marca en un MP4 final |

**Cómo encaja sin rehacer nada:** el Productor gana un paso previo. Para cada reel pide a fal.ai
los planos de fondo y a HeyGen el avatar leyendo el guion. Después Remotion los monta con las
plantillas actuales. El flujo de aprobación del panel no cambia.

## 5. Presupuesto para arrancar

Mismo cálculo que el plan maestro, §4: **~$150–160 al mes** (Anthropic $50, fal.ai $50,
HeyGen ~$24–30, ElevenLabs ~$22). Instagram, TikTok, Remotion (hasta 3 personas) y el cron de
Vercel cuestan $0. **La recarga de saldo la haces tú, porque es un tema de finanzas.**

## 6. Lo que tienes que hacer tú, en orden

1. **Backup de Supabase** y ejecutar `supabase/migrations/0003_redes_contenido.sql` en el SQL Editor.
2. **Meta:** crear una app en developers.facebook.com → producto *Instagram* → *API setup with
   Instagram login*. Añadir la URL de redirección
   `https://macdestudios.com/api/social/instagram/callback` y tu cuenta de IG como tester.
   Tu cuenta tiene que ser **profesional** (Business o Creator).
   → Vercel: `INSTAGRAM_APP_ID` y `INSTAGRAM_APP_SECRET`.
3. **TikTok:** crear una app en developers.tiktok.com con *Login Kit* y *Content Posting API*
   (Direct Post). Añadir la URL de redirección `https://macdestudios.com/api/social/tiktok/callback`.
   → Vercel: `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.
   ⚠️ **Hasta que TikTok apruebe la app (auditoría), lo que se publica por API sale en privado.**
   Se hace público desde la app con un toque. Con la auditoría aprobada, poner `TIKTOK_AUDITED=true`.
4. **Vercel:** `CRON_SECRET` (una cadena aleatoria larga). Sin ella, el cron no hace nada.
5. **Referencias (opcional pero recomendado):** vincular tu IG a una Página de Facebook y generar
   un token con `instagram_basic` y `pages_show_list` → `IG_DISCOVERY_TOKEN` e `IG_DISCOVERY_USER_ID`.
6. **Productor:** en `macd-content/.env` poner `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, y correr
   `npm run render:pending`. Más adelante irá en un cron del VPS.
7. **Primer día:** Redes → Conectar → Analizar mi perfil → Contenido → Generar 7 piezas →
   aprobar guiones → render → aprobar → sale solo a las 19:00.

## 7. Qué viene después (en orden)

1. Conectar fal.ai, HeyGen y ElevenLabs al Productor (cuando haya saldo y claves).
2. Aviso por Telegram cuando haya guiones o videos esperando tu aprobación.
3. Responder comentarios y mensajes de IG con Max (usando la auditoría de insta-p8 como referencia).
4. Atribución: `bot_leads` con UTM y origen, para saber qué pieza trajo cada lead (Capa 4).
5. Anuncios: escalar **solo** lo que ya funcionó en orgánico (plan maestro).
