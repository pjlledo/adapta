// Utilidades comunes de los tests: carga de datos y comprobaciones que debe cumplir todo prompt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import type { Config, Datos } from '../src/engine/index.ts';
import { configInicial, encabezados } from '../src/engine/index.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const leer = (nombre: string) => JSON.parse(readFileSync(join(raiz, `${nombre}.json`), 'utf8'));

export function cargarDatos(): Datos {
  return {
    niveles: leer('niveles'), etapas: leer('etapas'), areas: leer('areas'), tipos_material: leer('tipos_material'),
    variables: leer('variables'), perfiles: leer('perfiles'), adaptaciones: leer('adaptaciones'), campos: leer('campos'),
    salidas: leer('salidas'), reglas: leer('reglas'), presets: leer('presets'), privacidad: leer('privacidad'),
    plantilla: readFileSync(join(raiz, 'plantilla_prompt.md'), 'utf8'),
  };
}

export function config(datos: Datos, cambios: Partial<Config>): Config {
  return { ...configInicial(datos), ...cambios };
}

/** Requisito del apartado 12: sin marcadores sin rellenar, secciones vacías ni repeticiones. */
export function comprobarPrompt(prompt: string): void {
  assert.doesNotMatch(prompt, /\{\{|\}\}/, 'quedan marcadores sin rellenar');
  assert.doesNotMatch(prompt, /undefined|null|\[object/, 'se ha colado un valor sin formato');
  assert.doesNotMatch(prompt, / {2,}/, 'hay espacios dobles');
  assert.doesNotMatch(prompt, /\n{3,}/, 'hay más de una línea en blanco seguida');
  assert.doesNotMatch(prompt, /[ \t]\n/, 'hay espacios al final de una línea');
  assert.doesNotMatch(prompt, /^-\s*$/m, 'hay una viñeta vacía');
  assert.doesNotMatch(prompt, /: ?\.|,\s*\.|\(\s*\)| ,| \./, 'hay puntuación suelta por un valor vacío');

  const lineas = prompt.split('\n');
  const cabeceras = encabezados(prompt);
  assert.ok(cabeceras.includes('ROL') && cabeceras.includes('TAREA') && cabeceras.includes('COMPROBACIÓN FINAL'), 'faltan secciones fijas');
  assert.equal(new Set(cabeceras).size, cabeceras.length, 'hay secciones repetidas');

  // Ninguna sección ni subtítulo vacío: tras cada encabezado o subtítulo hay contenido.
  lineas.forEach((l, i) => {
    const esCabecera = cabeceras.includes(l);
    const esSubtitulo = /^[^\s-].*:$/.test(l);
    if (!esCabecera && !esSubtitulo) return;
    const siguiente = lineas[i + 1] ?? '';
    assert.ok(siguiente.trim() !== '' && !cabeceras.includes(siguiente), `«${l}» no tiene contenido debajo`);
    if (esSubtitulo) assert.doesNotMatch(siguiente, /^[^\s-].*:$/, `«${l}» va seguido de otro subtítulo`);
  });

  // Sin líneas repetidas (salvo los rótulos, que se repiten en cada perfil).
  const vistas = new Set<string>();
  for (const l of lineas) {
    const clave = l.trim().toLowerCase();
    if (clave === '' || clave.endsWith(':')) continue;
    assert.ok(!vistas.has(clave), `línea repetida: «${l}»`);
    vistas.add(clave);
  }
}
