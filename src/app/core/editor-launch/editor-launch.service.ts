import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { type CollageTemplateId } from '@core/collage/collage.models';
import { APP_ROUTES } from '@core/config/app.constants';
import { type PreparedImage } from '@core/image/image.models';

/** A screen the editor opens on top of itself once the document is ready (Home → AI tools). */
export interface EditorFollowUp {
  readonly route: string;
}

/**
 * What the editor opens: a freshly prepared photo (optionally followed by a screen over the
 * editor), a saved project from Recent projects, or a new collage of prepared photos (in cell
 * order) laid out with a template.
 */
export type EditorLaunchRequest =
  | { readonly kind: 'image'; readonly image: PreparedImage; readonly then?: EditorFollowUp }
  | { readonly kind: 'project'; readonly projectId: string }
  | {
      readonly kind: 'collage';
      readonly templateId: CollageTemplateId;
      readonly images: readonly PreparedImage[];
    };

/**
 * Hands a prepared photo (Home camera, photo picker), a saved project (Home Recent projects) or
 * a collage (Home Templates → multi-select picker) to the editor. Holds at most one request, and only until the editor consumes it, so a stale
 * one can never reappear when the editor is opened again later.
 */
@Injectable({ providedIn: 'root' })
export class EditorLaunchService {
  private readonly router = inject(Router);
  private pending: EditorLaunchRequest | null = null;

  /**
   * Queues the image and opens the editor, then `then` over it (Back returns to the editor).
   * Resolves false if navigation to the editor was cancelled.
   */
  public launch(image: PreparedImage, then?: EditorFollowUp): Promise<boolean> {
    return this.open({ kind: 'image', image, then });
  }

  /** Queues a saved project and opens the editor, which restores it once its canvas exists. */
  public launchProject(projectId: string): Promise<boolean> {
    return this.open({ kind: 'project', projectId });
  }

  /**
   * Queues a new collage and opens the editor. Resolves false if navigation was cancelled; the
   * caller then still owns `images` and must release them.
   */
  public launchCollage(
    templateId: CollageTemplateId,
    images: readonly PreparedImage[],
  ): Promise<boolean> {
    return this.open({ kind: 'collage', templateId, images });
  }

  /** True while a request is waiting for the editor (used by the editor route guard). */
  public hasPending(): boolean {
    return this.pending !== null;
  }

  /** Returns the queued request once; later calls return null. */
  public consume(): EditorLaunchRequest | null {
    const request = this.pending;
    this.pending = null;
    return request;
  }

  private async open(request: EditorLaunchRequest): Promise<boolean> {
    this.pending = request;
    const navigated = await this.router.navigateByUrl(APP_ROUTES.editor);
    if (!navigated) {
      this.pending = null;
    }
    return navigated;
  }
}
