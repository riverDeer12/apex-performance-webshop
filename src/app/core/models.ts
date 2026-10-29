export interface Variant {
    id: string;
    size: string | null;
    color: string | null;
    inStock: boolean;
    // Pieces left when only a few are left.
    fewLeft: number | null;
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    price: number;
    // The first one is the main picture.
    imageIds: string[];
    variants: Variant[];
}

export interface ShopSettings {
    shippingPrice: number;
    freeShippingFrom: number;
    boxNowPartnerId: string | null;
    // Off every product for clients of the studio logged in to the shop, 0 for none.
    clientDiscountPercent: number;
}

export interface ShopMe {
    name: string;
    email: string;
    isClient: boolean;
    clientDiscountPercent: number;
}

export interface CartItem {
    variantId: string;
    slug: string;
    name: string;
    variantName: string;
    price: number;
    imageId: string | null;
    quantity: number;
}

export interface Locker {
    id: string;
    address: string;
    postalCode: string;
}

export interface PromoCheck {
    code: string;
    discountType: "Percent" | "Amount";
    discountValue: number;
    discount: number;
    items: { variantId: string; unitDiscount: number }[];
}

export type OrderStatus = "Pending" | "Paid" | "Shipped" | "Cancelled" | "Refunded";

export interface Order {
    id: string;
    number: string;
    status: OrderStatus;
    customerName: string | null;
    customerEmail: string | null;
    subtotal: number;
    promoCode: string | null;
    discount: number;
    clientDiscountPercent: number | null;
    shippingPrice: number;
    total: number;
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    boxNowParcelId: string | null;
    boxNowLockerAddress: string;
    boxNowLockerPostalCode: string;
    items: { productName: string; variantName: string | null; unitPrice: number; unitDiscount: number; quantity: number }[];
}

export const variantName = (variant: Pick<Variant, "size" | "color">) =>
    [variant.size, variant.color].filter(Boolean).join(" / ");

// "12,50 €", as prices are written in Croatia.
export const formatPrice = (value: number) =>
    value.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// Client discount on one piece, rounded to cents like the API does.
export const clientUnitDiscount = (percent: number, price: number) =>
    percent > 0 ? Math.min(price, Math.round(price * percent) / 100) : 0;

// What an order's discount was, e.g. "Promo kod APEX10" or "Popust za klijente 10 %".
export function discountLabel(order: Pick<Order, "promoCode" | "clientDiscountPercent">): string {
    const client = order.clientDiscountPercent ? `popust za klijente ${order.clientDiscountPercent} %` : "";
    const promo = order.promoCode ? `promo kod ${order.promoCode}` : "";
    const text = [promo, client].filter(Boolean).join(" i ") || "popust";

    return text[0].toUpperCase() + text.slice(1);
}
