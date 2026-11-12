// Textos de la interfaz. Para añadir el valenciano: crear va.json con las mismas claves
// y registrarlo en IDIOMAS.
import es from './es.json';

const IDIOMAS: Record<string, Record<string, string>> = { es };
let actual = 'es';

export function idioma(): string { return actual; }
export function cambiarIdioma(codigo: string): void { if (IDIOMAS[codigo]) actual = codigo; }

/** Texto de interfaz por clave, con sustitución de {parametros}. */
export function t(clave: string, parametros: Record<string, string | number> = {}): string {
  const texto = IDIOMAS[actual][clave] ?? IDIOMAS.es[clave] ?? clave;
  return texto.replace(/\{(\w+)\}/g, (todo, nombre) => (nombre in parametros ? String(parametros[nombre]) : todo));
}
