// Estado de la configuración: valores por defecto, resolución según el nivel y cambio de nivel.
import type {
  Config, Datos, Elemento, NivelId, Preseleccion, Resuelta, Sugerencia, Valor, Variable, Campo,
} from './tipos.ts';
import { evaluar } from './condiciones.ts';
import { detectarDatosPersonales } from './detector.ts';

const ORDEN: NivelId[] = ['basico', 'avanzado', 'experto'];

/** ¿Está este elemento disponible en el nivel indicado? */
export function disponible(el: Elemento, nivel: NivelId): boolean {
  return ORDEN.indexOf(el.nivel_minimo) <= ORDEN.indexOf(nivel);
}

export function configInicial(datos: Datos): Config {
  const adaptacion = datos.adaptaciones.find((a) => a.por_defecto) ?? datos.adaptaciones[0];
  return {
    nivel: 'basico',
    tipo_material: datos.tipos_material[0].id,
    adaptacion: adaptacion.id,
    curso: null,
    perfiles: [],
    perfil_personalizado: '',
    variables: {},
    campos: {},
    salidas: {},
    formato: null,
  };
}

/** ¿Tiene la medida un valor distinto de su valor neutro? */
export function estaActiva(v: Variable, valor: Valor): boolean {
  switch (v.tipo_control) {
    case 'checkbox': return valor === true;
    case 'select': return valor !== v.valor_defecto;
    case 'multiselect': return Array.isArray(valor) && valor.length > 0;
    case 'number': return typeof valor === 'number';
    case 'text': return typeof valor === 'string' && valor.trim() !== '';
  }
}

function valorValido(v: Variable, valor: Valor): boolean {
  const opciones = (v.opciones ?? []).map((o) => o.valor);
  switch (v.tipo_control) {
    case 'checkbox': return typeof valor === 'boolean';
    case 'select': return typeof valor === 'string' && opciones.includes(valor);
    case 'multiselect': return Array.isArray(valor) && valor.every((x) => opciones.includes(x));
    case 'number':
      return valor === null || (typeof valor === 'number' && Number.isFinite(valor)
        && (v.minimo === undefined || valor >= v.minimo) && (v.maximo === undefined || valor <= v.maximo));
    case 'text': return typeof valor === 'string';
  }
}

/** Combina dos valores sugeridos para la misma medida (p. ej. por dos perfiles). */
function fusionar(v: Variable, a: Valor, b: Valor): Valor {
  const opciones = (v.opciones ?? []).map((o) => o.valor);
  if (v.tipo_control === 'multiselect') {
    const union = new Set([...(a as string[]), ...(b as string[])]);
    return opciones.filter((o) => union.has(o));
  }
  // En un desplegable gana la opción situada más abajo en la lista (la más intensa).
  if (v.tipo_control === 'select') return opciones.indexOf(b as string) > opciones.indexOf(a as string) ? b : a;
  if (v.tipo_control === 'number') return Math.max(a as number, b as number);
  return a === true || b === true ? true : a;
}

function sugerir(
  sugerencias: Record<string, Sugerencia>, variables: Map<string, Variable>, lista: Preseleccion[], origen: string,
): void {
  for (const p of lista) {
    const id = typeof p === 'string' ? p : p.id;
    const v = variables.get(id);
    if (!v) continue;
    const valor: Valor = typeof p === 'string' ? true : p.valor;
    if (!valorValido(v, valor)) continue;
    const previa = sugerencias[id];
    if (previa) {
      previa.valor = fusionar(v, previa.valor, valor);
      if (!previa.origenes.includes(origen)) previa.origenes.push(origen);
    } else {
      sugerencias[id] = { valor: Array.isArray(valor) ? [...valor] : valor, origenes: [origen] };
    }
  }
}

function campoVisible(c: Campo, nivel: NivelId, hechos: Record<string, unknown>): boolean {
  return disponible(c, nivel) && (!c.visible_si || evaluar(c.visible_si, hechos));
}

/**
 * Resuelve la configuración: aplica a cada opción su valor real en el nivel actual.
 * Las opciones ocultas toman el valor por defecto del JSON o el derivado de los perfiles.
 */
