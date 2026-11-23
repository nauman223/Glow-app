package com.nadev.glow.stickers;

import android.content.Context;
import android.net.Uri;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Blocking file helpers for sticker storage: cache path guard, bounded reads, atomic writes. */
final class StickerFiles {

    private static final SecureRandom RANDOM = new SecureRandom();

    private StickerFiles() {}

    /**
     * Same guard as GlowMedia: accepts a plain path or a file:// URI and returns its canonical
     * file only if it lies inside the app cache dir. Blocks "../" traversal and symlink escapes.
     */
    static File requireCacheFile(Context context, String path) throws StickerException {
        if (path == null || path.isEmpty()) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Missing path");
        }
        String rawPath = path.startsWith("file:") ? Uri.parse(path).getPath() : path;
        if (rawPath == null) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Invalid path");
        }
        try {
            File file = new File(rawPath).getCanonicalFile();
            String cacheRoot = context.getCacheDir().getCanonicalPath() + File.separator;
            if (!file.getPath().startsWith(cacheRoot)) {
                throw new StickerException(StickerException.INVALID_ARGUMENT, "Path is outside the app cache");
            }
            if (!file.isFile()) {
                throw new StickerException(StickerException.NOT_FOUND, "File not found");
            }
            return file;
        } catch (IOException e) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Invalid path", e);
        }
    }

    /**
     * Validates a cache file as a sticker (or tray icon) and copies it into `dir` under a fresh name.
     * The bytes are validated and written from one bounded read, so the file cannot change between
     * check and copy. The new file is appended to `written` for rollback.
     */
    static String importImage(Context context, File dir, String cachePath, boolean tray, List<File> written) throws StickerException {
        File source = requireCacheFile(context, cachePath);
        byte[] bytes;
        String fileName;
        if (tray) {
            bytes = readBounded(source, StickerValidator.MAX_TRAY_BYTES, StickerException.REASON_TRAY_FILE_SIZE);
            StickerValidator.requireTrayImage(bytes);
            fileName = newFileName("tray", "png");
        } else {
            bytes = readBounded(source, StickerValidator.MAX_STICKER_BYTES, StickerException.REASON_STICKER_FILE_SIZE);
            StickerValidator.requireStickerImage(bytes);
            fileName = newFileName("sticker", "webp");
        }
        File target = new File(dir, fileName);
        writeAtomically(target, bytes);
        written.add(target);
        return fileName;
    }

    /** Removes everything in `dir` whose name is not in `keep` (orphans and stale temp files). */
    static void deleteAllExcept(File dir, Set<String> keep) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (!keep.contains(file.getName())) {
                deleteRecursively(file);
            }
        }
    }

    /** Reads at most `maxBytes`; a larger file fails validation before it is loaded into memory. */
    static byte[] readBounded(File file, int maxBytes, String tooLargeReason) throws StickerException {
        long length = file.length();
        if (length > maxBytes) {
            throw StickerException.validation(tooLargeReason, "File is too large");
        }
        byte[] bytes = new byte[(int) length];
        try (InputStream in = new FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int read = in.read(bytes, offset, bytes.length - offset);
                if (read < 0) {
                    throw new IOException("File shrank while reading");
                }
                offset += read;
            }
            if (in.read() != -1) {
                throw StickerException.validation(tooLargeReason, "File is too large");
            }
            return bytes;
        } catch (IOException e) {
            throw new StickerException(StickerException.IO_ERROR, "File could not be read", e);
        }
    }

    static String readText(File file, int maxBytes) throws StickerException {
        try {
            return new String(readBounded(file, maxBytes, StickerException.REASON_STICKER_FILE_SIZE), StandardCharsets.UTF_8);
        } catch (StickerException e) {
            throw new StickerException(StickerException.IO_ERROR, "File could not be read", e);
        }
    }

    /** Writes through a temp file and renames, so readers never see a half-written file. */
    static void writeAtomically(File target, byte[] bytes) throws StickerException {
        File temp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (OutputStream out = new FileOutputStream(temp)) {
            out.write(bytes);
            out.flush();
        } catch (IOException e) {
            deleteQuietly(temp);
            throw new StickerException(StickerException.IO_ERROR, "File could not be written", e);
        }
        if (!temp.renameTo(target)) {
            deleteQuietly(temp);
            throw new StickerException(StickerException.IO_ERROR, "File could not be written");
        }
    }

    /** Unpredictable, validator-safe names; a new name per image keeps WhatsApp from showing stale art. */
    static String newFileName(String prefix, String extension) {
        return String.format(Locale.US, "%s-%016x.%s", prefix, RANDOM.nextLong(), extension);
    }

    static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }
        deleteQuietly(file);
    }

    static void deleteQuietly(File file) {
        if (file.exists() && !file.delete()) {
            file.deleteOnExit();
        }
    }
}
