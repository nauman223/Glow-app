import { type AiCloudErrorCode } from '@core/ai-cloud/ai-cloud.errors';
import { type CloudJobPhase } from '@core/ai-cloud/ai-cloud.models';

export const CLOUD_AI_STRINGS = {
  apply: 'Apply',
  /** Guard toast when the remote flag turned the feature off. */
  disabled: 'This AI feature isn’t available right now. Please try again later.',
  progress: {
    title: 'Working on your photo',
    phases: {
      encoding: 'Preparing your photo…',
      uploading: 'Uploading…',
      queued: 'Queued…',
      running: 'Processing…',
      downloading: 'Downloading the result…',
    } satisfies Readonly<Record<CloudJobPhase, string>>,
    usually: 'Usually 10–20 s',
    elapsed: (time: string): string => `Elapsed ${time}`,
    cancel: 'Cancel',
  },
  notice: {
    title: 'Processed in the cloud',
    body: 'Your photo is uploaded securely to process it and deleted afterwards.',
    detail: 'Glow only uploads when you tap the button. Your photos are never used for training.',
    continue: 'Continue',
    cancel: 'Cancel',
  },
  credits: {
    pro: 'Pro',
    count: (balance: number): string =>
      balance === 1 ? '1 credit' : `${balance.toString()} credits`,
    label: (balance: number): string =>
      `${balance.toString()} AI ${balance === 1 ? 'credit' : 'credits'}. Get more`,
    proLabel: 'Glow Pro: unlimited AI',
  },
  errors: {
    title: 'Something went wrong',
    retry: 'Try again',
    titles: {
      offline: 'You’re offline',
      unavailable: 'Cloud AI isn’t available right now',
      'rate-limited': 'Too many requests',
      quota: 'No credits left',
      rejected: 'This photo can’t be processed',
      'too-large': 'This photo is too large',
      failed: 'The AI couldn’t finish',
      timeout: 'This is taking too long',
      cancelled: 'Cancelled',
      'invalid-result': 'The result couldn’t be read',
    } satisfies Readonly<Record<AiCloudErrorCode, string>>,
    messages: {
      offline: 'Cloud AI needs an internet connection. Connect and try again.',
      unavailable: 'Please try again in a little while. You haven’t been charged a credit.',
      'rate-limited': 'Please wait a moment and try again.',
      quota: 'You’ve used today’s AI allowance. Try again tomorrow.',
      rejected: 'Try another photo or different options.',
      'too-large': 'Try a smaller photo.',
      failed: 'Please try again. You haven’t been charged a credit.',
      timeout: 'The server took too long. Please try again; you haven’t been charged a credit.',
      cancelled: 'Cancelled.',
      'invalid-result': 'Please try again. You haven’t been charged a credit.',
    } satisfies Readonly<Record<AiCloudErrorCode, string>>,
    retryAfter: (seconds: number): string => `Please wait ${seconds.toString()} s and try again.`,
    fairUseTitle: 'Daily limit reached',
    fairUseMessage: 'You’ve reached today’s fair-use limit for AI. It resets tomorrow.',
    noFaceTitle: 'No face found',
    noFaceMessage: 'Try a photo where a face is clearly visible.',
    sourceTitle: 'Your photo could not be prepared',
    sourceMessage: 'Go back to the editor and try again.',
    applyMessage: 'The result could not be added to your photo. Please try again.',
  },
} as const;
