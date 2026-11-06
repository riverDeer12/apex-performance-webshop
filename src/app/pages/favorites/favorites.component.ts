import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { FavoritesService } from '../../core/favorites.service';
import { SeoService } from '../../core/seo.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

/** Products marked with the heart, in the order they were marked (newest first). */
@Component({
  selector: 'app-favorites',
  imports: [RouterLink, ProductCardComponent],
  template: `
    <section class="container">
      <header class="page-title">
        <p class="brand-eyebrow">APEX PERFORMANCE</p>
        <h1>Favoriti</h1>
        <p>Proizvodi koje ste označili srcem, spremljeni u ovom pregledniku.</p>
      </header>

      @if (products() === null) {
        <div class="grid">
          @for (item of [1, 2, 3, 4]; track item) { <div class="skeleton tile"></div> }
        </div>
      } @else if (favorites().length === 0) {
        <div class="empty card-surface">
          <h2>Još nema favorita</h2>
          <p class="muted">Dodirnite srce na proizvodu i spremite ga za kasnije.</p>
          <a routerLink="/" class="button">Pogledaj proizvode <span class="arrow" aria-hidden="true">→</span></a>
        </div>
      } @else {
        <div class="grid">
          @for (product of favorites(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, 1fr); gap: 18px; } }
    @media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, 1fr); } }
    .tile { aspect-ratio: 4 / 6; border-radius: var(--radius-card); }
    .empty { padding: 48px 24px; text-align: center; }
    .empty h2 { font-size: 18px; text-transform: uppercase; }
    .empty p { margin: 10px 0 20px; }
  `]
})
export class FavoritesComponent {
  readonly products = signal<Product[] | null>(null);

  // Products no longer in the shop are left out.
  readonly favorites = computed(() => {
    const byId = new Map((this.products() ?? []).map((x) => [x.id, x]));
    return this.favoritesService.ids().map((id) => byId.get(id)).filter((x): x is Product => !!x);
  });

  constructor(api: ShopApiService, private favoritesService: FavoritesService, seo: SeoService) {
    seo.set({ title: 'Favoriti', path: '/favoriti' });
    api.getProducts().subscribe({ next: (products) => this.products.set(products), error: () => this.products.set([]) });
  }
}
