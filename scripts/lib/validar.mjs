// Validación de los datos de Adapta. Lógica pura, sin dependencias ni acceso a disco:
// la usa scripts/validate-data.mjs y puede reutilizarse en los tests.

export const ARCHIVOS = [
  'niveles', 'etapas', 'areas', 'tipos_material', 'variables', 'perfiles',
  'adaptaciones', 'campos', 'salidas', 'reglas', 'presets', 'privacidad',
];

const NIVELES = ['basico', 'avanzado', 'experto'];

// Marcadores que el motor calcula por su cuenta (no vienen de campos.json).
const MARCADORES_MOTOR = [
  'etapa', 'referencia_documento', 'descripcion_documento', 'tipo_adaptacion_descripcion',
  'regla_exigencia', 'perfiles', 'medidas_representacion', 'medidas_accion',
  'medidas_implicacion', 'medidas_evaluacion', 'evitar', 'formato_entrega', 'maquetacion',
  'alternativa_sin_archivos', 'salidas',
];
// Marcadores de campos.json que no aparecen en la plantilla porque se insertan dentro de otro texto.
const MARCADORES_INTERNOS = ['area', 'nivel_referencia'];

/* ---------- Validador de JSON Schema (subconjunto usado por src/schemas) ---------- */

function tipoDe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function encajaTipo(v, tipo) {
  const t = tipoDe(v);
  return t === tipo || (tipo === 'number' && t === 'integer');
}

