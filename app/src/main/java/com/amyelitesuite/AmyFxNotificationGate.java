package com.amyelitesuite;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import java.util.Locale;

public class AmyFxNotificationGate {
    private static final String PREF = "amyfx_notify_gate";
    private static final String KEY_COOLDOWNS = "cooldowns_v2";
    private static final long DEFAULT_COOLDOWN_MS = 30L * 60L * 1000L;

    private AmyFxNotificationGate() {}

    public static String routeFor(String title, String message) {
        if (title == null) title = "";
        if (message == null) message = "";
        String t = title.toLowerCase(Locale.ROOT);
        String m = message.toLowerCase(Locale.ROOT);
        if (t.contains("news") || t.contains("berita") || m.contains("breaking news")) return "News";
        if (t.contains("journal") || t.contains("jurnal")) return "Journal";
        if (t.contains("academy") || t.contains("akademi") || t.contains("belajar") || t.contains("materi") || t.contains("skill")) return "Academy";
        if (t.contains("target atas") || m.contains("bsl")) return "Analyze";
        if (t.contains("target bawah") || m.contains("ssl")) return "Analyze";
        if (t.contains("scanner") || m.contains("scanner")) return "Analyze";
        if (t.contains("kill zone") || t.contains("killzone") || t.contains("session")) return "Dashboard";
        return "Analyze";
    }

    public static String routeUrl(String route) {
        if ("News".equals(route)) return "https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news";
        if ("Journal".equals(route)) return "https://appassets.androidplatform.net/assets/apps/journal/index.html";
        if ("Academy".equals(route)) return "https://appassets.androidplatform.net/assets/apps/academy/index.html";
        return "https://appassets.androidplatform.net/assets/apps/mapping/index.html#" + Uri.encode(route);
    }

    public static boolean isGoldMarketOpen(long nowMs) {
        try {
            java.time.ZonedDateTime zdt = java.time.ZonedDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(nowMs),
                java.time.ZoneId.of("America/New_York")
            );
            java.time.DayOfWeek day = zdt.getDayOfWeek();
            double hour = zdt.getHour() + zdt.getMinute() / 60.0;
            if (day == java.time.DayOfWeek.SATURDAY) return false;
            if (day == java.time.DayOfWeek.SUNDAY) return hour >= 17.0;
            if (day == java.time.DayOfWeek.FRIDAY) return hour < 17.0;
            if (hour >= 17.0 && hour < 18.0) return false;
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    public static boolean isTradingAlert(String key) {
        if (key == null || key.trim().isEmpty()) return false;
        String k = key.toLowerCase(Locale.ROOT);
        // Educational, News, Journal, and System update alerts are permitted outside market hours
        if (k.contains("news") || k.contains("berita") || k.contains("breaking news")) return false;
        if (k.contains("journal") || k.contains("jurnal")) return false;
        if (k.contains("academy") || k.contains("akademi") || k.contains("belajar") || k.contains("materi") || k.contains("reminder") || k.contains("pelajaran")) return false;
        if (k.contains("update amy fx") || k.contains("pembaruan sistem")) return false;
        // All other notifications (market context, scalper, driver setup, live assistant, entry watch, POI/DOL) are trading signals
        return true;
    }

    public static synchronized boolean shouldNotify(Context context, String gateKey, long nowMs) {
        if (isTradingAlert(gateKey) && !isGoldMarketOpen(nowMs)) {
            return false;
        }
        String canonicalKey = canonicalKey(gateKey);
        if (canonicalKey.isEmpty()) return true;
        SharedPreferences sp = context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        String prefKey = KEY_COOLDOWNS + ":" + safeKey(canonicalKey);
        long last = sp.getLong(prefKey, 0L);
        boolean allowed = last == 0L || nowMs - last >= DEFAULT_COOLDOWN_MS;
        if (allowed) {
            sp.edit().putLong(prefKey, nowMs).commit();
        }
        return allowed;
    }

    public static int stableId(String gateKey, int requestCode) {
        String key = canonicalKey(gateKey);
        if (key.isEmpty()) return Math.abs(requestCode % 100000);
        int h = key.hashCode();
        return Math.abs((requestCode + h) % 100000);
    }

    public static void markNotified(Context context, String gateKey, long nowMs) {
        String canonicalKey = canonicalKey(gateKey);
        if (canonicalKey.isEmpty()) return;
        SharedPreferences sp = context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        sp.edit().putLong(KEY_COOLDOWNS + ":" + safeKey(canonicalKey), nowMs).apply();
    }

    public static String newsContentKey(String message) {
        String normalized = message == null
            ? ""
            : message.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
        return "news_content|" + Integer.toHexString(normalized.hashCode());
    }

    public static PendingIntent clickIntent(Context context, String title, String message) {
        String route = routeFor(title, message);
        String url = routeUrl(route);
        Intent intent = new Intent("amyfx.intent.action.OPEN_ROUTE");
        intent.setPackage(context.getPackageName());
        intent.putExtra("amyfx_route", route);
        intent.putExtra("target_url", url);
        intent.setData(Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            stableId(title + "|" + message, (int) System.currentTimeMillis()),
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private static String canonicalKey(String key) {
        if (key == null || key.trim().isEmpty()) return "";
        if (key.startsWith("global|")) {
            int titleEnd = key.indexOf('|', 7);
            if (titleEnd > 7 && titleEnd + 1 < key.length()) {
                String title = key.substring(7, titleEnd).toLowerCase(Locale.ROOT);
                String message = key.substring(titleEnd + 1);
                if (title.contains("news") || title.contains("berita")) {
                    return newsContentKey(message);
                }
            }
        }
        return key;
    }

    private static String safeKey(String key) {
        String k = key.replace("/", "").replace(":", "");
        return k.length() > 120 ? k.substring(0, 120) : k;
    }
}
