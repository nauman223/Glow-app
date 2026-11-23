import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { type CanvasSnapshot } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { createSnapshotCommand } from '@core/canvas/reversible-command';
import { HapticsService } from '@core/haptics/haptics.service';
import { HistoryService } from '@core/history/history.service';

import { EDITOR_STRINGS } from './editor.strings';
import { type EditorToolId, findEditorTool } from './tools.config';

export type EditorStatus = 'loading' | 'ready' | 'error';

/**
 * Tools whose panel is a full-height side drawer over the whole page (Layers board), instead of
 * a docked bottom sheet: the main top bar and toolbar stay in place under its scrim.
 */
const DRAWER_TOOLS: readonly EditorToolId[] = ['layers'];

/**
 * Editor page state. Provided by EditorPage, so it lives exactly as long as one editing
 * session. Canvas and history state are read straight from their core services (single
 * source of truth); this store adds the UI state around them.
 */
@Injectable()
export class EditorStore {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly haptics = inject(HapticsService);

  private readonly statusState = signal<EditorStatus>('loading');
  private readonly activeToolIdState = signal<EditorToolId | null>(null);
  private readonly announcementState = signal('');
  private readonly projectIdState = signal<string | null>(null);
  private readonly originalState = signal<CanvasSnapshot | null>(null);
  /** A reopened project already differs from its original (projects exist only after an edit). */
  private readonly openedEditedState = signal(false);

  constructor() {
    // Tapping a text object with no panel open reopens the Text tool for it (the Text tool
    // edits the selected text). Keyed on the selected id, so closing the panel while the text
    // stays selected does not immediately reopen it.
    effect(() => {
      const selectedId = this.canvas.selectedObjectId();
      const role = this.canvas.selectedObjectRole();
      untracked(() => {
        if (selectedId !== null && role === 'text' && this.activeToolIdState() === null) {
          this.openTool('text');
        }
      });
    });
  }

  public readonly status = this.statusState.asReadonly();
  public readonly activeToolId = this.activeToolIdState.asReadonly();
  public readonly activeTool = computed(() => findEditorTool(this.activeToolIdState()));
  /** A tool panel (bottom sheet) is open: the toolbar and main top-bar actions are hidden. */
  public readonly panelOpen = computed(() => this.activeToolIdState() !== null);
  /** The open panel is a side drawer (see DRAWER_TOOLS), rendered over the whole page. */
  public readonly drawerOpen = computed(() => {
    const id = this.activeToolIdState();
    return id !== null && DRAWER_TOOLS.includes(id);
  });
  /** Count on the top bar's Layers button (layers listed in the drawer). */
  public readonly layerCount = computed(() => this.canvas.layers().length);
  public readonly selectedLayerId = this.canvas.selectedObjectId;
  public readonly canUndo = this.history.canUndo;
  public readonly canRedo = this.history.canRedo;
  public readonly isDirty = this.history.isDirty;
  public readonly undoLabel = computed(() => {
    const label = this.history.undoLabel();
    return label === null ? EDITOR_STRINGS.undo : EDITOR_STRINGS.undoWithLabel(label);
  });
  public readonly redoLabel = computed(() => {
    const label = this.history.redoLabel();
    return label === null ? EDITOR_STRINGS.redo : EDITOR_STRINGS.redoWithLabel(label);
  });
  /** Polite live-region text for results that are otherwise only visible on the canvas. */
  public readonly announcement = this.announcementState.asReadonly();
  /** Recent-projects id of this document; `null` until its first autosave. */
  public readonly projectId = this.projectIdState.asReadonly();
  /** State when the photo was first opened (Reset target); set once the document is ready. */
  public readonly originalSnapshot = this.originalState.asReadonly();
  public readonly canReset = computed(
    () =>
      this.statusState() === 'ready' &&
      this.originalState() !== null &&
      (this.history.canUndo() || this.openedEditedState()),
  );

  /** The document is on the canvas: remember where Reset goes back to. */
  public documentOpened(original: CanvasSnapshot, projectId: string | null): void {
    this.originalState.set(original);
    // Reset can restore it long after its history entries are gone: keep its images alive.
    this.canvas.retainImages(original);
    this.projectIdState.set(projectId);
    this.openedEditedState.set(projectId !== null);
    this.statusState.set('ready');
  }

  public setProjectId(id: string): void {
    this.projectIdState.set(id);
  }

  public setStatus(status: EditorStatus): void {
    this.statusState.set(status);
  }

  public openTool(id: EditorToolId): void {
    if (this.statusState() === 'ready') {
      this.activeToolIdState.set(id);
    }
  }

  public closeTool(): void {
    this.activeToolIdState.set(null);
  }

  public async undo(): Promise<void> {
    const label = this.history.undoLabel();
    if (await this.history.undo()) {
      this.haptics.impactLight();
      this.announce(label ? EDITOR_STRINGS.undone(label) : '');
    }
  }

  public async redo(): Promise<void> {
    const label = this.history.redoLabel();
    if (await this.history.redo()) {
      this.haptics.impactLight();
      this.announce(label ? EDITOR_STRINGS.redone(label) : '');
    }
  }

  /**
   * Restores the original state as ONE recorded command, so Reset itself can be undone.
   * Resolves false when there is nothing to reset.
   */
  public async reset(): Promise<boolean> {
    const original = this.originalState();
    if (original === null || this.statusState() !== 'ready') {
      return false;
    }
    // Read inside the canvas queue, after any command (gesture, undo) still being applied.
    const before = await this.canvas.withCanvas(() => this.canvas.toSnapshot());
    if (before === original) {
      this.announce(EDITOR_STRINGS.nothingToReset);
      return false;
    }
    await this.canvas.restoreSnapshot(original);
    this.history.record(
      createSnapshotCommand(EDITOR_STRINGS.resetHistoryLabel, before, original, (snapshot) =>
        this.canvas.restoreSnapshot(snapshot),
      ),
    );
    this.haptics.impactLight();
    this.announce(EDITOR_STRINGS.resetDone);
    return true;
  }

  private announce(message: string): void {
    this.announcementState.set(message);
  }
}
