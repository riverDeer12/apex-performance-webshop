import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../core/account.service';
import { ShopApiService } from '../../core/shop-api.service';
import { SeoService } from '../../core/seo.service';
import { Order, OrderStatus, discountLabel, formatPrice } from '../../core/models';

const StatusTexts: Record<OrderStatus, string> = {
  Pending: 'Čeka plaćanje',
  Paid: 'Plaćeno, pripremamo',
  Shipped: 'Poslano',
  Cancelled: 'Otkazano',
  Refunded: 'Novac vraćen',
};

/**
 * Orders the logged user made while logged in to the shop.
 */
@Component({
  selector: 'app-my-orders',
  imports: [RouterLink, DatePipe],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss'
})
export class MyOrdersComponent {
  readonly orders = signal<Order[] | null>(null);
  readonly failed = signal(false);

  readonly formatPrice = formatPrice;
  readonly discountLabel = discountLabel;
  readonly statusText = (status: OrderStatus) => StatusTexts[status];

  constructor(public account: AccountService, private router: Router, api: ShopApiService, seo: SeoService) {
    seo.set({ title: 'Moje narudžbe', path: '/moje-narudzbe' });

    if (!account.isLoggedIn()) {
      router.navigate(['/prijava'], { queryParams: { povratak: '/moje-narudzbe' } });
      return;
    }

    api.getMyOrders().subscribe({
      next: (orders) => this.orders.set(orders),
      error: () => this.failed.set(true),
    });
  }

  logout(): void {
    this.account.logout();
    this.router.navigateByUrl('/');
  }
}
