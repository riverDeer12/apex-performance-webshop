import { AfterViewChecked, Component, NgZone, OnDestroy, computed, effect, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ShopApiService } from '../../core/shop-api.service';
import { CartService, MaxQuantity } from '../../core/cart.service';
import { PromoCheck, ShopSettings, formatPrice } from '../../core/models';

const BoxNowScript = 'https://widget-cdn.boxnow.hr/map-widget/client/v5.js';

interface BoxNowSelection {
  boxnowLockerId: string;
  boxnowLockerAddressLine1: string;
  boxnowLockerPostalCode: string;
}

/**
 * Cart, the BoxNow locker and the way to Stripe Checkout. Prices and stock
 * are checked again with the shop when the page opens and at checkout.
 */
@Component({
  selector: 'app-cart',
  imports: [RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements AfterViewChecked, OnDestroy {
  readonly settings = signal<ShopSettings | null>(null);
  // Variants that are no longer sold or have no stock left.
  readonly unavailable = signal<Set<string>>(new Set());
  readonly choosingLocker = signal(false);
  readonly paying = signal(false);
  readonly error = signal<string | null>(null);

  readonly promoInput = signal('');
  readonly promo = signal<(PromoCheck & { checkedFor?: string }) | null>(null);
  readonly promoError = signal<string | null>(null);
  readonly checkingPromo = signal(false);

  // Discount per piece from the shop, multiplied here so changing quantities needs no new check.
  readonly discount = computed(() => {
    const promo = this.promo();
    if (!promo) return 0;

    return this.cart.items().reduce((sum, item) =>
      sum + (promo.items.find((x) => x.variantId === item.variantId)?.unitDiscount ?? 0) * item.quantity, 0);
  });
  readonly productsTotal = computed(() => this.cart.subtotal() - this.discount());

  readonly shipping = computed(() => {
    const settings = this.settings();
    if (!settings) return null;
    return this.productsTotal() >= settings.freeShippingFrom ? 0 : settings.shippingPrice;
  });
  readonly total = computed(() => this.productsTotal() + (this.shipping() ?? 0));
  readonly missingForFree = computed(() => {
    const settings = this.settings();
    return settings ? Math.max(0, settings.freeShippingFrom - this.productsTotal()) : 0;
  });

  // Products in the cart, without quantities: a new product needs a new promo check.
  private readonly variantKey = computed(() => this.cart.items().map((x) => x.variantId).sort().join(','));

  readonly formatPrice = formatPrice;
  readonly maxQuantity = MaxQuantity;

  private mapLoaded = false;

  constructor(public api: ShopApiService, public cart: CartService, private zone: NgZone) {
    api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });
    this.choosingLocker.set(!cart.locker());
    this.checkProducts();

    effect(() => {
      this.variantKey();
      const code = this.cart.promoCode();
      untracked(() => {
        // Applying a code already checked it for these products.
        if (code && this.cart.items().length > 0) {
          if (this.promo()?.code !== code || !this.promoCovers()) this.checkPromo(code, true);
        }
        else this.promo.set(null);
      });
    });
  }

  applyPromo(): void {
    const code = this.promoInput().trim().toUpperCase();
    if (code) this.checkPromo(code, false);
  }

  removePromo(): void {
    this.cart.promoCode.set(null);
    this.promo.set(null);
    this.promoError.set(null);
    this.promoInput.set('');
  }

  private promoCovers(): boolean {
    return this.promo()?.checkedFor === this.variantKey();
  }

  discountOf(variantId: string): number {
    return this.promo()?.items.find((x) => x.variantId === variantId)?.unitDiscount ?? 0;
  }

  private checkPromo(code: string, silent: boolean): void {
    this.checkingPromo.set(true);
    this.promoError.set(null);

    this.api.checkPromo(code, this.cart.items()).subscribe({
      next: (promo) => {
        this.checkingPromo.set(false);
        this.promo.set({ ...promo, checkedFor: this.variantKey() });
        this.cart.promoCode.set(promo.code);
        this.promoInput.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.checkingPromo.set(false);
        this.promo.set(null);
        // A saved code that stopped working is dropped, with the reason shown.
        this.cart.promoCode.set(null);
        this.promoError.set(this.promoMessage(error, code));
        if (silent) this.promoInput.set(code);
      },
    });
  }

  private promoMessage(error: HttpErrorResponse, code: string): string {
    const errorCode = error.error?.errors?.generalErrors?.[0];

    if (error.status === 429) return 'Previše pokušaja. Pokušajte ponovno za nekoliko minuta.';
    if (errorCode === '1305') return `Kod ${code} ne vrijedi za proizvode u košarici.`;
    if (errorCode === '1304') return `Kod ${code} ne postoji ili više ne vrijedi.`;
    return 'Kod se trenutno ne može provjeriti. Pokušajte ponovno.';
  }

  // The map is loaded once its element is on the page.
  ngAfterViewChecked(): void {
    if (this.choosingLocker() && !this.mapLoaded && document.getElementById('boxnowmap') && this.settings()) {
      this.loadMap();
    }
  }

  ngOnDestroy(): void {
    delete (window as any)._bn_map_widget_config;
  }

  changeLocker(): void {
    this.mapLoaded = false;
    this.choosingLocker.set(true);
  }

  canPay = () =>
    this.cart.items().length > 0 && !!this.cart.locker() && this.unavailable().size === 0 && !this.paying();

  pay(): void {
    const locker = this.cart.locker();
    if (!locker || !this.canPay()) return;

    this.paying.set(true);
    this.error.set(null);

    this.api.checkout(this.cart.items(), locker, this.cart.promoCode()).subscribe({
      // Stripe Checkout returns to /narudzba/{id} after the payment.
      next: (response) => (window.location.href = response.checkoutUrl),
      error: (error: HttpErrorResponse) => {
        this.paying.set(false);

        const errorCode = error.error?.errors?.generalErrors?.[0];
        if (errorCode === '1304' || errorCode === '1305') {
          const code = this.cart.promoCode() ?? '';
          this.removePromo();
          this.promoError.set(this.promoMessage(error, code));
          this.error.set('Promo kod više ne vrijedi i uklonjen je. Provjerite iznos i pokušajte ponovno.');
          return;
        }

        this.error.set(this.errorMessage(error));

        if (error.status === 404 || error.status === 409) {
          this.api.refreshProducts();
          this.checkProducts();
        }
      },
    });
  }

  private checkProducts(): void {
    this.api.getProducts().subscribe({
      next: (products) => {
        const variants = new Map(products.flatMap((product) =>
          product.variants.map((variant) => [variant.id, { product, variant }] as const)));
        const unavailable = new Set<string>();

        // Prices follow the shop, the cart could be days old.
        this.cart.items.update((items) => items.map((item) => {
          const current = variants.get(item.variantId);
          if (!current?.variant.inStock) unavailable.add(item.variantId);
          return current ? { ...item, price: current.product.price } : item;
        }));

        this.unavailable.set(unavailable);
      },
    });
  }

  private loadMap(): void {
    this.mapLoaded = true;

    (window as any)._bn_map_widget_config = {
      autoclose: false,
      autoshow: true,
      partnerId: Number(this.settings()?.boxNowPartnerId),
      parentElement: '#boxnowmap',
      afterSelect: (selected: BoxNowSelection) => this.zone.run(() => {
        this.cart.locker.set({
          id: String(selected.boxnowLockerId),
          address: selected.boxnowLockerAddressLine1,
          postalCode: selected.boxnowLockerPostalCode,
        });
        this.choosingLocker.set(false);
      }),
    };

    // A new script element runs the widget again for the new map element.
    document.querySelectorAll(`script[src="${BoxNowScript}"]`).forEach((x) => x.remove());
    const script = document.createElement('script');
    script.src = BoxNowScript;
    script.async = true;
    document.head.appendChild(script);
  }

  private errorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 409:
        return 'Nekih proizvoda više nema dovoljno na zalihi. Smanjite količinu ili ih uklonite iz košarice.';
      case 404:
        return 'Neki proizvod iz košarice više nije u ponudi. Uklonite ga pa pokušajte ponovno.';
      case 429:
        return 'Previše pokušaja. Pričekajte nekoliko minuta pa pokušajte ponovno.';
      case 503:
        return 'Plaćanje trenutno nije dostupno. Pokušajte ponovno kasnije.';
      default:
        return 'Plaćanje se nije moglo pokrenuti. Provjerite internetsku vezu i pokušajte ponovno.';
    }
  }
}
