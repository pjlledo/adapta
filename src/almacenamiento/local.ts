// localStorage: solo el nivel elegido y preferencias de interfaz. Nunca textos libres.
import type { NivelId } from '../engine/index.ts';

const CLAVE_NIVEL = 'adapta.nivel';
const NIVELES: NivelId[] = ['basico', 'avanzado', 'experto'];

export function leerNivel(): NivelId | null {
  try {
    const v = localStorage.getItem(CLAVE_NIVEL) as NivelId | null;
    return v && NIVELES.includes(v) ? v : null;
  } catch {
    return null; // almacenamiento bloqueado (modo privado, políticas del centro…)
  }
}

export function guardarNivel(nivel: NivelId): void {
  try { localStorage.setItem(CLAVE_NIVEL, nivel); } catch { /* la app funciona igual sin recordar el nivel */ }
}

/* ---------- Tema (claro u oscuro) ---------- */

const CLAVE_TEMA = 'adapta.tema';
export type Tema = 'light' | 'dark';

export function leerTema(): Tema | null {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return v === 'light' || v === 'dark' ? v : null;
  } catch { return null; }
}
export function guardarTema(tema: Tema): void {
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* sin almacenamiento: el tema dura esta visita */ }
}

/* ---------- Configuraciones guardadas ---------- */

const CLAVE_GUARDADAS = 'adapta.configuraciones';
export const MAX_GUARDADAS = 20;

export interface Guardada {
  nombre: string;
  /** true si el docente pidió expresamente guardar también sus textos. */
  conTextos: boolean;
  /** Configuración tal como se guardó; se sanea al cargarla. */
  config: unknown;
}

export function leerGuardadas(): Guardada[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_GUARDADAS) ?? '[]');
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((g) => g && typeof g.nombre === 'string' && g.nombre.trim() !== '' && g.config && typeof g.config === 'object')
      .map((g) => ({ nombre: g.nombre.slice(0, 60), conTextos: g.conTextos === true, config: g.config }))
      .slice(0, MAX_GUARDADAS);
  } catch { return []; }
}

/** Guarda la lista. Devuelve false si el navegador no lo permite. */
export function escribirGuardadas(lista: Guardada[]): boolean {
  try { localStorage.setItem(CLAVE_GUARDADAS, JSON.stringify(lista.slice(0, MAX_GUARDADAS))); return true; } catch { return false; }
}
