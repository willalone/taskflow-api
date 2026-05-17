import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v1Router } from './routes/v1/index.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { globalRateLimiter } from './shared/middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(globalRateLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  const swaggerDocument = YAML.load(openapiPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/api-docs/openapi.yaml', (_req, res) => {
    res.sendFile(openapiPath);
  });

  app.use('/api/v1', v1Router);
  app.use(errorHandler);

  return app;
}
