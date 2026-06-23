/**
 * Abre uma nova aba com o relatório em formato de planilha condensada (tabela HTML com CSS de
 * impressão) e já aciona o diálogo de impressão do navegador — de lá, dá pra "Salvar como PDF"
 * também, sem depender do export do backend.
 */
export interface PrintColumn<T> {
  header: string;
  value: (row: T) => string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTable<T>(columns: PrintColumn<T>[], rows: T[]): string {
  const headerRow = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.value(row))}</td>`).join('')}</tr>`)
    .join('');
  return `<table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="${columns.length}">Nenhum registro no período selecionado.</td></tr>`}</tbody>
  </table>`;
}

const PRINT_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #111; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 6px; }
  h2:first-of-type { margin-top: 0; }
  .meta { font-size: 11px; color: #666; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 18px; }
  th, td { border: 1px solid #ccc; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 0; } h2 { page-break-before: always; } h2:first-of-type { page-break-before: auto; } }
`;

export function printReport<T>(title: string, columns: PrintColumn<T>[], rows: T[]) {
  const win = window.open('', '_blank');
  if (!win) return; // bloqueador de pop-up — sem isso o erro seria silencioso.

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${rows.length} registro${rows.length === 1 ? '' : 's'} — gerado em ${new Date().toLocaleString('pt-BR')}</div>
  ${renderTable(columns, rows)}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

export interface PrintSection<T> {
  heading: string;
  columns: PrintColumn<T>[];
  rows: T[];
}

/** "Todos" — uma seção por dataset, empilhadas na mesma aba (cada uma começa página nova ao imprimir). */
export function printMultiReport(title: string, sections: PrintSection<any>[]) {
  const win = window.open('', '_blank');
  if (!win) return;

  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  const sectionsHtml = sections
    .map((s) => `<h2>${escapeHtml(s.heading)} (${s.rows.length})</h2>${renderTable(s.columns, s.rows)}`)
    .join('');

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${totalRows} registro${totalRows === 1 ? '' : 's'} no total — gerado em ${new Date().toLocaleString('pt-BR')}</div>
  ${sectionsHtml}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
