const FONT_SIZE_RATIO = 0.03;
const MIN_FONT_SIZE = 12;

/** Draws `text` small and semi-transparent in the bottom-end corner of the exported pixels. */
export async function drawWatermark(canvas: HTMLCanvasElement, text: string): Promise<void> {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('2D canvas context unavailable');
  }
  const { width, height } = canvas;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.round(Math.min(width, height) * FONT_SIZE_RATIO));
  const font = `500 ${String(fontSize)}px Roboto, sans-serif`;
  try {
    // Self-hosted Roboto may not be loaded yet (font-display: swap); canvas does not wait.
    await document.fonts.load(font, text);
  } catch {
    // Falls back to the system sans-serif.
  }
  const margin = Math.round(fontSize * 0.9);
  context.save();
  context.font = font;
  // The watermark text is English, so "end" is the right-hand edge.
  context.direction = 'ltr';
  context.textAlign = 'end';
  context.textBaseline = 'alphabetic';
  context.fillStyle = 'rgba(255, 255, 255, 0.7)';
  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = Math.max(1, fontSize * 0.25);
  context.fillText(text, width - margin, height - margin);
  context.restore();
}
