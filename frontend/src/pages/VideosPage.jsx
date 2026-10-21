import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Video, Play, UploadCloud, Search, X, CheckCircle2, Film, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { tutorialsApi } from '../lib/api';
import { tutorialUploadError } from '../lib/tutorialUpload';
import DeleteTutorialDialog from '../components/DeleteTutorialDialog';
import './VideosPage.css';

const MAX_BYTES = 200 * 1024 * 1024;
const errorText = (error, fallback) => typeof error.response?.data?.detail === 'string' ? error.response.data.detail : fallback;
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Player({ tutorial, onClose }) {
  const dialog = useRef(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setUrl(''); setError('');
    tutorialsApi.play(tutorial.id).then(res => { if (active) setUrl(res.data.url); })
      .catch(err => { if (active) setError(errorText(err, 'No se pudo abrir el video.')); });
    return () => { active = false; };
  }, [tutorial.id, attempt]);
  return createPortal(<dialog ref={dialog} className="tutorial-player" aria-labelledby="tutorial-player-title" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <header><div><span className="tutorial-eyebrow">TUTORIAL R&F</span><h2 id="tutorial-player-title">{tutorial.title}</h2></div><button className="tutorial-icon" onClick={onClose} aria-label="Cerrar video" autoFocus><X size={21}/></button></header>
    <div className="tutorial-screen">
      {error ? <div role="alert"><p>{error}</p><button className="btn-secondary mt-4" onClick={() => setAttempt(value => value + 1)}>Volver a abrir</button></div> : url ?
        <video key={url} controls playsInline preload="metadata" src={url} onError={() => setError('No se pudo reproducir. Vuelve a abrir el video; si continúa, pide a Sistemas una versión MP4 con video H.264 y audio AAC.')} aria-label={tutorial.title} /> : <p role="status">Abriendo tutorial…</p>}
    </div>
    {tutorial.description && <p className="tutorial-player-description">{tutorial.description}</p>}
  </dialog>, document.body);
}

