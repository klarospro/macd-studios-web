# Publicidad para crecer — MACD Studios

Versión 1.0 · 27/09/2026 · Complementa `PLAN-MAESTRO.md` (§5, "Anuncios") y `docs/MOTOR_CONTENIDO.md`

> **Regla del plan maestro:** se escala **lo que ya funcionó en orgánico**. Los anuncios no
> arreglan un mensaje que no conecta: lo amplifican. Por eso hay una fase de prueba barata antes
> de meter dinero de verdad. **El presupuesto lo decide Moisés** (este documento propone).

---

## 1. Objetivo y embudo

**Objetivo único:** solicitudes de **auditoría gratis** de dueños de inmobiliarias y negocios locales.

```
Anuncio (Reels/Stories/Feed IG + FB)
   → /auditoria  (mensaje central + prueba en vivo con Max + formulario)
   → bot_leads con el origen del anuncio (utm_campaign / utm_content)
   → aviso a Moisés por Telegram con la campaña → contacto en < 1 h → auditoría en 48 h → propuesta
```

Mensaje central: *"Cada mensaje que contestas tarde es un cliente que se va con tu competencia."*

## 2. Lo que ya está preparado en la web (PR `feat/preparar-anuncios`)

| Pieza | Estado |
|---|---|
| Landing **/auditoria**: un mensaje, dos botones (auditoría / probar a Max), sin menú | ✅ probada en móvil |
| Aviso de cookies con **Aceptar / Rechazar** (obligatorio en la UE para el Pixel) | ✅ probado: al rechazar no se carga nada |
| **Meta Pixel**: solo con consentimiento. Evento `Lead` al pedir la auditoría | ✅ a falta de `NEXT_PUBLIC_META_PIXEL_ID` |
| **Conversions API**: el mismo `Lead` desde el servidor, con el mismo `event_id` para que no se duplique | ✅ a falta de `META_PIXEL_ID` y `META_CAPI_TOKEN` |
| **Origen de cada lead** (UTM) en `bot_leads`, visible en Propuestas y en el aviso de Telegram | ✅ migración 0006 aplicada |
| Política de cookies actualizada | ✅ redactada. **Moisés debe revisarla** |

## 3. Estructura de la campaña (Meta Ads Manager)

**Campaña:** objetivo **Clientes potenciales**, con conversión en el **sitio web** y evento `Lead`.
- Nombre: `auditoria-inmo-es`.
- Categoría especial: **ninguna**. Anunciamos un servicio para agencias, no viviendas, así que no aplica "Vivienda".

| Conjunto | Público | Ubicaciones |
|---|---|---|
| A · España inmobiliarias | España, 25–60 años. Intereses: inmobiliaria, agente inmobiliario, Idealista, Fotocasa y gestión inmobiliaria, **o** Advantage+ audiencia con esa sugerencia | Advantage+ (Reels, Stories, Feed) |
| B · LatAm inmobiliarias | México, Colombia, Argentina, Chile, Perú; mismos intereses. Coste por lead más bajo | Advantage+ |
| C · Retargeting (cuando haya tráfico) | Visitó /auditoria o habló con Max, y no pidió la auditoría (30 días) | Stories + Feed |

**Anuncios:** 3–5 por conjunto, con los **mejores reels y carruseles orgánicos** (los de más
guardados y compartidos en `/admin/redes`). No se hace contenido nuevo solo para anuncios.

**Enlace (UTM obligatorio):**
```
https://www.macdestudios.com/auditoria?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```
Meta sustituye `{{…}}` solo. Así cada lead llega con **qué anuncio lo trajo**.

## 4. Presupuesto propuesto (decide Moisés)

| Fase | Qué | Presupuesto |
|---|---|---|
| **1 · Prueba** (14 días) | Conjuntos A y B, 3 anuncios cada uno. Se apagan los que en 4 días no bajen del coste por lead objetivo | **5 €/día por conjunto → ~140 € en total** |
| **2 · Escalar** | Solo el ganador: +20 % de presupuesto cada 3 días mientras el coste por lead se mantenga | Según resultados |
| **3 · Retargeting** | Conjunto C cuando haya más de 1.000 visitas a /auditoria | 3–5 €/día |

