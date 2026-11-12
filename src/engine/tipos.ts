// Tipos del motor de Adapta. Reflejan la forma de los archivos de src/data.

export type NivelId = 'basico' | 'avanzado' | 'experto';
export type Severidad = 'critico' | 'aviso' | 'info';
export type Valor = boolean | string | number | string[] | null;

export interface Elemento { id: string; nivel_minimo: NivelId; revisar?: boolean }

export interface Nivel extends Elemento {
  id: NivelId; orden: number; nombre: string; descripcion: string; ayuda: string;
  max_perfiles: number | null; medidas_editables: boolean; avisos_visibles: Severidad[];
  detalle_normativo_desplegado: boolean; edicion_manual: boolean;
  guardar_configuraciones: boolean; compartir_enlace: boolean;
}

export interface Curso { id: string; nombre: string; nombre_prompt: string }
export interface Ciclo { id: string; nombre: string; cursos: Curso[] }
export interface Etapa extends Elemento { activo: boolean; nombre: string; nombre_prompt: string; ciclos: Ciclo[] }
export interface Area extends Elemento { etapa: string | null; ciclos: string[]; nombre: string; texto_libre?: boolean }

export interface TipoMaterial extends Elemento {
  nombre: string; nombre_prompt: string; descripcion: string; es_evaluacion: boolean;
  variables_sugeridas: string[]; avisos: string[];
}

export interface Opcion { valor: string; etiqueta: string; texto_prompt?: string }

export type Condicion =
  | { todas: Condicion[] }
  | { alguna: Condicion[] }
  | { no: Condicion }
  | {
      campo: string; igual?: string | boolean | number; distinto?: string | boolean | number;
      en?: string[]; incluye?: string; incluye_alguno?: string[]; vacio?: boolean;
      mayor_que?: number; minimo?: number;
    };

export interface Variable extends Elemento {
  grupo: 'representacion' | 'accion' | 'implicacion' | 'evaluacion' | 'formato';
  principio_dua: string | null; seccion_prompt?: 'no_cambiar';
  etiqueta: string; ayuda: string;
  tipo_control: 'checkbox' | 'select' | 'number' | 'text' | 'multiselect';
  opciones?: Opcion[]; valor_defecto: Valor; minimo?: number; maximo?: number;
  texto_libre?: boolean; siempre_en_prompt?: boolean;
  visible_si?: Condicion; bloqueada_salvo?: Condicion;
  fragmento_prompt: string; fragmento_desactivada?: string; incompatible_con: string[];
}

export type Preseleccion = string | { id: string; valor: Valor };

export interface Perfil extends Elemento {
  nombre: string; nombre_prompt: string; grupo: string; personalizado?: boolean;
  descripcion_docente: string; barreras: string[]; estrategias_para_ia: string[]; evitar: string[];
  variables_preseleccionadas: Preseleccion[]; nota_docente?: string;
}

export interface Adaptacion extends Elemento {
  nivel_respuesta: 'II' | 'III' | 'IV'; por_defecto: boolean; nombre: string; descripcion: string;
  titulo_perfiles: string; intro_perfiles: string; descripcion_prompt: string;
  variables_preseleccionadas: Preseleccion[]; requiere?: string[]; al_ocultarse?: string;
  aviso?: string; referencia_normativa: string;
}

export interface Campo extends Elemento {
  paso: number; etiqueta: string; ayuda: string;
  tipo_control: 'checkbox' | 'select' | 'text' | 'textarea' | 'curso' | 'area';
  opciones?: Opcion[]; valor_defecto: boolean | string | null; texto_libre?: boolean;
  longitud_maxima?: number; siempre_en_prompt?: boolean; visible_si?: Condicion;
  marcador: string; fragmento_prompt: string; fragmento_defecto?: string; defecto_si?: Condicion;
}

