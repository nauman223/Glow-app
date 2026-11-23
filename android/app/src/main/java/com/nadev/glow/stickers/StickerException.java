package com.nadev.glow.stickers;

/**
 * A failure with a stable code that the TS side maps to a typed WhatsAppStickerError.
 * VALIDATION_FAILED also carries a machine-readable `reason` (see the REASON_* constants).
 */
final class StickerException extends Exception {

    static final String INVALID_ARGUMENT = "INVALID_ARGUMENT";
    static final String NOT_FOUND = "NOT_FOUND";
    static final String IO_ERROR = "IO_ERROR";
    static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    static final String WHATSAPP_NOT_INSTALLED = "WHATSAPP_NOT_INSTALLED";

    static final String REASON_STICKER_FORMAT = "sticker_format";
    static final String REASON_STICKER_DIMENSIONS = "sticker_dimensions";
    static final String REASON_STICKER_FILE_SIZE = "sticker_file_size";
    static final String REASON_STICKER_ANIMATED = "sticker_animated";
    static final String REASON_TRAY_FORMAT = "tray_format";
    static final String REASON_TRAY_DIMENSIONS = "tray_dimensions";
    static final String REASON_TRAY_FILE_SIZE = "tray_file_size";
    static final String REASON_TRAY_MISSING = "tray_missing";
    static final String REASON_EMOJI = "emoji";
    static final String REASON_STICKER_COUNT = "sticker_count";
    static final String REASON_TOO_FEW_STICKERS = "too_few_stickers";
    static final String REASON_PACK_LIMIT = "pack_limit";
    static final String REASON_NAME = "name";
    static final String REASON_PUBLISHER = "publisher";

    private final String code;
    private final String reason;

    StickerException(String code, String message) {
        this(code, null, message, null);
    }

    StickerException(String code, String message, Throwable cause) {
        this(code, null, message, cause);
    }

    private StickerException(String code, String reason, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.reason = reason;
    }

    static StickerException validation(String reason, String message) {
        return new StickerException(VALIDATION_FAILED, reason, message, null);
    }

    String getCode() {
        return code;
    }

    /** Null unless the code is VALIDATION_FAILED. */
    String getReason() {
        return reason;
    }
}
