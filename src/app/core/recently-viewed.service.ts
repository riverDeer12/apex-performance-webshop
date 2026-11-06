import { Injectable } from "@angular/core";
import { storedIds } from "./browser-list";

const Max = 12;

/** Products the customer opened, newest first, kept in the browser. */
@Injectable({ providedIn: "root" })
export class RecentlyViewedService {
    readonly ids = storedIds("apex-shop-recent", Max);

    add(productId: string): void {
        this.ids.update((ids) => [productId, ...ids.filter((x) => x !== productId)].slice(0, Max));
    }
}
