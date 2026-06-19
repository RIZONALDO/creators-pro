import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import type { Creator, Collaborator, Client, NewClient, NewCreator, NewCollaborator } from '@/types';

type Tab = 'creators' | 'colabs' | 'clientes';

export function Cadastros() {
  const [tab, setTab] = useState<Tab>('creators');
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const colabs = useAsync<Collaborator[]>(() => api.collaborators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const professions = useAsync<string[]>(() => api.professions.list(), []);
  const [modal, setModal] = useState<null | Tab>(null);

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, gap: 2 }}>
          {([['creators', 'Creators'], ['colabs', 'Colaboradores'], ['clientes', 'Clientes']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 15px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === key ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent', color: tab === key ? '#fff' : 'var(--tx2)' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal(tab)}>
          {tab === 'creators' ? 'Novo creator' : tab === 'colabs' ? 'Novo colaborador' : 'Novo cliente'}
        </Button>
      </div>

      {tab === 'creators' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['CREATOR', 'VÍNCULO', 'STATUS']} />
          {(creators.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr">
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={c.name} size={34} seed={c.id} /><span style={{ fontWeight: 600 }}>{c.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
              <span><span style={{ fontSize: 11, fontWeight: 600, color: c.active ? '#22C55E' : '#65657C', background: c.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{c.active ? 'Ativo' : 'Inativo'}</span></span>
            </Row>
          ))}
        </Card>
      )}

      {tab === 'colabs' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['COLABORADOR', 'FUNÇÃO', 'VÍNCULO']} />
          {(colabs.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr">
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={c.name} size={34} seed={c.id} /><span style={{ fontWeight: 600 }}>{c.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{c.profession ?? '—'}</span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
            </Row>
          ))}
        </Card>
      )}

      {tab === 'clientes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {(clients.data ?? []).map((cl) => (
            <Card key={cl.id} pad={16} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(108,99,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--pri)' }}>{cl.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: cl.active ? '#22C55E' : '#65657C', background: cl.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{cl.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{cl.name}</div>
            </Card>
          ))}
        </div>
      )}

      {modal === 'clientes' && (
        <ClientModal professions={[]} onClose={() => setModal(null)}
          onCreate={async (d) => { const c = await api.clients.create(d); clients.setData((p) => [...(p ?? []), c]); setModal(null); }} />
      )}
      {modal === 'colabs' && (
        <CollaboratorModal professions={professions.data ?? []} onClose={() => setModal(null)}
          onAddProfession={async (name) => { await api.professions.create(name); professions.setData((prev) => [...(prev ?? []), name]); return name; }}
          onCreate={async (d) => { const c = await api.collaborators.create(d); colabs.setData((p) => [...(p ?? []), c]); setModal(null); }} />
      )}
      {modal === 'creators' && (
        <CreatorModal onClose={() => setModal(null)}
          onCreate={async (d) => { const c = await api.creators.create(d); creators.setData((p) => [...(p ?? []), c]); setModal(null); }} />
      )}
    </div>
  );
}

function Header({ cols, items }: { cols: string; items: string[] }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `${cols} 70px`, gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>{items.map((i) => <span key={i}>{i}</span>)}<span style={{ textAlign: 'right' }}>AÇÕES</span></div>;
}
function Row({ cols, children }: { cols: string; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `${cols} 70px`, gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>{children}<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></button></div></div>;
}

/* ----- Modais de cadastro ----- */
function CreatorModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: NewCreator) => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', employment_type: 'fixed' as const, active: true });
  return (
    <Modal open title="Novo creator" subtitle="users + creators" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => f.name && onCreate({ name: f.name, email: f.email || null, phone: f.phone || null, employment_type: f.employment_type, active: f.active })}>Salvar</Button></>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'fixed' })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Creator ativo</span>
      </label>
    </Modal>
  );
}

function CollaboratorModal({ professions, onClose, onCreate, onAddProfession }: { professions: string[]; onClose: () => void; onCreate: (d: NewCollaborator) => void; onAddProfession: (name: string) => Promise<string> }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', profession: professions[0] ?? '', employment_type: 'freelancer' as const, active: true });
  const [newProf, setNewProf] = useState('');
  return (
    <Modal open title="Novo colaborador" subtitle="users + collaborators" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => f.name && f.profession && onCreate({ name: f.name, email: f.email || null, phone: f.phone || null, profession: f.profession, employment_type: f.employment_type, active: f.active })}>Salvar</Button></>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Profissão (collaborators.profession)">
        <Select value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })}>{professions.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <TextInput value={newProf} onChange={(e) => setNewProf(e.target.value)} placeholder="Cadastrar nova profissão…" style={{ flex: 1 }} />
          <Button variant="soft" onClick={async () => { if (newProf.trim()) { const name = await onAddProfession(newProf.trim()); setF((x) => ({ ...x, profession: name })); setNewProf(''); } }}>Adicionar</Button>
        </div>
      </Field>
      <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'freelancer' })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
    </Modal>
  );
}

function ClientModal({ onClose, onCreate }: { professions: never[]; onClose: () => void; onCreate: (d: NewClient) => void }) {
  const [f, setF] = useState<NewClient>({ name: '', active: true });
  return (
    <Modal open title="Novo cliente" subtitle="tabela clients" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => f.name.trim() && onCreate(f)}>Salvar</Button></>}>
      <Field label="Nome do cliente"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Governo do Amapá" /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Cliente ativo</span>
      </label>
    </Modal>
  );
}
