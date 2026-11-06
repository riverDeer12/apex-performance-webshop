import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { Product, clientUnitDiscount, formatPrice } from '../../core/models';
import { colorHexes, compareSizes, swatchBackground } from '../../core/catalog';
import { FavoritesService } from '../../core/favorites.service';

// Products added in the last 30 days are marked "Novo".
const NewDays = 30;

/** Product in a list: picture, colors, name and price (the client price for clients). */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  readonly product = input.required<Product>();

  readonly soldOut = computed(() => this.product().variants.every((x) => !x.inStock));
  readonly favorite = computed(() => this.favorites.ids().includes(this.product().id));
  readonly isNew = computed(() => {
    const created = this.product().createdAt;
    return !!created && Date.now() - new Date(created).getTime() < NewDays * 86400000;
  });

  // Up to five colors as swatches, the rest as "+2".
  readonly colors = computed(() => {
    const names = [...new Set(this.product().variants.map((x) => x.color?.trim()).filter((x): x is string => !!x))];
    return { shown: names.slice(0, 5).map((name) => ({ name, background: swatchBackground(name), light: this.isLight(name) })),
      more: Math.max(0, names.length - 5), label: 'Boje: ' + names.join(', ') };
  });

  readonly sizes = computed(() => {
    const sizes = [...new Set(this.product().variants.filter((x) => x.inStock && x.size).map((x) => x.size!))];
    return sizes.sort(compareSizes);
  });

  readonly clientPrice = computed(() => {
    const percent = this.account.clientDiscount();
    const price = this.product().price;
    return percent > 0 ? price - clientUnitDiscount(percent, price) : null;
  });

  readonly formatPrice = formatPrice;

  constructor(public api: ShopApiService, private account: AccountService, public favorites: FavoritesService) {}

  private isLight(name: string): boolean {
    return colorHexes(name).some((hex) => ['#ffffff', '#f3ead8', '#d9c7a8', '#c9ccd2', '#f2c94c', '#d7f542', '#a8e6cf'].includes(hex));
  }
}
