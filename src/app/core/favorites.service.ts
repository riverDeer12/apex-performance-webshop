import { Injectable, computed, effect, signal, untracked } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { storedIds } from "./browser-list";
import { AccountService } from "./account.service";
import { ShopApiService } from "./shop-api.service";

/**
 * Products marked with the heart. Visitors keep them in the browser; logged in
 * members have them on their account, the same on every device. Logging in moves
 * the browser's favorites to the account, logging out empties the list here.
 */
@Injectable({ providedIn: "root" })
export class FavoritesService {
    // Kept in the browser while nobody is logged in.
    private readonly local = storedIds("apex-shop-favorites", 100);
    // Saved on the account of the logged in member, null until loaded.
    private readonly saved = signal<string[] | null>(null);

    readonly ids = computed(() => (this.account.isLoggedIn() ? (this.saved() ?? []) : this.local()));
    readonly count = computed(() => this.ids().length);

    private readonly url = environment.apiUrl + "/shop/favorites";

    constructor(private http: HttpClient, private account: AccountService, private api: ShopApiService) {
        effect(() => {
            if (this.account.isLoggedIn()) untracked(() => this.loadSaved());
            else this.saved.set(null);
        });
    }

    has(productId: string): boolean {
        return this.ids().includes(productId);
    }

    toggle(product: { id: string; slug: string }): void {
        const adding = !this.has(product.id);
        // Counted like a page view: only the product and the day, nothing about the visitor.
        if (adding) this.api.countVisit("/favorit/" + product.slug);

        if (!this.account.isLoggedIn()) {
            this.local.update((ids) => (adding ? [product.id, ...ids] : ids.filter((x) => x !== product.id)));
            return;
        }

        // Shown right away, put back if the account could not be changed.
        const before = this.saved() ?? [];
        this.saved.set(adding ? [product.id, ...before] : before.filter((x) => x !== product.id));
        const request = adding
            ? this.http.put(`${this.url}/${product.id}`, {})
            : this.http.delete(`${this.url}/${product.id}`);
        request.subscribe({ error: () => this.saved.set(before) });
    }

    private loadSaved(): void {
        const local = this.local();
        const request = local.length
            ? this.http.post<string[]>(this.url + "/merge", { productIds: local })
            : this.http.get<string[]>(this.url);

        request.subscribe({
            next: (ids) => {
                this.saved.set(ids);
                // On the account now; the browser's copy would show up again after logging out.
                if (local.length) this.local.set([]);
            },
            error: () => this.saved.set([]),
        });
    }
}
