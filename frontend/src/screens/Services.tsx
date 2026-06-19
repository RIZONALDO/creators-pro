import { useState } from 'react';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import { SERVICE_STATUS_META, SERVICE_TYPE_LABEL, shortDate } from '@/lib/display';
import type { ServiceRow, Collaborator, Client, ServiceStatus, NewService } from '@/types';

const TYPES = ['drone', 'foto', 'edicao', 'sonora', 'outros'];
const STATUSES: ServiceStatus[] = ['agendado', 'em_andamento', 'concluido', 'cancelado'];

export function Services() {
  const { user } = useApp();
  const services = useAsync<ServiceRow[]>(() => api.services.list(), []);
  const colabs = useAsync<Collaborator[]>(() => api.collaborators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const [modal, setModal] = useState(false);

  const colName = (id: string | null) => colabs.data?.find((c) => c.id === id)?.name ?? 'A designar';
  const cliName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? '—';

  async function create(data: NewService) {
    const s = await api.services.create(data, user!.id);
    services.setData((p) => [s, ...(p ?? [])]);
    setModal(false);
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{(services.data ?? []).length} serviços</span>
        <div style={{ marginLeft: 'auto' }}>
          <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal(true)}>Novo serviço</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {(services.data ?? []).map((s) => (
          <Card key={s.id} pad={17} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>{s.service_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 2 }}>{SERVICE_TYPE_LABEL[s.service_type ?? 'outros'] ?? s.service_type} · {shortDate(s.service_date)}</div>
              </div>
              <span style={{ marginLeft: 'auto' }}><StatusPill meta={SERVICE_STATUS_META[s.status] ?? SERVICE_STATUS_META.agendado} /></span>
            </div>
            <div style={{ height: 1, background: 'var(--line)', marginBottom: 13 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={colName(s.collaborator_id)} size={30} seed={s.collaborator_id ?? ''} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{colName(s.collaborator_id)}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{cliName(s.client_id)}</div></div>
            </div>
          </Card>
        ))}
      </div>

      {modal && <NewServiceModal colabs={colabs.data ?? []} clients={clients.data ?? []} onClose={() => setModal(false)} onCreate={create} />}
    </div>
  );
}

function NewServiceModal({ colabs, clients, onClose, onCreate }: { colabs: Collaborator[]; clients: Client[]; onClose: () => void; onCreate: (d: NewService) => void }) {
  const [f, setF] = useState<NewService>({ service_name: '', service_type: 'drone', collaborator_id: colabs[0]?.id ?? null, client_id: clients[0]?.id ?? null, service_date: '2026-06-23', status: 'agendado', notes: null });
  const set = (k: keyof NewService, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open title="Novo serviço" subtitle="tabela collaborator_services" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => f.service_name.trim() && onCreate(f)}>Criar serviço</Button></>}>
      <Field label="Nome do serviço"><TextInput value={f.service_name} onChange={(e) => set('service_name', e.target.value)} placeholder="Ex.: Captação aérea — orla" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Tipo"><Select value={f.service_type ?? 'drone'} onChange={(e) => set('service_type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>)}</Select></Field>
        <Field label="Data"><TextInput type="date" value={f.service_date ?? ''} onChange={(e) => set('service_date', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Colaborador"><Select value={f.collaborator_id ?? ''} onChange={(e) => set('collaborator_id', e.target.value || null)}><option value="">A designar</option>{colabs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Cliente"><Select value={f.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <Field label="Status"><Select value={f.status} onChange={(e) => set('status', e.target.value as ServiceStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{SERVICE_STATUS_META[s].label}</option>)}</Select></Field>
      <Field label="Observações"><TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} /></Field>
    </Modal>
  );
}
