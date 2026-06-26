import { useState } from 'react';
import { Add, Trash } from 'grommet-icons';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button } from '@/components/ui';
import { Modal, Field, TextInput, Select } from '@/components/Modal';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import type { Creator, Collaborator, Client, NewClient, NewCreator, NewCollaborator, Profession } from '@/types';

type Tab = 'creators' | 'colabs' | 'profissoes' | 'clientes';

type CreatorFormData = Omit<NewCreator, 'password'> & { password?: string };

export function Cadastros() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('creators');
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const colabs = useAsync<Collaborator[]>(() => api.collaborators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const professions = useAsync<Profession[]>(() => api.professions.list(), []);
  const [creatorModal, setCreatorModal] = useState<null | 'new' | Creator>(null);
  const [colabModal, setColabModal] = useState<null | 'new' | Collaborator>(null);
  const [profModal, setProfModal] = useState<null | 'new'>(null);
  const [clientModal, setClientModal] = useState<null | 'new' | Client>(null);
  const [inviteLink, setInviteLink] = useState<{ name: string; link: string } | null>(null);

  /* ----- creators ----- */
  async function handleSaveCreator(data: CreatorFormData) {
    const isNew = creatorModal === 'new';
    try {
      let savedName: string;
      if (creatorModal !== 'new' && creatorModal) {
        const updated = await api.creators.update(creatorModal.id, data);
        creators.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
        savedName = updated.name;
      } else {
        const created = await api.creators.create(data as NewCreator);
        creators.setData((p) => [...(p ?? []), created]);
        savedName = created.name;
        if (created.invite_token) setInviteLink({ name: savedName, link: `${window.location.origin}/convite/${created.invite_token}` });
      }
      setCreatorModal(null);
      toast.success(isNew ? 'Creator criado' : 'Creator atualizado', `"${savedName}" foi salvo.`);
    } catch (err) {
      toast.error(isNew ? 'Não foi possível criar creator' : 'Não foi possível atualizar creator', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDeleteCreator(c: Creator) {
    if (!(await confirm({ title: 'Excluir creator', description: `Excluir o creator "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.creators.remove(c.id);
      creators.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setCreatorModal(null);
      toast.success('Creator excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleRegenerateCreatorInvite(c: Creator) {
    try {
      const { invite_token } = await api.creators.regenerateInvite(c.id);
      setCreatorModal(null);
      setInviteLink({ name: c.name, link: `${window.location.origin}/convite/${invite_token}` });
    } catch (err) {
      toast.error('Não foi possível gerar o link', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  /* ----- collaborators ----- */
  async function handleSaveColab(data: NewCollaborator) {
    const isNew = colabModal === 'new';
    try {
      if (colabModal !== 'new' && colabModal) {
        const updated = await api.collaborators.update(colabModal.id, data);
        colabs.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
        toast.success('Colaborador atualizado', `"${updated.name}" foi salvo.`);
      } else {
        const created = await api.collaborators.create(data);
        colabs.setData((p) => [...(p ?? []), created]);
        toast.success('Colaborador criado', `"${created.name}" foi adicionado.`);
      }
      setColabModal(null);
    } catch (err) {
      toast.error(isNew ? 'Não foi possível criar colaborador' : 'Não foi possível atualizar colaborador', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDeleteColab(c: Collaborator) {
    if (!(await confirm({ title: 'Excluir colaborador', description: `Excluir "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.collaborators.remove(c.id);
      colabs.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setColabModal(null);
      toast.success('Colaborador excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  /* ----- professions ----- */
  async function handleCreateProfession(name: string) {
    try {
      const prof = await api.professions.create(name);
      professions.setData((p) => [...(p ?? []), prof]);
      setProfModal(null);
      toast.success('Profissão criada', `"${prof.name}" foi adicionada.`);
    } catch (err) {
      toast.error('Não foi possível criar profissão', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDeleteProfession(p: Profession) {
    if (!(await confirm({ title: 'Excluir profissão', description: `Excluir a profissão "${p.name}"?` }))) return;
    try {
      await api.professions.remove(p.id);
      professions.setData((prev) => (prev ?? []).filter((x) => x.id !== p.id));
      toast.success('Profissão excluída');
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  /* ----- clients ----- */
  async function handleSaveClient(data: NewClient) {
    const isNew = clientModal === 'new';
    try {
      if (clientModal !== 'new' && clientModal) {
        const updated = await api.clients.update(clientModal.id, data);
        clients.setData((p) => (p ?? []).map((x) => (x.id === updated.id ? updated : x)));
      } else {
        const created = await api.clients.create(data);
        clients.setData((p) => [...(p ?? []), created]);
      }
      setClientModal(null);
      toast.success(isNew ? 'Cliente criado' : 'Cliente atualizado', `"${data.name}" foi salvo.`);
    } catch (err) {
      toast.error(isNew ? 'Não foi possível criar cliente' : 'Não foi possível atualizar cliente', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDeleteClient(c: Client) {
    if (!(await confirm({ title: 'Excluir cliente', description: `Excluir o cliente "${c.name}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.clients.remove(c.id);
      clients.setData((p) => (p ?? []).filter((x) => x.id !== c.id));
      setClientModal(null);
      toast.success('Cliente excluído', `"${c.name}" foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  const pendingCreator = creatorModal && creatorModal !== 'new' && (creatorModal as Creator).status === 'pending' ? (creatorModal as Creator) : null;

  return (
    <div className="cp-fade">
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, gap: 2 }}>
          {([['creators', 'Creators'], ['colabs', 'Colaboradores'], ['profissoes', 'Profissões'], ['clientes', 'Clientes']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 15px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === key ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent', color: tab === key ? '#fff' : 'var(--tx2)' }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {tab === 'creators' && <Button icon={<Add color="currentColor" size="small" />} onClick={() => setCreatorModal('new')}>Novo creator</Button>}
        {tab === 'colabs' && <Button icon={<Add color="currentColor" size="small" />} onClick={() => setColabModal('new')}>Novo colaborador</Button>}
        {tab === 'profissoes' && <Button icon={<Add color="currentColor" size="small" />} onClick={() => setProfModal('new')}>Nova profissão</Button>}
        {tab === 'clientes' && <Button icon={<Add color="currentColor" size="small" />} onClick={() => setClientModal('new')}>Novo cliente</Button>}
      </div>

      {/* CREATORS */}
      {tab === 'creators' && creators.loading && <Card pad={18}><Skeleton rows={5} /></Card>}
      {tab === 'creators' && !creators.loading && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['CREATOR', 'VÍNCULO', 'STATUS']} />
          {(creators.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr" onClick={() => setCreatorModal(c)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar name={c.name} size={34} seed={c.id} imageUrl={c.avatar_url} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {c.status === 'pending' && <PendingBadge />}
              </span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
              <span>
                {c.status === 'pending'
                  ? <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706', background: 'rgba(245,158,11,.14)', padding: '3px 9px', borderRadius: 7 }}>Pendente</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, color: c.active ? '#22C55E' : '#65657C', background: c.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{c.active ? 'Ativo' : 'Inativo'}</span>}
              </span>
            </Row>
          ))}
        </Card>
      )}

      {/* COLABORADORES */}
      {tab === 'colabs' && colabs.loading && <Card pad={18}><Skeleton rows={5} /></Card>}
      {tab === 'colabs' && !colabs.loading && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Header cols="2fr 1.3fr 1.2fr" items={['COLABORADOR', 'PROFISSÃO', 'VÍNCULO']} />
          {(colabs.data ?? []).length === 0 && (
            <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--tx3)' }}>Nenhum colaborador cadastrado ainda.</div>
          )}
          {(colabs.data ?? []).map((c) => (
            <Row key={c.id} cols="2fr 1.3fr 1.2fr" onClick={() => setColabModal(c)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar name={c.name} size={34} seed={c.id} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {!c.active && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--tx3)', background: 'rgba(101,101,124,.14)', padding: '2px 7px', borderRadius: 6 }}>Inativo</span>}
              </span>
              <span style={{ color: 'var(--tx2)' }}>{c.profession ?? '—'}</span>
              <span style={{ color: 'var(--tx2)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</span>
            </Row>
          ))}
        </Card>
      )}

      {/* PROFISSÕES */}
      {tab === 'profissoes' && professions.loading && <Card pad={18}><Skeleton rows={5} /></Card>}
      {tab === 'profissoes' && !professions.loading && (
        <Card pad={0} style={{ overflow: 'hidden', maxWidth: 480 }}>
          {(professions.data ?? []).length === 0 && (
            <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--tx3)' }}>Nenhuma profissão cadastrada ainda.</div>
          )}
          {(professions.data ?? []).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <button onClick={() => handleDeleteProfession(p)} title="Excluir" style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 4, borderRadius: 6 }}>
                <Trash color="currentColor" size="small" />
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* CLIENTES */}
      {tab === 'clientes' && clients.loading && <Card pad={18}><Skeleton rows={5} /></Card>}
      {tab === 'clientes' && !clients.loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {(clients.data ?? []).map((cl) => (
            <Card key={cl.id} pad={16} onClick={() => setClientModal(cl)} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(108,99,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--pri)' }}>{cl.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: cl.active ? '#22C55E' : '#65657C', background: cl.active ? 'rgba(34,197,94,.16)' : 'rgba(101,101,124,.14)', padding: '3px 9px', borderRadius: 7 }}>{cl.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{cl.name}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Modais */}
      {clientModal && (
        <ClientModal client={clientModal !== 'new' ? (clientModal as Client) : null} onClose={() => setClientModal(null)} onSave={handleSaveClient} onDelete={handleDeleteClient} />
      )}
      {colabModal && (
        <CollaboratorModal
          collaborator={colabModal !== 'new' ? (colabModal as Collaborator) : null}
          professions={professions.data ?? []}
          onClose={() => setColabModal(null)}
          onSave={handleSaveColab}
          onDelete={handleDeleteColab}
        />
      )}
      {profModal && (
        <ProfessionModal onClose={() => setProfModal(null)} onCreate={handleCreateProfession} />
      )}
      {pendingCreator && (
        <PendingInviteModal name={pendingCreator.name} email={pendingCreator.email} onClose={() => setCreatorModal(null)}
          onDelete={() => handleDeleteCreator(pendingCreator)} onRegenerateInvite={() => handleRegenerateCreatorInvite(pendingCreator)} />
      )}
      {tab === 'creators' && creatorModal && !pendingCreator && (
        <CreatorModal creator={creatorModal !== 'new' ? (creatorModal as Creator) : null} onClose={() => setCreatorModal(null)} onSave={handleSaveCreator} onDelete={handleDeleteCreator} />
      )}
      {inviteLink && <InviteLinkModal name={inviteLink.name} link={inviteLink.link} onClose={() => setInviteLink(null)} />}
    </div>
  );
}

function Header({ cols, items }: { cols: string; items: string[] }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>{items.map((i) => <span key={i}>{i}</span>)}</div>;
}
function Row({ cols, children, onClick }: { cols: string; children: React.ReactNode; onClick: () => void }) {
  return <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>{children}</div>;
}
function PendingBadge() {
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,158,11,.14)', padding: '2px 7px', borderRadius: 6, flex: 'none' }}>Convite pendente</span>;
}

function PendingInviteModal({ name, email, onClose, onDelete, onRegenerateInvite }: { name: string; email: string | null; onClose: () => void; onDelete: () => void; onRegenerateInvite: () => void }) {
  return (
    <Modal open title="Convite pendente" subtitle={email ?? undefined} onClose={onClose} footer={<>
      <Button variant="ghost" onClick={onDelete} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>
      <Button variant="ghost" onClick={onClose}>Fechar</Button>
      <Button onClick={onRegenerateInvite}>Gerar novo link</Button>
    </>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PendingBadge />
        <span style={{ fontWeight: 600 }}>{name}</span>
      </div>
    </Modal>
  );
}

function InviteLinkModal({ name, link, onClose }: { name: string; link: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open title="Convite criado" subtitle={`Envie esse link pra ${name} ativar o acesso`} onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
      <Field label="Link de convite">
        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput value={link} readOnly onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
          <Button variant="soft" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado'); }}>Copiar</Button>
        </div>
      </Field>
    </Modal>
  );
}

function CreatorModal({ creator, onClose, onSave, onDelete }: { creator: Creator | null; onClose: () => void; onSave: (d: CreatorFormData) => void; onDelete: (c: Creator) => void }) {
  const isNew = !creator;
  const [f, setF] = useState(creator
    ? { name: creator.name, email: creator.email ?? '', phone: creator.phone ?? '', employment_type: creator.employment_type ?? 'fixed', active: creator.active, password: '' }
    : { name: '', email: '', phone: '', employment_type: 'fixed' as const, active: true, password: '' });
  const passwordOk = f.password.length === 0 || f.password.length >= 8;
  const canSubmit = f.email.trim().length > 0 && passwordOk;
  return (
    <Modal open title={creator ? 'Editar creator' : 'Novo creator'} onClose={onClose} footer={<>
      {creator && <Button variant="ghost" onClick={() => onDelete(creator)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => canSubmit && onSave({
        ...(f.name.trim() ? { name: f.name.trim() } : {}),
        email: f.email || null, phone: f.phone || null, employment_type: f.employment_type, active: f.active,
        ...(f.password ? { password: f.password } : {}),
      })}>Salvar</Button>
    </>}>
      {isNew ? (
        <Field label="E-mail"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="email@exemplo.com" autoFocus /></Field>
      ) : (
        <>
          <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="E-mail"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'fixed' | 'freelancer' })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
          <Field label="Nova senha (deixe em branco para manter)">
            <TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Creator ativo</span>
          </label>
        </>
      )}
    </Modal>
  );
}

function CollaboratorModal({ collaborator, professions, onClose, onSave, onDelete }: {
  collaborator: Collaborator | null;
  professions: Profession[];
  onClose: () => void;
  onSave: (d: NewCollaborator) => void;
  onDelete: (c: Collaborator) => void;
}) {
  const isNew = !collaborator;
  const firstProf = professions[0]?.name ?? '';
  const [f, setF] = useState<{ name: string; email: string; phone: string; profession: string; employment_type: 'fixed' | 'freelancer'; active: boolean }>(
    collaborator
      ? { name: collaborator.name, email: collaborator.email ?? '', phone: collaborator.phone ?? '', profession: collaborator.profession ?? firstProf, employment_type: collaborator.employment_type ?? 'freelancer', active: collaborator.active }
      : { name: '', email: '', phone: '', profession: firstProf, employment_type: 'freelancer', active: true },
  );
  const canSubmit = f.name.trim().length > 0 && f.profession.trim().length > 0;
  return (
    <Modal open title={collaborator ? 'Editar colaborador' : 'Novo colaborador'} onClose={onClose} footer={<>
      {collaborator && <Button variant="ghost" onClick={() => onDelete(collaborator)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => canSubmit && onSave({ name: f.name.trim(), email: f.email || null, phone: f.phone || null, profession: f.profession, employment_type: f.employment_type, active: f.active })}>Salvar</Button>
    </>}>
      <Field label="Nome completo">
        <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: João Silva" autoFocus={isNew} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail (contato)"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="opcional" /></Field>
        <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="opcional" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Profissão">
          <Select value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })}>
            {professions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            {!professions.find((p) => p.name === f.profession) && f.profession && (
              <option value={f.profession}>{f.profession}</option>
            )}
          </Select>
        </Field>
        <Field label="Tipo de vínculo">
          <Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as 'fixed' | 'freelancer' })}>
            <option value="fixed">Fixo</option>
            <option value="freelancer">Freelancer</option>
          </Select>
        </Field>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Colaborador ativo</span>
      </label>
    </Modal>
  );
}

function ProfessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Modal open title="Nova profissão" onClose={onClose} footer={<>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => name.trim() && onCreate(name.trim())}>Criar</Button>
    </>}>
      <Field label="Nome da profissão">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Videógrafo" autoFocus onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim())} />
      </Field>
    </Modal>
  );
}

function ClientModal({ client, onClose, onSave, onDelete }: { client: Client | null; onClose: () => void; onSave: (d: NewClient) => void; onDelete: (c: Client) => void }) {
  const [f, setF] = useState<NewClient>(client ? { name: client.name, active: client.active } : { name: '', active: true });
  return (
    <Modal open title={client ? 'Editar cliente' : 'Novo cliente'} onClose={onClose} footer={<>
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
