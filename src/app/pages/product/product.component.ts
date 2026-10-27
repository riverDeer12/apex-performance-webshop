import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ShopApiService } from '../../core/shop-api.service';
import { CartService, MaxQuantity } from '../../core/cart.service';
import { Product, Variant, formatPrice, variantName } from '../../core/models';

/**
 * Product with its pictures, sizes and colors. Adding to the cart needs a
 * variant in stock; when a product has no sizes or colors its only variant
 * is chosen right away.
 */
@Component({
  selector: 'app-product',
  imports: [RouterLink],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss'
})
export class ProductComponent {
  readonly product = signal<Product | null>(null);
  readonly notFound = signal(false);
  readonly imageIndex = signal(0);
  readonly size = signal<string | null>(null);
  readonly color = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly added = signal(false);

  readonly sizes = computed(() => this.unique((x) => x.size));
  readonly colors = computed(() => this.unique((x) => x.color));

  readonly variant = computed<Variant | null>(() => {
    const product = this.product();
    if (!product) return null;

    return product.variants.find((x) =>
      (this.sizes().length === 0 || x.size === this.size()) &&
      (this.colors().length === 0 || x.color === this.color())) ?? null;
  });

  readonly formatPrice = formatPrice;
  readonly maxQuantity = MaxQuantity;

  constructor(route: ActivatedRoute, public api: ShopApiService, private cart: CartService, title: Title) {
    route.paramMap.subscribe((params) => {
      this.product.set(null);
      this.notFound.set(false);

      api.getProduct(params.get('slug') ?? '').subscribe({
        next: (product) => {
          this.product.set(product);
          this.imageIndex.set(0);
          this.quantity.set(1);
          this.added.set(false);
          // A single size or color is chosen for the customer.
          this.size.set(this.sizes().length === 1 ? this.sizes()[0] : null);
          this.color.set(this.colors().length === 1 ? this.colors()[0] : null);
          title.setTitle(`${product.name} · Apex Performance Shop`);
        },
        error: () => this.notFound.set(true),
      });
    });
  }

  // Size (or color) has a piece in stock with the other choice made so far.
  available(size: string | null, color: string | null): boolean {
    return (this.product()?.variants ?? []).some((x) =>
      x.inStock && (size === null || x.size === size) && (color === null || x.color === color));
  }

  addToCart(): void {
    const product = this.product();
    const variant = this.variant();
    if (!product || !variant?.inStock) return;

    this.cart.add({
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      variantName: variantName(variant),
      price: product.price,
      imageId: product.imageIds[0] ?? null,
    }, this.quantity());

    this.added.set(true);
  }

  changeQuantity(offset: number): void {
    this.quantity.update((x) => Math.min(this.maxQuantity, Math.max(1, x + offset)));
  }

  private unique(select: (variant: Variant) => string | null): string[] {
    const values = (this.product()?.variants ?? []).map(select).filter((x): x is string => !!x);
    return [...new Set(values)];
  }
}
