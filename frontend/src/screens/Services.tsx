import { useState } from 'react';
import { Add, Calendar } from 'grommet-icons';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill, Tag, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import { ViewToggle, type ViewKind } from '@/components/ViewToggle';
import { DatePicker } from '@/components/DatePicker';
import { Skeleton } from '@/components/Skeleton';
import { AttachmentUpload } from '@/components/AttachmentUpload';
import { SERVICE_STATUS_META, SERVICE_TYPE_LABEL, SERVICE_TYPE_COLOR, shortDate } from '@/lib/display';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useCan } from '@/lib/permissions';
import type { ServiceRow, Collaborator, Client, ServiceStatus, NewService } from '@/types';

const TYPES = ['drone', 'foto', 'edicao', 'sonora', 'outros'];
const STATUSES: ServiceStatus[] = ['agendado', 'em_andamento', 'concluido', 'cancelado'];

export function Services() {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCan('services');
  const services = useAsync<ServiceRow[]>(() => api.services.list(), []);
  // GET /collaborators e /clients são bloqueados pro operacional (nem leitura) — fallback abaixo.
  const colabs = useAsync<Collaborator[]>(() => (canManage ? api.collaborators.list() : Promise.resolve([])), []);
  const clients = useAsync<Client[]>(() => (canManage ? api.clients.list() : Promise.resolve([])), []);
  const [modal, setModal] = useState<'new' | ServiceRow | null>(null);
  const [view, setView] = useState<ViewKind>('tabela');

  const list = services.data ?? [];
  const colName = (id: string | null) => colabs.data?.find((c) => c.id === id)?.name ?? 'A designar';
  const cliName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? '—';

  async function handleSave(data: NewService) {
    const isNew = modal === 'new';
    if (modal !== 'new' && modal) {
      let updated = await api.services.update(modal.id, data);
      // PUT ignora status de propósito — só PATCH .../status grava de fato (e registra status_history).
      // cast seguro: data.status sempre vem do <Select> de ServiceModal, que só oferece os 4 valores válidos.
      if (data.status !== modal.status) updated = await api.services.setStatus(modal.id, data.status as ServiceStatus);
      services.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api.services.create(data, user!.id);
      services.setData((p) => [created, ...(p ?? [])]);
    }
    setModal(null);
    toast.success(isNew ? 'Serviço criado' : 'Serviço atualizado', `"${data.service_name}" foi salvo.`);
  }

  async function handleDelete(service: ServiceRow) {
    if (!(await confirm({ title: 'Excluir serviço', description: `Excluir o serviço "${service.service_name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.services.remove(service.id);
      services.setData((p) => (p ?? []).filter((x) => x.id !== service.id));
      setModal(null);
      toast.success('Serviço excluído', `"${service.service_name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <ViewToggle value={view} onChange={setView} />
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--tx3)' }}>{list.length} serviços</span>
        {canManage && (
          <Button icon={<Add color="currentColor" size="small" />} onClick={() => setModal('new')}>Novo serviço</Button>
        )}
      </div>

      {services.loading && (
        <Card pad={18}><Skeleton rows={5} /></Card>
      )}

      {!services.loading && view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {list.map((s) => (
            <Card key={s.id} pad={16} onClick={canManage ? () => setModal(s) : undefined} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', cursor: canManage ? 'pointer' : 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <Tag label={SERVICE_TYPE_LABEL[s.service_type ?? 'outros'] ?? s.service_type ?? ''} color={SERVICE_TYPE_COLOR[s.service_type ?? 'outros'] ?? SERVICE_TYPE_COLOR.outros} />
                <span style={{ marginLeft: 'auto' }}><StatusPill meta={SERVICE_STATUS_META[s.status] ?? SERVICE_STATUS_META.agendado} /></span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 14 }}>{s.service_name}</div>
              <div style={{ height: 1, background: 'var(--line)', marginBottom: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar name={colName(s.collaborator_id)} size={26} seed={s.collaborator_id ?? ''} />
                <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{colName(s.collaborator_id)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx3)' }}>
                <span>{cliName(s.client_id)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar color="currentColor" size="small" />
                  {shortDate(s.service_date)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!services.loading && view === 'tabela' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.4fr 1.4fr 1.2fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
            <span>SERVIÇO</span><span>TIPO</span><span>COLABORADOR</span><span>CLIENTE</span><span>STATUS</span><span>DATA</span>
          </div>
          {list.map((s) => (
            <div key={s.id} onClick={canManage ? () => setModal(s) : undefined} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.4fr 1.4fr 1.2fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: canManage ? 'pointer' : 'default' }}>
              <span style={{ fontWeight: 600 }}>{s.service_name}</span>
              <span><Tag label={SERVICE_TYPE_LABEL[s.service_type ?? 'outros'] ?? s.service_type ?? ''} color={SERVICE_TYPE_COLOR[s.service_type ?? 'outros'] ?? SERVICE_TYPE_COLOR.outros} /></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={colName(s.collaborator_id)} size={22} seed={s.collaborator_id ?? ''} /><span style={{ color: 'var(--tx2)' }}>{colName(s.collaborator_id)}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{cliName(s.client_id)}</span>
              <span><StatusPill meta={SERVICE_STATUS_META[s.status] ?? SERVICE_STATUS_META.agendado} /></span>
              <span style={{ color: 'var(--tx3)' }}>{shortDate(s.service_date)}</span>
            </div>
          ))}
        </Card>
      )}

      {!services.loading && view === 'timeline' && (
        <Card pad={0} style={{ padding: '8px 22px' }}>
          {Object.entries(list.reduce<Record<string, ServiceRow[]>>((acc, s) => { const k = s.service_date ?? '—'; (acc[k] = acc[k] || []).push(s); return acc; }, {}))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, group], gi, arr) => (
              <div key={date} style={{ display: 'flex', gap: 18, padding: '16px 0', borderBottom: gi === arr.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 74, flex: 'none', textAlign: 'right', paddingTop: 2 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", lineHeight: 1 }}>{shortDate(date).split(' ')[0]}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 600 }}>{shortDate(date).split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, borderLeft: '2px solid var(--line)', paddingLeft: 18 }}>
                  {group.map((s) => (
                    <div key={s.id} onClick={canManage ? () => setModal(s) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 14px', cursor: canManage ? 'pointer' : 'default' }}>
                      <Tag label={SERVICE_TYPE_LABEL[s.service_type ?? 'outros'] ?? s.service_type ?? ''} color={SERVICE_TYPE_COLOR[s.service_type ?? 'outros'] ?? SERVICE_TYPE_COLOR.outros} />
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.service_name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{cliName(s.client_id)}</span>
                      <Avatar name={colName(s.collaborator_id)} size={24} seed={s.collaborator_id ?? ''} />
                      <StatusPill meta={SERVICE_STATUS_META[s.status] ?? SERVICE_STATUS_META.agendado} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </Card>
      )}

      {modal && (
        <ServiceModal key={modal === 'new' ? 'new' : modal.id} service={modal !== 'new' ? modal : null}
          colabs={colabs.data ?? []} clients={clients.data ?? []} onClose={() => setModal(null)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}

function ServiceModal({ service, colabs, clients, onClose, onSave, onDelete }: {
  service: ServiceRow | null; colabs: Collaborator[]; clients: Client[]; onClose: () => void;
  onSave: (d: NewService) => void; onDelete: (s: ServiceRow) => void;
}) {
  const [f, setF] = useState<NewService>(service
    ? { service_name: service.service_name, service_type: service.service_type, collaborator_id: service.collaborator_id, client_id: service.client_id, service_date: service.service_date, status: service.status, notes: service.notes }
    : { service_name: '', service_type: 'drone', collaborator_id: colabs[0]?.id ?? null, client_id: clients[0]?.id ?? null, service_date: '2026-06-23', status: 'agendado', notes: null });
  const set = (k: keyof NewService, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open title={service ? 'Editar serviço' : 'Novo serviço'} subtitle="tabela collaborator_services" onClose={onClose}
      footer={<>
        {service && <Button variant="ghost" onClick={() => onDelete(service)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => f.service_name.trim() && onSave(f)}>{service ? 'Salvar' : 'Criar serviço'}</Button>
      </>}>
      <Field label="Nome do serviço"><TextInput value={f.service_name} onChange={(e) => set('service_name', e.target.value)} placeholder="Ex.: Captação aérea — orla" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Tipo"><Select value={f.service_type ?? 'drone'} onChange={(e) => set('service_type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>)}</Select></Field>
        <Field label="Data"><DatePicker value={f.service_date} onChange={(v) => set('service_date', v)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Colaborador"><Select value={f.collaborator_id ?? ''} onChange={(e) => set('collaborator_id', e.target.value || null)}><option value="">A designar</option>{colabs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Cliente"><Select value={f.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <Field label="Status"><Select value={f.status} onChange={(e) => set('status', e.target.value as ServiceStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{SERVICE_STATUS_META[s].label}</option>)}</Select></Field>
      <Field label="Observações"><TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} /></Field>
      {service && <Field label="Anexos"><AttachmentUpload entityType="service" entityId={service.id} /></Field>}
    </Modal>
  );
}
