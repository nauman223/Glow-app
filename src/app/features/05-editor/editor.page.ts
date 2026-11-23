import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnDestroy,
  type OnInit,
  resource,
  signal,
} from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import { AdBannerSlotComponent } from '@shared/ui/ad-banner-slot/ad-banner-slot.component';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { DialogComponent } from '@shared/ui/dialog/dialog.component';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { StateMessageComponent } from '@shared/ui/state-message/state-message.component';

import {
  EditorStageComponent,
  type StageMeasurement,
} from './components/editor-stage/editor-stage.component';
import { EditorToolbarComponent } from './components/editor-toolbar/editor-toolbar.component';
import { EditorTopBarComponent } from './components/editor-top-bar/editor-top-bar.component';
import { EDITOR_TOP_BAR_STRINGS } from './components/editor-top-bar/editor-top-bar.strings';
import { EditorAutosaveService } from './editor-autosave.service';
import { EditorLeaveService } from './editor-leave.service';
import { EditorSessionService } from './editor-session.service';
import { EditorStore } from './editor.store';
import { EDITOR_STRINGS } from './editor.strings';
import { EDITOR_TOOLS, type EditorToolId, findToolRoute } from './tools.config';

@Component({
  selector: 'app-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    NgComponentOutlet,
    AdBannerSlotComponent,
    BottomSheetComponent,
    ButtonComponent,
    DialogComponent,
    IconComponent,
    StateMessageComponent,
    EditorStageComponent,
    EditorToolbarComponent,
    EditorTopBarComponent,
  ],
  providers: [EditorStore, EditorAutosaveService, EditorSessionService, EditorLeaveService],
  templateUrl: './editor.page.html',
  styleUrl: './editor.page.scss',
})
export class EditorPage implements OnInit, OnDestroy {
  private readonly store = inject(EditorStore);
  private readonly session = inject(EditorSessionService);
  private readonly leaveFlow = inject(EditorLeaveService);
  private readonly navController = inject(NavController);

  protected readonly strings = EDITOR_STRINGS;
  protected readonly barStrings = EDITOR_TOP_BAR_STRINGS;
  protected readonly tools = EDITOR_TOOLS;
  protected readonly status = this.store.status;
  protected readonly panelOpen = this.store.panelOpen;
  protected readonly canUndo = this.store.canUndo;
  protected readonly canRedo = this.store.canRedo;
  protected readonly undoLabel = this.store.undoLabel;
  protected readonly redoLabel = this.store.redoLabel;
  protected readonly announcement = this.store.announcement;
  protected readonly canReset = this.store.canReset;
  protected readonly layerCount = this.store.layerCount;
  protected readonly drawerOpen = this.store.drawerOpen;
  /** A docked bottom-sheet panel replaces the toolbar and titles the top bar. */
  protected readonly dockedPanelOpen = computed(() => this.panelOpen() && !this.drawerOpen());
  protected readonly toolTitle = computed(() =>
    this.dockedPanelOpen() ? (this.store.activeTool()?.label ?? null) : null,
  );
  /** Everything under the drawer's scrim is inert (no focus, hidden from TalkBack). */
  protected readonly behindDrawer = computed(() => (this.drawerOpen() ? '' : null));
  protected readonly loading = computed(() => this.status() === 'loading');
  protected readonly failed = computed(() => this.status() === 'error');
  protected readonly notReady = computed(() => this.status() !== 'ready');
  protected readonly toolbarDisabled = computed(() => this.notReady() || this.drawerOpen());
  protected readonly discardOpen = this.leaveFlow.discardOpen;
  protected readonly resetOpen = signal(false);
  protected readonly optionsOpen = signal(false);
  /** The native banner hides under the options sheet and dialogs; its band stays. */
  protected readonly adSuspended = computed(
    () => this.optionsOpen() || this.resetOpen() || this.discardOpen(),
  );
  protected readonly loadingLabel = signal<string>(EDITOR_STRINGS.loading);
  protected readonly panel = resource({
    params: () => this.store.activeTool() ?? undefined,
    loader: ({ params }) => params.loadPanel(),
  });

  public ngOnInit(): void {
    if (!this.session.claim()) {
      void this.navController.navigateRoot(APP_ROUTES.home, { replaceUrl: true });
    } else if (this.session.isProject()) {
      this.loadingLabel.set(EDITOR_STRINGS.loadingProject);
    }
  }

  /** Ionic lifecycle: the editor is the visible page again (first entry or back from Export). */
  public ionViewDidEnter(): void {
    this.leaveFlow.enable(() => this.leaveBlocked());
  }

  public ionViewWillLeave(): void {
    this.leaveFlow.disable();
  }

  public ngOnDestroy(): void {
    this.leaveFlow.disable();
    this.session.end();
  }

  protected onStageMeasured(measurement: StageMeasurement): void {
    this.session.onStageMeasured(measurement);
  }

  /** Panel tools open in place; route tools (AI screens) open on top, keeping this page alive. */
  protected openTool(id: EditorToolId): void {
    const route = findToolRoute(id);
    if (route === null) {
      this.store.openTool(id);
    } else if (this.status() === 'ready' && !this.panelOpen()) {
      void this.navController.navigateForward(route);
    }
  }

  protected undo(): void {
    void this.store.undo();
  }

  protected redo(): void {
    void this.store.redo();
  }

  protected openOptions(): void {
    if (!this.panelOpen()) {
      this.optionsOpen.set(true);
    }
  }

  protected resetFromOptions(): void {
    this.optionsOpen.set(false);
    if (this.canReset() && !this.panelOpen()) {
      this.resetOpen.set(true);
    }
  }

  protected confirmReset(): void {
    this.resetOpen.set(false);
    void this.store.reset();
  }

  protected cancelReset(): void {
    this.resetOpen.set(false);
  }

  protected openExport(): void {
    void this.navController.navigateForward(APP_ROUTES.export);
  }

  protected requestLeave(): void {
    this.leaveFlow.request(this.leaveBlocked());
  }

  protected confirmDiscard(): void {
    this.leaveFlow.confirmDiscard();
  }

  protected keepEditing(): void {
    this.leaveFlow.keepEditing();
  }

  protected goHome(): void {
    this.leaveFlow.goHome();
  }

  /** An open tool panel, the options sheet or the Reset dialog handles back itself. */
  private leaveBlocked(): boolean {
    return this.panelOpen() || this.optionsOpen() || this.resetOpen();
  }
}
