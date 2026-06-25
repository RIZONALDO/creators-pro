import { useState } from 'react';
import { api } from '@/api';
import type { BillingStatus, Invoice } from '@/api';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { Button } from '@/components/ui';
import { COMPANY_STATUS_META, INVOICE_STATUS_META } from '@/lib/display';

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function AdminBilling() {
  const toast = useToast();
  const status = useAsync<BillingStatus>(() => api.billing.status(), []);
  const [openingPortal, setOpeningPortal] = useState(false);
  const hasSubscription = status.data?.has_subscription ?? false;
  const invoices = useAsync<{ invoices: Invoice[] }>(
    () => (hasSubscription ? api.billing.invoices() : Promise.resolve({ invoices: [] })),
    [hasSubscription],
  );

  async function handleManageBilling() {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const { portal_url } = await api.billing.portal();
      window.location.href = portal_url;
    } catch (err) {
      toast.error('Não foi possível abrir a cobrança', err instanceof Error ? err.message : 'Tente novamente.');
      setOpeningPortal(false);
    }
  }

  const s = status.data;

  return (
    <div className="cp-fade" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Cobrança</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Assinatura, status do pagamento e portal da Stripe</div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--tx2)' }}>Status da assinatura</div>
            {s ? (
              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 700, color: COMPANY_STATUS_META[s.status].color, background: COMPANY_STATUS_META[s.status].bg, padding: '4px 11px', borderRadius: 8 }}>
                {COMPANY_STATUS_META[s.status].label}
              </span>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 6 }}>Carregando…</div>
            )}
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--tx2)' }}>Conta de cobrança</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{s ? (s.has_subscription ? 'Conectada à Stripe' : 'Sem assinatura vinculada') : '—'}</div>
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: 16 }} />
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 16 }}>Troque o cartão ou cancele a assinatura — gerenciado pela Stripe, fora deste sistema.</div>
        <Button onClick={handleManageBilling} disabled={!s?.has_subscription || openingPortal}>{openingPortal ? 'Abrindo…' : 'Gerenciar cobrança'}</Button>
      </div>

      {hasSubscription && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Histórico de faturas</div>
          {invoices.loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Carregando…</div>
          ) : invoices.data?.invoices.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {invoices.data.invoices.map((inv) => (
                <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--tx2)' }}>{formatDate(inv.created_at)}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(inv.amount_paid, inv.currency)}</span>
                  <span>
                    {inv.status && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: INVOICE_STATUS_META[inv.status].color, background: INVOICE_STATUS_META[inv.status].bg, padding: '3px 9px', borderRadius: 7 }}>
                        {INVOICE_STATUS_META[inv.status].label}
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    {inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Ver</a>}
                    {inv.invoice_pdf && <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>PDF</a>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Nenhuma fatura ainda.</div>
          )}
        </div>
      )}
    </div>
  );
}
