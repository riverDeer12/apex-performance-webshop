import { Component, HostListener, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import {
  CatalogFilter, FacetName, activeFilterCount, emptyFilter, facet, matches, swatchBackground,
} from '../../core/catalog';

export type ProductSort = 'preporuceno' | 'cijena-rastuce' | 'cijena-padajuce' | 'najnovije';

// Products shown at first and added by "Prikaži još".
const PageSize = 24;
// Keywords shown before "Prikaži sve".
const KeywordsShown = 12;

const Sorts: { value: ProductSort; label: string }[] = [
  { value: 'preporuceno', label: 'Preporučeno' },
  { value: 'cijena-rastuce', label: 'Cijena: od najniže' },
  { value: 'cijena-padajuce', label: 'Cijena: od najviše' },
  { value: 'najnovije', label: 'Najnovije' },
];

// Filters in the address: ?kategorija=Majice,Hlačice&boja=Crna&velicina=M&oznaka=trening&dostupno=1
const Params: Record<FacetName, string> = {
  categories: 'kategorija',
  colors: 'boja',
  sizes: 'velicina',
  keywords: 'oznaka',
};

const FacetTitles: Record<FacetName, string> = {
  categories: 'Kategorija',
  colors: 'Boja',
  sizes: 'Veličina',
  keywords: 'Ključne riječi',
};

/**
 * Catalog of the shop: search, filters by category, color, size and keyword,
 * sorting and 24 products at a time. The choice is kept in the address, so
 * coming back from a product shows the same list.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly products = signal<Product[] | null>(null);
  readonly failed = signal(false);

  readonly filter = signal<CatalogFilter>(emptyFilter());
  readonly sort = signal<ProductSort>('preporuceno');
  readonly shown = signal(PageSize);
  // Filters as a panel over the page on phones.
  readonly filtersOpen = signal(false);
  readonly allKeywords = signal(false);

  private readonly all = computed(() => this.products() ?? []);

  readonly categories = computed(() => facet(this.all(), this.filter(), 'categories'));
  readonly colors = computed(() => facet(this.all(), this.filter(), 'colors')
    .map((x) => ({ ...x, background: swatchBackground(x.value) })));
  readonly sizes = computed(() => facet(this.all(), this.filter(), 'sizes'));
  readonly keywords = computed(() => {
    const values = facet(this.all(), this.filter(), 'keywords');
    const picked = this.filter().keywords;
    return this.allKeywords() ? values : values.filter((x, i) => i < KeywordsShown || picked.includes(x.value));
  });
  readonly moreKeywords = computed(() =>
    Math.max(0, facet(this.all(), emptyFilter(), 'keywords').length - KeywordsShown));

  readonly matching = computed(() => {
    const list = this.all().filter((product) => matches(product, this.filter()));

    switch (this.sort()) {
      case 'cijena-rastuce': return [...list].sort((a, b) => a.price - b.price);
      case 'cijena-padajuce': return [...list].sort((a, b) => b.price - a.price);
      case 'najnovije': return [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      // The order set in the administration, as the API sends it.
      default: return list;
    }
  });

  readonly visible = computed(() => this.matching().slice(0, this.shown()));
  readonly remaining = computed(() => Math.max(0, this.matching().length - this.shown()));
  readonly activeCount = computed(() => activeFilterCount(this.filter()));

  // Picked filters as removable chips above the products.
  readonly activeChips = computed(() => {
    const filter = this.filter();
    const chips = (Object.keys(Params) as FacetName[])
      .flatMap((name) => filter[name].map((value) => ({ name, value, label: value })));
    return filter.inStockOnly ? [...chips, { name: 'inStock' as const, value: '', label: 'Na zalihi' }] : chips;
  });

  // Filters shown at all: a shop with one category doesn't need the category filter.
  readonly hasFilters = computed(() =>
    this.categories().length > 1 || this.colors().length > 1 || this.sizes().length > 1 || this.keywords().length > 0);

  // Client discount offered in the shop, shown to visitors who are not logged in.
  readonly offeredDiscount = signal(0);

  readonly sorts = Sorts;
  readonly facetTitles = FacetTitles;
  readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor(public api: ShopApiService, public account: AccountService, private router: Router,
              route: ActivatedRoute, seo: SeoService) {
    seo.set({ path: '/' });

    const params = route.snapshot.queryParamMap;
    const list = (name: string) => (params.get(name) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    this.filter.set({
      search: params.get('trazi') ?? '',
      categories: list(Params.categories),
      colors: list(Params.colors),
      sizes: list(Params.sizes),
      keywords: list(Params.keywords),
      inStockOnly: params.get('dostupno') === '1',
    });
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

  @HostListener('document:keydown.escape')
  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  // "1 proizvod", "21 proizvod", "3 proizvoda", "12 proizvoda".
  countLabel(count: number): string {
    return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'proizvod' : 'proizvoda'}`;
  }

  setSearch(text: string): void {
    this.update({ ...this.filter(), search: text });
  }

  isPicked(name: FacetName, value: string): boolean {
    return this.filter()[name].includes(value);
  }

  toggle(name: FacetName, value: string): void {
    const values = this.filter()[name];
    this.update({
      ...this.filter(),
      [name]: values.includes(value) ? values.filter((x) => x !== value) : [...values, value],
    });
  }

  // Only one category at a time from the chips above the list.
  pickCategory(category: string | null): void {
    this.update({ ...this.filter(), categories: category ? [category] : [] });
  }

  setInStockOnly(value: boolean): void {
    this.update({ ...this.filter(), inStockOnly: value });
  }

  removeChip(chip: { name: FacetName | 'inStock'; value: string }): void {
    if (chip.name === 'inStock') this.setInStockOnly(false);
    else this.toggle(chip.name, chip.value);
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
    this.update({ ...emptyFilter(), search: this.filter().search });
  }

  clearAll(): void {
    this.update(emptyFilter());
  }

  private update(filter: CatalogFilter): void {
    this.filter.set(filter);
    this.shown.set(PageSize);
    this.updateAddress();
  }

  private updateAddress(): void {
    const filter = this.filter();
    const join = (values: string[]) => (values.length ? values.join(',') : null);

    this.router.navigate([], {
      queryParams: {
        trazi: filter.search.trim() || null,
        [Params.categories]: join(filter.categories),
        [Params.colors]: join(filter.colors),
        [Params.sizes]: join(filter.sizes),
        [Params.keywords]: join(filter.keywords),
        dostupno: filter.inStockOnly ? '1' : null,
        sort: this.sort() === 'preporuceno' ? null : this.sort(),
        prikazano: this.shown() > PageSize ? this.shown() : null,
      },
      replaceUrl: true,
    });
  }
}
