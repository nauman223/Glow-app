import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import type { Canvas } from 'fabric';

import {
  type CanvasContext,
  type CanvasObjectRole,
  type CanvasSnapshot,
  type FabricModule,
  type Viewport,
} from './canvas.models';
import { clearCanvas, stableSize } from './canvas-document';
import { bindCanvasEvents, type CanvasEventHandlers } from './canvas-events';
import {
  activeObjectId,
  applyRoleBehaviour,
  configureFabric,
  findObjectById,
  fitTransform,
  getObjectRole,
  SERIALIZED_PROPERTIES,
  setObjectRole,
} from './canvas-objects';
import { isRecord, parseSnapshot, serializeSnapshot, stripDerivedState } from './canvas-snapshot';
import { rebuildAllImageEdits } from './filters/image-edits';
import { loadPreparedImage, loadStaticImage } from './image-loaders';

/**
 * One attached Fabric canvas and its document geometry. Plain class (no Angular): CanvasService
 * owns the single instance and mirrors its state into signals.
 *
 * MEMORY INVARIANT: every image object is created from a registered `blob:` object URL
 * (ImageService → ImageRegistryService), never a data URL or a canvas element. Fabric
 * serializes an image as its `src`, so each snapshot stays a few KB of JSON instead of
 * embedding megabytes of pixels (enforced in image-loaders; stickers use same-origin paths).
 */
export class CanvasSession {
  private documentSizeValue: ImageSize | null = null;
  private sourceSizeValue: ImageSize | null = null;
  private fitInset = 0;
  private readonly unbindEvents: () => void;

  constructor(
    public readonly canvas: Canvas,
    public readonly fabric: FabricModule,
    /** On-screen canvas size (CSS px); changed only through `resize()`. */
    public viewport: Viewport,
    handlers: CanvasEventHandlers,
  ) {
    this.unbindEvents = bindCanvasEvents(canvas, fabric, handlers);
  }

  public static create(
    element: HTMLCanvasElement,
    fabric: FabricModule,
    viewport: Viewport,
    handlers: CanvasEventHandlers,
  ): CanvasSession {
    configureFabric(fabric);
    const canvas = new fabric.Canvas(element, {
      ...viewport,
      enableRetinaScaling: true,
      renderOnAddRemove: false,
      preserveObjectStacking: true,
      // No rubber-band multi-select: on touch it fights with dragging objects.
      selection: false,
      stopContextMenu: true,
    });
    return new CanvasSession(canvas, fabric, viewport, handlers);
  }

  public get documentSize(): ImageSize | null {
    return this.documentSizeValue;
  }

  public get sourceSize(): ImageSize | null {
    return this.sourceSizeValue;
  }

  public get selectedObjectId(): string | null {
    return activeObjectId(this.canvas);
  }

  public get selectedObjectRole(): CanvasObjectRole | null {
    const active = this.canvas.getActiveObject();
    return active === undefined || this.selectedObjectId === null ? null : getObjectRole(active);
  }

  public context(): CanvasContext {
    const { documentSizeValue: documentSize, sourceSizeValue: sourceSize } = this;
    if (documentSize === null || sourceSize === null) {
      throw new Error('Canvas has no document');
    }
    return {
      canvas: this.canvas,
      fabric: this.fabric,
      documentSize,
      sourceSize,
      resizeDocument: (nextDocument, nextSource) => {
        this.setDocument(nextDocument, nextSource);
      },
      createImage: (image) => loadPreparedImage(this.fabric, image),
      createStaticImage: (path) => loadStaticImage(this.fabric, path),
    };
  }

  /** Replaces the whole document with `image` as the locked base layer. */
  public async startDocument(image: PreparedImage): Promise<void> {
    const base = await loadPreparedImage(this.fabric, image);
    base.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
    setObjectRole(base, 'base');
    clearCanvas(this.canvas, '');
    this.canvas.add(base);
    this.setDocument(
      { width: image.width, height: image.height },
      { width: image.sourceWidth, height: image.sourceHeight },
    );
  }

  /**
   * Replaces the whole document with an empty one of `size` filled with `background`. The fill is
   * Fabric's `backgroundColor`: serialized with every snapshot, drawn under every object (so
   * blend modes see it), clipped to the document on screen and rendered by export.
   */
  public startBlankDocument(size: ImageSize, background: string): void {
    clearCanvas(this.canvas, background);
    this.setDocument(size, size);
  }

  public serialize(): CanvasSnapshot {
    const { documentSizeValue: documentSize, sourceSizeValue: sourceSize } = this;
    const data = stripDerivedState(this.canvas.toObject(SERIALIZED_PROPERTIES));
    if (documentSize === null || sourceSize === null || !isRecord(data)) {
      throw new Error('Canvas has no document');
    }
    return serializeSnapshot({ documentSize, sourceSize, canvas: data });
  }

  /** Restores `snapshot`, keeping the previous selection when that object still exists. */
  public async restore(snapshot: CanvasSnapshot): Promise<void> {
    const content = parseSnapshot(snapshot);
    const selectedId = this.selectedObjectId;
    const previous = this.canvas.getObjects();
    await this.canvas.loadFromJSON(content.canvas);
    // loadFromJSON removes the old objects without disposing them; free their caches now.
    previous.forEach((object) => {
      object.dispose();
    });
    this.canvas.getObjects().forEach(applyRoleBehaviour);
    rebuildAllImageEdits(this.fabric, this.canvas, content.documentSize);
    this.setDocument(content.documentSize, content.sourceSize);
    const reselect = selectedId === null ? undefined : findObjectById(this.canvas, selectedId);
    // Not when that step locked or hid it.
    if (reselect?.selectable === true && reselect.visible) {
      this.canvas.setActiveObject(reselect);
    }
  }

  /** Unbinds events and disposes the canvas (Fabric also disposes every object's textures). */
  public dispose(): Promise<boolean> {
    this.unbindEvents();
    return this.canvas.dispose();
  }

  public resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.fit();
  }

  public setFitInset(inset: number): void {
    this.fitInset = inset;
    this.fit();
  }

  private setDocument(documentSize: ImageSize, sourceSize: ImageSize): void {
    // Display clip so layers outside the photo are hidden, as they are in the export.
    // excludeFromExport keeps it out of snapshots; it is rebuilt from the sizes on restore.
    this.canvas.clipPath = new this.fabric.Rect({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: documentSize.width,
      height: documentSize.height,
      excludeFromExport: true,
    });
    this.documentSizeValue = stableSize(this.documentSizeValue, documentSize);
    this.sourceSizeValue = stableSize(this.sourceSizeValue, sourceSize);
    this.fit();
  }

  private fit(): void {
    this.canvas.setDimensions(this.viewport);
    if (this.documentSizeValue !== null) {
      this.canvas.setViewportTransform(
        fitTransform(this.documentSizeValue, this.viewport, this.fitInset),
      );
    }
  }
}
