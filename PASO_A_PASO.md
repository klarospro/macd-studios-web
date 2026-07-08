# PASO A PASO — MACD COMMERCE OS
# Todo lo que TÚ haces (yo ya construí el código)

---

## PASO 1 — Supabase (10 min)
**Ir a: https://supabase.com → tu proyecto qudeloovtazkkjmyehsx**

1. Dashboard → **SQL Editor** → pegar y ejecutar este SQL:

```sql
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shopify_id text unique, title text, description text,
  price numeric, wholesale_price numeric, supplier text,
  supplier_product_id text, category text, image_url text,
  status text default 'active', is_winner boolean default false,
  created_at timestamptz default now()
);
create table if not exists content_generated (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  agent text default 'cami', type text, platform text,
  content text, status text default 'draft',
  created_at timestamptz default now()
);
create table if not exists posts_published (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references content_generated(id),
  platform text, external_post_id text, metrics jsonb,
  published_at timestamptz default now(), status text
);
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique, total numeric, cost numeric,
  profit numeric, customer_email text,
  fulfillment_status text default 'pending',
  supplier_order_id text, tracking_number text,
  created_at timestamptz default now()
);
create table if not exists course_leads (
  id uuid primary key default gen_random_uuid(),
  email text unique, name text, source text, product text,
  status text default 'lead', created_at timestamptz default now()
);
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  event_type text, source text, payload jsonb,
  result text, status text, created_at timestamptz default now()
);
create table if not exists ai_decisions (
  id uuid primary key default gen_random_uuid(),
  agent text default 'santi', decision_type text,
  input jsonb, output jsonb, reasoning text,
  applied boolean default false, created_at timestamptz default now()
);
```

2. Settings → **API** → copiar **service_role key** (la secreta)
3. Pegar en `macd-studios/.env.local` como `SUPABASE_SERVICE_KEY`

---

## PASO 2 — Supabase Secrets (2 min)
**Añadir la key de OpenAI al proyecto Supabase para las Edge Functions:**

Desde tu terminal (en la carpeta lifeos-ai):
```bash
npx supabase secrets set OPENAI_API_KEY=tu-clave-aqui
```

---

## PASO 3 — Deploy Edge Functions (2 min)
Desde la carpeta `lifeos-ai`:
```bash
npx supabase functions deploy cami-generate
npx supabase functions deploy santi-analyze
```

---

## PASO 4 — Resend (5 min)
1. Ir a https://resend.com → crear cuenta gratis
2. **Domains** → Add domain → `macdestudios.com` → seguir los pasos DNS en Cloudflare
3. **API Keys** → Create API Key
4. Pegar en `macd-studios/.env.local` como `RESEND_API_KEY`

---

## PASO 5 — Deploy macd-studios en Vercel (3 min)
1. Ir a https://vercel.com → tu proyecto macd-studios
2. **Settings → Environment Variables** → añadir:
   - `SUPABASE_URL` = https://qudeloovtazkkjmyehsx.supabase.co
   - `SUPABASE_SERVICE_KEY` = (la que copiaste en paso 1)
   - `PANEL_SECRET` = camiysanti2024 (o la que quieras)
   - `RESEND_API_KEY` = (del paso 4)
   - `N8N_WEBHOOK_URL` = la URL de tu n8n
   - `N8N_TOKEN` = un token que tú eliges
3. Redeploy

---

## PASO 6 — n8n (importar workflows)
1. Ir a tu n8n → **Workflows → Import from File**
2. Importar los 6 archivos de `C:\MACD-STUDIOS\commerce-os\n8n-workflows\`
3. En cada workflow, configurar las variables de entorno en n8n:
   - Settings → Variables → añadir SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.
4. **Activar los 6 workflows** (toggle ON)

**Nota WF3 y WF5:** ahora llaman a las Edge Functions de Supabase en vez de OpenAI directamente. La URL es:
- `https://qudeloovtazkkjmyehsx.supabase.co/functions/v1/cami-generate`
- `https://qudeloovtazkkjmyehsx.supabase.co/functions/v1/santi-analyze`

---

## PASO 7 — Shopify (cuando estés listo)
1. shopify.com → Start free trial
2. Nombre: `camiysanti-store`
3. Settings → Apps → Develop Apps → Create App → copiar **Admin API Token**
4. Pasármelo a mí → yo configuro los webhooks
5. Settings → Notifications → Webhooks:
   - `product/created` → `https://tu-n8n.com/webhook/shopify-product`
   - `order/created` → `https://tu-n8n.com/webhook/shopify-order`

---

## RESULTADO FINAL

| URL | Qué es |
|-----|--------|
| macdestudios.com | Tu web de agencia (ya existe) |
| macdestudios.com/curso | Landing del curso @camiysanti |
| macdestudios.com/panel?token=camiysanti2024 | Panel de aprobación de contenido |
| shop.macdestudios.com | Tienda Shopify (apuntar en Cloudflare) |

---

## LO ÚNICO QUE FALTA: elegir los 5 productos
Cuando tengas Hertwill conectado → me dices y elegimos juntos.
