// Tests de niveles, reglas de coherencia y detector de datos personales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisos, cambiarNivel, componer, copiaBloqueada, detectarDatosPersonales, resolver } from '../src/engine/index.ts';
import type { Config, NivelId } from '../src/engine/index.ts';
import { cargarDatos, config, comprobarPrompt } from './ayuda.ts';

const datos = cargarDatos();
const ids = (c: Config) => avisos(c, datos).map((a) => a.id);

const experto: Partial<Config> = {
  nivel: 'experto', adaptacion: 'acis', tipo_material: 'prueba_escrita', curso: 'pri_5',
  perfiles: ['dislexia', 'personalizado'], perfil_personalizado: 'Se distrae con el ruido.',
  variables: { glosario: false, max_items: 6, mantener_criterios: false, maq_fuente: 'escolar' },
  campos: { nivel_referencia: 'pri_3', area: 'pri_castellano', duracion: 'dos sesiones', criterios: 'Comprender textos breves.' },
  salidas: { multinivel: true, guia_docente: true }, formato: 'pdf',
};

/* ---------- Niveles ---------- */

test('subir de nivel conserva todos los valores y no restablece nada', () => {
  const basico = config(datos, { adaptacion: 'alumno', curso: 'pri_3', perfiles: ['dislexia', 'tdah'] });
  const antes = resolver(basico, datos);
  for (const nivel of ['avanzado', 'experto'] as NivelId[]) {
    const cambio = cambiarNivel(basico, nivel, datos);
    const despues = resolver(cambio.config, datos);
    assert.equal(cambio.restablecidas, 0);
    assert.deepEqual(despues.variables, antes.variables);
    assert.deepEqual(despues.salidas, antes.salidas);
    assert.equal(componer(cambio.config, datos), componer(basico, datos));
  }
});

test('bajar de nivel restablece las opciones que se ocultan, las cuenta y se puede deshacer', () => {
  const inicial = config(datos, experto);
  const aAvanzado = cambiarNivel(inicial, 'avanzado', datos);
  // Se pierden: max_items, maq_fuente, duración, multinivel y el perfil personalizado.
  assert.equal(aAvanzado.restablecidas, 5);
  const r = resolver(aAvanzado.config, datos);
  assert.equal(r.variables.max_items, null);
  assert.equal(r.variables.glosario, false);            // la decisión de nivel Avanzado se conserva
  assert.equal(r.adaptacion.id, 'acis');
  assert.deepEqual(r.perfiles.map((p) => p.id), ['dislexia']);

  const aBasico = cambiarNivel(aAvanzado.config, 'basico', datos);
  const b = resolver(aBasico.config, datos);
  assert.ok(aBasico.restablecidas > 0);
  assert.equal(b.adaptacion.id, 'alumno');              // ACIS no existe en Básico: pasa a adecuación personalizada
  assert.equal(b.variables.mantener_criterios, true);
  assert.equal(b.variables.glosario, true);             // vuelve a aplicarse lo derivado del perfil
  assert.equal(b.formato.id, 'docx');
  assert.deepEqual(aBasico.config.variables, {});

  assert.deepEqual(aAvanzado.anterior, inicial);        // deshacer = recuperar la configuración anterior
  assert.equal(componer(aAvanzado.anterior, datos), componer(inicial, datos));
});

test('cualquier recorrido entre niveles deja un prompt coherente', () => {
  const recorridos: NivelId[][] = [
    ['avanzado', 'basico', 'experto'], ['basico', 'experto', 'avanzado', 'basico'], ['avanzado', 'experto', 'basico', 'avanzado'],
  ];
  for (const recorrido of recorridos) {
    let actual = config(datos, experto);
    for (const nivel of recorrido) {
      actual = cambiarNivel(actual, nivel, datos).config;
      comprobarPrompt(componer(actual, datos));
      assert.equal(actual.nivel, nivel);
    }
  }
});

