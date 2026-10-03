package com.ayushkjha.daily;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.time.ZonedDateTime;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent) {
        if(!ReminderManager.enabled(c))return;
        if("DAILY_SNOOZE".equals(intent.getAction())) { ReminderManager.snooze(c);((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(101);return; }
        if(!"DAILY_REMINDER".equals(intent.getAction())) { ReminderManager.schedule(c);return; }
        ZonedDateTime now=ZonedDateTime.now();
        if(!ReminderManager.quiet(now.getHour()*60+now.getMinute(),ReminderManager.prefs(c).getInt("quietStart",1320),ReminderManager.prefs(c).getInt("quietEnd",480))) {
            ReminderManager.channel(c);
            PendingIntent open=PendingIntent.getActivity(c,102,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            PendingIntent snooze=PendingIntent.getBroadcast(c,103,new Intent(c,ReminderReceiver.class).setAction("DAILY_SNOOZE"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            if(android.os.Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){ReminderManager.schedule(c);return;}
            try { ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(101,new Notification.Builder(c,"daily-check-in")
                .setSmallIcon(R.drawable.daily_notification).setContentTitle("A little intention, today")
                .setContentText("A small check-in is waiting in Daily.").setContentIntent(open).setAutoCancel(true)
                .addAction(new Notification.Action.Builder(null,"Snooze 30 min",snooze).build()).build()); } catch(SecurityException ignored) { }
        }
        ReminderManager.schedule(c);
    }
}