**Métricas que mandan** (en este orden):
1. **Coste por auditoría pedida:** se fija el objetivo tras la fase 1.
2. **% de auditorías que llegan a propuesta.**
3. Coste por clic y CTR, solo para diagnosticar.

Los "me gusta" no cuentan.

## 5. Textos de anuncio (sin promesas que no podamos probar)

1. **Gancho de dolor:** "Un cliente te escribe a las 22:40. Contestas mañana. Ya habló con otras tres inmobiliarias. → Auditoría gratis: te decimos cuántos se te escapan."
2. **Prueba en vivo:** "No te lo cuento: pruébalo. Habla ahora con Max, el asistente que responde nuestros mensajes 24/7. Si te convence, te lo montamos."
3. **Pregunta:** "¿Cuántos mensajes contestas tarde a la semana? Si no lo sabes, ese es el problema. Auditoría gratis en 48 h."

Reglas de Meta y del plan: nada de escasez falsa, testimonios inventados ni cifras sin fuente. No
usar el "70%". Nada de "garantizado". No señalar atributos personales del lector (por ejemplo
"¿eres agente inmobiliario y estás arruinado?").

## 6. Lo que tiene que hacer Moisés (checklist)

1. **Business Manager y Pixel:** en business.facebook.com, crear el porfolio empresarial MACD Studios, un **conjunto de datos (Pixel)** y el **token de la Conversions API** (Events Manager → Configuración).
2. **Vercel:** `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID` (el mismo número) y `META_CAPI_TOKEN`, y después Redeploy.
3. **Verificar el dominio** macdestudios.com en Business Manager (Seguridad de la marca → Dominios).
4. **Cuenta publicitaria:** método de pago y límite de gasto de la cuenta, **por encima del presupuesto elegido y no más**.
5. **Instagram profesional** vinculado al porfolio (sección 7).
6. **Revisar** la nueva política de cookies y hacer merge del PR.
7. Lanzar la **fase 1** con los 3 mejores contenidos orgánicos.

## 7. Instagram listo para recibir tráfico de anuncios

Quien llega desde un anuncio mira el perfil antes de escribir. El perfil tiene que confirmar la
promesa del anuncio en 3 segundos.

**Nombre** (busca por palabras clave): `Moisés · Automatización IA para inmobiliarias`

**Bio** (elige una, máx 150 caracteres):
- A: `Ayudo a inmobiliarias a no perder clientes por contestar tarde 🏠⚡ Atención 24/7 con IA · Auditoría gratis 👇`
- B: `Tu inmobiliaria atendiendo 24/7 sin contratar a nadie. Pruébalo tú: habla con Max 👇 Auditoría gratis en 48 h`
- C: `Cada mensaje que contestas tarde es un cliente perdido. Lo arreglamos con IA. Auditoría gratis 👇`

**Enlace de la bio:**
`https://www.macdestudios.com/auditoria?utm_source=instagram&utm_medium=bio&utm_campaign=perfil`

**Destacadas**, 5 portadas negras con icono dorado:
1. **Max en vivo**: grabación de pantalla de Max contestando.
2. **Auditoría**: qué recibes y en cuánto tiempo.
3. **Cómo funciona**: los 3 pasos del sistema.
4. **Proyectos**: vista-inmobiliaria y el panel, reales.
5. **Sobre mí**: quién es Moisés y por qué hace esto.

**3 publicaciones fijadas:**
1. El reel de "22:40" (dolor).
2. Demo de Max (prueba).
3. El carrusel "El mapa para montar un agente de WhatsApp" (valor, se guarda).

**Automatización de la palabra clave:** cada CTA "Comenta AGENTE / AUDITORÍA" se responde por DM.
- Por ahora, a mano.
- Siguiente paso: ManyChat (plan gratis para empezar) o Max en Instagram (ver `AUDITORIA_INSTA_P8.md`).

**Conectar Instagram al panel:** pendiente de que Meta verifique la cuenta de desarrollador (SMS
o tarjeta). Mientras tanto, el Benchmark viral y el plan semanal ya funcionan con TikTok y con la
investigación web.