test('un valor guardado de un nivel superior no se cuela en un nivel inferior', () => {
  // Configuración manipulada (p. ej. un enlace compartido abierto en Básico).
  const c = config(datos, { nivel: 'basico', adaptacion: 'acis', variables: { max_items: 3, mantener_criterios: false }, salidas: { multinivel: true }, formato: 'pdf', campos: { texto_pegado: 'texto' } });
  const r = resolver(c, datos);
  assert.equal(r.adaptacion.id, 'alumno');
  assert.equal(r.variables.max_items, null);
  assert.equal(r.variables.mantener_criterios, true);
  assert.ok(!r.salidas.includes('multinivel'));
  assert.equal(r.formato.id, 'docx');
  assert.doesNotMatch(componer(c, datos), /TEXTO DEL DOCUMENTO ORIGINAL/);
});

test('en Básico las medidas no son editables: mandan los perfiles', () => {
  const c = config(datos, { adaptacion: 'alumno', curso: 'pri_3', perfiles: ['tdah'], variables: { checklist_autorregulacion: false } });
  assert.equal(resolver(c, datos).variables.checklist_autorregulacion, true);
});

test('las medidas de evaluación solo se aplican a pruebas e instrumentos de evaluación', () => {
  const base: Partial<Config> = { adaptacion: 'alumno', curso: 'pri_4', perfiles: ['ansiedad'] };
  assert.equal(resolver(config(datos, { ...base, tipo_material: 'prueba_escrita' }), datos).variables.puntuacion_visible, true);
  assert.equal(resolver(config(datos, { ...base, tipo_material: 'ficha' }), datos).variables.puntuacion_visible, false);
});

/* ---------- Reglas de coherencia ---------- */

test('regla 1: Infantil con prueba escrita es crítico y propone cambiar de tipo', () => {
  const lista = avisos(config(datos, { curso: 'inf_5', tipo_material: 'prueba_escrita' }), datos);
  const aviso = lista.find((a) => a.id === 'infantil_prueba_escrita');
  assert.equal(aviso?.severidad, 'critico');
  assert.equal(aviso?.accion?.valor, 'instrumento_evaluacion');
});

test('regla 2: 1.er ciclo con prueba escrita avisa (desde Avanzado) hasta activar instrumentos alternativos', () => {
  const base: Partial<Config> = { curso: 'pri_2', tipo_material: 'prueba_escrita' };
  assert.ok(!ids(config(datos, base)).includes('primer_ciclo_prueba_escrita'));            // en Básico solo se ven los críticos
  assert.ok(ids(config(datos, { ...base, nivel: 'avanzado' })).includes('primer_ciclo_prueba_escrita'));
  assert.ok(!ids(config(datos, { ...base, nivel: 'avanzado', variables: { instrumentos_alternativos: true } })).includes('primer_ciclo_prueba_escrita'));
  assert.ok(!ids(config(datos, { ...base, nivel: 'avanzado', curso: 'pri_3' })).includes('primer_ciclo_prueba_escrita'));
});

test('regla 3: ACIS sin nivel de referencia bloquea Copiar', () => {
  const sin = config(datos, { nivel: 'avanzado', adaptacion: 'acis' });
  assert.ok(ids(sin).includes('acis_sin_nivel_referencia'));
  assert.equal(copiaBloqueada(sin, datos), true);
  const con = config(datos, { nivel: 'avanzado', adaptacion: 'acis', campos: { nivel_referencia: 'pri_1' } });
  assert.equal(copiaBloqueada(con, datos), false);
});

test('regla 4: en nivel II y III no se pueden desactivar los criterios', () => {
  for (const adaptacion of ['grupo', 'alumno']) {
    const c = config(datos, { nivel: 'experto', adaptacion, variables: { mantener_criterios: false } });
    assert.equal(resolver(c, datos).variables.mantener_criterios, true);
    assert.equal(copiaBloqueada(c, datos), false);
  }
});

