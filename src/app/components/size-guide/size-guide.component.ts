import { Component, HostListener, computed, input, output } from '@angular/core';
import { normalize, sizeKind } from '../../core/catalog';
import { Gender } from '../../core/models';

type Kind = 'tops' | 'bottoms' | 'shoes' | 'socks';

interface Guide {
  title: string;
  columns: string[];
  rows: string[][];
  how: string[];
}

// Usual body measurements in cm; the cut of each model can differ.
const Guides: Record<Kind, Guide> = {
  tops: {
    title: 'Majice, topovi i gornji dijelovi',
    columns: ['Veličina', 'Prsa (cm)', 'Struk (cm)'],
    rows: [['XS', '86–91', '71–76'], ['S', '91–96', '76–81'], ['M', '96–101', '81–86'], ['L', '101–106', '86–91'],
      ['XL', '106–111', '91–96'], ['XXL', '111–116', '96–101'], ['3XL', '116–121', '101–106']],
    how: ['Prsa: oko najšireg dijela prsa, ispod pazuha.', 'Struk: oko najužeg dijela trupa, iznad pupka.'],
  },
  bottoms: {
    title: 'Hlače, hlačice i tajice',
    columns: ['Veličina', 'Struk (cm)', 'Bokovi (cm)'],
    rows: [['XS', '66–71', '86–91'], ['S', '71–76', '91–96'], ['M', '76–81', '96–101'], ['L', '81–86', '101–106'],
      ['XL', '86–91', '106–111'], ['XXL', '91–96', '111–116'], ['3XL', '96–101', '116–121']],
    how: ['Struk: oko najužeg dijela trupa, iznad pupka.', 'Bokovi: oko najširega dijela bokova i stražnjice.'],
  },
  shoes: {
    title: 'Obuća',
    columns: ['EU', 'UK', 'Duljina stopala (cm)'],
    rows: [['38', '5', '24,0'], ['39', '6', '24,7'], ['40', '6,5', '25,3'], ['41', '7', '26,0'], ['42', '8', '26,7'],
      ['43', '9', '27,3'], ['44', '9,5', '28,0'], ['45', '10,5', '28,7'], ['46', '11', '29,3']],
    how: ['Stanite na papir i označite petu i najdulji prst; izmjerite razmak.', 'Mjerite navečer, kad je stopalo najveće.'],
  },
  socks: {
    title: 'Čarape',
    columns: ['Veličina čarapa', 'Broj obuće (EU)'],
    rows: [['35–38', '35, 36, 37, 38'], ['39–42', '39, 40, 41, 42'], ['43–46', '43, 44, 45, 46']],
    how: ['Odaberite veličinu prema broju obuće koji nosite.'],
  },
};

// EU number sizes of clothes next to the letters, for products sized in numbers.
const NumberSizes: Record<'women' | 'men', Record<string, string>> = {
  women: { XS: '34', S: '36', M: '38', L: '40', XL: '42', XXL: '44', '3XL': '46' },
  men: { XS: '44', S: '46', M: '48', L: '50', XL: '52', XXL: '54', '3XL': '56' },
};

/**
 * Size guide for the kind of product, as a dialog over the product page. Clothes
 * sized in numbers (38, 40 ...) get the table in numbers, the others in letters;
 * the product's own sizes are marked.
 */
@Component({
  selector: 'app-size-guide',
  templateUrl: './size-guide.component.html',
  styleUrl: './size-guide.component.scss'
})
export class SizeGuideComponent {
  readonly category = input.required<string>();
  readonly name = input.required<string>();
  // Sizes of the product, e.g. ["S", "M", "L"] or ["38", "40"].
  readonly sizes = input<string[]>([]);
  readonly gender = input<Gender | null>(null);
  readonly closed = output<void>();

  readonly guide = computed<Guide>(() => {
    const guide = Guides[this.kind()];
    if (this.kind() === 'shoes' || this.kind() === 'socks' || !this.inNumbers()) return guide;

    // Unisex and unknown products in men's numbers, which are the bigger ones.
    const numbers = NumberSizes[this.gender() === 'women' ? 'women' : 'men'];
    return {
      ...guide,
      columns: [`Veličina (EU, ${this.gender() === 'women' ? 'žene' : 'muškarci'})`, ...guide.columns.slice(1), 'Slovna'],
      rows: guide.rows.map(([letter, ...rest]) => [numbers[letter] ?? letter, ...rest, letter]),
    };
  });

  // Products sized only in numbers.
  readonly inNumbers = computed(() => this.sizes().length > 0 && this.sizes().every((x) => sizeKind(x) === 'numbers'));

  // Row of the table that is one of the product's sizes.
  isOwn(row: string[]): boolean {
    const own = new Set(this.sizes().map((x) => normalize(x)));
    return own.has(normalize(row[0])) || own.has(normalize(row[row.length - 1]));
  }

  private readonly kind = computed<Kind>(() => {
    const text = normalize(`${this.category()} ${this.name()}`);
    if (/tenisic|obuc|cipel|patik/.test(text)) return 'shoes';
    if (/carap/.test(text)) return 'socks';
    if (/hlac|tajic|trenirk|shorts|legging|jogger/.test(text)) return 'bottoms';
    return 'tops';
  });

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
