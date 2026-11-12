// Formulario: pasos 0 a 6. Devuelve HTML; los eventos se gestionan en app.ts mediante
// los atributos data-k (qué se cambia) y data-id (qué elemento).
import type { Campo, Config, Datos, Opcion, Resuelta, Variable } from '../engine/index.ts';
import { detectarDatosPersonales, disponible, estaActiva, evaluar } from '../engine/index.ts';
import { t } from '../i18n/index.ts';
import { attrs, e, icono } from './html.ts';

export interface Vista { config: Config; r: Resuelta; privacidad: Record<string, boolean> }

const GRUPOS: Variable['grupo'][] = ['representacion', 'accion', 'implicacion', 'evaluacion', 'formato'];

/** Aviso del detector de datos personales para un texto libre ('' si no hay nada). */
export function avisoDetector(texto: string, datos: Datos): string {
  const encontrados = detectarDatosPersonales(texto, datos.privacidad.detector);
  if (encontrados.length === 0) return '';
  return datos.privacidad.mensaje_detector.replace('{{tipo}}', encontrados.map((p) => p.nombre).join(', '));
}

function huecoDetector(id: string, texto: string, datos: Datos): string {
  return `<p class="hint warn" id="det-${e(id)}" data-detector="${e(id)}" role="status">${e(avisoDetector(texto, datos))}</p>`;
}

function seccion(n: number, id: string, titulo: string, cuerpo: string, ayuda = ''): string {
  return `<section class="card paso-card" id="${id}" aria-labelledby="${id}-t">
    <h2 id="${id}-t"><span class="paso-n" aria-hidden="true">${n}</span>${e(titulo)}</h2>
    ${ayuda ? `<p class="lead">${e(ayuda)}</p>` : ''}
    <div class="stack">${cuerpo}</div>
  </section>`;
}

function opciones(lista: Opcion[], valor: unknown): string {
  return lista.map((o) => `<option value="${e(o.valor)}"${attrs({ selected: o.valor === valor })}>${e(o.etiqueta)}</option>`).join('');
}

function opcionesCurso(datos: Datos, valor: unknown, vacio: string): string {
  let html = `<option value="">${e(vacio)}</option>`;
  for (const etapa of datos.etapas.filter((x) => x.activo)) {
    for (const ciclo of etapa.ciclos) {
      html += `<optgroup label="${e(`${etapa.nombre} · ${ciclo.nombre}`)}">`;
      html += ciclo.cursos.map((c) => `<option value="${e(c.id)}"${attrs({ selected: c.id === valor })}>${e(c.nombre)}</option>`).join('');
      html += '</optgroup>';
    }
  }
  return html;
}

/* ---------- Paso 0: inicio rápido ---------- */

function paso0(v: Vista, datos: Datos): string {
  const tarjetas = datos.presets.filter((p) => disponible(p, v.r.nivel.id)).map((p) => {
    const tipo = datos.tipos_material.find((x) => x.id === p.config.tipo_material);
    const adaptacion = datos.adaptaciones.find((x) => x.id === p.config.adaptacion);
    return `<button type="button" class="preset" data-k="preset" data-id="${e(p.id)}" id="preset-${e(p.id)}">
      <strong>${e(p.nombre)}</strong>
      <span class="preset-desc">${e(p.descripcion)}</span>
      <span class="meta"><span class="chip et">${e(tipo?.nombre)}</span><span class="chip">${e(t('paso1.nivel_respuesta', { n: adaptacion?.nivel_respuesta ?? '' }))}</span></span>
    </button>`;
  }).join('');
  return `<section class="paso-cero" id="paso-0" aria-labelledby="paso-0-t">
    <h2 id="paso-0-t">${e(t('paso0.titulo'))}</h2>
    <p class="lead">${e(t('paso0.ayuda'))}</p>
    <div class="presets">${tarjetas}</div>
  </section>`;
}

/* ---------- Campos genéricos (campos.json) ---------- */

