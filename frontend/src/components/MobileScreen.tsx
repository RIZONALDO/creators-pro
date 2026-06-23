import type { ReactNode } from 'react';

/**
 * Tela cheia com seta de voltar (padrão de navegação mobile, igual telas nativas). `position:
 * absolute` (não `fixed`) porque o `.cp-phone-frame` é `position: relative` — assim a tela fica
 * ancorada dentro da moldura de celular na preview desktop, em vez de escapar pra janela inteira.
 */
export function MobileScreen({ title, onBack, children, footer }: {
  title: string; onBack: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="cp-fade" style={{
      position: 'absolute', inset: 0, zIndex: 200, background: 'var(--bg0)', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 18px 18px', flex: 'none' }}>
        <button onClick={onBack} style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{title}</div>
      </div>

      <div style={{ padding: '0 18px 28px', flex: 1 }}>{children}</div>
      {footer}
    </div>
  );
}

/** Linha label/valor usada nas telas de detalhe (tarefa, plantão, ausência, dia da escala). */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 14, color: 'var(--tx3)', flex: 'none' }}>{label}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