export default function VideosPage() {
  const { user } = useAuth();
  const canUpload = user?.role === 'SISTEMAS';
  const canDelete = canUpload || user?.role === 'ADMIN';
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [deleteVideo, setDeleteVideo] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const libraryHeading = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const fileInput = useRef(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('preparing');
  const attempt = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setLoadError('');
    try { setVideos((await tutorialsApi.list()).data); }
    catch (error) { setLoadError(errorText(error, 'No se pudieron cargar los tutoriales.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  function chooseFile(e) {
    const chosen = e.target.files?.[0];
    setMessage(''); setUploadError(''); setFile(null);
    if (!chosen) return;
    if (!/\.(mp4|webm)$/i.test(chosen.name) || chosen.size === 0 || chosen.size > MAX_BYTES) {
      setUploadError('Selecciona un MP4 o WebM de hasta 200 MB.');
      e.target.value = ''; return;
    }
    setFile(chosen);
    if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, '').slice(0, 160));
  }
  async function upload(e) {
    e.preventDefault();
    if (busyRef.current || !file || !title.trim()) return;
    busyRef.current = true; setBusy(true); setProgress(0); setStage('preparing'); setUploadError(''); setMessage('');
    const previous = attempt.current;
    if (!previous || previous.file !== file || previous.title !== title.trim() || previous.description !== description.trim()) {
      if (previous) tutorialsApi.cancelUpload(previous.id).catch(() => {});
      attempt.current = { id: crypto.randomUUID(), file, title: title.trim(), description: description.trim() };
    }
    try {
      const res = await tutorialsApi.upload(attempt.current, ({ percent, stage }) => { setProgress(percent); setStage(stage); });
      setVideos(items => [res.data, ...items.filter(item => item.id !== res.data.id)]);
      attempt.current = null;
      setTitle(''); setDescription(''); setFile(null); fileInput.current.value = '';
      setMessage('Tutorial publicado. Los administradores ya pueden verlo.');
    } catch (error) {
      setUploadError(tutorialUploadError(error));
      if (error.response?.status === 410) attempt.current = null;
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  const visible = videos.filter(video => normalize(`${video.title} ${video.description}`).includes(normalize(query)));
  return <div className="tutorial-page">
    <section className="tutorial-hero">
      <div><span className="tutorial-eyebrow">CENTRO DE APRENDIZAJE</span><h1>{canUpload ? 'Comparte lo que sabes.' : 'Tu plataforma, paso a paso.'}</h1><p>{canUpload ? 'Publica tutoriales claros para acompañar al equipo en su día a día.' : 'Aprende a usar el CRM con los videos preparados por Sistemas.'}</p></div>
      <div className="tutorial-hero-icon" aria-hidden="true"><Video size={44} strokeWidth={1.2}/></div>
    </section>
    {canUpload && <section className="card tutorial-upload" aria-labelledby="upload-title">
      <div className="tutorial-section-heading"><span className="tutorial-symbol"><UploadCloud size={22}/></span><div><h2 id="upload-title">Subir video</h2><p>Visible para los administradores al terminar la carga.</p></div></div>
      <form onSubmit={upload}>
        <fieldset disabled={busy} className="tutorial-upload-fields">
          <div className="tutorial-form-copy">
            <label>Título del tutorial<input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Cómo registrar un nuevo cliente" required maxLength={160}/></label>
            <label>Descripción <span>(opcional)</span><textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Explica brevemente qué aprenderá el equipo." maxLength={2000}/></label>
          </div>
          <div className="tutorial-file-area"><Film size={32} strokeWidth={1.3}/><label htmlFor="tutorial-file">Selecciona tu video</label><input ref={fileInput} id="tutorial-file" type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={chooseFile} required aria-describedby="video-format"/><p id="video-format">MP4 o WebM · Máximo 200 MB<br/>Para mayor compatibilidad: MP4, H.264 y AAC.</p>{file && <p className="tutorial-file-name">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}</div>
        </fieldset>
        {busy && <div className="tutorial-progress" role="status"><progress max="100" value={progress} aria-label="Progreso de carga"/><span>{stage === 'preparing' ? 'Preparando carga segura…' : stage === 'retrying' ? `Reintentando la parte pendiente… ${progress}%` : stage === 'finishing' ? 'Verificando y publicando el video…' : `Subiendo archivo… ${progress}%`}</span></div>}
        {uploadError && <p className="tutorial-error" role="alert">{uploadError}</p>}
        {message && <p className="tutorial-success" role="status"><CheckCircle2 size={18}/>{message}</p>}
        <div className="tutorial-upload-footer"><p>{uploadError && attempt.current ? 'Reintenta aquí para continuar con las partes guardadas.' : 'Los videos se guardan de forma privada.'}</p><button className="btn-primary" disabled={busy || !file || !title.trim()}><UploadCloud size={17}/>{busy ? 'Publicando…' : uploadError && attempt.current ? 'Reintentar carga' : 'Publicar tutorial'}</button></div>
      </form>
    </section>}
    <section aria-labelledby="library-title">
      <div className="tutorial-library-heading"><div><h2 id="library-title" ref={libraryHeading} tabIndex={-1}>Ver videos</h2><p>{videos.length} {videos.length === 1 ? 'tutorial disponible' : 'tutoriales disponibles'}</p></div><label className="tutorial-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar un tutorial" aria-label="Buscar un tutorial"/></label></div>
      {deleteMessage && <p className="tutorial-success tutorial-delete-feedback" role="status"><CheckCircle2 size={18}/>{deleteMessage}</p>}
      {loading ? <div className="card tutorial-empty" role="status">Cargando tutoriales…</div> : loadError ? <div className="card tutorial-empty" role="alert"><p>{loadError}</p><button className="btn-secondary" onClick={load}>Reintentar</button></div> : !visible.length ? <div className="card tutorial-empty"><Video size={35} strokeWidth={1.2}/><h3>{query ? 'Sin coincidencias' : 'Pronto, más formas de aprender'}</h3><p>{query ? 'Prueba con otro nombre o tema.' : canUpload ? 'Sube el primer tutorial para tu equipo.' : 'Aquí aparecerán los tutoriales que publique Sistemas.'}</p></div> : <div className="tutorial-grid">{visible.map((video, index) => <article key={video.id} className="card tutorial-card"><button type="button" className="tutorial-card-open" onClick={() => setSelected(video)} aria-label={`Ver ${video.title}`}>
        <div className={`tutorial-cover tutorial-cover-${index % 3}`}><span className="tutorial-cover-brand">R&F <span>APRENDE</span></span><span className="tutorial-play"><Play size={25} fill="currentColor"/></span><span className="tutorial-cover-caption">GUÍA DE LA PLATAFORMA</span></div>
        <div className="tutorial-card-body"><span className="tutorial-date">{new Date(video.created_at).toLocaleDateString('es-MX', {day:'numeric', month:'long', year:'numeric'})}</span><h3>{video.title}</h3><p>{video.description || 'Abre el video para seguir el tutorial.'}</p><span className="tutorial-card-link">Ver tutorial <Play size={13}/></span></div>
      </button>{canDelete && <div className="tutorial-card-actions"><button type="button" className="client-delete-trigger" aria-label={`Eliminar video: ${video.title}`} onClick={() => { setDeleteMessage(''); setDeleteVideo(video); }}><Trash2 size={16} aria-hidden="true"/>Eliminar video</button></div>}</article>)}</div>}
    </section>
    {selected && <Player key={selected.id} tutorial={selected} onClose={() => setSelected(null)}/>}
    {deleteVideo && <DeleteTutorialDialog key={deleteVideo.id} tutorial={deleteVideo} onClose={() => setDeleteVideo(null)} onDeleted={id => {
      setVideos(items => items.filter(video => video.id !== id));
      setDeleteVideo(null);
      if (selected?.id === id) setSelected(null);
      setDeleteMessage('Video eliminado. Ya no está disponible en la biblioteca.');
      requestAnimationFrame(() => libraryHeading.current?.focus());
    }}/>}
  </div>;
}
