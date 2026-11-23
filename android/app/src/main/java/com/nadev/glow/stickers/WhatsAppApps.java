package com.nadev.glow.stickers;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;

/**
 * WhatsApp and WhatsApp Business as in the official sample's WhitelistCheck and
 * AddStickerPackActivity (github.com/WhatsApp/stickers). Requires the `<queries>` entries for
 * both packages on Android 11+. Blocking (the whitelist check is a cross-process query).
 */
final class WhatsAppApps {

    static final String CONSUMER = "com.whatsapp";
    static final String BUSINESS = "com.whatsapp.w4b";

    static final String ACTION_ENABLE_STICKER_PACK = "com.whatsapp.intent.action.ENABLE_STICKER_PACK";
    static final String EXTRA_PACK_ID = "sticker_pack_id";
    static final String EXTRA_AUTHORITY = "sticker_pack_authority";
    static final String EXTRA_PACK_NAME = "sticker_pack_name";
    static final String EXTRA_VALIDATION_ERROR = "validation_error";

    private static final String WHITELIST_AUTHORITY_SUFFIX = ".provider.sticker_whitelist_check";
    private static final String WHITELIST_PATH = "is_whitelisted";
    private static final String WHITELIST_RESULT = "result";

    private WhatsAppApps() {}

    static boolean isWhatsAppPackage(String packageName) {
        return CONSUMER.equals(packageName) || BUSINESS.equals(packageName);
    }

    /** Installed and enabled (a disabled WhatsApp cannot receive the intent). */
    static boolean isInstalled(Context context, String packageName) {
        try {
            ApplicationInfo info = context.getPackageManager().getApplicationInfo(packageName, 0);
            return info.enabled;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /**
     * Whether `packageName` already has the pack. False when the app is missing, when it is too old
     * to expose the whitelist provider, or when the query fails. Apps can only check their own packs.
     */
    static boolean hasPack(Context context, String packageName, String packId) {
        if (!isInstalled(context, packageName)) {
            return false;
        }
        String whitelistAuthority = packageName + WHITELIST_AUTHORITY_SUFFIX;
        ProviderInfo provider = context.getPackageManager().resolveContentProvider(whitelistAuthority, 0);
        if (provider == null) {
            return false;
        }
        Uri uri = new Uri.Builder()
            .scheme("content")
            .authority(whitelistAuthority)
            .appendPath(WHITELIST_PATH)
            .appendQueryParameter("authority", StickerContentProvider.authorityFor(context))
            .appendQueryParameter("identifier", packId)
            .build();
        try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                return false;
            }
            int column = cursor.getColumnIndex(WHITELIST_RESULT);
            return column >= 0 && cursor.getInt(column) == 1;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** `targetPackage` null leaves the choice to the system (both apps installed, neither has it). */
    static Intent enablePackIntent(Context context, StickerPack pack, String targetPackage) {
        Intent intent = new Intent(ACTION_ENABLE_STICKER_PACK);
        intent.putExtra(EXTRA_PACK_ID, pack.id);
        intent.putExtra(EXTRA_AUTHORITY, StickerContentProvider.authorityFor(context));
        intent.putExtra(EXTRA_PACK_NAME, pack.name);
        if (targetPackage != null) {
            intent.setPackage(targetPackage);
            return intent;
        }
        return Intent.createChooser(intent, null);
    }
}
