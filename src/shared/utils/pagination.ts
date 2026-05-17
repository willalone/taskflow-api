export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function parsePagination(query: PaginationParams, defaults = { page: 1, limit: 20 }) {
  const pageRaw = Number(query.page);
  const limitRaw = Number(query.limit);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : defaults.page;
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : defaults.limit;
  const skip = (page - 1) * limit;
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, limit, skip, sortOrder, sortBy: query.sortBy };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalCount: number;
  totalPages: number;
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalCount: total,
    totalPages,
  };
  return { data, meta };
}
