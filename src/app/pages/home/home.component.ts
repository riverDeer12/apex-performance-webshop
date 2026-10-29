import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { Product, clientUnitDiscount, formatPrice } from '../../core/models';

export type ProductSort = 'preporuceno' | 'cijena-rastuce' | 'cijena-padajuce' | 'najnovije';

// Products shown at first and added by "Prikaži još".
const PageSize = 24;

const Sorts: { value: ProductSort; label: string }[] = [
  { value: 'preporuceno', label: 'Preporučeno' },
  { value: 'cijena-rastuce', label: 'Cijena: od najniže' },
  { value: 'cijena-padajuce', label: 'Cijena: od najviše' },
  { value: 'najnovije', label: 'Najnovije' },
];

// Lower case without diacritics, so "carape" finds "Čarape".
const normalize = (text: string) =>
  text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Catalog of the shop: search, category, sorting and 24 products at a time.
 * The choice is kept in the address, so coming back from a product shows the
 * same list (and the browser returns to the same place on it).
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly products = signal<Product[] | null>(null);
  readonly failed = signal(false);

  readonly search = signal('');
  // null shows all categories.
  readonly category = signal<string | null>(null);
  readonly sort = signal<ProductSort>('preporuceno');
  readonly shown = signal(PageSize);

  // Products matching the search, before the category: the category chips count these.
  private readonly found = computed(() => {
    const words = normalize(this.search().trim()).split(/\s+/).filter(Boolean);
    const products = this.products() ?? [];

    if (words.length === 0) return products;

    return products.filter((product) => {
      const text = normalize(`${product.name} ${product.category} ${product.description}`);
      return words.every((word) => text.includes(word));
    });
  });

  readonly categories = computed(() => {
    const counts = new Map<string, number>();
    for (const product of this.products() ?? []) counts.set(product.category, 0);
    for (const product of this.found()) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  });

  readonly matching = computed(() => {
    const list = this.found().filter((x) => !this.category() || x.category === this.category());

    switch (this.sort()) {
      case 'cijena-rastuce': return [...list].sort((a, b) => a.price - b.price);
      case 'cijena-padajuce': return [...list].sort((a, b) => b.price - a.price);
      case 'najnovije': return [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      // The order set in the administration, as the API sends it.
      default: return list;
    }
  });

  readonly visible = computed(() => this.matching().slice(0, this.shown()));
  // Matching the search in all categories, for the "Sve" chip.
  readonly matchingAll = computed(() => this.found().length);
  readonly remaining = computed(() => Math.max(0, this.matching().length - this.shown()));

  // Client discount offered in the shop, shown to visitors who are not logged in.
  readonly offeredDiscount = signal(0);

  readonly sorts = Sorts;
  readonly formatPrice = formatPrice;
  readonly placeholders = [1, 2, 3, 4];

  constructor(public api: ShopApiService, public account: AccountService, private router: Router,
              route: ActivatedRoute, seo: SeoService) {
    seo.set({ path: '/' });

    const params = route.snapshot.queryParamMap;
    this.search.set(params.get('trazi') ?? '');
    this.category.set(params.get('kategorija'));
    const sort = params.get('sort') as ProductSort | null;
    if (sort && Sorts.some((x) => x.value === sort)) this.sort.set(sort);
    const shown = Number(params.get('prikazano'));
    if (shown > PageSize) this.shown.set(Math.ceil(shown / PageSize) * PageSize);

    api.getSettings().subscribe({ next: (settings) => this.offeredDiscount.set(settings.clientDiscountPercent) });

    api.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.failed.set(true),
    });
  }

  setSearch(text: string): void {
    this.search.set(text);
    this.shown.set(PageSize);
    this.updateAddress();
  }

  setCategory(category: string | null): void {
    this.category.set(category);
    this.shown.set(PageSize);
    this.updateAddress();
  }

  setSort(sort: ProductSort): void {
    this.sort.set(sort);
    this.shown.set(PageSize);
    this.updateAddress();
  }

  showMore(): void {
    this.shown.update((x) => x + PageSize);
    this.updateAddress();
  }

  clearFilters(): void {
    this.search.set('');
    this.category.set(null);
    this.shown.set(PageSize);
    this.updateAddress();
  }

  // Price for a logged in client of the studio, null for everyone else.
  clientPrice(product: Product): number | null {
    const percent = this.account.clientDiscount();
    return percent > 0 ? product.price - clientUnitDiscount(percent, product.price) : null;
  }

  soldOut = (product: Product) => product.variants.every((x) => !x.inStock);

  private updateAddress(): void {
    this.router.navigate([], {
      queryParams: {
        trazi: this.search().trim() || null,
        kategorija: this.category(),
        sort: this.sort() === 'preporuceno' ? null : this.sort(),
        prikazano: this.shown() > PageSize ? this.shown() : null,
      },
      replaceUrl: true,
    });
  }
}
