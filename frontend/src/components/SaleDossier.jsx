import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Download, FileText, FolderOpen, Calendar, UserRound } from 'lucide-react';
import { documentsApi } from '../lib/api';

const categories = { ownership: 'Titularidad del lote', client: 'Documentos del cliente', contract: 'Contratos y firmas', payment: 'Comprobantes de pago', other: 'Otros documentos' };
const states = { reserved: 'Apartado', option_signed: 'Opción firmada', contract_signed: 'Contrato firmado', financing: 'Financiamiento', paid: 'Pagado', cancelled: 'Cancelado', reversed: 'Reversado' };
const date = value => value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha registrada';
const size = value => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
const cleanName = name => name?.replace(/^dec::/, '') || 'Sin nombre';
function errorMessage(err, fallback) { const detail = err.response?.data?.detail; return typeof detail === 'string' ? detail : fallback; }

function ReservationDeadline({ sale }) {
  if (!sale.reservation_expires_at) return <p className="dossier-muted">Este registro no tiene fecha de vencimiento de apartado.</p>;
  const remaining = Math.max(0, Math.ceil((new Date(sale.reservation_expires_at) - Date.now()) / 86400000));
  return <div className={`dossier-deadline ${sale.status === 'reserved' && remaining === 0 ? 'expired' : ''}`}>
    <Calendar size={18}/><div><strong>{sale.status === 'reserved' ? remaining ? `${remaining} día${remaining === 1 ? '' : 's'} para concluir el apartado` : 'Plazo de apartado vencido' : 'Plazo original del apartado'}</strong><span>Vencimiento: {date(sale.reservation_expires_at)}</span></div>
  </div>;
}

function DocumentArchive({ record, initialUpload, onUploaded, onBusyChange }) {
  const [showUpload, setShowUpload] = useState(initialUpload);
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('client');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(null);
  const input = useRef(null);
  useEffect(() => {
    if (showUpload) input.current?.closest('form')?.scrollIntoView({ block: 'start' });
  }, [showUpload]);
  const saleId = record.sale.id;
  const documents = record.documents;
  async function upload(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!files.length || files.length > 10) { setError('Selecciona entre 1 y 10 archivos.'); return; }
    if (files.some(file => file.size === 0 || file.size > 10 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) { setError('Máximo 10 MB por archivo y 50 MB por carga. No se admiten archivos vacíos.'); return; }
    const body = new FormData();
    body.append('category', category); body.append('description', description);
    files.forEach(file => body.append('files', file));
    setBusy(true); onBusyChange(1); setProgress(0);
    try {
      const result = await documentsApi.upload(saleId, body, e => setProgress(e.total ? Math.round(e.loaded * 100 / e.total) : 0));
      onUploaded(saleId, result.data); setFiles([]); setDescription(''); input.current.value = '';
      setSuccess(`${result.data.length} archivo${result.data.length === 1 ? '' : 's'} guardado${result.data.length === 1 ? '' : 's'}. Ya se puede consultar en Ventas y Clientes.`);
    } catch (err) { setError(errorMessage(err, 'No se pudieron guardar los archivos. Reintenta la carga.')); }
    finally { setBusy(false); onBusyChange(-1); }
  }
  async function download(doc) {
    if (downloading) return;
    setDownloading(doc.id); setError('');
    try {
      const response = await documentsApi.download(saleId, doc.id);
      const url = URL.createObjectURL(response.data), link = document.createElement('a');
      link.href = url; link.download = doc.filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError('No se pudo descargar el documento. Revisa tu sesión y vuelve a intentarlo.'); }
    finally { setDownloading(null); }
  }
  return <section className="document-archive" aria-label={`Archivos de la venta ${saleId}`}>
    <div className="dossier-section-heading"><div><h3><FolderOpen size={18}/> Archivos del expediente</h3><p>{documents.length} documento{documents.length === 1 ? '' : 's'} · Compartidos con la ficha del cliente</p></div><button type="button" className="btn-primary" onClick={() => setShowUpload(!showUpload)} aria-expanded={showUpload}><Upload size={15}/>{showUpload ? 'Cerrar carga' : 'Subir archivos'}</button></div>
    {showUpload && <form onSubmit={upload} className="document-upload">
      <div className="document-fields"><label>Tipo de documento<select className="input" value={category} disabled={busy} onChange={e => setCategory(e.target.value)}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Descripción (opcional)<input className="input" value={description} maxLength={2000} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder="Ej. escritura, identificación o contrato firmado"/></label></div>
      <label className="document-drop"><Upload size={24}/><strong>Selecciona los archivos para este expediente</strong><span>PDF, JPG, PNG, WebP, Word (.docx), Excel (.xlsx) o TXT.<br/>Hasta 10 archivos por carga; 10 MB por archivo y 50 MB en total.</span><input ref={input} aria-label="Seleccionar archivos" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt" disabled={busy} onChange={e => { setFiles([...e.target.files]); setError(''); setSuccess(''); }}/></label>
      {!!files.length && <ul className="document-pending">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><small>{size(file.size)}</small></li>)}</ul>}
      {busy && <div role="status"><progress value={progress} max="100"/>{progress === 100 ? 'Guardando en el expediente…' : `Subiendo archivos… ${progress}%`}</div>}
      <button className="btn-primary" disabled={busy || !files.length}><Upload size={15}/>{busy ? 'Guardando…' : 'Guardar archivos'}</button>
    </form>}
    {error && <p className="dossier-error" role="alert">{error}</p>}{success && <p className="dossier-success" role="status">{success}</p>}
    {!documents.length && <div className="document-empty"><FileText size={25}/><strong>El expediente todavía no tiene archivos</strong><p>Agrega los documentos del cliente y del terreno para mantenerlos organizados en esta venta.</p></div>}
    {Object.entries(categories).map(([key, label]) => {
      const group = documents.filter(doc => doc.category === key);
      return group.length ? <div className="document-category" key={key}><h4>{label} <span>{group.length}</span></h4>{group.map(doc => <article className="document-row" key={doc.id}><FileText size={19}/><div><strong>{doc.filename}</strong>{doc.description && <p>{doc.description}</p>}<small>{size(doc.size_bytes)} · Subido el {date(doc.created_at)}</small></div><button type="button" className="btn-secondary" disabled={!!downloading} onClick={() => download(doc)} aria-label={`Descargar ${doc.filename}`}><Download size={15}/><span>{downloading === doc.id ? 'Descargando…' : 'Descargar'}</span></button></article>)}</div> : null;
    })}
  </section>;
}

