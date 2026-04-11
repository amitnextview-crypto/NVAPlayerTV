// package com.signageplayertv;

// import android.content.BroadcastReceiver;
// import android.content.Context;
// import android.content.Intent;

// public class BootReceiver extends BroadcastReceiver {
//   @Override
//   public void onReceive(Context context, Intent intent) {
//     if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
//       Intent i = new Intent(context, MainActivity.class);
//       i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
//       context.startActivity(i);
//     }
//   }
// }


package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String ACTION_LOCKED_BOOT_COMPLETED = "android.intent.action.LOCKED_BOOT_COMPLETED";
    private static final String ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : "";

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || ACTION_LOCKED_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || ACTION_QUICKBOOT_POWERON.equals(action)) {

            Log.d("BOOT", "Boot/package restart trigger received");

            Intent serviceIntent = new Intent(context, KioskKeepAliveService.class);
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e("BOOT", "Failed to start keep alive service", e);
            }

            Intent i = new Intent(context, MainActivity.class);
            i.setAction(Intent.ACTION_MAIN);
            i.addCategory(Intent.CATEGORY_HOME);
            i.addCategory(Intent.CATEGORY_DEFAULT);
            i.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            i.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );

            if (i != null) {
                context.startActivity(i);
            }
        }
    }
}
