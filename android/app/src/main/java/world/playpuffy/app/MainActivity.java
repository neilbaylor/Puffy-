package world.playpuffy.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        // the game's music starts on the start screen without a first tap (a web page has to wait for one)
        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        // the game's drawing is the important thing on screen: keep its renderer at top priority
        // (and not lowered when the app is in the background only for a moment)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }
        // the screen stays on while the game is in front (played with a controller, or watching a
        // boss's entrance, nothing touches the screen); the flag goes with the window
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // landscape phones: the game runs under the camera cut-out too (its screens keep clear of it)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        preferSixtyHz();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // (back from another app, a notification shade, a dialog: full screen again)
        if (hasFocus) hideSystemBars();
    }

    /** True full screen: no status bar or navigation bar (a swipe from the edge shows them for a moment). */
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * On a 90 or 120 Hz screen, ask for 60 Hz while the game is in front (Android 11 and up). The game
     * runs at 60: at 120 it already draws every other frame, but at 90 it drew every frame, half as much
     * work again for nothing. Only a mode of the same resolution is chosen; none at 60 Hz: unchanged.
     */
    private void preferSixtyHz() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        Display display = getDisplay();
        if (display == null) return;
        Display.Mode now = display.getMode();
        if (Math.abs(now.getRefreshRate() - 60f) < 1f) return;
        Display.Mode pick = null;
        for (Display.Mode m : display.getSupportedModes()) {
            if (m.getPhysicalWidth() != now.getPhysicalWidth() || m.getPhysicalHeight() != now.getPhysicalHeight()) continue;
            if (Math.abs(m.getRefreshRate() - 60f) < 1f) pick = m;
        }
        WindowManager.LayoutParams attrs = getWindow().getAttributes();
        if (pick != null) attrs.preferredDisplayModeId = pick.getModeId();
        // (and the plain "60 please", for displays that switch rate within one mode)
        attrs.preferredRefreshRate = 60f;
        getWindow().setAttributes(attrs);
    }
}
