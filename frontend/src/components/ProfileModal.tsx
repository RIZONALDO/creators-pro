import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from './ui';
import { Modal, Field, TextInput } from './Modal';
import { PushToggle } from './PushToggle';

export function ProfileModal({ open, onClose, name, email, phone }: { open: boolean; onClose: () => void; name: string; email: string; phone: string }) {
  const { logout } = useApp();
  const [f, setF] = useState({ name, email, phone, password: '', password2: '' });
  if (!open) return null;
  return (
    <Modal open title="Editar perfil" subtitle="tabela users (self)" onClose={onClose}
      footer={<>
        <button onClick={logout} style={{ padding: '9px 15px', borderRadius: 11, background: 'transparent', border: '1px solid var(--line)', color: 'var(--red)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginRight: 'auto' }}>Sair</button>
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
      <PushToggle />
    </Modal>
  );
}
