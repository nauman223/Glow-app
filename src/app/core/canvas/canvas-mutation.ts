import { type CanvasMutation, type CanvasSnapshot } from './canvas.models';
import { type CanvasSession } from './canvas-session';

export interface MutationResult {
  readonly before: CanvasSnapshot;
  readonly after: CanvasSnapshot;
}

/**
 * Runs `mutate` from `recorded` (the last recorded state, so an un-recorded preview becomes part
 * of this step). On failure the recorded state is restored and the error rethrown.
 */
export async function runMutation(
  session: CanvasSession,
  recorded: CanvasSnapshot | null,
  mutate: CanvasMutation,
): Promise<MutationResult> {
  const before = recorded ?? session.serialize();
  try {
    await mutate(session.context());
  } catch (error: unknown) {
    await session.restore(before);
    throw error;
  }
  return { before, after: session.serialize() };
}
