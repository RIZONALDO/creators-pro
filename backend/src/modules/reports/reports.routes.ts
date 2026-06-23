import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { exportReportSchema, reportFilterSchema, serviceReportFilterSchema } from './reports.schemas.js';
import { buildCombinedExcel, buildCombinedPdf, buildExcel, buildPdf, type ExportRow, type ExportSection } from './reports.export.js';
import type { ReportsService } from './reports.service.js';

function parseFilter(req: Request) {
  return reportFilterSchema.parse({
    from: req.query.from,
    to: req.query.to,
    clientId: req.query.clientId,
    creatorId: req.query.creatorId,
  });
}

function parseServiceFilter(req: Request) {
  return serviceReportFilterSchema.parse({
    from: req.query.from,
    to: req.query.to,
    clientId: req.query.clientId,
    collaboratorId: req.query.collaboratorId,
  });
}

export function createReportsRouter(service: ReportsService) {
  const router = Router();
  router.use('/reports', authenticate);

  router.get('/reports/production-monthly', async (req, res, next) => {
    try {
      const data = await service.productionMonthly(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/production-by-client', async (req, res, next) => {
    try {
      const data = await service.productionByClient(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/production-by-creator', async (req, res, next) => {
    try {
      const data = await service.productionByCreator(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/shifts-completed', async (req, res, next) => {
    try {
      const data = await service.shiftsCompleted(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/absences', async (req, res, next) => {
    try {
      const data = await service.absencesSummary(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/approved-deliveries', async (req, res, next) => {
    try {
      const data = await service.approvedDeliveries(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/tasks', async (req, res, next) => {
    try {
      const data = await service.tasksListing(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/services', async (req, res, next) => {
    try {
      const data = await service.servicesListing(req.auth!, parseServiceFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/absences-list', async (req, res, next) => {
    try {
      const data = await service.absencesListing(req.auth!, parseFilter(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/export', async (req, res, next) => {
    try {
      const input = exportReportSchema.parse({
        from: req.query.from,
        to: req.query.to,
        clientId: req.query.clientId,
        creatorId: req.query.creatorId,
        collaboratorId: req.query.collaboratorId,
        type: req.query.type,
        format: req.query.format,
      });
      let buffer: Buffer;
      if (input.type === 'all') {
        const sections = (await service.exportAllData(req.auth!, input)) as ExportSection[];
        buffer = input.format === 'pdf' ? await buildCombinedPdf(sections) : await buildCombinedExcel(sections);
      } else {
        const rows = (await service.exportData(req.auth!, input)) as ExportRow[];
        buffer = input.format === 'pdf' ? await buildPdf(input.type, rows) : await buildExcel(input.type, rows);
      }

      const extension = input.format === 'pdf' ? 'pdf' : 'xlsx';
      const contentType = input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-${input.type}.${extension}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
