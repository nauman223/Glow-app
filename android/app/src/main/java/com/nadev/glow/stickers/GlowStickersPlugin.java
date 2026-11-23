package com.nadev.glow.stickers;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * WhatsApp sticker packs for Glow on Android: pack storage (StickerStore), the provider WhatsApp
 * reads (StickerContentProvider) and the ENABLE_STICKER_PACK hand-off.
 *
 * Like GlowMedia, all I/O runs on this plugin's own executor instead of the shared
 * "CapacitorPlugins" thread; only the activity launch hops to the UI thread. A single worker
 * keeps writes to one pack in call order.
 */
@CapacitorPlugin(name = "GlowStickers")
public class GlowStickersPlugin extends Plugin {

    private static final String TAG = "GlowStickers";

    private final ExecutorService work = Executors.newSingleThreadExecutor();

    private interface Task {
        void run() throws StickerException;
    }

    @PluginMethod
    public void isWhatsAppAvailable(PluginCall call) {
        run(call, () -> {
            JSObject result = new JSObject();
            result.put("consumer", WhatsAppApps.isInstalled(getContext(), WhatsAppApps.CONSUMER));
            result.put("business", WhatsAppApps.isInstalled(getContext(), WhatsAppApps.BUSINESS));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void savePack(PluginCall call) {
        run(call, () -> {
            StickerPack pack = StickerStore.save(
                getContext(),
                call.getString("id"),
                call.getString("name"),
                call.getString("publisher"),
                call.getString("trayIconPath"),
                StickerJson.inputs(call.getArray("stickers"))
            );
            call.resolve(StickerJson.pack(getContext(), pack));
        });
    }

    @PluginMethod
    public void listPacks(PluginCall call) {
        run(call, () -> {
            JSArray packs = new JSArray();
            for (StickerPack pack : StickerStore.list(getContext())) {
                packs.put(StickerJson.pack(getContext(), pack));
            }
            JSObject result = new JSObject();
            result.put("packs", packs);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void deletePack(PluginCall call) {
        run(call, () -> {
            StickerStore.delete(getContext(), call.getString("id"));
            call.resolve();
        });
    }

    @PluginMethod
    public void deleteSticker(PluginCall call) {
        run(call, () -> {
            Integer index = call.getInt("index");
            if (index == null) {
                throw new StickerException(StickerException.INVALID_ARGUMENT, "Missing index");
            }
            call.resolve(StickerJson.pack(getContext(), StickerStore.deleteSticker(getContext(), call.getString("packId"), index)));
        });
    }

    @PluginMethod
    public void isPackAdded(PluginCall call) {
        run(call, () -> {
            StickerPack pack = StickerStore.require(getContext(), call.getString("id"));
            JSObject result = new JSObject();
            result.put("consumer", WhatsAppApps.hasPack(getContext(), WhatsAppApps.CONSUMER, pack.id));
            result.put("business", WhatsAppApps.hasPack(getContext(), WhatsAppApps.BUSINESS, pack.id));
            call.resolve(result);
        });
    }

    /** Mirrors the sample's AddStickerPackActivity target choice, then waits for WhatsApp's result. */
    @PluginMethod
    public void addToWhatsApp(PluginCall call) {
        run(call, () -> {
            Context context = getContext();
            StickerPack pack = StickerStore.require(context, call.getString("id"));
            if (!pack.isPublishable()) {
                throw StickerException.validation(StickerException.REASON_TOO_FEW_STICKERS, "A pack needs at least 3 stickers");
            }
            boolean consumer = WhatsAppApps.isInstalled(context, WhatsAppApps.CONSUMER);
            boolean business = WhatsAppApps.isInstalled(context, WhatsAppApps.BUSINESS);
            if (!consumer && !business) {
                throw new StickerException(StickerException.WHATSAPP_NOT_INSTALLED, "WhatsApp is not installed");
            }
            boolean consumerNeeds = consumer && !WhatsAppApps.hasPack(context, WhatsAppApps.CONSUMER, pack.id);
            boolean businessNeeds = business && !WhatsAppApps.hasPack(context, WhatsAppApps.BUSINESS, pack.id);
            if (!consumerNeeds && !businessNeeds) {
                call.resolve(addResult(true, false, true, null));
                return;
            }
            String target = consumerNeeds && businessNeeds ? null : consumerNeeds ? WhatsAppApps.CONSUMER : WhatsAppApps.BUSINESS;
            Intent intent = WhatsAppApps.enablePackIntent(context, pack, target);
            getActivity().runOnUiThread(() -> launch(call, intent));
        });
    }

    @Override
    protected void handleOnDestroy() {
        work.shutdownNow();
        super.handleOnDestroy();
    }

    @ActivityCallback
    private void addPackResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Intent data = result.getData();
        String validationError = data == null ? null : data.getStringExtra(WhatsAppApps.EXTRA_VALIDATION_ERROR);
        if (result.getResultCode() == Activity.RESULT_OK) {
            call.resolve(addResult(true, false, false, null));
        } else if (validationError != null) {
            // WhatsApp's message describes the pack format, never user content.
            Logger.debug(TAG, "WhatsApp rejected the pack: " + validationError);
            call.resolve(addResult(false, false, false, validationError));
        } else {
            call.resolve(addResult(false, true, false, null));
        }
        getBridge().releaseCall(call);
    }

    private void launch(PluginCall call, Intent intent) {
        try {
            startActivityForResult(call, intent, "addPackResult");
        } catch (ActivityNotFoundException e) {
            getBridge().releaseCall(call);
            call.reject("WhatsApp cannot add sticker packs", StickerException.WHATSAPP_NOT_INSTALLED);
        }
    }

    private static JSObject addResult(boolean added, boolean cancelled, boolean alreadyAdded, String error) {
        JSObject result = new JSObject();
        result.put("added", added);
        result.put("cancelled", cancelled);
        result.put("alreadyAdded", alreadyAdded);
        if (error != null) {
            result.put("error", error);
        }
        return result;
    }

    private void run(PluginCall call, Task task) {
        work.execute(() -> {
            try {
                task.run();
            } catch (StickerException e) {
                Logger.debug(TAG, e.getCode() + ": " + e.getMessage());
                if (e.getReason() == null) {
                    call.reject(e.getMessage(), e.getCode());
                } else {
                    JSObject data = new JSObject();
                    data.put("reason", e.getReason());
                    call.reject(e.getMessage(), e.getCode(), data);
                }
            } catch (RuntimeException e) {
                Logger.error(TAG, "Unexpected sticker failure", null);
                Logger.debug(TAG, e.toString());
                call.reject("Unexpected sticker failure", StickerException.IO_ERROR);
            }
        });
    }
}
