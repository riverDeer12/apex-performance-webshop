import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { CartService } from '../../core/cart.service';
import { Product, clientUnitDiscount, formatPrice, variantName } from '../../core/models';
import { colorHexes, compareSizes, swatchBackground } from '../../core/catalog';
import { FavoritesService } from '../../core/favorites.service';

// Products added in the last 30 days are marked "Novo".
const NewDays = 30;
// Colors shown as swatches, the rest as "+2".
const SwatchesShown = 5;

const LightColors = ['#ffffff', '#f3ead8', '#d9c7a8', '#c9ccd2', '#f2c94c', '#d7f542', '#a8e6cf'];

/**
 * Product in a list: picture, colors, name and price (the client price for
 * clients). A color can be picked right on the card, and a size adds the
 * product to the cart without opening it.
 */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  // Size and color saved with a favorite, shown and picked on the favorites page.
  readonly picked = input<{ size: string | null; color: string | null } | null>(null);

  readonly color = signal<string | null>(null);
  // Sizes over the picture; on phones opened with the "+" button, elsewhere on hover.
  readonly quickOpen = signal(false);
  readonly addedSize = signal<string | null>(null);

  readonly soldOut = computed(() => this.product().variants.every((x) => !x.inStock));
  readonly favorite = computed(() => this.favorites.ids().includes(this.product().id));
  readonly isNew = computed(() => {
    const created = this.product().createdAt;
    return !!created && Date.now() - new Date(created).getTime() < NewDays * 86400000;
  });

  private readonly colorNames = computed(() =>
    [...new Set(this.product().variants.map((x) => x.color?.trim()).filter((x): x is string => !!x))]);

  readonly colors = computed(() => {
    const names = this.colorNames();
    return {
      shown: names.slice(0, SwatchesShown).map((name) => ({
        name, background: swatchBackground(name), light: colorHexes(name).some((hex) => LightColors.includes(hex)),
        inStock: this.product().variants.some((v) => v.color?.trim() === name && v.inStock),
      })),
      more: Math.max(0, names.length - SwatchesShown),
    };
  });

  // All sizes of the product; the ones not in stock in the picked color are crossed out.
  readonly sizes = computed(() => {
    const product = this.product();
    const color = this.color();
    const names = [...new Set(product.variants.map((x) => x.size?.trim()).filter((x): x is string => !!x))].sort(compareSizes);
    return names.map((name) => ({
      name,
      inStock: product.variants.some((v) => v.size?.trim() === name && v.inStock && (color === null || v.color?.trim() === color)),
    }));
  });

  readonly clientPrice = computed(() => {
    const percent = this.account.clientDiscount();
    const price = this.product().price;
    return percent > 0 ? price - clientUnitDiscount(percent, price) : null;
  });

  readonly pickedLabel = computed(() => {
    const picked = this.picked();
    return picked ? variantName(picked) : '';
  });

  readonly formatPrice = formatPrice;

  constructor(public api: ShopApiService, private account: AccountService, public favorites: FavoritesService,
              private cart: CartService) {
    // The saved color of a favorite, otherwise the first color in stock.
    effect(() => {
      const picked = this.picked()?.color;
      const names = this.colorNames();
      const product = this.product();
      untracked(() => this.color.set(
        picked && names.includes(picked) ? picked
          : names.find((name) => product.variants.some((v) => v.color?.trim() === name && v.inStock)) ?? names[0] ?? null));
    });
  }

  pickColor(name: string): void {
    this.color.set(name);
    // A favorite keeps the color picked last.
    if (this.favorite()) {
      const saved = this.favorites.item(this.product().id);
      this.favorites.save(this.product(), saved?.size ?? null, name);
    }
  }

  toggleFavorite(): void {
    this.favorites.toggle(this.product(), this.picked()?.size ?? null, this.colorNames().length > 1 ? this.color() : null);
  }

  // Adds the size (or the only variant) in the picked color.
  quickAdd(size: string | null): void {
    const product = this.product();
    const color = this.color();
    const variant = product.variants.find((v) => v.inStock &&
      (size === null || v.size?.trim() === size) && (color === null || !v.color || v.color.trim() === color));
    if (!variant) return;

    this.api.countVisit('/u-kosaricu/' + product.slug);
    this.cart.add({
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      variantName: variantName(variant),
      price: product.price,
      imageId: product.imageIds[0] ?? null,
    }, 1);

    this.addedSize.set(size ?? '');
    this.quickOpen.set(false);
    setTimeout(() => this.addedSize.set(null), 1600);
  }
}
