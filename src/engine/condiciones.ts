// Evaluador de las condiciones declarativas de reglas.json, visible_si y bloqueada_salvo.
import type { Condicion } from './tipos.ts';

function estaVacio(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export function evaluar(cond: Condicion, hechos: Record<string, unknown>): boolean {
  if ('todas' in cond) return cond.todas.every((c) => evaluar(c, hechos));
  if ('alguna' in cond) return cond.alguna.some((c) => evaluar(c, hechos));
  if ('no' in cond) return !evaluar(cond.no, hechos);

  const v = hechos[cond.campo];
  const lista = Array.isArray(v) ? (v as unknown[]) : [];
  if (cond.igual !== undefined && v !== cond.igual) return false;
  if (cond.distinto !== undefined && v === cond.distinto) return false;
  if (cond.en !== undefined && !cond.en.includes(v as string)) return false;
  if (cond.incluye !== undefined && !lista.includes(cond.incluye)) return false;
  if (cond.incluye_alguno !== undefined && !cond.incluye_alguno.some((x) => lista.includes(x))) return false;
  if (cond.vacio !== undefined && estaVacio(v) !== cond.vacio) return false;
  if (cond.mayor_que !== undefined && !(typeof v === 'number' && v > cond.mayor_que)) return false;
  if (cond.minimo !== undefined && !(typeof v === 'number' && v >= cond.minimo)) return false;
  return true;
}
