package com.nadev.glow.media;

/** A failure with a stable code that the TS side maps to a typed MediaLibraryError. */
final class MediaException extends Exception {

    static final String PERMISSION_DENIED = "PERMISSION_DENIED";
    static final String NOT_FOUND = "NOT_FOUND";
    static final String IO_ERROR = "IO_ERROR";
    static final String INVALID_ARGUMENT = "INVALID_ARGUMENT";

    private final String code;

    MediaException(String code, String message) {
        super(message);
        this.code = code;
    }

    MediaException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    String getCode() {
        return code;
    }
}
