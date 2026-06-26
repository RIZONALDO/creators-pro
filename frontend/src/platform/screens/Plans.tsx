import { useEffect, useState } from 'react';
import { platformApi, type Plan, type StripePricePreview } from '../api';

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  one_time: 'Vitalício',
  manual: 'Manual',
};

function planTypeLabel(plan: Plan) {
  if (plan.billing_type === 'manual' && plan.price_cents === 0) return 'Trial';
  return BILLING_LABELS[plan.billing_type] ?? plan.billing_type;
}

function fmtCents(cents: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function PlanRow({ plan, onEdit, onDelete }: { plan: Plan; onEdit: (p: Plan) => void; onDelete: (id: string) => void }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--line)' }}>
      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--tx)', fontSize: 14 }}>{plan.name}</td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx2)' }}>{planTypeLabel(plan)}</td>
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
          <button onClick={() => onEdit(plan)} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--line)', color: 'var(--tx)', cursor: 'pointer' }}>Editar</button>
          <button onClick={() => onDelete(plan.id)} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'none', border: '1px solid var(--line)', color: 'var(--red)', cursor: 'pointer' }}>Excluir</button>
        </div>
      </td>
    </tr>
  );
}

type FormMode = { type: 'create' } | { type: 'edit'; plan: Plan };
type UIBillingType = Plan['billing_type'] | 'trial';

const BILLING_TYPE_LABEL: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  one_time: 'Vitalício',
  manual: 'Manual',
};

function fmtPreview(p: StripePricePreview) {
  const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: p.currency.toUpperCase() }).format(p.unit_amount / 100);
  const tipo = BILLING_TYPE_LABEL[p.billing_type] ?? p.billing_type;
  return `${val} — ${tipo}`;
}

