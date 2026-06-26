import { useState } from 'react';
import { Document } from 'grommet-icons';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { downloadBlob } from '@/lib/download';
import { printMultiReport, printReport, type PrintColumn } from '@/lib/printReport';
import { Card, Button, Tag, StatusPill } from '@/components/ui';
import { FilterChip } from '@/components/FilterChip';
import { Chip } from '@/components/Chip';
import { DatePicker } from '@/components/DatePicker';
import {
  TASK_STATUS_META, SERVICE_STATUS_META, ABSENCE_STATUS_META,
  TASK_FORMAT_COLOR, SERVICE_TYPE_LABEL, SERVICE_TYPE_COLOR, shortDate,
} from '@/lib/display';
import type {
  Creator, Client, Collaborator, TaskReportRow, ServiceReportRow, AbsenceReportRow, ReportFilterParams,
} from '@/types';

type Dataset = 'tasks' | 'services' | 'absences' | 'all';
type ExportFormat = 'pdf' | 'excel';

const DATASET_LABEL: Record<Dataset, string> = { tasks: 'Tarefas', services: 'Outros serviços', absences: 'Ausências', all: 'Todos' };

const printIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>;
const pdfIcon = <Document size="small" color="#EF4444" />;
const excelIcon = <Document size="small" color="#22C55E" />;

const TASKS_GRID = '1.9fr .9fr 1.1fr 1.2fr 1.2fr 1.2fr 1fr';
const SERVICES_GRID = '1.9fr 1.1fr 1.1fr 1.2fr 1.2fr 1.2fr 1fr';
const ABSENCES_GRID = '1.4fr 1.1fr 1.1fr 1.7fr 1.2fr 1fr';

function TasksTable({ rows, loading }: { rows: TaskReportRow[]; loading: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: TASKS_GRID, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
        <span>TÍTULO</span><span>FORMATO</span><span>DATA</span><span>CLIENTE</span><span>CREATOR</span><span>RESPONSÁVEL</span><span>STATUS</span>
      </div>
      {!loading && rows.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: 'var(--tx3)' }}>Nenhuma tarefa no filtro atual.</div>}
      {rows.map((t) => (
        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: TASKS_GRID, gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>{t.title}</span>
          <span>{t.format_type && <Tag label={t.format_type} color={TASK_FORMAT_COLOR[t.format_type]} />}</span>
          <span style={{ color: 'var(--tx3)' }}>{shortDate(t.task_date)}</span>
          <span style={{ color: 'var(--tx2)' }}>{t.client_name ?? '—'}</span>
          <span style={{ color: 'var(--tx2)' }}>{t.creator_name ?? '—'}</span>
          <span style={{ color: 'var(--tx2)' }}>{t.responsible_name ?? '—'}</span>
          <span><StatusPill meta={TASK_STATUS_META[t.status]} /></span>
        </div>
      ))}
    </>
  );
}

function ServicesTable({ rows, loading }: { rows: ServiceReportRow[]; loading: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: SERVICES_GRID, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
        <span>SERVIÇO</span><span>TIPO</span><span>DATA</span><span>CLIENTE</span><span>COLABORADOR</span><span>RESPONSÁVEL</span><span>STATUS</span>
      </div>
      {!loading && rows.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: 'var(--tx3)' }}>Nenhum serviço no filtro atual.</div>}
      {rows.map((s) => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: SERVICES_GRID, gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>{s.service_name}</span>
          <span><Tag label={SERVICE_TYPE_LABEL[s.service_type ?? 'outros'] ?? s.service_type ?? '—'} color={SERVICE_TYPE_COLOR[s.service_type ?? 'outros'] ?? SERVICE_TYPE_COLOR.outros} /></span>
          <span style={{ color: 'var(--tx3)' }}>{shortDate(s.service_date)}</span>
          <span style={{ color: 'var(--tx2)' }}>{s.client_name ?? '—'}</span>
          <span style={{ color: 'var(--tx2)' }}>{s.collaborator_name ?? '—'}</span>
          <span style={{ color: 'var(--tx2)' }}>{s.responsible_name ?? '—'}</span>
          <span><StatusPill meta={SERVICE_STATUS_META[s.status] ?? SERVICE_STATUS_META.agendado} /></span>
        </div>
      ))}
    </>
  );
}

function AbsencesTable({ rows, loading }: { rows: AbsenceReportRow[]; loading: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: ABSENCES_GRID, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
        <span>CREATOR</span><span>INÍCIO</span><span>FIM</span><span>MOTIVO</span><span>RESPONSÁVEL</span><span>STATUS</span>
      </div>
      {!loading && rows.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: 'var(--tx3)' }}>Nenhuma ausência no filtro atual.</div>}
      {rows.map((a) => (
        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: ABSENCES_GRID, gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>{a.creator_name ?? '—'}</span>
          <span style={{ color: 'var(--tx3)' }}>{shortDate(a.start_date)}</span>
          <span style={{ color: 'var(--tx3)' }}>{shortDate(a.end_date)}</span>
          <span style={{ color: 'var(--tx2)' }}>{a.reason ?? '—'}</span>
          <span style={{ color: 'var(--tx2)' }}>{a.responsible_name ?? '—'}</span>
          <span><StatusPill meta={ABSENCE_STATUS_META[a.status]} /></span>
        </div>
      ))}
    </>
  );
}

