import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import type { Creator, Collaborator, Client, NewClient, NewCreator, NewCollaborator } from '@/types';

type Tab = 'creators' | 'colabs' | 'clientes';

// password opcional aqui (vs. NewCreator/NewCollaborator, onde é obrigatório) — em edição, vazio
// significa "manter a senha atual"; o próprio modal garante que vem preenchido ao criar.
type CreatorFormData = Omit<NewCreator, 'password'> & { password?: string };
type CollaboratorFormData = Omit<NewCollaborator, 'password'> & { password?: string };

export function Cadastros() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('creators');
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const colabs = useAsync<Collaborator[]>(() => api.collaborators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const professions = useAsync<string[]>(() => api.professions.list(), []);
  const [modal, setModal] = useState<null | 'new' | Creator | Collaborator | Client>(null);

  async function handleSaveCreator(data: CreatorFormData) {
    const isNew = modal === 'new';
    if (modal !== 'new' && modal) {
      const updated = await api.creators.update(modal.id, data);
      creators.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
    } else {
      // password garantido não-vazio pelo próprio CreatorModal antes de chamar onSave.
      const created = await api.creators.create(data as NewCreator);
      creators.setData((p) => [...(p ?? []), created]);
    }
    setModal(null);
    toast.success(isNew ? 'Creator criado' : 'Creator atualizado', `"${data.name}" foi salvo.`);
  }

  async function handleDeleteCreator(c: Creator) {
    if (!(await confirm({ title: 'Excluir creator', description: `Excluir o creator "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.creators.remove(c.id);
      creators.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setModal(null);
      toast.success('Creator excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleSaveCollaborator(data: CollaboratorFormData) {
    const isNew = modal === 'new';
    if (modal !== 'new' && modal) {
      const updated = await api.collaborators.update(modal.id, data);
      colabs.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
    } else {
      // password garantido não-vazio pelo próprio CollaboratorModal antes de chamar onSave.
      const created = await api.collaborators.create(data as NewCollaborator);
      colabs.setData((p) => [...(p ?? []), created]);
    }
    setModal(null);
    toast.success(isNew ? 'Colaborador criado' : 'Colaborador atualizado', `"${data.name}" foi salvo.`);
  }

  async function handleDeleteCollaborator(c: Collaborator) {
    if (!(await confirm({ title: 'Excluir colaborador', description: `Excluir o colaborador "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.collaborators.remove(c.id);
      colabs.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setModal(null);
      toast.success('Colaborador excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleSaveClient(data: NewClient) {
    const isNew = modal === 'new';
    if (modal !== 'new' && modal) {
      const updated = await api.clients.update(modal.id, data);
      clients.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api.clients.create(data);
      clients.setData((p) => [...(p ?? []), created]);
    }
    setModal(null);
    toast.success(isNew ? 'Cliente criado' : 'Cliente atualizado', `"${data.name}" foi salvo.`);
  }

  async function handleDeleteClient(c: Client) {
    if (!(await confirm({ title: 'Excluir cliente', description: `Excluir o cliente "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.clients.remove(c.id);
      clients.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setModal(null);
      toast.success('Cliente excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, gap: 2 }}>
          {([['creators', 'Creators'], ['colabs', 'Colaboradores'], ['clientes', 'Clientes']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 15px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === key ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent', color: tab === key ? '#fff' : 'var(--tx2)' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal('new')}>
          {tab === 'creators' ? 'Novo creator' : tab === 'colabs' ? 'Novo colaborador' : 'Novo cliente'}
        </Button>
      </div>

      {tab === 'creators' && creators.loading && (
        <Card pad={18}><Skeleton rows={5} /></Card>
      )}

      {tab === 'creators' && !creators.loading && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['CREATOR', 'VÍNCULO', 'STATUS']} />
          {(creators.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr" onClick={() => setModal(c)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={c.name} size={34} seed={c.id} /><span style={{ fontWeight: 600 }}>{c.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
              <span><span style={{ fontSize: 11, fontWeight: 600, color: c.active ? '#22C55E' : '#65657C', background: c.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{c.active ? 'Ativo' : 'Inativo'}</span></span>
            </Row>
          ))}
        </Card>
      )}

      {tab === 'colabs' && colabs.loading && (
        <Card pad={18}><Skeleton rows={5} /></Card>
      )}

      {tab === 'colabs' && !colabs.loading && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['COLABORADOR', 'FUNÇÃO', 'VÍNCULO']} />
          {(colabs.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr" onClick={() => setModal(c)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={c.name} size={34} seed={c.id} /><span style={{ fontWeight: 600 }}>{c.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{c.profession ?? '—'}</span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
            </Row>
          ))}
        </Card>
      )}

      {tab === 'clientes' && clients.loading && (
        <Card pad={18}><Skeleton rows={5} /></Card>
      )}

      {tab === 'clientes' && !clients.loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {(clients.data ?? []).map((cl) => (
            <Card key={cl.id} pad={16} onClick={() => setModal(cl)} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(108,99,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--pri)' }}>{cl.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: cl.active ? '#22C55E' : '#65657C', background: cl.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{cl.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{cl.name}</div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'clientes' && modal && (
        <ClientModal client={modal !== 'new' ? (modal as Client) : null} onClose={() => setModal(null)} onSave={handleSaveClient} onDelete={handleDeleteClient} />
      )}
      {tab === 'colabs' && modal && (
        <CollaboratorModal collaborator={modal !== 'new' ? (modal as Collaborator) : null} professions={professions.data ?? []} onClose={() => setModal(null)}
          onAddProfession={async (name) => { await api.professions.create(name); professions.setData((prev) => [...(prev ?? []), name]); return name; }}
          onSave={handleSaveCollaborator} onDelete={handleDeleteCollaborator} />
      )}
      {tab === 'creators' && modal && (
        <CreatorModal creator={modal !== 'new' ? (modal as Creator) : null} onClose={() => setModal(null)} onSave={handleSaveCreator} onDelete={handleDeleteCreator} />
      )}
    </div>
  );
}

function Header({ cols, items }: { cols: string; items: string[] }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>{items.map((i) => <span key={i}>{i}</span>)}</div>;
}
function Row({ cols, children, onClick }: { cols: string; children: React.ReactNode; onClick: () => void }) {
  return <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>{children}</div>;
}

/* ----- Modais de cadastro (criação + edição) ----- */
function CreatorModal({ creator, onClose, onSave, onDelete }: { creator: Creator | null; onClose: () => void; onSave: (d: CreatorFormData) => void; onDelete: (c: Creator) => void }) {
  const [f, setF] = useState(creator
    ? { name: creator.name, email: creator.email ?? '', phone: creator.phone ?? '', employment_type: creator.employment_type ?? 'fixed', active: creator.active, password: '' }
    : { name: '', email: '', phone: '', employment_type: 'fixed' as const, active: true, password: '' });
  const canSubmit = f.name && (creator ? f.password.length === 0 || f.password.length >= 8 : f.password.length >= 8);
  return (
    <Modal open title={creator ? 'Editar creator' : 'Novo creator'} subtitle="users + creators" onClose={onClose} footer={<>
      {creator && <Button variant="ghost" onClick={() => onDelete(creator)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => canSubmit && onSave({ name: f.name, email: f.email || null, phone: f.phone || null, employment_type: f.employment_type, active: f.active, ...(f.password ? { password: f.password } : {}) })}>Salvar</Button>
    </>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'fixed' | 'freelancer' })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
      <Field label={creator ? 'Nova senha (deixe em branco para manter)' : 'Senha de acesso'}>
        <TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Creator ativo</span>
      </label>
    </Modal>
  );
}

function CollaboratorModal({ collaborator, professions, onClose, onSave, onDelete, onAddProfession }: {
  collaborator: Collaborator | null; professions: string[]; onClose: () => void; onSave: (d: CollaboratorFormData) => void; onDelete: (c: Collaborator) => void; onAddProfession: (name: string) => Promise<string>;
}) {
  const [f, setF] = useState(collaborator
    ? { name: collaborator.name, email: collaborator.email ?? '', phone: collaborator.phone ?? '', profession: collaborator.profession ?? professions[0] ?? '', employment_type: collaborator.employment_type ?? 'freelancer', active: collaborator.active, password: '' }
    : { name: '', email: '', phone: '', profession: professions[0] ?? '', employment_type: 'freelancer' as const, active: true, password: '' });
  const [newProf, setNewProf] = useState('');
  const canSubmit = f.name && f.profession && (collaborator ? f.password.length === 0 || f.password.length >= 8 : f.password.length >= 8);
  return (
    <Modal open title={collaborator ? 'Editar colaborador' : 'Novo colaborador'} subtitle="users + collaborators" onClose={onClose} footer={<>
      {collaborator && <Button variant="ghost" onClick={() => onDelete(collaborator)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => canSubmit && onSave({ name: f.name, email: f.email || null, phone: f.phone || null, profession: f.profession, employment_type: f.employment_type, active: f.active, ...(f.password ? { password: f.password } : {}) })}>Salvar</Button>
    </>}>
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
      <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'fixed' | 'freelancer' })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
      <Field label={collaborator ? 'Nova senha (deixe em branco para manter)' : 'Senha de acesso'}>
        <TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
      </Field>
    </Modal>
  );
}

function ClientModal({ client, onClose, onSave, onDelete }: { client: Client | null; onClose: () => void; onSave: (d: NewClient) => void; onDelete: (c: Client) => void }) {
  const [f, setF] = useState<NewClient>(client ? { name: client.name, active: client.active } : { name: '', active: true });
  return (
    <Modal open title={client ? 'Editar cliente' : 'Novo cliente'} subtitle="tabela clients" onClose={onClose} footer={<>
      {client && <Button variant="ghost" onClick={() => onDelete(client)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => f.name.trim() && onSave(f)}>Salvar</Button>
    </>}>
      <Field label="Nome do cliente"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Governo do Amapá" /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Cliente ativo</span>
      </label>
    </Modal>
  );
}
