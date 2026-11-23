import type { filters, T2DPipelineState, TWebGLUniformLocationMap } from 'fabric';

import { type FabricModule } from '../canvas.models';

/**
 * Vignette as a small custom WebGL filter (Fabric has none). A filter, rather than a gradient
 * overlay object, darkens only the photo (never text or stickers above it), needs no extra scene
 * object to keep aligned through crops, undo and project files, and rides in the same GPU pass
 * chain and single read-back as the other Adjust filters.
 *
 * The falloff is circular in document space: `center` is in texture coordinates (0-1, y down) and
 * `scale` turns a texture-coordinate offset into a fraction of the framed area's half diagonal,
 * so the vignette stays centred on the cropped document even though the texture is the full photo.
 */
export interface VignetteParams {
  readonly centerX: number;
  readonly centerY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** 0-1: darkening at the corners. */
  readonly strength: number;
}

export const VIGNETTE_FILTER_TYPE = 'GlowVignette';

/** Falloff from this fraction of the half diagonal (untouched) to the corners (full strength). */
const INNER_RADIUS = 0.35;
const OUTER_RADIUS = 1;

const FRAGMENT_SOURCE = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uCenter;
  uniform vec2 uScale;
  uniform float uStrength;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float distance = length((vTexCoord - uCenter) * uScale);
    color.rgb *= 1.0 - uStrength * smoothstep(${INNER_RADIUS.toFixed(2)}, ${OUTER_RADIUS.toFixed(2)}, distance);
    gl_FragColor = color;
  }
`;

type VignetteFilter = filters.BaseFilter<typeof VIGNETTE_FILTER_TYPE, VignetteParams>;
type VignetteFilterClass = new (params: VignetteParams) => VignetteFilter;

let vignetteClass: VignetteFilterClass | null = null;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Defined lazily because the Fabric module (and so BaseFilter) is only loaded with the editor. */
function defineVignetteFilter(fabric: FabricModule): VignetteFilterClass {
  class GlowVignette extends fabric.filters.BaseFilter<
    typeof VIGNETTE_FILTER_TYPE,
    VignetteParams
  > {
    public static override type = VIGNETTE_FILTER_TYPE;
    // Typed as the base's record (VignetteParams has no index signature); values are checked.
    public static override defaults: Record<string, unknown> = {
      centerX: 0.5,
      centerY: 0.5,
      scaleX: 1,
      scaleY: 1,
      strength: 0,
    } satisfies VignetteParams;
    public static override uniformLocations = ['uCenter', 'uScale', 'uStrength'];

    declare public centerX: number;
    declare public centerY: number;
    declare public scaleX: number;
    declare public scaleY: number;
    declare public strength: number;

    public override isNeutralState(): boolean {
      return this.strength === 0;
    }

    /** Canvas 2D fallback (no WebGL): same maths as the shader. */
    public override applyTo2d({ imageData }: T2DPipelineState): void {
      const { data, width, height } = imageData;
      for (let y = 0; y < height; y++) {
        const offsetY = ((y + 0.5) / height - this.centerY) * this.scaleY;
        for (let x = 0; x < width; x++) {
          const offsetX = ((x + 0.5) / width - this.centerX) * this.scaleX;
          const shade =
            1 -
            this.strength * smoothstep(INNER_RADIUS, OUTER_RADIUS, Math.hypot(offsetX, offsetY));
          const index = (y * width + x) * 4;
          data[index] *= shade;
          data[index + 1] *= shade;
          data[index + 2] *= shade;
        }
      }
    }

    public override sendUniformData(
      gl: WebGLRenderingContext,
      locations: TWebGLUniformLocationMap,
    ): void {
      gl.uniform2f(locations['uCenter'], this.centerX, this.centerY);
      gl.uniform2f(locations['uScale'], this.scaleX, this.scaleY);
      gl.uniform1f(locations['uStrength'], this.strength);
    }

    protected override getFragmentSource(): string {
      return FRAGMENT_SOURCE;
    }
  }
  // Registered so Fabric can revive it if a filter instance is ever deserialized (e.g. clone()).
  fabric.classRegistry.setClass(GlowVignette);
  return GlowVignette;
}

export function createVignetteFilter(
  fabric: FabricModule,
  params: VignetteParams,
): filters.BaseFilter<string> {
  vignetteClass ??= defineVignetteFilter(fabric);
  return new vignetteClass(params);
}