function campo(c: Campo, v: Vista, datos: Datos): string {
  const id = `campo-${c.id}`;
  const valor = v.r.campos[c.id];
  const base = `id="${id}" data-k="campo" data-id="${e(c.id)}" aria-describedby="${id}-ayuda${c.texto_libre ? ` det-${c.id}` : ''}"`;
  const ayuda = `<p class="hint" id="${id}-ayuda">${e(c.ayuda)}</p>`;
  const detector = c.texto_libre ? huecoDetector(c.id, String(valor ?? ''), datos) : '';
  const max = attrs({ maxlength: c.longitud_maxima });

  switch (c.tipo_control) {
    case 'checkbox':
      return `<div><label class="chk"><input type="checkbox" ${base}${attrs({ checked: valor === true })}><span>${e(c.etiqueta)}</span></label>${ayuda}</div>`;
    case 'select':
      return `<div><label class="f" for="${id}">${e(c.etiqueta)}</label><select ${base}>${opciones(c.opciones ?? [], valor)}</select>${ayuda}</div>`;
    case 'curso':
      return `<div><label class="f" for="${id}">${e(c.etiqueta)}</label><select ${base}>${opcionesCurso(datos, valor, t('paso2.curso_elige'))}</select>${ayuda}</div>`;
    case 'area': {
      const lista = datos.areas.filter((a) => disponible(a, v.r.nivel.id)
        && (a.etapa === null || !v.r.etapa || a.etapa === v.r.etapa.id)
        && (a.ciclos.length === 0 || !v.r.ciclo || a.ciclos.includes(v.r.ciclo.id)));
      const ops = `<option value="">${e(t('paso2.area_elige'))}</option>` + lista.map((a) => `<option value="${e(a.id)}"${attrs({ selected: a.id === valor })}>${e(a.nombre)}</option>`).join('');
      const esOtra = datos.areas.find((a) => a.id === valor)?.texto_libre === true;
      const otra = esOtra
        ? `<label class="f" for="campo-area_texto">${e(t('paso2.area_otra'))}</label><input type="text" id="campo-area_texto" data-k="campo" data-id="area_texto" maxlength="80" value="${e(v.config.campos.area_texto ?? '')}" aria-describedby="det-area_texto">${huecoDetector('area_texto', String(v.config.campos.area_texto ?? ''), datos)}`
        : '';
      return `<div><label class="f" for="${id}">${e(c.etiqueta)}</label><select ${base}>${ops}</select>${ayuda}${otra}</div>`;
    }
    case 'textarea':
      return `<div><label class="f" for="${id}">${e(c.etiqueta)}</label><textarea ${base}${max} rows="3">${e(valor ?? '')}</textarea>${ayuda}${detector}</div>`;
    default:
      return `<div><label class="f" for="${id}">${e(c.etiqueta)}</label><input type="text" ${base}${max} value="${e(valor ?? '')}">${ayuda}${detector}</div>`;
  }
}

function camposDelPaso(paso: number, v: Vista, datos: Datos): string {
  return datos.campos
    .filter((c) => c.paso === paso && disponible(c, v.r.nivel.id) && visible(c, v))
    .map((c) => campo(c, v, datos)).join('');
}

function visible(c: Campo, v: Vista): boolean {
  return !c.visible_si || evaluar(c.visible_si, v.r.hechos);
}

/* ---------- Paso 1: qué vas a adaptar ---------- */

function paso1(v: Vista, datos: Datos): string {
  const nivel = v.r.nivel.id;
  const tipos = datos.tipos_material.filter((x) => disponible(x, nivel)).map((x) => `
    <label class="opcion"><input type="radio" name="tipo_material" id="tipo-${e(x.id)}" data-k="tipo_material" value="${e(x.id)}"${attrs({ checked: x.id === v.r.tipo.id })}>
      <span><span class="nombre">${e(x.nombre)}</span><span class="desc">${e(x.descripcion)}</span></span></label>`).join('');
  const avisosTipo = v.r.tipo.avisos.map((a) => `<p class="hint">${e(a)}</p>`).join('');

  const adaptaciones = datos.adaptaciones.filter((x) => disponible(x, nivel)).map((x) => `
    <label class="opcion"><input type="radio" name="adaptacion" id="adaptacion-${e(x.id)}" data-k="adaptacion" value="${e(x.id)}"${attrs({ checked: x.id === v.r.adaptacion.id })}>
      <span><span class="nombre">${e(x.nombre)} <span class="chip et">${e(t('paso1.nivel_respuesta', { n: x.nivel_respuesta }))}</span>${x.por_defecto ? ` <span class="chip sug">${e(t('paso1.recomendado'))}</span>` : ''}</span>
      <span class="desc">${e(x.descripcion)}</span></span></label>`).join('');
  const avisoAdaptacion = v.r.adaptacion.aviso ? `<p class="hint">${e(v.r.adaptacion.aviso)}</p>` : '';

  return seccion(1, 'paso-1', t('paso1.titulo'), `
    <fieldset><legend>${e(t('paso1.tipo'))}</legend><div class="opciones dos">${tipos}</div>${avisosTipo}</fieldset>
    <fieldset><legend>${e(t('paso1.destinatarios'))}</legend><div class="opciones">${adaptaciones}</div>${avisoAdaptacion}</fieldset>
    ${camposDelPaso(1, v, datos)}`);
}

