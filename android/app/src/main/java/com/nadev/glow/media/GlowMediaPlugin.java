package com.nadev.glow.media;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Device photo library for Glow on Android: permission, albums, paged images with thumbnails,
 * original copies and saving exports to the shared "Pictures/Glow" album.
 *
 * Capacitor runs plugin methods on its single "CapacitorPlugins" thread, shared by every plugin.
 * All I/O here is moved to this plugin's own pools, so a slow copy never stalls other plugins and
 * nothing touches the UI thread (permission callbacks arrive on the UI thread and only dispatch).
 */
@CapacitorPlugin(
    name = "GlowMedia",
    permissions = {
        @Permission(alias = GlowMediaPlugin.ALIAS_IMAGES, strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = GlowMediaPlugin.ALIAS_SELECTED, strings = { Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }),
        @Permission(alias = GlowMediaPlugin.ALIAS_LEGACY_READ, strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = GlowMediaPlugin.ALIAS_LEGACY_WRITE, strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class GlowMediaPlugin extends Plugin {

    static final String ALIAS_IMAGES = "mediaImages";
    static final String ALIAS_SELECTED = "mediaSelected";
    static final String ALIAS_LEGACY_READ = "legacyRead";
    static final String ALIAS_LEGACY_WRITE = "legacyWrite";

    private static final String TAG = "GlowMedia";
    private static final int MAX_PAGE = 200;
    private static final int MIN_THUMB = 32;
    private static final int MAX_THUMB = 1024;

    private final ExecutorService work = Executors.newFixedThreadPool(2);
    /** Separate pool: page tasks on `work` wait on thumbnail tasks, so sharing one pool could deadlock. */
    private final ExecutorService thumbs = Executors.newFixedThreadPool(4);

    private interface Task {
        void run() throws MediaException;
    }

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(photosResult());
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if ("granted".equals(PhotoPermission.state(this))) {
            call.resolve(photosResult());
            return;
        }
        // On API 34+ asking for both shows "Allow all" / "Select photos"; re-asking from 'limited'
        // lets the user change the selection.
        requestPermissionForAliases(PhotoPermission.aliasesToRequest(), call, "photosPermissionCallback");
    }

    @PluginMethod
    public void listAlbums(PluginCall call) {
        runReading(call, () -> {
            JSArray albums = new JSArray();
            for (MediaQueries.AlbumRow row : MediaQueries.albums(getContext().getContentResolver())) {
                JSObject album = new JSObject();
                album.put("id", row.id);
                album.put("name", row.name);
                album.put("count", row.count);
                album.put("coverId", Long.toString(row.coverId));
                albums.put(album);
            }
            JSObject result = new JSObject();
            result.put("albums", albums);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void listImages(PluginCall call) {
        runReading(call, () -> {
            int offset = requireRange(call.getInt("offset", 0), 0, Integer.MAX_VALUE, "offset");
            int limit = requireRange(call.getInt("limit", 0), 1, MAX_PAGE, "limit");
            Integer thumbnailSize = call.getInt("thumbnailSize");
            if (thumbnailSize != null) {
                requireRange(thumbnailSize, MIN_THUMB, MAX_THUMB, "thumbnailSize");
            }
            List<MediaQueries.ImageRow> rows = MediaQueries.images(
                getContext().getContentResolver(),
                call.getString("albumId"),
                offset,
                limit
            );
            boolean hasMore = rows.size() > limit;
            List<MediaQueries.ImageRow> page = hasMore ? rows.subList(0, limit) : rows;
            List<String> thumbnails = thumbnailSize == null ? null : thumbnailsFor(page, thumbnailSize);
            JSArray images = new JSArray();
            for (int index = 0; index < page.size(); index++) {
                images.put(toJson(page.get(index), thumbnails == null ? null : thumbnails.get(index)));
            }
            JSObject result = new JSObject();
            result.put("images", images);
            result.put("hasMore", hasMore);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getThumbnail(PluginCall call) {
        runReading(call, () -> {
            long id = requireId(call);
            int size = requireRange(call.getInt("size", 0), MIN_THUMB, MAX_THUMB, "size");
            int orientation = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? 0
                : MediaQueries.image(getContext().getContentResolver(), id).orientation;
            File file = MediaFiles.thumbnail(getContext(), id, orientation, size);
            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getOriginal(PluginCall call) {
        runReading(call, () -> {
            long id = requireId(call);
            MediaQueries.ImageRow row = MediaQueries.image(getContext().getContentResolver(), id);
            File file = MediaFiles.copyOriginal(getContext(), id, row.mimeType);
            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            result.put("mimeType", row.mimeType);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (MediaSaver.needsWritePermission() && getPermissionState(ALIAS_LEGACY_WRITE) != PermissionState.GRANTED) {
            requestPermissionForAlias(ALIAS_LEGACY_WRITE, call, "writePermissionCallback");
            return;
        }
        run(call, () -> save(call));
    }

    /**
     * Opens this app's system settings page, the only way back from a permanent photo-permission
     * denial. The picker re-reads the permission when the app returns to the foreground.
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null)
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("App settings could not be opened", MediaException.IO_ERROR, e);
        }
    }

    @PluginMethod
    public void deleteCached(PluginCall call) {
        run(call, () -> {
            File file = MediaFiles.requireCacheFile(getContext(), call.getString("path"));
            if (file.isFile()) {
                MediaFiles.deleteQuietly(file);
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        work.shutdownNow();
        thumbs.shutdownNow();
        super.handleOnDestroy();
    }

    @PermissionCallback
    private void photosPermissionCallback(PluginCall call) {
        call.resolve(photosResult());
    }

    @PermissionCallback
    private void writePermissionCallback(PluginCall call) {
        if (getPermissionState(ALIAS_LEGACY_WRITE) != PermissionState.GRANTED) {
            call.reject("Storage permission denied", MediaException.PERMISSION_DENIED);
            return;
        }
        run(call, () -> save(call));
    }

    private void save(PluginCall call) throws MediaException {
        File source = MediaFiles.requireCacheFile(getContext(), call.getString("path"));
        String rawName = call.getString("fileName", "");
        String fileName = rawName == null ? "" : new File(rawName).getName();
        String mimeType = call.getString("mimeType", "");
        if (fileName.isEmpty() || fileName.startsWith(".") || mimeType == null || !mimeType.startsWith("image/")) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Invalid file name or MIME type");
        }
        JSObject result = new JSObject();
        result.put("uri", MediaSaver.save(getContext(), source, fileName, mimeType).toString());
        call.resolve(result);
    }

    private List<String> thumbnailsFor(List<MediaQueries.ImageRow> page, int size) {
        List<Future<File>> pending = new ArrayList<>(page.size());
        for (MediaQueries.ImageRow row : page) {
            pending.add(thumbs.submit(() -> MediaFiles.thumbnail(getContext(), row.id, row.orientation, size)));
        }
        List<String> paths = new ArrayList<>(page.size());
        for (Future<File> future : pending) {
            try {
                paths.add(future.get().getAbsolutePath());
            } catch (ExecutionException e) {
                Logger.debug(TAG, "Thumbnail skipped: " + e.getCause());
                paths.add(null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                paths.add(null);
            }
        }
        return paths;
    }

    private JSObject toJson(MediaQueries.ImageRow row, String thumbnailPath) {
        JSObject image = new JSObject();
        image.put("id", Long.toString(row.id));
        image.put("width", row.width);
        image.put("height", row.height);
        image.put("takenAt", Instant.ofEpochMilli(row.takenAtMillis).toString());
        image.put("mimeType", row.mimeType);
        image.put("thumbnailPath", thumbnailPath);
        return image;
    }

    private JSObject photosResult() {
        JSObject result = new JSObject();
        result.put("photos", PhotoPermission.state(this));
        return result;
    }

    /** Library reads need 'granted' or 'limited'; otherwise MediaStore silently returns nothing. */
    private void runReading(PluginCall call, Task task) {
        String state = PhotoPermission.state(this);
        if (!"granted".equals(state) && !"limited".equals(state)) {
            call.reject("Photo library permission not granted", MediaException.PERMISSION_DENIED);
            return;
        }
        run(call, task);
    }

    private void run(PluginCall call, Task task) {
        work.execute(() -> {
            try {
                task.run();
            } catch (MediaException e) {
                Logger.debug(TAG, e.getCode() + ": " + e.getCause());
                call.reject(e.getMessage(), e.getCode());
            } catch (SecurityException e) {
                Logger.debug(TAG, "Security: " + e);
                call.reject("Photo library permission not granted", MediaException.PERMISSION_DENIED);
            } catch (RuntimeException e) {
                Logger.error(TAG, "Unexpected media failure", null);
                Logger.debug(TAG, e.toString());
                call.reject("Unexpected media failure", MediaException.IO_ERROR);
            }
        });
    }

    private static long requireId(PluginCall call) throws MediaException {
        String id = call.getString("id", "");
        try {
            return Long.parseLong(id == null ? "" : id);
        } catch (NumberFormatException e) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Invalid image id");
        }
    }

    private static int requireRange(Integer value, int min, int max, String name) throws MediaException {
        if (value == null || value < min || value > max) {
            throw new MediaException(MediaException.INVALID_ARGUMENT, "Invalid " + name);
        }
        return value;
    }
}
