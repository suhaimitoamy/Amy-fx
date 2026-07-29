alter table public.amyfx_preview_scalper_setups
  add column if not exists notification_enabled boolean not null default false;

update public.amyfx_preview_scalper_setups
set notification_enabled = false
where notification_enabled is distinct from false;
