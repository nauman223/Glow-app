import { type NormalizedLandmark } from '@mediapipe/tasks-vision';

import {
  type DetectedFace,
  FACE_LANDMARK_COUNT,
  type FaceLandmarksResult,
  type NormalizedRect,
} from '../ai-local.models';
import { type InferenceImage } from './inference-image';
import { MAX_FACES, type VisionTasks } from './vision-tasks';
import { clamp01, type VisionJob } from './worker-job';

function toFace(landmarks: readonly NormalizedLandmark[]): DetectedFace {
  const packed = new Float32Array(FACE_LANDMARK_COUNT * 3);
  let left = 1;
  let top = 1;
  let right = 0;
  let bottom = 0;
  landmarks.slice(0, FACE_LANDMARK_COUNT).forEach((landmark, index) => {
    packed[index * 3] = landmark.x;
    packed[index * 3 + 1] = landmark.y;
    packed[index * 3 + 2] = landmark.z;
    left = Math.min(left, landmark.x);
    top = Math.min(top, landmark.y);
    right = Math.max(right, landmark.x);
    bottom = Math.max(bottom, landmark.y);
  });
  const box: NormalizedRect = {
    left: clamp01(left),
    top: clamp01(top),
    right: clamp01(right),
    bottom: clamp01(bottom),
  };
  return { landmarks: packed, box };
}

/** Landmarks for up to `maxFaces` faces, largest first. */
export async function detectFaces(
  tasks: VisionTasks,
  image: InferenceImage,
  maxFaces: number,
  job: VisionJob,
): Promise<FaceLandmarksResult> {
  const started = performance.now();
  // A silently failing GPU delegate returns no faces: confirm "no face" once on the CPU (the GPU
  // is then dropped for this worker, so a real "no face" costs the retry only once).
  const { value, delegate } = await tasks.run(
    'face',
    job,
    (task) => task.detect(image.pixels).faceLandmarks.map(toFace),
    (detected) => detected.length > 0,
  );
  const area = ({ box }: DetectedFace): number => (box.right - box.left) * (box.bottom - box.top);
  const faces = [...value]
    .sort((first, second) => area(second) - area(first))
    .slice(0, Math.min(Math.max(1, Math.round(maxFaces)), MAX_FACES));
  return {
    faces,
    width: image.inputWidth,
    height: image.inputHeight,
    delegate,
    durationMs: Math.round(performance.now() - started),
  };
}
