import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type OnboardingStatus } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { useApp } from '@/context/AppContext';

interface Step { label: string; done: boolean; to: string; cta: string }

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="10" fill="rgba(34,197,94,.18)" />
        <path d="M6 10.5l2.8 2.8 5.2-5.6" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="var(--line2)" strokeWidth="1.5" />
    </svg>
  );
}

export function OnboardingChecklist() {
  const { user } = useApp();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('cp_onboarding_dismissed') === '1');
  const statusReq = useAsync<OnboardingStatus>(() => api.onboarding.status(), []);

  if (dismissed || statusReq.loading || !statusReq.data) return null;

  const s = statusReq.data;
  const isAdmin = user?.role === 'admin';

  const steps: Step[] = [
    ...(isAdmin ? [{ label: 'Convide um gestor', done: s.has_gestor, to: '/admin', cta: 'Adicionar' }] : []),
    { label: 'Cadastre um creator', done: s.has_creator, to: '/cadastros', cta: 'Cadastrar' },
    { label: 'Crie sua primeira tarefa', done: s.has_task, to: '/tarefas', cta: 'Criar' },
    { label: 'Monte a primeira escala', done: s.has_scale_entry, to: '/escala', cta: 'Montar' },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  function dismiss() {
    localStorage.setItem('cp_onboarding_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 24, position: 'relative' }}>
      <button onClick={dismiss} title="Fechar" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 4, lineHeight: 1 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingRight: 28 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Configure sua agência</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{doneCount} de {steps.length} passos concluídos</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 56 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pri)' }}>{pct}%</span>
          <div style={{ width: 56, height: 5, borderRadius: 4, background: 'var(--bg3)' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,var(--pri),var(--pri2))', transition: 'width .4s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <CheckIcon done={step.done} />
            <span style={{ fontSize: 13, flex: 1, color: step.done ? 'var(--tx3)' : 'var(--tx)', textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</span>
            {!step.done && (
              <Link to={step.to} style={{ fontSize: 12, fontWeight: 700, color: 'var(--pri)', textDecoration: 'none', background: 'rgba(108,99,255,.1)', padding: '4px 10px', borderRadius: 8 }}>
                {step.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