export default function SaleDossier({ saleId, clientId, initialUpload = false, onClose, onEditClient }) {
  const [pendingUploads, setPendingUploads] = useState(0);
  const busyChange = delta => setPendingUploads(n => Math.max(0, n + delta));
  const dialog = useRef(null), [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true; setData(null); setError('');
    (saleId ? documentsApi.sale(saleId) : documentsApi.client(clientId)).then(r => { if (active) setData(r.data); }).catch(err => { if (active) setError(errorMessage(err, 'No se pudo cargar el expediente.')); });
    return () => { active = false; };
  }, [saleId, clientId, reload]);
  const records = data ? saleId ? [data] : data.sales : [];
  function uploaded(id, docs) {
    setData(previous => saleId ? { ...previous, documents: [...docs, ...previous.documents] } : { ...previous, sales: previous.sales.map(record => record.sale.id === id ? { ...record, documents: [...docs, ...record.documents] } : record) });
  }
  return createPortal(<dialog ref={dialog} className="dossier-dialog" aria-labelledby="dossier-title" onCancel={e => { if (pendingUploads) e.preventDefault(); else onClose(); }} onClose={onClose}>
    <header className="dossier-header"><div><span>EXPEDIENTE DIGITAL</span><h2 id="dossier-title">{saleId ? `Venta #${saleId}` : 'Ficha del cliente'}</h2></div><button type="button" className="crm-icon-button" onClick={onClose} disabled={pendingUploads > 0} aria-label="Cerrar expediente"><X size={21}/></button></header>
    <div className="dossier-body">
      {error ? <div role="alert" className="dossier-error">{error} <button className="btn-secondary" onClick={() => setReload(x => x + 1)}>Reintentar</button></div> : !data ? <p role="status">Cargando expediente…</p> : <>
        {data.client && <section className="dossier-client"><div className="dossier-section-heading"><h3><UserRound size={18}/>{cleanName(data.client.full_name)}</h3>{onEditClient && <button className="btn-secondary" disabled={pendingUploads > 0} onClick={() => onEditClient(data.client)}>Editar información</button>}</div><dl><div><dt>Teléfono</dt><dd>{data.client.phone || 'Sin registrar'}</dd></div><div><dt>Correo</dt><dd>{data.client.email || 'Sin registrar'}</dd></div><div><dt>Dirección</dt><dd>{data.client.address || 'Sin registrar'}</dd></div></dl>{data.client.notes && <p className="dossier-client-notes">{data.client.notes}</p>}</section>}
        {!records.length && <div className="document-empty"><FolderOpen size={28}/><strong>Este cliente todavía no tiene ventas vinculadas</strong><p>Al abrir una venta, sus documentos aparecerán aquí organizados por lote.</p></div>}
        {records.map((record, i) => <details className="dossier-sale" key={record.sale.id} open={!!saleId || i === 0}><summary><div><strong>{record.lot?.project || 'Proyecto'} · {record.lot?.block ? `Manzana ${record.lot.block.replace(/^M/i, '')} · ` : ''}Lote {record.lot?.number || record.sale.lot_id}</strong><span>Venta #{record.sale.id} · {states[record.sale.status] || record.sale.status} · {record.documents.length} documentos</span></div></summary><div className="dossier-sale-body"><div className="dossier-sale-facts"><span>Superficie <b>{record.lot?.area_sqm?.toLocaleString('es-MX')} m²</b></span><span>Precio de venta <b>${record.sale.sale_price.toLocaleString('es-MX')} MXN</b></span></div><ReservationDeadline sale={record.sale}/><DocumentArchive record={record} initialUpload={initialUpload && !!saleId} onUploaded={uploaded} onBusyChange={busyChange}/></div></details>)}
      </>}
    </div>
  </dialog>, document.body);
}
