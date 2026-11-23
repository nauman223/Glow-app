package com.nadev.glow.stickers;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Immutable pack manifest, stored as `sticker-packs/<id>/pack.json`. */
final class StickerPack {

    private static final int SCHEMA_VERSION = 1;

    static final class Sticker {

        final String fileName;
        final List<String> emojis;

        Sticker(String fileName, List<String> emojis) {
            this.fileName = fileName;
            this.emojis = Collections.unmodifiableList(new ArrayList<>(emojis));
        }
    }

    final String id;
    final String name;
    final String publisher;
    final String trayFileName;
    /** WhatsApp re-fetches the images when this changes; bumped on every image change. */
    final long imageDataVersion;
    final List<Sticker> stickers;

    StickerPack(String id, String name, String publisher, String trayFileName, long imageDataVersion, List<Sticker> stickers) {
        this.id = id;
        this.name = name;
        this.publisher = publisher;
        this.trayFileName = trayFileName;
        this.imageDataVersion = imageDataVersion;
        this.stickers = Collections.unmodifiableList(new ArrayList<>(stickers));
    }

    /** True when the provider may expose the pack: WhatsApp accepts only 3-30 stickers. */
    boolean isPublishable() {
        return stickers.size() >= StickerValidator.MIN_STICKERS && stickers.size() <= StickerValidator.MAX_STICKERS;
    }

    /** Every file the pack references, plus `extra` (the manifest). */
    Set<String> fileNames(String extra) {
        Set<String> names = new HashSet<>();
        names.add(extra);
        names.add(trayFileName);
        for (Sticker sticker : stickers) {
            names.add(sticker.fileName);
        }
        return names;
    }

    Sticker findSticker(String fileName) {
        for (Sticker sticker : stickers) {
            if (sticker.fileName.equals(fileName)) {
                return sticker;
            }
        }
        return null;
    }

    /** Same image files in the same order (emoji changes do not need a new image_data_version). */
    boolean sameImagesAs(StickerPack other) {
        if (!trayFileName.equals(other.trayFileName) || stickers.size() != other.stickers.size()) {
            return false;
        }
        for (int index = 0; index < stickers.size(); index++) {
            if (!stickers.get(index).fileName.equals(other.stickers.get(index).fileName)) {
                return false;
            }
        }
        return true;
    }

    byte[] toJsonBytes() throws StickerException {
        try {
            JSONArray items = new JSONArray();
            for (Sticker sticker : stickers) {
                JSONObject item = new JSONObject();
                item.put("file", sticker.fileName);
                item.put("emojis", new JSONArray(sticker.emojis));
                items.put(item);
            }
            JSONObject root = new JSONObject();
            root.put("schema", SCHEMA_VERSION);
            root.put("id", id);
            root.put("name", name);
            root.put("publisher", publisher);
            root.put("tray", trayFileName);
            root.put("imageDataVersion", imageDataVersion);
            root.put("stickers", items);
            return root.toString().getBytes(StandardCharsets.UTF_8);
        } catch (JSONException e) {
            throw new StickerException(StickerException.IO_ERROR, "Pack manifest could not be written", e);
        }
    }

    /** Parses and re-validates every field, so a tampered or corrupt manifest is never served. */
    static StickerPack fromJson(String json) throws JSONException, StickerException {
        JSONObject root = new JSONObject(json);
        if (root.getInt("schema") != SCHEMA_VERSION) {
            throw new JSONException("Unsupported manifest schema");
        }
        JSONArray items = root.getJSONArray("stickers");
        List<Sticker> stickers = new ArrayList<>(items.length());
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.getJSONObject(index);
            JSONArray emojiArray = item.getJSONArray("emojis");
            List<String> emojis = new ArrayList<>(emojiArray.length());
            for (int emoji = 0; emoji < emojiArray.length(); emoji++) {
                emojis.add(emojiArray.getString(emoji));
            }
            stickers.add(new Sticker(StickerValidator.requireFileName(item.getString("file")), StickerValidator.requireEmojis(emojis)));
        }
        return new StickerPack(
            StickerValidator.requirePackId(root.getString("id")),
            StickerValidator.requireName(root.getString("name")),
            StickerValidator.requirePublisher(root.getString("publisher")),
            StickerValidator.requireFileName(root.getString("tray")),
            root.getLong("imageDataVersion"),
            stickers
        );
    }
}
