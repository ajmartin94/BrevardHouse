import React, { useEffect, useState, useCallback } from 'react';
import { api, timeAgo } from '../api.js';
import { useApp, Modal, StatusPill } from '../App.jsx';

export default function Projects() {
  const { user, isAdmin } = useApp();
  const [tab, setTab] = useState('maintenance');
  const [data, setData] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [contribFor, setContribFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/projects').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;
  const projects = data.projects.filter(p => p.category === tab);

  async function act(path, body) {
    try { await api(path, { body: body || {} }); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="row-between">
        <h1>House Projects</h1>
        <button className="btn btn-dark btn-sm" onClick={() => setFormOpen(o => !o)}>{formOpen ? 'Cancel' : '+ New project'}</button>
      </div>
      <p className="page-sub">Anyone can create a project, claim one, or log work. Creators (and admins) edit details.</p>
      {error && <div className="error">{error}</div>}

      {formOpen && <NewProjectForm tab={tab} onDone={() => { setFormOpen(false); load(); }} />}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'maintenance'} className={tab === 'maintenance' ? 'on' : ''} onClick={() => setTab('maintenance')}>Maintenance</button>
        <button role="tab" aria-selected={tab === 'special'} className={tab === 'special' ? 'on' : ''} onClick={() => setTab('special')}>Special Projects</button>
      </div>

      {projects.length === 0 && <p className="muted">Nothing here yet.</p>}
      {projects.map(p => (
        <div className="card" key={p.id}>
          <div className="row-between">
            <b style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{p.title}</b>
            <span className="row">
              {p.source === 'report' && <span className="pill pill-report">Reported</span>}
              <StatusPill status={p.status} />
            </span>
          </div>
          {(p.estimated_cost || p.estimated_time) && (
            <div className="muted" style={{ marginTop: 5 }}>Est. {p.estimated_cost || '—'} · {p.estimated_time || '—'}</div>
          )}
          {p.description && <p style={{ fontSize: 13, margin: '7px 0 0', whiteSpace: 'pre-wrap' }}>{p.description}</p>}
          <div className="muted" style={{ marginTop: 6 }}>
            Created by {p.creator_name}{p.claimant_name ? <> · <b style={{ color: 'var(--olive-dark)' }}>claimed by {p.claimant_name}</b></> : ''}
          </div>

          {p.photos.length > 0 && (
            <div className="strip mt">
              {p.photos.map(ph => (
                <span key={ph.id} className="photo-cell" style={{ position: 'relative' }}>
                  <img src={ph.thumb_url || ph.url} alt={ph.caption || 'Project photo'} loading="lazy" />
                  {ph.phase && <span className="pill pill-pending" style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 9 }}>{ph.phase}</span>}
                </span>
              ))}
            </div>
          )}

          {p.contributions.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(58,47,40,0.08)', marginTop: 10, paddingTop: 6 }}>
              {p.contributions.map(c => (
                <div className="feed-item" key={c.id} style={{ borderTop: 'none', padding: '5px 0' }}>
                  <div className="feed-dot" aria-hidden />
                  <div><b>{c.user_name}</b> — {c.note} <span className="muted">· {timeAgo(c.created_at)}</span></div>
                </div>
              ))}
            </div>
          )}

          <div className="row wrap mt">
            <button className="btn btn-dark btn-sm" onClick={() => setContribFor(p)}>+ Log work</button>
            {!p.claimed_by && <button className="btn btn-sm" onClick={() => act(`/projects/${p.id}/claim`)}>I'll take this</button>}
            {p.claimed_by && (p.claimant_name === user.name || isAdmin) &&
              <button className="btn btn-sm" onClick={() => act(`/projects/${p.id}/claim`, { unclaim: true })}>Unclaim</button>}
            {p.can_edit && (<>
              <select className="btn btn-sm" style={{ width: 'auto' }} value={p.status} aria-label={`Status of ${p.title}`}
                onChange={e => act(`/projects/${p.id}/status`, { status: e.target.value })}>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <button className="btn btn-sm" onClick={() => setEditFor(p)}>Edit</button>
            </>)}
            {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => confirm(`Archive “${p.title}”? It disappears from the list.`) && act(`/projects/${p.id}/archive`)}>Archive</button>}
          </div>
        </div>
      ))}

      {contribFor && <ContribModal project={contribFor} onClose={() => setContribFor(null)} onDone={() => { setContribFor(null); load(); }} />}
      {editFor && <EditModal project={editFor} onClose={() => setEditFor(null)} onDone={() => { setEditFor(null); load(); }} />}
    </div>
  );
}

