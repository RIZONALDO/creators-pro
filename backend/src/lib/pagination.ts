import type { Request } from 'express';

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function parsePagination(req: Request): Pagination {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

export function paginatedResponse<T>(data: T[], total: number, pagination: Pagination) {
  return { data, meta: { page: pagination.page, pageSize: pagination.pageSize, total } };
}