const TASKS_PRINT_COLUMNS: PrintColumn<TaskReportRow>[] = [
  { header: 'Título', value: (r) => r.title },
  { header: 'Formato', value: (r) => r.format_type ?? '—' },
  { header: 'Data', value: (r) => shortDate(r.task_date) },
  { header: 'Cliente', value: (r) => r.client_name ?? '—' },
  { header: 'Creator', value: (r) => r.creator_name ?? '—' },
  { header: 'Responsável', value: (r) => r.responsible_name ?? '—' },
  { header: 'Status', value: (r) => TASK_STATUS_META[r.status]?.label ?? r.status },
];

const SERVICES_PRINT_COLUMNS: PrintColumn<ServiceReportRow>[] = [
  { header: 'Serviço', value: (r) => r.service_name },
  { header: 'Tipo', value: (r) => SERVICE_TYPE_LABEL[r.service_type ?? ''] ?? r.service_type ?? '—' },
  { header: 'Data', value: (r) => shortDate(r.service_date) },
  { header: 'Cliente', value: (r) => r.client_name ?? '—' },
  { header: 'Colaborador', value: (r) => r.collaborator_name ?? '—' },
  { header: 'Responsável', value: (r) => r.responsible_name ?? '—' },
  { header: 'Status', value: (r) => SERVICE_STATUS_META[r.status]?.label ?? r.status },
];

const ABSENCES_PRINT_COLUMNS: PrintColumn<AbsenceReportRow>[] = [
  { header: 'Creator', value: (r) => r.creator_name ?? '—' },
  { header: 'Início', value: (r) => shortDate(r.start_date) },
  { header: 'Fim', value: (r) => shortDate(r.end_date) },
  { header: 'Motivo', value: (r) => r.reason ?? '—' },
  { header: 'Responsável', value: (r) => r.responsible_name ?? '—' },
  { header: 'Status', value: (r) => ABSENCE_STATUS_META[r.status]?.label ?? r.status },
];

