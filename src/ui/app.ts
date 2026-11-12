// Estado de la app, pintado y eventos.
import type { Config, Datos, NivelId, Valor } from '../engine/index.ts';
import { avisos, cambiarNivel, componer, configInicial, copiaBloqueada, resolver } from '../engine/index.ts';
import { t } from '../i18n/index.ts';
import { MAX_GUARDADAS, escribirGuardadas, guardarNivel, guardarTema, leerGuardadas, leerNivel, leerTema } from '../almacenamiento/local.ts';
import type { Tema } from '../almacenamiento/local.ts';
import { codificar, decodificar, sanear, sinTextosLibres } from '../almacenamiento/enlace.ts';
import { guardarHtml } from './guardar.ts';
import { avisoDetector, formulario, progreso } from './formulario.ts';
import type { Vista } from './formulario.ts';
import { contarPalabras, panel } from './panel.ts';
import { attrs, e, icono } from './html.ts';

interface Estado { config: Config; privacidad: Record<string, boolean>; manual: string | null }

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function iniciar(datos: Datos): void {
  const $form = el('formulario');
  const $panel = el('panel');
  const $pasos = el('pasos');
  const $niveles = el('niveles');
  const $nivelDesc = el('niveles-desc');
  const $toast = el('toast');
  const $toastTxt = el('toast-txt');
  const $toastBtn = el<HTMLButtonElement>('toast-btn');

  let estado: Estado = { config: { ...configInicial(datos), nivel: leerNivel() ?? 'basico' }, privacidad: {}, manual: null };
  let guardadas = leerGuardadas();
  let nombreGuardar = '';
  let conTextos = false;
  let promptActual = '';
  let bloqueoActual = '';

  /* ---------- Pintado ---------- */

  /** Sustituye el HTML de un contenedor conservando el foco, los desplegables abiertos y el desplazamiento. */
  function sustituir(contenedor: HTMLElement, html: string): void {
    const foco = document.activeElement instanceof HTMLElement && contenedor.contains(document.activeElement) ? document.activeElement : null;
    const idFoco = foco?.id ?? '';
    const seleccion = foco instanceof HTMLTextAreaElement || (foco instanceof HTMLInputElement && foco.type === 'text')
      ? [foco.selectionStart, foco.selectionEnd] : null;
    const abiertos = [...contenedor.querySelectorAll<HTMLDetailsElement>('details[id]')].filter((d) => d.open).map((d) => d.id);
    const cerrados = [...contenedor.querySelectorAll<HTMLDetailsElement>('details[id]')].filter((d) => !d.open).map((d) => d.id);
    const desplazados = [...contenedor.querySelectorAll<HTMLElement>('.prompt-txt[id]')].map((x) => [x.id, x.scrollTop] as const);

    contenedor.innerHTML = html;

    for (const id of abiertos) { const d = document.getElementById(id); if (d instanceof HTMLDetailsElement) d.open = true; }
    for (const id of cerrados) { const d = document.getElementById(id); if (d instanceof HTMLDetailsElement) d.open = false; }
    for (const [id, top] of desplazados) { const x = document.getElementById(id); if (x) x.scrollTop = top; }
    if (idFoco) {
      const nuevo = document.getElementById(idFoco);
      if (nuevo) {
        nuevo.focus({ preventScroll: true });
        if (seleccion && (nuevo instanceof HTMLTextAreaElement || nuevo instanceof HTMLInputElement)) nuevo.setSelectionRange(seleccion[0], seleccion[1]);
      }
    }
  }

  function pintarNiveles(): void {
    $niveles.innerHTML = datos.niveles.map((n) => `
      <button type="button" data-nivel="${e(n.id)}"${attrs({ 'aria-pressed': String(n.id === estado.config.nivel) })}>
        <strong>${icono('check').replace('class="i"', 'class="i marca"')}${e(n.nombre)}</strong><span class="desc">${e(n.descripcion)}</span>
      </button>`).join('');
    $nivelDesc.textContent = datos.niveles.find((n) => n.id === estado.config.nivel)?.descripcion ?? '';
  }

  /** Repinta la app. Con `conFormulario = false` solo se actualizan el panel y la barra de pasos. */
  function pintar(conFormulario = true): void {
    const r = resolver(estado.config, datos);
    const vista: Vista = { config: estado.config, r, privacidad: estado.privacidad };
    promptActual = componer(estado.config, datos, r);

    const faltaPrivacidad = !datos.privacidad.lista_comprobacion.every((c) => estado.privacidad[c.id] === true);
    bloqueoActual = copiaBloqueada(estado.config, datos, r) ? t('panel.bloqueado')
      : r.curso === null ? t('panel.falta_curso')
      : faltaPrivacidad ? t('panel.falta_privacidad') : '';

    if (conFormulario) { sustituir($form, formulario(vista, datos) + guardarHtml({ nivel: r.nivel, guardadas, nombre: nombreGuardar, conTextos })); observarPasos(); }
    sustituir($panel, panel({
      prompt: promptActual,
      avisos: avisos(estado.config, datos, r),
      manual: r.nivel.edicion_manual ? estado.manual : null,
      puedeEditar: r.nivel.edicion_manual,
      detalleDesplegado: r.nivel.detalle_normativo_desplegado,
      motivoBloqueo: bloqueoActual,
      faltaPrivacidad: bloqueoActual === t('panel.falta_privacidad'),
    }, datos));

    const actual = $pasos.querySelector('[aria-current="step"]')?.getAttribute('href') ?? '';
    $pasos.innerHTML = progreso(vista, datos).map((p) => `
      <a class="paso${p.hecho ? ' hecho' : ''}" href="#${p.id}"${attrs({ 'aria-current': actual === `#${p.id}` ? 'step' : null, 'aria-label': t(p.hecho ? 'app.paso_hecho' : 'app.paso', { n: p.n, nombre: p.nombre }) })}>
        <span class="n">${p.hecho ? icono('check') : p.n}</span><span class="t">${e(p.nombre)}</span></a>`).join('');
    el('copiar-movil').setAttribute('aria-disabled', String(bloqueoActual !== ''));
  }

  /* ---------- Barra de pasos: marca el paso que se está viendo ---------- */

  let observador: IntersectionObserver | null = null;
  function observarPasos(): void {
    observador?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    observador = new IntersectionObserver((entradas) => {
      const visible = entradas.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      for (const a of $pasos.querySelectorAll('a')) {
        if (a.getAttribute('href') === `#${visible.target.id}`) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    for (const s of $form.querySelectorAll('.paso-card')) observador.observe(s);
  }

  /* ---------- Aviso emergente ---------- */

  let temporizador = 0;
  function avisar(mensaje: string, deshacer?: () => void): void {
    window.clearTimeout(temporizador);
    $toastTxt.textContent = mensaje;
    $toastBtn.hidden = !deshacer;
    $toastBtn.onclick = deshacer ? () => { deshacer(); ocultarAviso(); } : null;
    $toast.classList.add('show');
    temporizador = window.setTimeout(ocultarAviso, deshacer ? 12000 : 5000);
  }
  function ocultarAviso(): void { $toast.classList.remove('show'); }

  /* ---------- Cambios de configuración ---------- */

  function cambiar(cambios: Partial<Config>): void { estado = { ...estado, config: { ...estado.config, ...cambios } }; }
  function fijarVariable(id: string, valor: Valor): void { cambiar({ variables: { ...estado.config.variables, [id]: valor } }); }
  function fijarCampo(id: string, valor: boolean | string | null): void { cambiar({ campos: { ...estado.config.campos, [id]: valor } }); }

  function esTexto(x: EventTarget | null): x is HTMLInputElement | HTMLTextAreaElement {
    return x instanceof HTMLTextAreaElement || (x instanceof HTMLInputElement && (x.type === 'text' || x.type === 'number'));
  }

  // Casillas, radios y desplegables: cambian la estructura, se repinta todo.
  $form.addEventListener('change', (ev) => {
    const x = ev.target;
    if (!(x instanceof HTMLInputElement || x instanceof HTMLSelectElement) || esTexto(x)) return;
    const k = x.dataset.k;
    const id = x.dataset.id ?? '';
    const marcado = x instanceof HTMLInputElement && x.checked;
    if (k === 'tipo_material') cambiar({ tipo_material: x.value });
    else if (k === 'adaptacion') cambiar({ adaptacion: x.value });
    else if (k === 'formato') cambiar({ formato: x.value });
    else if (k === 'curso') {
      cambiar({ curso: x.value || null });
      // Si el área elegida no existe en la nueva etapa o ciclo, se quita.
      const r = resolver(estado.config, datos);
      const area = datos.areas.find((a) => a.id === estado.config.campos.area);
      if (area && ((area.etapa !== null && r.etapa && area.etapa !== r.etapa.id) || (area.ciclos.length > 0 && r.ciclo && !area.ciclos.includes(r.ciclo.id)))) fijarCampo('area', null);
    }
    else if (k === 'perfil') cambiar({ perfiles: marcado ? [...estado.config.perfiles, id] : estado.config.perfiles.filter((p) => p !== id) });
    else if (k === 'var') fijarVariable(id, x instanceof HTMLSelectElement ? x.value : marcado);
    else if (k === 'var-multi') fijarVariable(id, [...$form.querySelectorAll<HTMLInputElement>(`input[data-k="var-multi"][data-id="${id}"]:checked`)].map((c) => c.value));
    else if (k === 'campo') fijarCampo(id, x instanceof HTMLSelectElement ? (x.value || null) : marcado);
    else if (k === 'salida') cambiar({ salidas: { ...estado.config.salidas, [id]: marcado } });
    else if (k === 'priv') estado = { ...estado, privacidad: { ...estado.privacidad, [id]: marcado } };
    else if (k === 'guardar-textos') { conTextos = marcado; return; }
    else return;
    pintar();
  });

  // Textos y números: se actualiza el prompt sin repintar el formulario, para no perder el foco.
  $form.addEventListener('input', (ev) => {
    const x = ev.target;
    if (!esTexto(x)) return;
    const k = x.dataset.k;
    const id = x.dataset.id ?? '';
    if (k === 'guardar-nombre') { nombreGuardar = x.value; return; }
    if (k === 'campo') fijarCampo(id, x.value);
    else if (k === 'personalizado') cambiar({ perfil_personalizado: x.value });
    else if (k === 'var') fijarVariable(id, x.type === 'number' ? (x.value === '' ? null : Number(x.value)) : x.value);
    else return;
    const hueco = document.getElementById(`det-${k === 'personalizado' ? 'personalizado' : id}`);
    if (hueco && hueco.dataset.detector) hueco.textContent = avisoDetector(x.value, datos);
    pintar(false);
  });

  function aplicarConfig(config: Config): void {
    estado = { ...estado, config, manual: null };
    guardarNivel(config.nivel);
    pintarNiveles();
    pintar();
  }

  function aplicarPreset(idPreset: string): void {
    const preset = datos.presets.find((p) => p.id === idPreset);
    if (!preset) return;
    const anterior = estado;
    const base = configInicial(datos);
    estado = { ...estado, manual: null, config: { ...base, nivel: estado.config.nivel, ...preset.config, variables: preset.config.variables ?? {}, salidas: Object.fromEntries((preset.config.salidas ?? []).map((x) => [x, true])) } };
    pintar();
    avisar(t('paso0.aplicado'), () => { estado = anterior; pintar(); });
    const destino = document.getElementById(preset.campos_a_revisar[0] ?? '');
    destino?.scrollIntoView({ block: 'center' });
    destino?.focus({ preventScroll: true });
  }

  function guardarActual(): void {
    const nombre = nombreGuardar.trim();
    if (!nombre) { avisar(t('guardar.falta_nombre')); document.getElementById('guardar-nombre')?.focus(); return; }
    const config = conTextos ? estado.config : sinTextosLibres(estado.config, datos);
    const existente = guardadas.findIndex((g) => g.nombre === nombre);
    if (existente === -1 && guardadas.length >= MAX_GUARDADAS) { avisar(t('guardar.llena', { n: MAX_GUARDADAS })); return; }
    const anterior = guardadas;
    const nueva = { nombre, conTextos, config };
    const lista = existente === -1 ? [nueva, ...guardadas] : guardadas.map((g, i) => (i === existente ? nueva : g));
    if (!escribirGuardadas(lista)) { avisar(t('guardar.error')); return; }
    guardadas = lista;
    nombreGuardar = '';
    pintar();
    avisar(t(existente === -1 ? 'guardar.hecho' : 'guardar.sustituida', { nombre }), () => { guardadas = anterior; escribirGuardadas(anterior); pintar(); });
  }

  $form.addEventListener('click', async (ev) => {
    const boton = (ev.target as HTMLElement).closest<HTMLElement>('button[data-k]');
    if (!boton) return;
    const k = boton.dataset.k;
    const indice = Number(boton.dataset.id);
    if (k === 'preset') aplicarPreset(boton.dataset.id ?? '');
    else if (k === 'guardar') guardarActual();
    else if (k === 'cargar' && guardadas[indice]) {
      const anterior = estado;
      const g = guardadas[indice];
      aplicarConfig(sanear(g.config, datos, g.conTextos));
      avisar(t('guardar.cargada', { nombre: g.nombre }), () => { estado = anterior; guardarNivel(anterior.config.nivel); pintarNiveles(); pintar(); });
    } else if (k === 'borrar' && guardadas[indice]) {
      const anterior = guardadas;
      const nombre = guardadas[indice].nombre;
      guardadas = guardadas.filter((_, i) => i !== indice);
      escribirGuardadas(guardadas);
      pintar();
      document.getElementById('guardar-nombre')?.focus();
      avisar(t('guardar.borrada', { nombre }), () => { guardadas = anterior; escribirGuardadas(anterior); pintar(); });
    } else if (k === 'compartir') {
      const url = `${location.origin}${location.pathname}#${codificar(estado.config, datos)}`;
      avisar((await copiar(url)) ? t('compartir.copiado') : t('compartir.no_copiado'));
    }
  });

  /* ---------- Niveles ---------- */

  $niveles.addEventListener('click', (ev) => {
    const boton = (ev.target as HTMLElement).closest<HTMLElement>('[data-nivel]');
    const nuevo = boton?.dataset.nivel as NivelId | undefined;
    if (!nuevo || nuevo === estado.config.nivel) return;
    const anterior = estado;
    const cambio = cambiarNivel(estado.config, nuevo, datos);
    estado = { ...estado, config: cambio.config, manual: datos.niveles.find((n) => n.id === nuevo)?.edicion_manual ? estado.manual : null };
    guardarNivel(nuevo);
    pintarNiveles();
    pintar();
    $niveles.querySelector<HTMLElement>(`[data-nivel="${nuevo}"]`)?.focus();
    if (cambio.restablecidas > 0) {
      avisar(cambio.restablecidas === 1 ? t('nivel.restablecidas_una') : t('nivel.restablecidas', { n: cambio.restablecidas }), () => {
        estado = anterior; guardarNivel(anterior.config.nivel); pintarNiveles(); pintar();
      });
    }
  });

  /* ---------- Panel: copiar, descargar, reiniciar, editar, acciones de los avisos ---------- */

  async function copiar(texto: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso o sin API: método clásico */ }
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }

  function descargar(texto: string): void {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = t('panel.archivo');
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  const textoFinal = () => (estado.manual !== null && resolver(estado.config, datos).nivel.edicion_manual ? estado.manual : promptActual);

  document.addEventListener('click', async (ev) => {
    const boton = (ev.target as HTMLElement).closest<HTMLElement>('button[data-k]');
    if (!boton || $form.contains(boton)) return;
    const k = boton.dataset.k;
    if (k === 'copiar' || k === 'descargar') {
      if (bloqueoActual) { avisar(bloqueoActual); return; }
      if (k === 'copiar') avisar((await copiar(textoFinal())) ? t('panel.copiado') : t('panel.no_copiado'));
      else { descargar(textoFinal()); avisar(t('panel.descargado')); }
    } else if (k === 'reiniciar') {
      const anterior = estado;
      estado = { config: { ...configInicial(datos), nivel: estado.config.nivel }, privacidad: {}, manual: null };
      pintar();
      avisar(t('reinicio.hecho'), () => { estado = anterior; pintar(); });
    } else if (k === 'editar') {
      estado = { ...estado, manual: promptActual };
      pintar(false);
      document.getElementById('prompt-manual')?.focus();
    } else if (k === 'volver') {
      estado = { ...estado, manual: null };
      pintar(false);
      document.getElementById('editar-manual')?.focus();
    } else if (k === 'accion') {
      const { tipo, valor = '' } = boton.dataset;
      if (tipo === 'cambiar_tipo_material') cambiar({ tipo_material: valor });
      else if (tipo === 'activar_variable') fijarVariable(valor, true);
      else if (tipo === 'activar_salida') cambiar({ salidas: { ...estado.config.salidas, [valor]: true } });
      pintar();
      if (tipo === 'ir_a_campo') {
        const destino = document.getElementById(`campo-${valor}`);
        destino?.scrollIntoView({ block: 'center' });
        destino?.focus({ preventScroll: true });
      }
    }
  });

  $panel.addEventListener('input', (ev) => {
    const x = ev.target;
    if (!(x instanceof HTMLTextAreaElement) || x.dataset.k !== 'manual') return;
    estado = { ...estado, manual: x.value };
    el('prompt-palabras').textContent = t('panel.palabras', { n: contarPalabras(x.value) });
  });

  /* ---------- Tema claro u oscuro ---------- */

  const $tema = el<HTMLButtonElement>('tema');
  const temaActual = (): Tema => (document.documentElement.dataset.theme as Tema | undefined)
    ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function pintarTema(): void {
    const oscuro = temaActual() === 'dark';
    $tema.setAttribute('aria-pressed', String(oscuro));
    $tema.querySelector('use')?.setAttribute('href', oscuro ? '#i-sun' : '#i-moon');
    const etiqueta = $tema.querySelector('.lbl');
    const texto = t(oscuro ? 'app.tema_claro' : 'app.tema_oscuro');
    if (etiqueta) etiqueta.textContent = texto;
    // En móvil el texto del botón se oculta: el nombre accesible va en aria-label.
    $tema.setAttribute('aria-label', texto);
  }
  $tema.addEventListener('click', () => {
    const nuevo: Tema = temaActual() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    guardarTema(nuevo);
    pintarTema();
  });
  const temaGuardado = leerTema();
  if (temaGuardado) document.documentElement.dataset.theme = temaGuardado;
  pintarTema();

  /* ---------- Configuración recibida por enlace ---------- */

  const compartida = decodificar(location.hash, datos);
  if (compartida) {
    estado = { ...estado, config: compartida };
    guardarNivel(compartida.nivel);
    history.replaceState(null, '', location.pathname + location.search);
  }

  pintarNiveles();
  pintar();
  if (compartida) avisar(t('compartir.cargado'));
}
