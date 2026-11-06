import { Injectable, computed } from "@angular/core";
import { storedIds } from "./browser-list";

/** Products the customer marked with the heart, kept in the browser, no account needed. */
@Injectable({ providedIn: "root" })
export class FavoritesService {
    readonly ids = storedIds("apex-shop-favorites", 100);
    readonly count = computed(() => this.ids().length);

    has(productId: string): boolean {
        return this.ids().includes(productId);
    }

    toggle(productId: string): void {
        this.ids.update((ids) => (ids.includes(productId) ? ids.filter((x) => x !== productId) : [productId, ...ids]));
    }
}
