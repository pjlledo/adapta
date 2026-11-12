# Adapta

**Genera prompts para que una IA adapte una actividad, una situación de aprendizaje o una prueba de evaluación.**

Adapta forma parte de [orienteca.es](https://orienteca.es). El docente configura la adaptación, copia el prompt, abre su herramienta de IA (Claude, ChatGPT, Gemini, Copilot…), adjunta el documento original sin adaptar y pega el prompt. La IA devuelve un documento nuevo y completo, adaptado con el Diseño Universal para el Aprendizaje (DUA) y las medidas de respuesta educativa para la inclusión del sistema educativo valenciano.

- **Privacidad por diseño.** Todo ocurre en el navegador: no hay servidor, base de datos, cookies ni analítica, y no se hace ninguna petición de red tras la carga. Adapta nunca recibe el documento original.
- **Tres niveles de funcionalidad:** Básico, Avanzado y Experto.
- **Tres tipos de adaptación:** diseño DUA para todo el grupo (nivel II), adecuación personalizada (nivel III) y material para alumnado con ACIS (nivel IV, solo si la ACIS ya consta en su PAP).

Adapta no llama a ninguna IA, no guarda información del alumnado y no diagnostica ni propone medidas que requieren evaluación sociopsicopedagógica.

## Ejecutar en local

Hace falta [Node.js](https://nodejs.org) 24 o posterior.

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal (normalmente `http://localhost:5173/`).

| Orden | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo; se recarga al cambiar algo en `src/`. |
| `npm run validate-data` | Valida los archivos de datos y lista los elementos marcados `"revisar": true`. |
| `npm test` | Tests del motor (no necesitan dependencias). |
| `npm run typecheck` | Comprueba los tipos de TypeScript. |
| `npm run build` | Valida los datos, comprueba los tipos y genera el sitio en `dist/`. |
| `npm run preview` | Sirve `dist/` para probar el sitio ya compilado. |

## Editar los contenidos

Todo el contenido pedagógico vive en `src/data/`, nunca en el código. Después de cualquier cambio, ejecuta `npm run validate-data`: el validador avisa de identificadores repetidos, referencias a elementos que no existen y campos que faltan.

| Archivo | Contenido |
|---|---|
| `niveles.json` | Los tres niveles: nombre, descripción y qué permite cada uno. |
| `etapas.json` | Etapas, ciclos y cursos. ESO está preparada con `"activo": false`. |
| `areas.json` | Áreas de Infantil y Primaria. |
| `tipos_material.json` | Tipos de material y las medidas que sugiere cada uno. |
| `adaptaciones.json` | Los tres tipos de adaptación y cómo se describen en el prompt. |
| `perfiles.json` | Perfiles: barreras, estrategias para la IA, qué evitar y medidas preseleccionadas. |
| `variables.json` | Catálogo de medidas, con el texto que cada una aporta al prompt. |
| `campos.json` | Campos del formulario (contexto y documento original). |
| `salidas.json` | Entregables, formatos de entrega y maquetación fija. |
| `reglas.json` | Avisos de coherencia, con su condición y su referencia normativa. |
| `presets.json` | Configuraciones de inicio rápido. |
| `privacidad.json` | Lista de comprobación, detector de datos personales y textos de uso. |
| `plantilla_prompt.md` | Plantilla del prompt, con marcadores `{{así}}`. |

### Asignar una opción a otro nivel

Cada elemento lleva un campo `nivel_minimo` con el valor `"basico"`, `"avanzado"` o `"experto"`. Para que una opción aparezca en otro nivel basta con cambiar ese valor. Por ejemplo, para que la tipografía se pueda elegir desde Avanzado, en `variables.json`:

```json
{ "id": "tipografia", "nivel_minimo": "avanzado", "…": "…" }
```

Las opciones que no se ven en un nivel no desaparecen del prompt: toman el valor por defecto del JSON o el que se deriva de los perfiles elegidos.

### Añadir una medida

Añade un elemento a `variables.json`. Los campos principales:

- `grupo`: `representacion`, `accion`, `implicacion`, `evaluacion` o `formato`.
- `tipo_control`: `checkbox`, `select`, `multiselect`, `number` o `text`.
- `fragmento_prompt`: la instrucción para la IA. En los controles que no son casillas debe incluir `{{valor}}`.
- `opciones` (en `select` y `multiselect`): cada una con `valor`, `etiqueta` y, si hace falta, `texto_prompt`, que es lo que se inserta en `{{valor}}`.

Para que un perfil active la medida, añade su `id` a `variables_preseleccionadas` en `perfiles.json`. Si la medida no es una casilla, indica el valor: `{ "id": "tipografia", "valor": "ampliada" }`.

### Añadir un perfil

Añade un elemento a la lista `perfiles` de `perfiles.json`. Escribe en `estrategias_para_ia` solo lo que no cubra ya una medida del catálogo; lo demás va en `variables_preseleccionadas`. Así el prompt no repite instrucciones.

### Contenido pendiente de revisión

Todo contenido pedagógico nuevo se marca con `"revisar": true` hasta que lo valide una persona. `npm run validate-data` muestra cuántos elementos quedan por revisar en cada archivo.

### Textos de la interfaz

Están en `src/i18n/es.json`. Para añadir el valenciano, crea `va.json` con las mismas claves y regístralo en `src/i18n/index.ts`.

## Cómo está hecho

```
src/
  data/            contenidos editables (JSON y plantilla del prompt)
  schemas/         esquema JSON de cada archivo de datos
  engine/          motor: resuelve la configuración y compone el prompt (lógica pura)
  ui/              formulario, panel del prompt y eventos
  almacenamiento/  localStorage y enlace para compartir
  i18n/            textos de la interfaz
  styles/          tokens de diseño, componentes y tipografía
scripts/           validación de datos
tests/             tests del motor
index.html         la app
componentes.html   página de muestra de componentes
```

Sitio estático hecho con [Vite](https://vite.dev) y TypeScript, sin framework. Las rutas son relativas, así que funciona igual en un subdominio que en una subcarpeta.

En el navegador solo se guarda, con `localStorage`, el nivel elegido, el tema y las configuraciones que el docente guarde. Estas no incluyen sus textos salvo que lo pida expresamente. El enlace para compartir nunca los incluye.

## Despliegue

`npm run build` deja el sitio completo en `dist/`. Se puede publicar en cualquier alojamiento de archivos estáticos.

### GitHub Pages

El repositorio incluye `.github/workflows/deploy.yml`, que valida los datos, pasa los tests, compila y publica en cada push a `main`.

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Para usar un dominio propio: en la misma página, **Custom domain**, escribe el dominio (por ejemplo, `adapta.orienteca.es`).
3. En el DNS del dominio (Cloudflare), crea un registro `CNAME` con nombre `adapta` y destino `pjlledo.github.io`, sin proxy.

### Cloudflare Pages

Crea un proyecto conectado al repositorio con orden de compilación `npm run build` y directorio de salida `dist`. También se puede subir el contenido de `dist/` como implementación directa.

## Licencia

Código y contenidos: [EUPL-1.2](LICENSE).

Tipografía: [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) (Braille Institute), alojada en `src/styles/fonts/` bajo licencia SIL OFL 1.1 (`src/styles/fonts/OFL.txt`). No se carga nada de servidores externos.

Los resúmenes de normativa (Decreto 104/2018, Orden 20/2019 y decretos de currículo) son orientativos: consulta siempre el texto vigente.
