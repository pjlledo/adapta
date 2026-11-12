// Motor de composición: rellena plantilla_prompt.md con la configuración resuelta.
import type { Campo, Config, Datos, Opcion, Resuelta, Valor, Variable } from './tipos.ts';
import { estaActiva, resolver } from './estado.ts';
import { evaluar } from './condiciones.ts';

const MARCADOR = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/** «a», «a y b», «a, b y c». */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function textoOpcion(opciones: Opcion[] | undefined, valor: string): string {
  const o = (opciones ?? []).find((x) => x.valor === valor);
  return o ? (o.texto_prompt ?? o.etiqueta) : valor;
}

function insertar(fragmento: string, valor: string): string {
  return fragmento.replace(MARCADOR, (todo, nombre) => (nombre === 'valor' ? valor : todo));
}

/** Texto que una medida aporta al prompt, o '' si no aporta nada. */
function fragmentoVariable(v: Variable, valor: Valor): string {
  if (!estaActiva(v, valor) && !v.siempre_en_prompt) return '';
  switch (v.tipo_control) {
    case 'checkbox': return v.fragmento_prompt;
    case 'select': return insertar(v.fragmento_prompt, textoOpcion(v.opciones, valor as string));
    case 'multiselect': return insertar(v.fragmento_prompt, enumerar((valor as string[]).map((x) => textoOpcion(v.opciones, x))));
    case 'number': return insertar(v.fragmento_prompt, String(valor));
    case 'text': return insertar(v.fragmento_prompt, (valor as string).trim());
  }
}

/** Texto que un campo del formulario aporta al prompt, o '' si no aporta nada. */
function fragmentoCampo(c: Campo, r: Resuelta, datos: Datos): string {
  const valor = r.campos[c.id];
  switch (c.tipo_control) {
    case 'checkbox': return valor === true ? c.fragmento_prompt : '';
    case 'select': {
      const o = (c.opciones ?? []).find((x) => x.valor === valor);
      return o?.texto_prompt ? insertar(c.fragmento_prompt, o.texto_prompt) : '';
    }
    case 'curso': {
      const curso = datos.etapas.flatMap((e) => e.ciclos.flatMap((k) => k.cursos)).find((k) => k.id === valor);
      return curso ? insertar(c.fragmento_prompt, curso.nombre_prompt) : '';
    }
    case 'area': {
      const area = datos.areas.find((a) => a.id === valor);
      if (!area) return '';
      const nombre = area.texto_libre ? String(r.campos.area_texto ?? '') : area.nombre;
      return nombre ? insertar(c.fragmento_prompt, nombre) : '';
    }
    default: {
      const texto = typeof valor === 'string' ? valor.trim() : '';
      if (texto) return insertar(c.fragmento_prompt, texto);
      if (!c.fragmento_defecto || (c.defecto_si && !evaluar(c.defecto_si, r.hechos))) return '';
      return c.fragmento_defecto;
    }
  }
}

function vinetas(lineas: string[]): string {
  return lineas.map((l) => `- ${l}`).join('\n');
}

/** Quita repeticiones conservando el orden. Compara sin mayúsculas ni espacios sobrantes. */
function sinRepetir(lineas: string[], vistos: Set<string> = new Set()): string[] {
  const salida: string[] = [];
  for (const l of lineas) {
    const clave = l.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(l.trim());
  }
  return salida;
}

