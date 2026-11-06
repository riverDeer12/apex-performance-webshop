import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';

/**
 * Contact form instead of a public email address. ?narudzba=AP-... fills in
 * the order the question is about.
 */
@Component({
  selector: 'app-contact',
  imports: [RouterLink],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  readonly name = signal('');
  readonly email = signal('');
  readonly orderNumber = signal('');
  readonly message = signal('');
  // Hidden from people; spam scripts fill it in.
  readonly website = signal('');
  readonly state = signal<'idle' | 'sending' | 'sent' | 'error' | 'limit'>('idle');

  constructor(private api: ShopApiService, account: AccountService, route: ActivatedRoute, seo: SeoService) {
    seo.set({ title: 'Kontakt', description: 'Pošaljite poruku shopu Apex Performance.', path: '/kontakt' });

    const me = account.me();
    if (me) {
      this.name.set(me.name);
      this.email.set(me.email);
    }
    this.orderNumber.set(route.snapshot.queryParamMap.get('narudzba') ?? '');
  }

  valid(): boolean {
    return !!this.name().trim() && /^\S+@\S+\.\S+$/.test(this.email().trim()) && this.message().trim().length >= 5;
  }

  send(): void {
    if (!this.valid() || this.state() === 'sending') return;

    this.state.set('sending');
    this.api.sendContact({
      name: this.name().trim(),
      email: this.email().trim(),
      message: this.message().trim(),
      orderNumber: this.orderNumber().trim() || null,
      website: this.website(),
    }).subscribe({
      next: () => this.state.set('sent'),
      error: (error) => this.state.set(error?.status === 429 ? 'limit' : 'error'),
    });
  }
}
