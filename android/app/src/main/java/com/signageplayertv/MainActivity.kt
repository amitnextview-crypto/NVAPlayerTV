package com.signageplayertv

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import androidx.core.content.ContextCompat
import android.os.Bundle
import android.view.View
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.widget.Toast
import java.io.File

class MainActivity : ReactActivity() {

  companion object {
    private const val REOPEN_DELAY_MS = 10000L
    private const val REOPEN_REQ_CODE = 7201
    private const val PREFS_NAME = "kiosk_prefs"
    private const val KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled"
    private const val EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE = "skip_auto_reopen_restore_once"
  }

  private val reopenHandler = Handler(Looper.getMainLooper())
  private var skipAutoReopenRestoreThisLaunch = false
  private val reopenRunnable = Runnable {
    if (!isAutoReopenEnabled()) return@Runnable
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (launchIntent != null) {
        startActivity(launchIntent)
      }
    } catch (_: Exception) {
      // Alarm receiver fallback is also scheduled.
    }
  }

  override fun getMainComponentName(): String = "SignagePlayerTV"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    skipAutoReopenRestoreThisLaunch =
      intent?.getBooleanExtra(EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE, false) == true
    restoreAutoReopenOnLaunchIfNeeded()
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    val keepAliveIntent = Intent(this, KioskKeepAliveService::class.java)
    ContextCompat.startForegroundService(this, keepAliveIntent)
    hideSystemUI()
  }

  override fun onResume() {
    super.onResume()
    restoreAutoReopenOnLaunchIfNeeded()
    cancelScheduledReopen()
    hideSystemUI()
  }

  override fun onPause() {
    super.onPause()
    scheduleReopen()
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    scheduleReopen()
  }

  override fun onDestroy() {
    reopenHandler.removeCallbacks(reopenRunnable)
    cancelScheduledReopen()
    super.onDestroy()
  }


override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
        window.decorView.systemUiVisibility =
            (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }
}

  private fun hideSystemUI() {
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }

  private fun scheduleReopen() {
    if (!isAutoReopenEnabled()) return

    // 1) In-process fast reopen (worked well on many Smart TVs).
    reopenHandler.removeCallbacks(reopenRunnable)
    reopenHandler.postDelayed(reopenRunnable, REOPEN_DELAY_MS)

    // 2) OS alarm fallback for stricter TV builds through ReopenReceiver.
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildReopenPendingIntent()
    val triggerAt = android.os.SystemClock.elapsedRealtime() + REOPEN_DELAY_MS

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
      }
    } catch (_: Exception) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setAndAllowWhileIdle(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
      }
    }
  }

  private fun cancelScheduledReopen() {
    reopenHandler.removeCallbacks(reopenRunnable)
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildReopenPendingIntent()
    alarmManager.cancel(pendingIntent)
  }

  fun cancelScheduledReopenFromJs() {
    cancelScheduledReopen()
  }

  private fun buildReopenPendingIntent(): PendingIntent {
    val intent = Intent(this, ReopenReceiver::class.java).apply {
      action = KioskKeepAliveService.ACTION_REOPEN_ALARM
      `package` = packageName
    }
    return PendingIntent.getBroadcast(
      this,
      REOPEN_REQ_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  override fun onBackPressed() {
    // Disable back
  }

  override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean {
    // Long-press OK/Center: toggle auto reopen ON/OFF.
    if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
      val enabled = !isAutoReopenEnabled()
      setAutoReopenEnabled(enabled)
      if (!enabled) {
        cancelScheduledReopen()
      }
      Toast.makeText(
        this,
        if (enabled) "Auto reopen enabled" else "Auto reopen disabled",
        Toast.LENGTH_SHORT
      ).show()
      return true
    }

    // Long-press BACK: clear signage data and restart app.
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      clearSignageDataAndRestart()
      return true
    }

    return super.onKeyLongPress(keyCode, event)
  }

  private fun getPrefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun restoreAutoReopenOnLaunchIfNeeded() {
    try {
      if (skipAutoReopenRestoreThisLaunch) {
        return
      }
      setAutoReopenEnabled(true)
    } catch (_: Exception) {
    }
  }

  private fun isAutoReopenEnabled(): Boolean {
    return getPrefs().getBoolean(KEY_AUTO_REOPEN_ENABLED, true)
  }

  private fun setAutoReopenEnabled(enabled: Boolean) {
    getPrefs().edit().putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled).apply()
  }

  private fun clearSignageDataAndRestart() {
    try {
      getPrefs().edit()
        .putBoolean(KEY_AUTO_REOPEN_ENABLED, false)
        .apply()
      cancelScheduledReopen()

      // Remove app-level signage files without full "clear data" settings flow.
      val filesRoot = filesDir
      File(filesRoot, "media").deleteRecursively()
      File(filesRoot, "config.json").delete()
      cacheDir.deleteRecursively()
    } catch (_: Exception) {
      // Continue to restart even if partial cleanup fails.
    }

    Toast.makeText(this, "Data cleared, restarting...", Toast.LENGTH_SHORT).show()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    launchIntent?.putExtra(EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE, true)
    if (launchIntent != null) {
      startActivity(launchIntent)
      finishAffinity()
    }
  }
}
