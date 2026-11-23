import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkDrag, type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { CanvasService } from '@core/canvas/canvas.service';
import { type BlendMode, type CanvasLayer, type LayerStep } from '@core/canvas/layers/layer.models';
import { HapticsService } from '@core/haptics/haptics.service';
import { LoggerService } from '@core/logging/logger.service';
import { Platform } from '@ionic/angular/platform';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { EditorStore } from '../../editor.store';
import { LayerPropertiesComponent } from './components/layer-properties.component';
import { LayerRowComponent } from './components/layer-row.component';
import { buildLayerRows, focusedLayerId, type LayerRow } from './layer-rows';
import { LayerThumbnailsService } from './layer-thumbnails.service';
import { LayersFeedbackService } from './layers-feedback.service';
import { LAYERS_STRINGS } from './layers.strings';
import { LayersToolService } from './layers-tool.service';

/** Same level as the bottom sheet: closes before the page navigates back. */
const DRAWER_BACK_BUTTON_PRIORITY = 90;
const ANNOUNCE = LAYERS_STRINGS.announce;

/**
 * Layers drawer (screen 10, container): a modal side drawer from the inline end with the layer
 * list (top of the list = top of the canvas, CDK drag-and-drop) and the selected layer's
 * opacity, blend mode and actions. Every change is one undoable step. The scrim, Escape and the
 * Android back button close it.
 */
@Component({
  selector: 'app-layers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkTrapFocus,
    IconComponent,
    LayerPropertiesComponent,
    LayerRowComponent,
  ],
  providers: [LayersToolService, LayerThumbnailsService, LayersFeedbackService],
  templateUrl: './layers-panel.component.html',
  styleUrl: './layers-panel.component.scss',
})
export class LayersPanelComponent {
  private readonly canvas = inject(CanvasService);
  private readonly store = inject(EditorStore);
  private readonly tool = inject(LayersToolService);
  private readonly thumbnails = inject(LayerThumbnailsService);
  private readonly feedback = inject(LayersFeedbackService);
  private readonly haptics = inject(HapticsService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = LAYERS_STRINGS;
  protected readonly layers = this.canvas.layers;
  protected readonly focusedId = focusedLayerId(this.canvas.selectedObjectId, this.layers);
  protected readonly rows = computed(() => buildLayerRows(this.layers(), this.thumbnails.urls()));
  protected readonly selected = computed(
    () => this.rows().find((row) => row.layer.id === this.focusedId()) ?? null,
  );
  protected readonly adding = this.feedback.adding;
  protected readonly announcement = this.feedback.announcement;
  private closing = false;

  /** CDK sort predicate: nothing may be dropped at (below) the base photo. */
  protected readonly canDropAt = (index: number): boolean =>
    this.layers().at(index)?.role !== 'base';

  constructor() {
    const backButton = inject(Platform).backButton.subscribeWithPriority(
      DRAWER_BACK_BUTTON_PRIORITY,
      () => {
        this.close();
      },
    );
    inject(DestroyRef).onDestroy(() => {
      backButton.unsubscribe();
    });
  }

  protected select(layer: CanvasLayer): void {
    this.focusedId.set(layer.id);
    this.feedback.run(this.tool.select(layer.id), '');
  }

  protected toggleVisible(layer: CanvasLayer, name: string): void {
    const visible = !layer.visible;
    const message = visible ? ANNOUNCE.shown(name) : ANNOUNCE.hidden(name);
    this.feedback.run(this.tool.setVisible(layer.id, visible), message);
  }

  protected toggleLock(layer: CanvasLayer, name: string): void {
    if (layer.role === 'base') {
      return;
    }
    const locked = !layer.locked;
    const message = locked ? ANNOUNCE.locked(name) : ANNOUNCE.unlocked(name);
    this.feedback.run(this.tool.setLocked(layer.id, locked), message);
  }

  protected step(layer: CanvasLayer, name: string, step: LayerStep): void {
    const position = this.layers().indexOf(layer) + (step === 'forward' ? 0 : 2);
    this.feedback.run(
      this.tool.step(layer.id, step),
      ANNOUNCE.moved(name, position, this.layers().length),
    );
  }

  protected drop(event: CdkDragDrop<readonly CanvasLayer[]>): void {
    const rows = this.rows();
    const moving = rows.at(event.previousIndex);
    const target = rows.at(event.currentIndex);
    if (moving === undefined || target === undefined || moving === target) {
      return;
    }
    this.haptics.impactLight();
    this.feedback.run(
      this.tool.moveTo(moving.layer.id, target.layer.id),
      ANNOUNCE.moved(moving.name, event.currentIndex + 1, rows.length),
    );
  }

  protected previewOpacity(percent: number): void {
    this.withSelected((row) => {
      this.tool.previewOpacity(row.layer.id, percent / 100);
    });
  }

  protected commitOpacity(percent: number): void {
    this.withSelected((row) => {
      const change = this.tool.commitOpacity(row.layer.id, percent / 100);
      this.feedback.run(change, ANNOUNCE.opacity(row.name, percent));
    });
  }

  protected setBlendMode(mode: BlendMode): void {
    this.withSelected((row) => {
      const label = this.strings.blendModes[mode];
      this.feedback.run(
        this.tool.setBlendMode(row.layer.id, mode),
        ANNOUNCE.blendMode(row.name, label),
      );
    });
  }

  protected duplicate(): void {
    this.withSelected((row) => {
      this.feedback.run(this.tool.duplicate(row.layer.id), ANNOUNCE.duplicated(row.name));
    });
  }

  protected flip(): void {
    this.withSelected((row) => {
      this.feedback.run(this.tool.flip(row.layer.id), ANNOUNCE.flipped(row.name));
    });
  }

  protected remove(): void {
    this.withSelected((row) => {
      this.feedback.runWithUndo(this.tool.remove(row.layer.id), ANNOUNCE.deleted(row.name));
    });
  }

  protected addPhoto(): void {
    this.feedback.trackAdd(() => this.tool.addPhoto());
  }

  protected close(): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.tool
      .end()
      .catch((error: unknown) => {
        this.logger.warn('Layers drawer did not settle', error);
      })
      .finally(() => {
        this.store.closeTool();
      });
  }

  private withSelected(task: (row: LayerRow) => void): void {
    const row = this.selected();
    if (row !== null) {
      task(row);
    }
  }
}
