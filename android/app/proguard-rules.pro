# R8 rules for the Glow release build (minifyEnabled + shrinkResources).
#
# What is already covered elsewhere, so it is NOT repeated here:
# - Capacitor bridge and every plugin class: @capacitor/android ships consumer rules
#   (node_modules/@capacitor/android/capacitor/proguard-rules.pro) that keep all classes extending
#   com.getcapacitor.Plugin, @CapacitorPlugin/@PluginMethod/@PermissionCallback/@ActivityCallback
#   members and the annotation types. That covers app, camera, filesystem, share, preferences,
#   status-bar, splash-screen, haptics, network, keyboard, admob, media and native-purchases.
# - The JS bridge (@JavascriptInterface methods): kept by AGP's proguard-android-optimize.txt.
# - Google Mobile Ads, UMP, Play Billing and OkHttp (media plugin): each AAR/JAR ships its own
#   consumer rules. ioncamera-android (camera plugin) only references Gson @SerializedName
#   annotations and never serializes with Gson at runtime, so its models need no keep rule.
# - Activities/services/providers referenced from merged manifests: kept by AAPT-generated rules.
# None of the plugins (checked in node_modules, Nov 2026) declare consumerProguardFiles of their own
# or rely on extra reflection that needs app-level rules. (@capacitor/keyboard's
# Class.forName("com.getcapacitor.plugin.SystemBars") targets a Plugin subclass, kept above.)
#
# Verified on a release build (2026-11-20, build/outputs/mapping/release/seeds.txt + mapping.txt):
# - GlowMediaPlugin and GlowStickersPlugin keep their names, all @PluginMethod methods (8 and 7),
#   the @PermissionCallback methods and GlowStickersPlugin.addPackResult (@ActivityCallback).
# - StickerContentProvider keeps its name (manifest). Helper classes (MediaQueries, StickerStore,
#   ...) are renamed or inlined, which is safe: they are only called directly, never reflectively.
# - AdMob, NativePurchasesPlugin, Media and the official plugins keep their entry classes.
# Re-check seeds.txt after adding a plugin or an in-repo plugin method.

# Keep line numbers in stack traces (Play Console deobfuscates them with the uploaded mapping file)
# while hiding the original source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
