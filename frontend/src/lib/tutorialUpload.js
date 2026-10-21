import axios from 'axios';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function retry(operation, onRetry) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const status = error.response?.status;
      if (attempt >= 2 || (status && status !== 408 && status !== 429 && status < 500)) throw error;
      onRetry?.();
      await pause(1000 * 2 ** attempt);
    }
  }
}

// Use an isolated client: never forward a CRM bearer token or cookies to storage.
const storage = axios.create({ withCredentials: false });

export async function uploadTutorial(api, { id, title, description, file }, onProgress) {
  const report = (percent, stage) => onProgress?.({ percent, stage });
  report(0, 'preparing');
  const plan = (await retry(() => api.post('/tutorials/uploads', {
    id, title, description, filename: file.name, size_bytes: file.size,
  }, { timeout: 60000 }), () => report(0, 'retrying'))).data;
  if (plan.tutorial) return { data: plan.tutorial };
  let confirmed = plan.uploaded ? file.size : plan.parts.filter(p => p.received).reduce((sum, p) => sum + p.size, 0);
  for (const part of plan.parts) {
    if (part.received) continue;
    const url = new URL(part.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.backblazeb2.com')) {
      throw new Error('Dirección de almacenamiento no válida.');
    }
    await retry(() => storage.put(part.url, file.slice(part.start, part.start + part.size), {
      headers: { 'Content-Type': 'application/octet-stream' }, timeout: 300000,
      onUploadProgress: event => report(Math.min(99, Math.floor((confirmed + Math.min(event.loaded, part.size)) / file.size * 100)), 'uploading'),
    }), () => report(Math.min(99, Math.floor(confirmed / file.size * 100)), 'retrying'));
    confirmed += part.size;
    report(Math.min(99, Math.floor(confirmed / file.size * 100)), 'uploading');
  }
  report(99, 'finishing');
  // Completion is idempotent: retrying cannot publish a duplicate tutorial.
  const result = await retry(() => api.post(`/tutorials/uploads/${id}/complete`, {}, { timeout: 60000 }),
    () => report(99, 'finishing'));
  report(100, 'complete');
  return result;
}

export function tutorialUploadError(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  const status = error.response?.status;
  if (status === 401) return 'Tu sesión venció. Inicia sesión de nuevo para continuar.';
  if (status === 403) return 'No se pudo autorizar la carga. Reintenta para renovar el permiso; si continúa, revisa la configuración de Backblaze.';
  if (status === 413) return 'El video supera el límite de 200 MB.';
  if (status >= 500) return `El servidor no pudo completar la carga (error ${status}). Puedes reintentar para continuar con las partes guardadas.`;
  if (status === 429) return 'Hay demasiadas solicitudes. Espera un momento y reintenta.';
  if (!status) return 'Se interrumpió la comunicación con el almacenamiento. Reintenta para continuar; si se repite, revisa la configuración del servidor y de Backblaze.';
  return 'No se pudo publicar el video. Reintenta; las partes recibidas se conservan durante 24 horas.';
}
