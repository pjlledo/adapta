// npm run validate-data
// Valida src/data/*.json contra src/schemas/*.schema.json y comprueba las referencias entre archivos.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ARCHIVOS, validarTodo, contarRevisar } from './lib/validar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const datos = {};
const esquemas = {};
const errores = [];

for (const archivo of ARCHIVOS) {
  try {
    datos[archivo] = JSON.parse(readFileSync(join(raiz, 'src/data', `${archivo}.json`), 'utf8'));
    esquemas[archivo] = JSON.parse(readFileSync(join(raiz, 'src/schemas', `${archivo}.schema.json`), 'utf8'));
  } catch (e) {
    errores.push(`${archivo}.json: ${e.message}`);
  }
}
const plantilla = readFileSync(join(raiz, 'src/data/plantilla_prompt.md'), 'utf8');

if (errores.length === 0) errores.push(...validarTodo(datos, esquemas, plantilla));

if (errores.length > 0) {
  console.error(`Se han encontrado ${errores.length} error(es) en los datos:\n`);
  for (const e of errores) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(`Datos correctos: ${ARCHIVOS.length} archivos validados.`);
const pendientes = contarRevisar(datos);
const total = Object.values(pendientes).reduce((a, b) => a + b, 0);
if (total > 0) {
  console.log(`\nElementos marcados con "revisar": true (${total}):`);
  for (const [archivo, n] of Object.entries(pendientes)) console.log(`  ${archivo}.json: ${n}`);
}
