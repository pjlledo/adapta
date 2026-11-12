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
