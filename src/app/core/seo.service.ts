import { Injectable, Inject } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { Meta, Title } from "@angular/platform-browser";
import { environment } from "../../environments/environment";

const DefaultDescription = "Odjeća i oprema studija Apex Performance. Dostava u BoxNow paketomat diljem Hrvatske.";

/**
 * Title, description, canonical address and structured data of the page,
 * read by search engines (they run the shop's JavaScript).
 */
@Injectable({ providedIn: "root" })
export class SeoService {
    constructor(private title: Title, private meta: Meta, @Inject(DOCUMENT) private document: Document) {}

    set(page: { title?: string; description?: string; path: string; jsonLd?: object | null }): void {
        const title = page.title ? `${page.title} · Apex Performance Shop` : "Apex Performance Shop";
        const description = page.description ?? DefaultDescription;
        const url = environment.siteUrl + page.path;

        this.title.setTitle(title);
        this.meta.updateTag({ name: "description", content: description });
        this.meta.updateTag({ property: "og:title", content: title });
        this.meta.updateTag({ property: "og:description", content: description });
        this.meta.updateTag({ property: "og:url", content: url });

        let canonical = this.document.querySelector<HTMLLinkElement>("link[rel=canonical]");
        if (!canonical) {
            canonical = this.document.createElement("link");
            canonical.rel = "canonical";
            this.document.head.appendChild(canonical);
        }
        canonical.href = url;

        this.document.getElementById("page-json-ld")?.remove();

        if (page.jsonLd) {
            const script = this.document.createElement("script");
            script.id = "page-json-ld";
            script.type = "application/ld+json";
            script.text = JSON.stringify(page.jsonLd);
            this.document.head.appendChild(script);
        }
    }
}
