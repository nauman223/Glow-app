package com.nadev.glow;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.nadev.glow.media.GlowMediaPlugin;
import com.nadev.glow.stickers.GlowStickersPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-repo plugins are not auto-discovered by `cap sync`; they must be registered before the bridge starts.
        registerPlugin(GlowMediaPlugin.class);
        registerPlugin(GlowStickersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
