import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yamljs';

const file = path.join(process.cwd(), 'docs', 'openapi.yaml');
const doc = YAML.parse(fs.readFileSync(file, 'utf8'));

if (!doc.openapi?.startsWith('3.')) {
  console.error('Invalid OpenAPI version');
  process.exit(1);
}

if (!doc.info?.title) {
  console.error('Missing info.title');
  process.exit(1);
}

console.log(`OpenAPI valid: ${doc.info.title} v${doc.info.version}`);
