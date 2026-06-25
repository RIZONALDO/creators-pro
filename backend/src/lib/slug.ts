export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'empresa';
}

/** `exists` é injetável — quem chama decide onde checar (companies.repository.ts hoje). */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  let slug = base;
  let attempt = 1;
  while (await exists(slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}
