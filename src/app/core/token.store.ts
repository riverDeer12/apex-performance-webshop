import { Injectable, signal } from "@angular/core";

const TokenKey = "apex-shop-token";

function readToken(): string | null {
    try {
        return localStorage.getItem(TokenKey);
    } catch {
        return null;
    }
}

/**
 * Login token of the shop, kept in the browser. Apart from AccountService so
 * the HTTP interceptor can read it without depending on HttpClient itself.
 */
@Injectable({ providedIn: "root" })
export class TokenStore {
    readonly token = signal<string | null>(readToken());

    set(token: string | null): void {
        this.token.set(token);

        try {
            if (token) localStorage.setItem(TokenKey, token);
            else localStorage.removeItem(TokenKey);
        } catch {
            // Private mode: the login lasts until the page is closed.
        }
    }
}
