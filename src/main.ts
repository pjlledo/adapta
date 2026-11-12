import './styles/index.css';
import { datos } from './datos.ts';
import { t } from './i18n/index.ts';
import { iniciar } from './ui/app.ts';

// Textos fijos de la página (los que no dependen del estado).
for (const nodo of document.querySelectorAll<HTMLElement>('[data-t]')) nodo.textContent = t(nodo.dataset.t ?? '');
for (const nodo of document.querySelectorAll<HTMLElement>('[data-t-label]')) nodo.setAttribute('aria-label', t(nodo.dataset.tLabel ?? ''));
for (const nodo of document.querySelectorAll<HTMLElement>('[data-t-title]')) nodo.setAttribute('title', t(nodo.dataset.tTitle ?? ''));

iniciar(datos);

// La barra de pasos y el panel se anclan justo debajo de la cabecera, mida lo que mida.
const cabecera = document.querySelector<HTMLElement>('.topbar');
if (cabecera) {
  const medir = () => document.documentElement.style.setProperty('--topbar-h', `${cabecera.offsetHeight}px`);
  medir();
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(cabecera);
}
