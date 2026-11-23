import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NetworkService } from '@core/platform/network.service';
import { IconComponent } from '@shared/ui/icon/icon.component';

const OFFLINE_MESSAGE = 'You are offline. Some features may be unavailable.';

/** Persistent banner shown while the device has no connection. */
@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (offline()) {
      <div
        class="app-offline"
        role="status"
        animate.enter="app-offline--enter"
        animate.leave="app-offline--leave"
      >
        <app-icon name="info" [size]="18" />
        <span>{{ message }}</span>
      </div>
    }
  `,
  styleUrl: './offline-banner.component.scss',
})
export class OfflineBannerComponent {
  private readonly network = inject(NetworkService);

  protected readonly offline = computed(() => !this.network.online());
  protected readonly message = OFFLINE_MESSAGE;
}
