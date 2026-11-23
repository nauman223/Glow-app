package com.nadev.glow.media;

import android.os.Build;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;

/**
 * Maps the API-level-specific read permissions to one "photos" state:
 *
 * <ul>
 *   <li>API 34+: READ_MEDIA_IMAGES = granted; else READ_MEDIA_VISUAL_USER_SELECTED = limited.</li>
 *   <li>API 33: READ_MEDIA_IMAGES.</li>
 *   <li>API 26-32: READ_EXTERNAL_STORAGE.</li>
 * </ul>
 *
 * Capacitor reports "prompt-with-rationale" after one denial; it can still be requested, so it
 * maps to 'prompt'. Only a permanent denial ("don't ask again") is 'denied'.
 */
final class PhotoPermission {

    private PhotoPermission() {}

    static String state(Plugin plugin) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState images = plugin.getPermissionState(GlowMediaPlugin.ALIAS_IMAGES);
            if (images == PermissionState.GRANTED) {
                return "granted";
            }
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
                plugin.getPermissionState(GlowMediaPlugin.ALIAS_SELECTED) == PermissionState.GRANTED
            ) {
                return "limited";
            }
            return toJs(images);
        }
        return toJs(plugin.getPermissionState(GlowMediaPlugin.ALIAS_LEGACY_READ));
    }

    static String[] aliasesToRequest() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return new String[] { GlowMediaPlugin.ALIAS_IMAGES, GlowMediaPlugin.ALIAS_SELECTED };
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return new String[] { GlowMediaPlugin.ALIAS_IMAGES };
        }
        return new String[] { GlowMediaPlugin.ALIAS_LEGACY_READ };
    }

    private static String toJs(PermissionState state) {
        if (state == PermissionState.GRANTED) {
            return "granted";
        }
        return state == PermissionState.DENIED ? "denied" : "prompt";
    }
}
