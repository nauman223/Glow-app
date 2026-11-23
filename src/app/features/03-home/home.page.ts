import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/config/app.constants';
import { EditorLaunchService } from '@core/editor-launch/editor-launch.service';
import { isImageError } from '@core/image/image.models';
import { ImageService } from '@core/image/image.service';
import { IMAGE_ERROR_MESSAGES } from '@core/image/image.strings';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { PICKER_AI_QUERY_KEY } from '@features/04-picker/picker.models';
import { type AiFeatureDefinition } from '@features/ai/_shell/ai-features';
import { AiToolsSheetComponent } from '@features/ai/_shell/components/ai-tools-sheet/ai-tools-sheet.component';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { AdBannerSlotComponent } from '@shared/ui/ad-banner-slot/ad-banner-slot.component';
import { BrandLogoComponent } from '@shared/ui/brand-logo/brand-logo.component';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { CollageTemplatesComponent } from './components/collage-templates/collage-templates.component';
import { HomeChipsComponent } from './components/home-chips/home-chips.component';
import { RecentProjectsComponent } from './components/recent-projects/recent-projects.component';
import { StartEditingCardComponent } from './components/start-editing-card/start-editing-card.component';
import { HOME_CHIPS, HOME_SECTIONS, type HomeAction, START_EDITING_ACTIONS } from './home.config';
import { HOME_STRINGS } from './home.strings';

/** Screen 03. Renders the configured Home actions and sections and runs action commands. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    RouterLink,
    BrandLogoComponent,
    IconComponent,
    StartEditingCardComponent,
    HomeChipsComponent,
    RecentProjectsComponent,
    CollageTemplatesComponent,
    AiToolsSheetComponent,
    AdBannerSlotComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly images = inject(ImageService);
  private readonly editorLaunch = inject(EditorLaunchService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  protected readonly strings = HOME_STRINGS;
  protected readonly settingsRoute = APP_ROUTES.settings;
  protected readonly startActions = START_EDITING_ACTIONS;
  protected readonly chips = HOME_CHIPS;
  protected readonly sections = HOME_SECTIONS;
  /** The action whose flow is running (camera open, photo being prepared). */
  protected readonly busyActionId = signal<string | null>(null);
  protected readonly aiToolsOpen = signal(false);

  protected run(action: HomeAction): void {
    if (this.busyActionId() !== null) {
      return;
    }
    switch (action.command.kind) {
      case 'navigate':
        void this.router.navigateByUrl(action.command.route);
        return;
      case 'camera':
        void this.takePhoto(action.id);
        return;
      case 'ai-tools':
        this.aiToolsOpen.set(true);
        return;
    }
  }

  /** AI screens work on an editor document: pick the photo first, the editor then opens it. */
  protected startAiTool(feature: AiFeatureDefinition): void {
    this.aiToolsOpen.set(false);
    void this.router.navigate([APP_ROUTES.picker], {
      queryParams: { [PICKER_AI_QUERY_KEY]: feature.id },
    });
  }

  private async takePhoto(actionId: string): Promise<void> {
    this.busyActionId.set(actionId);
    try {
      const result = await this.images.fromCamera('camera');
      // Cancelling the camera is a normal outcome: stay on Home without a message.
      if (result.status === 'selected') {
        await this.editorLaunch.launch(result.image);
      }
    } catch (error: unknown) {
      if (isImageError(error)) {
        this.toasts.show(IMAGE_ERROR_MESSAGES[error.code], { variant: 'danger' });
      } else {
        this.logger.error('Opening a camera photo in the editor failed', error);
        this.toasts.show(IMAGE_ERROR_MESSAGES['read-failed'], { variant: 'danger' });
      }
    } finally {
      this.busyActionId.set(null);
    }
  }
}
