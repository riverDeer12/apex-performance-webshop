import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="container page">
      <h1>Stranica nije pronađena</h1>
      <p class="muted">Proizvod ili stranica više ne postoji.</p>
      <a routerLink="/" class="button">Natrag u shop</a>
    </section>
  `,
  styles: `.page { padding: 64px 16px; text-align: center; } h1 { font-size: 22px; margin-bottom: 12px; }`
})
export class NotFoundComponent {}
