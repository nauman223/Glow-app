/** Scratch rows for boxMean, sized for the largest plane. */
export interface BoxScratch {
  readonly rowSums: Float32Array;
  readonly columnSums: Float64Array;
}

/**
 * In-place box mean with a (2r + 1)² window clipped to the plane (O(1) per pixel: running sums,
 * rows then columns).
 */
export function boxMean(
  plane: Float32Array,
  width: number,
  radius: number,
  buffers: BoxScratch,
): void {
  const height = plane.length / width;
  const { rowSums, columnSums } = buffers;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x <= Math.min(radius, width - 1); x += 1) {
      sum += plane[row + x];
    }
    for (let x = 0; x < width; x += 1) {
      rowSums[row + x] = sum;
      if (x + radius + 1 < width) {
        sum += plane[row + x + radius + 1];
      }
      if (x - radius >= 0) {
        sum -= plane[row + x - radius];
      }
    }
  }
  columnSums.fill(0, 0, width);
  for (let y = 0; y <= Math.min(radius, height - 1); y += 1) {
    for (let x = 0; x < width; x += 1) {
      columnSums[x] += rowSums[y * width + x];
    }
  }
  for (let y = 0; y < height; y += 1) {
    const spanY = Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1;
    const next = y + radius + 1 < height ? (y + radius + 1) * width : -1;
    const previous = y - radius >= 0 ? (y - radius) * width : -1;
    for (let x = 0; x < width; x += 1) {
      const spanX = Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1;
      plane[y * width + x] = columnSums[x] / (spanX * spanY);
      if (next >= 0) {
        columnSums[x] += rowSums[next + x];
      }
      if (previous >= 0) {
        columnSums[x] -= rowSums[previous + x];
      }
    }
  }
}
