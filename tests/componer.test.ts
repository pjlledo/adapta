// Tests del motor de composición (apartado 13 de la SPEC).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componer, resolver, rellenarPlantilla } from '../src/engine/index.ts';
import type { Config } from '../src/engine/index.ts';
import { cargarDatos, config, comprobarPrompt } from './ayuda.ts';

const datos = cargarDatos();

// Combinaciones exigidas: los tres niveles, perfil único, cuatro perfiles, ACIS, Infantil,
// altas capacidades más dislexia, foto frente a PDF y texto pegado en Experto.
const combinaciones: Record<string, Partial<Config>> = {
  'Básico sin perfiles (valores iniciales)': {},
  'Básico, grupo DUA, ficha, sin curso': { tipo_material: 'ficha' },
  'Básico, perfil único (dislexia), examen de 3.º': { adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_3', perfiles: ['dislexia'] },
  'Básico, altas capacidades más dislexia': { adaptacion: 'alumno', curso: 'pri_5', perfiles: ['altas_capacidades', 'dislexia'] },
  'Básico, Infantil, consignas para TEA': { adaptacion: 'alumno', tipo_material: 'consignas_aula', curso: 'inf_4', perfiles: ['tea'] },
  'Básico, foto o escaneo': { curso: 'pri_2', perfiles: ['tdah'], campos: { tipo_archivo: 'foto' } },
  'Básico, PDF digital': { curso: 'pri_2', perfiles: ['tdah'], campos: { tipo_archivo: 'digital' } },
  'Avanzado, grupo con cuatro perfiles': {
    nivel: 'avanzado', tipo_material: 'situacion_aprendizaje', curso: 'pri_4',
    perfiles: ['dislexia', 'tdah', 'incorporacion_tardia', 'altas_capacidades'],
    campos: { area: 'pri_medio', contexto_grupo: 'Grupo de 22, trabajan por rincones.', lengua_materna: 'árabe', lengua_documento: 'valenciano' },
  },
  'Avanzado, ACIS con nivel de referencia': {
    nivel: 'avanzado', adaptacion: 'acis', tipo_material: 'prueba_escrita', curso: 'pri_6', perfiles: ['discapacidad_intelectual'],
    variables: { mantener_criterios: false },
    campos: { nivel_referencia: 'pri_2', area: 'pri_matematicas', criterios: 'Resolver problemas de suma y resta con apoyo visual.' },
    salidas: { tabla_cambios: true, guia_docente: true, solucionario: true }, formato: 'pdf',
  },
  'Avanzado, medidas desmarcadas a mano y formato en la respuesta': {
    nivel: 'avanzado', adaptacion: 'alumno', curso: 'pri_1', perfiles: ['discalculia'],
    variables: { apoyos_visuales: false, ejemplo_resuelto: false, glosario: true },
    campos: { area: 'otra', area_texto: 'Proyecto de centro', partes_no_modificables: 'los enunciados de los problemas', ejercicios_omitibles: 'el 4 y el 5', num_paginas: '2 páginas', imagenes_importantes: true },
    salidas: { resumen_cambios: false, rubrica: true }, formato: 'en_respuesta',
  },
  'Experto, todo activado': {
    nivel: 'experto', adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_5',
    perfiles: ['discapacidad_visual', 'ansiedad', 'personalizado'], perfil_personalizado: 'Se fatiga con facilidad por la tarde.',
    variables: {
      dividir_bloques: 3, conectar_intereses: 'dinosaurios y fútbol', materiales_apoyo: ['calculadora', 'diccionario'],
      tiempo_adicional: '25', max_items: 8, extension_maxima: 4, maq_fuente: 'opendyslexic', maq_espacio_respuesta: 'pauta',
      version_oral: true, cooperativo_roles: true, guion_lectura_voz_alta: true,
    },
    campos: { area: 'pri_castellano', idioma_respuesta: 'valenciano', duracion: 'una sesión de 45 minutos' },
    salidas: { multinivel: true, guia_docente: true },
  },
  'Experto, texto pegado en lugar de adjunto': {
    nivel: 'experto', curso: 'pri_3', perfiles: ['tdl'],
    campos: { texto_pegado: 'Ejercicio 1. Lee el texto y responde.\nEjercicio 2. Escribe tres frases.' },
  },
  'Experto, instrumento de evaluación en 1.er ciclo': { nivel: 'experto', adaptacion: 'alumno', tipo_material: 'instrumento_evaluacion', curso: 'pri_1', perfiles: ['conducta', 'desventaja_socioeducativa'] },
};

for (const [nombre, cambios] of Object.entries(combinaciones)) {
  test(`prompt coherente: ${nombre}`, () => comprobarPrompt(componer(config(datos, cambios), datos)));
}

test('todos los presets, en los tres niveles, dan un prompt coherente', () => {
  for (const preset of datos.presets) {
    for (const nivel of datos.niveles) {
      comprobarPrompt(componer(config(datos, { ...preset.config, variables: {}, salidas: {}, nivel: nivel.id }), datos));
    }
  }
});

test('cada perfil por separado, y todos a la vez, dan un prompt coherente', () => {
  const ids = datos.perfiles.perfiles.map((p) => p.id);
  for (const id of ids) {
    comprobarPrompt(componer(config(datos, { nivel: 'experto', adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_4', perfiles: [id], perfil_personalizado: 'Barreras de ejemplo.' }), datos));
  }
  comprobarPrompt(componer(config(datos, { nivel: 'experto', tipo_material: 'prueba_escrita', curso: 'pri_4', perfiles: ids, perfil_personalizado: 'Barreras de ejemplo.' }), datos));
});

test('todas las medidas activadas a la vez dan un prompt coherente', () => {
  const variables: Config['variables'] = {};
  for (const v of datos.variables) {
    if (v.tipo_control === 'checkbox') variables[v.id] = true;
    else if (v.tipo_control === 'select') variables[v.id] = v.opciones![v.opciones!.length - 1].valor;
    else if (v.tipo_control === 'multiselect') variables[v.id] = v.opciones!.map((o) => o.valor);
    else if (v.tipo_control === 'number') variables[v.id] = v.minimo ?? 2;
    else variables[v.id] = 'los animales';
  }
  const prompt = componer(config(datos, { nivel: 'experto', adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_6', variables }), datos);
  comprobarPrompt(prompt);
  // De dos medidas incompatibles solo queda una.
  assert.ok(!(prompt.includes('equipo cooperativo') && prompt.includes('versión oral equivalente')));
});

test('el nivel Básico produce un prompt completo con decisiones automáticas', () => {
  const prompt = componer(config(datos, { adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_3', perfiles: ['dislexia'] }), datos);
  for (const seccion of ['LO QUE NO PUEDE CAMBIAR', 'DIVERSIDAD QUE DEBE CONTEMPLAR LA ADAPTACIÓN', 'MEDIDAS QUE DEBES APLICAR', 'LO QUE DEBES EVITAR', 'FORMATO DE ENTREGA', 'QUÉ DEBES ENTREGAR, EN ESTE ORDEN']) {
    assert.ok(prompt.includes(`\n${seccion}\n`), `falta la sección ${seccion}`);
  }
  assert.match(prompt, /una prueba escrita, 3\.º de Educación Primaria/);
  assert.match(prompt, /medida de nivel III/);
  assert.match(prompt, /palabras clave/);                 // medida derivada del perfil
  assert.match(prompt, /cuerpo de letra ampliado/);       // medida de nivel Experto aplicada por el perfil
  assert.match(prompt, /archivo de Word/);                // formato automático
  assert.match(prompt, /Si no puedes generar archivos descargables/);
  assert.match(prompt, /No modifiques los criterios de evaluación/);
  assert.match(prompt, /no los reproduzcas y avísame/);   // instrucción de privacidad
  assert.doesNotMatch(prompt, /\nCONTEXTO\n|TEXTO DEL DOCUMENTO ORIGINAL|INFORMACIÓN SOBRE EL DOCUMENTO/);
});

test('las secciones vacías desaparecen y las medidas se ordenan por principio DUA', () => {
  const sinNada = componer(config(datos, { adaptacion: 'alumno', tipo_material: 'instrumento_evaluacion' }), datos);
  assert.doesNotMatch(sinNada, /DIVERSIDAD QUE DEBE CONTEMPLAR|MEDIDAS QUE DEBES APLICAR/);

  const prompt = componer(config(datos, { adaptacion: 'alumno', tipo_material: 'prueba_escrita', curso: 'pri_3', perfiles: ['tdah', 'altas_capacidades'] }), datos);
  const orden = ['Representación:', 'Acción y expresión:', 'Implicación:', 'Evaluación:'].map((s) => prompt.indexOf(`\n${s}\n`));
  assert.ok(orden.every((i) => i > 0), 'falta algún principio');
  assert.deepEqual([...orden].sort((a, b) => a - b), orden);
});

test('las estrategias y las medidas de varios perfiles se fusionan sin duplicados', () => {
  const r = resolver(config(datos, { nivel: 'avanzado', adaptacion: 'alumno', curso: 'pri_3', perfiles: ['dislexia', 'discapacidad_visual', 'discapacidad_motora'] }), datos);
  assert.equal(r.variables.tipografia, 'macrotipo');                                                     // gana el tamaño mayor
  assert.deepEqual(r.variables.formatos_respuesta, ['oral', 'seleccion_multiple', 'unir', 'digital']);   // unión en el orden del catálogo
  assert.deepEqual(r.sugerencias.reducir_escritura.origenes.length, 2);                                  // sugerida por dos perfiles
  const prompt = componer(config(datos, { adaptacion: 'alumno', curso: 'pri_3', perfiles: ['dislexia', 'tea'] }), datos);
  assert.equal(prompt.split('una sola consigna por frase').length - 1, 1);
});

test('foto o escaneo añade la instrucción de transcribir; el PDF digital no', () => {
  const foto = componer(config(datos, { campos: { tipo_archivo: 'foto' } }), datos);
  const pdf = componer(config(datos, { campos: { tipo_archivo: 'digital' } }), datos);
  assert.match(foto, /1\. Lee el documento original completo\. Es una foto o un escaneo/);
  assert.match(pdf, /1\. Lee el documento original completo\.\n/);
});

test('el texto pegado solo se usa en Experto y cambia la referencia al documento', () => {
  const campos = { texto_pegado: 'Ejercicio 1. Suma 2 + 2.' };
  const experto = componer(config(datos, { nivel: 'experto', campos }), datos);
  assert.match(experto, /Al final de este mensaje te pego el texto/);
  assert.match(experto, /TEXTO DEL DOCUMENTO ORIGINAL\nEjercicio 1\. Suma 2 \+ 2\./);
  const avanzado = componer(config(datos, { nivel: 'avanzado', campos }), datos);
  assert.match(avanzado, /Te adjunto un documento original/);
  assert.doesNotMatch(avanzado, /Ejercicio 1/);
});

test('ACIS: usa el nivel de referencia y permite ajustar criterios; fuera de ACIS no', () => {
  const base: Partial<Config> = { nivel: 'avanzado', adaptacion: 'acis', curso: 'pri_6', variables: { mantener_criterios: false }, campos: { nivel_referencia: 'pri_2' } };
  const acis = componer(config(datos, base), datos);
  assert.match(acis, /nivel de referencia curricular es 2\.º de Educación Primaria/);
  assert.match(acis, /Ajusta los criterios de evaluación/);
  assert.doesNotMatch(acis, /No modifiques los criterios|mantenlos en el documento adaptado/);
  const alumno = componer(config(datos, { ...base, adaptacion: 'alumno' }), datos);
  assert.match(alumno, /No modifiques los criterios de evaluación/);
});

test('el texto del docente se inserta tal cual, aunque parezca un marcador', () => {
  const prompt = componer(config(datos, { nivel: 'avanzado', campos: { contexto_grupo: 'Usan llaves {{valor}} en clase' } }), datos);
  assert.match(prompt, /Contexto del grupo: Usan llaves \{\{valor\}\} en clase/);
});

test('rellenarPlantilla omite líneas, subtítulos y secciones sin contenido', () => {
  const plantilla = 'UNO\n{{a}}\n\nDOS\nGrupo A:\n{{b}}\nGrupo B:\n{{c}}\n\nTRES\nTexto {{d}} fijo.\n';
  assert.equal(rellenarPlantilla(plantilla, { c: '- x', d: '' }), 'DOS\nGrupo B:\n- x\n\nTRES\nTexto fijo.\n');
});
