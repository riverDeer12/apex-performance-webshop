import { Injectable, computed, effect, signal, untracked } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { AccountService } from "./account.service";
import { ShopApiService } from "./shop-api.service";

// Favorite product with the size and color picked when it was marked, if any.
export interface FavoriteItem {
    productId: string;
    size: string | null;
    color: string | null;
}

const StorageKey = "apex-shop-favorites";
const Max = 100;

// Kept in the browser; earlier versions kept only the product ids.
function storedFavorites() {
    let initial: FavoriteItem[] = [];
    try {
        const value = JSON.parse(localStorage.getItem(StorageKey) ?? "[]");
        if (Array.isArray(value)) {
            initial = value
                .map((x): FavoriteItem | null => typeof x === "string"
                    ? { productId: x, size: null, color: null }
                    : x && typeof x.productId === "string"
                        ? { productId: x.productId, size: x.size ?? null, color: x.color ?? null }
                        : null)
                .filter((x): x is FavoriteItem => !!x)
                .slice(0, Max);
        }
    } catch {
        // Unreadable value, start empty.
    }

    const items = signal<FavoriteItem[]>(initial);
    effect(() => {
        try {
            localStorage.setItem(StorageKey, JSON.stringify(items()));
        } catch {
            // Not saved, still works on this page.
        }
    });
    return items;
}

/**
 * Products marked with the heart, with the size and color picked then. Visitors
 * keep them in the browser; logged in members have them on their account, the
 * same on every device. Logging in moves the browser's favorites to the account,
 * logging out empties the list here.
 */
@Injectable({ providedIn: "root" })
export class FavoritesService {
    private readonly local = storedFavorites();
    // Saved on the account of the logged in member, null until loaded.
    private readonly saved = signal<FavoriteItem[] | null>(null);

    readonly items = computed(() => (this.account.isLoggedIn() ? (this.saved() ?? []) : this.local()));
    readonly ids = computed(() => this.items().map((x) => x.productId));
    readonly count = computed(() => this.items().length);

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

    item(productId: string): FavoriteItem | undefined {
        return this.items().find((x) => x.productId === productId);
    }

    toggle(product: { id: string; slug: string }, size: string | null = null, color: string | null = null): void {
        if (this.has(product.id)) this.remove(product.id);
        else this.save(product, size, color);
    }

    /** Marks the product, or changes the size and color of a marked one. */
    save(product: { id: string; slug: string }, size: string | null, color: string | null): void {
        const existing = this.item(product.id);
        if (existing && existing.size === size && existing.color === color) return;
        // Counted like a page view: only the product and the day, nothing about the visitor.
        if (!existing) this.api.countVisit("/favorit/" + product.slug);

        const item: FavoriteItem = { productId: product.id, size, color };
        const put = (items: FavoriteItem[]) => existing
            ? items.map((x) => (x.productId === product.id ? item : x))
            : [item, ...items].slice(0, Max);

        if (!this.account.isLoggedIn()) {
            this.local.update(put);
            return;
        }

        // Shown right away, put back if the account could not be changed.
        const before = this.saved() ?? [];
        this.saved.set(put(before));
        this.http.put(`${this.url}/${product.id}`, { size, color }).subscribe({ error: () => this.saved.set(before) });
    }

    remove(productId: string): void {
        if (!this.account.isLoggedIn()) {
            this.local.update((items) => items.filter((x) => x.productId !== productId));
            return;
        }

        const before = this.saved() ?? [];
        this.saved.set(before.filter((x) => x.productId !== productId));
        this.http.delete(`${this.url}/${productId}`).subscribe({ error: () => this.saved.set(before) });
    }

    private loadSaved(): void {
        const local = this.local();
        const request = local.length
            ? this.http.post<FavoriteItem[]>(this.url + "/merge", { items: local })
            : this.http.get<FavoriteItem[]>(this.url);

        request.subscribe({
            next: (items) => {
                this.saved.set(items.map((x) => ({ productId: x.productId, size: x.size ?? null, color: x.color ?? null })));
                // On the account now; the browser's copy would show up again after logging out.
                if (local.length) this.local.set([]);
            },
            error: () => this.saved.set([]),
        });
    }
}