export function Reports() {
  const { user } = useApp();
  const toast = useToast();
  const canSeeRoster = user?.role !== 'operacional'; // GET /creators, /clients e /collaborators são bloqueados pro operacional

  const [dataset, setDataset] = useState<Dataset>('tasks');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [filterClient, setFilterClient] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null); // creator (tasks/absences) OU colaborador (services) — não existe em "Todos"
  const [busy, setBusy] = useState<string | null>(null);

  function changeDataset(d: Dataset) {
    setDataset(d);
    setFilterPerson(null); // creators e colaboradores são listas diferentes — filtro antigo não se aplica
  }

  const clients = useAsync<Client[]>(() => (canSeeRoster ? api.clients.list() : Promise.resolve([])), []);
  const creators = useAsync<Creator[]>(() => (canSeeRoster && dataset !== 'services' ? api.creators.list() : Promise.resolve([])), [dataset]);
  const collaborators = useAsync<Collaborator[]>(() => (canSeeRoster && dataset === 'services' ? api.collaborators.list() : Promise.resolve([])), [dataset]);

  const filter: ReportFilterParams = {
    from,
    to,
    clientId: dataset !== 'absences' ? filterClient : null,
    creatorId: dataset !== 'services' && dataset !== 'all' ? filterPerson : null,
    collaboratorId: dataset === 'services' ? filterPerson : null,
  };

  const needTasks = dataset === 'tasks' || dataset === 'all';
  const needServices = dataset === 'services' || dataset === 'all';
  const needAbsences = dataset === 'absences' || dataset === 'all';

  const tasks = useAsync<TaskReportRow[]>(() => (needTasks ? api.reports.tasksListing(filter) : Promise.resolve([])), [dataset, from, to, filterClient, filterPerson]);
  const services = useAsync<ServiceReportRow[]>(() => (needServices ? api.reports.servicesListing(filter) : Promise.resolve([])), [dataset, from, to, filterClient, filterPerson]);
  const absences = useAsync<AbsenceReportRow[]>(() => (needAbsences ? api.reports.absencesListing(filter) : Promise.resolve([])), [dataset, from, to, filterPerson]);

  const loading = dataset === 'tasks' ? tasks.loading : dataset === 'services' ? services.loading : dataset === 'absences' ? absences.loading : (tasks.loading || services.loading || absences.loading);
  const rowCount = dataset === 'tasks' ? (tasks.data?.length ?? 0)
    : dataset === 'services' ? (services.data?.length ?? 0)
    : dataset === 'absences' ? (absences.data?.length ?? 0)
    : (tasks.data?.length ?? 0) + (services.data?.length ?? 0) + (absences.data?.length ?? 0);

  const clientOptions = [{ value: null, label: 'Todos' }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))];
  const personPool = dataset === 'services' ? (collaborators.data ?? []) : (creators.data ?? []);
  const personOptions = [{ value: null, label: 'Todos' }, ...personPool.map((c) => ({ value: c.id, label: c.name }))];
  const personLabel = dataset === 'services' ? 'Colaborador' : 'Creator';
  const personName = (id: string | null) => personPool.find((c) => c.id === id)?.name ?? '—';
  const clientName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? '—';

  async function handleExport(format: ExportFormat) {
    const key = `export-${format}`;
    setBusy(key);
    try {
      const blob = await api.reports.exportFile(dataset, format, filter);
      downloadBlob(blob, `relatorio-${dataset}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch (err) {
      toast.error('Não foi possível exportar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  }

  function handlePrint() {
    if (dataset === 'tasks') {
      printReport(`Relatório — ${DATASET_LABEL.tasks}`, TASKS_PRINT_COLUMNS, tasks.data ?? []);
    } else if (dataset === 'services') {
      printReport(`Relatório — ${DATASET_LABEL.services}`, SERVICES_PRINT_COLUMNS, services.data ?? []);
    } else if (dataset === 'absences') {
      printReport(`Relatório — ${DATASET_LABEL.absences}`, ABSENCES_PRINT_COLUMNS, absences.data ?? []);
    } else {
      printMultiReport('Relatório — Todos', [
        { heading: DATASET_LABEL.tasks, columns: TASKS_PRINT_COLUMNS, rows: tasks.data ?? [] },
        { heading: DATASET_LABEL.services, columns: SERVICES_PRINT_COLUMNS, rows: services.data ?? [] },
        { heading: DATASET_LABEL.absences, columns: ABSENCES_PRINT_COLUMNS, rows: absences.data ?? [] },
      ]);
    }
  }

  return (
    <div className="cp-fade" style={{ maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['tasks', 'services', 'absences', 'all'] as Dataset[]).map((d) => (
          <button
            key={d}
            onClick={() => changeDataset(d)}
            style={{
              padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: dataset === d ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'var(--bg2)',
              color: dataset === d ? '#fff' : 'var(--tx2)',
              border: dataset === d ? 'none' : '1px solid var(--line)',
            }}
          >
            {DATASET_LABEL[d]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>De</span>
          <DatePicker value={from} onChange={(v) => setFrom(v)} />
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>até</span>
          <DatePicker value={to} onChange={(v) => setTo(v)} />
        </div>
        {canSeeRoster && dataset !== 'absences' && <FilterChip label="Cliente" value={filterClient} options={clientOptions} onChange={setFilterClient} />}
        {canSeeRoster && dataset !== 'all' && <FilterChip label={personLabel} value={filterPerson} options={personOptions} onChange={setFilterPerson} />}
        {filterClient !== null && dataset !== 'absences' && <Chip label={`Cliente: ${clientName(filterClient)}`} onRemove={() => setFilterClient(null)} />}
        {filterPerson !== null && dataset !== 'all' && <Chip label={`${personLabel}: ${personName(filterPerson)}`} onRemove={() => setFilterPerson(null)} />}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={handlePrint} icon={printIcon}>Imprimir</Button>
          <Button variant="ghost" onClick={() => handleExport('pdf')} icon={pdfIcon}>{busy === 'export-pdf' ? '...' : 'PDF'}</Button>
          <Button variant="ghost" onClick={() => handleExport('excel')} icon={excelIcon}>{busy === 'export-excel' ? '...' : 'Excel'}</Button>
        </div>
      </div>

      {dataset === 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 700 }}>{DATASET_LABEL.tasks} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({tasks.data?.length ?? 0})</span></div>
            <TasksTable rows={tasks.data ?? []} loading={tasks.loading} />
          </Card>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 700 }}>{DATASET_LABEL.services} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({services.data?.length ?? 0})</span></div>
            <ServicesTable rows={services.data ?? []} loading={services.loading} />
          </Card>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 700 }}>{DATASET_LABEL.absences} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({absences.data?.length ?? 0})</span></div>
            <AbsencesTable rows={absences.data ?? []} loading={absences.loading} />
          </Card>
        </div>
      ) : (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--tx3)' }}>{rowCount} registro{rowCount === 1 ? '' : 's'} no filtro atual</div>
          {dataset === 'tasks' && <TasksTable rows={tasks.data ?? []} loading={loading} />}
          {dataset === 'services' && <ServicesTable rows={services.data ?? []} loading={loading} />}
          {dataset === 'absences' && <AbsencesTable rows={absences.data ?? []} loading={loading} />}
        </Card>
      )}
    </div>
  );
}