export function resolver(config: Config, datos: Datos): Resuelta {
  const nivel = datos.niveles.find((n) => n.id === config.nivel) ?? datos.niveles[0];
  const tipo = datos.tipos_material.find((t) => t.id === config.tipo_material && disponible(t, nivel.id)) ?? datos.tipos_material[0];

  const porDefecto = datos.adaptaciones.find((a) => a.por_defecto) ?? datos.adaptaciones[0];
  let adaptacion = datos.adaptaciones.find((a) => a.id === config.adaptacion) ?? porDefecto;
  if (!disponible(adaptacion, nivel.id)) {
    adaptacion = datos.adaptaciones.find((a) => a.id === adaptacion.al_ocultarse) ?? porDefecto;
  }

  let curso = null, ciclo = null, etapa = null;
  for (const e of datos.etapas) for (const c of e.ciclos) for (const k of c.cursos) {
    if (k.id === config.curso && e.activo) { curso = k; ciclo = c; etapa = e; }
  }

  const perfilPersonalizado = config.perfil_personalizado.trim();
  const perfiles = datos.perfiles.perfiles.filter((p) =>
    config.perfiles.includes(p.id) && disponible(p, nivel.id) && (!p.personalizado || perfilPersonalizado !== ''));

  const hechos: Record<string, unknown> = {
    nivel: nivel.id,
    tipo_material: tipo.id,
    es_evaluacion: tipo.es_evaluacion,
    adaptacion: adaptacion.id,
    curso: curso?.id ?? null,
    ciclo: ciclo?.id ?? null,
    etapa: etapa?.id ?? null,
    perfiles: perfiles.map((p) => p.id),
    n_perfiles: perfiles.length,
  };

  // Medidas sugeridas por el tipo de adaptación, el tipo de material y los perfiles.
  const porId = new Map(datos.variables.map((v) => [v.id, v]));
  const sugerencias: Record<string, Sugerencia> = {};
  sugerir(sugerencias, porId, adaptacion.variables_preseleccionadas, adaptacion.nombre);
  sugerir(sugerencias, porId, tipo.variables_sugeridas, tipo.nombre);
  for (const p of perfiles) sugerir(sugerencias, porId, p.variables_preseleccionadas, p.nombre);

  const variables: Record<string, Valor> = {};
  for (const v of datos.variables) {
    const visible = !v.visible_si || evaluar(v.visible_si, hechos);
    const bloqueada = v.bloqueada_salvo !== undefined && !evaluar(v.bloqueada_salvo, hechos);
    if (!visible || bloqueada) { variables[v.id] = v.valor_defecto; delete sugerencias[v.id]; continue; }
    const base = sugerencias[v.id]?.valor ?? v.valor_defecto;
    const editable = disponible(v, nivel.id) && nivel.medidas_editables;
    const propio = config.variables[v.id];
    variables[v.id] = editable && propio !== undefined && valorValido(v, propio) ? propio : base;
  }
  // Dos medidas incompatibles no pueden estar activas a la vez: se conserva la primera del catálogo.
  for (const v of datos.variables) {
    if (!estaActiva(v, variables[v.id])) continue;
    for (const otra of v.incompatible_con) {
      const o = porId.get(otra);
      if (o && estaActiva(o, variables[otra]) && datos.variables.indexOf(o) > datos.variables.indexOf(v)) variables[otra] = o.valor_defecto;
    }
  }
  const activas = datos.variables.filter((v) => estaActiva(v, variables[v.id])).map((v) => v.id);

  const campos: Record<string, boolean | string | null> = {};
  for (const c of datos.campos) {
    const propio = config.campos[c.id];
    campos[c.id] = campoVisible(c, nivel.id, hechos) && propio !== undefined ? propio : c.valor_defecto;
  }
  const area = datos.areas.find((a) => a.id === campos.area);
  campos.area_texto = area?.texto_libre ? String(config.campos.area_texto ?? '').trim() : '';

  // Entregables: los obligatorios siempre; el resto, lo elegido o su valor por defecto.
  const elegidos = datos.salidas.entregables.filter((e) => {
    if (e.obligatorio) return true;
    const propio = config.salidas[e.id];
    return disponible(e, nivel.id) && propio !== undefined ? propio : e.valor_defecto;
  });
  const sustituidos = new Set(elegidos.flatMap((e) => e.sustituye_a ?? []));
  const salidas = elegidos.filter((e) => !sustituidos.has(e.id)).sort((a, b) => a.orden - b.orden).map((e) => e.id);

  const formatoDefecto = datos.salidas.formatos.find((f) => f.por_defecto) ?? datos.salidas.formatos[0];
  const formato = datos.salidas.formatos.find((f) => f.id === config.formato && disponible(f, nivel.id)) ?? formatoDefecto;

  const textosLibres = [
    perfilPersonalizado,
    String(campos.area_texto ?? ''),
    ...datos.campos.filter((c) => c.texto_libre).map((c) => String(campos[c.id] ?? '')),
    ...datos.variables.filter((v) => v.texto_libre).map((v) => String(variables[v.id] ?? '')),
  ].join('\n');

  Object.assign(hechos, {
    variables_activas: activas,
    n_medidas: datos.variables.filter((v) => activas.includes(v.id) && v.grupo !== 'formato' && !v.seccion_prompt).length,
    nivel_referencia: campos.nivel_referencia ?? null,
    tipo_archivo: campos.tipo_archivo ?? null,
    mantener_criterios: variables.mantener_criterios === true,
    salidas,
    datos_personales: detectarDatosPersonales(textosLibres, datos.privacidad.detector).length > 0,
  });

  return { nivel, tipo, adaptacion, curso, ciclo, etapa, perfiles, perfilPersonalizado, sugerencias, variables, activas, campos, salidas, formato, hechos };
}