function PlanModal({ mode, onClose, onSaved }: { mode: FormMode; onClose: () => void; onSaved: (p: Plan) => void }) {
  const isEdit = mode.type === 'edit';
  const initial = isEdit ? mode.plan : null;

  const initialUIType = (): UIBillingType => {
    if (!initial) return 'trial';
    if (initial.billing_type === 'manual' && initial.price_cents === 0) return 'trial';
    return initial.billing_type;
  };

  const [name, setName] = useState(initial?.name ?? '');
  const [uiBillingType, setUIBillingType] = useState<UIBillingType>(initialUIType);
  const [priceCents, setPriceCents] = useState(initial && initial.price_cents > 0 ? String(initial.price_cents / 100) : '');
  const [maxGestores, setMaxGestores] = useState(initial?.max_gestores != null ? String(initial.max_gestores) : '');
  const [maxCreators, setMaxCreators] = useState(initial?.max_creators != null ? String(initial.max_creators) : '');

  // Stripe import
  const [stripePriceInput, setStripePriceInput] = useState(initial?.stripe_price_id ?? '');
  const [stripePreview, setStripePreview] = useState<StripePricePreview | null>(null);
  const [fetchingStripe, setFetchingStripe] = useState(false);
  const [stripeError, setStripeError] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isTrial = uiBillingType === 'trial';
  const apiType: Plan['billing_type'] = isTrial ? 'manual' : uiBillingType;
  const usingStripeImport = !!stripePreview;

  function handleTypeChange(val: UIBillingType) {
    setUIBillingType(val);
    if (val === 'trial') { setPriceCents(''); setStripePreview(null); setStripePriceInput(''); }
  }

  async function fetchStripePrice() {
    const id = stripePriceInput.trim();
    if (!id) return;
    setStripeError(''); setFetchingStripe(true); setStripePreview(null);
    try {
      const preview = await platformApi.plans.previewStripePrice(id);
      setStripePreview(preview);
      if (!name.trim()) setName(preview.product_name);
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Price ID não encontrado no Stripe.');
    } finally {
      setFetchingStripe(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    setError(''); setBusy(true);
    try {
      let saved: Plan;
      if (isEdit) {
        saved = await platformApi.plans.update(mode.plan.id, {
          name,
          ...(usingStripeImport
            ? { stripeImportPriceId: stripePreview!.price_id }
            : { priceCents: isTrial ? 0 : Math.round(parseFloat(priceCents.replace(',', '.')) * 100) }),
          maxGestores: maxGestores ? parseInt(maxGestores) : null,
          maxCreators: maxCreators ? parseInt(maxCreators) : null,
        });
      } else {
        const price = isTrial ? 0 : usingStripeImport ? 0 : Math.round(parseFloat(priceCents.replace(',', '.')) * 100);
        if (!isTrial && !usingStripeImport && (isNaN(price) || price < 0)) { setError('Preço inválido.'); setBusy(false); return; }
        saved = await platformApi.plans.create({
          name,
          billingType: usingStripeImport ? stripePreview!.billing_type : apiType,
          priceCents: price,
          maxGestores: maxGestores ? parseInt(maxGestores) : null,
          maxCreators: maxCreators ? parseInt(maxCreators) : null,
          stripeImportPriceId: usingStripeImport ? stripePreview!.price_id : undefined,
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
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx)', marginBottom: 22 }}>{isEdit ? 'Editar plano' : 'Novo plano'}</div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gap: 16 }}>

            {/* ── Stripe Price ID (campo principal) ───────────────── */}
            {!isTrial && (
              <div>
                <label style={lbl}>Stripe Price ID</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={stripePriceInput}
                    onChange={(e) => { setStripePriceInput(e.target.value); setStripePreview(null); setStripeError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), fetchStripePrice())}
                    style={{ ...inp, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="price_1TmRVH…"
                  />
                  <button
                    type="button"
                    onClick={fetchStripePrice}
                    disabled={!stripePriceInput.trim() || fetchingStripe}
                    style={{ padding: '0 16px', borderRadius: 10, background: 'var(--pri)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: fetchingStripe ? 0.6 : 1 }}
                  >
                    {fetchingStripe ? '…' : 'Buscar'}
                  </button>
                </div>
                {stripeError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 5 }}>{stripeError}</div>}

                {/* Preview do que foi encontrado no Stripe */}
                {stripePreview && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{stripePreview.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 1 }}>{fmtPreview(stripePreview)}</div>
                    </div>
                    <button type="button" onClick={() => { setStripePreview(null); setStripePriceInput(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                )}
                {!stripePreview && (
                  <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 5 }}>
                    Cole o Price ID do Stripe e clique em Buscar — o valor e tipo de cobrança são preenchidos automaticamente.
                  </div>
                )}
              </div>
            )}

            {/* ── Nome ───────────────────────────────────────────── */}
            <div>
              <label style={lbl}>Nome do plano</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Ex: Teste grátis, Pro, Agência…" />
            </div>

            {/* ── Tipo (só para criar, sem Stripe import) ─────────── */}
            {!isEdit && !usingStripeImport && (
              <div>
                <label style={lbl}>Tipo</label>
                <select value={uiBillingType} onChange={(e) => handleTypeChange(e.target.value as UIBillingType)} style={{ ...inp }}>
                  <option value="trial">Trial (gratuito)</option>
                  <option value="monthly">Pago — Mensal</option>
                  <option value="yearly">Pago — Anual</option>
                  <option value="one_time">Pago — Vitalício (pagamento único)</option>
                  <option value="manual">Manual (sem Stripe)</option>
                </select>
              </div>
            )}

            {/* ── Preço manual (quando não usa Stripe import) ─────── */}
            {!isTrial && !usingStripeImport && (
              <div>
                <label style={lbl}>Preço (R$) — manual</label>
                <input value={priceCents} onChange={(e) => setPriceCents(e.target.value)} style={inp} inputMode="decimal" placeholder="97,00" />
              </div>
            )}

            {/* ── Limites ─────────────────────────────────────────── */}
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

  async function deletePlan(id: string) {
    const plan = plans.find((p) => p.id === id);
    if (!confirm(`Excluir o plano "${plan?.name ?? id}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await platformApi.plans.delete(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
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
              plans.map((p) => <PlanRow key={p.id} plan={p} onEdit={(pl) => setModal({ type: 'edit', plan: pl })} onDelete={deletePlan} />)
            )}
          </tbody>
        </table>
      </div>

      {modal && <PlanModal mode={modal} onClose={() => setModal(null)} onSaved={onSaved} />}
    </div>
  );
}
