import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ProductComponent } from './pages/product/product.component';
import { CartComponent } from './pages/cart/cart.component';
import { OrderComponent } from './pages/order/order.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Apex Performance Shop' },
  { path: 'proizvod/:slug', component: ProductComponent },
  { path: 'kosarica', component: CartComponent, title: 'Košarica · Apex Performance Shop' },
  // Stripe Checkout returns here with ?session_id=...
  { path: 'narudzba/:id', component: OrderComponent, title: 'Narudžba · Apex Performance Shop' },
  { path: '**', component: NotFoundComponent, title: 'Stranica nije pronađena · Apex Performance Shop' },
];
