import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Avatar, Button } from '@/components/ui';
import { Modal, Field, TextInput, Select } from '@/components/Modal';
import { ROLE_META } from '@/lib/display';
import { useState } from 'react';
import type { User, NewUser } from '@/types';

export function AdminUsers() {
  const { user, logout, theme, toggleTheme } = useApp();
  const users = useAsync<User[]>(() => api.users.list(), []);
  const [modal, setModal] = useState(false);
  const list = users.data ?? [];

  const stats = {
    gestores: list.filter((u) => u.role === 'gestor').length,
    operacionais: list.filter((u) => u.role === 'operacional').length,
    total: list.length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg0)' }}>
      <header style={{ height: 64, flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 30px', borderBottom: '1px solid var(--line)', background: 'var(--bg1)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(108,99,255,.45)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16 }}>CreatorsPro <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pri2)', background: 'rgba(139,92,246,.16)', padding: '2px 8px', borderRadius: 7, marginLeft: 4 }}>ADMIN</span></div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Administração do sistema</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={toggleTheme} style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer' }}>{theme === 'dark' ? '☾' : '☀'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
          <Avatar name={user?.name ?? 'Admin'} size={30} />
          <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{user?.name}</div><div style={{ fontSize: 10, color: 'var(--tx3)' }}>Administrador</div></div>
          <button onClick={logout} title="Sair" style={{ width: 30, height: 30, borderRadius: 9, background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
            <Stat label="Coordenadores" value={stats.gestores} color="var(--pri)" />
            <Stat label="Operacionais" value={stats.operacionais} color="var(--cyan)" />
            <Stat label="Total de usuários" value={stats.total} color="var(--tx)" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div><div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Usuários</div><div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Crie e gerencie coordenadores e demais acessos</div></div>
            <div style={{ marginLeft: 'auto' }}><Button icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal(true)}>Novo usuário</Button></div>
          </div>

          <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.2fr 1fr 1fr', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
              <span>USUÁRIO</span><span>E-MAIL</span><span>TELEFONE</span><span>PERFIL</span><span>STATUS</span>
            </div>
            {list.map((u) => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.8fr 1.2fr 1fr 1fr', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.name} size={34} seed={u.id} /><span style={{ fontWeight: 600 }}>{u.name}</span></span>
                <span style={{ color: 'var(--tx2)' }}>{u.email}</span>
                <span style={{ color: 'var(--tx2)' }}>{u.phone}</span>
                <span><span style={{ fontSize: 11, fontWeight: 700, color: ROLE_META[u.role].color, background: ROLE_META[u.role].bg, padding: '3px 10px', borderRadius: 7 }}>{ROLE_META[u.role].label}</span></span>
                <span style={{ color: u.status === 'active' ? '#22C55E' : '#65657C' }}>{u.status === 'active' ? 'Ativo' : 'Inativo'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && <NewUserModal onClose={() => setModal(false)} onCreate={async (d) => { const u = await api.users.create(d); users.setData((p) => [...(p ?? []), u]); setModal(false); }} />}
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

function NewUserModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: NewUser) => void }) {
  const [f, setF] = useState<NewUser>({ name: '', email: '', phone: null, role: 'gestor', status: 'active', password: '' });
  return (
    <Modal open title="Novo usuário" subtitle="Cria um acesso ao sistema" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => f.name && f.email && onCreate(f)}>Salvar</Button></>}>
      <Field label="Nome completo"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value || null })} /></Field>
      </div>
      <Field label="Perfil de acesso"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as NewUser['role'] })}><option value="gestor">Coordenador</option><option value="operacional">Operacional</option><option value="admin">Admin</option></Select></Field>
      <Field label="Senha"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
    </Modal>
  );
}
