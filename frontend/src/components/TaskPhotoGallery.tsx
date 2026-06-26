import { useEffect, useState } from 'react';
import { Download, FormClose, FormPrevious, FormNext } from 'grommet-icons';
import { api } from '@/api';
import { useToast } from '@/context/ToastContext';
import { useRealtimeRefresh } from '@/context/NotificationsContext';
import { useAsync } from '@/lib/useAsync';
import { downloadBlob } from '@/lib/download';
import type { Attachment, NotificationType } from '@/types';

const downloadIcon = <Download color="currentColor" size="small" />;
const closeIcon = <FormClose color="currentColor" size="small" />;
const chevronLeft = <FormPrevious color="currentColor" style={{ width: 20, height: 20 }} />;
const chevronRight = <FormNext color="currentColor" style={{ width: 20, height: 20 }} />;

const THUMB_SIZE = 92;
const REGISTRO_TAREFA_TYPES: NotificationType[] = ['registro_tarefa'];

/**
 * "Registro da Tarefa" — desktop (gestor): só visualização do que foi registrado pelo PWA.
 * Clicar num thumbnail abre um carrossel (setas/teclado, com baixar). Isolado de
 * TaskPhotoRecord (mobile, que faz a captura) — sem lógica condicional compartilhada.
 */
export function TaskPhotoGallery({ taskId }: { taskId: string }) {
  const toast = useToast();
  const list = useAsync<Attachment[]>(() => api.attachments.list('task', taskId), [taskId]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // creator registrou foto nova enquanto o gestor está com esse modal aberto — atualiza ao vivo, sem precisar fechar e reabrir.
  useRealtimeRefresh(REGISTRO_TAREFA_TYPES, list.reload);

  const photos = list.data ?? [];
  const photoIds = photos.map((p) => p.id).join(',');
  const expanded = expandedIndex !== null ? photos[expandedIndex] : null;

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

  function goPrev() {
    setExpandedIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }
  function goNext() {
    setExpandedIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }

  useEffect(() => {
    if (expandedIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpandedIndex(null);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedIndex, photos.length]);

  async function handleDownload(photo: Attachment) {
    try {
      const blob = await api.attachments.downloadBlob(photo.id);
      downloadBlob(blob, photo.file_name ?? 'foto.jpg');
    } catch (err) {
      toast.error('Não foi possível baixar a foto', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  if (photos.length === 0) {
    return <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Nenhuma foto registrada ainda.</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setExpandedIndex(i)}
            title={photo.file_name ?? 'Foto do registro'}
            style={{
              width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--line)', background: 'var(--bg3)', padding: 0, cursor: 'pointer',
            }}
          >
            {previews[photo.id] && (
              <img
                src={previews[photo.id]}
                alt={photo.file_name ?? 'Foto do registro'}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
              />
            )}
          </button>
        ))}
      </div>

      {expanded && (
        <div
          onClick={() => setExpandedIndex(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,4,8,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
          }}
        >
          <button type="button" onClick={() => setExpandedIndex(null)} title="Fechar" style={{
            position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {closeIcon}
          </button>

          {photos.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); goPrev(); }} title="Anterior" style={{
              position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {chevronLeft}
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }}>
            {previews[expanded.id] && (
              <img
                src={previews[expanded.id]}
                alt={expanded.file_name ?? 'Foto do registro'}
                draggable={false}
                style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12, display: 'block', userSelect: 'none' }}
              />
            )}
            <button type="button" onClick={() => handleDownload(expanded)} title="Baixar foto" style={{
              position: 'absolute', bottom: 14, right: 14, width: 40, height: 40, borderRadius: 11,
              background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {downloadIcon}
            </button>
            {photos.length > 1 && (
              <span style={{
                position: 'absolute', bottom: 14, left: 14, fontSize: 12, fontWeight: 600, color: '#fff',
                background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '6px 10px',
              }}>
                {expandedIndex! + 1} / {photos.length}
              </span>
            )}
          </div>

          {photos.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); goNext(); }} title="Próxima" style={{
              position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {chevronRight}
            </button>
          )}
        </div>
      )}
    </>
  );
}
