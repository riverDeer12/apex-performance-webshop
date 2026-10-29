import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { CartService, MaxQuantity } from '../../core/cart.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { environment } from '../../../environments/environment';
import { Product, Variant, clientUnitDiscount, formatPrice, variantName } from '../../core/models';

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

  // Price a logged in client of the studio pays, null for everyone else.
  readonly clientPrice = computed(() => {
    const product = this.product();
    const percent = this.account.clientDiscount();
    return product && percent > 0 ? product.price - clientUnitDiscount(percent, product.price) : null;
  });

  readonly alertEmail = signal('');
  readonly alertState = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  readonly shareMessage = signal<string | null>(null);

  readonly formatPrice = formatPrice;
  readonly maxQuantity = MaxQuantity;

  constructor(route: ActivatedRoute, public api: ShopApiService, private cart: CartService,
              public account: AccountService, private seo: SeoService) {
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
          this.alertState.set('idle');
          this.setSeo(product);
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

  // "Let me know when it's back" for the chosen size or color.
  requestAlert(): void {
    const variant = this.variant();
    const email = this.alertEmail().trim();
    if (!variant || !email || this.alertState() === 'sending') return;

    this.alertState.set('sending');
    this.api.createStockAlert(variant.id, email).subscribe({
      next: () => this.alertState.set('sent'),
      error: () => this.alertState.set('error'),
    });
  }

  // Phones share the product page with a link preview; elsewhere the link is copied.
  async share(): Promise<void> {
    const product = this.product();
    if (!product) return;

    const url = this.api.shareUrl(product.slug);

    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      this.shareMessage.set('Poveznica je kopirana.');
    } catch (error) {
      // Closing the share sheet is not an error.
      if ((error as DOMException)?.name !== 'AbortError') this.shareMessage.set(url);
    }
  }

  changeQuantity(offset: number): void {
    this.quantity.update((x) => Math.min(this.maxQuantity, Math.max(1, x + offset)));
  }

  private setSeo(product: Product): void {
    const path = `/proizvod/${product.slug}`;
    const description = product.description.length > 160
      ? product.description.slice(0, 157) + '…'
      : product.description;

    this.seo.set({
      title: product.name,
      description,
      path,
      // Read by search engines for the product's price and availability.
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        category: product.category,
        image: product.imageIds.map((id) => this.api.imageUrl(id)),
        brand: { '@type': 'Brand', name: 'Apex Performance' },
        offers: {
          '@type': 'Offer',
          url: environment.siteUrl + path,
          priceCurrency: 'EUR',
          price: product.price.toFixed(2),
          availability: product.variants.some((x) => x.inStock)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      },
    });
  }

  private unique(select: (variant: Variant) => string | null): string[] {
    const values = (this.product()?.variants ?? []).map(select).filter((x): x is string => !!x);
    return [...new Set(values)];
  }
}
