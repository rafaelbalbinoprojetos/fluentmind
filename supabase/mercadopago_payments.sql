-- Auditoria de pagamentos Mercado Pago processados pelo webhook
create table if not exists public.mercadopago_payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  status text not null,
  user_id uuid null references auth.users(id) on delete set null,
  payer_email text null,
  plan text null,
  amount numeric(18, 6) null,
  currency text null,
  payment_method text null,
  external_reference text null,
  approved_at timestamptz null,
  processed_at timestamptz not null default now(),
  webhook_result text not null default 'ignored',
  webhook_reason text null,
  source text not null default 'mercadopago-webhook',
  raw jsonb not null default '{}'::jsonb
);

create index if not exists mercadopago_payments_processed_at_idx
  on public.mercadopago_payments (processed_at desc);

create index if not exists mercadopago_payments_user_id_idx
  on public.mercadopago_payments (user_id);

alter table public.mercadopago_payments enable row level security;

-- Painel acessível apenas ao email master fixo solicitado.
create policy if not exists "master-can-read-mercadopago-payments"
on public.mercadopago_payments
for select
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'balbino10@hotmail.com');

