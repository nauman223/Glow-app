import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_NAME } from '@core/config/app.constants';

/** Formats every route `title` as "Page · Glow". */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  public override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME);
  }
}
