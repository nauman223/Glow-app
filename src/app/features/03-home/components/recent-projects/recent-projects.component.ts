import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { EditorLaunchService } from '@core/editor-launch/editor-launch.service';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';
import { type ProjectSummary } from '@core/project/project.models';
import { ProjectService } from '@core/project/project.service';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type RecentProjectsSection } from '../../home.config';
import { HOME_STRINGS } from '../../home.strings';
import { ProjectCardComponent, type ProjectCardView } from '../project-card/project-card.component';
import { fullDateTimeLabel, relativeDayLabel } from './project-dates';

const SKELETON_CARDS = [0, 1, 2] as const;

function toCardView(project: ProjectSummary): ProjectCardView {
  const strings = HOME_STRINGS.recent;
  const title = project.name ?? strings.untitled;
  return {
    id: project.id,
    title,
    dateLabel: relativeDayLabel(project.updatedAt),
    openLabel: strings.openLabel(title, fullDateTimeLabel(project.updatedAt)),
    optionsLabel: strings.optionsLabel(title),
    thumbnailUrl: project.thumbnailUrl,
  };
}

/**
 * Home "Recent projects" (screen 03): a horizontal row of the newest projects with "See all"
 * (a sheet listing every project), a 3-dot options sheet per card and a delete confirmation.
 * Hidden when there are no projects; a skeleton row shows while the first list loads.
 */
@Component({
  selector: 'app-recent-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    DialogComponent,
    ProjectCardComponent,
    ScrollFadeDirective,
    SkeletonComponent,
  ],
  templateUrl: './recent-projects.component.html',
  styleUrl: './recent-projects.component.scss',
  // An empty section must not take a slot in Home's gap stack (it doubled the space above
  // Templates on a fresh install).
  host: { '[class.recent-projects--hidden]': '!visible()' },
})
export class RecentProjectsComponent implements OnInit {
  private readonly projects = inject(ProjectService);
  private readonly editorLaunch = inject(EditorLaunchService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  public readonly section = input.required<RecentProjectsSection>();

  protected readonly strings = HOME_STRINGS.recent;
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly cards = computed(() => this.projects.recent().map(toCardView));
  protected readonly rowCards = computed(() => this.cards().slice(0, this.section().rowLimit));
  protected readonly loading = computed(
    () => this.projects.status() === 'loading' && this.cards().length === 0,
  );
  protected readonly visible = computed(() => this.loading() || this.cards().length > 0);
  protected readonly opening = signal(false);
  protected readonly allOpen = signal(false);
  protected readonly optionsOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedTitle = computed(
    () => this.cards().find((card) => card.id === this.selectedId())?.title ?? null,
  );

  public ngOnInit(): void {
    // Failures are logged by ProjectService; the section then stays hidden.
    this.projects.list().catch(() => undefined);
  }

  protected async open(id: string): Promise<void> {
    if (this.opening()) {
      return;
    }
    this.opening.set(true);
    this.allOpen.set(false);
    this.optionsOpen.set(false);
    try {
      await this.editorLaunch.launchProject(id);
    } finally {
      this.opening.set(false);
    }
  }

  protected showAll(): void {
    this.allOpen.set(true);
  }

  protected showOptions(id: string): void {
    this.selectedId.set(id);
    this.optionsOpen.set(true);
  }

  protected openSelected(): void {
    const id = this.selectedId();
    if (id !== null) {
      void this.open(id);
    }
  }

  protected requestDelete(): void {
    this.optionsOpen.set(false);
    this.deleteOpen.set(true);
  }

  protected cancelDelete(): void {
    this.deleteOpen.set(false);
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.selectedId();
    this.deleteOpen.set(false);
    if (id === null) {
      return;
    }
    try {
      await this.projects.delete(id);
      this.toasts.show(this.strings.deleted, { variant: 'success' });
    } catch (error: unknown) {
      this.logger.error('Deleting a project failed', { id, error });
      this.toasts.show(this.strings.deleteFailed, { variant: 'danger' });
    } finally {
      this.selectedId.set(null);
    }
  }
}
