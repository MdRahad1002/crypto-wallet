-- ============================================================
-- Crypto Wallet Platform � Supabase (PostgreSQL) Full Schema
-- Run this entire file in Supabase Dashboard ? SQL Editor
-- (safe to re-run; all statements use CREATE IF NOT EXISTS)
-- ============================================================

create extension if not exists "pgcrypto";

-- -------------- USERS --------------------------------------
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  password            text not null,
  name                text not null,
  role                text not null default 'user' check (role in ('user','admin')),
  is_admin            boolean not null default false,
  kyc_status          text not null default 'pending' check (kyc_status in ('pending','approved','rejected')),
  kyc_review_message  text not null default '',
  recovery_status     text not null default 'NO_KYC',
  kyc_data            jsonb not null default '{}',
  two_factor_enabled  boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists users_email_idx on users(email);
create index if not exists users_kyc_idx   on users(kyc_status);

-- -------------- USER WALLETS -------------------------------
create table if not exists user_wallets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  address               text not null,
  encrypted_private_key text,
  encrypted_data_key    text,
  key_id                text,
  network               text not null default 'ethereum',
  watch_only            boolean not null default false,
  label                 text not null default '',
  balance_override_btc  numeric,
  balance_override_usd  numeric,
  balance_updated_at    timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists user_wallets_user_idx    on user_wallets(user_id);
create index if not exists user_wallets_address_idx on user_wallets(address);

-- -------------- USER NOTIFICATIONS -------------------------
create table if not exists user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  message    text not null,
  type       text not null default 'info'   check (type in ('info','warning','error','success','banner')),
  priority   text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists user_notifications_user_idx on user_notifications(user_id);

-- -------------- USER REFRESH TOKENS ------------------------
create table if not exists user_refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists user_refresh_tokens_user_idx on user_refresh_tokens(user_id);
create index if not exists user_refresh_tokens_hash_idx on user_refresh_tokens(token_hash);

-- -------------- WALLETS (recovery) -------------------------
create table if not exists wallets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  network             text not null default 'bitcoin',
  address             text not null,
  encrypted_mnemonic  text,
  encrypted_seed      jsonb,
  created_by_admin_id uuid references users(id),
  created_at          timestamptz not null default now(),
  seed_shown_at       timestamptz,
  revoked             boolean not null default false
);
create index if not exists wallets_user_idx    on wallets(user_id, revoked);
create index if not exists wallets_address_idx on wallets(address);

-- -------------- TRANSACTIONS -------------------------------
create table if not exists transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  type            text not null check (type in ('deposit','withdraw','send','receive')),
  cryptocurrency  text not null,
  amount          numeric not null,
  from_address    text,
  to_address      text,
  tx_hash         text,
  network         text not null default 'ethereum',
  status          text not null default 'pending',
  confirmations   integer not null default 0,
  confirmed_at    timestamptz,
  last_checked_at timestamptz,
  reorged         boolean not null default false,
  gas_used        numeric,
  gas_fee         numeric,
  block_number    bigint,
  timestamp       timestamptz not null default now(),
  description     text not null default '',
  admin_note      text not null default '',
  admin_edited    boolean not null default false,
  admin_edited_at timestamptz
);
create index if not exists transactions_user_idx   on transactions(user_id, timestamp desc);
create index if not exists transactions_hash_idx   on transactions(tx_hash);
create index if not exists transactions_status_idx on transactions(status);

-- -------------- BALANCES -----------------------------------
create table if not exists balances (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  wallet_address text not null,
  cryptocurrency text not null,
  balance        numeric not null default 0,
  network        text not null default 'ethereum',
  last_updated   timestamptz not null default now(),
  unique(user_id, wallet_address, cryptocurrency)
);

