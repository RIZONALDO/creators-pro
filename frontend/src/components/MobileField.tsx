import type { ReactNode } from 'react';

/**
 * Padrão de campo pra telas exclusivas do app mobile (Perfil, Solicitar ausência) — label e
 * inputs bem maiores que o `Field`/`TextInput` padrão do desktop. Não toca nos componentes
 * compartilhados (usados também nas telas do coordenador): aqui é só pras telas do operacional.
 */
export function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--tx2)', marginBottom: 8 }}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Spread em `<TextInput style={...}>`/`<TextArea style={...}>` pra igualar ao tamanho do
 * MobileField. 16px no input evita o zoom automático que o Safari iOS faz em campos < 16px.
 */
export const MOBILE_INPUT_STYLE = { fontSize: 16, padding: '14px 16px' };
