# On-device AI models

Bundled with the app (offline; decided 2026-11-17) and loaded lazily by the vision worker
(`src/app/core/ai-local/worker/vision-tasks.ts`). Official Google MediaPipe models, downloaded
from the versioned (`/1/`) URLs below on 2026-11-17. MD5 is the base64 `x-goog-hash` from Google
Cloud Storage; the downloaded files match it.

| File                               | Used for (`SegmentMode` / op)               |                     Bytes | MD5 (base64)               |
| ---------------------------------- | ------------------------------------------- | ------------------------: | -------------------------- |
| `selfie_segmenter.tflite`          | `person`                                    |                   249,537 | `Oy4+HPx9MVOMrwD/Tg+6jA==` |
| `selfie_multiclass_256x256.tflite` | `person-parts`                              |                16,371,837 | `bKakDYS8uRBCChpDopUQCg==` |
| `deeplab_v3.tflite`                | `auto`                                      |                 2,780,176 | `icv1hSeLriDOdgbAfXBx3Q==` |
| `magic_touch.tflite`               | `object-at-point`, `sky`, `auto` (fallback) |                 6,227,884 | `OxKV+RVhwTlWy0IvcU4tBw==` |
| `face_landmarker.task`             | `faceLandmarks`                             |                 3,758,596 | `sOcnSQehZEQE/vZrKN1thQ==` |
| **Total**                          |                                             | **29,388,030** (28.0 MiB) |                            |

Source URLs (prefix `https://storage.googleapis.com/mediapipe-models/`):

- `image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`
- `image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite`
- `image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite`
- `interactive_segmenter/magic_touch/float32/1/magic_touch.tflite`
- `face_landmarker/face_landmarker/float16/1/face_landmarker.task`

These are the URLs listed on the MediaPipe solution pages (ai.google.dev/edge/mediapipe/solutions/
vision/image_segmenter, interactive_segmenter, face_landmarker), pinned to version `1` instead of
`latest` (same bytes today).

## Licences

Apache License 2.0. Stated as "LICENSED UNDER Apache License, Version 2.0" in the model cards
(storage.googleapis.com/mediapipe-assets/): "Model Card MediaPipe Selfie Segmentation",
"Model Card Multiclass Segmentation", "Model Card MagicTouch", "Model Card MediaPipe Face Mesh
V2" (face landmarker). DeepLab v3 has no MediaPipe model card; it is the TensorFlow Models
DeepLab v3 (Apache 2.0) trained on PASCAL VOC 2012. The Apache 2.0 notice for every model is in
Settings → Open-source licences (`public/licenses/`, regenerate with `npm run licences` when a model
is added or removed).

## Choices

- Person: the 250 KB selfie segmenter is the default (fast, good edges for portraits). The
  16 MB multiclass model is bundled only for `person-parts` (hair / body skin / face skin /
  clothes / accessories: Natural beauty, Passport, hairstyle). If no wave-2 feature uses
  `person-parts`, delete it to save 16.4 MB.
- Objects: MagicTouch (legacy `InteractiveSegmenterLegacy` API, keypoint or scribble prompt,
  6.2 MB). The newer `interactive_segmenter_v2` split model is 30.5 MB and is not used.
- Auto subject: DeepLab v3 (PASCAL VOC: 20 classes incl. person, pets, vehicles, furniture);
  when it finds nothing, MagicTouch at the image centre.
- Sky: no official MediaPipe sky model exists. `sky` = sky-like seed points in the top band,
  MagicTouch prompted with them, then a colour model of the selected sky and top-edge
  connectivity (see `sky-mask.ts`). Limits: night or very dark skies, sunsets brighter at the
  horizon than the top, white overcast skies next to white buildings, sky seen through foliage
  (holes stay unselected), photos with no sky at the top, reflections in water.

## WASM runtime

`angular.json` copies only `vision_wasm_module_internal.{js,wasm}` (14.7 MB) from
`node_modules/@mediapipe/tasks-vision/wasm` to `/mediapipe/wasm`; the worker is a module worker
and loads the ES-module variant (`FilesetResolver.forVisionTasks(path, true)`).
