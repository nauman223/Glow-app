import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bootstrap card. Project body content directly; project a footer with
 * `<div cardFooter class="card-footer">`.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card app-card">
      <div class="card-body">
        @if (heading(); as heading) {
          <h2 class="card-title h5">{{ heading }}</h2>
        }
        @if (subheading(); as subheading) {
          <p class="card-subtitle mb-2 text-muted-token">{{ subheading }}</p>
        }
        <ng-content />
      </div>
      <ng-content select="[cardFooter]" />
    </article>
  `,
  styleUrl: './card.component.scss',
})
export class CardComponent {
  public readonly heading = input<string | null>(null);
  public readonly subheading = input<string | null>(null);
}
