import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ShopApiService } from '../../core/shop-api.service';
import { SeoService } from '../../core/seo.service';
import { ShopSettings, formatPrice } from '../../core/models';

export type LegalPage = 'terms' | 'returns' | 'privacy';

const Pages: Record<LegalPage, { title: string; path: string; description: string }> = {
  terms: {
    title: 'Opći uvjeti kupnje',
    path: '/uvjeti-kupnje',
    description: 'Opći uvjeti kupnje u Apex Performance Shopu: narudžba, cijene, plaćanje i dostava.',
  },
  returns: {
    title: 'Povrat i reklamacije',
    path: '/povrat-i-reklamacije',
    description: 'Pravo na jednostrani raskid ugovora u 14 dana, obrazac za raskid i reklamacije.',
  },
  privacy: {
    title: 'Privatnost i kolačići',
    path: '/privatnost',
    description: 'Kako Apex Performance Shop obrađuje osobne podatke i koje podatke sprema u pregledniku.',
  },
};

/**
 * Legal pages of the shop: terms of sale, the right to withdraw with its form,
 * and privacy. Seller details are the ones of the Apex Performance obrt.
 */
@Component({
  selector: 'app-legal',
  imports: [RouterLink],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.scss'
})
export class LegalComponent {
  readonly page: LegalPage;
  readonly settings = signal<ShopSettings | null>(null);
  // Drafts until the lawyer has checked them, the test shop says so.
  readonly isTest = environment.isTest;
  readonly shopUrl = environment.siteUrl;
  readonly formatPrice = formatPrice;
  readonly updated = '29. 10. 2026.';

  constructor(route: ActivatedRoute, api: ShopApiService, seo: SeoService) {
    this.page = route.snapshot.data['page'] as LegalPage;
    seo.set(Pages[this.page]);
    api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });
  }

  print(): void {
    window.print();
  }
}
