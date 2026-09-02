import { Injectable, inject, computed } from '@angular/core';
import { EstadisticasService } from './estadisticas.service';

export interface PrediccionProducto {
  nombre: string;
  categoria: string;
  cantidad: number;        // 🎯 unidades sugeridas a producir
  promedio: number;
  tendencia: number;       // -0.5 .. +0.5
  confianza: 'alta' | 'media' | 'baja';
  semanas: number;
}

export interface PrediccionDia {
  dia: number;             // 0=Dom .. 6=Sáb
  etiqueta: string;
  productos: PrediccionProducto[];
  totalUnidades: number;
  ingresoEstimado: number;
  confianzaGlobal: 'alta' | 'media' | 'baja';
  muestras: number;
}

export interface Insight {
  icono: string;
  titulo: string;
  texto: string;
  tipo: 'exito' | 'alerta' | 'info' | 'idea';
}

interface ItemPedido { cantidad: number; nombre: string; precio: number; categoria?: string; }

const ETIQUETAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const SEMANAS = 12; // ventana de aprendizaje (12 semanas)

@Injectable({ providedIn: 'root' })
export class PredictivoService {
  private stats = inject(EstadisticasService);

  async cargar(): Promise<void> { await this.stats.cargar(); }

  // ===== 🧠 NÚCLEO: análisis completo (computado y cacheado) =====
  analisis = computed(() => {
    const ahora = Date.now();
    const ventana = SEMANAS * 7 * 86400000;
    const entregados = this.stats.pedidos()
      .filter((p) => p.estado === 'entregado' && ahora - new Date(p.creado_en).getTime() <= ventana);

    // dia -> semana -> producto -> {qty, ing, cat}
    const cubo = new Map<number, Map<number, Map<string, { qty: number; ing: number; cat: string }>>>();
    const horas = new Map<number, number>();

    for (const p of entregados) {
      const f = new Date(p.creado_en);
      const d = f.getDay();
      const semana = Math.min(SEMANAS - 1, Math.floor((ahora - f.getTime()) / 86400000 / 7));
      horas.set(f.getHours(), (horas.get(f.getHours()) ?? 0) + 1);

      if (!cubo.has(d)) cubo.set(d, new Map());
      const porSem = cubo.get(d)!;
      if (!porSem.has(semana)) porSem.set(semana, new Map());
      const porProd = porSem.get(semana)!;

      for (const it of (p.items as unknown as ItemPedido[]) ?? []) {
        const key = it.nombre;
        const cur = porProd.get(key) ?? { qty: 0, ing: 0, cat: it.categoria ?? 'otro' };
        cur.qty += Number(it.cantidad) || 0;
        cur.ing += (Number(it.cantidad) || 0) * (Number(it.precio) || 0);
        porProd.set(key, cur);
      }
    }

    const dias: PrediccionDia[] = [];
    for (let d = 0; d < 7; d++) {
      const porSem = cubo.get(d) ?? new Map();
      const productos = this.pronosticarDia(porSem);
      const totalUnidades = productos.reduce((t, x) => t + x.cantidad, 0);
      const ingresoEstimado = productos.reduce((t, x) => t + x.cantidad * (x.promedio ? (x as any).precioProm ?? 0 : 0), 0);
      const muestras = porSem.size;
      dias.push({
        dia: d, etiqueta: ETIQUETAS[d], productos, totalUnidades,
        ingresoEstimado: this.calcIngreso(porSem, productos),
        confianzaGlobal: muestras >= 6 ? 'alta' : muestras >= 3 ? 'media' : 'baja',
        muestras,
      });
    }

    return { dias, insights: this.generarInsights(dias, horas), horaPico: this.horaPico(horas) };
  });

  // ===== Pronóstico por producto para un día (media ponderada + tendencia) =====
  private pronosticarDia(porSem: Map<number, Map<string, { qty: number; ing: number; cat: string }>>): PrediccionProducto[] {
    const nombres = new Set<string>();
    porSem.forEach((m) => m.forEach((_, k) => nombres.add(k)));

    const out: PrediccionProducto[] = [];
    nombres.forEach((nombre) => {
      let sumW = 0, sumQ = 0, semanasCon = 0, precioProm = 0, ingW = 0;
      let rec = 0, recN = 0, prev = 0, prevN = 0;

      porSem.forEach((m, semana) => {
        const it = m.get(nombre);
        if (!it) return;
        const w = SEMANAS - semana; // más peso a lo reciente
        sumW += w; sumQ += it.qty * w; ingW += it.ing * w;
        semanasCon++;
        if (semana <= 3) { rec += it.qty; recN++; }
        else if (semana <= 7) { prev += it.qty; prevN++; }
      });

      if (semanasCon === 0) return;
      const promedio = sumQ / sumW;
      precioProm = ingW / sumW;
      const r = recN ? rec / recN : 0;
      const pv = prevN ? prev / prevN : 0;
      let tendencia = 0;
      if (pv > 0) tendencia = Math.max(-0.5, Math.min(0.5, (r - pv) / pv));

      const cantidad = Math.max(0, Math.round(promedio * (1 + tendencia)));
      out.push({
        nombre, categoria: this.catDe(nombre, porSem),
        cantidad, promedio: Math.round(promedio * 10) / 10,
        tendencia, semanas: semanasCon,
        confianza: semanasCon >= 6 ? 'alta' : semanasCon >= 3 ? 'media' : 'baja',
        ...( { precioProm } as any ),
      });
    });

    return out.sort((a, b) => b.cantidad - a.cantidad);
  }

