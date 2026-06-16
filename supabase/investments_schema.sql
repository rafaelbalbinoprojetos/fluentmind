-- KORDEN - Módulo de Investimentos e Rentabilidade
-- Estrutura das tabelas, índices e view auxiliar

-- 1. Catálogo global de ativos
create table if not exists public.ativos (
  id bigserial primary key,
  symbol text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('acao','cripto','etf','moeda','outro')),
  moeda text not null default 'BRL',
  ultimo_preco numeric(18,6),
  variacao_percentual numeric(8,3),
  atualizado_em timestamptz,
  fonte text default 'Yahoo Finance'
);

create index if not exists ativos_symbol_idx on public.ativos (symbol);
create index if not exists ativos_tipo_idx on public.ativos (tipo);

-- 2. Posições individuais dos usuários (carteira)
create table if not exists public.carteira (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ativo_symbol text not null references public.ativos(symbol) on delete cascade,
  quantidade numeric(18,6) not null check (quantidade >= 0),
  preco_medio numeric(18,6) not null check (preco_medio >= 0),
  data_compra date not null default current_date,
  tipo text not null check (tipo in ('acao','cripto','etf','moeda','outro')),
  origem text not null default 'manual',
  observacoes text,
  inserted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists carteira_user_idx on public.carteira (user_id);
create index if not exists carteira_symbol_idx on public.carteira (ativo_symbol);
create unique index if not exists carteira_user_symbol_idx on public.carteira (user_id, ativo_symbol);

create trigger carteira_touch_updated_at
  before update on public.carteira
  for each row
  execute procedure public.moddatetime(updated_at);

-- 3. Histórico diário de preços
create table if not exists public.historico_precos (
  id bigserial primary key,
  ativo_symbol text not null references public.ativos(symbol) on delete cascade,
  preco numeric(18,6) not null check (preco >= 0),
  variacao_percentual numeric(8,3),
  moeda text not null,
  data_registro date not null,
  criado_em timestamptz not null default timezone('utc', now()),
  unique (ativo_symbol, data_registro)
);

create index if not exists historico_precos_symbol_date_idx on public.historico_precos (ativo_symbol, data_registro desc);

-- 4. View consolidada de rentabilidade
create or replace view public.vw_rentabilidade_carteira as
select
  c.user_id,
  c.ativo_symbol,
  a.nome,
  a.tipo,
  a.moeda,
  c.quantidade,
  c.preco_medio,
  a.ultimo_preco,
  round((a.ultimo_preco - c.preco_medio) * c.quantidade, 2) as lucro_total,
  round(((a.ultimo_preco - c.preco_medio) / nullif(c.preco_medio, 0)) * 100, 2) as rentabilidade_percentual,
  a.variacao_percentual as variacao_diaria,
  a.atualizado_em
from public.carteira c
join public.ativos a on a.symbol = c.ativo_symbol;

comment on view public.vw_rentabilidade_carteira is
  'Visão consolidada de rentabilidade por usuário, utilizada no painel de investimentos.';
