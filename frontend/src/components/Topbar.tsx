import { useApp } from '@/context/AppContext';
import { useState } from 'react';
import { Avatar } from './ui';
import { Modal, Field, TextInput } from './Modal';

export function Topbar({ title, subtitle, onToggleSidebar }: { title: string; subtitle: string; onToggleSidebar: () => void }) {
  const { theme, toggleTheme, logout, user } = useApp();
  const [profile, setProfile] = useState(false);
  return (
    <header style={{ height: 62, flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px', borderBottom: '1px solid var(--line)', background: 'var(--bg1)' }}>
      <button onClick={onToggleSidebar} title="Recolher menu" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={toggleTheme} title="Alternar tema" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {theme === 'dark'
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
      </button>
      <button title="Notificações" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg2)' }} />
      </button>
      <button onClick={() => setProfile(true)} title="Meu perfil" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 10px 0 5px', borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)', cursor: 'pointer' }}>
        <Avatar name={user?.name ?? 'Coordenador'} size={28} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Perfil</span>
      </button>
      <button onClick={logout} title="Sair" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
      </button>
      <ProfileModal open={profile} onClose={() => setProfile(false)} name={user?.name ?? ''} email={user?.email ?? ''} phone={user?.phone ?? ''} />
    </header>
  );
}

function ProfileModal({ open, onClose, name, email, phone }: { open: boolean; onClose: () => void; name: string; email: string; phone: string }) {
  const [f, setF] = useState({ name, email, phone, password: '', password2: '' });
  if (!open) return null;
  return (
    <Modal open title="Editar perfil" subtitle="tabela users (self)" onClose={onClose}
      footer={<>
        <button onClick={onClose} style={{ padding: '9px 15px', borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={onClose} style={{ padding: '9px 15px', borderRadius: 11, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
      </>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Avatar name={f.name || 'C'} size={56} />
        <button style={{ padding: '8px 13px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Trocar foto</button>
      </div>
      <Field label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Nova senha"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Confirmar nova senha"><TextInput type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
