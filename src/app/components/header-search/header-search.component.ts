import { Component, ElementRef, HostListener, computed, signal, viewChild } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ShopApiService } from '../../core/shop-api.service';
import { Product, formatPrice } from '../../core/models';
import { matches, emptyFilter } from '../../core/catalog';

const MaxSuggestions = 6;

/**
 * Search in the header: products appear while typing, Enter shows all
 * results in the catalog. On phones it opens from the magnifier icon.
 */
@Component({
  selector: 'app-header-search',
  templateUrl: './header-search.component.html',
  styleUrl: './header-search.component.scss'
})
export class HeaderSearchComponent {
  private readonly products = signal<Product[]>([]);
  readonly text = signal('');
  readonly focused = signal(false);
  // The field is open on phones.
  readonly open = signal(false);
  readonly active = signal(-1);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly found = computed(() => {
    const text = this.text().trim();
    if (text.length < 2) return [];
    return this.products().filter((x) => matches(x, { ...emptyFilter(), search: text }));
  });
  readonly shown = computed(() => this.found().slice(0, MaxSuggestions));
  readonly showPanel = computed(() => this.focused() && this.text().trim().length >= 2);

  readonly formatPrice = formatPrice;
  private loaded = false;

  constructor(public api: ShopApiService, private router: Router, private host: ElementRef<HTMLElement>) {
    router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => {
      this.focused.set(false);
      this.open.set(false);
    });
  }

  onFocus(): void {
    this.focused.set(true);
    // The catalog is loaded only when someone searches.
    if (!this.loaded) {
      this.loaded = true;
      this.api.getProducts().subscribe({ next: (products) => this.products.set(products) });
    }
  }

  openField(): void {
    this.open.set(true);
    setTimeout(() => this.input()?.nativeElement.focus());
  }

  setText(text: string): void {
    this.text.set(text);
    this.active.set(-1);
  }

  onKey(event: KeyboardEvent): void {
    const count = this.shown().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active.update((x) => (x + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.update((x) => (x <= 0 ? count - 1 : x - 1));
    } else if (event.key === 'Escape') {
      this.focused.set(false);
      this.open.set(false);
      this.input()?.nativeElement.blur();
    }
  }

  submit(): void {
    const product = this.shown()[this.active()];
    if (product) {
      this.openProduct(product);
      return;
    }
    const text = this.text().trim();
    if (!text) return;
    this.router.navigate(['/'], { queryParams: { trazi: text } });
    this.input()?.nativeElement.blur();
  }

  openProduct(product: Product): void {
    this.router.navigate(['/proizvod', product.slug]);
    this.text.set('');
  }

  // A click outside closes the suggestions.
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointer(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.focused.set(false);
      this.open.set(false);
    }
  }
}
