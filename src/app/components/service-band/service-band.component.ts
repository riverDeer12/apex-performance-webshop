import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopApiService } from '../../core/shop-api.service';
import { ShopSettings, formatPrice } from '../../core/models';

/** Delivery, returns and payment, as a band across the page above the footer. */
@Component({
  selector: 'app-service-band',
  imports: [RouterLink],
  templateUrl: './service-band.component.html',
  styleUrl: './service-band.component.scss'
})
export class ServiceBandComponent {
  readonly settings = signal<ShopSettings | null>(null);
  readonly formatPrice = formatPrice;

  constructor(api: ShopApiService) {
    api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });
  }
}