-- -------------- TOKENS -------------------------------------
create table if not exists tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  wallet_address   text not null,
  contract_address text not null,
  symbol           text not null,
  name             text not null,
  decimals         integer not null default 18,
  balance          text not null default '0',
  network          text not null default 'ethereum',
  is_custom        boolean not null default false,
  logo_url         text,
  price_usd        numeric,
  last_updated     timestamptz not null default now(),
  unique(user_id, wallet_address, contract_address)
);
create index if not exists tokens_user_idx   on tokens(user_id);

-- -------------- WEBHOOKS -----------------------------------
create table if not exists webhooks (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  secret     text not null,
  events     text[] not null default '{}',
  is_active  boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists webhooks_active_idx on webhooks(is_active);

-- -------------- WEBHOOK EVENTS -----------------------------
create table if not exists webhook_events (
  id              uuid primary key default gen_random_uuid(),
  webhook_id      uuid not null references webhooks(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null default '{}',
  status          text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now()
);
create index if not exists webhook_events_status_idx  on webhook_events(status, next_attempt_at);
create index if not exists webhook_events_webhook_idx on webhook_events(webhook_id, created_at desc);

-- -------------- AUDIT LOGS ---------------------------------
create table if not exists audit_logs (
  id               uuid primary key default gen_random_uuid(),
  actor_type       text not null check (actor_type in ('admin','user','system')),
  actor_id         uuid,
  action           text not null,
  target_user_id   uuid,
  target_wallet_id uuid,
  network          text,
  ip               text,
  user_agent       text,
  success          boolean not null default true,
  details          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists audit_logs_created_idx     on audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx       on audit_logs(actor_id, created_at desc);
create index if not exists audit_logs_target_user_idx on audit_logs(target_user_id, created_at desc);
create index if not exists audit_logs_action_idx      on audit_logs(action, created_at desc);

-- -------------- KYC SUBMISSIONS (legacy Supabase-only table) -
create table if not exists kyc_submissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  full_name       text not null,
  document_type   text not null,
  document_number text,
  document_hash   text,
  storage_path    text,
  public_url      text,
  status          text not null default 'pending',
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewer_note   text
);

-- -------------- DEPOSIT ADDRESSES (legacy global — kept for backwards compat) -
create table if not exists deposit_addresses (
  id             uuid primary key default gen_random_uuid(),
  network        text not null,
  cryptocurrency text not null,
  address        text not null,
  label          text not null default '',
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists deposit_addresses_active_idx on deposit_addresses(is_active);

-- -------------- PER-USER DEPOSIT ADDRESSES --------------------------------
create table if not exists user_deposit_addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  network        text not null,
  cryptocurrency text not null,
  address        text not null,
  label          text not null default '',
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists user_deposit_addresses_user_idx on user_deposit_addresses(user_id);
create index if not exists user_deposit_addresses_active_idx on user_deposit_addresses(user_id, is_active);

-- -------------- SUPPORT TICKETS --------------------------
create table if not exists support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      text,
  name         text not null default '',
  email        text not null default '',
  subject      text not null,
  message      text not null,
  status       text not null default 'open',  -- open | in_progress | resolved
  admin_note   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists support_tickets_status_idx on support_tickets(status, created_at desc);
create index if not exists support_tickets_user_idx   on support_tickets(user_id, created_at desc);

-- Disable RLS — backend always uses service role key (bypasses RLS anyway)
alter table users               disable row level security;
alter table user_wallets        disable row level security;
alter table user_notifications  disable row level security;
alter table user_refresh_tokens disable row level security;
alter table wallets             disable row level security;
alter table transactions        disable row level security;
alter table balances            disable row level security;
alter table tokens              disable row level security;
alter table webhooks            disable row level security;
alter table webhook_events      disable row level security;
alter table audit_logs          disable row level security;
alter table kyc_submissions     disable row level security;
alter table deposit_addresses   disable row level security;
alter table user_deposit_addresses disable row level security;
alter table support_tickets     disable row level security;

-- -------------- SYSTEM CONFIG (server-managed secrets) ----------
create table if not exists system_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table system_config disable row level security;
