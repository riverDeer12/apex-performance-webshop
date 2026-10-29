import { Injectable, computed, effect, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, switchMap, tap } from "rxjs";
import { environment } from "../../environments/environment";
import { ShopMe } from "./models";
import { TokenStore } from "./token.store";

/**
 * Login to the shop with the account of the Apex Performance app. The shop
 * has its own session on the API, so it doesn't log anyone out of the app.
 */
@Injectable({ providedIn: "root" })
export class AccountService {
    readonly me = signal<ShopMe | null>(null);

    readonly token = computed(() => this.tokens.token());
    readonly isLoggedIn = computed(() => !!this.tokens.token());
    // Client discount the logged user gets, 0 for everyone else.
    readonly clientDiscount = computed(() => (this.me()?.isClient ? this.me()!.clientDiscountPercent : 0));

    private readonly url = environment.apiUrl;

    constructor(private http: HttpClient, private tokens: TokenStore) {
        // Who is logged in is read again after a reload; a session that ended forgets them.
        effect(() => {
            if (!this.tokens.token()) this.me.set(null);
        });

        if (this.tokens.token()) this.loadMe().subscribe({ error: () => {} });
    }

    login(username: string, password: string): Observable<ShopMe> {
        return this.http.post<{ token: string }>(this.url + "/shop/login", { username, password }).pipe(
            tap((response) => this.tokens.set(response.token)),
            // The interceptor sends the new token from here on.
            switchMap(() => this.loadMe()),
        );
    }

    loadMe(): Observable<ShopMe> {
        return this.http.get<ShopMe>(this.url + "/shop/me").pipe(tap((me) => this.me.set(me)));
    }

    logout(): void {
        if (this.tokens.token()) this.http.post(this.url + "/authentication/logout", {}).subscribe({ error: () => {} });
        // Cleared right away, the request above already has the token.
        this.clear();
    }

    clear(): void {
        this.tokens.set(null);
        this.me.set(null);
    }
}
