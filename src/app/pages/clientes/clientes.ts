import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ClientesService, Cliente } from '../../services/clientes.service';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [],
  templateUrl: './clientes.html',
  styleUrl: './clientes.css',
})
export class Clientes implements OnInit {
  clientesService = inject(ClientesService);

  busqueda = signal('');

  clientesFiltrados = computed(() => {
    const q = this.busqueda().replace(/\s/g, '').toLowerCase();
    if (!q) return this.clientesService.clientes();

    return this.clientesService.clientes().filter((c: Cliente) => {
      const tel = c.telefono.replace(/\s/g, '').toLowerCase();
      const nombre = `${c.nombre} ${c.apellido}`.toLowerCase();
      return tel.includes(q) || nombre.includes(q);
    });
  });

  ngOnInit(): void {
    this.clientesService.cargarClientes();
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  iniciales(c: Cliente): string {
    return `${c.nombre.charAt(0)}${c.apellido.charAt(0)}`.toUpperCase() || '🥟';
  }

  linkWhatsApp(telefono: string): string {
    return `https://wa.me/57${telefono.replace(/\D/g, '')}`;
  }

  esFrecuente(c: Cliente): boolean {
    return c.totalPedidos >= 3;
  }
}