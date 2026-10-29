import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { Product, clientUnitDiscount, formatPrice } from '../../core/models';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly products = signal<Product[] | null>(null);
  readonly failed = signal(false);
  // null shows all categories.
  readonly category = signal<string | null>(null);

  readonly categories = computed(() => [...new Set((this.products() ?? []).map((x) => x.category))]);
  readonly visible = computed(() =>
    (this.products() ?? []).filter((x) => !this.category() || x.category === this.category()));

  // Client discount offered in the shop, shown to visitors who are not logged in.
  readonly offeredDiscount = signal(0);

  readonly formatPrice = formatPrice;
  readonly placeholders = [1, 2, 3, 4];

  constructor(public api: ShopApiService, public account: AccountService, seo: SeoService) {
    seo.set({ path: '/' });
    api.getSettings().subscribe({ next: (settings) => this.offeredDiscount.set(settings.clientDiscountPercent) });

    api.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.failed.set(true),
    });
  }

  // Price for a logged in client of the studio, null for everyone else.
  clientPrice(product: Product): number | null {
    const percent = this.account.clientDiscount();
    return percent > 0 ? product.price - clientUnitDiscount(percent, product.price) : null;
  }

  soldOut = (product: Product) => product.variants.every((x) => !x.inStock);
}
