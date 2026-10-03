package com.ayushkjha.daily;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;

final class ReminderManager {
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("reminders",Context.MODE_PRIVATE); }
    static boolean enabled(Context c) { return prefs(c).getBoolean("enabled",false); }
    static int minute(String value) {
        LocalTime time=LocalTime.parse(value); return time.getHour()*60+time.getMinute();
    }
    static boolean quiet(int m,int start,int end) { return start==end?false:start<end?m>=start&&m<end:m>=start||m<end; }
    static long next(ZonedDateTime now,int minute,int start,int end) {
        if(quiet(minute,start,end))minute=end;
        ZonedDateTime target=now.toLocalDate().atTime(minute/60,minute%60).atZone(now.getZone());
        if(!target.isAfter(now))target=now.toLocalDate().plusDays(1).atTime(minute/60,minute%60).atZone(now.getZone());
        return target.toInstant().toEpochMilli();
    }
    static PendingIntent alarm(Context c) {
        return PendingIntent.getBroadcast(c,101,new Intent(c,ReminderReceiver.class).setAction("DAILY_REMINDER"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void schedule(Context c) {
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        manager.cancel(alarm(c)); if(!enabled(c))return;
        SharedPreferences p=prefs(c);
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next(ZonedDateTime.now(),p.getInt("minute",1200),p.getInt("quietStart",1320),p.getInt("quietEnd",480)),alarm(c));
    }
    static void snooze(Context c) {
        if(!enabled(c))return;
        long at=System.currentTimeMillis()+30*60000;
        ZonedDateTime target=ZonedDateTime.now().plusMinutes(30);SharedPreferences p=prefs(c);
        if(quiet(target.getHour()*60+target.getMinute(),p.getInt("quietStart",1320),p.getInt("quietEnd",480)))at=next(ZonedDateTime.now(),p.getInt("quietEnd",480),p.getInt("quietStart",1320),p.getInt("quietEnd",480));
        ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm(c));
    }
    static void channel(Context c) {
        ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("daily-check-in","Daily check-in",NotificationManager.IMPORTANCE_DEFAULT));
    }
}
