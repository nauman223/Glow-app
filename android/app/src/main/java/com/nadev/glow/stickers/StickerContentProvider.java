package com.nadev.glow.stickers;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.UriMatcher;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Binder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.text.TextUtils;
import java.io.File;
import java.io.FileNotFoundException;
import java.util.Collections;
import java.util.List;

/**
 * Read-only provider in the contract of WhatsApp's sample StickerContentProvider
 * (github.com/WhatsApp/stickers): `metadata`, `metadata/<id>`, `stickers/<id>` and
 * `stickers_asset/<id>/<file>`. It is exported because WhatsApp must read it, but the manifest
 * gates it behind `com.whatsapp.sticker.READ`, every call also checks that the caller's UID
 * belongs to WhatsApp, WhatsApp Business or Glow, and only files listed in a pack's manifest are
 * served. Packs with fewer than 3 or more than 30 stickers are not listed.
 */
public class StickerContentProvider extends ContentProvider {

    static final String AUTHORITY_SUFFIX = ".stickercontentprovider";

    static final String METADATA = "metadata";
    static final String STICKERS = "stickers";
    static final String STICKERS_ASSET = "stickers_asset";

    private static final String[] PACK_COLUMNS = {
        "sticker_pack_identifier",
        "sticker_pack_name",
        "sticker_pack_publisher",
        "sticker_pack_icon",
        "android_play_store_link",
        "ios_app_download_link",
        "sticker_pack_publisher_email",
        "sticker_pack_publisher_website",
        "sticker_pack_privacy_policy_website",
        "sticker_pack_license_agreement_website",
        "image_data_version",
        "whatsapp_will_not_cache_stickers",
        "animated_sticker_pack",
    };
    private static final String[] STICKER_COLUMNS = { "sticker_file_name", "sticker_emoji", "sticker_accessibility_text" };

    private static final int CODE_ALL_PACKS = 1;
    private static final int CODE_ONE_PACK = 2;
    private static final int CODE_STICKERS = 3;
    private static final int CODE_ASSET = 4;

    private final UriMatcher matcher = new UriMatcher(UriMatcher.NO_MATCH);
    private String authority;

    static String authorityFor(Context context) {
        return context.getPackageName() + AUTHORITY_SUFFIX;
    }

    @Override
    public boolean onCreate() {
        Context context = getContext();
        if (context == null) {
            return false;
        }
        authority = authorityFor(context);
        matcher.addURI(authority, METADATA, CODE_ALL_PACKS);
        matcher.addURI(authority, METADATA + "/*", CODE_ONE_PACK);
        matcher.addURI(authority, STICKERS + "/*", CODE_STICKERS);
        matcher.addURI(authority, STICKERS_ASSET + "/*/*", CODE_ASSET);
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        Context context = requireAllowedCaller();
        switch (matcher.match(uri)) {
            case CODE_ALL_PACKS:
                return packCursor(StickerStore.list(context));
            case CODE_ONE_PACK:
                return packCursor(publishable(context, uri.getLastPathSegment()));
            case CODE_STICKERS:
                return stickerCursor(publishable(context, uri.getLastPathSegment()));
            default:
                throw new IllegalArgumentException("Unknown URI");
        }
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context context = requireAllowedCaller();
        List<String> segments = uri.getPathSegments();
        if (!"r".equals(mode) || matcher.match(uri) != CODE_ASSET || segments.size() != 3) {
            throw new FileNotFoundException("Not a sticker asset");
        }
        File file = StickerStore.assetFile(context, segments.get(1), segments.get(2));
        if (file == null) {
            throw new FileNotFoundException("Sticker asset not found");
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        return new AssetFileDescriptor(openFile(uri, mode), 0, AssetFileDescriptor.UNKNOWN_LENGTH);
    }

    @Override
    public String getType(Uri uri) {
        switch (matcher.match(uri)) {
            case CODE_ALL_PACKS:
                return "vnd.android.cursor.dir/vnd." + authority + "." + METADATA;
            case CODE_ONE_PACK:
                return "vnd.android.cursor.item/vnd." + authority + "." + METADATA;
            case CODE_STICKERS:
                return "vnd.android.cursor.dir/vnd." + authority + "." + STICKERS;
            case CODE_ASSET:
                return uri.getLastPathSegment() != null && uri.getLastPathSegment().endsWith(".png") ? "image/png" : "image/webp";
            default:
                return null;
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    /** Defence in depth on top of the manifest read permission, which any app could squat. */
    private Context requireAllowedCaller() {
        Context context = getContext();
        int uid = Binder.getCallingUid();
        if (context == null) {
            throw new SecurityException("Provider not ready");
        }
        if (uid == Process.myUid()) {
            return context;
        }
        String[] packages = context.getPackageManager().getPackagesForUid(uid);
        if (packages != null) {
            for (String name : packages) {
                if (WhatsAppApps.isWhatsAppPackage(name)) {
                    return context;
                }
            }
        }
        throw new SecurityException("Caller may not read sticker packs");
    }

    /** The pack as a 0- or 1-element list; empty unless it exists and has 3-30 stickers. */
    private static List<StickerPack> publishable(Context context, String id) {
        try {
            StickerPack pack = StickerValidator.isPackId(id) ? StickerStore.read(context, id) : null;
            return pack == null || !pack.isPublishable() ? Collections.emptyList() : Collections.singletonList(pack);
        } catch (StickerException e) {
            return Collections.emptyList();
        }
    }

    private static Cursor packCursor(List<StickerPack> packs) {
        MatrixCursor cursor = new MatrixCursor(PACK_COLUMNS);
        for (StickerPack pack : packs) {
            if (!pack.isPublishable()) {
                continue;
            }
            cursor.addRow(new Object[] {
                pack.id, pack.name, pack.publisher, pack.trayFileName, "", "", "", "", "", "",
                Long.toString(pack.imageDataVersion), 0, 0,
            });
        }
        return cursor;
    }

    private static Cursor stickerCursor(List<StickerPack> packs) {
        MatrixCursor cursor = new MatrixCursor(STICKER_COLUMNS);
        for (StickerPack pack : packs) {
            for (StickerPack.Sticker sticker : pack.stickers) {
                cursor.addRow(new Object[] { sticker.fileName, TextUtils.join(",", sticker.emojis), null });
            }
        }
        return cursor;
    }
}
