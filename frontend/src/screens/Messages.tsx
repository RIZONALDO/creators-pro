import { useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { connectRealtime } from '@/api/socket';
import { getAuthToken } from '@/api/client';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Avatar, EmptyState } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { MobileScreen } from '@/components/MobileScreen';
import { AttachmentUpload } from '@/components/AttachmentUpload';
import type { Conversation, Message, MessageContact } from '@/types';

interface ActiveContact { userId: string; name: string; }

const paperclipIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;

export function Messages() {
  const { user } = useApp();
  const isMobile = user?.role === 'operacional';
  const conversations = useAsync<Conversation[]>(() => api.messages.conversations(), []);
  // Resolve quem dá pra contatar (e o nome de quem já está na lista de conversas) — papel-consciente
  // no backend: operacional vê a coordenação, coordenador vê os creators (specs/06).
  const contacts = useAsync<MessageContact[]>(() => api.messages.contacts(), []);
  const [activeContact, setActiveContact] = useState<ActiveContact | null>(null);
  const [showThread, setShowThread] = useState(false); // só usado no modo mobile (lista OU conversa, nunca os dois)
  const [showPicker, setShowPicker] = useState(false);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeContactRef = useRef<ActiveContact | null>(null);

  const allConvs = conversations.data ?? [];
  const creName = (uid: string) => contacts.data?.find((c) => c.user_id === uid)?.name ?? (isMobile ? 'Coordenação' : 'Usuário');
  const convs = allConvs.filter((c) => creName(c.user_id).toLowerCase().includes(search.toLowerCase()));

  useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);

  // ao carregar, abre a conversa mais recente — só se já existir alguma (nada force-seleciona um contato sem histórico).
  useEffect(() => {
    if (!activeContact && allConvs.length > 0) setActiveContact({ userId: allConvs[0].user_id, name: creName(allConvs[0].user_id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConvs]);

  useEffect(() => {
    if (!activeContact) { setThread([]); return; }
    api.messages.thread(activeContact.userId).then(setThread);
  }, [activeContact]);

  // socket entrega mensagem de QUALQUER conversa do usuário — só anexa na thread aberta se for
  // dela; senão só recarrega a lista (pra aparecer o "última mensagem"/não-lidas atualizados).
  useEffect(() => {
    const socket = connectRealtime(getAuthToken());
    const off = socket.onMessage((m) => {
      if (activeContactRef.current && m.sender_id === activeContactRef.current.userId) {
        setThread((t) => (t.some((x) => x.id === m.id) ? t : [...t, m]));
      }
      conversations.reload();
    });
    return () => { off(); socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollTo({ top: 1e9 }); }, [thread]);

  async function send() {
    if (!draft.trim() || !activeContact || !user) return;
    const m = await api.messages.send(user.id, activeContact.userId, draft.trim());
    setThread((t) => [...t, m]);
    setDraft('');
    conversations.reload(); // se for o primeiro envio a um contato novo, ele passa a aparecer na lista
  }

  function selectConversation(userId: string) {
    setActiveContact({ userId, name: creName(userId) });
    if (isMobile) setShowThread(true);
  }

  function startConversationWith(contact: MessageContact) {
    setActiveContact({ userId: contact.user_id, name: contact.name });
    setShowPicker(false);
    if (isMobile) setShowThread(true);
  }

  const listPane = (
    <div style={{ width: isMobile ? '100%' : 300, flex: isMobile ? undefined : 'none', background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flex: 'none' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: isMobile ? '12px 15px' : '8px 12px' }}>
          <svg width={isMobile ? 17 : 14} height={isMobile ? 17 : 14} viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: isMobile ? 15 : 12.5, color: 'var(--tx)' }} />
        </div>
        <button onClick={() => setShowPicker(true)} title="Nova conversa" style={{ width: isMobile ? 46 : 36, height: isMobile ? 46 : 36, flex: 'none', borderRadius: 11, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(108,99,255,.35)' }}>
          <svg width={isMobile ? 19 : 16} height={isMobile ? 19 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {convs.length === 0 && <div style={{ padding: 12, fontSize: isMobile ? 14 : 12, color: 'var(--tx3)' }}>Nenhuma conversa ainda. Toque em + pra começar.</div>}
        {convs.map((c) => (
          <div key={c.user_id} onClick={() => selectConversation(c.user_id)} style={{ display: 'flex', gap: 12, padding: isMobile ? '14px 15px' : '11px 13px', borderRadius: 14, cursor: 'pointer', border: '1px solid ' + (c.user_id === activeContact?.userId ? 'rgba(108,99,255,.3)' : 'transparent'), background: c.user_id === activeContact?.userId ? 'rgba(108,99,255,.10)' : 'transparent' }}>
            <Avatar name={creName(c.user_id)} size={isMobile ? 50 : 42} seed={c.user_id} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}><span style={{ fontSize: isMobile ? 15.5 : 13, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creName(c.user_id)}</span></div>
              <div style={{ fontSize: isMobile ? 13.5 : 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.last_message}</div>
            </div>
            {c.unread > 0 && <span style={{ flex: 'none', alignSelf: 'center', minWidth: 20, height: 20, borderRadius: 10, background: 'var(--pri)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.unread}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const threadPane = (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, display: 'flex', flexDirection: 'column' }}>
      {!activeContact && <EmptyState title="Nenhuma conversa selecionada" hint="Toque em + pra começar uma conversa nova." />}
      {activeContact && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '17px 20px' : '14px 18px', borderBottom: '1px solid var(--line)' }}>
            {isMobile && (
              <button onClick={() => setShowThread(false)} style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
            <Avatar name={activeContact.name} size={isMobile ? 46 : 38} seed={activeContact.userId} />
            <div style={{ fontSize: isMobile ? 16.5 : 14, fontWeight: 700 }}>{activeContact.name}</div>
          </div>
          <div ref={endRef} style={{ flex: 1, overflowY: 'auto', maxHeight: isMobile ? '55vh' : undefined, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {thread.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem ainda. Diga olá!</div>}
            {thread.map((m) => {
              const me = m.sender_id === user?.id;
              const expanded = expandedMessageId === m.id;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '72%', padding: isMobile ? '13px 17px' : '10px 14px', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: isMobile ? 15.5 : 13, lineHeight: 1.45, background: me ? 'linear-gradient(135deg,#6C63FF,#8B5CF6)' : 'var(--bg3)', color: me ? '#fff' : 'var(--tx)', border: me ? 'none' : '1px solid var(--line)' }}>{m.message}</div>
                  <button onClick={() => setExpandedMessageId(expanded ? null : m.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 2px', fontSize: 10.5, color: 'var(--tx3)' }}>
                    {paperclipIcon} {expanded ? 'ocultar anexos' : 'anexos'}
                  </button>
                  {expanded && (
                    <div style={{ maxWidth: '85%', width: '100%', marginBottom: 4 }}>
                      <AttachmentUpload entityType="message" entityId={m.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ padding: isMobile ? '17px 20px' : '14px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Escreva uma mensagem…" style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: isMobile ? '13px 17px' : '11px 14px', fontSize: isMobile ? 15.5 : 13, color: 'var(--tx)', outline: 'none' }} />
            <button onClick={send} style={{ width: isMobile ? 48 : 40, height: isMobile ? 48 : 40, flex: 'none', borderRadius: 12, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(108,99,255,.4)' }}>
              <svg width={isMobile ? 20 : 17} height={isMobile ? 20 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );

  const pickerList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(contacts.data ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Nenhum contato disponível ainda.</div>}
      {(contacts.data ?? []).map((c) => (
        <div key={c.user_id} onClick={() => startConversationWith(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '13px 14px' : '10px 12px', borderRadius: 13, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--line)' }}>
          <Avatar name={c.name} size={isMobile ? 44 : 36} seed={c.user_id} />
          <span style={{ fontSize: isMobile ? 15 : 13, fontWeight: 600 }}>{c.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {isMobile ? <div className="cp-fade">{showThread ? threadPane : listPane}</div> : (
        <div className="cp-fade" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 62px - 52px)' }}>
          {listPane}
          {threadPane}
        </div>
      )}

      {showPicker && (isMobile
        ? <MobileScreen title="Nova conversa" onBack={() => setShowPicker(false)}>{pickerList}</MobileScreen>
        : <Modal open title="Nova conversa" subtitle="Escolha um creator pra começar" onClose={() => setShowPicker(false)}>{pickerList}</Modal>)}
    </>
  );
}
