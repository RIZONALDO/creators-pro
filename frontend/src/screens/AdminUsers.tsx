import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { useToast } from '@/context/ToastContext';
import { Avatar, Button } from '@/components/ui';
import { Modal, Field, TextInput, Select } from '@/components/Modal';
import { ROLE_META, roleLabel } from '@/lib/display';
import { useState } from 'react';
import type { User, NewUser, Creator, Collaborator, EmploymentType, UserStatus } from '@/types';

type Alias = 'admin' | 'gestor' | 'creator' | 'colaborador';

/** role='operacional' sozinho não distingue Creator de Colaborador — apelidos diferentes no
 * produto, mesma permissão por baixo. GET /users já devolve creator_id/collaborator_id pra isso. */
function aliasOf(u: User): Alias {
  if (u.role === 'admin') return 'admin';
  if (u.role === 'gestor') return 'gestor';
  return u.creator_id ? 'creator' : 'colaborador';
}

// Só cor do selo — o texto é sempre roleLabel(u) (alias/profissão real, nunca um rótulo fixo).
const ALIAS_BADGE_COLOR: Record<Alias, { color: string; bg: string }> = {
  admin: ROLE_META.admin,
  gestor: ROLE_META.gestor,
  creator: ROLE_META.operacional,
  colaborador: ROLE_META.operacional,
};

/** Tipo de acesso = a RBAC real (Admin/Gestor/Operacional). Diferente da Função/cargo (roleLabel),
 * que é texto livre opcional digitado pelo admin — nunca um sinônimo fixo do tipo de acesso. */
const ACCESS_TYPE_LABEL: Record<Alias, string> = {
  admin: 'Admin', gestor: 'Gestor', creator: 'Operacional', colaborador: 'Operacional',
};

interface EditTarget { user: User; alias: Alias; creatorRow?: Creator; collaboratorRow?: Collaborator }

export function AdminUsers() {
  const toast = useToast();
  const users = useAsync<User[]>(() => api.users.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const collaborators = useAsync<Collaborator[]>(() => api.collaborators.list(), []);
  const professions = useAsync<string[]>(() => api.professions.list(), []);
  const [newModal, setNewModal] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const list = users.data ?? [];

  const stats = {
    gestores: list.filter((u) => u.role === 'gestor').length,
    operacionais: list.filter((u) => u.role === 'operacional').length,
    total: list.length,
  };

  function openEdit(u: User) {
    const alias = aliasOf(u);
    setEditTarget({
      user: u,
      alias,
      creatorRow: alias === 'creator' ? creators.data?.find((c) => c.id === u.creator_id) : undefined,
      collaboratorRow: alias === 'colaborador' ? collaborators.data?.find((c) => c.id === u.collaborator_id) : undefined,
    });
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        <Stat label="Gestores" value={stats.gestores} color="var(--pri)" />
        <Stat label="Operacionais" value={stats.operacionais} color="var(--cyan)" />
        <Stat label="Total de usuários" value={stats.total} color="var(--tx)" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div><div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Usuários</div><div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Crie gestores — Creators e Colaboradores são cadastrados pelo gestor, em Cadastros</div></div>
        <div style={{ marginLeft: 'auto' }}><Button icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setNewModal(true)}>Novo gestor</Button></div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.2fr 1fr 1fr', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
          <span>USUÁRIO</span><span>E-MAIL</span><span>TELEFONE</span><span>PERFIL</span><span>STATUS</span>
        </div>
        {list.map((u) => {
          const alias = aliasOf(u);
          return (
            <div key={u.id} onClick={() => openEdit(u)} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.2fr 1fr 1fr', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.name} size={34} seed={u.id} /><span style={{ fontWeight: 600 }}>{u.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{u.email}</span>
              <span style={{ color: 'var(--tx2)' }}>{u.phone}</span>
              <span><span style={{ fontSize: 11, fontWeight: 700, color: ALIAS_BADGE_COLOR[alias].color, background: ALIAS_BADGE_COLOR[alias].bg, padding: '3px 10px', borderRadius: 7 }}>{roleLabel(u)}</span></span>
              <span style={{ color: u.status === 'active' ? '#22C55E' : '#65657C' }}>{u.status === 'active' ? 'Ativo' : 'Inativo'}</span>
            </div>
          );
        })}
      </div>

      {newModal && (
        <NewUserModal
          onClose={() => setNewModal(false)}
          onCreateUser={async (d) => { const u = await api.users.create(d); users.setData((p) => [...(p ?? []), u]); setNewModal(false); toast.success('Gestor criado'); }}
        />
      )}

      {editTarget && (
        <EditUserModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          professions={professions.data ?? []}
          onAddProfession={async (name) => { await api.professions.create(name); professions.setData((p) => [...(p ?? []), name]); return name; }}
          onUpdateUser={async (id, d) => {
            try {
              const u = await api.users.update(id, d);
              users.setData((p) => (p ?? []).map((x) => (x.id === id ? { ...x, ...u } : x)));
              setEditTarget(null);
              toast.success('Usuário atualizado');
            } catch (err) {
              toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
            }
          }}
          onUpdateCreator={async (id, d) => {
            try {
              await api.creators.update(id, d);
              users.reload(); creators.reload();
              setEditTarget(null);
              toast.success('Creator atualizado');
            } catch (err) {
              toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
            }
          }}
          onUpdateCollaborator={async (id, d) => {
            try {
              await api.collaborators.update(id, d);
              users.reload(); collaborators.reload();
              setEditTarget(null);
              toast.success('Colaborador atualizado');
            } catch (err) {
              toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginTop: 4, color }}>{value}</div>
    </div>
  );
}

/** Admin só cria Gestor por aqui — Creator/Colaborador nascem na aba do gestor (Cadastros), nunca
 * pelo admin. Função/cargo é texto livre e opcional — nasce em branco, "Gestor" só aparece como
 * fallback de exibição (roleLabel) se nada for digitado, nunca como valor pré-preenchido aqui. */
function NewUserModal({ onClose, onCreateUser }: {
  onClose: () => void;
  onCreateUser: (d: NewUser) => void;
}) {
  const [f, setF] = useState({ name: '', email: '', phone: '' as string | null, password: '', funcao: '' });

  const canSubmit = f.name && f.email && f.password.length >= 8;

  function submit() {
    if (!canSubmit) return;
    onCreateUser({ name: f.name, email: f.email, phone: f.phone, role: 'gestor', status: 'active', password: f.password, alias: f.funcao.trim() || null });
  }

  return (
    <Modal open title="Novo gestor" subtitle="Cria um acesso de gestor — Creators e Colaboradores são cadastrados pelo próprio gestor, em Cadastros" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Salvar</Button></>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value || null })} /></Field>
      </div>
      <Field label="Função / cargo (opcional)">
        <TextInput value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })} placeholder="Ex.: Diretor, Supervisor, Gerente de operações…" />
      </Field>
      <Field label="Senha"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></Field>
    </Modal>
  );
}

