// Detector simple de posibles datos personales en los textos libres. Avisa, no bloquea.
import type { PatronDetector } from './tipos.ts';

/** Devuelve los patrones que aparecen en el texto (sin repetir), en el orden del catálogo. */
export function detectarDatosPersonales(texto: string, patrones: PatronDetector[]): PatronDetector[] {
  if (!texto) return [];
  return patrones.filter((p) => new RegExp(p.patron).test(texto));
}
