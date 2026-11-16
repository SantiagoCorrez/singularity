// Genera, desde los JSON Schema, los tipos TypeScript y una copia embebida de los
// esquemas para validar en el frontend. El esquema es la única fuente de verdad.
import { compileFromFile } from 'json-schema-to-typescript';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webSrc = resolve(schemaDir, '../../apps/web/src');
const banner = '/* GENERADO por packages/schema/scripts/gen-types.ts — no editar a mano. */\n';

const types = await compileFromFile(resolve(schemaDir, 'report.schema.json'), {
  cwd: schemaDir,
  bannerComment: banner,
  style: { singleQuote: true },
});
mkdirSync(resolve(webSrc, 'types'), { recursive: true });
writeFileSync(resolve(webSrc, 'types/report.ts'), types);

const figure = readFileSync(resolve(schemaDir, 'figure.schema.json'), 'utf8');
const report = readFileSync(resolve(schemaDir, 'report.schema.json'), 'utf8');
mkdirSync(resolve(webSrc, 'generated'), { recursive: true });
writeFileSync(
  resolve(webSrc, 'generated/schemas.ts'),
  `${banner}export const figureSchema = ${figure.trim()} as const;\n\nexport const reportSchema = ${report.trim()} as const;\n`,
);
console.log('Tipos y esquemas generados en apps/web/src/{types,generated}');
