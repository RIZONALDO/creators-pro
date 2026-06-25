import { useEffect, useState } from 'react';
import { api } from '@/api';
import type { BillingStatus } from '@/api';
import { useApp } from '@/context/AppContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { COMPANY_STATUS_META, roleLabel } from '@/lib/display';
import { Button } from '@/components/ui';
import { Field, TextInput } from '@/components/Modal';
import type { CompanySettings } from '@/types';

/** "3h 42min" / "42min" — nunca negativo (quem está vendo essa tela passou pelo login, então o
 * trial, se for o caso, ainda não venceu — ver auth.service.ts#assertCompanyUsable). */
function formatCountdown(targetIso: string): string {
  const msRemaining = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalMinutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${minutes}min`;
}

function formatDaysUntil(targetIso: string): string {
  const days = Math.max(0, Math.ceil((new Date(targetIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'hoje';
  return days === 1 ? '1 dia' : `${days} dias`;
}

export function AdminAccount() {
  const { user, logout } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const company = useAsync<CompanySettings>(() => api.company.get(), []);
  const billing = useAsync<BillingStatus>(() => api.billing.status(), []);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [, setNow] = useState(() => Date.now());

  const s = billing.data;
  const isTrial = s?.status === 'trial';
  const isActivePro = s?.status === 'active' && s.has_subscription;
  const renewal = useAsync<{ renews_at: string | null }>(
    () => (isActivePro ? api.billing.renewal() : Promise.resolve({ renews_at: null })),
    [isActivePro],
  );
  const companyName = company.data?.display_name || 'sua empresa';
  const nameMatches = confirmName.trim().toLowerCase() === companyName.trim().toLowerCase();

  // Recalcula a contagem do trial a cada minuto — sem isso, "3h 42min" ficaria parado até a
  // próxima ação que re-renderize a tela (ninguém clica em nada só pra ver o relógio andar).
  useEffect(() => {
    if (!isTrial) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isTrial]);

  async function handleDelete() {
    if (!nameMatches || deleting) return;
    const ok = await confirm({
      title: 'Excluir conta permanentemente',
      description: `Isso vai apagar "${companyName}" e TUDO relacionado (creators, colaboradores, tarefas, escala, mensagens, anexos) pra sempre. Não tem como desfazer ou recuperar depois. Confirma?`,
      confirmLabel: 'Excluir permanentemente',
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await api.account.delete();
      toast.success('Conta excluída');
      logout();
    } catch (err) {
      toast.error('Não foi possível excluir a conta', err instanceof Error ? err.message : 'Tente novamente.');
      setDeleting(false);
    }
  }

  return (
    <div className="cp-fade" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Conta</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Informações da sua conta e exclusão permanente</div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Informações da conta</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Empresa</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{company.data?.display_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Plano</div>
            {s ? (
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 12.5, fontWeight: 700, color: COMPANY_STATUS_META[s.status].color, background: COMPANY_STATUS_META[s.status].bg, padding: '3px 10px', borderRadius: 7 }}>
                {COMPANY_STATUS_META[s.status].label}
              </span>
            ) : <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 4 }}>Carregando…</div>}
          </div>
          {isTrial && s?.trial_ends_at && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Tempo restante</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--red)', marginTop: 3 }}>{formatCountdown(s.trial_ends_at)}</div>
            </div>
          )}
          {isActivePro && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Renova em</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{renewal.data?.renews_at ? formatDaysUntil(renewal.data.renews_at) : '—'}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Seu nome</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{user?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Seu papel</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{user ? roleLabel(user) : '—'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>E-mail</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{user?.email}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>Excluir conta permanentemente</div>

        {isTrial ? (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
              Apaga a empresa e todos os dados (creators, colaboradores, tarefas, escala, mensagens, anexos) pra sempre — sem volta. Só é possível fazer isso durante o período de teste.
            </div>
            <Field label={`Digite "${companyName}" pra confirmar`}>
              <TextInput value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={companyName} />
            </Field>
            <Button variant="ghost" disabled={!nameMatches || deleting} onClick={handleDelete}
              style={{ marginTop: 14, color: '#fff', background: nameMatches ? 'var(--red)' : undefined }}>
              {deleting ? 'Excluindo…' : 'Excluir conta permanentemente'}
            </Button>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
            Sua empresa já tem um plano ativo — exclusão direta fica desligada nesse caso. Pra cancelar a assinatura, use o portal de cobrança em <strong>Cobrança</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
