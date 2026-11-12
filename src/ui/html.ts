// Utilidades para generar HTML de forma segura.

/** Escapa un texto para insertarlo en HTML (contenido o atributo). */
export function e(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function icono(nombre: string): string {
  return `<svg class="i" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
}

/** Atributos booleanos: attrs({ checked: true, disabled: false }) → ' checked'. */
export function attrs(mapa: Record<string, boolean | string | number | null | undefined>): string {
  let salida = '';
  for (const [nombre, valor] of Object.entries(mapa)) {
    if (valor === true) salida += ` ${nombre}`;
    else if (valor !== false && valor !== null && valor !== undefined) salida += ` ${nombre}="${e(valor)}"`;
  }
  return salida;
}
