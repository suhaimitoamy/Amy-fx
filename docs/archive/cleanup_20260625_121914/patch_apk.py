import re

with open('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'r') as f:
    content = f.read()

# Add imports
imports = """import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Color
import android.media.RingtoneManager
import android.webkit.JavascriptInterface
"""
content = content.replace('import android.webkit.JavascriptInterface', imports)


# Create Notification Channel in onCreate
channel_code = """
        // Initialize Notification Channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "amy_alerts",
                "Trading Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority trading signals"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }

        // Check POST_NOTIFICATIONS permission for Android 13+
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), 2)
            }
        }
        
        // Initialize WebView
"""
content = content.replace('// Initialize WebView', channel_code)

# Add showNotification to WebAppInterface
notify_func = """
        @JavascriptInterface
        fun showNotification(title: String, message: String) {
            try {
                val intent = Intent(mContext, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    mContext, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Notification.Builder(mContext, "amy_alerts")
                } else {
                    @Suppress("DEPRECATION")
                    Notification.Builder(mContext)
                        .setPriority(Notification.PRIORITY_HIGH)
                }

                val notification = builder
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                    .setVibrate(longArrayOf(0, 500, 250, 500))
                    .build()

                val nm = mContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(System.currentTimeMillis().toInt(), notification)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
"""
content = content.replace('inner class WebAppInterface(private val mContext: Context) {', 'inner class WebAppInterface(private val mContext: Context) {' + notify_func)

with open('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'w') as f:
    f.write(content)
print("MainActivity patched successfully")
