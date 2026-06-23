import { useRef, useState, type CSSProperties } from 'react';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { resizeImageIfNeeded } from '@/lib/resizeImage';
import { formatFileSize } from '@/lib/display';
import type { Attachment, AttachmentEntity } from '@/types';

const fileIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
const cameraIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const paperclipIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
const trashIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" /></svg>;

const ATTACH_BTN_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--line)',
  borderRadius: 10, padding: '7px 12px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer',
};

/** Anexar arquivo/foto/câmera em qualquer entidade (task/service/absence/shift/message) — storage é disco local no backend. */
export function AttachmentUpload({ entityType, entityId }: { entityType: AttachmentEntity; entityId: string }) {
  const { user } = useApp();
  const toast = useToast();
  const list = useAsync<Attachment[]>(() => api.attachments.list(entityType, entityId), [entityType, entityId]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      const selected = Array.from(files);
      for (let i = 0; i < selected.length; i++) {
        setProgress(0);
        setUploadLabel(selected.length > 1 ? `Enviando ${i + 1}/${selected.length}` : 'Enviando');
        const file = await resizeImageIfNeeded(selected[i]);
        await api.attachments.upload(entityType, entityId, file, setProgress);
      }
      list.reload();
      toast.success(files.length > 1 ? 'Anexos enviados' : 'Anexo enviado');
    } catch (err) {
      toast.error('Não foi possível enviar o anexo', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(attachment: Attachment) {
    try {
      const blob = await api.attachments.downloadBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error('Não foi possível abrir o anexo', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleRemove(attachment: Attachment) {
    try {
      await api.attachments.remove(attachment.id);
      list.reload();
    } catch (err) {
      toast.error('Não foi possível excluir o anexo', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  const canRemove = (a: Attachment) => user?.role !== 'operacional' || a.uploaded_by === user.id;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} style={{ ...ATTACH_BTN_STYLE, opacity: busy ? 0.6 : 1 }}>
          {paperclipIcon} Anexar arquivo
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={busy} style={{ ...ATTACH_BTN_STYLE, opacity: busy ? 0.6 : 1 }}>
          {cameraIcon} Tirar foto
        </button>
      </div>
      <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />

      {busy && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--tx3)', marginBottom: 4 }}>
            <span>{uploadLabel}</span><span>{progress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,var(--pri),var(--pri2))', transition: 'width .15s' }} />
          </div>
        </div>
      )}

      {(list.data?.length ?? 0) === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Nenhum anexo ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.data!.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, fontSize: 12.5 }}>
              <span style={{ color: 'var(--tx3)', display: 'flex' }}>{fileIcon}</span>
              <span onClick={() => handleOpen(a)} style={{ flex: 1, cursor: 'pointer', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.file_name ?? 'arquivo'}
              </span>
              <span style={{ color: 'var(--tx3)', fontSize: 11, flexShrink: 0 }}>{formatFileSize(a.size_bytes)}</span>
              {canRemove(a) && (
                <span onClick={() => handleRemove(a)} style={{ cursor: 'pointer', color: 'var(--red)', flexShrink: 0, display: 'flex' }}>{trashIcon}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
