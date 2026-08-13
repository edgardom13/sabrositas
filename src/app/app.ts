import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './services/pwa-update';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',   // ← en Angular 20 es app.html, NO app.component.html
  styleUrl: './app.css',
})
export class App {              // ← la clase se llama App (main.ts la importa así)
  pwaUpdate = inject(PwaUpdateService);
}