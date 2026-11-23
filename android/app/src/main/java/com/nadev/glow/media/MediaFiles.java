package com.nadev.glow.media;

import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.util.Size;
import android.webkit.MimeTypeMap;
import androidx.annotation.RequiresApi;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** Cache-side file work: thumbnails, original copies and the cache path guard. Blocking. */
final class MediaFiles {

    static final String THUMBS_DIR = "glow-thumbs";
    static final String ORIGINALS_DIR = "glow-originals";

    private static final int JPEG_QUALITY = 85;
    private static final int BUFFER_SIZE = 64 * 1024;

    private MediaFiles() {}

    /** Reuses `<id>_<size>.jpg` when present; the file is written atomically, so a hit is always complete. */
    static File thumbnail(Context context, long id, int orientation, int size) throws MediaException {
        File dir = cacheSubdir(context, THUMBS_DIR);
        File target = new File(dir, id + "_" + size + ".jpg");
        if (target.length() > 0) {
            return target;
        }
        Bitmap bitmap = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? loadSystemThumbnail(context.getContentResolver(), id, size)
            : decodeSampled(context.getContentResolver(), id, orientation, size);
        try {
            File temp = File.createTempFile("thumb-", ".tmp", dir);
            try (OutputStream out = new FileOutputStream(temp)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out);
            }
            if (!temp.renameTo(target)) {
                deleteQuietly(temp);
                throw new IOException("Thumbnail rename failed");
            }
            return target;
        } catch (IOException e) {
            throw new MediaException(MediaException.IO_ERROR, "Thumbnail could not be written", e);
        } finally {
            bitmap.recycle();
        }
    }

    /** Streams the original to a unique cache file with a fixed 64 KB buffer (no full-size byte array). */
    static File copyOriginal(Context context, long id, String mimeType) throws MediaException {
        File dir = cacheSubdir(context, ORIGINALS_DIR);
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        File target;
        try {
            target = File.createTempFile("original-" + id + "-", "." + (extension == null ? "img" : extension), dir);
        } catch (IOException e) {
            throw new MediaException(MediaException.IO_ERROR, "Cache file could not be created", e);
        }
        try (
            InputStream in = context.getContentResolver().openInputStream(MediaQueries.contentUri(id));
            OutputStream out = new FileOutputStream(target)
        ) {
            if (in == null) {
                throw new FileNotFoundException("No stream");
            }
            copy(in, out);
            return target;
        } catch (FileNotFoundException e) {
            deleteQuietly(target);
            throw new MediaException(MediaException.NOT_FOUND, "Image not found", e);
        } catch (IOException e) {
            deleteQuietly(target);
            throw new MediaException(MediaException.IO_ERROR, "Image could not be read", e);
        }
    }

    /**
     * Accepts a plain path or a file:// URI and returns its canonical file only if it lies inside
     * the app cache dir. Blocks path traversal ("../") and symlink escapes.
     */
    static File requireCacheFile(Context context, String path) throws MediaException {
        if (path == null || path.isEmpty()) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Missing path");
        }
        String rawPath = path.startsWith("file:") ? Uri.parse(path).getPath() : path;
        if (rawPath == null) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Invalid path");
        }
        try {
            File file = new File(rawPath).getCanonicalFile();
            String cacheRoot = context.getCacheDir().getCanonicalPath() + File.separator;
            if (!file.getPath().startsWith(cacheRoot)) {
                throw new MediaException(MediaException.INVALID_ARGUMENT, "Path is outside the app cache");
            }
            return file;
        } catch (IOException e) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Invalid path", e);
        }
    }

    static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    static void deleteQuietly(File file) {
        if (file.exists() && !file.delete()) {
            file.deleteOnExit();
        }
    }

    private static File cacheSubdir(Context context, String name) throws MediaException {
        File dir = new File(context.getCacheDir(), name);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new MediaException(MediaException.IO_ERROR, "Cache folder could not be created");
        }
        return dir;
    }

    /** API 29+: MediaProvider's cached thumbnail, already rotated by EXIF orientation. */
    @RequiresApi(api = Build.VERSION_CODES.Q)
    private static Bitmap loadSystemThumbnail(ContentResolver resolver, long id, int size) throws MediaException {
        try {
            return resolver.loadThumbnail(MediaQueries.contentUri(id), new Size(size, size), null);
        } catch (FileNotFoundException e) {
            throw new MediaException(MediaException.NOT_FOUND, "Image not found", e);
        } catch (IOException e) {
            throw new MediaException(MediaException.IO_ERROR, "Thumbnail could not be loaded", e);
        }
    }

    /** API 26-28: power-of-two subsampled decode (at most 2x the target), then rotate. */
    private static Bitmap decodeSampled(ContentResolver resolver, long id, int orientation, int size) throws MediaException {
        Uri uri = MediaQueries.contentUri(id);
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = resolver.openInputStream(uri)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, size);
            Bitmap decoded;
            try (InputStream in = resolver.openInputStream(uri)) {
                decoded = BitmapFactory.decodeStream(in, null, options);
            }
            if (decoded == null) {
                throw new MediaException(MediaException.IO_ERROR, "Image could not be decoded");
            }
            return rotate(decoded, orientation);
        } catch (FileNotFoundException e) {
            throw new MediaException(MediaException.NOT_FOUND, "Image not found", e);
        } catch (IOException e) {
            throw new MediaException(MediaException.IO_ERROR, "Image could not be read", e);
        }
    }

    private static int sampleSize(int width, int height, int target) {
        int sample = 1;
        while (width / (sample * 2) >= target && height / (sample * 2) >= target) {
            sample *= 2;
        }
        return sample;
    }

    private static Bitmap rotate(Bitmap source, int degrees) {
        if (degrees % 360 == 0) {
            return source;
        }
        Matrix matrix = new Matrix();
        matrix.postRotate(degrees);
        Bitmap rotated = Bitmap.createBitmap(source, 0, 0, source.getWidth(), source.getHeight(), matrix, true);
        if (rotated != source) {
            source.recycle();
        }
        return rotated;
    }
}
