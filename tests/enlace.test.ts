// Tests de compartir por enlace y de saneado de configuraciones guardadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componer, resolver } from '../src/engine/index.ts';
import type { Config } from '../src/engine/index.ts';
import { codificar, decodificar, sanear, sinTextosLibres } from '../src/almacenamiento/enlace.ts';
import { cargarDatos, config, comprobarPrompt } from './ayuda.ts';

const datos = cargarDatos();

const TEXTOS = ['Grupo de 22 con Marta', 'árabe', 'dos sesiones', 'Comprender textos', 'dinosaurios', 'Se distrae con el ruido', 'los textos', 'el 4 y el 5', '2 páginas', 'Proyecto de centro', 'Ejercicio 1 pegado'];

const completa: Partial<Config> = {
  nivel: 'experto', adaptacion: 'acis', tipo_material: 'prueba_escrita', curso: 'pri_5',
  perfiles: ['dislexia', 'incorporacion_tardia', 'personalizado'], perfil_personalizado: TEXTOS[5],
  variables: { glosario: false, max_items: 6, mantener_criterios: false, tipografia: 'macrotipo', formatos_respuesta: ['oral', 'unir'], conectar_intereses: TEXTOS[4] },
  campos: {
    nivel_referencia: 'pri_3', area: 'otra', area_texto: TEXTOS[9], lengua_documento: 'valenciano', tipo_archivo: 'foto', imagenes_importantes: true,
    contexto_grupo: TEXTOS[0], lengua_materna: TEXTOS[1], duracion: TEXTOS[2], criterios: TEXTOS[3],
    partes_no_modificables: TEXTOS[6], ejercicios_omitibles: TEXTOS[7], num_paginas: TEXTOS[8], texto_pegado: TEXTOS[10],
  },
  salidas: { multinivel: true, guia_docente: true, resumen_cambios: false }, formato: 'pdf',
};

test('el enlace nunca incluye textos libres', () => {
  const codigo = codificar(config(datos, completa), datos);
  const json = Buffer.from(codigo.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  for (const texto of TEXTOS) assert.ok(!json.includes(texto), `el enlace contiene «${texto}»`);
  assert.ok(!json.includes('personalizado":"S'));
  assert.match(codigo, /^c=[A-Za-z0-9_-]+$/);
});

test('el enlace reproduce la configuración (sin los textos libres)', () => {
  const original = config(datos, completa);
  const recuperada = decodificar(`#${codificar(original, datos)}`, datos);
  assert.ok(recuperada);
  assert.deepEqual(recuperada, sinTextosLibres(original, datos));
  // El prompt es el mismo que el de la configuración original sin sus textos libres.
  assert.equal(componer(recuperada, datos), componer(sinTextosLibres(original, datos), datos));
  const r = resolver(recuperada, datos);
  assert.equal(r.adaptacion.id, 'acis');
  assert.equal(r.variables.max_items, 6);
  assert.deepEqual(r.variables.formatos_respuesta, ['oral', 'unir']);
  assert.equal(r.campos.nivel_referencia, 'pri_3');
  assert.equal(r.formato.id, 'pdf');
  assert.ok(r.salidas.includes('multinivel'));
  comprobarPrompt(componer(recuperada, datos));
});

test('un enlace manipulado no rompe la app ni cuela textos', () => {
  const malicioso = {
    nivel: 'superadmin', tipo_material: 'no_existe', adaptacion: 42, curso: 'bachillerato', perfiles: ['tdah', 'falso', 7, 'tdah'],
    perfil_personalizado: 'texto colado', variables: { glosario: true, inventada: true, max_items: { a: 1 }, conectar_intereses: 'colado' },
    campos: { contexto_grupo: 'colado', tipo_archivo: 'foto', otro: 'x', texto_pegado: 'colado' }, salidas: { rubrica: 'sí', guia_docente: true }, formato: 'exe',
  };
  const codigo = 'c=' + Buffer.from(JSON.stringify(malicioso)).toString('base64url');
  const c = decodificar(codigo, datos);
  assert.ok(c);
  assert.equal(c.nivel, 'basico');
  assert.equal(c.curso, null);
  assert.deepEqual(c.perfiles, ['tdah']);
  assert.deepEqual(c.variables, { glosario: true });
  assert.deepEqual(c.campos, { tipo_archivo: 'foto' });
  assert.deepEqual(c.salidas, { guia_docente: true });
  assert.equal(c.formato, null);
  assert.equal(c.perfil_personalizado, '');
  assert.doesNotMatch(componer(c, datos), /colado/);
  comprobarPrompt(componer(c, datos));
});

test('fragmentos que no son una configuración se ignoran', () => {
  for (const f of ['', '#paso-3', '#c=', '#c=%%%', '#c=bm8ganNvbg', 'c=bnVsbA']) {
    const c = decodificar(f, datos);
    if (c !== null) comprobarPrompt(componer(c, datos)); // «null» válido en JSON da la configuración inicial
  }
  assert.equal(decodificar('#paso-3', datos), null);
  assert.equal(decodificar('#c=%%%', datos), null);
});

test('una configuración guardada conserva los textos solo si se pide', () => {
  const original = config(datos, completa);
  const sin = sanear(JSON.parse(JSON.stringify(original)), datos, false);
  const con = sanear(JSON.parse(JSON.stringify(original)), datos, true);
  assert.equal(sin.campos.contexto_grupo, undefined);
  assert.equal(sin.perfil_personalizado, '');
  assert.deepEqual(con, original);
});
