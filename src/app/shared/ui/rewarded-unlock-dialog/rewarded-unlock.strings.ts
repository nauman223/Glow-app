export const REWARDED_UNLOCK_STRINGS = {
  titles: {
    pack: 'Unlock Pro pack',
    hdCutout: 'Get an HD cutout',
    upscale: 'Upscale 4×',
    credit: 'Get an AI credit',
  },
  bodies: {
    pack: (hours: number): string =>
      `Watch a short video to unlock this pack for ${hours.toString()} hours.`,
    hdCutout: 'Watch a short video to get an HD cutout of this photo.',
    upscale: 'Watch a short video to upscale this photo 4×, once.',
    credit: 'Watch a short video to get +1 AI credit.',
  },
  creditsEarned: (earned: number, cap: number): string =>
    `${earned.toString()} of ${cap.toString()} free credits earned today`,
  status: {
    watching: 'Loading the video…',
    granting: 'Unlocking…',
    unavailable: 'No video is available right now. Try again in a moment, or go Pro.',
    offline: 'You are offline. Connect to the internet to watch a video, or go Pro.',
    adClosed: 'The video was closed before the end, so nothing was unlocked.',
    failed: 'The video could not play. Try again later, or go Pro.',
    capReached: 'You have earned all of today’s free credits. Come back tomorrow, or go Pro.',
  },
  watchAd: 'Watch ad',
  tryAgain: 'Try again',
  goPro: 'Go Pro – remove ads',
  notNow: 'Not now',
} as const;