export function validarEsquema(dato, esquema, raiz = esquema, ruta = '') {
  const errores = [];
  const err = (msg) => errores.push(`${ruta || '(raíz)'}: ${msg}`);

  if (esquema.$ref) {
    const partes = esquema.$ref.replace(/^#\//, '').split('/');
    let destino = raiz;
    for (const p of partes) destino = destino && destino[p];
    if (!destino) return [`${ruta}: referencia de esquema desconocida ${esquema.$ref}`];
    return validarEsquema(dato, destino, raiz, ruta);
  }
  if (esquema.anyOf) {
    const alguna = esquema.anyOf.some((s) => validarEsquema(dato, s, raiz, ruta).length === 0);
    if (!alguna) err('no encaja con ninguna de las formas permitidas');
    return errores;
  }
  if (esquema.enum && !esquema.enum.includes(dato)) {
    err(`valor ${JSON.stringify(dato)} no permitido (valores: ${esquema.enum.map((x) => JSON.stringify(x)).join(', ')})`);
    return errores;
  }
  if (esquema.type) {
    const tipos = Array.isArray(esquema.type) ? esquema.type : [esquema.type];
    if (!tipos.some((t) => encajaTipo(dato, t))) {
      err(`se esperaba ${tipos.join(' o ')} y hay ${tipoDe(dato)}`);
      return errores;
    }
  }
  if (typeof dato === 'string') {
    if (esquema.minLength !== undefined && dato.length < esquema.minLength) err('el texto está vacío');
    if (esquema.pattern && !new RegExp(esquema.pattern).test(dato)) err(`"${dato}" no cumple el formato ${esquema.pattern}`);
  }
  if (typeof dato === 'number') {
    if (esquema.minimum !== undefined && dato < esquema.minimum) err(`debe ser ≥ ${esquema.minimum}`);
    if (esquema.maximum !== undefined && dato > esquema.maximum) err(`debe ser ≤ ${esquema.maximum}`);
  }
  if (Array.isArray(dato)) {
    if (esquema.minItems !== undefined && dato.length < esquema.minItems) err(`debe tener al menos ${esquema.minItems} elemento(s)`);
    if (esquema.items) {
      dato.forEach((el, i) => {
        const etiqueta = el && typeof el === 'object' && el.id ? `[${el.id}]` : `[${i}]`;
        errores.push(...validarEsquema(el, esquema.items, raiz, ruta + etiqueta));
      });
    }
  } else if (dato && typeof dato === 'object') {
    for (const clave of esquema.required || []) {
      if (!(clave in dato)) err(`falta el campo obligatorio "${clave}"`);
    }
    const props = esquema.properties || {};
    for (const [clave, valor] of Object.entries(dato)) {
      if (props[clave]) errores.push(...validarEsquema(valor, props[clave], raiz, `${ruta}.${clave}`));
      else if (esquema.additionalProperties === false) err(`campo desconocido "${clave}"`);
    }
  }
  return errores;
}

/* ---------- Comprobaciones cruzadas entre archivos ---------- */

function ids(lista) { return lista.map((x) => x.id); }

function duplicados(lista) {
  const vistos = new Set();
  const dup = new Set();
  for (const x of lista) { if (vistos.has(x)) dup.add(x); vistos.add(x); }
  return [...dup];
}

// Recorre cualquier estructura y devuelve los objetos con "id" (los «elementos» del catálogo).
function elementos(dato, ruta, salida = []) {
  if (Array.isArray(dato)) dato.forEach((el, i) => elementos(el, `${ruta}[${el && el.id ? el.id : i}]`, salida));
  else if (dato && typeof dato === 'object') {
    if ('id' in dato) salida.push({ ruta, el: dato });
    for (const [k, v] of Object.entries(dato)) elementos(v, `${ruta}.${k}`, salida);
  }
  return salida;
}

function camposDeCondicion(cond, salida = []) {
  if (!cond) return salida;
  if (cond.todas) cond.todas.forEach((c) => camposDeCondicion(c, salida));
  else if (cond.alguna) cond.alguna.forEach((c) => camposDeCondicion(c, salida));
  else if (cond.no) camposDeCondicion(cond.no, salida);
  else salida.push(cond);
  return salida;
}

export function marcadoresDe(texto) {
  return [...texto.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
}

export function comprobacionesCruzadas(d, plantilla) {
  const errores = [];
  const err = (archivo, msg) => errores.push(`${archivo}: ${msg}`);

  // 1. Todo elemento con id tiene nivel_minimo válido (salvo cursos y ciclos, que heredan el de su etapa).
  for (const archivo of ARCHIVOS) {
    for (const { ruta, el } of elementos(d[archivo], archivo)) {
      if (/\.(ciclos|cursos)\[/.test(ruta)) continue;
      if (/variables_preseleccionadas\[/.test(ruta)) continue;
      if (!NIVELES.includes(el.nivel_minimo)) err(archivo, `${ruta} no tiene un nivel_minimo válido`);
    }
  }

  // 2. Identificadores únicos dentro de cada catálogo.
  const perfiles = d.perfiles.perfiles;
  const cursos = d.etapas.flatMap((e) => e.ciclos.flatMap((c) => c.cursos));
  const ciclos = d.etapas.flatMap((e) => e.ciclos);
  const catalogos = {
    niveles: d.niveles, etapas: d.etapas, 'etapas (ciclos)': ciclos, 'etapas (cursos)': cursos, areas: d.areas,
    tipos_material: d.tipos_material, variables: d.variables, 'perfiles (grupos)': d.perfiles.grupos, perfiles,
    adaptaciones: d.adaptaciones, campos: d.campos, 'salidas (entregables)': d.salidas.entregables,
    'salidas (formatos)': d.salidas.formatos, reglas: d.reglas, presets: d.presets,
  };
  for (const [nombre, lista] of Object.entries(catalogos)) {
    for (const dup of duplicados(ids(lista))) err(nombre, `identificador repetido "${dup}"`);
  }

  const idVar = new Map(d.variables.map((v) => [v.id, v]));
  const idsPerfil = new Set(ids(perfiles));
  const idsCurso = new Set(ids(cursos));
  const idsCiclo = new Set(ids(ciclos));
  const idsEtapa = new Set(ids(d.etapas));
  const idsTipo = new Set(ids(d.tipos_material));
  const idsAdapt = new Set(ids(d.adaptaciones));
  const idsCampo = new Set(ids(d.campos));
  const idsEntregable = new Set(ids(d.salidas.entregables));
  const idsGrupo = new Set(ids(d.perfiles.grupos));

  // 3. Variables: coherencia entre tipo de control, opciones, valor por defecto y fragmento.
  for (const v of d.variables) {
    const donde = `[${v.id}]`;
    const conOpciones = v.tipo_control === 'select' || v.tipo_control === 'multiselect';
    if (conOpciones && !v.opciones) err('variables', `${donde} es ${v.tipo_control} y no tiene opciones`);
    if (!conOpciones && v.opciones) err('variables', `${donde} tiene opciones pero es ${v.tipo_control}`);
    const valores = (v.opciones || []).map((o) => o.valor);
    for (const dup of duplicados(valores)) err('variables', `${donde} repite la opción "${dup}"`);
    const usaValor = marcadoresDe(v.fragmento_prompt).includes('valor');
    if (v.tipo_control === 'checkbox') {
      if (typeof v.valor_defecto !== 'boolean') err('variables', `${donde} es una casilla: valor_defecto debe ser true o false`);
      if (usaValor) err('variables', `${donde} es una casilla: su fragmento no puede usar {{valor}}`);
    } else if (!usaValor) {
      err('variables', `${donde} es ${v.tipo_control}: su fragmento debe incluir {{valor}}`);
    }
    if (v.tipo_control === 'select' && !valores.includes(v.valor_defecto)) err('variables', `${donde} valor_defecto no es una de sus opciones`);
    if (v.tipo_control === 'multiselect') {
      if (!Array.isArray(v.valor_defecto)) err('variables', `${donde} valor_defecto debe ser una lista`);
      else for (const x of v.valor_defecto) if (!valores.includes(x)) err('variables', `${donde} valor_defecto incluye "${x}", que no es una opción`);
    }
    if (v.tipo_control === 'number' && v.valor_defecto !== null && typeof v.valor_defecto !== 'number') err('variables', `${donde} valor_defecto debe ser un número o null`);
    if (v.tipo_control === 'text' && typeof v.valor_defecto !== 'string') err('variables', `${donde} valor_defecto debe ser un texto`);
    for (const m of marcadoresDe(v.fragmento_prompt)) if (m !== 'valor') err('variables', `${donde} usa un marcador desconocido {{${m}}}`);
    for (const otro of v.incompatible_con) {
      if (!idVar.has(otro)) err('variables', `${donde} incompatible_con apunta a "${otro}", que no existe`);
      else if (!idVar.get(otro).incompatible_con.includes(v.id)) err('variables', `${donde} es incompatible con "${otro}", pero "${otro}" no lo declara a la inversa`);
    }
    if (v.grupo !== 'evaluacion' && v.grupo !== 'formato' && !v.principio_dua) err('variables', `${donde} necesita principio_dua`);
  }

  // 4. Preselecciones (perfiles y adaptaciones) apuntan a variables y valores que existen.
  const comprobarPreseleccion = (archivo, donde, lista) => {
    for (const p of lista) {
      const id = typeof p === 'string' ? p : p.id;
      const v = idVar.get(id);
      if (!v) { err(archivo, `${donde} preselecciona "${id}", que no existe en variables.json`); continue; }
      if (typeof p === 'string') {
        if (v.tipo_control !== 'checkbox') err(archivo, `${donde} preselecciona "${id}" sin valor, y no es una casilla`);
        continue;
      }
      const valores = (v.opciones || []).map((o) => o.valor);
      if (v.tipo_control === 'select' && !valores.includes(p.valor)) err(archivo, `${donde} da a "${id}" el valor "${p.valor}", que no es una opción`);
      if (v.tipo_control === 'multiselect') {
        if (!Array.isArray(p.valor)) err(archivo, `${donde} debe dar a "${id}" una lista de valores`);
        else for (const x of p.valor) if (!valores.includes(x)) err(archivo, `${donde} da a "${id}" el valor "${x}", que no es una opción`);
      }
    }
  };
  for (const p of perfiles) {
    comprobarPreseleccion('perfiles', `[${p.id}]`, p.variables_preseleccionadas);
    if (!idsGrupo.has(p.grupo)) err('perfiles', `[${p.id}] pertenece al grupo "${p.grupo}", que no existe`);
    if (!p.personalizado && p.barreras.length === 0) err('perfiles', `[${p.id}] no tiene barreras`);
  }
  for (const a of d.adaptaciones) {
    comprobarPreseleccion('adaptaciones', `[${a.id}]`, a.variables_preseleccionadas);
    for (const c of a.requiere || []) if (!idsCampo.has(c)) err('adaptaciones', `[${a.id}] requiere el campo "${c}", que no existe`);
    for (const m of marcadoresDe(a.descripcion_prompt)) if (!(a.requiere || []).includes(m)) err('adaptaciones', `[${a.id}] usa {{${m}}} sin declararlo en "requiere"`);
  }
  if (d.adaptaciones.filter((a) => a.por_defecto).length !== 1) err('adaptaciones', 'debe haber exactamente una adaptación por defecto');
  if (d.salidas.formatos.filter((f) => f.por_defecto).length !== 1) err('salidas', 'debe haber exactamente un formato por defecto');

  // 5. Referencias sueltas.
  for (const t of d.tipos_material) for (const id of t.variables_sugeridas) if (!idVar.has(id)) err('tipos_material', `[${t.id}] sugiere la variable "${id}", que no existe`);
  for (const a of d.areas) {
    if (a.etapa !== null && !idsEtapa.has(a.etapa)) err('areas', `[${a.id}] apunta a la etapa "${a.etapa}", que no existe`);
    for (const c of a.ciclos) if (!idsCiclo.has(c)) err('areas', `[${a.id}] apunta al ciclo "${c}", que no existe`);
  }
  for (const e of d.salidas.entregables) for (const id of e.sustituye_a || []) if (!idsEntregable.has(id)) err('salidas', `[${e.id}] sustituye a "${id}", que no existe`);
  for (const p of d.presets) {
    const c = p.config;
    if (!idsTipo.has(c.tipo_material)) err('presets', `[${p.id}] usa el tipo de material "${c.tipo_material}", que no existe`);
    if (!idsAdapt.has(c.adaptacion)) err('presets', `[${p.id}] usa la adaptación "${c.adaptacion}", que no existe`);
    if (c.curso !== null && !idsCurso.has(c.curso)) err('presets', `[${p.id}] usa el curso "${c.curso}", que no existe`);
    for (const id of c.perfiles) if (!idsPerfil.has(id)) err('presets', `[${p.id}] usa el perfil "${id}", que no existe`);
    for (const id of Object.keys(c.variables || {})) if (!idVar.has(id)) err('presets', `[${p.id}] fija la variable "${id}", que no existe`);
    for (const id of c.salidas || []) if (!idsEntregable.has(id)) err('presets', `[${p.id}] pide la salida "${id}", que no existe`);
    // Un preset debe poder usarse en su propio nivel.
    const orden = (n) => NIVELES.indexOf(n);
    const adapt = d.adaptaciones.find((a) => a.id === c.adaptacion);
    if (adapt && orden(adapt.nivel_minimo) > orden(p.nivel_minimo)) err('presets', `[${p.id}] usa una adaptación de nivel superior al del preset`);
    for (const id of c.perfiles) {
      const pf = perfiles.find((x) => x.id === id);
      if (pf && orden(pf.nivel_minimo) > orden(p.nivel_minimo)) err('presets', `[${p.id}] usa el perfil "${id}", de nivel superior al del preset`);
    }
  }

  // 6. Condiciones declarativas (reglas, visible_si, bloqueada_salvo): los valores citados existen.
  const universo = {
    etapa: idsEtapa, ciclo: idsCiclo, curso: idsCurso, tipo_material: idsTipo, adaptacion: idsAdapt,
    nivel: new Set(NIVELES), perfiles: idsPerfil, variables_activas: new Set(idVar.keys()), salidas: idsEntregable,
    tipo_archivo: new Set((d.campos.find((c) => c.id === 'tipo_archivo')?.opciones || []).map((o) => o.valor)),
  };
  const comprobarCondicion = (archivo, donde, cond) => {
    for (const c of camposDeCondicion(cond)) {
      const u = universo[c.campo];
      if (!u) continue;
      const citados = [c.igual, c.distinto, c.incluye, ...(c.en || []), ...(c.incluye_alguno || [])].filter((x) => typeof x === 'string');
      for (const x of citados) if (!u.has(x)) err(archivo, `${donde} la condición cita "${x}", que no existe en "${c.campo}"`);
    }
  };
  for (const r of d.reglas) {
    comprobarCondicion('reglas', `[${r.id}]`, r.condicion);
    if (r.accion) {
      const destino = { cambiar_tipo_material: idsTipo, activar_variable: new Set(idVar.keys()), activar_salida: idsEntregable, ir_a_campo: idsCampo }[r.accion.tipo];
      if (!destino.has(r.accion.valor)) err('reglas', `[${r.id}] la acción apunta a "${r.accion.valor}", que no existe`);
    }
  }
  for (const v of d.variables) { comprobarCondicion('variables', `[${v.id}]`, v.visible_si); comprobarCondicion('variables', `[${v.id}]`, v.bloqueada_salvo); }
  for (const c of d.campos) { comprobarCondicion('campos', `[${c.id}]`, c.visible_si); comprobarCondicion('campos', `[${c.id}]`, c.defecto_si); }

  // 7. Campos: opciones, valores por defecto y marcadores.
  const enPlantilla = new Set(marcadoresDe(plantilla));
  for (const c of d.campos) {
    const donde = `[${c.id}]`;
    if (c.tipo_control === 'select') {
      const valores = (c.opciones || []).map((o) => o.valor);
      if (!c.opciones) err('campos', `${donde} es un desplegable y no tiene opciones`);
      else if (!valores.includes(c.valor_defecto)) err('campos', `${donde} valor_defecto no es una de sus opciones`);
    }
    if (c.tipo_control !== 'checkbox' && !marcadoresDe(c.fragmento_prompt).includes('valor')) err('campos', `${donde} su fragmento debe incluir {{valor}}`);
    if (!enPlantilla.has(c.marcador) && !MARCADORES_INTERNOS.includes(c.marcador)) err('campos', `${donde} alimenta el marcador {{${c.marcador}}}, que no está en la plantilla`);
  }

  // 8. Plantilla: todos sus marcadores tienen quien los rellene.
  const conocidos = new Set([...MARCADORES_MOTOR, ...d.campos.map((c) => c.marcador)]);
  for (const m of enPlantilla) if (!conocidos.has(m)) err('plantilla_prompt.md', `el marcador {{${m}}} no lo rellena ni el motor ni ningún campo`);
  for (const m of MARCADORES_MOTOR) if (!enPlantilla.has(m)) err('plantilla_prompt.md', `falta el marcador {{${m}}}`);

  // 9. Detector de datos personales: las expresiones regulares son válidas.
  for (const p of d.privacidad.detector) {
    try { new RegExp(p.patron); } catch (e) { err('privacidad', `[${p.id}] expresión regular no válida: ${e.message}`); }
  }

  return errores;
}

export function contarRevisar(d) {
  const cuenta = {};
  for (const archivo of ARCHIVOS) {
    const n = elementos(d[archivo], archivo).filter(({ el }) => el.revisar === true).length;
    if (n) cuenta[archivo] = n;
  }
  return cuenta;
}

// Punto de entrada: recibe los datos y los esquemas ya leídos y devuelve la lista de errores.
export function validarTodo(datos, esquemas, plantilla) {
  const errores = [];
  for (const archivo of ARCHIVOS) {
    if (!(archivo in datos)) { errores.push(`${archivo}.json: no se ha podido leer`); continue; }
    errores.push(...validarEsquema(datos[archivo], esquemas[archivo]).map((e) => `${archivo}.json ${e}`));
  }
  if (errores.length === 0) errores.push(...comprobacionesCruzadas(datos, plantilla));
  return errores;
}
