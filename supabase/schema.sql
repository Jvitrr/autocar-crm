-- ============================================================================
-- AUTOCAR PROTEÇÃO VEICULAR - CRM DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. Perfis de Usuários (Vendedores e Gestor Admin)
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique,
  name text not null unique,
  email text not null unique,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  monthly_goal integer not null default 15,
  created_at timestamptz not null default now()
);

-- 2. Tabela Principal de Leads + Cadência D+1 a D+10
create table if not exists public.leads (
  id text primary key,
  number serial,
  entry_date date not null default current_date,
  name text not null,
  phone text not null,
  origin text not null default 'Tráfego pago',
  vehicle text default '',
  qualified text not null default 'A verificar' check (qualified in ('Sim', 'Não', 'A verificar')),
  stage text not null default '1º Contato' check (stage in ('1º Contato', 'Diagnóstico', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido')),
  status text not null default 'Aguardando',
  contact_under_5min text not null default 'Sim' check (contact_under_5min in ('Sim', 'Não')),
  first_contact_date date,
  contacts_count integer not null default 1,
  main_objection text default '',
  proposal_value numeric(10,2),
  closing_date date,
  result text not null default 'Em aberto' check (result in ('Fechado', 'Perdido', 'Em aberto')),
  notes text default '',
  seller text not null,
  channel text not null default 'WhatsApp',
  responded text not null default 'Pendente',
  no_response_reason text default '',
  followup_status text not null default 'Em andamento',
  next_contact_date date,
  cadence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Tabela de Feedbacks Automatizados (Gestor + Claude MCP)
create table if not exists public.seller_feedbacks (
  id text primary key,
  created_at timestamptz not null default now(),
  target_seller text not null,
  author text not null default 'Claude MCP',
  severity text not null default 'atencao' check (severity in ('positivo', 'atencao', 'critico')),
  title text not null,
  message text not null,
  read boolean not null default false
);

-- Inserir equipe comercial padrão da Autocar
insert into public.profiles (name, email, role, monthly_goal) values
  ('Gestor Comercial (Admin)', 'gestao@autocar.com.br', 'admin', 60),
  ('Anne', 'anne@autocar.com.br', 'seller', 15),
  ('João', 'joao@autocar.com.br', 'seller', 15),
  ('Tainá', 'taina@autocar.com.br', 'seller', 15),
  ('Mariah', 'mariah@autocar.com.br', 'seller', 15),
  ('Amanda', 'amanda@autocar.com.br', 'seller', 15),
  ('Sthepani', 'sthepani@autocar.com.br', 'seller', 15)
on conflict (name) do nothing;
