// Avisos de coherencia: evalúa reglas.json sobre la configuración resuelta.
import type { Aviso, Config, Datos, Resuelta } from './tipos.ts';
import { evaluar } from './condiciones.ts';
import { disponible, resolver } from './estado.ts';

/** ¿Puede ejecutarse la acción de la regla en el nivel actual? */
function accionDisponible(r: Resuelta, datos: Datos, tipo: string, valor: string): boolean {
  const nivel = r.nivel.id;
  if (tipo === 'activar_variable') {
    const v = datos.variables.find((x) => x.id === valor);
    return v !== undefined && disponible(v, nivel) && r.nivel.medidas_editables;
  }
  if (tipo === 'activar_salida') {
    const e = datos.salidas.entregables.find((x) => x.id === valor);
    return e !== undefined && disponible(e, nivel);
  }
  if (tipo === 'ir_a_campo') {
    const c = datos.campos.find((x) => x.id === valor);
    return c !== undefined && disponible(c, nivel);
  }
  const t = datos.tipos_material.find((x) => x.id === valor);
  return t !== undefined && disponible(t, nivel);
}

/** Avisos que se muestran en el nivel actual, de más a menos graves. */
export function avisos(config: Config, datos: Datos, resuelta: Resuelta = resolver(config, datos)): Aviso[] {
  const orden = { critico: 0, aviso: 1, info: 2 };
  return datos.reglas
    .filter((regla) => resuelta.nivel.avisos_visibles.includes(regla.severidad) && evaluar(regla.condicion, resuelta.hechos))
    .map((regla) => {
      const conAccion = regla.accion !== undefined && accionDisponible(resuelta, datos, regla.accion.tipo, regla.accion.valor);
      return {
        id: regla.id,
        severidad: regla.severidad,
        mensaje: !conAccion && regla.mensaje_sin_nivel ? regla.mensaje_sin_nivel : regla.mensaje,
        bloquea_copiar: regla.bloquea_copiar,
        accion: conAccion && regla.accion ? regla.accion : null,
        referencia_normativa: regla.referencia_normativa,
        detalle_normativo: regla.detalle_normativo,
      };
    })
    .sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}

/** ¿Hay alguna regla que impida copiar el prompt? (Se evalúa en todos los niveles.) */
export function copiaBloqueada(config: Config, datos: Datos, resuelta: Resuelta = resolver(config, datos)): boolean {
  return datos.reglas.some((regla) => regla.bloquea_copiar && evaluar(regla.condicion, resuelta.hechos));
}
