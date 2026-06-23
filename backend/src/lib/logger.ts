type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  request_id?: string;
  tenant_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

/**
 * Log estruturado (JSON, 1 linha por evento) — Fase 9 (hardening). `request_id`/`tenant_id`
 * correlacionam todas as linhas de uma mesma requisição sem precisar reproduzir o problema
 * localmente — é o que faltava nos `console.log`/`console.error` crus de antes.
 */
function write(level: LogLevel, message: string, context?: LogContext) {
  // suíte de testes não precisa de 1 linha por request (Vitest seta NODE_ENV=test sozinho) — só ruído no output.
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...context });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};
