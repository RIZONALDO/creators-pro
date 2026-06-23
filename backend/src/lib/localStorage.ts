import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from './env.js';

const UPLOADS_ROOT = resolve(import.meta.dirname, '../../', env.uploadsDir);

/** Mantém só caracteres seguros pra nome de arquivo — sem isso um nome tipo "../../etc/passwd" tentaria escapar da pasta. */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return cleaned.slice(-150) || 'arquivo';
}

/** Nunca confia em '..' vindo da key armazenada no banco também — defesa em profundidade, mesmo que a key seja sempre gerada por nós. */
function resolveKeyPath(key: string): string {
  const safeKey = key.replace(/\.\./g, '');
  return join(UPLOADS_ROOT, safeKey);
}

export interface SavedFile {
  key: string;
  sizeBytes: number;
}

/** Salva em uploads/<tenantId>/<uuid>-<nome> — a key (não o caminho absoluto) é o que fica em attachments.file_url. */
export async function saveFile(tenantId: string, originalName: string, buffer: Buffer): Promise<SavedFile> {
  const key = `${tenantId}/${randomUUID()}-${sanitizeFileName(originalName)}`;
  const fullPath = resolveKeyPath(key);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { key, sizeBytes: buffer.length };
}

export async function readFileByKey(key: string): Promise<Buffer> {
  return readFile(resolveKeyPath(key));
}

export async function deleteFileByKey(key: string): Promise<void> {
  const path = resolveKeyPath(key);
  if (existsSync(path)) await rm(path);
}