function NewProjectForm({ tab, onDone }) {
  const [f, setF] = useState({ title: '', description: '', estimated_cost: '', estimated_time: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try { await api('/projects', { body: { ...f, category: tab } }); onDone(); } catch (err) { setError(err.message); }
  }
  return (
    <form className="card" onSubmit={submit}>
      <b>New {tab === 'maintenance' ? 'maintenance task' : 'special project'} — you'll be the creator</b>
      <label htmlFor="pj-title">Title</label>
      <input id="pj-title" required value={f.title} onChange={set('title')} />
      <label htmlFor="pj-desc">Description</label>
      <textarea id="pj-desc" value={f.description} onChange={set('description')} placeholder="What needs doing, where things are, any gotchas…" />
      <div className="row">
        <div className="grow"><label htmlFor="pj-cost">Est. cost</label><input id="pj-cost" value={f.estimated_cost} onChange={set('estimated_cost')} placeholder="$150" /></div>
        <div className="grow"><label htmlFor="pj-time">Est. time</label><input id="pj-time" value={f.estimated_time} onChange={set('estimated_time')} placeholder="2 hrs" /></div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt">Add project</button>
    </form>
  );
}

// PRJ-5: note required, photos optional, before/after tag (PRJ-9)
function ContribModal({ project, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError('');
    const fd = new FormData();
    fd.append('note', note);
    if (phase) fd.append('phase', phase);
    for (const f of files) fd.append('photos', f);
    try { await api(`/projects/${project.id}/contributions`, { body: fd }); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <Modal title={`Log work — ${project.title}`} onClose={onClose}>
      <label htmlFor="ct-note">What did you do?</label>
      <textarea id="ct-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Sanded the west half, one more session needed" />
      <label htmlFor="ct-photos">Photos (optional)</label>
      <input id="ct-photos" type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files])} />
      {files.length > 0 && (<>
        <label htmlFor="ct-phase">Tag these photos</label>
        <select id="ct-phase" value={phase} onChange={e => setPhase(e.target.value)}>
          <option value="">No tag</option>
          <option value="before">Before</option>
          <option value="after">After</option>
        </select>
      </>)}
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt" onClick={submit} disabled={!note.trim() || busy}>Post — publishes immediately</button>
    </Modal>
  );
}

function EditModal({ project, onClose, onDone }) {
  const [f, setF] = useState({ title: project.title, description: project.description, estimated_cost: project.estimated_cost, estimated_time: project.estimated_time });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    try { await api(`/projects/${project.id}`, { method: 'PUT', body: f }); onDone(); } catch (e) { setError(e.message); }
  }
  return (
    <Modal title="Edit project" onClose={onClose}>
      <label htmlFor="pe-title">Title</label>
      <input id="pe-title" value={f.title} onChange={set('title')} />
      <label htmlFor="pe-desc">Description</label>
      <textarea id="pe-desc" value={f.description} onChange={set('description')} />
      <div className="row">
        <div className="grow"><label htmlFor="pe-cost">Est. cost</label><input id="pe-cost" value={f.estimated_cost} onChange={set('estimated_cost')} /></div>
        <div className="grow"><label htmlFor="pe-time">Est. time</label><input id="pe-time" value={f.estimated_time} onChange={set('estimated_time')} /></div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt" onClick={submit}>Save</button>
    </Modal>
  );
}
