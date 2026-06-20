import cors from 'cors';
import express from 'express';
import type { db as Db } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';

export function createApp(db: typeof Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const authService = createAuthService(db);
  app.use(createAuthRouter(authService));

  app.use(errorHandler);
  return app;
}
