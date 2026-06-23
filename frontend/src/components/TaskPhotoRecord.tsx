import { useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { resizeImageIfNeeded } from '@/lib/resizeImage';
import type { Attachment } from '@/types';

const MAX_PHOTOS = 10;

const cameraIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const trashIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>;

/**
 * "Registro da Tarefa" — PWA mobile (creator/colaborador): câmera direto (sem galeria/arquivo),
 * até 10 fotos, pode remover a própria. Isolado de TaskPhotoGallery (desktop/gestor, só
 * visualização) — pedido direto, sem lógica condicional compartilhada entre os dois fluxos.
 */
export function TaskPhotoRecord({ taskId }: { taskId: string }) {
  const { user } = useApp();
  const toast = useToast();
  const list = useAsync<Attachment[]>(() => api.attachments.list('task', taskId), [taskId]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const photos = list.data ?? [];
  const photoIds = photos.map((p) => p.id).join(',');

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    Promise.all(photos.map(async (p) => {
      const blob = await api.attachments.downloadBlob(p.id);
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return [p.id, url] as const;
    })).then((entries) => {
      if (alive) setPreviews(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoIds]);

  async function handleCapture(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    setProgress(0);
    try {
      const photo = await resizeImageIfNeeded(files[0]);
      await api.attachments.upload('task', taskId, photo, setProgress);
      list.reload();
    } catch (err) {
      toast.error('Não foi possível registrar a foto', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(photo: Attachment) {
    try {
      await api.attachments.remove(photo.id);
      list.reload();
    } catch (err) {
      toast.error('Não foi possível remover a foto', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  const canRemove = (p: Attachment) => user?.role !== 'operacional' || p.uploaded_by === user.id;

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleCapture(e.target.files); e.target.value = ''; }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const photo = photos[i];
          if (!photo) {
            const isNextSlot = i === photos.length;
            if (busy && isNextSlot) {
              return (
                <div key={`uploading-${i}`} style={{
                  aspectRatio: '1', borderRadius: 14, border: '2px dashed var(--line2)', background: 'var(--bg2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pri)' }}>{progress}%</span>
                  <div style={{ width: '60%', height: 4, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,var(--pri),var(--pri2))', transition: 'width .15s' }} />
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Enviando…</span>
                </div>
              );
            }
            return (
              <button key={`empty-${i}`} type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={{
                aspectRatio: '1', borderRadius: 14, border: '2px dashed var(--line2)', background: 'var(--bg2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: 'var(--tx3)', cursor: 'pointer', opacity: busy ? 0.6 : 1,
              }}>
                {cameraIcon}
                <span style={{ fontSize: 11 }}>Tirar foto</span>
              </button>
            );
          }
          return (
            <div key={photo.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: 'var(--bg3)' }}>
              {previews[photo.id] && (
                <img
                  src={previews[photo.id]}
                  alt={photo.file_name ?? 'Foto do registro'}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    pointerEvents: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
                  }}
                />
              )}
              {canRemove(photo) && (
                <button type="button" onClick={() => handleRemove(photo)} title="Remover foto" style={{
                  position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 8,
                  background: 'rgba(0,0,0,.55)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {trashIcon}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 8 }}>{photos.length}/{MAX_PHOTOS} fotos</div>
    </div>
  );
}