test('regla 5: altas capacidades con simplificación avisa de posible doble excepcionalidad', () => {
  const c = config(datos, { nivel: 'avanzado', adaptacion: 'alumno', perfiles: ['altas_capacidades', 'dislexia'] });
  assert.ok(ids(c).includes('altas_capacidades_simplificacion'));
  assert.ok(!ids(config(datos, { nivel: 'avanzado', adaptacion: 'alumno', perfiles: ['altas_capacidades'] })).includes('altas_capacidades_simplificacion'));
});

test('regla 6: más de 12 medidas activas', () => {
  const muchas = config(datos, { nivel: 'avanzado', adaptacion: 'alumno', tipo_material: 'prueba_escrita', perfiles: ['dislexia', 'tdah', 'tea', 'tdl', 'altas_capacidades', 'ansiedad'] });
  assert.ok((resolver(muchas, datos).hechos.n_medidas as number) > 12);
  assert.ok(ids(muchas).includes('demasiadas_medidas'));
  assert.ok(!ids(config(datos, { nivel: 'avanzado', adaptacion: 'alumno', perfiles: ['tdah'] })).includes('demasiadas_medidas'));
});

test('regla 7: posibles datos personales en los textos libres', () => {
  const c = config(datos, { nivel: 'avanzado', campos: { contexto_grupo: 'Avisar a maria.garcia@ejemplo.es' } });
  assert.ok(ids(c).includes('datos_personales'));
  assert.ok(!ids(config(datos, { nivel: 'avanzado', campos: { contexto_grupo: 'Grupo de 22 alumnos.' } })).includes('datos_personales'));
});

test('regla 8: grupo con cuatro perfiles sugiere multinivel, o subir a Experto si no está disponible', () => {
  const perfiles = ['dislexia', 'tdah', 'tea', 'altas_capacidades'];
  const enAvanzado = avisos(config(datos, { nivel: 'avanzado', perfiles }), datos).find((a) => a.id === 'grupo_muchos_perfiles');
  assert.equal(enAvanzado?.accion, null);
  assert.match(enAvanzado?.mensaje ?? '', /nivel Experto/);
  const enExperto = avisos(config(datos, { nivel: 'experto', perfiles }), datos).find((a) => a.id === 'grupo_muchos_perfiles');
  assert.equal(enExperto?.accion?.valor, 'multinivel');
  assert.ok(!ids(config(datos, { nivel: 'experto', perfiles, salidas: { multinivel: true } })).includes('grupo_muchos_perfiles'));
});

test('regla 9: foto o escaneo recuerda cómo hacer la foto', () => {
  assert.ok(ids(config(datos, { nivel: 'avanzado', campos: { tipo_archivo: 'foto' } })).includes('foto_escaneo'));
});

test('los avisos salen ordenados de más a menos graves', () => {
  const lista = avisos(config(datos, { nivel: 'experto', adaptacion: 'acis', curso: 'pri_1', tipo_material: 'prueba_escrita', campos: { tipo_archivo: 'foto' } }), datos);
  const orden = lista.map((a) => ['critico', 'aviso', 'info'].indexOf(a.severidad));
  assert.deepEqual([...orden].sort(), orden);
  assert.ok(lista.length >= 3);
});

/* ---------- Detector de datos personales ---------- */

test('el detector reconoce DNI, NIE, NIA, correo, teléfono y fecha', () => {
  const tipos = (texto: string) => detectarDatosPersonales(texto, datos.privacidad.detector).map((p) => p.id);
  assert.deepEqual(tipos('Su DNI es 12345678Z'), ['dni_nie']);
  assert.deepEqual(tipos('NIE X1234567L'), ['dni_nie']);
  assert.deepEqual(tipos('NIA: 10203040'), ['nia']);
  assert.deepEqual(tipos('escribe a tutor@centro.es'), ['correo']);
  assert.deepEqual(tipos('llamar al 612 34 56 78'), ['telefono']);
  assert.deepEqual(tipos('nació el 03/05/2016'), ['fecha_nacimiento']);
  assert.deepEqual(tipos('Grupo de 22 alumnos de 3.º, sesión de 45 minutos, 2 páginas y 8 ejercicios.'), []);
  assert.deepEqual(tipos(''), []);
});
