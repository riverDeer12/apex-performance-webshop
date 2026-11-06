import { Gender, Product } from './models';

/**
 * Filtering and suggestions of the catalog. The shop loads all products at
 * once, so all of it runs in the browser.
 */

// Lower case without diacritics, so "carape" finds "Čarape".
export const normalize = (text: string) =>
  text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export interface CatalogFilter {
  search: string;
  categories: string[];
  colors: string[];
  sizes: string[];
  keywords: string[];
  // Only products with a matching size and color in stock.
  inStockOnly: boolean;
  // Women's or men's products; unisex products and accessories are in both.
  gender: Exclude<Gender, 'unisex'> | null;
  // Price range in euros, null for no limit.
  priceMin: number | null;
  priceMax: number | null;
}

export type FacetName = 'categories' | 'colors' | 'sizes' | 'keywords';

export const emptyFilter = (): CatalogFilter => ({
  search: '', categories: [], colors: [], sizes: [], keywords: [], inStockOnly: false,
  gender: null, priceMin: null, priceMax: null,
});

// Filters in the side panel; the gender is picked above the list.
export const activeFilterCount = (filter: CatalogFilter) =>
  filter.categories.length + filter.colors.length + filter.sizes.length + filter.keywords.length +
  (filter.inStockOnly ? 1 : 0) + (filter.priceMin !== null || filter.priceMax !== null ? 1 : 0);

// Keywords --------------------------------------------------------------------------

// Groups of keywords, written in the administration as "materijal: pamuk".
export const KeywordGroups: { name: string; title: string }[] = [
  { name: 'materijal', title: 'Materijal' },
  { name: 'kolekcija', title: 'Kolekcija' },
  { name: 'aktivnost', title: 'Aktivnost' },
  { name: 'sezona', title: 'Sezona' },
  { name: '', title: 'Ključne riječi' },
];

const keywordParts = (keyword: string): [string, string] => {
  const match = /^([^:]+):\s*(.+)$/.exec(keyword);
  const group = match?.[1].trim().toLowerCase();
  return match && KeywordGroups.some((x) => x.name === group) ? [group!, match[2].trim()] : ['', keyword];
};

// "materijal" for "materijal: pamuk", "" for keywords without a group.
export const keywordGroup = (keyword: string) => keywordParts(keyword)[0];
// "pamuk" for "materijal: pamuk".
export const keywordValue = (keyword: string) => keywordParts(keyword)[1];

// Sizes --------------------------------------------------------------------------

const LetterSizes = ['xxxs', '3xs', 'xxs', '2xs', 'xs', 's', 's/m', 'm', 'm/l', 'l', 'l/xl', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl'];

// Letters (S, M, L), numbers (38, 42), or a range like socks (39–42) and one size (Uni).
export function sizeKind(size: string): 'letters' | 'numbers' | 'other' {
  const text = normalize(size).replace(/\s+/g, '');
  if (LetterSizes.includes(text)) return 'letters';
  if (/^\d+([.,]\d+)?$/.test(text)) return 'numbers';
  return 'other';
}

const productText = (product: Product) =>
  normalize(`${product.name} ${product.category} ${product.description} ${(product.keywords ?? []).join(' ')}`);

/**
 * A product matches when every word of the search is in it, it is in one of the
 * picked categories, has one of the picked keywords, and one variant has one of
 * the picked colors and sizes (in stock when asked). Values of one filter are
 * alternatives, different filters all have to match.
 */
export function matches(product: Product, filter: CatalogFilter): boolean {
  const words = normalize(filter.search).split(/\s+/).filter(Boolean);
  if (words.length) {
    const text = productText(product);
    if (!words.every((word) => text.includes(word))) return false;
  }

  if (filter.categories.length && !filter.categories.includes(product.category)) return false;

  if (filter.gender && product.gender && product.gender !== 'unisex' && product.gender !== filter.gender) return false;

  if (filter.priceMin !== null && product.price < filter.priceMin) return false;
  if (filter.priceMax !== null && product.price > filter.priceMax) return false;

  // Keywords of one group are alternatives, every group picked has to match.
  if (filter.keywords.length) {
    const own = product.keywords ?? [];
    const groups = new Set(filter.keywords.map(keywordGroup));
    for (const group of groups) {
      if (!filter.keywords.some((x) => keywordGroup(x) === group && own.includes(x))) return false;
    }
  }

  if (filter.colors.length || filter.sizes.length || filter.inStockOnly) {
    const colors = filter.colors.map(normalize);
    const sizes = filter.sizes.map(normalize);

    return product.variants.some((variant) =>
      (!colors.length || (variant.color !== null && colors.includes(normalize(variant.color)))) &&
      (!sizes.length || (variant.size !== null && sizes.includes(normalize(variant.size)))) &&
      (!filter.inStockOnly || variant.inStock));
  }

  return true;
}

export interface FacetValue {
  value: string;
  // Products the value would show with the other filters as they are.
  count: number;
}

/**
 * Values of a filter with their counts. Counting ignores the filter's own
 * choice, so picking a second color shows how many products it adds.
 */
export function facet(products: Product[], filter: CatalogFilter, name: FacetName): FacetValue[] {
  const values = facetValues(products, name);
  const others: CatalogFilter = { ...filter, [name]: [] };
  const candidates = products.filter((product) => matches(product, others));

  return values.map((value) => ({
    value,
    count: candidates.filter((product) => matches(product, { ...others, [name]: [value] })).length,
  }));
}

function facetValues(products: Product[], name: FacetName): string[] {
  switch (name) {
    case 'categories':
      // In the order of the products, which is the order set in the administration.
      return unique(products.map((x) => x.category));
    case 'colors':
      return unique(products.flatMap((x) => x.variants.map((v) => v.color)))
        .sort((a, b) => colorOrder(a) - colorOrder(b) || a.localeCompare(b, 'hr'));
    case 'sizes':
      return unique(products.flatMap((x) => x.variants.map((v) => v.size))).sort(compareSizes);
    case 'keywords': {
      // Most used first.
      const counts = new Map<string, number>();
      for (const keyword of products.flatMap((x) => x.keywords ?? [])) counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
      return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b, 'hr'));
    }
  }
}

