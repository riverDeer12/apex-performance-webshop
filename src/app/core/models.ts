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
    shippingPrice: number;
    total: number;
    boxNowLockerAddress: string;
    boxNowLockerPostalCode: string;
    items: { productName: string; variantName: string | null; unitPrice: number; unitDiscount: number; quantity: number }[];
}

export const variantName = (variant: Pick<Variant, "size" | "color">) =>
    [variant.size, variant.color].filter(Boolean).join(" / ");

// "12,50 €", as prices are written in Croatia.
export const formatPrice = (value: number) =>
    value.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
