// Reúne los archivos de datos editables en un único objeto para el motor.
import type { Datos } from './engine/index.ts';
import niveles from './data/niveles.json';
import etapas from './data/etapas.json';
import areas from './data/areas.json';
import tipos_material from './data/tipos_material.json';
import variables from './data/variables.json';
import perfiles from './data/perfiles.json';
import adaptaciones from './data/adaptaciones.json';
import campos from './data/campos.json';
import salidas from './data/salidas.json';
import reglas from './data/reglas.json';
import presets from './data/presets.json';
import privacidad from './data/privacidad.json';
import plantilla from './data/plantilla_prompt.md?raw';

export const datos = {
  niveles, etapas, areas, tipos_material, variables, perfiles, adaptaciones, campos, salidas, reglas, presets, privacidad, plantilla,
} as unknown as Datos;
