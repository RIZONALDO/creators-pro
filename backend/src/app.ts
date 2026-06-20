import cors from 'cors';
import express from 'express';
import type { db as Db } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCreatorsService } from './modules/creators/creators.service.js';
import { createCreatorsRouter } from './modules/creators/creators.routes.js';
import { createCollaboratorsService } from './modules/collaborators/collaborators.service.js';
import { createCollaboratorsRouter } from './modules/collaborators/collaborators.routes.js';
import { createClientsRepository } from './modules/clients/clients.repository.js';
import { createClientsRouter } from './modules/clients/clients.routes.js';
import { createProfessionsService } from './modules/professions/professions.service.js';
import { createProfessionsRouter } from './modules/professions/professions.routes.js';
import { createStatusHistoryRepository } from './modules/statusHistory/statusHistory.repository.js';
import { createStatusHistoryRouter } from './modules/statusHistory/statusHistory.routes.js';
import { createTasksService } from './modules/tasks/tasks.service.js';
import { createTasksRouter } from './modules/tasks/tasks.routes.js';
import { createServicesService } from './modules/services/services.service.js';
import { createServicesRouter } from './modules/services/services.routes.js';

export function createApp(db: typeof Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use(createAuthRouter(createAuthService(db)));
  app.use(createCreatorsRouter(createCreatorsService(db)));
  app.use(createCollaboratorsRouter(createCollaboratorsService(db)));
  app.use(createClientsRouter(createClientsRepository(db)));
  app.use(createProfessionsRouter(createProfessionsService(db)));
  app.use(createStatusHistoryRouter(createStatusHistoryRepository(db)));
  app.use(createTasksRouter(createTasksService(db)));
  app.use(createServicesRouter(createServicesService(db)));

  app.use(errorHandler);
  return app;
}
