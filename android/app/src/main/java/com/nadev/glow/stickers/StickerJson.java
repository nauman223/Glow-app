package com.nadev.glow.stickers;

import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bridge (de)serialisation for GlowStickersPlugin. */
final class StickerJson {

    private StickerJson() {}

    /** Each entry has exactly one of `path` (a new cache file) or `fileName` (a sticker to keep). */
    static List<StickerInput> inputs(JSArray stickers) throws StickerException {
        if (stickers == null) {
            throw new StickerException(StickerException.INVALID_ARGUMENT, "Missing stickers");
        }
        List<StickerInput> inputs = new ArrayList<>(stickers.length());
        for (int index = 0; index < stickers.length(); index++) {
            JSONObject item = stickers.optJSONObject(index);
            if (item == null) {
                throw new StickerException(StickerException.INVALID_ARGUMENT, "Invalid sticker entry");
            }
            String path = optString(item, "path");
            String fileName = optString(item, "fileName");
            if ((path == null) == (fileName == null)) {
                throw new StickerException(StickerException.INVALID_ARGUMENT, "Each sticker needs a path or a fileName");
            }
            inputs.add(new StickerInput(path, fileName, emojis(item.optJSONArray("emojis"))));
        }
        return inputs;
    }

    static JSObject pack(Context context, StickerPack pack) {
        File dir = StickerStore.packDir(context, pack.id);
        JSArray stickers = new JSArray();
        for (StickerPack.Sticker sticker : pack.stickers) {
            JSObject item = new JSObject();
            item.put("fileName", sticker.fileName);
            item.put("path", new File(dir, sticker.fileName).getAbsolutePath());
            item.put("emojis", new JSArray(sticker.emojis));
            stickers.put(item);
        }
        JSObject result = new JSObject();
        result.put("id", pack.id);
        result.put("name", pack.name);
        result.put("publisher", pack.publisher);
        result.put("trayIconPath", new File(dir, pack.trayFileName).getAbsolutePath());
        result.put("imageDataVersion", pack.imageDataVersion);
        result.put("publishable", pack.isPublishable());
        result.put("stickers", stickers);
        return result;
    }

    private static List<String> emojis(JSONArray array) throws StickerException {
        List<String> emojis = new ArrayList<>();
        if (array == null) {
            return emojis;
        }
        for (int index = 0; index < array.length(); index++) {
            Object value = array.opt(index);
            if (!(value instanceof String)) {
                throw StickerException.validation(StickerException.REASON_EMOJI, "Invalid emoji");
            }
            emojis.add((String) value);
        }
        return emojis;
    }

    private static String optString(JSONObject item, String key) {
        Object value = item.opt(key);
        return value instanceof String && !((String) value).isEmpty() ? (String) value : null;
    }
}
