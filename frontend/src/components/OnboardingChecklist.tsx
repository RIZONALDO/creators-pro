import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type OnboardingStatus } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { useApp } from '@/context/AppContext';

interface Step {
  label: string;
  description: string;
  done: boolean;
  to: string;
  cta: string;
}

function StepNumber({ n, done, current }: { n: number; done: boolean; current: boolean }) {
  if (done) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(34,197,94,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.5 3.5 6.5-7" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (current) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--pri)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans'" }}>{n}</span>
      </div>
    );
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: '1.5px solid var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx3)', fontFamily: "'Plus Jakarta Sans'" }}>{n}</span>
    </div>
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
    ...(isAdmin ? [{
      label: 'Convide um gestor',
      description: 'Delegue a operação do dia a dia para um gestor de confiança. Ele vai criar tarefas, acompanhar os creators e aprovar entregas — liberando você para focar no relacionamento com o cliente.',
      done: s.has_gestor,
      to: '/admin',
      cta: 'Adicionar gestor',
    }] : []),
    {
      label: 'Cadastre um creator',
      description: 'Adicione os creators que produzem conteúdo para a agência. Sem eles cadastrados não é possível atribuir tarefas, montar escala ou acompanhar produções.',
      done: s.has_creator,
      to: '/cadastros',
      cta: 'Cadastrar creator',
    },
    {
      label: 'Crie sua primeira tarefa',
      description: 'Crie uma demanda e atribua a um creator. Ele recebe notificação no app, acompanha o status em tempo real e você aprova a entrega quando estiver pronto.',
      done: s.has_task,
      to: '/tarefas',
      cta: 'Criar tarefa',
    },
    {
      label: 'Monte a escala da semana',
      description: 'Defina quem trabalha em cada dia. A escala aparece no dashboard do gestor e no app de cada creator, deixando a programação da semana visível para toda a equipe.',
      done: s.has_scale_entry,
      to: '/escala',
      cta: 'Montar escala',
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const currentIdx = steps.findIndex((s) => !s.done);

  function dismiss() {
    localStorage.setItem('cp_onboarding_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 20, marginBottom: 24, overflow: 'hidden' }}>
      {/* Cabeçalho */}
      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Comece por aqui</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{doneCount} de {steps.length} passos concluídos</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pri)' }}>{pct}%</span>
            <div style={{ width: 72, height: 4, borderRadius: 4, background: 'var(--bg3)' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,var(--pri),var(--pri2))', transition: 'width .5s' }} />
            </div>
          </div>
          <button onClick={dismiss} title="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 4, lineHeight: 1, marginLeft: 4 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {/* Passos */}
      {steps.map((step, i) => {
        const isCurrent = i === currentIdx;
        const isFuture = !step.done && !isCurrent;

        return (
          <div
            key={step.label}
            style={{
              padding: '14px 20px',
              borderBottom: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
              background: isCurrent ? 'linear-gradient(135deg,rgba(108,99,255,.06),rgba(108,99,255,.02))' : 'transparent',
              opacity: isFuture ? 0.55 : 1,
              transition: 'opacity .2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <StepNumber n={i + 1} done={step.done} current={isCurrent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5,
                  fontWeight: isCurrent ? 700 : 600,
                  color: step.done ? 'var(--tx3)' : 'var(--tx)',
                  textDecoration: step.done ? 'line-through' : 'none',
                  fontFamily: "'Plus Jakarta Sans'",
                  marginBottom: (!step.done) ? 4 : 0,
                }}>
                  {step.label}
                </div>
                {!step.done && (
                  <div style={{ fontSize: 12, color: isCurrent ? 'var(--tx2)' : 'var(--tx3)', lineHeight: 1.55 }}>
                    {step.description}
                  </div>
                )}
              </div>
              {isCurrent && (
                <Link
                  to={step.to}
                  style={{
                    flex: 'none',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--pri)',
                    textDecoration: 'none',
                    padding: '7px 14px',
                    borderRadius: 10,
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}
                >
                  {step.cta} →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
