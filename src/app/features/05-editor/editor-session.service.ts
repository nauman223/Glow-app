import { inject, Injectable } from '@angular/core';
import { type CanvasSnapshot, type Viewport } from '@core/canvas/canvas.models';
import { CanvasService } from '@core/canvas/canvas.service';
import { collageDocumentSize } from '@core/collage/collage-geometry';
import {
  COLLAGE_ASPECTS,
  COLLAGE_DEFAULT_ASPECT,
  COLLAGE_DEFAULT_BACKGROUND,
  type CollageTemplateId,
} from '@core/collage/collage.models';
import { findCollageTemplate } from '@core/collage/collage-templates';
import { APP_ROUTES } from '@core/config/app.constants';
import {
  type CanvasHolder,
  EditorCanvasLease,
} from '@core/editor-launch/editor-canvas-lease.service';
import {
  type EditorLaunchRequest,
  EditorLaunchService,
} from '@core/editor-launch/editor-launch.service';
import { HistoryService } from '@core/history/history.service';
import { type PreparedImage } from '@core/image/image.models';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { isProjectError } from '@core/project/project.models';
import { ProjectService } from '@core/project/project.service';
import { PROJECT_OPEN_ERROR_MESSAGES } from '@core/project/project.strings';
import { NavController } from '@ionic/angular/nav-controller';

import { type StageMeasurement } from './components/editor-stage/editor-stage.component';
import { EditorAutosaveService } from './editor-autosave.service';
import { EditorFollowUpService } from './editor-follow-up.service';
import { EditorStore } from './editor.store';
import { buildCollageMutation } from './tools/11-collage/collage-layout';
import { COLLAGE_STRINGS } from './tools/11-collage/collage.strings';
import { INITIAL_COLLAGE_VIEW } from './tools/11-collage/collage-view';

/** Result of loading the claimed request into the canvas. */
interface OpenedDocument {
  readonly original: CanvasSnapshot;
  readonly projectId: string | null;
}

/**
 * Canvas lifecycle of one editor page: claim the queued photo or project, take the canvas lease,
 * attach Fabric once the stage has a size, follow stage resizes, and on leave (or when a newer
 * editor takes over) run the last autosave before the canvas is disposed, because disposing
 * revokes the blob: URLs the save reads its images from. Export pushed on top keeps the session.
 */
@Injectable()
export class EditorSessionService implements CanvasHolder {
  private readonly canvas = inject(CanvasService);
  private readonly history = inject(HistoryService);
  private readonly launch = inject(EditorLaunchService);
  private readonly lease = inject(EditorCanvasLease);
  private readonly projects = inject(ProjectService);
  private readonly autosave = inject(EditorAutosaveService);
  private readonly followUp = inject(EditorFollowUpService);
  private readonly store = inject(EditorStore);
  private readonly toasts = inject(ToastService);
  private readonly navController = inject(NavController);
  private readonly logger = inject(LoggerService);

  private request: EditorLaunchRequest | null = null;
  private starting: Promise<void> | null = null;
  private attached = false;
  private latestViewport: Viewport | null = null;

  /** Takes the photo or project queued for the editor; false when there is none. */
  public claim(): boolean {
    this.request = this.launch.consume();
    return this.request !== null;
  }

  /** True while the claimed request is a saved project (for the loading text). */
  public isProject(): boolean {
    return this.request?.kind === 'project';
  }

  public onStageMeasured({ element, viewport }: StageMeasurement): void {
    this.latestViewport = viewport;
    if (this.attached) {
      this.canvas.resize(viewport);
    } else if (this.starting === null && this.request !== null) {
      this.starting = this.start(this.request, element, viewport);
    }
  }

  /** The page is destroyed: final save, then dispose (unless a newer editor already took over). */
  public end(): void {
    if (this.starting !== null) {
      void this.lease.release(this);
    }
  }

  /** CanvasHolder: waits for an in-flight open, saves pending edits, then lets go of the canvas. */
  public async release(takenOver: boolean): Promise<void> {
    await this.starting;
    try {
      await this.autosave.flush();
    } catch (error: unknown) {
      this.logger.warn('Final project save failed', error);
    }
    this.autosave.close();
    this.projects.endSession();
    this.attached = false;
    if (!takenOver) {
      await this.canvas.dispose().catch((error: unknown) => {
        this.logger.warn('Editor canvas dispose failed', error);
      });
    }
  }

  private async start(
    request: EditorLaunchRequest,
    element: HTMLCanvasElement,
    viewport: Viewport,
  ): Promise<void> {
    try {
      await this.lease.acquire(this);
      if (!this.lease.holds(this)) {
        return;
      }
      await this.canvas.attach(element, viewport);
      if (!this.lease.holds(this)) {
        return;
      }
      this.attached = true;
      // The stage may have resized while Fabric was loading.
      if (this.latestViewport !== null && this.latestViewport !== viewport) {
        this.canvas.resize(this.latestViewport);
      }
      const opened = await this.openDocument(request);
      if (this.lease.holds(this)) {
        this.store.documentOpened(opened.original, opened.projectId);
        if (request.kind === 'image' && request.then !== undefined) {
          void this.followUp.open(request.then);
        }
      }
    } catch (error: unknown) {
      this.logger.error('Editor could not open the document', { kind: request.kind, error });
      // A page that is already gone shows nothing and navigates nowhere.
      if (this.lease.holds(this)) {
        this.store.setStatus('error');
        if (request.kind === 'project') {
          this.leaveAfterProjectError(error);
        }
      }
    }
  }

  /** A saved project that cannot be opened: explain why and return to Recent projects. */
  private leaveAfterProjectError(error: unknown): void {
    const code = isProjectError(error) ? error.code : 'corrupt';
    this.toasts.show(PROJECT_OPEN_ERROR_MESSAGES[code], { variant: 'danger' });
    void this.navController.navigateRoot(APP_ROUTES.home, { replaceUrl: true });
  }

  private async openDocument(request: EditorLaunchRequest): Promise<OpenedDocument> {
    switch (request.kind) {
      case 'project': {
        const project = await this.projects.open(request.projectId);
        return { original: project.originalSnapshot, projectId: project.id };
      }
      case 'collage':
        await this.openCollage(request.templateId, request.images);
        return { original: this.canvas.toSnapshot(), projectId: null };
      case 'image':
        await this.canvas.setBaseImage(request.image);
        return { original: this.canvas.toSnapshot(), projectId: null };
    }
  }

  /**
   * A blank square document with the default background, then the photos laid into the
   * template. Built as one command and then cleared from history: the finished collage is the
   * starting point (Reset target), like a freshly opened photo, not an undoable step.
   */
  private async openCollage(
    templateId: CollageTemplateId,
    images: readonly PreparedImage[],
  ): Promise<void> {
    const size = collageDocumentSize(COLLAGE_ASPECTS[COLLAGE_DEFAULT_ASPECT]);
    await this.canvas.newDocument(size, COLLAGE_DEFAULT_BACKGROUND);
    await this.canvas.commit(
      COLLAGE_STRINGS.commandLabels.layout,
      buildCollageMutation(findCollageTemplate(templateId), images, INITIAL_COLLAGE_VIEW),
    );
    this.history.clear();
  }
}