/* ---------- Paso 2: contexto ---------- */

function paso2(v: Vista, datos: Datos): string {
  return seccion(2, 'paso-2', t('paso2.titulo'), `
    <div><label class="f" for="curso">${e(t('paso2.curso'))}</label>
      <select id="curso" data-k="curso">${opcionesCurso(datos, v.config.curso, t('paso2.curso_elige'))}</select></div>
    ${camposDelPaso(2, v, datos)}`);
}

/* ---------- Paso 3: perfiles ---------- */

function paso3(v: Vista, datos: Datos): string {
  const nivel = v.r.nivel;
  const elegidos = v.config.perfiles.filter((id) => datos.perfiles.perfiles.some((p) => p.id === id && disponible(p, nivel.id)));
  const lleno = nivel.max_perfiles !== null && elegidos.length >= nivel.max_perfiles;
  const lista = (titulo: string, items: string[]) => items.length ? `<h4>${e(titulo)}</h4><ul>${items.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : '';

  const grupos = datos.perfiles.grupos.map((g) => {
    const tarjetas = datos.perfiles.perfiles.filter((p) => p.grupo === g.id && disponible(p, nivel.id)).map((p) => {
      const marcado = elegidos.includes(p.id);
      const detalle = p.personalizado
        ? (marcado ? `<div class="perfil-extra"><label class="f" for="perfil-personalizado">${e(t('paso3.personalizado'))}</label>
            <textarea id="perfil-personalizado" data-k="personalizado" rows="3" maxlength="400" aria-describedby="det-personalizado">${e(v.config.perfil_personalizado)}</textarea>
            ${huecoDetector('personalizado', v.config.perfil_personalizado, datos)}</div>` : '')
        : `<details id="det-perfil-${e(p.id)}"><summary>${e(t('paso3.detalle'))}</summary>
            ${lista(t('paso3.barreras'), p.barreras)}${lista(t('paso3.estrategias'), p.estrategias_para_ia)}${lista(t('paso3.evitar'), p.evitar)}
            ${p.nota_docente ? `<p class="hint">${e(p.nota_docente)}</p>` : ''}</details>`;
      return `<div class="perfil-card"><label><input type="checkbox" id="perfil-${e(p.id)}" data-k="perfil" data-id="${e(p.id)}"${attrs({ checked: marcado, disabled: lleno && !marcado })}>
        <span><span class="nombre">${e(p.nombre)}</span><span class="desc">${e(p.descripcion_docente)}</span></span></label>${detalle}</div>`;
    }).join('');
    return tarjetas ? `<div class="perf-grupo"><h3>${e(g.nombre)}</h3>${tarjetas}</div>` : '';
  }).join('');

  const limite = nivel.max_perfiles !== null ? `<p class="hint${lleno ? ' fuerte' : ''}" role="status">${e(t('paso3.limite', { n: nivel.max_perfiles }))}</p>` : '';
  const vacio = v.r.adaptacion.id === 'grupo' && elegidos.length === 0 ? `<p class="hint">${e(t('paso3.grupo_vacio'))}</p>` : '';
  return seccion(3, 'paso-3', v.r.adaptacion.titulo_perfiles, `${limite}${vacio}${grupos}`, datos.perfiles.ayuda);
}

/* ---------- Paso 4: medidas ---------- */

function chipSugerida(variable: Variable, v: Vista): string {
  const s = v.r.sugerencias[variable.id];
  return s ? ` <span class="chip sug">${e(t('paso4.sugerida', { origen: s.origenes.join(', ') }))}</span>` : '';
}

function textoValor(variable: Variable, valor: unknown): string {
  const etiqueta = (x: unknown) => variable.opciones?.find((o) => o.valor === x)?.etiqueta ?? String(x);
  if (Array.isArray(valor)) return valor.map(etiqueta).join(', ');
  if (variable.tipo_control === 'select') return etiqueta(valor);
  return String(valor);
}

function control(variable: Variable, v: Vista, datos: Datos): string {
  const id = `var-${variable.id}`;
  const valor = v.r.variables[variable.id];
  const bloqueada = variable.bloqueada_salvo !== undefined && !evaluar(variable.bloqueada_salvo, v.r.hechos);
  const ayuda = `<p class="hint" id="${id}-ayuda">${e(variable.ayuda)}</p>`;
  const base = `data-k="var" data-id="${e(variable.id)}" aria-describedby="${id}-ayuda"`;
  const chip = chipSugerida(variable, v) + (bloqueada ? ` <span class="chip">${e(t('paso4.bloqueada'))}</span>` : '');

  switch (variable.tipo_control) {
    case 'checkbox':
      return `<div class="medida"><label class="chk"><input type="checkbox" id="${id}" ${base}${attrs({ checked: valor === true, disabled: bloqueada })}><span>${e(variable.etiqueta)}${chip}</span></label>${ayuda}</div>`;
    case 'select':
      return `<div class="medida"><label class="f" for="${id}">${e(variable.etiqueta)}${chip}</label><select id="${id}" ${base}>${opciones(variable.opciones ?? [], valor)}</select>${ayuda}</div>`;
    case 'multiselect': {
      const elegidas = Array.isArray(valor) ? valor : [];
      const casillas = (variable.opciones ?? []).map((o) => `<label class="chk"><input type="checkbox" id="${id}-${e(o.valor)}" data-k="var-multi" data-id="${e(variable.id)}" value="${e(o.valor)}"${attrs({ checked: elegidas.includes(o.valor) })}><span>${e(o.etiqueta)}</span></label>`).join('');
      return `<fieldset class="medida"><legend>${e(variable.etiqueta)}${chip}</legend>${ayuda}<div class="opciones-multi">${casillas}</div></fieldset>`;
    }
    case 'number':
      return `<div class="medida"><label class="f" for="${id}">${e(variable.etiqueta)}${chip}</label><input type="number" inputmode="numeric" class="corto" id="${id}" ${base}${attrs({ min: variable.minimo, max: variable.maximo })} value="${e(valor ?? '')}">${ayuda}</div>`;
    default:
      return `<div class="medida"><label class="f" for="${id}">${e(variable.etiqueta)}${chip}</label><input type="text" id="${id}" ${base} maxlength="120" value="${e(valor ?? '')}" aria-describedby="${id}-ayuda det-${e(variable.id)}">${ayuda}${huecoDetector(variable.id, String(valor ?? ''), datos)}</div>`;
  }
}

function paso4(v: Vista, datos: Datos): string {
  const nivel = v.r.nivel;
  const esVisible = (x: Variable) => !x.visible_si || evaluar(x.visible_si, v.r.hechos);

  if (!nivel.medidas_editables) {
    const activas = datos.variables.filter((x) => v.r.activas.includes(x.id) && x.grupo !== 'formato');
    const items = activas.map((x) => {
      const valor = x.tipo_control === 'checkbox' ? '' : `: ${e(textoValor(x, v.r.variables[x.id]))}`;
      return `<li>${icono('check')}<span>${e(x.etiqueta)}${valor}${chipSugerida(x, v)}</span></li>`;
    }).join('');
    const cuerpo = items ? `<ul class="medidas-lectura">${items}</ul>` : `<p class="hint">${e(t('paso4.ninguna'))}</p>`;
    return seccion(4, 'paso-4', t('paso4.basico'), cuerpo, t('paso4.basico_ayuda'));
  }

  const bloques = GRUPOS.map((g) => {
    const lista = datos.variables.filter((x) => x.grupo === g && disponible(x, nivel.id) && esVisible(x));
    if (lista.length === 0) return '';
    const n = lista.filter((x) => estaActiva(x, v.r.variables[x.id])).length;
    return `<div class="bloque-medidas"><h3>${e(t(`grupo.${g}`))} <span class="cnt">${e(t('paso4.contador', { n }))}</span></h3>${lista.map((x) => control(x, v, datos)).join('')}</div>`;
  }).join('');
  return seccion(4, 'paso-4', t('paso4.titulo'), bloques);
}

/* ---------- Paso 5: el documento original ---------- */

function paso5(v: Vista, datos: Datos): string {
  const casillas = datos.privacidad.lista_comprobacion.map((c) => `
    <label class="chk"><input type="checkbox" id="priv-${e(c.id)}" data-k="priv" data-id="${e(c.id)}"${attrs({ checked: v.privacidad[c.id] === true })}><span>${e(c.texto)}</span></label>`).join('');
  return seccion(5, 'paso-5', t('paso5.titulo'), `
    ${camposDelPaso(5, v, datos)}
    <fieldset class="privacidad" id="privacidad"><legend>${e(t('paso5.privacidad'))}</legend>
      <p class="hint">${e(t('paso5.privacidad_ayuda'))}</p>${casillas}</fieldset>`);
}

/* ---------- Paso 6: qué quieres recibir ---------- */

function paso6(v: Vista, datos: Datos): string {
  const nivel = v.r.nivel.id;
  const entregables = datos.salidas.entregables.filter((x) => disponible(x, nivel)).sort((a, b) => a.orden - b.orden).map((x) => {
    const elegido = x.obligatorio || (v.config.salidas[x.id] ?? x.valor_defecto);
    const id = `salida-${x.id}`;
    return `<div><label class="chk"><input type="checkbox" id="${id}" data-k="salida" data-id="${e(x.id)}" aria-describedby="${id}-ayuda"${attrs({ checked: elegido, disabled: x.obligatorio })}>
      <span>${e(x.etiqueta)}${x.obligatorio ? ` <span class="chip">${e(t('paso6.siempre'))}</span>` : ''}</span></label><p class="hint" id="${id}-ayuda">${e(x.ayuda)}</p></div>`;
  }).join('');

  const formatos = datos.salidas.formatos.filter((x) => disponible(x, nivel));
  const formato = formatos.length
    ? `<fieldset><legend>${e(t('paso6.formato'))}</legend><div class="opciones">${formatos.map((x) => `
        <label class="opcion"><input type="radio" name="formato" id="formato-${e(x.id)}" data-k="formato" value="${e(x.id)}"${attrs({ checked: x.id === v.r.formato.id })}><span><span class="nombre">${e(x.etiqueta)}</span></span></label>`).join('')}</div></fieldset>`
    : `<p class="hint">${e(t('paso6.formato_auto'))}</p>`;

  return seccion(6, 'paso-6', t('paso6.titulo'), `<fieldset><legend>${e(t('paso6.entregables'))}</legend>${entregables}</fieldset>${formato}`);
}

export function formulario(v: Vista, datos: Datos): string {
  return paso0(v, datos) + paso1(v, datos) + paso2(v, datos) + paso3(v, datos) + paso4(v, datos) + paso5(v, datos) + paso6(v, datos);
}

/** Pasos de la barra de progreso y si están completos. */
export function progreso(v: Vista, datos: Datos): { id: string; n: number; nombre: string; hecho: boolean }[] {
  const privacidadCompleta = datos.privacidad.lista_comprobacion.every((c) => v.privacidad[c.id] === true);
  return [
    { id: 'paso-1', n: 1, nombre: t('paso1.corto'), hecho: true },
    { id: 'paso-2', n: 2, nombre: t('paso2.corto'), hecho: v.r.curso !== null },
    { id: 'paso-3', n: 3, nombre: t('paso3.corto'), hecho: v.r.perfiles.length > 0 },
    { id: 'paso-4', n: 4, nombre: t('paso4.corto'), hecho: v.r.activas.some((id) => datos.variables.find((x) => x.id === id)?.grupo !== 'formato') },
    { id: 'paso-5', n: 5, nombre: t('paso5.corto'), hecho: privacidadCompleta },
    { id: 'paso-6', n: 6, nombre: t('paso6.corto'), hecho: true },
  ];
}