// Distinct values, the first spelling wins ("Crna" and "crna" are one color).
function unique(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const text = value?.trim();
    if (text && !seen.has(normalize(text))) seen.set(normalize(text), text);
  }
  return [...seen.values()];
}

// XS, S, M, L, XL first, then numbers (shoes, 38, 39 ...), then the rest (Uni).
export function compareSizes(a: string, b: string): number {
  const rank = (size: string): [number, number] => {
    const text = normalize(size).replace(/\s+/g, '');
    const letter = LetterSizes.indexOf(text);
    if (letter >= 0) return [0, letter];
    const number = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(number)) return [1, number];
    return [2, 0];
  };
  const [groupA, valueA] = rank(a);
  const [groupB, valueB] = rank(b);
  return groupA - groupB || valueA - valueB || a.localeCompare(b, 'hr');
}

// Colors -------------------------------------------------------------------------

// Colors as they are written in the administration, in Croatian or English.
const ColorHex: Record<string, string> = {
  crna: '#16181d', black: '#16181d',
  bijela: '#ffffff', white: '#ffffff',
  siva: '#8b9099', grey: '#8b9099', gray: '#8b9099',
  svijetlosiva: '#c9ccd2', 'svijetlo siva': '#c9ccd2', 'light grey': '#c9ccd2',
  tamnosiva: '#4a4f58', 'tamno siva': '#4a4f58', antracit: '#3a3f47', 'dark grey': '#4a4f58', melange: '#a9adb4',
  plava: '#1f5fd6', blue: '#1f5fd6', 'kraljevsko plava': '#0034c4', 'royal blue': '#0034c4', 'apex plava': '#0034c4',
  tamnoplava: '#1b2a4e', 'tamno plava': '#1b2a4e', 'mornarsko plava': '#1b2a4e', navy: '#1b2a4e', teget: '#1b2a4e',
  svijetloplava: '#8ec5ff', 'svijetlo plava': '#8ec5ff', 'light blue': '#8ec5ff', 'nebesko plava': '#8ec5ff',
  tirkizna: '#1fb5b0', turquoise: '#1fb5b0', petrolej: '#1d5c63',
  crvena: '#d22f2f', red: '#d22f2f', bordo: '#6d1a2a', burgundy: '#6d1a2a', 'vinsko crvena': '#6d1a2a',
  zelena: '#2e8b57', green: '#2e8b57', maslinasta: '#6b7a3a', olive: '#6b7a3a', kaki: '#8a8455', khaki: '#8a8455',
  mint: '#a8e6cf', 'tamnozelena': '#1f4d36', 'tamno zelena': '#1f4d36',
  zuta: '#f2c94c', yellow: '#f2c94c', narancasta: '#f2994a', orange: '#f2994a', neon: '#d7f542',
  ruzicasta: '#f4a6c0', roza: '#f4a6c0', pink: '#f4a6c0', fuksija: '#d62f86',
  ljubicasta: '#7e57c2', purple: '#7e57c2', lila: '#c8a2e8', lavanda: '#c8a2e8',
  smeda: '#7a5230', brown: '#7a5230', bez: '#d9c7a8', beige: '#d9c7a8', krem: '#f3ead8', cream: '#f3ead8',
  pijesak: '#d8c39a', sand: '#d8c39a', zlatna: '#c9a54a', gold: '#c9a54a', srebrna: '#c0c4ca', silver: '#c0c4ca',
};

