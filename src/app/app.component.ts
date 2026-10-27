import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { CartService } from './core/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  // The test shop is marked so it is never mistaken for the real one.
  readonly isTest = environment.isTest;
  readonly year = new Date().getFullYear();

  constructor(public cart: CartService) {}
}
