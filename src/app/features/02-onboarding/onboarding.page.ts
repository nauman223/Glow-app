import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { APP_ROUTES } from '@core/config/app.constants';
import { LoggerService } from '@core/logging/logger.service';
import { OnboardingService } from '@core/onboarding/onboarding.service';
import { IonContent } from '@ionic/angular/ion-content';
import { NavController } from '@ionic/angular/nav-controller';
import { ButtonComponent } from '@shared/ui/button/button.component';

import { DrawIllustrationComponent } from './components/draw-illustration/draw-illustration.component';
import { LayerIllustrationComponent } from './components/layer-illustration/layer-illustration.component';
import { MergeIllustrationComponent } from './components/merge-illustration/merge-illustration.component';
import { ONBOARDING_STEPS } from './onboarding.config';
import { ONBOARDING_STRINGS } from './onboarding.strings';
import { type SwipeDirection, SwipeDirective } from './swipe.directive';

/**
 * Screens 02a–c as one page: swipe, arrow keys or Next move between steps; Skip and
 * "Get Started" save the flag and replace the stack with Home. Inactive steps are `inert`,
 * so TalkBack only reads the current one; step changes are announced in a polite live region.
 */
@Component({
  selector: 'app-onboarding-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent,
    ButtonComponent,
    SwipeDirective,
    MergeIllustrationComponent,
    LayerIllustrationComponent,
    DrawIllustrationComponent,
  ],
  // Arrow keys work wherever focus is on the page (Skip, Next), like a native pager.
  host: { '[style.--onboarding-step]': 'stepIndex()', '(keydown)': 'onKeydown($event)' },
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly onboarding = inject(OnboardingService);
  private readonly navigation = inject(NavController);
  private readonly logger = inject(LoggerService);
  private readonly document = inject(DOCUMENT);
  private readonly isRtl = this.document.documentElement.dir === 'rtl';
  private readonly skipButton = viewChild<ElementRef<HTMLButtonElement>>('skipButton');
  private readonly footer = viewChild.required<ElementRef<HTMLElement>>('footer');
  private readonly lastIndex = ONBOARDING_STEPS.length - 1;

  protected readonly strings = ONBOARDING_STRINGS;
  protected readonly stepIndex = signal(0);
  protected readonly leaving = signal(false);
  protected readonly announcement = signal('');

  protected readonly slides = computed(() =>
    ONBOARDING_STEPS.map((step, index) => ({ step, active: index === this.stepIndex() })),
  );
  protected readonly isLastStep = computed(() => this.stepIndex() === this.lastIndex);
  protected readonly primaryLabel = computed(() =>
    this.isLastStep() ? this.strings.getStarted : this.strings.next,
  );
  private readonly canGoForward = computed(() => !this.isLastStep());
  private readonly canGoBack = computed(() => this.stepIndex() > 0);
  /** Physical swipe permissions: forward is a leftward swipe in LTR, rightward in RTL. */
  protected readonly canSwipeLeft = computed(() =>
    this.isRtl ? this.canGoBack() : this.canGoForward(),
  );
  protected readonly canSwipeRight = computed(() =>
    this.isRtl ? this.canGoForward() : this.canGoBack(),
  );

  protected next(): void {
    if (this.isLastStep()) {
      void this.finish();
    } else {
      this.goTo(this.stepIndex() + 1);
    }
  }

  protected onSwiped(direction: SwipeDirection): void {
    this.step((direction === 'left') !== this.isRtl);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    this.step((event.key === 'ArrowRight') !== this.isRtl);
  }

  /** Skip and "Get Started": remember the choice, then make Home the root. */
  protected async finish(): Promise<void> {
    if (this.leaving()) {
      return;
    }
    this.leaving.set(true);
    await this.onboarding.markComplete();
    try {
      await this.navigation.navigateRoot(APP_ROUTES.home, { replaceUrl: true });
    } catch (error: unknown) {
      this.logger.error('Leaving onboarding failed', error);
      this.leaving.set(false);
    }
  }

  private step(forward: boolean): void {
    this.goTo(this.stepIndex() + (forward ? 1 : -1));
  }

  private goTo(index: number): void {
    const target = Math.min(Math.max(index, 0), this.lastIndex);
    if (target === this.stepIndex()) {
      return;
    }
    // Skip disappears on the last step; keep keyboard focus from falling to the page.
    const skip = this.skipButton()?.nativeElement;
    if (target === this.lastIndex && skip !== undefined && skip === this.document.activeElement) {
      this.footer().nativeElement.querySelector('button')?.focus();
    }
    this.stepIndex.set(target);
    const { title } = ONBOARDING_STEPS[target];
    this.announcement.set(
      this.strings.stepAnnouncement(target + 1, ONBOARDING_STEPS.length, title),
    );
  }
}
