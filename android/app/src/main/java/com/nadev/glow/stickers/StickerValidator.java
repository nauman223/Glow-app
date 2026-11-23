package com.nadev.glow.stickers;

import android.graphics.BitmapFactory;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * WhatsApp's third-party sticker rules (github.com/WhatsApp/stickers, Android README and
 * StickerPackValidator.java): 3-30 static stickers, each a 512x512 WebP of at most 100 KB with
 * 1-3 emojis; a 96x96 PNG tray icon of at most 50 KB; name and publisher of at most 128 chars.
 * Identifiers and file names are stricter than WhatsApp's so they are always safe path segments.
 */
final class StickerValidator {

    static final int MIN_STICKERS = 3;
    static final int MAX_STICKERS = 30;
    static final int MAX_PACKS = 10;
    static final int STICKER_SIZE_PX = 512;
    static final int TRAY_SIZE_PX = 96;
    static final int MAX_STICKER_BYTES = 100 * 1024;
    static final int MAX_TRAY_BYTES = 50 * 1024;

    private static final int MAX_TEXT_CHARS = 128;
    private static final int MAX_EMOJIS = 3;
    /** UTF-16 units: enough for ZWJ sequences and subdivision flags. */
    private static final int MAX_EMOJI_CHARS = 32;
    private static final int VP8X_FLAGS_OFFSET = 20;
    private static final int VP8X_ANIMATION_FLAG = 0x02;
    private static final byte[] PNG_SIGNATURE = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };

    private static final Pattern PACK_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Pattern FILE_NAME = Pattern.compile("[a-z0-9-]{1,64}\\.(webp|png)");
    private static final Pattern CONTROL_CHARS = Pattern.compile("\\p{Cntrl}");

    private StickerValidator() {}

    static String requirePackId(String id) throws StickerException {
        if (id == null || !PACK_ID.matcher(id).matches()) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Invalid pack id");
        }
        return id;
    }

    static boolean isPackId(String id) {
        return id != null && PACK_ID.matcher(id).matches();
    }

    static String requireFileName(String fileName) throws StickerException {
        if (!isFileName(fileName)) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Invalid sticker file name");
        }
        return fileName;
    }

    static boolean isFileName(String fileName) {
        return fileName != null && FILE_NAME.matcher(fileName).matches();
    }

    static String requireName(String name) throws StickerException {
        return requireText(name, StickerException.REASON_NAME);
    }

    static String requirePublisher(String publisher) throws StickerException {
        return requireText(publisher, StickerException.REASON_PUBLISHER);
    }

    /** 1-3 emojis; commas are rejected because the provider joins them with ",". */
    static List<String> requireEmojis(List<String> emojis) throws StickerException {
        if (emojis == null || emojis.isEmpty() || emojis.size() > MAX_EMOJIS) {
            throw StickerException.validation(StickerException.REASON_EMOJI, "Each sticker needs 1 to 3 emojis");
        }
        List<String> checked = new ArrayList<>(emojis.size());
        for (String emoji : emojis) {
            String trimmed = emoji == null ? "" : emoji.trim();
            if (trimmed.isEmpty() || trimmed.length() > MAX_EMOJI_CHARS || trimmed.contains(",") || CONTROL_CHARS.matcher(trimmed).find()) {
                throw StickerException.validation(StickerException.REASON_EMOJI, "Invalid emoji");
            }
            checked.add(trimmed);
        }
        return checked;
    }

    static void requireStickerCount(int count) throws StickerException {
        if (count < 1 || count > MAX_STICKERS) {
            throw StickerException.validation(StickerException.REASON_STICKER_COUNT, "A pack holds 1 to 30 stickers");
        }
    }

    /** A static (single-frame) 512x512 WebP of at most 100 KB. */
    static void requireStickerImage(byte[] bytes) throws StickerException {
        if (bytes.length > MAX_STICKER_BYTES) {
            throw StickerException.validation(StickerException.REASON_STICKER_FILE_SIZE, "Sticker is larger than 100 KB");
        }
        if (!isWebp(bytes)) {
            throw StickerException.validation(StickerException.REASON_STICKER_FORMAT, "Sticker is not a WebP image");
        }
        if (isAnimatedWebp(bytes)) {
            throw StickerException.validation(StickerException.REASON_STICKER_ANIMATED, "Animated stickers are not supported");
        }
        BitmapFactory.Options bounds = decodeBounds(bytes);
        if (!"image/webp".equals(bounds.outMimeType)) {
            throw StickerException.validation(StickerException.REASON_STICKER_FORMAT, "Sticker is not a WebP image");
        }
        if (bounds.outWidth != STICKER_SIZE_PX || bounds.outHeight != STICKER_SIZE_PX) {
            throw StickerException.validation(StickerException.REASON_STICKER_DIMENSIONS, "Sticker must be 512x512 px");
        }
    }

    /** A 96x96 PNG of at most 50 KB. */
    static void requireTrayImage(byte[] bytes) throws StickerException {
        if (bytes.length > MAX_TRAY_BYTES) {
            throw StickerException.validation(StickerException.REASON_TRAY_FILE_SIZE, "Tray icon is larger than 50 KB");
        }
        if (!startsWith(bytes, PNG_SIGNATURE, 0)) {
            throw StickerException.validation(StickerException.REASON_TRAY_FORMAT, "Tray icon is not a PNG image");
        }
        BitmapFactory.Options bounds = decodeBounds(bytes);
        if (bounds.outWidth != TRAY_SIZE_PX || bounds.outHeight != TRAY_SIZE_PX) {
            throw StickerException.validation(StickerException.REASON_TRAY_DIMENSIONS, "Tray icon must be 96x96 px");
        }
    }

    private static String requireText(String value, String reason) throws StickerException {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_TEXT_CHARS || CONTROL_CHARS.matcher(trimmed).find()) {
            throw StickerException.validation(reason, "Text must be 1 to 128 characters");
        }
        return trimmed;
    }

    private static boolean isWebp(byte[] bytes) {
        return bytes.length > VP8X_FLAGS_OFFSET && startsWith(bytes, ascii("RIFF"), 0) && startsWith(bytes, ascii("WEBP"), 8);
    }

    /** Extended-format WebP (VP8X chunk first) declares animation in its flags byte. */
    private static boolean isAnimatedWebp(byte[] bytes) {
        return startsWith(bytes, ascii("VP8X"), 12) && (bytes[VP8X_FLAGS_OFFSET] & VP8X_ANIMATION_FLAG) != 0;
    }

    private static BitmapFactory.Options decodeBounds(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        return bounds;
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix, int offset) {
        if (bytes.length < offset + prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (bytes[offset + index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }
}
