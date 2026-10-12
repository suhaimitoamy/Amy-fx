-- Additive per-device preferences. Capability hashes are not authentication tokens.
create table if not exists public.amyfx_scalper_device_preferences (
  device_scope text primary key check (device_scope ~ '^[a-f0-9]{64}$'),
  enabled_drivers jsonb not null default '{}'::jsonb check (jsonb_typeof(enabled_drivers)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.amyfx_scalper_device_preferences enable row level security;
revoke all on public.amyfx_scalper_device_preferences from anon, authenticated;
grant select,insert,update,delete on public.amyfx_scalper_device_preferences to service_role;
alter table public.amyfx_preview_scalper_setups add column if not exists device_scope text;
alter table public.device_tokens add column if not exists scalper_scope_id text;
create index if not exists amyfx_scalper_device_active_idx on public.amyfx_preview_scalper_setups(device_scope,status,signal_candle_close_time);
create index if not exists amyfx_scalper_device_token_idx on public.device_tokens(scalper_scope_id) where scalper_scope_id is not null;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_model_check;
alter table public.amyfx_preview_scalper_setups add constraint amyfx_preview_scalper_setups_model_check check (model in ('IFVG_SCALPER','FVG_BUY_HIGH_QUALITY','FVG','CRT','ORDER_BLOCK','BREAKER_BLOCK','RETEST_BOS','TRENDLINE_BREAK_RETEST','EMA_PULLBACK','FALSE_BREAKOUT','RANGE_EXPANSION','AMD','EXPANSION_RANGE_REENTRY','SMR_FIRST_RETEST','DISCIPLINE_SCALPER'));
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_timeframe_check;
alter table public.amyfx_preview_scalper_setups add constraint amyfx_preview_scalper_setups_timeframe_check check(timeframe is null or timeframe in ('M5','M15','M30','H1','H4'));
comment on column public.amyfx_preview_scalper_setups.device_scope is 'Null preserves legacy global scans; non-null scopes scans to one device capability hash.';
