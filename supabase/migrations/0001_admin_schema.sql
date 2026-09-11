-- MACD Studios — Panel Financiero
-- Pega este archivo completo en el SQL Editor de Supabase (proyecto existente) y ejecútalo.
-- Crea las tablas del panel administrativo, numeración automática de facturas, RLS y el
-- bucket de Storage para documentos (recibos, contratos, PDFs de factura).

-- ============================================================================
-- Clientes
-- ============================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  tax_id text,
  address text,
  city text,
  state text,
  country text default 'US',
  zip_code text,
  email text,
  phone text,
  preferred_currency text default 'USD',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- Facturas
-- ============================================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  invoice_number text not null unique,
  issue_date date not null default current_date,
  due_date date not null,
  currency text default 'USD',
  exchange_rate numeric(10,6) default 1.0,
  subtotal numeric(12,2) default 0,
  tax_total numeric(12,2) default 0,
  total numeric(12,2) default 0,
  status text default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  payment_method text,
  stripe_payment_link text,
  stripe_payment_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2) not null,
  tax_rate numeric(5,2) default 0,
  line_total numeric(12,2) generated always as (quantity * unit_price * (1 + tax_rate/100)) stored,
  sort_order int default 0
);

-- ============================================================================
-- Cuentas de Trading / Fondeo  (se crea antes de transactions por la FK)
-- ============================================================================
create table if not exists trading_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_size numeric(12,2) not null,
  account_type text default 'evaluation' check (account_type in ('evaluation','funded','blown')),
  status text default 'active' check (status in ('active','passed','failed','payout_pending','closed')),
  purchase_date date not null,
  purchase_cost numeric(12,2) not null,
  funded_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists trading_pnl (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references trading_accounts(id) on delete cascade,
  date date not null,
  gross_profit numeric(12,2) not null,
  fees numeric(12,2) default 0,
  net_profit numeric(12,2) generated always as (gross_profit - fees) stored,
  is_payout boolean default false,
  payout_status text check (payout_status in ('pending','received','rejected')),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- Inversiones / Préstamos recibidos  (se crea antes de transactions por la FK)
-- ============================================================================
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  investor_name text not null,
  relationship text default 'external' check (relationship in ('owner','family','external')),
  type text not null check (type in ('capital_contribution','loan')),
  amount numeric(12,2) not null,
  currency text default 'USD',
  date date not null default current_date,
  interest_rate numeric(5,2),
  repayment_due_date date,
  repayment_schedule text,
  contract_url text,
  status text default 'active' check (status in ('active','fully_repaid','converted_to_equity','defaulted')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists distributions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid references investments(id),
  date date not null default current_date,
  amount numeric(12,2) not null,
  currency text default 'USD',
  concept text,
  receipt_url text,
  created_at timestamptz default now()
);

-- ============================================================================
-- Transacciones (Form 5472 ready)
-- ============================================================================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('income','expense')),
  category text not null,
  subcategory text,
  description text not null,
  amount numeric(12,2) not null,
  currency text default 'USD',
  usd_amount numeric(12,2) not null,
  exchange_rate numeric(10,6) default 1.0,
  invoice_id uuid references invoices(id),
  trading_account_id uuid references trading_accounts(id),
  investment_id uuid references investments(id),
  is_related_party boolean default false,
  related_party_name text,
  receipt_url text,
  mercury_transaction_id text,
  mercury_synced boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_invoices_client_id on invoices(client_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_category on transactions(category);
create index if not exists idx_transactions_related_party on transactions(is_related_party);
create index if not exists idx_transactions_mercury_id on transactions(mercury_transaction_id);
create index if not exists idx_trading_pnl_account_id on trading_pnl(account_id);
create index if not exists idx_distributions_investment_id on distributions(investment_id);

-- ============================================================================
-- Numeración automática de facturas: MACD-{AÑO}-{SEQ de 3 dígitos}
-- Atómico vía upsert + RETURNING, evita condiciones de carrera.
-- ============================================================================
create table if not exists invoice_number_seq (
  year int primary key,
  last_seq int not null default 0
);

create or replace function next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  insert into invoice_number_seq(year, last_seq)
  values (y, 1)
  on conflict (year) do update set last_seq = invoice_number_seq.last_seq + 1
  returning last_seq into n;

  return 'MACD-' || y::text || '-' || lpad(n::text, 3, '0');
end;
$$;

-- ============================================================================
-- RLS — solo usuarios autenticados de este proyecto Supabase (un único owner)
-- ============================================================================
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table transactions enable row level security;
alter table trading_accounts enable row level security;
alter table trading_pnl enable row level security;
alter table investments enable row level security;
alter table distributions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['clients','invoices','invoice_items','transactions','trading_accounts','trading_pnl','investments','distributions']
  loop
    execute format('drop policy if exists "authenticated_full_access" on %I', t);
    execute format(
      'create policy "authenticated_full_access" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- Storage: bucket privado para recibos, contratos y PDFs de factura
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_authenticated_all" on storage.objects;
create policy "documents_authenticated_all" on storage.objects
  for all
  using (bucket_id = 'documents' and auth.role() = 'authenticated')
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');
