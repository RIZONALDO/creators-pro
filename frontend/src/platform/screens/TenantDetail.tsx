import { useEffect, useState } from 'react';
import { platformApi, type TenantDetail as TenantDetailType } from '../api';
import { ApiError } from '@/api/client';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Ativo',     color: '#22c55e', bg: 'rgba(34,197,94,.1)' },
  trial:     { label: 'Trial',     color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  suspended: { label: 'Suspenso',  color: '#ef4444', bg: 'rgba(239,68,68,.1)' },
  cancelled: { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,.1)' },
};

interface Props {
  id: string;
  onBack: () => void;
  onDeleted?: () => void;
}

export function TenantDetail({ id, onBack, onDeleted }: Props) {
  const [tenant, setTenant] = useState<TenantDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    platformApi.tenants.get(id)
      .then(setTenant)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erro ao carregar tenant.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatus(status: string) {
    if (!tenant) return;
    setActionBusy(true);
    try {
      const updated = await platformApi.tenants.updateStatus(id, status);
      setTenant((prev) => prev ? { ...prev, status: updated.status } : prev);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao atualizar status.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!tenant) return;
    if (!confirm(`Excluir "${tenant.name}" e TODOS os seus dados permanentemente?\n\nUsuários, creators, tarefas, escalas — tudo será apagado. Não tem como desfazer.`)) return;
    setActionBusy(true);
    try {
      await platformApi.tenants.delete(id);
      onDeleted ? onDeleted() : onBack();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao excluir tenant.');
      setActionBusy(false);
    }
  }

  if (loading) return <div style={{ color: 'var(--tx2)', padding: 32, textAlign: 'center' }}>Carregando…</div>;
  if (error) return <div style={{ color: 'var(--red)', padding: 32 }}>{error}</div>;
  if (!tenant) return null;

  const meta = STATUS_LABEL[tenant.status] ?? STATUS_LABEL.cancelled!;
  const created = new Date(tenant.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Voltar
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: 'var(--tx)' }}>{tenant.name}</div>
          <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>/{tenant.slug} · Criado em {created}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: meta.bg, padding: '5px 12px', borderRadius: 8 }}>{meta.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Usuários" value={tenant.metrics.users} />
        <MetricCard label="Creators" value={tenant.metrics.creators} />
        <MetricCard label="Tarefas" value={tenant.metrics.tasks} />
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.05em', marginBottom: 14 }}>AÇÕES</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {tenant.status !== 'active' && (
            <ActionBtn onClick={() => handleStatus('active')} busy={actionBusy} color="#22c55e" bg="rgba(34,197,94,.1)">Reativar</ActionBtn>
          )}
          {tenant.status === 'active' && (
            <ActionBtn onClick={() => handleStatus('suspended')} busy={actionBusy} color="var(--red)" bg="rgba(239,68,68,.08)">Suspender</ActionBtn>
          )}
          {tenant.status !== 'cancelled' && (
            <ActionBtn onClick={() => handleStatus('cancelled')} busy={actionBusy} color="var(--tx2)" bg="var(--bg3)">Cancelar</ActionBtn>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', letterSpacing: '.05em', marginBottom: 10 }}>ZONA DE PERIGO</div>
        <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 14 }}>
          Exclui a empresa e todos os dados permanentemente: usuários, creators, tarefas, escalas e mensagens. Irreversível.
        </div>
        <ActionBtn onClick={handleDelete} busy={actionBusy} color="var(--red)" bg="rgba(239,68,68,.08)">Excluir tenant permanentemente</ActionBtn>
      </div>

      {(tenant.stripe_customer_id || tenant.stripe_subscription_id) && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.05em', marginBottom: 12 }}>STRIPE</div>
          {tenant.stripe_customer_id && <InfoRow label="Customer ID" value={tenant.stripe_customer_id} />}
          {tenant.stripe_subscription_id && <InfoRow label="Subscription ID" value={tenant.stripe_subscription_id} />}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", color: 'var(--pri)' }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--tx2)', minWidth: 130 }}>{label}</span>
      <span style={{ color: 'var(--tx)', fontFamily: 'monospace', fontSize: 12 }}>{value}</span>
    </div>
  );
}

function ActionBtn({ onClick, busy, color, bg, children }: { onClick: () => void; busy: boolean; color: string; bg: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={busy} style={{ background: bg, color, border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {children}
    </button>
  );
}