// Order of the color filter: neutrals first, then roughly the rainbow.
const ColorOrder = ['#16181d', '#ffffff', '#3a3f47', '#4a4f58', '#8b9099', '#a9adb4', '#c9ccd2', '#1b2a4e', '#0034c4',
  '#1f5fd6', '#8ec5ff', '#1d5c63', '#1fb5b0', '#1f4d36', '#2e8b57', '#6b7a3a', '#8a8455', '#a8e6cf', '#d7f542',
  '#f2c94c', '#f2994a', '#d22f2f', '#6d1a2a', '#d62f86', '#f4a6c0', '#7e57c2', '#c8a2e8', '#7a5230', '#d8c39a',
  '#d9c7a8', '#f3ead8', '#c9a54a', '#c0c4ca'];

// Neutral colors go with anything, the suggestions count on that.
const Neutral = new Set(['#16181d', '#ffffff', '#3a3f47', '#4a4f58', '#8b9099', '#a9adb4', '#c9ccd2', '#1b2a4e', '#d9c7a8', '#f3ead8']);

// Hex colors of a color name; "crno-bijela" has two.
export function colorHexes(name: string): string[] {
  const text = normalize(name);
  if (ColorHex[text]) return [ColorHex[text]];

  return text.split(/\s*[-/,&]\s*|\s+i\s+/)
    .map((part) => ColorHex[part] ?? ColorHex[part.replace(/(o|a|e)$/, 'a')])
    .filter((x): x is string => !!x);
}

const colorOrder = (name: string) => {
  const index = ColorOrder.indexOf(colorHexes(name)[0] ?? '');
  return index < 0 ? ColorOrder.length : index;
};

// CSS background of a color swatch; unknown names get a neutral pattern.
export function swatchBackground(name: string): string {
  const hexes = colorHexes(name);
  if (hexes.length === 0) return 'repeating-linear-gradient(45deg, #d5dae9 0 4px, #f2f1ee 4px 8px)';
  if (hexes.length === 1) return hexes[0];
  const step = 100 / hexes.length;
  return `linear-gradient(135deg, ${hexes.map((hex, i) => `${hex} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

// Suggestions --------------------------------------------------------------------

const MaxSuggestions = 8;

/**
 * Products that go with the given one, to make a whole outfit: first the ones
 * picked in the administration (both ways), then products from other categories
 * that share a color or keyword with it, a few per category so the suggestions
 * mix, for example, shorts, sneakers and socks under a t-shirt.
 */
export function suggestions(product: Product, products: Product[]): Product[] {
  const available = products.filter((x) => x.id !== product.id && x.variants.some((v) => v.inStock));
  const byId = new Map(available.map((x) => [x.id, x]));
  const result: Product[] = [];
  const add = (item: Product | undefined) => {
    if (item && !result.includes(item) && result.length < MaxSuggestions) result.push(item);
  };

  for (const id of product.relatedProductIds ?? []) add(byId.get(id));
  for (const item of available) if ((item.relatedProductIds ?? []).includes(product.id)) add(item);

  const ownColors = new Set(product.variants.flatMap((v) => (v.color ? colorHexes(v.color) : [])));
  const ownKeywords = new Set(product.keywords ?? []);

  const score = (item: Product) => {
    const colors = item.variants.flatMap((v) => (v.color ? colorHexes(v.color) : []));
    let points = 0;
    if (colors.some((hex) => ownColors.has(hex))) points += 3;
    else if (colors.some((hex) => Neutral.has(hex)) || [...ownColors].some((hex) => Neutral.has(hex))) points += 1;
    points += 2 * (item.keywords ?? []).filter((x) => ownKeywords.has(x)).length;
    return points;
  };

  // Best first within each other category, then one from each category in turn.
  const groups = new Map<string, Product[]>();
  for (const item of available.filter((x) => x.category !== product.category)) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  const ranked = [...groups.values()]
    .map((items) => items.map((item, order) => ({ item, points: score(item), order }))
      .sort((a, b) => b.points - a.points || a.order - b.order))
    .sort((a, b) => b[0].points - a[0].points);

  for (let round = 0; result.length < MaxSuggestions && ranked.some((x) => x.length > round); round++) {
    for (const group of ranked) add(group[round]?.item);
  }

  // A shop with only one category still suggests something.
  if (result.length < 4) {
    for (const item of available.filter((x) => x.category === product.category)) add(item);
  }

  return result;
}
