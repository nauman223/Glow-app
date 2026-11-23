import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { type CanvasSnapshot } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { ImageRegistryService } from '@core/image/image-registry.service';
import { LoggerService } from '@core/logging/logger.service';

import { loadProject, loadSummaries } from './project-reader';
import {
  deleteProjectFolder,
  loadThumbnailUrl,
  pruneProjects,
  readProjectDocument,
  toSummary,
} from './project-store';
import { captureDocument } from './project-thumbnail';
import { type ActiveProject, newActiveProject, writeProject } from './project-writer';
import {
  isProjectError,
  MAX_RECENT_PROJECTS,
  type OpenedProject,
  ProjectError,
  type ProjectListStatus,
  type ProjectSummary,
} from './project.models';

/**
 * Recent projects on device storage (see ProjectDocument for the layout). Every list, save, open
 * and delete runs in one queue, so they never interleave; a save only encodes images it has not
 * written for this project before. All failures reject with ProjectError.
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly canvas = inject(CanvasService);
  private readonly registry = inject(ImageRegistryService);
  private readonly logger = inject(LoggerService);

  private readonly recentState = signal<readonly ProjectSummary[]>([]);
  private readonly statusState = signal<ProjectListStatus>('idle');
  private active: ActiveProject | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listing: Promise<readonly ProjectSummary[]> | null = null;

  /** Newest first, at most MAX_RECENT_PROJECTS. */
  public readonly recent = this.recentState.asReadonly();
  public readonly status = this.statusState.asReadonly();

  /** Re-reads the list from storage; concurrent calls share one read. */
  public list(): Promise<readonly ProjectSummary[]> {
    this.listing ??= this.enqueue(() => this.loadList()).finally(() => {
      this.listing = null;
    });
    return this.listing;
  }

  /**
   * Saves the live canvas as project `id` (`null` creates one) and resolves its id. Resolves
   * without writing when nothing changed since the last save.
   */
  public save(id: string | null, originalSnapshot: CanvasSnapshot): Promise<string> {
    return this.enqueue(async () => {
      const project = this.activate(id);
      const captured = await captureDocument(
        this.canvas,
        (snapshot) => snapshot === project.lastSavedSnapshot,
      );
      if (captured === null) {
        return project.id;
      }
      const isNew = project.lastSavedSnapshot === null;
      const document = await writeProject(project, { ...captured, originalSnapshot }, (url) =>
        this.registry.blobFor(url),
      );
      const thumbnailUrl = Capacitor.isNativePlatform()
        ? await loadThumbnailUrl(document)
        : URL.createObjectURL(captured.thumbnail);
      this.upsert(toSummary(document, thumbnailUrl));
      if (isNew) {
        await this.enforceCap(project.id);
      }
      return project.id;
    });
  }

  /** Loads project `id` into the attached canvas (no history). */
  public open(id: string): Promise<OpenedProject> {
    return this.enqueue(async () => {
      try {
        const document = await readProjectDocument(id);
        const loaded = await loadProject(
          document,
          (blob) => this.registry.register(blob).objectUrl,
        );
        try {
          await this.canvas.restoreSnapshot(loaded.snapshot);
        } catch (error: unknown) {
          throw new ProjectError('corrupt', { cause: error });
        }
        const { name, createdAt } = document;
        const lastSavedSnapshot = this.canvas.toSnapshot();
        this.active = { id, name, createdAt, files: loaded.files, lastSavedSnapshot };
        return { id, originalSnapshot: loaded.originalSnapshot };
      } catch (error: unknown) {
        if (isProjectError(error) && error.code === 'not-found') {
          this.replaceRecent(this.recentState().filter((project) => project.id !== id));
        }
        throw error;
      }
    });
  }

  public delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.active?.id === id) {
        this.active = null;
      }
      await deleteProjectFolder(id);
      this.replaceRecent(this.recentState().filter((project) => project.id !== id));
    });
  }

  /** The editor let go of the canvas: forget its URL → file cache (those URLs get revoked). */
  public endSession(): void {
    this.active = null;
  }

  private async loadList(): Promise<readonly ProjectSummary[]> {
    this.statusState.set('loading');
    try {
      const summaries = await loadSummaries(this.logger, this.active?.id ?? null);
      this.replaceRecent(summaries);
      this.statusState.set('ready');
      return summaries;
    } catch (error: unknown) {
      this.logger.error('Recent projects could not be listed', error);
      this.statusState.set('error');
      throw new ProjectError('read-failed', { cause: error });
    }
  }

  /**
   * The project a save writes to. `null` reuses a project created this session whose first save
   * failed, so a retry never leaves a second, half-written folder behind.
   */
  private activate(id: string | null): ActiveProject {
    const active = this.active;
    if (
      active !== null &&
      (active.id === id || (id === null && active.lastSavedSnapshot === null))
    ) {
      return active;
    }
    this.active = newActiveProject(id ?? crypto.randomUUID());
    return this.active;
  }

  /** Deletes the oldest projects beyond the cap; never the one just saved. */
  private async enforceCap(keepId: string): Promise<void> {
    try {
      const removed = new Set(await pruneProjects(keepId, this.logger));
      this.replaceRecent(this.recentState().filter((project) => !removed.has(project.id)));
    } catch (error: unknown) {
      // The save itself succeeded; the cap is enforced again on the next new project.
      this.logger.warn('Could not remove old projects', error);
    }
  }

  private upsert(summary: ProjectSummary): void {
    const others = this.recentState().filter((project) => project.id !== summary.id);
    this.replaceRecent([summary, ...others].slice(0, MAX_RECENT_PROJECTS));
  }

  /** Swaps the list and revokes web thumbnail object URLs that are no longer shown. */
  private replaceRecent(next: readonly ProjectSummary[]): void {
    const kept = new Set(next.map((project) => project.thumbnailUrl));
    for (const { thumbnailUrl } of this.recentState()) {
      if (thumbnailUrl?.startsWith('blob:') === true && !kept.has(thumbnailUrl)) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    }
    this.recentState.set(next);
  }

  /** Runs `task` after every earlier one; any non-ProjectError failure becomes a typed one. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task).catch((error: unknown) => {
      throw isProjectError(error) ? error : new ProjectError('write-failed', { cause: error });
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
