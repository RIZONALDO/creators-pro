import { useEffect, useState } from 'react';
import { platformApi, type TenantSummary } from '../api';
import { ApiError } from '@/api/client';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Ativo',     color: '#22c55e', bg: 'rgba(34,197,94,.1)' },
  trial:     { label: 'Trial',     color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  suspended: { label: 'Suspenso',  color: '#ef4444', bg: 'rgba(239,68,68,.1)' },
  cancelled: { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,.1)' },
};

interface Props {
  onSelect: (id: string) => void;
  onDeleted?: () => void;
}

export function Tenants({ onSelect, onDeleted }: Props) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newModal, setNewModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setTenants(await platformApi.tenants.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao carregar tenants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleStatus(id: string, status: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = await platformApi.tenants.updateStatus(id, status);
      setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, status: updated.status } : t)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao atualizar status.');
    }
  }

  async function handleDelete(t: TenantSummary, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Excluir "${t.name}" e TODOS os seus dados permanentemente? Esta ação não pode ser desfeita.`)) return;
    try {
      await platformApi.tenants.delete(t.id);
      setTenants((prev) => prev.filter((x) => x.id !== t.id));
      onDeleted?.();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir tenant.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: 'var(--tx)' }}>Tenants</div>
          <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 3 }}>{tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastrada{tenants.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => setNewModal(true)} style={{ marginLeft: 'auto', background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Novo tenant
        </button>
      </div>

      {error && <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--tx2)', fontSize: 13, padding: 24, textAlign: 'center' }}>Carregando…</div>
      ) : tenants.length === 0 ? (
        <div style={{ color: 'var(--tx2)', fontSize: 13, padding: 24, textAlign: 'center' }}>Nenhum tenant cadastrado.</div>
      ) : (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 120px', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
            <span>EMPRESA</span><span>STATUS</span><span>USUÁRIOS</span><span>CRIADO EM</span><span />
          </div>
          {tenants.map((t) => {
            const meta = STATUS_LABEL[t.status] ?? STATUS_LABEL.cancelled!;
            const created = new Date(t.created_at).toLocaleDateString('pt-BR');
            return (
              <div key={t.id} onClick={() => onSelect(t.id)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 180px', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>/{t.slug}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '3px 10px', borderRadius: 7, display: 'inline-block' }}>{meta.label}</span>
                <span style={{ color: 'var(--tx2)' }}>{t.user_count}</span>
                <span style={{ color: 'var(--tx2)' }}>{created}</span>
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {t.status !== 'active' && (
                    <button onClick={(e) => handleStatus(t.id, 'active', e)} title="Reativar" style={{ background: 'rgba(34,197,94,.1)', color: '#22c55e', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reativar</button>
                  )}
                  {t.status === 'active' && (
                    <button onClick={(e) => handleStatus(t.id, 'suspended', e)} title="Suspender" style={{ background: 'rgba(239,68,68,.08)', color: 'var(--red)', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Suspender</button>
                  )}
                  <button onClick={(e) => handleDelete(t, e)} title="Excluir permanentemente" style={{ background: 'none', color: 'var(--red)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newModal && <NewTenantModal onClose={() => setNewModal(false)} onCreated={() => { setNewModal(false); load(); }} />}
    </div>
  );
}

function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = f.name.length >= 2 && f.adminName.length >= 2 && f.adminEmail && f.adminPassword.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(''); setBusy(true);
    try {
      await platformApi.tenants.create(f);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar tenant.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Novo tenant</div>
        <form onSubmit={submit}>
          <Field label="Nome da empresa"><Input value={f.name} onChange={(v) => setF({ ...f, name: v })} /></Field>
          <Field label="Nome do admin"><Input value={f.adminName} onChange={(v) => setF({ ...f, adminName: v })} /></Field>
          <Field label="E-mail do admin"><Input type="email" value={f.adminEmail} onChange={(v) => setF({ ...f, adminEmail: v })} /></Field>
          <Field label="Senha do admin (mín. 8 caracteres)"><Input type="password" value={f.adminPassword} onChange={(v) => setF({ ...f, adminPassword: v })} /></Field>
          {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 18px', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={!canSubmit || busy} style={{ background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: canSubmit && !busy ? 'pointer' : 'not-allowed', opacity: canSubmit && !busy ? 1 : 0.6 }}>
              {busy ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text' }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' }} />
  );
}
