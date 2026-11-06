import { Component, DestroyRef, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { ShopSettings, formatPrice } from '../../core/models';

interface Message {
  text: string;
  link?: string;
}

/** Strip over the header with the shop's offers, one message at a time. */
@Component({
  selector: 'app-announcement-bar',
  imports: [RouterLink],
  template: `
    @if (messages().length) {
      <div class="bar" (mouseenter)="paused.set(true)" (mouseleave)="paused.set(false)" aria-live="off">
        @for (message of messages(); track message.text; let i = $index) {
          <p [class.shown]="i === index() % messages().length" [attr.aria-hidden]="i !== index() % messages().length">
            @if (message.link) {
              <a [routerLink]="message.link">{{ message.text }}</a>
            } @else {
              {{ message.text }}
            }
          </p>
        }
      </div>
    }
  `,
  styles: [`
    .bar { position: relative; height: 34px; overflow: hidden; background: var(--navy); color: #fff;
      font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-align: center; }
    p { position: absolute; inset: 0; margin: 0; padding: 0 16px; line-height: 34px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; opacity: 0; transform: translateY(8px);
      transition: opacity 0.4s, transform 0.4s; }
    p.shown { opacity: 1; transform: none; }
    a { color: inherit; }
    @media (prefers-reduced-motion: reduce) { p { transition: none; } }
  `]
})
export class AnnouncementBarComponent {
  private readonly settings = signal<ShopSettings | null>(null);
  readonly index = signal(0);
  readonly paused = signal(false);

  readonly messages = computed<Message[]>(() => {
    const settings = this.settings();
    if (!settings) return [];

    const discount = this.account.clientDiscount() || settings.clientDiscountPercent;
    return [
      settings.freeShippingFrom > 0
        ? { text: `Besplatna dostava za narudžbe od ${formatPrice(settings.freeShippingFrom)}` }
        : { text: 'Besplatna dostava' },
      ...(discount > 0
        ? [this.account.clientDiscount() > 0
          ? { text: `Vaš popust za članove: ${discount} % na sve proizvode` }
          : { text: `Članovi Apex Performance-a imaju ${discount} % popusta`, link: '/prijava' }]
        : []),
      { text: 'Dostava u BoxNow paketomat diljem Hrvatske' },
      { text: 'Povrat u 14 dana', link: '/povrat-i-reklamacije' },
    ];
  });

  constructor(api: ShopApiService, private account: AccountService, destroyRef: DestroyRef) {
    api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });

    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setInterval(() => {
      if (!this.paused() && !document.hidden) this.index.update((x) => x + 1);
    }, reduced ? 8000 : 5000);
    destroyRef.onDestroy(() => clearInterval(timer));
  }
}
