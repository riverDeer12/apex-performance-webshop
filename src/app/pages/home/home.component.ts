import { Component, HostListener, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { AccountService } from '../../core/account.service';
import { SeoService } from '../../core/seo.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
import {
  CatalogFilter, FacetName, KeywordGroups, activeFilterCount, emptyFilter, facet, keywordGroup, keywordValue, matches,
  sizeKind, swatchBackground,
} from '../../core/catalog';

export type ProductSort = 'preporuceno' | 'cijena-rastuce' | 'cijena-padajuce' | 'najnovije';

// Products shown at first and added by "Prikaži još".
const PageSize = 24;
// Keywords of a group shown before "Prikaži sve".
const KeywordsShown = 12;
// The filter column hidden on wide screens, remembered in the browser.
const FiltersHiddenKey = 'apex-shop-filters-hidden';

const Genders = [
  { value: 'women' as const, label: 'Žene', param: 'zene' },
  { value: 'men' as const, label: 'Muškarci', param: 'muskarci' },
];

const SizeKinds = [
  { kind: 'letters' as const, title: 'Slovne' },
  { kind: 'numbers' as const, title: 'Brojevi' },
  { kind: 'other' as const, title: 'Ostale' },
];

const Sorts: { value: ProductSort; label: string }[] = [
  { value: 'preporuceno', label: 'Preporučeno' },
  { value: 'cijena-rastuce', label: 'Cijena: od najniže' },
  { value: 'cijena-padajuce', label: 'Cijena: od najviše' },
  { value: 'najnovije', label: 'Najnovije' },
];

// Filters in the address: ?za=zene&kategorija=Majice,Hlačice&boja=Crna&velicina=M&oznaka=trening&cijena=10-50&dostupno=1
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

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
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
  // Filter column on wide screens, hidden to give the products the whole width.
  readonly filtersHidden = signal(readStorage(FiltersHiddenKey) === '1');

  private readonly all = computed(() => this.products() ?? []);

  readonly categories = computed(() => facet(this.all(), this.filter(), 'categories'));
  readonly colors = computed(() => facet(this.all(), this.filter(), 'colors')
    .map((x) => ({ ...x, background: swatchBackground(x.value) })));
  readonly sizes = computed(() => facet(this.all(), this.filter(), 'sizes'));
  // Sizes in letters and in numbers apart, as the size guides have them.
  readonly sizeGroups = computed(() => SizeKinds
    .map((x) => ({ ...x, values: this.sizes().filter((size) => sizeKind(size.value) === x.kind) }))
    .filter((x) => x.values.length > 0));

  // Keywords in their groups (material, collection ...), each group a filter of its own.
  readonly keywordGroups = computed(() => {
    const values = facet(this.all(), this.filter(), 'keywords');
    const picked = this.filter().keywords;
    return KeywordGroups
      .map((group) => {
        const all = values.filter((x) => keywordGroup(x.value) === group.name)
          .map((x) => ({ ...x, label: keywordValue(x.value) }));
        const shown = this.allKeywords() ? all : all.filter((x, i) => i < KeywordsShown || picked.includes(x.value));
        return { ...group, values: shown, more: all.length - shown.length };
      })
      .filter((x) => x.values.length > 0);
  });

  // Gender chips above the list, when products have a gender set.
  readonly genders = computed(() =>
    this.all().some((x) => x.gender === 'women' || x.gender === 'men' || x.gender === 'unisex') ? Genders : []);

  // Lowest and highest price, as the placeholders of the price range.
  readonly priceBounds = computed(() => {
    const prices = this.all().map((x) => x.price);
    return prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null;
  });

  // "Shop / Žene / Majice" above the title.
  readonly breadcrumbs = computed(() => {
    const filter = this.filter();
    const gender = Genders.find((x) => x.value === filter.gender);
    const category = filter.categories.length === 1 ? filter.categories[0] : null;
    const crumbs: { label: string; gender: string | null; category: string | null }[] = [];
    if (gender) crumbs.push({ label: gender.label, gender: gender.value, category: null });
    if (category) crumbs.push({ label: category, gender: gender?.value ?? null, category });
    return crumbs;
  });

  // Pictures of the first products in stock, shown in the banner.
  readonly bannerProducts = computed(() =>
    this.all().filter((x) => x.imageIds.length && x.variants.some((v) => v.inStock)).slice(0, 3));

  readonly title = computed(() => {
    const crumbs = this.breadcrumbs();
    return crumbs.length ? crumbs.map((x) => x.label).join(' · ') : 'Shop';
  });

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
      .flatMap((name) => filter[name].map((value) => ({ name, value, label: name === 'keywords' ? keywordValue(value) : value })));
    const extra: { name: 'inStock' | 'price'; value: string; label: string }[] = [];
    if (filter.priceMin !== null || filter.priceMax !== null) {
      extra.push({ name: 'price', value: '', label: this.priceLabel(filter) });
    }
    if (filter.inStockOnly) extra.push({ name: 'inStock', value: '', label: 'Na zalihi' });
    return [...chips, ...extra];
  });

  // Filters shown at all: a shop with one category doesn't need the category filter.
  readonly hasFilters = computed(() =>
    this.categories().length > 1 || this.colors().length > 1 || this.sizes().length > 1 || this.keywordGroups().length > 0 ||
    (this.priceBounds()?.max ?? 0) > (this.priceBounds()?.min ?? 0));

  // Products the visitor opened before, newest first.
  readonly recent = computed(() => {
    const byId = new Map(this.all().map((x) => [x.id, x]));
    return this.recentlyViewed.ids().map((id) => byId.get(id)).filter((x): x is Product => !!x).slice(0, 8);
  });

  // Client discount offered in the shop, shown to visitors who are not logged in.
  readonly offeredDiscount = signal(0);

  readonly sorts = Sorts;
  readonly facetTitles = FacetTitles;
  readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor(public api: ShopApiService, public account: AccountService, private router: Router,
              route: ActivatedRoute, seo: SeoService, private recentlyViewed: RecentlyViewedService) {
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
      gender: Genders.find((x) => x.param === params.get('za'))?.value ?? null,
      ...this.readPrice(params.get('cijena')),
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

  removeChip(chip: { name: FacetName | 'inStock' | 'price'; value: string }): void {
    if (chip.name === 'inStock') this.setInStockOnly(false);
    else if (chip.name === 'price') this.update({ ...this.filter(), priceMin: null, priceMax: null });
    else this.toggle(chip.name, chip.value);
  }

  // Women's or men's products, or all with null; picking the same one again shows all.
  pickGender(gender: 'women' | 'men' | null): void {
    this.update({ ...this.filter(), gender: this.filter().gender === gender ? null : gender });
  }

  // From the "od" and "do" fields; an empty field has no limit.
  setPrice(which: 'priceMin' | 'priceMax', text: string): void {
    const value = text.trim() === '' ? null : Number(text.replace(',', '.'));
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    if (this.filter()[which] === value) return;
    this.update({ ...this.filter(), [which]: value });
  }

  // On wide screens hides or shows the filter column; on phones opens the filters panel.
  toggleFilters(): void {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.filtersHidden.update((x) => !x);
      try {
        localStorage.setItem(FiltersHiddenKey, this.filtersHidden() ? '1' : '0');
      } catch {
        // Not remembered, still works on this page.
      }
    } else {
      this.filtersOpen.set(true);
    }
  }

  private priceLabel(filter: CatalogFilter): string {
    if (filter.priceMin !== null && filter.priceMax !== null) return `${filter.priceMin}–${filter.priceMax} €`;
    return filter.priceMin !== null ? `od ${filter.priceMin} €` : `do ${filter.priceMax} €`;
  }

  // "10-50", "10-" or "-50".
  private readPrice(text: string | null): Pick<CatalogFilter, 'priceMin' | 'priceMax'> {
    const [min, max] = (text ?? '').split('-').map((x) => (x.trim() === '' ? null : Number(x)));
    const valid = (x: number | null | undefined) => (x !== null && x !== undefined && !Number.isNaN(x) && x >= 0 ? x : null);
    return { priceMin: valid(min), priceMax: valid(max) };
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

  // Keeps the search and the gender, which are not in the filter panel.
  clearFilters(): void {
    this.update({ ...emptyFilter(), search: this.filter().search, gender: this.filter().gender });
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
        za: Genders.find((x) => x.value === filter.gender)?.param ?? null,
        [Params.categories]: join(filter.categories),
        [Params.colors]: join(filter.colors),
        [Params.sizes]: join(filter.sizes),
        [Params.keywords]: join(filter.keywords),
        cijena: filter.priceMin !== null || filter.priceMax !== null
          ? `${filter.priceMin ?? ''}-${filter.priceMax ?? ''}` : null,
        dostupno: filter.inStockOnly ? '1' : null,
        sort: this.sort() === 'preporuceno' ? null : this.sort(),
        prikazano: this.shown() > PageSize ? this.shown() : null,
      },
      replaceUrl: true,
    });
  }
}