export interface Entregable extends Elemento {
  orden: number; etiqueta: string; ayuda: string; obligatorio: boolean; valor_defecto: boolean;
  sustituye_a?: string[]; fragmento_prompt: string;
}
export interface Formato extends Elemento { por_defecto: boolean; etiqueta: string; fragmento_prompt: string; omite_alternativa?: boolean }

export interface Salidas {
  entregables: Entregable[]; formatos: Formato[]; alternativa_sin_archivos: string;
  maquetacion_fija: string[]; referencia_documento: { adjunto: string; pegado: string };
  textos_prompt: { etapa_sin_curso: string; barreras: string; barreras_personalizado: string; estrategias: string; maquetacion: string };
}

export interface Accion { tipo: 'cambiar_tipo_material' | 'activar_variable' | 'activar_salida' | 'ir_a_campo'; valor: string; etiqueta: string }
export interface Regla extends Elemento {
  severidad: Severidad; bloquea_copiar: boolean; condicion: Condicion; mensaje: string;
  mensaje_sin_nivel?: string; accion?: Accion; referencia_normativa: string; detalle_normativo: string;
}

export interface Preset extends Elemento {
  nombre: string; descripcion: string;
  config: { tipo_material: string; adaptacion: string; curso: string | null; perfiles: string[]; variables?: Record<string, Valor>; salidas?: string[] };
  campos_a_revisar: string[];
}

export interface PatronDetector extends Elemento { nombre: string; patron: string }
export interface Privacidad {
  lista_comprobacion: (Elemento & { texto: string })[]; detector: PatronDetector[]; mensaje_detector: string;
  antes_de_usar: (Elemento & { texto: string })[]; instrucciones_uso: (Elemento & { texto: string })[];
}

/** Todos los datos editables de la app, ya leídos. */
export interface Datos {
  niveles: Nivel[]; etapas: Etapa[]; areas: Area[]; tipos_material: TipoMaterial[];
  variables: Variable[]; perfiles: { ayuda: string; grupos: (Elemento & { nombre: string })[]; perfiles: Perfil[] };
  adaptaciones: Adaptacion[]; campos: Campo[]; salidas: Salidas; reglas: Regla[];
  presets: Preset[]; privacidad: Privacidad; plantilla: string;
}

/** Lo que el docente ha elegido. Solo guarda decisiones explícitas; el resto se deriva. */
export interface Config {
  nivel: NivelId;
  tipo_material: string;
  adaptacion: string;
  curso: string | null;
  perfiles: string[];
  /** Texto del perfil personalizado (Experto). */
  perfil_personalizado: string;
  /** Medidas que el docente ha cambiado a mano respecto a lo sugerido. */
  variables: Record<string, Valor>;
  /** Campos del formulario (contexto y documento). `area_texto` guarda el nombre cuando el área es «Otra». */
  campos: Record<string, boolean | string | null>;
  /** Entregables que el docente ha marcado o desmarcado. */
  salidas: Record<string, boolean>;
  formato: string | null;
}

export interface Sugerencia { valor: Valor; origenes: string[] }

/** Configuración resuelta: lo que realmente se aplica en el nivel actual. */
export interface Resuelta {
  nivel: Nivel;
  tipo: TipoMaterial;
  adaptacion: Adaptacion;
  curso: Curso | null; ciclo: Ciclo | null; etapa: Etapa | null;
  perfiles: Perfil[];
  perfilPersonalizado: string;
  sugerencias: Record<string, Sugerencia>;
  variables: Record<string, Valor>;
  /** Medidas activas (distintas de su valor neutro), en el orden del catálogo. */
  activas: string[];
  campos: Record<string, boolean | string | null>;
  salidas: string[];
  formato: Formato;
  hechos: Record<string, unknown>;
}

export interface Aviso {
  id: string; severidad: Severidad; mensaje: string; bloquea_copiar: boolean;
  accion: Accion | null; referencia_normativa: string; detalle_normativo: string;
}
