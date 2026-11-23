package com.nadev.glow.stickers;

import android.content.Context;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONException;

/**
 * Sticker packs in app-internal storage: `files/sticker-packs/<packId>/` holds `pack.json` plus
 * the pack's WebP stickers and PNG tray icon. One process-wide lock serialises the plugin's writes
 * against the ContentProvider's reads (which arrive on binder threads). Blocking.
 */
final class StickerStore {

    static final String ROOT_DIR = "sticker-packs";
    private static final String MANIFEST = "pack.json";
    private static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private static final Object LOCK = new Object();

    private StickerStore() {}

    static StickerPack read(Context context, String id) throws StickerException {
        synchronized (LOCK) {
            return readUnlocked(context, StickerValidator.requirePackId(id));
        }
    }

    static StickerPack require(Context context, String id) throws StickerException {
        StickerPack pack = read(context, id);
        if (pack == null) {
            throw new StickerException(StickerException.NOT_FOUND, "Sticker pack not found");
        }
        return pack;
    }

    /** Every readable pack; a corrupt manifest hides its pack instead of failing the listing. */
    static List<StickerPack> list(Context context) {
        synchronized (LOCK) {
            List<StickerPack> packs = new ArrayList<>();
            File[] dirs = root(context).listFiles(file -> file.isDirectory() && StickerValidator.isPackId(file.getName()));
            if (dirs == null) {
                return packs;
            }
            for (File dir : dirs) {
                try {
                    StickerPack pack = readUnlocked(context, dir.getName());
                    if (pack != null) {
                        packs.add(pack);
                    }
                } catch (StickerException e) {
                    // Skipped: unreadable pack.
                }
            }
            return packs;
        }
    }

    /**
     * Replaces the pack's contents. New images are validated and copied first, then the manifest
     * is swapped atomically, then unreferenced files are deleted. On failure the old pack stays.
     */
    static StickerPack save(Context context, String id, String name, String publisher, String trayCachePath, List<StickerInput> inputs)
        throws StickerException {
        StickerValidator.requirePackId(id);
        String cleanName = StickerValidator.requireName(name);
        String cleanPublisher = StickerValidator.requirePublisher(publisher);
        StickerValidator.requireStickerCount(inputs.size());
        synchronized (LOCK) {
            StickerPack existing = readUnlocked(context, id);
            if (existing == null && list(context).size() >= StickerValidator.MAX_PACKS) {
                throw StickerException.validation(StickerException.REASON_PACK_LIMIT, "At most 10 sticker packs");
            }
            if (existing == null && trayCachePath == null) {
                throw StickerException.validation(StickerException.REASON_TRAY_MISSING, "A new pack needs a tray icon");
            }
            File dir = packDir(context, id);
            if (!dir.isDirectory() && !dir.mkdirs()) {
                throw new StickerException(StickerException.IO_ERROR, "Pack folder could not be created");
            }
            List<File> written = new ArrayList<>();
            try {
                String tray = trayCachePath == null
                    ? existing.trayFileName
                    : StickerFiles.importImage(context, dir, trayCachePath, true, written);
                List<StickerPack.Sticker> stickers = new ArrayList<>(inputs.size());
                Set<String> kept = new HashSet<>();
                for (StickerInput input : inputs) {
                    String fileName = input.cachePath != null
                        ? StickerFiles.importImage(context, dir, input.cachePath, false, written)
                        : requireExisting(existing, input.fileName);
                    if (!kept.add(fileName)) {
                        throw new StickerException(StickerException.INVALID_ARGUMENT, "Duplicate sticker");
                    }
                    stickers.add(new StickerPack.Sticker(fileName, StickerValidator.requireEmojis(input.emojis)));
                }
                StickerPack draft = new StickerPack(id, cleanName, cleanPublisher, tray, 1, stickers);
                long version = existing == null ? 1 : existing.sameImagesAs(draft) ? existing.imageDataVersion : existing.imageDataVersion + 1;
                StickerPack pack = new StickerPack(id, cleanName, cleanPublisher, tray, version, stickers);
                writeManifest(dir, pack);
                StickerFiles.deleteAllExcept(dir, pack.fileNames(MANIFEST));
                return pack;
            } catch (StickerException e) {
                for (File file : written) {
                    StickerFiles.deleteQuietly(file);
                }
                throw e;
            }
        }
    }

    static StickerPack deleteSticker(Context context, String id, int index) throws StickerException {
        synchronized (LOCK) {
            StickerPack existing = readUnlocked(context, StickerValidator.requirePackId(id));
            if (existing == null || index < 0 || index >= existing.stickers.size()) {
                throw new StickerException(StickerException.NOT_FOUND, "Sticker not found");
            }
            List<StickerPack.Sticker> stickers = new ArrayList<>(existing.stickers);
            stickers.remove(index);
            StickerPack pack = new StickerPack(id, existing.name, existing.publisher, existing.trayFileName, existing.imageDataVersion + 1, stickers);
            File dir = packDir(context, id);
            writeManifest(dir, pack);
            StickerFiles.deleteAllExcept(dir, pack.fileNames(MANIFEST));
            return pack;
        }
    }

    static void delete(Context context, String id) throws StickerException {
        synchronized (LOCK) {
            File dir = packDir(context, StickerValidator.requirePackId(id));
            if (!dir.isDirectory()) {
                throw new StickerException(StickerException.NOT_FOUND, "Sticker pack not found");
            }
            StickerFiles.deleteRecursively(dir);
        }
    }

    /**
     * The file behind a provider asset URI, or null. Only names listed in the pack's manifest are
     * served, and the canonical path must stay inside that pack's folder.
     */
    static File assetFile(Context context, String id, String fileName) {
        if (!StickerValidator.isPackId(id) || !StickerValidator.isFileName(fileName)) {
            return null;
        }
        synchronized (LOCK) {
            try {
                StickerPack pack = readUnlocked(context, id);
                if (pack == null || (!fileName.equals(pack.trayFileName) && pack.findSticker(fileName) == null)) {
                    return null;
                }
                File dir = packDir(context, id).getCanonicalFile();
                File file = new File(dir, fileName).getCanonicalFile();
                return file.getPath().startsWith(dir.getPath() + File.separator) && file.isFile() ? file : null;
            } catch (StickerException | IOException e) {
                return null;
            }
        }
    }

    static File packDir(Context context, String id) {
        return new File(root(context), id);
    }

    private static File root(Context context) {
        return new File(context.getFilesDir(), ROOT_DIR);
    }

    private static StickerPack readUnlocked(Context context, String id) throws StickerException {
        File manifest = new File(packDir(context, id), MANIFEST);
        if (!manifest.isFile()) {
            return null;
        }
        try {
            StickerPack pack = StickerPack.fromJson(StickerFiles.readText(manifest, MAX_MANIFEST_BYTES));
            if (!pack.id.equals(id)) {
                throw new StickerException(StickerException.IO_ERROR, "Pack manifest does not match its folder");
            }
            return pack;
        } catch (JSONException e) {
            throw new StickerException(StickerException.IO_ERROR, "Pack manifest is unreadable", e);
        }
    }

    private static String requireExisting(StickerPack existing, String fileName) throws StickerException {
        if (existing == null || !StickerValidator.isFileName(fileName) || existing.findSticker(fileName) == null) {
            throw new StickerException(StickerException.NOT_FOUND, "Sticker not found in pack");
        }
        return fileName;
    }

    private static void writeManifest(File dir, StickerPack pack) throws StickerException {
        StickerFiles.writeAtomically(new File(dir, MANIFEST), pack.toJsonBytes());
    }
}
