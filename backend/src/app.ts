import cors from 'cors';
import express from 'express';
import type Stripe from 'stripe';
import type { db as Db } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { snakeCaseResponse } from './middleware/snakeCaseResponse.js';
import { createNoopEmitter, type RealtimeEmitter } from './realtime/emitter.js';
import { createNoopPushSender, type PushSender } from './realtime/pushSender.js';
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
import { createScheduleService } from './modules/schedule/schedule.service.js';
import { createScheduleRouter } from './modules/schedule/schedule.routes.js';
import { createAbsencesService } from './modules/absences/absences.service.js';
import { createAbsencesRouter } from './modules/absences/absences.routes.js';
import { createShiftsService } from './modules/shifts/shifts.service.js';
import { createShiftsRouter } from './modules/shifts/shifts.routes.js';
import { createUsersAdminService } from './modules/users/users.service.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createNotificationsService } from './modules/notifications/notifications.service.js';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.js';
import { createMessagesService } from './modules/messages/messages.service.js';
import { createMessagesRouter } from './modules/messages/messages.routes.js';
import { createPushSubscriptionsService } from './modules/push/push.service.js';
import { createPushRouter } from './modules/push/push.routes.js';
import { createReportsService } from './modules/reports/reports.service.js';
import { createReportsRouter } from './modules/reports/reports.routes.js';
import { createAttachmentsService } from './modules/attachments/attachments.service.js';
import { createAttachmentsRouter } from './modules/attachments/attachments.routes.js';
import { createCompanyService } from './modules/company/company.service.js';
import { createCompanyRouter } from './modules/company/company.routes.js';
import { createBillingService } from './modules/billing/billing.service.js';
import { createBillingRouter, createBillingWebhookHandler } from './modules/billing/billing.routes.js';
import { createAccountService } from './modules/account/account.service.js';
import { createAccountRouter } from './modules/account/account.routes.js';
import { env } from './lib/env.js';

export function createApp(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
  // Testável sem chave real da Stripe (mesmo padrão de emitter/pushSender) — ver billing.routes.test.ts.
  billingDeps?: { stripe?: Stripe | null; priceId?: string; webhookSecret?: string },
) {
  const app = express();
  // Atrás de exatamente 1 proxy reverso em produção (nginx, ver DEPLOY.md) — sem isso,
  // express-rate-limit vê o X-Forwarded-For do nginx e rejeita (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR),
  // e pior: sem isso req.ip vira sempre o IP do nginx (127.0.0.1), juntando todo mundo no mesmo
  // balde de rate limit de login/signup. Inofensivo em dev/test (sem proxy na frente, sem header).
  app.set('trust proxy', 1);
  app.use(requestLogger);
  app.use(cors());

  const authService = createAuthService(db);
  const billingService = createBillingService(db, authService, billingDeps?.stripe, billingDeps?.priceId);

  // Webhook do Stripe precisa do corpo cru (bytes exatos) pra validar a assinatura — tem que vir
  // ANTES do express.json() global, senão o corpo já chega parseado e a verificação falha sempre.
  app.post(
    '/billing/webhook',
    express.raw({ type: 'application/json' }),
    createBillingWebhookHandler(billingService, billingDeps?.stripe, billingDeps?.webhookSecret),
  );

  app.use(express.json());
  app.use(snakeCaseResponse);

  app.use(createAuthRouter(authService));
  app.use(createBillingRouter(billingService));
  app.use(createCreatorsRouter(createCreatorsService(db)));
  app.use(createCollaboratorsRouter(createCollaboratorsService(db)));
  app.use(createClientsRouter(createClientsRepository(db)));
  app.use(createProfessionsRouter(createProfessionsService(db)));
  app.use(createStatusHistoryRouter(createStatusHistoryRepository(db)));
  app.use(createTasksRouter(createTasksService(db, emitter, pushSender)));
  app.use(createServicesRouter(createServicesService(db)));
  app.use(createScheduleRouter(createScheduleService(db, emitter, pushSender)));
  app.use(createAbsencesRouter(createAbsencesService(db, emitter, pushSender)));
  app.use(createShiftsRouter(createShiftsService(db, emitter, pushSender)));
  app.use(createUsersRouter(createUsersAdminService(db)));
  app.use(createNotificationsRouter(createNotificationsService(db, emitter, pushSender)));
  app.use(createMessagesRouter(createMessagesService(db, emitter)));
  app.use(createPushRouter(createPushSubscriptionsService(db), env.vapidPublicKey));
  app.use(createReportsRouter(createReportsService(db)));
  app.use(createAttachmentsRouter(createAttachmentsService(db, emitter, pushSender)));
  app.use(createCompanyRouter(createCompanyService(db)));
  app.use(createAccountRouter(createAccountService(db)));

  app.use(errorHandler);
  return app;
}