/** Tipo de acesso não é editável aqui — trocar um Creator pra Colaborador (ou um Gestor pra Admin)
 * não é um campo simples, é trocar de tabela/registro por baixo. A Função/cargo (texto livre, só
 * pra admin/gestor) já é editável — não tem nada estrutural impedindo, e pode ficar em branco. */
function EditUserModal({ target, onClose, onUpdateUser, onUpdateCreator, onUpdateCollaborator, professions, onAddProfession }: {
  target: EditTarget;
  onClose: () => void;
  onUpdateUser: (id: string, d: Partial<Pick<User, 'name' | 'email' | 'phone' | 'status' | 'alias'>>) => void;
  onUpdateCreator: (id: string, d: Partial<Creator> & { password?: string }) => void;
  onUpdateCollaborator: (id: string, d: Partial<Collaborator> & { password?: string }) => void;
  professions: string[];
  onAddProfession: (name: string) => Promise<string>;
}) {
  const { user, alias, creatorRow, collaboratorRow } = target;
  const [f, setF] = useState({
    name: user.name, email: user.email, phone: user.phone, password: '',
    employment_type: (creatorRow?.employment_type ?? collaboratorRow?.employment_type ?? 'fixed') as EmploymentType,
    profession: collaboratorRow?.profession ?? '',
    active: creatorRow?.active ?? collaboratorRow?.active ?? true,
    status: user.status,
    // em branco se nada foi cadastrado ainda — nunca pré-preenche com o nome do tipo de acesso
    // (Gestor/Admin) como se fosse a função real da pessoa.
    funcao: user.alias ?? '',
  });
  const [newProf, setNewProf] = useState('');

  const canSubmit = f.name && f.email && (alias !== 'colaborador' || f.profession);
  const isOperacional = alias === 'creator' || alias === 'colaborador';

  function submit() {
    if (!canSubmit) return;
    if (alias === 'admin' || alias === 'gestor') {
      onUpdateUser(user.id, { name: f.name, email: f.email, phone: f.phone, status: f.status, alias: f.funcao.trim() || null });
    } else if (alias === 'creator') {
      onUpdateCreator(creatorRow!.id, { name: f.name, email: f.email, phone: f.phone, employment_type: f.employment_type, active: f.active, ...(f.password ? { password: f.password } : {}) });
    } else {
      onUpdateCollaborator(collaboratorRow!.id, { name: f.name, email: f.email, phone: f.phone, profession: f.profession, employment_type: f.employment_type, active: f.active, ...(f.password ? { password: f.password } : {}) });
    }
  }

  return (
    <Modal open title="Editar usuário" subtitle={`Tipo de acesso: ${ACCESS_TYPE_LABEL[alias]} (fixo, não muda aqui)`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Salvar</Button></>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value || null })} /></Field>
      </div>
      {!isOperacional && (
        <Field label="Função / cargo (opcional)"><TextInput value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })} placeholder="Ex.: Diretor, Supervisor, Gerente de operações…" /></Field>
      )}
      {isOperacional && (
        <Field label="Tipo de vínculo"><Select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value as EmploymentType })}><option value="fixed">Fixo</option><option value="freelancer">Freelancer</option></Select></Field>
      )}
      {alias === 'colaborador' && (
        <Field label="Profissão">
          <Select value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })}>{professions.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <TextInput value={newProf} onChange={(e) => setNewProf(e.target.value)} placeholder="Cadastrar nova profissão…" style={{ flex: 1 }} />
            <Button variant="soft" onClick={async () => { if (newProf.trim()) { const name = await onAddProfession(newProf.trim()); setF((x) => ({ ...x, profession: name })); setNewProf(''); } }}>Adicionar</Button>
          </div>
        </Field>
      )}
      <Field label="Status">
        {isOperacional ? (
          <Select value={f.active ? 'active' : 'inactive'} onChange={(e) => setF({ ...f, active: e.target.value === 'active' })}>
            <option value="active">Ativo</option><option value="inactive">Inativo</option>
          </Select>
        ) : (
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as UserStatus })}>
            <option value="active">Ativo</option><option value="inactive">Inativo</option>
          </Select>
        )}
      </Field>
      {isOperacional && (
        <Field label="Nova senha (deixe vazio para manter a atual)"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></Field>
      )}
    </Modal>
  );
}
