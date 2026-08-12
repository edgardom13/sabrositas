import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-confirmado',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmado.html',
  styleUrls: ['../../styles/landing.css', './confirmado.css'],
})
export class Confirmado implements OnInit {
  auth = inject(AuthService);
  listo = signal(false);

  async ngOnInit(): Promise<void> {
    // Supabase procesa los tokens que vienen en la URL del correo
    await this.auth.verificarSesion();
    this.listo.set(true);
  }
}