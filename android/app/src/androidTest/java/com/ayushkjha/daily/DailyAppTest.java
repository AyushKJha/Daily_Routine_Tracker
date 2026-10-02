package com.ayushkjha.daily;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class DailyAppTest {
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) {
            WebView found = findWeb(((ViewGroup) view).getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }
    private String js(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(a -> findWeb(a.getWindow().getDecorView()).evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView callback timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(js(scenario, "typeof DailyStorage!=='undefined'&&typeof DailyAndroid!=='undefined'"))) return;
            Thread.sleep(100);
        }
        fail("Offline app did not load");
    }
    private JSONObject async(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        js(scenario, "window.__qaResult=null;(async()=>{" + script + "})().then(value=>window.__qaResult=JSON.stringify({ok:true,value})).catch(e=>window.__qaResult=JSON.stringify({ok:false,error:e.message}));");
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            String value = js(scenario, "window.__qaResult");
            if (!"null".equals(value)) {
                JSONObject result = new JSONObject((String) new JSONTokener(value).nextValue());
                assertTrue(result.optString("error"), result.getBoolean("ok"));
                return result;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Async app operation timed out");
    }
    @Test public void offlineEncryptedJournalPersistsAndLocks() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            assertEquals("true", js(scenario, "!!crypto.subtle&&!!navigator.locks&&location.origin==='https://appassets.androidplatform.net'"));
            JSONObject result = async(scenario, "const s=await DailyStorage.request('/auth/create','POST',{username:'Android QA',password:'android-qa-password'});await DailyStorage.request('/auth/finish');let day=await DailyStorage.request('/habits/today');day.habits.exercise=true;day.details.exercise={note:'ANDROID_PRIVATE_NOTE'};await DailyStorage.request('/habits/today','POST',day);return s;");
            String id = result.getJSONObject("value").getString("id");
            js(scenario, "window.__beforeReload=true;location.reload();");
            long reloadDeadline = System.currentTimeMillis() + 30000;
            while (!"true".equals(js(scenario, "typeof window.__beforeReload==='undefined'&&document.readyState==='complete'"))) {
                assertTrue("App reload timed out", System.currentTimeMillis() < reloadDeadline);
                Thread.sleep(100);
            }
            ready(scenario);
            async(scenario, "let locked=false;try{await DailyStorage.request('/auth/me');}catch(e){locked=e.status===401;}if(!locked)throw Error('Workspace reopened without password');return true;");
            JSONObject saved = async(scenario, "await DailyStorage.request('/auth/login','POST',{id:"+JSONObject.quote(id)+",password:'android-qa-password'});const data=await DailyStorage.request('/export');return data.days[0];");
            assertEquals(20, saved.getJSONObject("value").getInt("score"));
            assertEquals("ANDROID_PRIVATE_NOTE", saved.getJSONObject("value").getJSONObject("details").getJSONObject("exercise").getString("note"));
        }
    }
    @Test public void nativeExportWritesChosenFileAndReportsSuccess() throws Exception {
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            File destination = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir(), "qa-native-export.txt");
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK, new Intent().setData(Uri.fromFile(destination))));
            js(scenario, "DailyAndroid.postMessage(JSON.stringify({action:'save',filename:'qa.txt',mime:'text/plain',data:btoa('native export verified')}));");
            long deadline = System.currentTimeMillis() + 15000;
            while ((!destination.exists() || destination.length()==0) && System.currentTimeMillis()<deadline) Thread.sleep(100);
            assertEquals("native export verified", new String(Files.readAllBytes(destination.toPath()), java.nio.charset.StandardCharsets.UTF_8));
        } finally { Intents.release(); }
    }
}
