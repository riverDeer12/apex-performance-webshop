import { effect, signal } from "@angular/core";

/**
 * List of product ids kept in the browser (favorites, recently viewed).
 * Private mode or full storage keep it only until the page is closed.
 */
export function storedIds(key: string, max: number) {
    let initial: string[] = [];
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (Array.isArray(value)) initial = value.filter((x): x is string => typeof x === "string").slice(0, max);
    } catch {
        // Unreadable value, start empty.
    }

    const ids = signal<string[]>(initial);
    effect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(ids()));
        } catch {
            // Not saved, still works on this page.
        }
    });
    return ids;
}
