import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, Button, StatusPill } from '@/components/ui';
import { Modal, Field, TextInput, Select } from '@/components/Modal';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { ROLE_META, USER_STATUS_META } from '@/lib/display';
import type { User, NewUser, UserStatus } from '@/types';

export function AdminUsers() {
  const toast = useToast();
  const confirm = useConfirm();
  const users = useAsync<User[]>(() => api.users.list(), []);
  const [newModal, setNewModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [checklistToken, setChecklistToken] = useState(0);
  const list = users.data ?? [];

  const stats = {
    gestores: list.filter((u) => u.role === 'gestor').length,
    total: list.length,
  };

  async function handleDelete(id: string) {
    if (!(await confirm({
      title: 'Excluir gestor',
      description: 'Remove o acesso deste gestor à plataforma. Só é possível excluir gestores que ainda não possuem dados cadastrados.',
    }))) return;
    setDeleteError(false);
    try {
      await api.users.delete(id);
      users.setData((p) => (p ?? []).filter((u) => u.id !== id));
      setEditTarget(null);
      setChecklistToken((t) => t + 1);
      toast.success('Gestor excluído');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'USER_HAS_LINKED_RECORDS') {
        setDeleteError(true);
      } else {
        toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
      }
    }
  }

  return (
    <div className="cp-fade">
      <OnboardingChecklist refreshToken={checklistToken} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 22 }}>
        <Stat label="Gestores" value={stats.gestores} color="var(--pri)" />
        <Stat label="Total de usuários" value={stats.total} color="var(--tx)" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div><div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Usuários</div><div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Crie gestores — Creators e Colaboradores são cadastrados pelo gestor, em Cadastros</div></div>
        <div style={{ marginLeft: 'auto' }}><Button icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setNewModal(true)}>Novo gestor</Button></div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1fr 1fr 1fr 0.8fr', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
          <span>USUÁRIO</span><span>E-MAIL</span><span>PERFIL DE ACESSO</span><span>CARGO/FUNÇÃO</span><span>STATUS</span><span />
        </div>
        {list.map((u) => {
          const isAdmin = u.role === 'admin';
          return (
            <div key={u.id} onClick={() => !isAdmin && setEditTarget(u)} style={{
              display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1fr 1fr 1fr 0.8fr', gap: 14, padding: '14px 20px',
              borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: isAdmin ? 'default' : 'pointer',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.name} size={34} seed={u.id} imageUrl={u.avatar_url} /><span style={{ fontWeight: 600 }}>{u.name}</span></span>
              <span style={{ color: 'var(--tx2)' }}>{u.email}</span>
              <span><span style={{ fontSize: 11, fontWeight: 700, color: ROLE_META[u.role].color, background: ROLE_META[u.role].bg, padding: '3px 10px', borderRadius: 7 }}>{ROLE_META[u.role].label}</span></span>
              <span style={{ color: u.alias ? 'var(--tx)' : 'var(--tx3)' }}>{u.alias || '—'}</span>
              <span><StatusPill meta={USER_STATUS_META[u.status]} /></span>
              <span />
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
          user={editTarget}
          deleteError={deleteError}
          onClearDeleteError={() => setDeleteError(false)}
          onClose={() => { setEditTarget(null); setDeleteError(false); }}
          onDelete={() => handleDelete(editTarget.id)}
          onUpdateUser={async (id, d) => {
            try {
              const u = await api.users.update(id, d);
              users.setData((p) => (p ?? []).map((x) => (x.id === id ? { ...x, ...u } : x)));
              setEditTarget(null);
              toast.success('Gestor atualizado');
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
 * pelo admin (e nem outro Admin: ver users.schemas.ts). Perfil de acesso fixo (leitura), só pra
 * deixar claro que tipo de conta está sendo criada — Função/cargo é o campo livre de verdade. */
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
      <Field label="Perfil de acesso">
        <div style={{ fontSize: 13, fontWeight: 600, color: ROLE_META.gestor.color, background: ROLE_META.gestor.bg, padding: '8px 12px', borderRadius: 10, display: 'inline-block' }}>Gestor</div>
      </Field>
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

/** Só gestor chega aqui (admin é leitura na tabela, nunca abre esse modal — ver AdminUsers()). */
function EditUserModal({ user, onClose, onUpdateUser, onDelete, deleteError, onClearDeleteError }: {
  user: User;
  onClose: () => void;
  onUpdateUser: (id: string, d: Partial<Pick<User, 'name' | 'email' | 'phone' | 'status' | 'alias'>> & { password?: string }) => void;
  onDelete: () => void;
  deleteError: boolean;
  onClearDeleteError: () => void;
}) {
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone, status: user.status, funcao: user.alias ?? '', password: '' });

  const canSubmit = f.name && f.email && (!f.password || f.password.length >= 8);

  function submit() {
    if (!canSubmit) return;
    onUpdateUser(user.id, {
      name: f.name, email: f.email, phone: f.phone, status: f.status, alias: f.funcao.trim() || null,
      ...(f.password ? { password: f.password } : {}),
    });
  }

  return (
    <Modal open title="Editar gestor" subtitle="Perfil de acesso: Gestor (fixo, não muda aqui)" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onDelete} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>Salvar</Button>
      </>}>

      {deleteError && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 4, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"><path d="M12 9v5M12 17.5v.5"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>Não é possível excluir este gestor</div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.55 }}>
              Ele possui registros vinculados na plataforma — tarefas, creators, colaboradores ou outros dados. Para excluir, transfira ou remova esses dados primeiro.
            </div>
          </div>
          <button onClick={onClearDeleteError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 2, lineHeight: 1, flex: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value || null })} /></Field>
      </div>
      <Field label="Função / cargo (opcional)"><TextInput value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })} placeholder="Ex.: Diretor, Supervisor, Gerente de operações…" /></Field>
      <Field label="Status">
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as UserStatus })}>
          <option value="active">Ativo</option><option value="inactive">Inativo</option>
        </Select>
      </Field>
      <Field label="Nova senha (deixe vazio para manter a atual)"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></Field>
    </Modal>
  );
}
