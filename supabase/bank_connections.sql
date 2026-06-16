-- Tabela de conexões bancárias via Pluggy
create table if not exists bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,                        -- ID do item no Pluggy
  institution_id text,                          -- ID da instituição no Pluggy
  institution_name text not null,               -- Nome legível: "Nubank", "Itaú", etc.
  institution_logo text,                        -- URL do logo (fornecido pelo Pluggy)
  status text not null default 'connected',     -- connected | error | outdated
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_connections_user_item_unique unique (user_id, item_id)
);

-- Tabela de transações importadas via Pluggy
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references bank_connections(id) on delete cascade,
  pluggy_transaction_id text not null,          -- ID único da transação no Pluggy
  account_id text,                              -- ID da conta no Pluggy
  account_name text,
  description text,
  amount numeric(15, 2) not null,               -- Positivo = crédito, Negativo = débito
  type text,                                    -- debit | credit
  category text,
  date date not null,
  balance_after numeric(15, 2),
  currency_code text default 'BRL',
  raw jsonb,                                    -- Payload completo do Pluggy para referência
  created_at timestamptz not null default now(),
  constraint bank_transactions_pluggy_id_unique unique (user_id, pluggy_transaction_id)
);

-- RLS: cada usuário só acessa seus próprios dados
alter table bank_connections enable row level security;
alter table bank_transactions enable row level security;

create policy "bank_connections: acesso próprio" on bank_connections
  for all using (auth.uid() = user_id);

create policy "bank_transactions: acesso próprio" on bank_transactions
  for all using (auth.uid() = user_id);

-- Índices
create index if not exists bank_connections_user_idx on bank_connections(user_id);
create index if not exists bank_transactions_connection_idx on bank_transactions(connection_id);
create index if not exists bank_transactions_date_idx on bank_transactions(user_id, date desc);
