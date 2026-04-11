package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class ReopenReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(KEY_AUTO_REOPEN_ENABLED, true);
            if (!enabled) {
                Log.d("ReopenReceiver", "Auto reopen disabled. Skipping relaunch.");
                return;
            }

            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_MAIN);
            launchIntent.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

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

            Intent serviceIntent = new Intent(context, KioskKeepAliveService.class);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e("ReopenReceiver", "Failed to relaunch app", e);
        }
    }
}
