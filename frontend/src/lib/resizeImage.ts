const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Redimensiona/comprime uma foto antes do upload — fotos de câmera saem grandes (8-12MB),
 * isso cai pra ~200-400KB sem perda visível pro caso de uso (prova de execução, não material de
 * edição). Resolve upload E visualização (o "thumb" do grid é o mesmo arquivo, baixado de novo —
 * sem isso toda preview baixava o arquivo original inteiro). Documentos (PDF etc.) passam direto.
 */
export async function resizeImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file; // recompressão não ajudou (raro) — mantém o original

    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // formato que o navegador não decodifica (ex.: HEIC não convertido) — sobe o original, não trava o fluxo.
  }
}
