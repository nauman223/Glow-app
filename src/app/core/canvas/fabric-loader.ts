import { type FabricModule } from './canvas.models';

let fabricLoading: Promise<FabricModule> | null = null;

/** Imports Fabric on first use (never in the initial bundle) and reuses the module after. */
export function loadFabric(): Promise<FabricModule> {
  fabricLoading ??= import('fabric');
  return fabricLoading;
}
