// Bloque «Guardar y compartir»: configuraciones guardadas en este equipo (desde Avanzado)
// y enlace para compartir (Experto).
import type { Nivel } from '../engine/index.ts';
import type { Guardada } from '../almacenamiento/local.ts';
import { t } from '../i18n/index.ts';
import { attrs, e, icono } from './html.ts';

export interface VistaGuardar { nivel: Nivel; guardadas: Guardada[]; nombre: string; conTextos: boolean }

export function guardarHtml(v: VistaGuardar): string {
  if (!v.nivel.guardar_configuraciones) return '';
  const lista = v.guardadas.length
    ? `<ul class="guardadas">${v.guardadas.map((g, i) => `
        <li><span class="nombre">${e(g.nombre)}${g.conTextos ? ` <span class="chip">${e(t('guardar.con_textos_chip'))}</span>` : ''}</span>
          <button type="button" class="btn sm" id="cargar-${i}" data-k="cargar" data-id="${i}" aria-label="${e(t('guardar.cargar_de', { nombre: g.nombre }))}">${e(t('guardar.cargar'))}</button>
          <button type="button" class="btn ghost sm" id="borrar-${i}" data-k="borrar" data-id="${i}" aria-label="${e(t('guardar.borrar_de', { nombre: g.nombre }))}">${e(t('guardar.borrar'))}</button></li>`).join('')}</ul>`
    : `<p class="hint">${e(t('guardar.vacio'))}</p>`;

  const compartir = v.nivel.compartir_enlace
    ? `<div class="compartir"><h3>${e(t('compartir.titulo'))}</h3>
        <p class="hint">${e(t('compartir.ayuda'))}</p>
        <button type="button" class="btn" id="compartir" data-k="compartir">${icono('link')}${e(t('compartir.boton'))}</button></div>`
    : '';

  return `<section class="card paso-card guardar" id="guardar" aria-labelledby="guardar-t">
    <h2 id="guardar-t">${e(v.nivel.compartir_enlace ? t('guardar.titulo_compartir') : t('guardar.titulo'))}</h2>
    <p class="lead">${e(t('guardar.ayuda'))}</p>
    <div class="stack">
      <div>
        <label class="f" for="guardar-nombre">${e(t('guardar.nombre'))}</label>
        <div class="fila-guardar">
          <input type="text" id="guardar-nombre" data-k="guardar-nombre" maxlength="60" value="${e(v.nombre)}" placeholder="${e(t('guardar.ejemplo'))}">
          <button type="button" class="btn primary" id="guardar-boton" data-k="guardar">${e(t('guardar.boton'))}</button>
        </div>
        <label class="chk"><input type="checkbox" id="guardar-textos" data-k="guardar-textos"${attrs({ checked: v.conTextos })} aria-describedby="guardar-textos-ayuda"><span>${e(t('guardar.con_textos'))}</span></label>
        <p class="hint" id="guardar-textos-ayuda">${e(t('guardar.con_textos_ayuda'))}</p>
      </div>
      <div><h3>${e(t('guardar.lista'))}</h3>${lista}</div>
      ${compartir}
    </div>
  </section>`;
}
