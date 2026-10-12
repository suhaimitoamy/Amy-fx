-- Retain the old Scalper archive while new runs publish context snapshots only.
-- Both ledgers are server-owned; clients access snapshots through the Edge Function.
create table if not exists public.amyfx_market_context_events (
  event_key text primary key,
  candle_close_time bigint not null,
  title text not null,
  body text not null,
  context jsonb not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists amyfx_market_context_events_pending_idx
  on public.amyfx_market_context_events (created_at)
  where notified_at is null;

create table if not exists public.amyfx_market_context_notification_logs (
  event_key text not null references public.amyfx_market_context_events(event_key) on delete cascade,
  device_token_id uuid not null references public.device_tokens(id) on delete cascade,
  status text not null check (status in ('CLAIMED','SENT','FAILED')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_key,device_token_id)
);

alter table public.amyfx_market_context_events enable row level security;
alter table public.amyfx_market_context_notification_logs enable row level security;
revoke all on public.amyfx_market_context_events from public,anon,authenticated;
revoke all on public.amyfx_market_context_notification_logs from public,anon,authenticated;
grant select,insert,update on public.amyfx_market_context_events to service_role;
grant select,insert,update on public.amyfx_market_context_notification_logs to service_role;
