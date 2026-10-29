import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ProductComponent } from './pages/product/product.component';
import { CartComponent } from './pages/cart/cart.component';
import { OrderComponent } from './pages/order/order.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { LoginComponent } from './pages/login/login.component';
import { MyOrdersComponent } from './pages/my-orders/my-orders.component';
import { LegalComponent } from './pages/legal/legal.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Apex Performance Shop' },
  { path: 'proizvod/:slug', component: ProductComponent },
  { path: 'kosarica', component: CartComponent, title: 'Košarica · Apex Performance Shop' },
  // Stripe Checkout returns here with ?session_id=...
  { path: 'narudzba/:id', component: OrderComponent, title: 'Narudžba · Apex Performance Shop' },
  { path: 'prijava', component: LoginComponent },
  { path: 'moje-narudzbe', component: MyOrdersComponent },
  { path: 'uvjeti-kupnje', component: LegalComponent, data: { page: 'terms' } },
  { path: 'povrat-i-reklamacije', component: LegalComponent, data: { page: 'returns' } },
  { path: 'privatnost', component: LegalComponent, data: { page: 'privacy' } },
  { path: '**', component: NotFoundComponent, title: 'Stranica nije pronađena · Apex Performance Shop' },
];
