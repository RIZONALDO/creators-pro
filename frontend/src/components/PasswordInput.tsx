import { useState } from 'react';
import { View, Hide } from 'grommet-icons';

/** Campo de senha com alternância de visibilidade (padrão de UX que faltava nas telas de auth —
 * Login/Signup/Perfil). Reutilizável: mesmo `<input>` por baixo, só acrescenta o botão do olho. */
export function PasswordInput({ value, onChange, placeholder, autoComplete, style, className, autoFocus, enterKeyHint }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  style?: React.CSSProperties;
  className?: string;
  autoFocus?: boolean;
  enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        enterKeyHint={enterKeyHint}
        className={className}
        style={{ ...style, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none',
          color: 'var(--tx3)', cursor: 'pointer', borderRadius: 8,
        }}
      >
        {visible ? <Hide size="16px" /> : <View size="16px" />}
      </button>
    </div>
  );
}
