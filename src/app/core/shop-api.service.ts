import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, shareReplay } from "rxjs";
import { environment } from "../../environments/environment";
import { CartItem, Locker, Order, Product, PromoCheck, ShopSettings } from "./models";

/**
 * Shop part of the Apex Performance API. Prices and stock always come
 * from the API, the cart only remembers what was chosen.
 */
@Injectable({ providedIn: "root" })
export class ShopApiService {
    private readonly url = environment.apiUrl + "/shop";

    // Products change rarely while someone shops, one load per visit is enough.
    private products$?: Observable<Product[]>;
    private settings$?: Observable<ShopSettings>;

    constructor(private http: HttpClient) {}

    getProducts(): Observable<Product[]> {
        return (this.products$ ??= this.http.get<Product[]>(this.url + "/products").pipe(shareReplay(1)));
    }

    getProduct = (slug: string) => this.http.get<Product>(this.url + "/products/" + encodeURIComponent(slug));

    getSettings(): Observable<ShopSettings> {
        return (this.settings$ ??= this.http.get<ShopSettings>(this.url + "/settings").pipe(shareReplay(1)));
    }

    checkPromo = (code: string, items: CartItem[]) =>
        this.http.post<PromoCheck>(this.url + "/promo-codes/check", {
            code,
            items: items.map((x) => ({ variantId: x.variantId, quantity: x.quantity })),
        });

    checkout = (items: CartItem[], locker: Locker, promoCode: string | null) =>
        this.http.post<{ orderId: string; checkoutUrl: string }>(this.url + "/checkout", {
            items: items.map((x) => ({ variantId: x.variantId, quantity: x.quantity })),
            boxNowLockerId: locker.id,
            boxNowLockerAddress: locker.address,
            boxNowLockerPostalCode: locker.postalCode,
            promoCode,
        });

    getOrder = (id: string, sessionId: string) =>
        this.http.get<Order>(this.url + "/orders/" + id, { params: { sessionId } });

    imageUrl = (imageId: string) => this.url + "/images/" + imageId;

    // Page with the product's link preview (Instagram, WhatsApp), it sends people on to the shop.
    shareUrl = (slug: string) => this.url + "/share/" + encodeURIComponent(slug);

    getMyOrders = () => this.http.get<Order[]>(this.url + "/my-orders");

    // "Let me know when it's back": one email when the size or color is in stock again.
    createStockAlert = (variantId: string, email: string) =>
        this.http.post(this.url + "/stock-alerts", { variantId, email });

    // Counts a page view, nothing about the visitor is sent.
    countVisit(path: string): void {
        this.http.post(this.url + "/visits", { path }).subscribe({ error: () => {} });
    }

    // Products may have changed (stock, removed) after a failed checkout.
    refreshProducts(): void {
        this.products$ = undefined;
    }
}
