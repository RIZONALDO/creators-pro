import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormPrevious } from 'grommet-icons';
import { useApp } from '@/context/AppContext';
import { TextInput } from '@/components/Modal';
import { MobileField, MOBILE_INPUT_STYLE } from '@/components/MobileField';
import { Avatar, Button } from '@/components/ui';
import { PushToggle } from '@/components/PushToggle';

/** Página de perfil do app mobile — navegação por seta de voltar (padrão mobile), não modal. */
export function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useApp();
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', password: '', password2: '' });

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 18px 18px' }}>
        <button onClick={() => navigate(-1)} style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FormPrevious color="currentColor" style={{ width: 20, height: 20 }} />
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>Perfil</div>
      </div>

      <div style={{ padding: '0 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <Avatar name={user?.name ?? ''} size={76} imageUrl={user?.avatar_url} />
          <button style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Trocar foto</button>
        </div>

        <MobileField label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={MOBILE_INPUT_STYLE} /></MobileField>
        <MobileField label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={MOBILE_INPUT_STYLE} /></MobileField>
        <MobileField label="Telefone"><TextInput value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} style={MOBILE_INPUT_STYLE} /></MobileField>
        <MobileField label="Nova senha"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} style={MOBILE_INPUT_STYLE} /></MobileField>
        <MobileField label="Confirmar nova senha"><TextInput type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} style={MOBILE_INPUT_STYLE} /></MobileField>

        <div style={{ marginTop: 8, marginBottom: 20 }}><PushToggle large /></div>

        <Button style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px 18px', marginBottom: 12 }} onClick={() => navigate(-1)}>Salvar</Button>
        <Button variant="ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px 18px', color: 'var(--red)' }} onClick={logout}>Sair</Button>
      </div>
    </div>
  );
}
