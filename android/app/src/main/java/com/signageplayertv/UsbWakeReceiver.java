package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.util.Log;

public class UsbWakeReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final String KEY_AUTO_REOPEN_MANUAL_OFF = "auto_reopen_manual_off";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? String.valueOf(intent.getAction()) : "";
        Log.d("UsbWakeReceiver", "USB storage event: " + action);
        try {
            Intent serviceIntent = new Intent(context, KioskKeepAliveService.class);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception error) {
            Log.w("UsbWakeReceiver", "Failed to start keepalive service", error);
        }

        if (Intent.ACTION_MEDIA_MOUNTED.equals(action)
                || Intent.ACTION_MEDIA_CHECKING.equals(action)
                || Intent.ACTION_MEDIA_REMOVED.equals(action)
                || Intent.ACTION_MEDIA_UNMOUNTED.equals(action)
                || Intent.ACTION_MEDIA_EJECT.equals(action)
                || Intent.ACTION_MEDIA_BAD_REMOVAL.equals(action)) {
            launchApp(context);
        }
    }

    private void launchApp(Context context) {
        try {
            Intent launchIntent = null;
            try {
                PackageManager pm = context.getPackageManager();
                launchIntent = pm.getLaunchIntentForPackage(context.getPackageName());
            } catch (Exception ignored) {
            }
            if (launchIntent == null) {
                launchIntent = new Intent(context, MainActivity.class);
                launchIntent.setAction(Intent.ACTION_MAIN);
                launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                launchIntent.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            }
            launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            context.startActivity(launchIntent);
        } catch (Exception error) {
            Log.e("UsbWakeReceiver", "Failed to launch app from USB event", error);
        }
    }
}
