import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar, Button } from '@/components/ui';
import { Field, TextInput } from '@/components/Modal';
import { PushToggle } from '@/components/PushToggle';
import { ROLE_META, roleLabel } from '@/lib/display';

/** Página de perfil do gestor/admin (desktop) — Profile.tsx é a versão mobile, separada de
 * propósito (visual/navegação diferentes; specs não pedem reuso entre as duas). */
export function EditProfile() {
  const { user } = useApp();
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', password: '', password2: '' });
  if (!user) return null;

  return (
    <div className="cp-fade" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Editar perfil</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Seus dados de acesso</div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <Avatar name={f.name || 'C'} size={56} imageUrl={user.avatar_url} />
          <Button variant="ghost">Trocar foto</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Perfil de acesso</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{ROLE_META[user.role].label}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Cargo</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{roleLabel(user)}</div>
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: 18 }} />

        <Field label="Nome"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="E-mail"><TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Telefone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nova senha"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Confirmar nova senha"><TextInput type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} /></Field>
        </div>

        <div style={{ margin: '18px 0' }}><PushToggle /></div>

        <Button>Salvar</Button>
      </div>
    </div>
  );
}
