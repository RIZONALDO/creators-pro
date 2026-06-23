export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function unauthorized(code: string, message = 'Não autenticado.') {
  return new ApiError(401, code, message);
}

export function forbidden(code: string, message = 'Sem permissão para esta ação.') {
  return new ApiError(403, code, message);
}

export function badRequest(code: string, message: string) {
  return new ApiError(400, code, message);
}

export function conflict(code: string, message: string) {
  return new ApiError(409, code, message);
}

export function notFound(code: string, message = 'Recurso não encontrado.') {
  return new ApiError(404, code, message);
}

/** Assinatura suspensa/cancelada (Fase 9.1) — semanticamente diferente de 401 (credenciais corretas, acesso bloqueado por outro motivo). */
export function paymentRequired(code: string, message: string) {
  return new ApiError(402, code, message);
}
