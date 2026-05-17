import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yamljs';

const specPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));

describe('OpenAPI contract', () => {
  it('has valid OpenAPI 3.0 metadata', () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('TaskFlow API');
  });

  it('documents required auth endpoints', () => {
    expect(spec.paths['/auth/register']?.post).toBeDefined();
    expect(spec.paths['/auth/login']?.post).toBeDefined();
    expect(spec.paths['/auth/refresh']?.post).toBeDefined();
    expect(spec.paths['/auth/forgot-password']?.post).toBeDefined();
    expect(spec.paths['/auth/reset-password']?.post).toBeDefined();
    expect(spec.paths['/tasks/search']?.get).toBeDefined();
    expect(spec.paths['/teams/{teamId}/members/{userId}']?.delete).toBeDefined();
  });

  it('defines bearer security', () => {
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });
});
