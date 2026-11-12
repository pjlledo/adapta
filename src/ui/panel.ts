// Panel del prompt: avisos de coherencia, vista previa, botones e instrucciones de uso.
import type { Aviso, Datos } from '../engine/index.ts';
import { encabezados } from '../engine/index.ts';
import { t } from '../i18n/index.ts';
import { attrs, e, icono } from './html.ts';

export interface VistaPanel {
  prompt: string;
  avisos: Aviso[];
  /** Texto editado a mano (Experto), o null si se muestra el prompt generado. */
  manual: string | null;
  puedeEditar: boolean;
  detalleDesplegado: boolean;
  /** Motivo por el que no se puede copiar, o '' si se puede. */
  motivoBloqueo: string;
  faltaPrivacidad: boolean;
}

const ICONO_AVISO: Record<string, string> = { critico: 'stop', aviso: 'warn', info: 'info' };
const CLASE_AVISO: Record<string, string> = { critico: 'critico', aviso: 'atencion', info: 'info' };

export function avisosHtml(v: VistaPanel): string {
  if (v.avisos.length === 0) return '';
  const items = v.avisos.map((a) => {
    const norma = a.referencia_normativa || a.detalle_normativo
      ? `<details class="norma" id="norma-${e(a.id)}"${attrs({ open: v.detalleDesplegado })}><summary>${e(t('panel.norma'))}</summary>
          ${a.detalle_normativo ? `<p>${e(a.detalle_normativo)}</p>` : ''}${a.referencia_normativa ? `<p>${e(a.referencia_normativa)}</p>` : ''}</details>`
      : '';
    const accion = a.accion
      ? `<div class="fila"><button type="button" class="btn sm" id="accion-${e(a.id)}" data-k="accion" data-tipo="${e(a.accion.tipo)}" data-valor="${e(a.accion.valor)}">${e(a.accion.etiqueta)}</button></div>`
      : '';
    return `<div class="aviso ${CLASE_AVISO[a.severidad]}"${attrs({ role: a.severidad === 'critico' ? 'alert' : null })}>
      ${icono(ICONO_AVISO[a.severidad])}
      <div class="cuerpo"><span class="tipo">${e(t(`aviso.${a.severidad}`))}</span><p>${e(a.mensaje)}</p>${accion}${norma}</div></div>`;
  }).join('');
  return `<section class="avisos stack" aria-label="${e(t('panel.avisos'))}">${items}</section>`;
}

/** Prompt con las cabeceras de sección resaltadas. */
function resaltado(prompt: string): string {
  const cabeceras = new Set(encabezados(prompt));
  return prompt.split('\n').map((l) => (cabeceras.has(l) ? `<span class="sec">${e(l)}</span>` : e(l))).join('\n');
}

export function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

export function panel(v: VistaPanel, datos: Datos): string {
  const texto = v.manual ?? v.prompt;
  const bloqueado = v.motivoBloqueo !== '';
  const cuerpo = v.manual !== null
    ? `<div class="aviso info editando">${icono('info')}<div class="cuerpo"><p>${e(t('panel.editando'))}</p>
         <div class="fila"><button type="button" class="btn sm" id="volver-generado" data-k="volver">${e(t('panel.volver'))}</button></div></div></div>
       <label class="sr" for="prompt-manual">${e(t('panel.editor'))}</label>
       <textarea class="prompt-txt prompt-manual" id="prompt-manual" data-k="manual" spellcheck="false">${e(v.manual)}</textarea>`
    : `<pre class="prompt-txt" id="prompt-vista" tabindex="0" aria-label="${e(t('panel.titulo'))}">${resaltado(v.prompt)}</pre>`;

  const motivo = bloqueado
    ? `<p class="hint fuerte" id="motivo-bloqueo" role="status">${e(v.motivoBloqueo)}${v.faltaPrivacidad ? ` <a href="#privacidad" class="link">${e(t('panel.ir_privacidad'))}</a>` : ''}</p>`
    : '';
  const editar = v.puedeEditar && v.manual === null
    ? `<button type="button" class="btn ghost sm" id="editar-manual" data-k="editar">${icono('edit')}${e(t('panel.editar'))}</button>`
    : '';
  const pasosUso = datos.privacidad.instrucciones_uso.map((p, i) => `<li><span class="ico">${icono(['chat', 'clip', 'send'][i] ?? 'check')}</span>${i + 1}. ${e(p.texto)}</li>`).join('');
  const antes = datos.privacidad.antes_de_usar.map((p) => `<li>${e(p.texto)}</li>`).join('');

  return `${avisosHtml(v)}
  <section class="card prompt" aria-labelledby="prompt-t">
    <header><h2 id="prompt-t">${e(t('panel.titulo'))}</h2><span class="cnt" id="prompt-palabras">${e(t('panel.palabras', { n: contarPalabras(texto) }))}</span></header>
    ${cuerpo}
    <div class="prompt-pie">
      <button type="button" class="btn primary lg" id="copiar" data-k="copiar"${attrs({ 'aria-disabled': bloqueado ? 'true' : null, 'aria-describedby': bloqueado ? 'motivo-bloqueo' : null })}>${icono('copy')}${e(t('panel.copiar'))}</button>
      ${motivo}
      <div class="fila acciones-prompt">
        <button type="button" class="btn ghost sm" id="descargar" data-k="descargar"${attrs({ 'aria-disabled': bloqueado ? 'true' : null })}>${icono('down')}${e(t('panel.descargar'))}</button>
        <button type="button" class="btn ghost sm" id="reiniciar" data-k="reiniciar">${icono('reset')}${e(t('panel.reiniciar'))}</button>
        ${editar}
      </div>
      <ol class="uso">${pasosUso}</ol>
      <details class="antes" id="antes-de-usar"><summary>${e(t('panel.antes'))}</summary><ul>${antes}</ul></details>
    </div>
  </section>`;
}
