package com.nadev.glow.media;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.BaseColumns;
import android.provider.MediaStore;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Read-only MediaStore.Images queries. Every method blocks; call them off the main thread. */
final class MediaQueries {

    static final Uri IMAGES_URI = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;

    private static final String COL_ID = BaseColumns._ID;
    private static final String COL_WIDTH = MediaStore.MediaColumns.WIDTH;
    private static final String COL_HEIGHT = MediaStore.MediaColumns.HEIGHT;
    private static final String COL_ORIENTATION = MediaStore.Images.ImageColumns.ORIENTATION;
    private static final String COL_DATE_TAKEN = MediaStore.Images.ImageColumns.DATE_TAKEN;
    private static final String COL_DATE_ADDED = MediaStore.MediaColumns.DATE_ADDED;
    private static final String COL_MIME = MediaStore.MediaColumns.MIME_TYPE;
    private static final String COL_BUCKET_ID = MediaStore.Images.ImageColumns.BUCKET_ID;
    private static final String COL_BUCKET_NAME = MediaStore.Images.ImageColumns.BUCKET_DISPLAY_NAME;

    /** Newest first; `_id` breaks ties so pages never overlap or skip rows. */
    private static final String[] SORT_COLUMNS = { COL_DATE_TAKEN, COL_DATE_ADDED, COL_ID };
    private static final String SORT_ORDER = COL_DATE_TAKEN + " DESC, " + COL_DATE_ADDED + " DESC, " + COL_ID + " DESC";

    private static final String[] IMAGE_PROJECTION = {
        COL_ID,
        COL_WIDTH,
        COL_HEIGHT,
        COL_ORIENTATION,
        COL_DATE_TAKEN,
        COL_DATE_ADDED,
        COL_MIME
    };

    private MediaQueries() {}

    static final class ImageRow {

        final long id;
        /** Display size: already swapped for 90/270 degree orientations. */
        final int width;
        final int height;
        final int orientation;
        final long takenAtMillis;
        final String mimeType;

        ImageRow(long id, int width, int height, int orientation, long takenAtMillis, String mimeType) {
            this.id = id;
            this.width = width;
            this.height = height;
            this.orientation = orientation;
            this.takenAtMillis = takenAtMillis;
            this.mimeType = mimeType;
        }
    }

    static final class AlbumRow {

        final String id;
        final String name;
        final long coverId;
        int count;

        AlbumRow(String id, String name, long coverId) {
            this.id = id;
            this.name = name;
            this.coverId = coverId;
        }
    }

    static Uri contentUri(long id) {
        return ContentUris.withAppendedId(IMAGES_URI, id);
    }

    /** One pass over bucket columns; MediaStore has no GROUP BY on API 29+. Ordered by newest photo. */
    static List<AlbumRow> albums(ContentResolver resolver) throws MediaException {
        String[] projection = { COL_ID, COL_BUCKET_ID, COL_BUCKET_NAME };
        Map<String, AlbumRow> albums = new LinkedHashMap<>();
        try (Cursor cursor = resolver.query(IMAGES_URI, projection, null, null, SORT_ORDER)) {
            if (cursor == null) {
                throw new MediaException(MediaException.IO_ERROR, "MediaStore query failed");
            }
            int idIndex = cursor.getColumnIndexOrThrow(COL_ID);
            int bucketIndex = cursor.getColumnIndexOrThrow(COL_BUCKET_ID);
            int nameIndex = cursor.getColumnIndexOrThrow(COL_BUCKET_NAME);
            while (cursor.moveToNext()) {
                if (cursor.isNull(bucketIndex)) {
                    continue;
                }
                String bucketId = cursor.getString(bucketIndex);
                AlbumRow album = albums.get(bucketId);
                if (album == null) {
                    String name = cursor.isNull(nameIndex) ? "" : cursor.getString(nameIndex);
                    album = new AlbumRow(bucketId, name, cursor.getLong(idIndex));
                    albums.put(bucketId, album);
                }
                album.count++;
            }
        }
        return new ArrayList<>(albums.values());
    }

    /** Returns up to `limit + 1` rows so the caller can tell whether another page exists. */
    static List<ImageRow> images(ContentResolver resolver, String albumId, int offset, int limit) throws MediaException {
        String selection = albumId == null ? null : COL_BUCKET_ID + " = ?";
        String[] selectionArgs = albumId == null ? null : new String[] { albumId };
        int fetch = limit + 1;
        try (Cursor cursor = query(resolver, IMAGE_PROJECTION, selection, selectionArgs, offset, fetch)) {
            if (cursor == null) {
                throw new MediaException(MediaException.IO_ERROR, "MediaStore query failed");
            }
            List<ImageRow> rows = new ArrayList<>(Math.min(fetch, cursor.getCount()));
            while (cursor.moveToNext() && rows.size() < fetch) {
                rows.add(readImage(cursor));
            }
            return rows;
        }
    }

    static ImageRow image(ContentResolver resolver, long id) throws MediaException {
        String selection = COL_ID + " = ?";
        String[] args = { Long.toString(id) };
        try (Cursor cursor = resolver.query(IMAGES_URI, IMAGE_PROJECTION, selection, args, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                throw new MediaException(MediaException.NOT_FOUND, "Image not found");
            }
            return readImage(cursor);
        }
    }

    /**
     * API 30+ rejects LIMIT/OFFSET inside the sort order, and honors the paging query args instead.
     * API 26-29 MediaProvider ignores those args, so the clause is appended to the SQL sort order.
     */
    private static Cursor query(
        ContentResolver resolver,
        String[] projection,
        String selection,
        String[] selectionArgs,
        int offset,
        int limit
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bundle args = new Bundle();
            args.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection);
            args.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, selectionArgs);
            args.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, SORT_COLUMNS);
            args.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
            args.putInt(ContentResolver.QUERY_ARG_LIMIT, limit);
            args.putInt(ContentResolver.QUERY_ARG_OFFSET, offset);
            return resolver.query(IMAGES_URI, projection, args, null);
        }
        String sortOrder = SORT_ORDER + " LIMIT " + limit + " OFFSET " + offset;
        return resolver.query(IMAGES_URI, projection, selection, selectionArgs, sortOrder);
    }

    private static ImageRow readImage(Cursor cursor) {
        long id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID));
        int width = cursor.getInt(cursor.getColumnIndexOrThrow(COL_WIDTH));
        int height = cursor.getInt(cursor.getColumnIndexOrThrow(COL_HEIGHT));
        int orientation = cursor.getInt(cursor.getColumnIndexOrThrow(COL_ORIENTATION));
        long taken = cursor.getLong(cursor.getColumnIndexOrThrow(COL_DATE_TAKEN));
        long addedSeconds = cursor.getLong(cursor.getColumnIndexOrThrow(COL_DATE_ADDED));
        int mimeIndex = cursor.getColumnIndexOrThrow(COL_MIME);
        String mime = cursor.isNull(mimeIndex) ? "image/*" : cursor.getString(mimeIndex);
        boolean quarterTurn = orientation % 180 != 0;
        long takenAt = taken > 0 ? taken : addedSeconds * 1000L;
        return new ImageRow(id, quarterTurn ? height : width, quarterTurn ? width : height, orientation, takenAt, mime);
    }
}
