import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { environment } from "../../environments/environment";
import { TokenStore } from "./token.store";

/**
 * Sends the shop login with requests to the API: the checkout uses it for the
 * client discount. A 401 means the session ended, the shop then logs out.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const tokens = inject(TokenStore);
    const token = tokens.token();

    if (!token || !request.url.startsWith(environment.apiUrl)) return next(request);

    return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) tokens.set(null);
            return throwError(() => error);
        }),
    );
};
