-- Preserve legacy archives; add explicit identities for the six real driver models.
begin;
alter table public.amyfx_preview_scalper_setups drop constraint amyfx_preview_scalper_setups_model_check;
alter table public.amyfx_preview_scalper_setups add constraint amyfx_preview_scalper_setups_model_check check (model in (
  'IFVG_SCALPER','FVG_BUY_HIGH_QUALITY','FVG','CRT','ORDER_BLOCK','BREAKER_BLOCK','RETEST_BOS','TRENDLINE_BREAK_RETEST','EMA_PULLBACK','FALSE_BREAKOUT','RANGE_EXPANSION','AMD','EXPANSION_RANGE_REENTRY','SMR_FIRST_RETEST','DISCIPLINE_SCALPER',
  'HIGH_WINRATE_SNIPER_70','AI_ADAPTIVE_SMART_DRIVER','SWING_CHOCH_OTE','MULTI_DRIVER_ENSEMBLE','CONSERVATIVE_SHIELD','HUMAN_MTF_RAPID_SCALPER'
));
commit;
