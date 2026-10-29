import { Component, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { CartService } from '../../core/cart.service';
import { Order, discountLabel, formatPrice } from '../../core/models';

// Stripe can take a moment to mark the payment done.
const RetryEveryMs = 2000;
const MaxRetries = 10;

/**
 * Page Stripe Checkout returns to. The shop checks the payment with Stripe
 * and shows the order; the cart is emptied once the order is paid.
 */
@Component({
  selector: 'app-order',
  imports: [RouterLink],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss'
})
export class OrderComponent implements OnDestroy {
  readonly order = signal<Order | null>(null);
  readonly notFound = signal(false);
  readonly gaveUp = signal(false);

  readonly formatPrice = formatPrice;
  readonly discountLabel = discountLabel;

  private retries = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(route: ActivatedRoute, private api: ShopApiService, private cart: CartService) {
    const id = route.snapshot.paramMap.get('id') ?? '';
    const sessionId = route.snapshot.queryParamMap.get('session_id') ?? '';

    this.load(id, sessionId);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private load(id: string, sessionId: string): void {
    this.api.getOrder(id, sessionId).subscribe({
      next: (order) => {
        this.order.set(order);

        if (order.status === 'Paid' || order.status === 'Shipped') {
          this.cart.clear();
          this.api.refreshProducts();
        } else if (order.status === 'Pending') {
          if (++this.retries <= MaxRetries) this.timer = setTimeout(() => this.load(id, sessionId), RetryEveryMs);
          else this.gaveUp.set(true);
        }
      },
      error: () => this.notFound.set(true),
    });
  }
}
