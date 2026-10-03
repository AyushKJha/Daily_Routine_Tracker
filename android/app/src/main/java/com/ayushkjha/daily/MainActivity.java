package com.ayushkjha.daily;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int IMPORT_FILE = 1, EXPORT_FILE = 2;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView web;
    private String cloudOrigin="";
    private JSONObject reminderRequest;
    private JavaScriptReplyProxy reminderReply;
    private byte[] pendingExport;
    private JavaScriptReplyProxy exportReply;
    private ValueCallback<Uri[]> importReply;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { String config=new String(readStream(getAssets().open("cloud-config.js")),StandardCharsets.UTF_8);java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("url\\s*:\\s*['\"](https://[a-z0-9-]+\\.supabase\\.co)['\"]").matcher(config);if(matcher.find())cloudOrigin=matcher.group(1); } catch(Exception ignored) {}
        ReminderManager.channel(this);ReminderManager.schedule(this);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff354332);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        web.setSaveEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // User-selected backup documents only.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = assets.shouldInterceptRequest(request.getUrl());
                if (local != null) return local;
                Uri uri=request.getUrl();
                if(!request.isForMainFrame()&&!cloudOrigin.isEmpty()&&cloudOrigin.equals(uri.getScheme()+"://"+uri.getHost())&&(uri.getPath().startsWith("/auth/v1/")||uri.getPath().startsWith("/rest/v1/")))return null;
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
                        new ByteArrayInputStream("Not available in the offline app".getBytes(StandardCharsets.UTF_8)));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocal(uri)) return false;
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception e) { Toast.makeText(MainActivity.this, "No browser is available.", Toast.LENGTH_LONG).show(); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> reply, FileChooserParams params) {
                if (importReply != null) importReply.onReceiveValue(null);
                importReply = reply;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(picker, IMPORT_FILE); }
                catch (Exception e) { importReply.onReceiveValue(null); importReply = null; }
                return true;
            }
        });
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            new AlertDialog.Builder(this).setTitle("Update Android System WebView")
                    .setMessage("Daily needs a current Android System WebView. Update it from Google Play, then reopen Daily.")
                    .setPositiveButton("Close", (d, which) -> finish()).setCancelable(false).show();
            return;
        }
        WebViewCompat.addWebMessageListener(web, "DailyAndroid", Collections.singleton(ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !"https".equals(origin.getScheme()) || !"appassets.androidplatform.net".equals(origin.getHost())) return;
                    try {
                        JSONObject request = new JSONObject(message.getData());
                        if ("reminder".equals(request.optString("action"))) configureReminder(request,reply);
                        else if ("reminderStatus".equals(request.optString("action"))) reminderResult(reply,ReminderManager.enabled(this)?"Android reminder is enabled. Delivery may be delayed by battery saving.":"Android reminders are off.");
                        else if ("snooze".equals(request.optString("action"))) { ReminderManager.snooze(this);reminderResult(reply,ReminderManager.enabled(this)?"Snoozed for 30 minutes, respecting quiet hours.":"Enable reminders first."); }
                        else if ("checkUpdate".equals(request.optString("action"))) checkUpdate(reply);
                        else if ("save".equals(request.optString("action"))) save(request, reply);
                        else if ("print".equals(request.optString("action"))) {
                            PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                            manager.print("Daily weekly report", web.createPrintDocumentAdapter("Daily weekly report"),
                                    new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) { reply.postMessage("Could not prepare the export. Please try again."); }
                });
        web.loadUrl(ORIGIN + "/assets/index.html");
    }

    private static byte[] readStream(java.io.InputStream input) throws java.io.IOException {
        try(java.io.InputStream source=input;java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()) { byte[] buffer=new byte[4096];int count;while((count=source.read(buffer))!=-1){out.write(buffer,0,count);if(out.size()>100000)throw new java.io.IOException("Response too large");}return out.toByteArray(); }
    }
    private void reminderResult(JavaScriptReplyProxy reply,String text) {
        try { JSONObject result=new JSONObject();result.put("kind","reminder");result.put("enabled",ReminderManager.enabled(this));result.put("message",text);reply.postMessage(result.toString()); } catch(Exception ignored) { }
    }
    private void configureReminder(JSONObject request,JavaScriptReplyProxy reply) throws Exception {
        ReminderManager.minute(request.getString("time"));ReminderManager.minute(request.getString("quietStart"));ReminderManager.minute(request.getString("quietEnd"));
        if(request.optBoolean("enabled")&&android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){reminderRequest=request;reminderReply=reply;requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},10);return;}
        ReminderManager.prefs(this).edit().putBoolean("enabled",request.optBoolean("enabled")).putInt("minute",ReminderManager.minute(request.getString("time"))).putInt("quietStart",ReminderManager.minute(request.getString("quietStart"))).putInt("quietEnd",ReminderManager.minute(request.getString("quietEnd"))).apply();ReminderManager.schedule(this);
        reminderResult(reply,request.optBoolean("enabled")?"Reminder saved. Android may delay it during battery saving. Quiet hours are respected.":"Reminders turned off.");
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==10&&reminderReply!=null){try{if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)configureReminder(reminderRequest,reminderReply);else{ReminderManager.prefs(this).edit().putBoolean("enabled",false).apply();ReminderManager.schedule(this);reminderResult(reminderReply,"Notifications were not allowed. Reminders remain off.");}}catch(Exception ignored){}reminderReply=null;reminderRequest=null;}
    }
    private void checkUpdate(JavaScriptReplyProxy reply) {
        io.execute(()->{try{java.net.HttpURLConnection connection=(java.net.HttpURLConnection)new java.net.URL("https://daily-routine-journal.onrender.com/app-update.json").openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);
            JSONObject result;try{if(connection.getResponseCode()!=200)throw new java.io.IOException();result=new JSONObject(new String(readStream(connection.getInputStream()),StandardCharsets.UTF_8));}finally{connection.disconnect();}
            String url=result.optString("url");if(!url.matches("https://github\\.com/AyushKJha/Daily_Routine_Tracker/releases/download/android-v[0-9.]+/Daily-[0-9.]+\\.apk"))throw new java.io.IOException();
            result.put("kind","update");result.put("available",result.optInt("versionCode")>BuildConfig.VERSION_CODE);runOnUiThread(()->{try{reply.postMessage(result.toString());}catch(Exception ignored){}});
        }catch(Exception error){runOnUiThread(()->{try{reply.postMessage("Update check unavailable. Your offline journal still works.");}catch(Exception ignored){}});}});
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }

    private void save(JSONObject request, JavaScriptReplyProxy reply) {
        if (exportReply != null) { reply.postMessage("Finish the current file export first."); return; }
        String payload = request.optString("data");
        if (payload.length() > 14 * 1024 * 1024) { reply.postMessage("Export is too large. Keep it under 10 MB."); return; }
        String filename = request.optString("filename", "daily-export").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (filename.length() > 160) filename = filename.substring(0, 160);
        String mime = request.optString("mime", "application/octet-stream");
        final String chosenName = filename;
        exportReply = reply;
        io.execute(() -> {
            try {
                byte[] data = android.util.Base64.decode(payload, android.util.Base64.DEFAULT);
                if (data.length > 10 * 1024 * 1024) throw new IllegalArgumentException();
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    pendingExport = data;
                    Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType(mime);
                    picker.putExtra(Intent.EXTRA_TITLE, chosenName);
                    try { startActivityForResult(picker, EXPORT_FILE); }
                    catch (Exception e) { completeExport("No file manager is available. Try again after installing one."); }
                });
            } catch (Exception e) { runOnUiThread(() -> completeExport("Could not prepare the file. Please try again.")); }
        });
    }

    private void completeExport(String message) {
        if (exportReply != null) {
            try { exportReply.postMessage(message); } catch (Exception ignored) { /* Page may have closed. */ }
        }
        pendingExport = null;
        exportReply = null;
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == IMPORT_FILE && importReply != null) {
            importReply.onReceiveValue(uri == null ? null : new Uri[]{uri});
            importReply = null;
        } else if (request == EXPORT_FILE) {
            if (uri == null || pendingExport == null) { completeExport("Save cancelled. Your journal is unchanged."); return; }
            byte[] bytes = pendingExport;
            io.execute(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new IllegalStateException();
                    stream.write(bytes);
                    stream.flush();
                    runOnUiThread(() -> completeExport("File saved."));
                } catch (Exception e) { runOnUiThread(() -> completeExport("Could not save the file. Choose another location and try again.")); }
            });
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel',{cancelable:true}));if(d.open)d.close();return 'handled';}if(!document.querySelector('#app')?.hidden&&document.querySelector('#view-name')?.textContent!=='TODAY'){showView('today');return 'handled';}return typeof dirty!=='undefined'&&dirty?'dirty':'exit';})()", value -> {
            if ("\"handled\"".equals(value)) return;
            if ("\"dirty\"".equals(value)) new AlertDialog.Builder(this).setTitle("Unsaved check-in")
                    .setMessage("Save your check-in before closing, or close without saving.")
                    .setNegativeButton("Stay", (d, w) -> {}).setPositiveButton("Close without saving", (d, w) -> finish()).show();
            else finish();
        });
    }

    @Override protected void onDestroy() {
        if (importReply != null) importReply.onReceiveValue(null);
        pendingExport = null;
        exportReply = null;
        io.shutdownNow();
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
