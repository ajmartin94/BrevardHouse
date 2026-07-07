import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api, fmtRange } from '../api.js';
import { useApp, Modal } from '../App.jsx';

export default function Gallery() {
  const { user, isAdmin } = useApp();
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(null); // files chosen, awaiting caption/album
  const [big, setBig] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const load = useCallback(() => api('/photos').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    if (!data) return [];
    const byStay = new Map(), byProject = new Map(), loose = [];
    for (const p of data.photos) {
      if (p.stay_id && data.stays.find(s => s.id === p.stay_id)) {
        byStay.set(p.stay_id, [...(byStay.get(p.stay_id) || []), p]);
      } else if (p.project_id) {
        byProject.set(p.project_id, [...(byProject.get(p.project_id) || []), p]);
      } else loose.push(p);
    }
    const out = [];
    for (const s of data.stays) {
      if (byStay.has(s.id)) out.push({ key: 'stay-' + s.id, label: `${fmtRange(s.start_date, s.end_date)} — ${s.who_text}`, photos: byStay.get(s.id) });
    }
    for (const [pid, photos] of byProject) {
      const proj = data.projects.find(p => p.id === pid);
      out.push({ key: 'proj-' + pid, label: `Project: ${proj ? proj.title : '#' + pid}`, photos });
    }
    if (loose.length) out.push({ key: 'loose', label: 'Around the house', photos: loose });
    return out;
  }, [data]);

  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;

  async function del(p) {
    if (!confirm('Delete this photo? This can’t be undone.')) return;
    try { await api(`/photos/${p.id}`, { method: 'DELETE' }); setBig(null); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="row-between">
        <h1>Photo Gallery</h1>
        {/* PHO-1: one tap from the page to the picker */}
        <button className="btn btn-dark btn-sm" onClick={() => fileRef.current.click()}>+ Upload</button>
      </div>
      <p className="page-sub">Photos post immediately and sort themselves onto the matching trip.</p>
      {error && <div className="error">{error}</div>}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden aria-hidden
        onChange={e => e.target.files.length && setPending([...e.target.files])} />

      {groups.length === 0 && <p className="muted">No photos yet — yours can be first.</p>}
      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div className="kicker">{g.label}</div>
          <div className="photo-grid">
            {g.photos.map(p => (
              <button key={p.id} className="photo-cell" onClick={() => setBig(p)} aria-label={p.caption || 'photo'} style={{ position: 'relative' }}>
                <img src={p.thumb_url || p.url} alt={p.caption || 'House photo'} loading="lazy" />
                {/* PRJ-9: before/after visible in the project view too */}
                {p.phase && <span className="pill pill-pending" style={{ position: 'absolute', bottom: 4, left: 4 }}>{p.phase}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {pending && <UploadModal files={pending} stays={data.stays} onClose={() => { setPending(null); fileRef.current.value = ''; }}
        onDone={() => { setPending(null); fileRef.current.value = ''; load(); }} />}

      {big && (
        <div className="modal-back" onClick={() => setBig(null)}>
          <div className="modal lightbox" onClick={e => e.stopPropagation()}>
            <img src={big.url} alt={big.caption || 'House photo'} />
            <p className="muted">{big.caption || 'No caption'} — {big.uploader_name}{big.taken_at ? ` · ${big.taken_at}` : ''}</p>
            <div className="row">
              {(isAdmin || big.uploader_name === user.name) &&
                <button className="btn btn-danger grow" onClick={() => del(big)}>Delete</button>}
              <button className="btn grow" onClick={() => setBig(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// NFR-3: client-side thumbnail (max 480px JPEG) so grids never ship full-size originals
async function makeThumb(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 150 * 1024) return null; // already small
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
    return blob ? new File([blob], 'thumb.jpg', { type: 'image/jpeg' }) : null;
  } catch { return null; } // HEIC etc. may not decode — original is the fallback
}

// PHO-2: auto-matched to a stay by date; member can override with an explicit album
function UploadModal({ files, stays, onClose, onDone }) {
  const [caption, setCaption] = useState('');
  const [stayId, setStayId] = useState('auto');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError('');
    const fd = new FormData();
    const thumbMap = [];
    let ti = 0;
    for (const f of files) {
      fd.append('photos', f);
      const t = await makeThumb(f);
      if (t) { fd.append('thumbs', t); thumbMap.push(ti++); } else thumbMap.push(-1);
    }
    fd.append('thumb_map', JSON.stringify(thumbMap));
    fd.append('caption', caption);
    fd.append('taken', JSON.stringify(files.map(f => f.lastModified)));
    if (stayId !== 'auto') fd.append('stay_id', stayId);
    try { await api('/photos', { body: fd }); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <Modal title={`Upload ${files.length} photo${files.length === 1 ? '' : 's'}`} onClose={onClose}>
      <label htmlFor="up-caption">Caption (optional)</label>
      <input id="up-caption" value={caption} onChange={e => setCaption(e.target.value)} />
      <label htmlFor="up-album">Album</label>
      <select id="up-album" value={stayId} onChange={e => setStayId(e.target.value)}>
        <option value="auto">Auto — match to the trip by photo date</option>
        {stays.map(s => <option key={s.id} value={s.id}>{fmtRange(s.start_date, s.end_date)} — {s.who_text}</option>)}
      </select>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt" onClick={submit} disabled={busy}>
        {busy ? 'Uploading…' : 'Upload — posts immediately'}
      </button>
    </Modal>
  );
}
