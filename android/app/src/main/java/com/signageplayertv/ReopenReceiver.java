package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.util.Log;

public class ReopenReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final String KEY_AUTO_REOPEN_MANUAL_OFF = "auto_reopen_manual_off";
    private static final String KEY_LICENSE_ACTIVATED = "license_activated";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            handleReopenAlarm(context, intent);
        } catch (Exception e) {
            Log.e("ReopenReceiver", "Failed to handle broadcast", e);
        }
    }

    private void handleReopenAlarm(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean(KEY_LICENSE_ACTIVATED, false)
                && !prefs.getBoolean(KEY_AUTO_REOPEN_MANUAL_OFF, true)
                && prefs.getBoolean(KEY_AUTO_REOPEN_ENABLED, false);
        if (!enabled) {
            Log.d("ReopenReceiver", "Auto reopen disabled. Skipping relaunch.");
            return;
        }

        Intent serviceIntent = new Intent(context, KioskKeepAliveService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        Intent launchIntent = null;
        try {
            PackageManager pm = context.getPackageManager();
            launchIntent = pm.getLaunchIntentForPackage(context.getPackageName());
        } catch (Exception ignored) {
        }
        if (launchIntent == null) {
            launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_MAIN);
            launchIntent.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        }
        launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        try {
            android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                    context,
                    7203,
                    launchIntent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            pendingIntent.send();
            Log.d("ReopenReceiver", "App relaunch requested via PendingIntent");
        } catch (Exception pendingErr) {
            context.startActivity(launchIntent);
            Log.d("ReopenReceiver", "App relaunch requested");
        }
    }
}
