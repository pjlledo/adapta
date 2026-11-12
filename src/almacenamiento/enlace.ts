// Compartir una configuración por enlace. El enlace nunca incluye textos libres:
// solo identificadores y valores de los catálogos. Va en el fragmento (#) de la URL,
// que el navegador no envía a ningún servidor.
import type { Config, Datos, NivelId, Valor } from '../engine/index.ts';
import { configInicial } from '../engine/index.ts';

const PREFIJO = 'c=';
const NIVELES: NivelId[] = ['basico', 'avanzado', 'experto'];

/** Copia de la configuración sin ningún texto escrito por el docente. */
export function sinTextosLibres(config: Config, datos: Datos): Config {
  const libres = new Set<string>(['area_texto', ...datos.campos.filter((c) => c.texto_libre).map((c) => c.id)]);
  const variablesLibres = new Set(datos.variables.filter((v) => v.texto_libre).map((v) => v.id));
  const personalizados = new Set(datos.perfiles.perfiles.filter((p) => p.personalizado).map((p) => p.id));
  return {
    ...config,
    perfiles: config.perfiles.filter((id) => !personalizados.has(id)),
    perfil_personalizado: '',
    variables: Object.fromEntries(Object.entries(config.variables).filter(([id]) => !variablesLibres.has(id))),
    campos: Object.fromEntries(Object.entries(config.campos).filter(([id]) => !libres.has(id))),
  };
}

/**
 * Convierte datos de origen no fiable (un enlace, el almacenamiento local) en una configuración
 * válida: descarta lo que no exista en los catálogos. Con `conTextos = false` descarta también
 * cualquier texto libre.
 */
export function sanear(origen: unknown, datos: Datos, conTextos = false): Config {
  const base = configInicial(datos);
  if (!origen || typeof origen !== 'object') return base;
  const o = origen as Record<string, unknown>;
  const cadena = (x: unknown): string | null => (typeof x === 'string' ? x : null);
  const objeto = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

  const cursos = new Set(datos.etapas.flatMap((e) => e.ciclos.flatMap((c) => c.cursos.map((k) => k.id))));
  const idsPerfil = new Set(datos.perfiles.perfiles.map((p) => p.id));
  const idsVariable = new Set(datos.variables.map((v) => v.id));
  const idsCampo = new Set(['area_texto', ...datos.campos.map((c) => c.id)]);
  const idsEntregable = new Set(datos.salidas.entregables.map((s) => s.id));

  const variables: Record<string, Valor> = {};
  for (const [id, valor] of Object.entries(objeto(o.variables))) {
    const esValor = valor === null || ['boolean', 'string', 'number'].includes(typeof valor)
      || (Array.isArray(valor) && valor.every((x) => typeof x === 'string'));
    if (idsVariable.has(id) && esValor) variables[id] = valor as Valor;
  }
  const campos: Config['campos'] = {};
  for (const [id, valor] of Object.entries(objeto(o.campos))) {
    if (idsCampo.has(id) && (valor === null || typeof valor === 'boolean' || typeof valor === 'string')) campos[id] = valor;
  }
  const salidas: Record<string, boolean> = {};
  for (const [id, valor] of Object.entries(objeto(o.salidas))) {
    if (idsEntregable.has(id) && typeof valor === 'boolean') salidas[id] = valor;
  }

  const config: Config = {
    nivel: NIVELES.includes(o.nivel as NivelId) ? (o.nivel as NivelId) : base.nivel,
    tipo_material: datos.tipos_material.some((t) => t.id === o.tipo_material) ? (o.tipo_material as string) : base.tipo_material,
    adaptacion: datos.adaptaciones.some((a) => a.id === o.adaptacion) ? (o.adaptacion as string) : base.adaptacion,
    curso: cursos.has(o.curso as string) ? (o.curso as string) : null,
    perfiles: Array.isArray(o.perfiles) ? [...new Set(o.perfiles.filter((id): id is string => typeof id === 'string' && idsPerfil.has(id)))] : [],
    perfil_personalizado: (cadena(o.perfil_personalizado) ?? '').slice(0, 400),
    variables,
    campos,
    salidas,
    formato: datos.salidas.formatos.some((f) => f.id === o.formato) ? (o.formato as string) : null,
  };
  return conTextos ? config : sinTextosLibres(config, datos);
}

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(codigo: string): string {
  const binario = atob(codigo.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/** Fragmento de URL (sin la almohadilla) que reproduce la configuración, sin textos libres. */
export function codificar(config: Config, datos: Datos): string {
  return PREFIJO + aBase64Url(JSON.stringify(sinTextosLibres(config, datos)));
}

/** Configuración contenida en un fragmento de URL, o null si no hay ninguna o no es válida. */
export function decodificar(fragmento: string, datos: Datos): Config | null {
  const limpio = fragmento.replace(/^#/, '');
  if (!limpio.startsWith(PREFIJO)) return null;
  try {
    return sanear(JSON.parse(deBase64Url(limpio.slice(PREFIJO.length))), datos, false);
  } catch {
    return null;
  }
}