  private catDe(nombre: string, porSem: Map<number, Map<string, { qty: number; ing: number; cat: string }>>): string {
    let cat = 'otro';
    porSem.forEach((m) => { const it = m.get(nombre); if (it) cat = it.cat; });
    return cat;
  }

  private calcIngreso(porSem: Map<number, Map<string, { qty: number; ing: number; cat: string }>>, productos: PrediccionProducto[]): number {
    let total = 0;
    productos.forEach((p) => {
      let ingW = 0, sumW = 0;
      porSem.forEach((m, semana) => {
        const it = m.get(p.nombre);
        if (!it) return;
        const w = SEMANAS - semana;
        ingW += it.ing * w; sumW += w;
      });
      const precioProm = sumW ? ingW / sumW : 0;
      total += p.cantidad * precioProm;
    });
    return Math.round(total);
  }

  private horaPico(horas: Map<number, number>): string {
    let max = 0, h = 0;
    horas.forEach((v, k) => { if (v > max) { max = v; h = k; } });
    if (!max) return '—';
    const hh = h % 12 || 12;
    return `${hh}:00 ${h < 12 ? 'a.m.' : 'p.m.'}`;
  }

  // ===== 🤖 CAPA DE IA EXPERTA: recomendaciones en lenguaje natural =====
  private generarInsights(dias: PrediccionDia[], horas: Map<number, number>): Insight[] {
    const out: Insight[] = [];
    const conDatos = dias.filter((d) => d.muestras > 0);
    if (conDatos.length === 0) return out;

    const mejor = [...conDatos].sort((a, b) => b.ingresoEstimado - a.ingresoEstimado)[0];
    const peor = [...conDatos].sort((a, b) => a.ingresoEstimado - b.ingresoEstimado)[0];

    out.push({
      icono: '🔥', titulo: `Tu día fuerte es ${mejor.etiqueta}`, tipo: 'exito',
      texto: `Proyectamos ${this.f(mejor.ingresoEstimado)} y ~${mejor.totalUnidades} unidades. Refuerza producción y domiciliarios ese día.`,
    });

    if (peor.dia !== mejor.dia) {
      out.push({
        icono: '💡', titulo: `Impulsa el ${peor.etiqueta}`, tipo: 'idea',
        texto: `Es tu día más flojo (${this.f(peor.ingresoEstimado)}). Lanza una promo o combo exclusivo ese día para levantar ventas.`,
      });
    }

    // Productos en crecimiento / descenso
    const todos = new Map<string, { t: number; c: number }>();
    dias.forEach((d) => d.productos.forEach((p) => {
      const cur = todos.get(p.nombre) ?? { t: 0, c: 0 };
      cur.t += p.tendencia; cur.c++;
      todos.set(p.nombre, cur);
    }));
    const crecientes: string[] = []; const decrecientes: string[] = [];
    todos.forEach((v, k) => {
      const t = v.t / v.c;
      if (t >= 0.15) crecientes.push(k);
      else if (t <= -0.15) decrecientes.push(k);
    });
    if (crecientes.length) out.push({ icono: '📈', titulo: 'En crecimiento', tipo: 'exito', texto: `Aumenta producción de: ${crecientes.slice(0,3).join(', ')}. La demanda reciente sube.` });
    if (decrecientes.length) out.push({ icono: '📉', titulo: 'Ajusta producción', tipo: 'alerta', texto: `Reduce o produce bajo pedido: ${decrecientes.slice(0,3).join(', ')}. La demanda baja.` });

    out.push({
      icono: '⏰', titulo: `Hora pico: ${this.horaPico(horas)}`, tipo: 'info',
      texto: 'Ten todo listo 30 min antes y refuerza personal en esa franja para no perder ventas.',
    });

    const bajaConf = dias.flatMap((d) => d.productos.filter((p) => p.confianza === 'baja' && p.cantidad > 0));
    if (bajaConf.length) out.push({
      icono: '⚠️', titulo: 'Poca data aún', tipo: 'alerta',
      texto: `Para ${bajaConf.slice(0,3).map(p=>p.nombre).join(', ')} hay poco histórico. Produece conservador y ajusta semanalmente.`,
    });

    return out;
  }

  f(v: number): string { return '$' + Number(v).toLocaleString('es-CO'); }
}