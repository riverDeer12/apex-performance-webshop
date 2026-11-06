import { Component, ElementRef, HostListener, computed, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { CartService, MaxQuantity } from '../../core/cart.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { environment } from '../../../environments/environment';
import { Product, Variant, clientUnitDiscount, formatPrice, variantName } from '../../core/models';
import { FavoritesService } from '../../core/favorites.service';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
import { SizeGuideComponent } from '../../components/size-guide/size-guide.component';
import { compareSizes, keywordValue, suggestions, swatchBackground } from '../../core/catalog';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

/**
 * Product with its pictures, sizes and colors. Adding to the cart needs a
 * variant in stock; when a product has no sizes or colors its only variant
 * is chosen right away.
 */
@Component({
  selector: 'app-product',
  imports: [RouterLink, ProductCardComponent, SizeGuideComponent],
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

  readonly sizes = computed(() => this.unique((x) => x.size).sort(compareSizes));
  readonly colors = computed(() => this.unique((x) => x.color));
  readonly colorSwatches = computed(() => this.colors().map((name) => ({ name, background: swatchBackground(name) })));

  // All products, for the suggestions under the product.
  private readonly catalog = signal<Product[]>([]);

  // Products that go with this one, to make an outfit.
  readonly suggested = computed(() => {
    const product = this.product();
    return product ? suggestions(product, this.catalog()) : [];
  });

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

  // Products opened before this one, newest first.
  readonly recent = computed(() => {
    const current = this.product()?.id;
    const byId = new Map(this.catalog().map((x) => [x.id, x]));
    return this.recentlyViewed.ids()
      .filter((id) => id !== current)
      .map((id) => byId.get(id))
      .filter((x): x is Product => !!x)
      .slice(0, 8);
  });

  readonly favorite = computed(() => {
    const product = this.product();
    return !!product && this.favorites.ids().includes(product.id);
  });

  readonly sizeGuideOpen = signal(false);
  // Bar with the price and the cart button at the bottom of phones, once the main button scrolled away.
  readonly stickyBar = signal(false);
  private readonly buy = viewChild<ElementRef<HTMLElement>>('buy');

  readonly alertEmail = signal('');
  // Logged in members are told at their account's email, unless they choose another one.
  readonly otherEmail = signal(false);
  readonly soldOut = computed(() => !!this.product() && this.product()!.variants.every((x) => !x.inStock));
  readonly alertState = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  readonly shareMessage = signal<string | null>(null);

  readonly formatPrice = formatPrice;
  readonly variantName = variantName;
  readonly maxQuantity = MaxQuantity;

  constructor(route: ActivatedRoute, public api: ShopApiService, private cart: CartService,
              public account: AccountService, private seo: SeoService, public favorites: FavoritesService,
              private recentlyViewed: RecentlyViewedService) {
    api.getProducts().subscribe({ next: (products) => this.catalog.set(products) });

    route.paramMap.subscribe((params) => {
      this.product.set(null);
      this.notFound.set(false);

      api.getProduct(params.get('slug') ?? '').subscribe({
        next: (product) => {
          this.product.set(product);
          this.recentlyViewed.add(product.id);
          this.sizeGuideOpen.set(false);
          this.imageIndex.set(0);
          this.quantity.set(1);
          this.added.set(false);
          // A single size or color is chosen for the customer, a favorite comes with the ones saved with it.
          const saved = this.favorites.item(product.id);
          this.size.set(this.sizes().length === 1 ? this.sizes()[0] : saved?.size && this.sizes().includes(saved.size) ? saved.size : null);
          this.color.set(this.colors().length === 1 ? this.colors()[0] : saved?.color && this.colors().includes(saved.color) ? saved.color : null);
          this.alertState.set('idle');
          this.otherEmail.set(false);
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

  pickSize(size: string): void {
    this.size.set(size);
    this.updateFavorite();
  }

  pickColor(color: string): void {
    this.color.set(color);
    this.updateFavorite();
  }

  toggleFavorite(): void {
    const product = this.product();
    if (product) this.favorites.toggle(product, this.size(), this.color());
  }

  // A favorite keeps the size and color picked last.
  private updateFavorite(): void {
    const product = this.product();
    if (product && this.favorite()) this.favorites.save(product, this.size(), this.color());
  }

  // "materijal: pamuk" is shown as "pamuk".
  keywordLabel(keyword: string): string {
    return keywordValue(keyword);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const buy = this.buy()?.nativeElement;
    this.stickyBar.set(!!buy && buy.getBoundingClientRect().bottom < 0);
  }

  // From the bar at the bottom: adds when a size and color are chosen, otherwise goes up to choose them.
  stickyAdd(): void {
    if (this.variant()?.inStock) this.addToCart();
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addToCart(): void {
    const product = this.product();
    const variant = this.variant();
    if (!product || !variant?.inStock) return;

    // Counted like a page view: only the product and the day.
    this.api.countVisit('/u-kosaricu/' + product.slug);
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
    const memberEmail = this.otherEmail() ? null : this.account.me()?.email;
    if (memberEmail) this.alertEmail.set(memberEmail);
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
      // Read by search engines for the product's price and availability, and the path to it.
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [{
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Shop', item: environment.siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: product.category,
              item: environment.siteUrl + '/?kategorija=' + encodeURIComponent(product.category) },
            { '@type': 'ListItem', position: 3, name: product.name },
          ],
        }, {
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
        }],
      },
    });
  }

  private unique(select: (variant: Variant) => string | null): string[] {
    const values = (this.product()?.variants ?? []).map(select).filter((x): x is string => !!x);
    return [...new Set(values)];
  }
}
