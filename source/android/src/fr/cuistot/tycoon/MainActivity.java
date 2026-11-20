package fr.cuistot.tycoon;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

public class MainActivity extends Activity {
    // build number of the game bundled in this APK (written by build_apk.sh)
    private static final int BUNDLED_BUILD = BuildInfo.BUNDLED_BUILD;
    // version of this Java bridge: the game asks for a newer APK when it needs more than this
    private static final int NATIVE_LEVEL = 2;

    private WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        prefs = getSharedPreferences("cuistot_tycoon", Context.MODE_PRIVATE);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0x1d, 0x3a, 0x1a));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        hideSystemUi();
        web.loadUrl(startUrl());
    }

    private File otaFile() {
        return new File(new File(getFilesDir(), "ota"), "index.html");
    }

    // the downloaded game if it is newer than the bundled one and it started fine before
    private String startUrl() {
        File f = otaFile();
        int ota = prefs.getInt("ota_build", 0);
        int tries = prefs.getInt("ota_tries", 0);
        if (f.exists() && ota > BUNDLED_BUILD) {
            if (tries < 2) {
                prefs.edit().putInt("ota_tries", tries + 1).commit();
                return Uri.fromFile(f).toString();
            }
            // the downloaded version failed to start twice: forget it, use the bundled game
            f.delete();
            prefs.edit().remove("ota_build").putInt("ota_tries", 0).commit();
        }
        return "file:///android_asset/index.html";
    }

    private void hideSystemUi() {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"1".equals(v)) finish();
            }
        });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.onAppPause && window.onAppPause()", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.onAppResume && window.onAppResume()", null);
        }
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    // call a JS function by name with (ok, text) on the UI thread
    private void jsCallback(final String fn, final boolean ok, final String text) {
        if (fn == null || !fn.matches("[A-Za-z0-9_$]+")) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                web.evaluateJavascript("window." + fn + " && window." + fn + "(" + ok + "," + JSONObject.quote(text == null ? "" : text) + ")", null);
            }
        });
    }

    private void jsProgress(final int pct) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript("window.__otaProgress && window.__otaProgress(" + pct + ")", null);
            }
        });
    }

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Cache-Control", "no-cache");
        return c;
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private class Bridge {
        @JavascriptInterface
        public String load(String key) {
            return prefs.getString(key, null);
        }

        @JavascriptInterface
        public void save(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) v.vibrate(Math.max(5, Math.min(ms, 500)));
            } catch (Exception e) {
                // ignore
            }
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= 21) finishAndRemoveTask(); else finish();
                }
            });
        }

        @JavascriptInterface
        public int nativeLevel() {
            return NATIVE_LEVEL;
        }

        @JavascriptInterface
        public int bundledBuild() {
            return BUNDLED_BUILD;
        }

        // the game started fine: the downloaded version is kept
        @JavascriptInterface
        public void bootOk(int build) {
            prefs.edit().putInt("ota_tries", 0).apply();
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) {
                // ignore
            }
        }

        // small text download (version.json)
        @JavascriptInterface
        public void fetchText(final String url, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection c = null;
                    try {
                        c = open(url);
                        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                        InputStream in = c.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            if (out.size() > 1024 * 1024) throw new Exception("too big");
                        }
                        in.close();
                        jsCallback(cb, true, out.toString("UTF-8"));
                    } catch (Exception e) {
                        jsCallback(cb, false, String.valueOf(e.getMessage()));
                    } finally {
                        if (c != null) c.disconnect();
                    }
                }
            }).start();
        }

        // download the new game, check it, and keep it for the next start
        @JavascriptInterface
        public void otaInstall(final String url, final String sha256, final int build, final int size, final String cb) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection c = null;
                    File dir = new File(getFilesDir(), "ota");
                    File tmp = new File(dir, "index.html.tmp");
                    try {
                        if (!dir.exists() && !dir.mkdirs()) throw new Exception("stockage indisponible");
                        c = open(url);
                        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                        int total = c.getContentLength();
                        if (total <= 0) total = size;
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        InputStream in = c.getInputStream();
                        FileOutputStream out = new FileOutputStream(tmp);
                        byte[] buf = new byte[65536];
                        int n, got = 0, last = -1;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            md.update(buf, 0, n);
                            got += n;
                            if (total > 0) {
                                int pct = Math.min(99, (int) (100L * got / total));
                                if (pct != last) { last = pct; jsProgress(pct); }
                            }
                        }
                        out.close();
                        in.close();
                        if (sha256 != null && sha256.length() == 64 && !sha256.equalsIgnoreCase(hex(md.digest()))) {
                            tmp.delete();
                            throw new Exception("fichier abîmé, réessaie");
                        }
                        File dest = otaFile();
                        if (dest.exists()) dest.delete();
                        if (!tmp.renameTo(dest)) throw new Exception("installation impossible");
                        prefs.edit().putInt("ota_build", build).putInt("ota_tries", 0).commit();
                        jsCallback(cb, true, "ok");
                    } catch (Exception e) {
                        tmp.delete();
                        jsCallback(cb, false, String.valueOf(e.getMessage()));
                    } finally {
                        if (c != null) c.disconnect();
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void restartApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (web != null) web.loadUrl(startUrl());
                }
            });
        }
    }
}
