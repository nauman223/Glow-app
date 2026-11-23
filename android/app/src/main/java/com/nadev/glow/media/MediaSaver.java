package com.nadev.glow.media;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.annotation.RequiresApi;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Copies a cached export into the shared "Pictures/Glow" album. The result lives in public
 * storage, so it survives an uninstall (unlike Context.getExternalMediaDirs()).
 */
final class MediaSaver {

    static final String ALBUM = "Glow";

    private static final long SCAN_TIMEOUT_SECONDS = 10;
    private static final int MAX_NAME_ATTEMPTS = 1000;

    private MediaSaver() {}

    /** True when this API level needs WRITE_EXTERNAL_STORAGE to save (API 26-28 only). */
    static boolean needsWritePermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q;
    }

    /** Returns the content URI of the new gallery item. */
    static Uri save(Context context, File source, String fileName, String mimeType) throws MediaException {
        if (!source.isFile()) {
            throw new MediaException(MediaException.NOT_FOUND, "Source file not found");
        }
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? saveScoped(context.getContentResolver(), source, fileName, mimeType)
            : saveLegacy(context, source, fileName, mimeType);
    }

    /** API 29+: no permission; IS_PENDING hides the row from other apps until the copy finishes. */
    @RequiresApi(api = Build.VERSION_CODES.Q)
    private static Uri saveScoped(ContentResolver resolver, File source, String fileName, String mimeType)
        throws MediaException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + ALBUM);
        values.put(MediaStore.MediaColumns.DATE_TAKEN, System.currentTimeMillis());
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) {
            throw new MediaException(MediaException.IO_ERROR, "Gallery item could not be created");
        }
        try (InputStream in = new FileInputStream(source); OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) {
                throw new IOException("No output stream");
            }
            MediaFiles.copy(in, out);
        } catch (IOException e) {
            resolver.delete(item, null, null);
            throw new MediaException(MediaException.IO_ERROR, "Image could not be saved", e);
        }
        ContentValues published = new ContentValues();
        published.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(item, published, null, null);
        return item;
    }

    /** API 26-28: a real file in the public Pictures folder, then a media scan to index it. */
    @SuppressWarnings("deprecation")
    private static Uri saveLegacy(Context context, File source, String fileName, String mimeType) throws MediaException {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new MediaException(MediaException.IO_ERROR, "Album folder could not be created");
        }
        File target = uniqueFile(dir, fileName);
        try (InputStream in = new FileInputStream(source); OutputStream out = new FileOutputStream(target)) {
            MediaFiles.copy(in, out);
        } catch (IOException e) {
            MediaFiles.deleteQuietly(target);
            throw new MediaException(MediaException.IO_ERROR, "Image could not be saved", e);
        }
        Uri scanned = scan(context, target, mimeType);
        return scanned != null ? scanned : Uri.fromFile(target);
    }

    /** Called on a worker thread, so waiting for the scanner callback never blocks the UI. */
    private static Uri scan(Context context, File file, String mimeType) {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<Uri> result = new AtomicReference<>();
        MediaScannerConnection.scanFile(
            context,
            new String[] { file.getAbsolutePath() },
            new String[] { mimeType },
            (path, uri) -> {
                result.set(uri);
                done.countDown();
            }
        );
        try {
            done.await(SCAN_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return result.get();
    }

    /** "name.jpg", then "name (1).jpg", ... MediaStore does the same itself on API 29+. */
    private static File uniqueFile(File dir, String fileName) throws MediaException {
        File candidate = new File(dir, fileName);
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        String extension = dot > 0 ? fileName.substring(dot) : "";
        for (int attempt = 1; candidate.exists() && attempt < MAX_NAME_ATTEMPTS; attempt++) {
            candidate = new File(dir, base + " (" + attempt + ")" + extension);
        }
        if (candidate.exists()) {
            throw new MediaException(MediaException.IO_ERROR, "No free file name");
        }
        return candidate;
    }
}
