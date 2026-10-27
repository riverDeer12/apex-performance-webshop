import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { Product, formatPrice } from '../../core/models';

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

  readonly formatPrice = formatPrice;
  readonly placeholders = [1, 2, 3, 4];

  constructor(public api: ShopApiService) {
    api.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.failed.set(true),
    });
  }

  soldOut = (product: Product) => product.variants.every((x) => !x.inStock);
}
