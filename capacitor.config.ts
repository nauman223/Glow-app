import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nadev.glow',
  appName: 'Glow',
  // Angular's application builder outputs to dist/<project>/browser, not the default `www`.
  webDir: 'dist/glow/browser',
  // WebView debugging follows the build type by default: enabled for debug builds,
  // disabled for release builds. Do not force-enable it here.
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      // index.html sets viewport-fit=cover: start edge-to-edge (Android 15+, WebView 140+) so
      // the first frame does not show the native window background (#121212) under the status
      // bar before Capacitor reads the meta tag.
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      // Hidden from main.ts after the first render to avoid a blank flash.
      launchAutoHide: false,
      backgroundColor: '#121212',
      showSpinner: false,
    },
    Keyboard: {
      // The WebView resizes so the Text tool input stays above the keyboard.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
