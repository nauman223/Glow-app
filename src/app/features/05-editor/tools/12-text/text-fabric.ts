import { type CanvasContext, type FabricModule } from '@core/canvas/canvas.models';
import {
  findObjectById,
  getObjectId,
  OBJECT_ID_PROPERTY,
  setObjectRole,
} from '@core/canvas/canvas-objects';
import type { Canvas, FabricObject, Shadow, Textbox } from 'fabric';

import { findTextFont, findTextFontByFamily } from './text-fonts';
import {
  baseFontSize,
  clampToRange,
  DEFAULT_TEXT_STYLE,
  TEXT_RANGES,
  type TextAlignment,
  type TextStyle,
} from './text.models';

/** New text boxes wrap at this fraction of the document width. */
const TEXT_WIDTH_RATIO = 0.8;

export interface TextTarget {
  readonly id: string;
  readonly text: string;
  readonly style: TextStyle;
}

/**
 * Text is edited only through the panel input: Fabric's on-canvas editing (a hidden textarea)
 * is unreliable with Android keyboards. `editable` is not serialized, so it is set as the class
 * default (idempotent), which also covers text restored by undo/redo.
 */
export function ensureTextDefaults(fabric: FabricModule): void {
  fabric.IText.ownDefaults.editable = false;
}

export function isTextbox(
  fabric: FabricModule,
  object: FabricObject | undefined,
): object is Textbox {
  return object instanceof fabric.Textbox;
}

export function findTextbox(context: CanvasContext, id: string): Textbox | null {
  const object = findObjectById(context.canvas, id);
  return isTextbox(context.fabric, object) ? object : null;
}

/** The selected text box, if any, as a panel target. */
export function readSelectedText(context: CanvasContext): TextTarget | null {
  const active = context.canvas.getActiveObject();
  const id = active === undefined ? null : getObjectId(active);
  if (id === null || !isTextbox(context.fabric, active)) {
    return null;
  }
  return { id, text: active.text, style: readTextStyle(context, active) };
}

/** Adds a selected, word-wrapping text box centred on the document. */
export function addTextbox(context: CanvasContext, target: TextTarget): void {
  const { canvas, fabric, documentSize } = context;
  const textbox = new fabric.Textbox(target.text, {
    width: documentSize.width * TEXT_WIDTH_RATIO,
    left: documentSize.width / 2,
    top: documentSize.height / 2,
    lockScalingFlip: true,
  });
  textbox.set(OBJECT_ID_PROPERTY, target.id);
  setObjectRole(textbox, 'text');
  applyTextStyle(context, textbox, target.style);
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
}

/** Writes the target's text and style to its text box (no-op if it no longer exists). */
export function applyTextTarget(context: CanvasContext, target: TextTarget): void {
  const textbox = findTextbox(context, target.id);
  if (textbox === null) {
    return;
  }
  if (textbox.text !== target.text) {
    textbox.set('text', target.text);
  }
  applyTextStyle(context, textbox, target.style);
}

export function applyTextStyle(context: CanvasContext, textbox: Textbox, style: TextStyle): void {
  const { fabric } = context;
  const font = findTextFont(style.fontId);
  const fontSize = (baseFontSize(context.documentSize) * style.size) / 100;
  const outline = (fontSize * style.outline) / 100;
  textbox.set({
    fontFamily: font.family,
    fontWeight: style.bold ? font.boldWeight : font.regularWeight,
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: style.align,
    charSpacing: style.letterSpacing,
    fontSize,
    opacity: style.opacity / 100,
    fill: style.fill,
    stroke: outline > 0 ? style.outlineColour : null,
    strokeWidth: outline,
    strokeLineJoin: 'round',
    // Outline behind the fill, so it does not eat into the glyphs.
    paintFirst: 'stroke',
    backgroundColor: style.background ? style.backgroundColour : '',
    shadow: createShadow(fabric, style, fontSize),
  });
  textbox.setCoords();
}

/** Reads a text box back into panel units, clamped to the panel ranges. */
export function readTextStyle(context: CanvasContext, textbox: Textbox): TextStyle {
  const { fabric } = context;
  const fontSize = textbox.fontSize > 0 ? textbox.fontSize : 1;
  const font = findTextFontByFamily(textbox.fontFamily);
  const shadow = textbox.shadow;
  const shadowColour = shadow === null ? null : new fabric.Color(shadow.color);
  const outlineColour = toHex(fabric, textbox.stroke);
  const backgroundColour = toHex(fabric, textbox.backgroundColor);
  const relative = (value: number): number => (value / fontSize) * 100;
  return {
    fontId: font.id,
    bold: Number(textbox.fontWeight) > font.regularWeight || textbox.fontWeight === 'bold',
    italic: textbox.fontStyle === 'italic',
    align: toAlignment(textbox.textAlign),
    letterSpacing: clampToRange(textbox.charSpacing, TEXT_RANGES.letterSpacing),
    size: clampToRange((fontSize / baseFontSize(context.documentSize)) * 100, TEXT_RANGES.size),
    opacity: clampToRange(textbox.opacity * 100, TEXT_RANGES.opacity),
    outline:
      outlineColour === null ? 0 : clampToRange(relative(textbox.strokeWidth), TEXT_RANGES.outline),
    background: backgroundColour !== null,
    fill: toHex(fabric, textbox.fill) ?? DEFAULT_TEXT_STYLE.fill,
    outlineColour: outlineColour ?? DEFAULT_TEXT_STYLE.outlineColour,
    backgroundColour: backgroundColour ?? DEFAULT_TEXT_STYLE.backgroundColour,
    shadowColour:
      shadowColour === null ? DEFAULT_TEXT_STYLE.shadowColour : `#${shadowColour.toHex()}`,
    shadowBlur: shadow === null ? 0 : clampToRange(relative(shadow.blur), TEXT_RANGES.shadowBlur),
    shadowDistance:
      shadow === null ? 0 : clampToRange(relative(shadow.offsetY), TEXT_RANGES.shadowDistance),
    shadowOpacity:
      shadowColour === null
        ? 0
        : clampToRange(shadowColour.getAlpha() * 100, TEXT_RANGES.shadowOpacity),
  };
}

/**
 * A font finished loading: drop Fabric's cached glyph widths for it and re-measure every text
 * box that uses it (wrapping and bounds were computed with the fallback font).
 */
export function refreshFontMetrics(canvas: Canvas, fabric: FabricModule, family: string): void {
  fabric.cache.clearFontCache(family);
  for (const object of canvas.getObjects()) {
    if (isTextbox(fabric, object) && object.fontFamily === family) {
      object.initDimensions();
      object.setCoords();
      object.dirty = true;
    }
  }
}

function createShadow(fabric: FabricModule, style: TextStyle, fontSize: number): Shadow | null {
  const blur = (fontSize * style.shadowBlur) / 100;
  const offsetY = (fontSize * style.shadowDistance) / 100;
  if (style.shadowOpacity === 0 || (blur === 0 && offsetY === 0)) {
    return null;
  }
  const color = new fabric.Color(style.shadowColour).setAlpha(style.shadowOpacity / 100).toRgba();
  return new fabric.Shadow({ color, blur, offsetX: 0, offsetY });
}

function toAlignment(value: string): TextAlignment {
  return value === 'left' || value === 'right' ? value : 'center';
}

/** `#RRGGBB` for a CSS colour string; `null` for none, transparent or a non-string fill. */
function toHex(fabric: FabricModule, value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value === 'transparent') {
    return null;
  }
  return `#${new fabric.Color(value).toHex().toUpperCase()}`;
}
