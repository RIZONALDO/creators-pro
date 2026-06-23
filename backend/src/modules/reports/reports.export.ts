import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export type ExportType = 'monthly' | 'client' | 'creator' | 'tasks' | 'services' | 'absences';
export type ExportRow = Record<string, unknown>;
export interface ExportSection { type: ExportType; rows: ExportRow[]; }

interface ColumnDef { header: string; key: string; width: number; }

const TITLES: Record<ExportType, string> = {
  monthly: 'Produção mensal',
  client: 'Produção por cliente',
  creator: 'Produção por creator',
  tasks: 'Tarefas dos creators',
  services: 'Outros serviços',
  absences: 'Ausências',
};

// `key` casa com o alias camelCase devolvido pelo repository (.select({ taskDate: ... })) — o
// export nunca passa por snakeCaseResponse (isso é só pra JSON via res.json, aqui é arquivo binário).
const COLUMNS: Record<ExportType, ColumnDef[]> = {
  monthly: [
    { header: 'Mês', key: 'month', width: 20 },
    { header: 'Quantidade', key: 'count', width: 15 },
  ],
  client: [
    { header: 'Cliente', key: 'clientName', width: 32 },
    { header: 'Quantidade', key: 'count', width: 15 },
  ],
  creator: [
    { header: 'Creator', key: 'creatorName', width: 32 },
    { header: 'Quantidade', key: 'count', width: 15 },
  ],
  tasks: [
    { header: 'Título', key: 'title', width: 32 },
    { header: 'Formato', key: 'formatType', width: 16 },
    { header: 'Data', key: 'taskDate', width: 14 },
    { header: 'Cliente', key: 'clientName', width: 24 },
    { header: 'Creator', key: 'creatorName', width: 24 },
    { header: 'Responsável', key: 'responsibleName', width: 24 },
    { header: 'Status', key: 'status', width: 16 },
  ],
  services: [
    { header: 'Serviço', key: 'serviceName', width: 32 },
    { header: 'Tipo', key: 'serviceType', width: 16 },
    { header: 'Data', key: 'serviceDate', width: 14 },
    { header: 'Cliente', key: 'clientName', width: 24 },
    { header: 'Colaborador', key: 'collaboratorName', width: 24 },
    { header: 'Responsável', key: 'responsibleName', width: 24 },
    { header: 'Status', key: 'status', width: 16 },
  ],
  absences: [
    { header: 'Creator', key: 'creatorName', width: 28 },
    { header: 'Início', key: 'startDate', width: 14 },
    { header: 'Fim', key: 'endDate', width: 14 },
    { header: 'Motivo', key: 'reason', width: 32 },
    { header: 'Responsável', key: 'responsibleName', width: 24 },
    { header: 'Status', key: 'status', width: 16 },
  ],
};

function cellValue(row: ExportRow, key: string): string {
  const value = row[key];
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function renderPdfSection(doc: PDFKit.PDFDocument, type: ExportType, rows: ExportRow[]) {
  const columns = COLUMNS[type];

  doc.fontSize(16).text(TITLES[type], { underline: true });
  doc.moveDown(0.5);

  if (rows.length === 0) {
    doc.fontSize(10).text('Nenhum dado no período selecionado.');
    return;
  }

  const startX = doc.x;
  let y = doc.y;
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;

  doc.fontSize(9).font('Helvetica-Bold');
  columns.forEach((col, i) => doc.text(col.header, startX + i * colWidth, y, { width: colWidth - 6 }));
  y += 16;
  doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#cccccc').stroke();
  y += 6;

  doc.font('Helvetica').fontSize(8.5);
  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      y = doc.y;
    }
    columns.forEach((col, i) => doc.text(cellValue(row, col.key), startX + i * colWidth, y, { width: colWidth - 6 }));
    y += 16;
  }
}

export function buildPdf(type: ExportType, rows: ExportRow[]): Promise<Buffer> {
  return buildCombinedPdf([{ type, rows }]);
}

/** type=all (export combinado) — 1 seção por dataset, cada uma numa página nova. */
export function buildCombinedPdf(sections: ExportSection[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    sections.forEach((section, i) => {
      if (i > 0) doc.addPage({ size: 'A4', layout: 'landscape' });
      renderPdfSection(doc, section.type, section.rows);
    });

    doc.end();
  });
}

function renderExcelSection(workbook: ExcelJS.Workbook, type: ExportType, rows: ExportRow[]) {
  const columns = COLUMNS[type];
  const sheet = workbook.addWorksheet(TITLES[type]);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, cellValue(row, c.key)])));
  }
}

export async function buildExcel(type: ExportType, rows: ExportRow[]): Promise<Buffer> {
  return buildCombinedExcel([{ type, rows }]);
}

/** type=all (export combinado) — 1 planilha (worksheet) por dataset, no mesmo arquivo. */
export async function buildCombinedExcel(sections: ExportSection[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const section of sections) renderExcelSection(workbook, section.type, section.rows);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
