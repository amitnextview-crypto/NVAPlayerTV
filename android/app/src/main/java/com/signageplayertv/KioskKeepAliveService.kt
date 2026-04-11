package com.signageplayertv

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Handler
import android.os.Looper

class KioskKeepAliveService : Service() {

  companion object {
    private const val CHANNEL_ID = "signage_keepalive_channel"
    private const val CHANNEL_NAME = "Signage Keep Alive"
    private const val NOTIF_ID = 4401
    private const val WATCHDOG_INTERVAL_MS = 10000L
    private const val REOPEN_REQ_CODE = 7202
    private const val PREFS_NAME = "kiosk_prefs"
    private const val KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled"
  }

  private val handler = Handler(Looper.getMainLooper())
  private val watchdog = object : Runnable {
    override fun run() {
      try {
        if (isAutoReopenEnabled()) {
          if (!isAppInForeground()) {
            tryLaunchApp()
          }
          // Always schedule a backup reopen alarm to recover from task kills.
          scheduleReopen()
        }
      } catch (_: Exception) {
      } finally {
        handler.postDelayed(this, WATCHDOG_INTERVAL_MS)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    startInForeground()
    startWatchdog()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    startWatchdog()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    scheduleReopen()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    handler.removeCallbacks(watchdog)
    scheduleReopen()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startInForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_MIN
      ).apply {
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_SECRET
      }
      nm.createNotificationChannel(channel)
    }

    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("Signage Player Running")
        .setContentText("Auto-reopen is active")
        .setOngoing(true)
        .setCategory(Notification.CATEGORY_SERVICE)
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("Signage Player Running")
        .setContentText("Auto-reopen is active")
        .setOngoing(true)
        .build()
    }

    startForeground(NOTIF_ID, notification)
  }

  private fun startWatchdog() {
    handler.removeCallbacks(watchdog)
    handler.postDelayed(watchdog, WATCHDOG_INTERVAL_MS)
  }

  private fun scheduleReopen() {
    if (!isAutoReopenEnabled()) return

    val pendingIntent = buildReopenPendingIntent()

    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = System.currentTimeMillis() + WATCHDOG_INTERVAL_MS

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAt,
        pendingIntent
      )
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }
  }

  private fun tryLaunchApp() {
    try {
      val pendingIntent = buildReopenPendingIntent()
      pendingIntent.send()
    } catch (_: Exception) {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (launchIntent != null) startActivity(launchIntent)
    }
  }

  private fun buildReopenPendingIntent(): PendingIntent {
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_MAIN
      addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
      addCategory(Intent.CATEGORY_LAUNCHER)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      this,
      REOPEN_REQ_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun isAppInForeground(): Boolean {
    return try {
      val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val processes = am.runningAppProcesses ?: return false
      val pkg = packageName
      processes.any { it.processName == pkg && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND }
    } catch (_: Exception) {
      false
    }
  }

  private fun isAutoReopenEnabled(): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getBoolean(KEY_AUTO_REOPEN_ENABLED, true)
  }
}
