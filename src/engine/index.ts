// Motor de Adapta: lógica pura, sin DOM ni acceso a red o a disco.
export type * from './tipos.ts';
export { evaluar } from './condiciones.ts';
export { detectarDatosPersonales } from './detector.ts';
export { configInicial, resolver, cambiarNivel, disponible, estaActiva } from './estado.ts';
export type { CambioNivel } from './estado.ts';
export { avisos, copiaBloqueada } from './reglas.ts';
export { componer, rellenarPlantilla, encabezados } from './componer.ts';
