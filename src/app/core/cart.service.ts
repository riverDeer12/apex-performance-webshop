import { Injectable, computed, effect, signal } from "@angular/core";
import { CartItem, Locker } from "./models";

const CartKey = "apex-shop-cart";
const LockerKey = "apex-shop-locker";
export const MaxQuantity = 20;

function read<T>(key: string, fallback: T): T {
    try {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as T) : fallback;
    } catch {
        return fallback;
    }
}

function write(key: string, value: unknown): void {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private mode or full storage: the cart lives until the page is closed.
    }
}

/**
 * Cart and the chosen BoxNow locker, kept in the browser so they survive
 * reloads and the trip to Stripe Checkout and back.
 */
@Injectable({ providedIn: "root" })
export class CartService {
    readonly items = signal<CartItem[]>(read<CartItem[]>(CartKey, []));
    readonly locker = signal<Locker | null>(read<Locker | null>(LockerKey, null));

    readonly count = computed(() => this.items().reduce((sum, x) => sum + x.quantity, 0));
    readonly subtotal = computed(() => this.items().reduce((sum, x) => sum + x.price * x.quantity, 0));

    constructor() {
        effect(() => write(CartKey, this.items()));
        effect(() => write(LockerKey, this.locker()));
    }

    add(item: Omit<CartItem, "quantity">, quantity: number): void {
        const existing = this.items().find((x) => x.variantId === item.variantId);

        if (existing) this.setQuantity(item.variantId, existing.quantity + quantity);
        else this.items.update((items) => [...items, { ...item, quantity: Math.min(quantity, MaxQuantity) }]);
    }

    setQuantity(variantId: string, quantity: number): void {
        if (quantity < 1) {
            this.remove(variantId);
            return;
        }

        this.items.update((items) =>
            items.map((x) => (x.variantId === variantId ? { ...x, quantity: Math.min(quantity, MaxQuantity) } : x)));
    }

    remove(variantId: string): void {
        this.items.update((items) => items.filter((x) => x.variantId !== variantId));
    }

    clear(): void {
        this.items.set([]);
    }
}
