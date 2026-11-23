import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HistoryService } from '@core/history/history.service';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { AppLifecycleService } from '@core/platform/app-lifecycle.service';
import { isProjectError } from '@core/project/project.models';
import { ProjectService } from '@core/project/project.service';
import { PROJECT_SAVE_ERROR_MESSAGES } from '@core/project/project.strings';

import { EditorStore } from './editor.store';

/** Quiet time after the last history change before the project is saved. */
const AUTOSAVE_DELAY_MS = 2_000;

/**
 * Saves the open document to Recent projects: ~2 s after the history last changed (record,
 * undo, redo, reset), immediately when the app goes to the background, and before the editor's
 * canvas is released. A new photo becomes a project on its first edit, never just by being
 * opened. Saves never overlap and never block the UI. Provided by EditorPage; independent of
 * Export's "saved" state (HistoryService.isDirty / markSaved).
 */
@Injectable()
export class EditorAutosaveService {
  private readonly history = inject(HistoryService);
  private readonly projects = inject(ProjectService);
  private readonly store = inject(EditorStore);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  private readonly failedState = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private changed = false;
  private closed = false;
  private saving: Promise<void> | null = null;
  private errorShown = false;

  /** The last save attempt failed: edits since the last good save exist only in memory. */
  public readonly failed = this.failedState.asReadonly();

  constructor() {
    let baseline = true;
    effect(() => {
      // checkpoint() reads the history stack and pointer, so this runs on every change.
      this.history.checkpoint();
      if (this.store.status() !== 'ready') {
        baseline = true;
        return;
      }
      if (baseline) {
        // The first run after the document opened is its starting state, not an edit.
        baseline = false;
        return;
      }
      untracked(() => {
        this.changed = true;
        this.schedule();
      });
    });
    const unregister = inject(AppLifecycleService).registerBackgroundTask(() => this.flush());
    inject(DestroyRef).onDestroy(() => {
      unregister();
      this.close();
    });
  }

  /**
   * Saves now if anything changed since the last save; resolves once nothing is pending. Calls
   * made while a save runs wait for it, then save again only if more changes arrived.
   */
  public async flush(): Promise<void> {
    this.cancelTimer();
    while (this.saving !== null) {
      await this.saving;
    }
    if (!this.changed || this.closed) {
      return;
    }
    this.saving = this.save().finally(() => {
      this.saving = null;
    });
    await this.saving;
  }

  /** The session released the canvas: never save again (the canvas may hold another document). */
  public close(): void {
    this.closed = true;
    this.cancelTimer();
  }

  private schedule(): void {
    this.cancelTimer();
    if (this.closed) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      // A tool panel may show an un-applied preview; wait until it is applied or cancelled.
      if (this.store.panelOpen()) {
        this.schedule();
      } else {
        void this.flush();
      }
    }, AUTOSAVE_DELAY_MS);
  }

  private async save(): Promise<void> {
    const original = this.store.originalSnapshot();
    if (original === null || this.store.status() !== 'ready') {
      return;
    }
    // Cleared first: a change made while this save runs schedules the next one.
    this.changed = false;
    try {
      const id = await this.projects.save(this.store.projectId(), original);
      this.store.setProjectId(id);
      this.failedState.set(false);
    } catch (error: unknown) {
      // Retried on the next change, background event or leave.
      this.changed = true;
      this.failedState.set(true);
      this.report(error);
    }
  }

  private report(error: unknown): void {
    this.logger.error('Project autosave failed', error);
    if (this.errorShown) {
      return;
    }
    this.errorShown = true;
    const full = isProjectError(error) && error.code === 'storage-full';
    this.toasts.show(
      full ? PROJECT_SAVE_ERROR_MESSAGES.storageFull : PROJECT_SAVE_ERROR_MESSAGES.failed,
      { variant: 'warning' },
    );
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
