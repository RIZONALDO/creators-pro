import { useEffect, useState } from 'react';
import { platformApi, type Plan } from '../api';

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  one_time: 'Vitalício',
  manual: 'Manual',
};

function fmtCents(cents: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function PlanRow({ plan, onEdit, onDeactivate }: { plan: Plan; onEdit: (p: Plan) => void; onDeactivate: (id: string) => void }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--line)' }}>
      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--tx)', fontSize: 14 }}>
        {plan.name}
        {!plan.active && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--bg3)', color: 'var(--tx3)', borderRadius: 6, padding: '2px 6px' }}>Inativo</span>}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx2)' }}>{BILLING_LABELS[plan.billing_type] ?? plan.billing_type}</td>
      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{fmtCents(plan.price_cents, plan.currency)}</td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx2)' }}>
        {plan.max_gestores ?? '∞'} gestores / {plan.max_creators ?? '∞'} creators
      </td>
      <td style={{ padding: '12px 16px' }}>
        {plan.stripe_price_id
          ? <span style={{ fontSize: 11, background: 'rgba(34,197,94,.1)', color: '#16a34a', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>Stripe ✓</span>
          : <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--tx3)', borderRadius: 6, padding: '2px 7px' }}>Sem Stripe</span>
        }
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {plan.active && (
            <button onClick={() => onEdit(plan)} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--line)', color: 'var(--tx)', cursor: 'pointer' }}>Editar</button>
          )}
          {plan.active && (
            <button onClick={() => onDeactivate(plan.id)} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'none', border: '1px solid var(--line)', color: 'var(--red)', cursor: 'pointer' }}>Desativar</button>
          )}
        </div>
      </td>
    </tr>
  );
}

type FormMode = { type: 'create' } | { type: 'edit'; plan: Plan };

function PlanModal({ mode, onClose, onSaved }: { mode: FormMode; onClose: () => void; onSaved: (p: Plan) => void }) {
  const isEdit = mode.type === 'edit';
  const initial = isEdit ? mode.plan : null;

  const [name, setName] = useState(initial?.name ?? '');
  const [billingType, setBillingType] = useState<Plan['billing_type']>(initial?.billing_type ?? 'monthly');
  const [priceCents, setPriceCents] = useState(initial ? String(initial.price_cents / 100) : '');
  const [maxGestores, setMaxGestores] = useState(initial?.max_gestores != null ? String(initial.max_gestores) : '');
  const [maxCreators, setMaxCreators] = useState(initial?.max_creators != null ? String(initial.max_creators) : '');
  const [syncStripe, setSyncStripe] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Math.round(parseFloat(priceCents.replace(',', '.')) * 100);
    if (isNaN(price) || price < 0) { setError('Preço inválido.'); return; }
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    setError(''); setBusy(true);
    try {
      let saved: Plan;
      if (isEdit) {
        saved = await platformApi.plans.update(mode.plan.id, {
          name,
          priceCents: price,
          maxGestores: maxGestores ? parseInt(maxGestores) : null,
          maxCreators: maxCreators ? parseInt(maxCreators) : null,
        });
      } else {
        saved = await platformApi.plans.create({
          name,
          billingType: billingType as Plan['billing_type'],
          priceCents: price,
          maxGestores: maxGestores ? parseInt(maxGestores) : null,
          maxCreators: maxCreators ? parseInt(maxCreators) : null,
          syncStripe,
        });
      }
      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar plano.');
    } finally {
      setBusy(false);
    }
  }

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx)', marginBottom: 22 }}>{isEdit ? 'Editar plano' : 'Novo plano'}</div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
            </div>
            {!isEdit && (
              <div>
                <label style={lbl}>Tipo de cobrança</label>
                <select value={billingType} onChange={(e) => setBillingType(e.target.value as Plan['billing_type'])} style={{ ...inp }}>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                  <option value="one_time">Pagamento único (Vitalício)</option>
                  <option value="manual">Manual (sem Stripe)</option>
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Preço (R$)</label>
              <input value={priceCents} onChange={(e) => setPriceCents(e.target.value)} style={inp} inputMode="decimal" placeholder="97,00" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Máx. gestores (vazio = ∞)</label>
                <input value={maxGestores} onChange={(e) => setMaxGestores(e.target.value)} style={inp} inputMode="numeric" placeholder="ilimitado" />
              </div>
              <div>
                <label style={lbl}>Máx. creators (vazio = ∞)</label>
                <input value={maxCreators} onChange={(e) => setMaxCreators(e.target.value)} style={inp} inputMode="numeric" placeholder="ilimitado" />
              </div>
            </div>
            {!isEdit && billingType !== 'manual' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={syncStripe} onChange={(e) => setSyncStripe(e.target.checked)} />
                Criar produto e preço no Stripe automaticamente
              </label>
            )}
          </div>
          {error && <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--line)', color: 'var(--tx)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={busy} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--pri)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<FormMode | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformApi.plans.list()
      .then(setPlans)
      .catch(() => setError('Falha ao carregar planos.'))
      .finally(() => setLoading(false));
  }, []);

  function onSaved(saved: Plan) {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setModal(null);
  }

  async function deactivate(id: string) {
    if (!confirm('Desativar este plano?')) return;
    try {
      const updated = await platformApi.plans.deactivate(id);
      setPlans((prev) => prev.map((p) => p.id === id ? updated : p));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao desativar.');
    }
  }

  if (loading) return <div style={{ color: 'var(--tx2)', fontSize: 14 }}>Carregando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)', fontFamily: "'Plus Jakarta Sans'" }}>Planos</div>
          <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 3 }}>{plans.filter((p) => p.active).length} ativos</div>
        </div>
        <button onClick={() => setModal({ type: 'create' })} style={{ background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Novo plano
        </button>
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }}>
              {['Nome', 'Tipo', 'Preço', 'Limites', 'Stripe', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--tx3)', fontSize: 14 }}>Nenhum plano cadastrado ainda.</td></tr>
            ) : (
              plans.map((p) => <PlanRow key={p.id} plan={p} onEdit={(pl) => setModal({ type: 'edit', plan: pl })} onDeactivate={deactivate} />)
            )}
          </tbody>
        </table>
      </div>

      {modal && <PlanModal mode={modal} onClose={() => setModal(null)} onSaved={onSaved} />}
    </div>
  );
}
