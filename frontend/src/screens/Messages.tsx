import { useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { connectChat } from '@/api/socket';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Avatar } from '@/components/ui';
import type { Conversation, Message, Creator } from '@/types';

export function Messages() {
  const { user } = useApp();
  const conversations = useAsync<Conversation[]>(() => api.messages.conversations(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const convs = conversations.data ?? [];
  const current = convs.find((c) => c.user_id === activeId) ?? convs[0] ?? null;
  const creName = (uid: string) => {
    const byUser = creators.data?.find((c) => c.user_id === uid);
    return byUser?.name ?? 'Creator';
  };

  useEffect(() => { if (!activeId && convs.length) setActiveId(convs[0].user_id); }, [convs, activeId]);

  useEffect(() => {
    if (!current) return;
    api.messages.thread(current.user_id).then(setThread);
  }, [current]);

  useEffect(() => {
    const socket = connectChat();
    const off = socket.onMessage((m) => setThread((t) => (t.some((x) => x.id === m.id) ? t : [...t, m])));
    return () => { off(); socket.disconnect(); };
  }, []);

  useEffect(() => { endRef.current?.scrollTo({ top: 1e9 }); }, [thread]);

  async function send() {
    if (!draft.trim() || !current || !user) return;
    const m = await api.messages.send(user.id, current.user_id, draft.trim());
    setThread((t) => [...t, m]);
    setDraft('');
  }

  return (
    <div className="cp-fade" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 62px - 52px)' }}>
      <div style={{ width: 300, flex: 'none', background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {convs.map((c) => (
            <div key={c.user_id} onClick={() => setActiveId(c.user_id)} style={{ display: 'flex', gap: 11, padding: '11px 13px', borderRadius: 13, cursor: 'pointer', border: '1px solid ' + (c.user_id === current?.user_id ? 'rgba(108,99,255,.3)' : 'transparent'), background: c.user_id === current?.user_id ? 'rgba(108,99,255,.10)' : 'transparent' }}>
              <Avatar name={creName(c.user_id)} size={42} seed={c.user_id} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creName(c.user_id)}</span><span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>09:42</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.last_message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, display: 'flex', flexDirection: 'column' }}>
        {current && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
            <Avatar name={creName(current.user_id)} size={38} seed={current.user_id} />
            <div style={{ lineHeight: 1.25 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{creName(current.user_id)}</div><div style={{ fontSize: 11, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />Online</div></div>
          </div>
        )}
        <div ref={endRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {thread.map((m) => {
            const me = m.sender_id === user?.id;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '62%', padding: '10px 14px', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 13, lineHeight: 1.45, background: me ? 'linear-gradient(135deg,#6C63FF,#8B5CF6)' : 'var(--bg3)', color: me ? '#fff' : 'var(--tx)', border: me ? 'none' : '1px solid var(--line)' }}>{m.message}</div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Escreva uma mensagem…" style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px', fontSize: 13, color: 'var(--tx)', outline: 'none' }} />
          <button onClick={send} style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(108,99,255,.4)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
