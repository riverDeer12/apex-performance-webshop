import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountService } from '../../core/account.service';
import { ShopApiService } from '../../core/shop-api.service';
import { SeoService } from '../../core/seo.service';

/**
 * Login with the account of the Apex Performance app. Clients of the studio
 * get their discount; it doesn't log them out of the app.
 */
@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  readonly username = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly clientDiscount = signal(0);

  constructor(private account: AccountService, private router: Router, private route: ActivatedRoute,
              api: ShopApiService, seo: SeoService) {
    seo.set({ title: 'Prijava', path: '/prijava' });
    api.getSettings().subscribe({ next: (settings) => this.clientDiscount.set(settings.clientDiscountPercent) });
  }

  submit(): void {
    if (!this.username().trim() || !this.password() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    this.account.login(this.username().trim(), this.password()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('povratak');
        // Only paths of the shop, never another site.
        this.router.navigateByUrl(returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/');
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(error.status === 429
          ? 'Previše pokušaja. Pokušajte ponovno za nekoliko minuta.'
          : error.status === 0 || error.status >= 500
            ? 'Prijava trenutno ne radi. Pokušajte ponovno.'
            : 'Korisničko ime ili lozinka nisu točni.');
      },
    });
  }
}
