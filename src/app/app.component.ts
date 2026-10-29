import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { CartService } from './core/cart.service';
import { AccountService } from './core/account.service';
import { ShopApiService } from './core/shop-api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  // The test shop is marked so it is never mistaken for the real one.
  readonly isTest = environment.isTest;
  readonly year = new Date().getFullYear();

  constructor(public cart: CartService, public account: AccountService, api: ShopApiService, router: Router) {
    // Page views are counted per page and day, nothing about the visitor.
    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => api.countVisit(event.urlAfterRedirects));
  }

  logout(): void {
    this.account.logout();
  }
}
