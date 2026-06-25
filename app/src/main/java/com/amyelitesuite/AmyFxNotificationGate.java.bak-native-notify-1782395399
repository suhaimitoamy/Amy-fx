package com.amyelitesuite;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import java.util.HashMap;
import java.util.Map;

public final class AmyFxNotificationGate {
    private static final String PREF = "amyfx_notify_gate";
    private static final long COOLDOWN_MS = 5L * 60L * 1000L;
    private static final long STALE_MS = 2L * 60L * 1000L;

    private AmyFxNotificationGate() {}

    public static boolean shouldNotify(Context context, String rawKey, long createdAt) {
        if (context == null) return true;
        long now = System.currentTimeMillis();
        if (createdAt > 0 && now - createdAt > STALE_MS) return false;

        String key = normalize(rawKey);
        long last = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getLong(key, 0L);
        if (now - last < COOLDOWN_MS) return false;

        context.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putLong(key, now).apply();
        return true;
    }

    public static int stableId(String rawKey, int fallback) {
        String k = normalize(rawKey).toLowerCase();
        if (k.contains("scanner_connected")) return 7101;
        if (k.contains("scanner_alive")) return 7102;
        if (k.contains("liquidity")) return 7103;
        if (k.contains("ssl") || k.contains("bsl")) return 7104;
        int h = Math.abs(k.hashCode());
        return 7200 + (h % 500);
    }

    public static PendingIntent contentIntent(Context context, String route) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent();
        intent.setPackage(context.getPackageName());
        intent.putExtra("amyfx_route", route == null ? "Analyze" : route);
        intent.putExtra("amyfx_from_notification", true);
        intent.setAction("AMYFX_OPEN_" + (route == null ? "Analyze" : route));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, stableId(route == null ? "Analyze" : route, 7300), intent, flags);
    }

    public static String routeFor(String title, String body) {
        String x = ((title == null ? "" : title) + " " + (body == null ? "" : body)).toLowerCase();
        if (x.contains("liquidity") || x.contains("ssl") || x.contains("bsl")) return "Analyze";
        if (x.contains("scanner")) return "Dashboard";
        return "Analyze";
    }

    private static String normalize(String x) {
        if (x == null) return "amyfx_alert";
        return x.replaceAll("[0-9]+([.,][0-9]+)?", "#").replaceAll("\\s+", " ").trim();
    }
}
