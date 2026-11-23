package com.nadev.glow.stickers;

import java.util.List;

/** A sticker for StickerStore.save: a new file from the app cache (`cachePath`) or an existing `fileName`. */
final class StickerInput {

    final String cachePath;
    final String fileName;
    final List<String> emojis;

    StickerInput(String cachePath, String fileName, List<String> emojis) {
        this.cachePath = cachePath;
        this.fileName = fileName;
        this.emojis = emojis;
    }
}
