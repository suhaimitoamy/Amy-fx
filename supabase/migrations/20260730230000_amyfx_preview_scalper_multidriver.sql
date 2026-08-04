-- Amy FX Preview only: evolve the existing Shadow Mode store to multi-driver schema.
-- Legacy IFVG/FVG rows remain readable; new IFVG generation is disabled in engine v2.

alter table public.amyfx_preview_scalper_setups
  add column if not exists schema_version integer not null default 1,
  add column if not exists driver_id text,
  add column if not exists driver_name text,
  add column if not exists driver_rule_version text,
  add column if not exists timeframe text,
  add column if not exists priority_display integer,
  add column if not exists revision bigint not null default 0;

update public.amyfx_preview_scalper_setups
set
  driver_id = coalesce(driver_id, case when model = 'IFVG_SCALPER' then 'IFVG_LEGACY' else model end),
  driver_name = coalesce(driver_name, case when model = 'IFVG_SCALPER' then 'IFVG Legacy' when model = 'FVG_BUY_HIGH_QUALITY' then 'FVG Buy High Quality Legacy' else model end),
  driver_rule_version = coalesce(driver_rule_version, 'legacy'),
  timeframe = coalesce(timeframe, 'M15'),
  priority_display = coalesce(priority_display, priority),
  schema_version = coalesce(schema_version, 1)
where driver_id is null or driver_name is null or driver_rule_version is null or timeframe is null or priority_display is null;

alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_model_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_status_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_recommendation_status_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_max_bars_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_timeframe_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_schema_version_check;
alter table public.amyfx_preview_scalper_setups drop constraint if exists amyfx_preview_scalper_setups_htf_bias_check;

alter table public.amyfx_preview_scalper_setups
  add constraint amyfx_preview_scalper_setups_model_check check (model in (
    'IFVG_SCALPER','FVG_BUY_HIGH_QUALITY',
    'FVG','CRT','ORDER_BLOCK','BREAKER_BLOCK','RETEST_BOS',
    'TRENDLINE_BREAK_RETEST','EMA_PULLBACK','FALSE_BREAKOUT','RANGE_EXPANSION'
  )),
  add constraint amyfx_preview_scalper_setups_status_check check (status in (
    'WAITING_TRIGGER','WAITING_NEXT_OPEN','ENTRY_READY','ACTIVE','BE_ACTIVE',
    'TP_HIT','SL_HIT','BE_HIT','TIME_EXIT','INVALIDATED','CANCELLED'
  )),
  add constraint amyfx_preview_scalper_setups_recommendation_status_check check (recommendation_status in (
    'PENDING','VALID','RISK_LIMIT','DUPLICATE_CLUSTER','INVALID','CLOSED'
  )),
  add constraint amyfx_preview_scalper_setups_max_bars_check check (max_bars between 1 and 192),
  add constraint amyfx_preview_scalper_setups_timeframe_check check (timeframe is null or timeframe in ('M15','M30','H1','H4')),
  add constraint amyfx_preview_scalper_setups_schema_version_check check (schema_version between 1 and 99),
  add constraint amyfx_preview_scalper_setups_htf_bias_check check (htf_bias in ('BULLISH','BEARISH','NEUTRAL'));

create index if not exists amyfx_preview_scalper_setups_driver_active_idx
  on public.amyfx_preview_scalper_setups (driver_id, timeframe, status, signal_candle_close_time desc);
create index if not exists amyfx_preview_scalper_setups_primary_display_idx
  on public.amyfx_preview_scalper_setups (status, priority_display, signal_candle_close_time desc);

comment on column public.amyfx_preview_scalper_setups.driver_id is 'Stable multi-driver identifier. IFVG_LEGACY is read-only history.';
comment on column public.amyfx_preview_scalper_setups.revision is 'Monotonic optimistic-lock revision; stale writes must not overwrite newer lifecycle state.';
comment on column public.amyfx_preview_scalper_setups.priority_display is 'Display ordering only; never closes or removes another active setup.';
