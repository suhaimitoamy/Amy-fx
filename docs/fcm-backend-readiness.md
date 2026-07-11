# Amy FX FCM Backend Readiness

## Active architecture

- Supabase stores centralized news, device tokens, notification logs, and sync history.
- Supabase Cron invokes the scheduled news sync every two minutes.
- `news-sync` scrapes the fixed Telegram source, filters XAU/USD-relevant news, translates it, deduplicates it, and sends fresh items through FCM.
- Vercel `/api/news` reads the centralized Supabase feed and falls back to Telegram scraping if Supabase is temporarily unavailable.
- Android registers its FCM token on application startup and whenever Firebase rotates the token.
- FCM notifications use data messages so Amy FX can create a native notification that opens the exact Market Intel news item.

## Security rules

- Firebase service-account credentials are stored only in Supabase Edge Function secrets.
- No Firebase Admin private key is stored in this repository.
- Supabase tables use RLS; server-only writes use the service-role environment supplied by Supabase.
- Vercel API responses do not allow credentialed wildcard CORS.
- Initial news bootstrap does not notify users, preventing a flood of old notifications.

## Final device verification

The end-to-end device test requires installing an APK built after the Firebase integration. After first launch, the device token should appear in `device_tokens`. The next new qualifying news item should create a `notification_logs` record and a native notification on the device.