export interface CambioNivel {
  /** Configuración ya adaptada al nuevo nivel. */
  config: Config;
  /** Número de opciones que han vuelto a su valor por defecto (0 al subir de nivel). */
  restablecidas: number;
  /** Configuración anterior, para poder deshacer. */
  anterior: Config;
}

/**
 * Cambia de nivel. Al subir se conserva todo. Al bajar, las opciones que dejan de verse
 * vuelven a su valor por defecto y se informa de cuántas son.
 */
export function cambiarNivel(config: Config, nuevo: NivelId, datos: Datos): CambioNivel {
  const nivelNuevo = datos.niveles.find((n) => n.id === nuevo) ?? datos.niveles[0];
  const antes = resolver(config, datos);

  const variables: Record<string, Valor> = {};
  for (const v of datos.variables) {
    if (config.variables[v.id] !== undefined && disponible(v, nuevo) && nivelNuevo.medidas_editables) variables[v.id] = config.variables[v.id];
  }
  const campos: Config['campos'] = {};
  for (const c of datos.campos) {
    if (config.campos[c.id] !== undefined && disponible(c, nuevo)) campos[c.id] = config.campos[c.id];
  }
  if (campos.area !== undefined && config.campos.area_texto !== undefined) campos.area_texto = config.campos.area_texto;
  const salidas: Record<string, boolean> = {};
  for (const e of datos.salidas.entregables) {
    if (config.salidas[e.id] !== undefined && disponible(e, nuevo)) salidas[e.id] = config.salidas[e.id];
  }
  const formato = datos.salidas.formatos.find((f) => f.id === config.formato && disponible(f, nuevo));
  const perfiles = config.perfiles.filter((id) => {
    const p = datos.perfiles.perfiles.find((x) => x.id === id);
    return p !== undefined && disponible(p, nuevo);
  });
  const personalizado = datos.perfiles.perfiles.find((p) => p.personalizado);

  const siguiente: Config = {
    nivel: nuevo,
    tipo_material: antes.tipo.id,
    adaptacion: config.adaptacion,
    curso: config.curso,
    perfiles,
    perfil_personalizado: personalizado && disponible(personalizado, nuevo) ? config.perfil_personalizado : '',
    variables,
    campos,
    salidas,
    formato: formato ? formato.id : null,
  };
  const despues = resolver(siguiente, datos);
  siguiente.adaptacion = despues.adaptacion.id;

  const distinto = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  let restablecidas = 0;
  for (const v of datos.variables) if (distinto(antes.variables[v.id], despues.variables[v.id])) restablecidas++;
  for (const c of datos.campos) if (distinto(antes.campos[c.id], despues.campos[c.id])) restablecidas++;
  for (const e of datos.salidas.entregables) if (antes.salidas.includes(e.id) !== despues.salidas.includes(e.id)) restablecidas++;
  if (antes.formato.id !== despues.formato.id) restablecidas++;
  if (antes.adaptacion.id !== despues.adaptacion.id) restablecidas++;
  restablecidas += antes.perfiles.length - despues.perfiles.length;

  return { config: siguiente, restablecidas, anterior: config };
}
