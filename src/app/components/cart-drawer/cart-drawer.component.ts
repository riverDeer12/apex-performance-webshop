import { Component, HostListener, computed, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { ShopApiService } from '../../core/shop-api.service';
import { ShopSettings, formatPrice } from '../../core/models';

/**
 * Panel from the right after something is added to the cart: what was added,
 * the cart's total, how much is left to free delivery, and the way to the cart.
 */
@Component({
  selector: 'app-cart-drawer',
  imports: [RouterLink],
  templateUrl: './cart-drawer.component.html',
  styleUrl: './cart-drawer.component.scss'
})
export class CartDrawerComponent {
  private readonly settings = signal<ShopSettings | null>(null);

  // Before discounts: the cart page shows the exact total with them.
  readonly missingForFree = computed(() => {
    const settings = this.settings();
    return settings ? Math.max(0, settings.freeShippingFrom - this.cart.subtotal()) : null;
  });
  readonly freeProgress = computed(() => {
    const settings = this.settings();
    return settings && settings.freeShippingFrom > 0
      ? Math.min(100, this.cart.subtotal() / settings.freeShippingFrom * 100)
      : 100;
  });

  readonly formatPrice = formatPrice;

  constructor(public cart: CartService, public api: ShopApiService, router: Router) {
    api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });
    router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => this.close());
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.cart.drawerOpen.set(false);
  }
}