/** Valores de todos los marcadores de la plantilla. */
function valores(r: Resuelta, datos: Datos): Record<string, string> {
  const t = datos.salidas.textos_prompt;
  const m: Record<string, string[]> = {};
  const anadir = (marcador: string, texto: string) => { if (texto) (m[marcador] ??= []).push(texto); };

  for (const c of datos.campos) anadir(c.marcador, fragmentoCampo(c, r, datos));

  anadir('etapa', r.etapa ? r.etapa.nombre_prompt : t.etapa_sin_curso);
  const pegado = (m.texto_pegado ?? []).length > 0;
  anadir('referencia_documento', pegado ? datos.salidas.referencia_documento.pegado : datos.salidas.referencia_documento.adjunto);

  const area = (m.area ?? [])[0];
  anadir('descripcion_documento', r.tipo.nombre_prompt + (area ? ` de ${area}` : '') + (r.curso ? `, ${r.curso.nombre_prompt}` : ''));

  const referencia = (m.nivel_referencia ?? [])[0] ?? '';
  anadir('tipo_adaptacion_descripcion', r.adaptacion.descripcion_prompt.replace(MARCADOR, (todo, nombre) => (nombre === 'nivel_referencia' ? referencia : todo)));

  // Medidas, en el orden del catálogo y agrupadas por principio DUA.
  const maquetacion: string[] = [];
  for (const v of datos.variables) {
    const texto = fragmentoVariable(v, r.variables[v.id]);
    if (v.seccion_prompt === 'no_cambiar') {
      anadir('regla_exigencia', r.variables[v.id] === true ? v.fragmento_prompt : (v.fragmento_desactivada ?? ''));
    } else if (v.grupo === 'formato') {
      if (texto) maquetacion.push(texto);
    } else if (texto) {
      anadir(`medidas_${v.grupo}`, `- ${texto}`);
    }
  }
  anadir('maquetacion', `${t.maquetacion}\n${vinetas([...maquetacion, ...datos.salidas.maquetacion_fija])}`);

  // Perfiles: barreras y estrategias, sin repetir estrategias entre perfiles.
  const estrategiasVistas = new Set<string>();
  const bloques = r.perfiles.map((p, i) => {
    const lineas = [`${i + 1}. ${p.nombre_prompt}`];
    if (p.personalizado) lineas.push(t.barreras_personalizado, vinetas([r.perfilPersonalizado]));
    else if (p.barreras.length) lineas.push(t.barreras, vinetas(p.barreras));
    const estrategias = sinRepetir(p.estrategias_para_ia, estrategiasVistas);
    if (estrategias.length) lineas.push(t.estrategias, vinetas(estrategias));
    return lineas.join('\n');
  });
  if (bloques.length) anadir('perfiles', `${r.adaptacion.intro_perfiles}\n${bloques.join('\n')}`);

  anadir('evitar', vinetas(sinRepetir(r.perfiles.flatMap((p) => p.evitar))));

  anadir('formato_entrega', r.formato.fragmento_prompt);
  if (!r.formato.omite_alternativa) anadir('alternativa_sin_archivos', datos.salidas.alternativa_sin_archivos);

  const entregables = datos.salidas.entregables.filter((e) => r.salidas.includes(e.id)).sort((a, b) => a.orden - b.orden);
  anadir('salidas', entregables.map((e, i) => `${i + 1}. ${e.fragmento_prompt}`).join('\n'));

  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) plano[k] = v.join('\n');
  return plano;
}

const ES_ENCABEZADO = /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ ,]+$/;
const ES_SUBTITULO = /^[^\s-].*:$/;

interface Trozo { texto: string; tipo: 'encabezado' | 'subtitulo' | 'blanco' | 'contenido' }

/**
 * Rellena la plantilla. Omite las líneas cuyo marcador queda vacío, los subtítulos sin
 * contenido debajo y las secciones que se quedan sin cuerpo.
 */
export function rellenarPlantilla(plantilla: string, valoresMarcadores: Record<string, string>): string {
  let trozos: Trozo[] = [];
  for (const linea of plantilla.replace(/\r\n/g, '\n').split('\n')) {
    if (linea.trim() === '') { trozos.push({ texto: '', tipo: 'blanco' }); continue; }
    if (!MARCADOR.test(linea)) {
      MARCADOR.lastIndex = 0;
      const tipo = ES_ENCABEZADO.test(linea) ? 'encabezado' : ES_SUBTITULO.test(linea) ? 'subtitulo' : 'contenido';
      trozos.push({ texto: linea, tipo });
      continue;
    }
    MARCADOR.lastIndex = 0;
    const soloMarcadores = linea.replace(MARCADOR, '').trim() === '';
    // El texto de los valores se inserta en una sola pasada: nunca se vuelve a interpretar.
    let hayVacio = false;
    let texto = linea.replace(MARCADOR, (_todo, nombre) => {
      const valor = valoresMarcadores[nombre] ?? '';
      if (valor === '') hayVacio = true;
      return valor;
    }).replace(/[ \t]+$/gm, '');
    // Un marcador vacío en mitad de una frase no debe dejar dos espacios seguidos.
    if (hayVacio && !soloMarcadores) texto = texto.replace(/ {2,}/g, ' ');
    if (soloMarcadores && texto.trim() === '') continue;
    trozos.push({ texto, tipo: 'contenido' });
  }

  // Subtítulos (p. ej. «Implicación:») sin contenido debajo.
  trozos = trozos.filter((t, i) => t.tipo !== 'subtitulo' || trozos[i + 1]?.tipo === 'contenido');

  // Secciones sin cuerpo.
  const secciones: Trozo[][] = [];
  for (const t of trozos) {
    if (t.tipo === 'encabezado' || secciones.length === 0) secciones.push([]);
    secciones[secciones.length - 1].push(t);
  }
  return secciones
    .filter((s) => s.some((t) => t.tipo === 'contenido' || t.tipo === 'subtitulo'))
    .map((s) => s.filter((t) => t.tipo !== 'blanco').map((t) => t.texto).join('\n'))
    .join('\n\n')
    .trim() + '\n';
}

/** Compone el prompt para la configuración indicada. */
export function componer(config: Config, datos: Datos, resuelta: Resuelta = resolver(config, datos)): string {
  return rellenarPlantilla(datos.plantilla, valores(resuelta, datos));
}

/** Nombres de las secciones de un prompt ya compuesto (para resaltarlas en la vista previa). */
export function encabezados(prompt: string): string[] {
  return prompt.split('\n').filter((l) => ES_ENCABEZADO.test(l));
}
