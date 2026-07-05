import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { SuggestModal } from './CheckInOut.jsx';

// MAN-5: minimal formatting — blank-line paragraphs, **bold**, "- " lists,
// and a line that is an /uploads/... path renders as an inline photo.
export function renderContent(text) {
  const blocks = String(text || '').split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    if (lines.length === 1 && /^\/uploads\/\S+$/.test(lines[0].trim())) {
      return <img key={i} src={lines[0].trim()} alt="Manual photo" style={{ width: '100%', borderRadius: 9, margin: '6px 0' }} loading="lazy" />;
    }
    if (lines.every(l => l.trim().startsWith('- '))) {
      return <ul key={i} style={{ margin: '6px 0', paddingLeft: 20 }}>{lines.map((l, j) => <li key={j}>{bold(l.trim().slice(2))}</li>)}</ul>;
    }
    return <p key={i} style={{ margin: '6px 0' }}>{lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{bold(l)}</React.Fragment>)}</p>;
  });
}
function bold(line) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part);
}

export default function Manual() {
  const { isAdmin } = useApp();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/manual').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;

  // MAN-2: full-text search across titles and content
  const needle = q.trim().toLowerCase();
  const sections = data.sections.filter(s =>
    !needle || s.title.toLowerCase().includes(needle) || s.content.toLowerCase().includes(needle) || s.section.toLowerCase().includes(needle));

  return (
    <div>
      <div className="row-between">
        <h1>House Manual</h1>
        {isAdmin && <button className="btn btn-dark btn-sm" onClick={() => setEditMode(m => !m)}>{editMode ? 'Done editing' : 'Edit manual'}</button>}
      </div>
      <p className="page-sub">How everything works. For true emergencies use the <button className="btn-link" style={{ padding: 0 }} onClick={() => nav('/emergency')}>Emergency page</button>.</p>

      {isAdmin && data.pendingCount > 0 && !editMode && (
        <button className="notice" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--amber-line)' }} onClick={() => nav('/account')}>
          {data.pendingCount} pending manual suggestion{data.pendingCount === 1 ? '' : 's'} — review in Account →
        </button>
      )}

      <input type="search" placeholder="Search the manual… (e.g. wifi, septic, hot water)" value={q} onChange={e => setQ(e.target.value)}
        aria-label="Search the manual" style={{ marginBottom: 12 }} />

      {editMode ? <AdminEdit sections={data.sections} reload={load} /> : (<>
        {sections.length === 0 && <p className="muted">No sections match “{q}”.</p>}
        {sections.map(s => {
          const open = openId === s.id || !!needle;
          return (
            <div className="card" key={s.id} style={{ padding: 0, overflow: 'hidden' }}>
              <button onClick={() => setOpenId(open && !needle ? null : s.id)} aria-expanded={open}
                style={{ width: '100%', background: 'none', border: 'none', padding: '13px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                <span>{s.title} <span className="muted" style={{ fontWeight: 400 }}>· {s.section}</span></span>
                <span aria-hidden style={{ color: 'var(--ink-faint)' }}>{open ? '–' : '+'}</span>
              </button>
              {open && <div style={{ padding: '0 15px 13px', fontSize: 13.5, color: '#4a3a2c' }}>{renderContent(s.content)}</div>}
            </div>
          );
        })}
        <div className="center mt">
          <button className="btn-link" onClick={() => setSuggestOpen(true)}>+ Suggest an edit to the manual</button>
        </div>
        {data.mySuggestions.map(s => (
          <div key={s.id} className="notice">Pending review ({s.action}): “{(s.proposed_title || s.proposed_text || '(remove section)').slice(0, 80)}”</div>
        ))}
      </>)}

      {suggestOpen && <SuggestModal targetType="manual_section" sections={data.sections} onClose={() => { setSuggestOpen(false); load(); }} />}
    </div>
  );
}

function AdminEdit({ sections, reload }) {
  const [drafts, setDrafts] = useState({});
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ section: 'General', title: '', content: '' });
  const [error, setError] = useState('');
  const d = (id) => drafts[id] || {};
  const setD = (id, k, v) => setDrafts(x => ({ ...x, [id]: { ...x[id], [k]: v } }));
  async function save(s) {
    const patch = d(s.id);
    if (!Object.keys(patch).length) return;
    try { await api(`/manual/${s.id}`, { method: 'PUT', body: patch }); reload(); } catch (e) { setError(e.message); }
  }
  async function del(s) {
    if (!confirm(`Delete section “${s.title}”?`)) return;
    try { await api(`/manual/${s.id}`, { method: 'DELETE' }); reload(); } catch (e) { setError(e.message); }
  }
  async function add() {
    try { await api('/manual', { body: nf }); setAdding(false); setNf({ section: 'General', title: '', content: '' }); reload(); }
    catch (e) { setError(e.message); }
  }
  return (
    <div>
      {error && <div className="error">{error}</div>}
      {sections.map(s => (
        <div className="card" key={s.id}>
          <div className="row">
            <input aria-label="Section title" value={d(s.id).title ?? s.title} onChange={e => setD(s.id, 'title', e.target.value)} onBlur={() => save(s)} />
            <button className="btn btn-danger btn-sm" onClick={() => del(s)} aria-label={`Delete ${s.title}`}>✕</button>
          </div>
          <input className="mt" aria-label="Section group" value={d(s.id).section ?? s.section} onChange={e => setD(s.id, 'section', e.target.value)} onBlur={() => save(s)} />
          <textarea className="mt" aria-label="Section content" style={{ minHeight: 110 }} value={d(s.id).content ?? s.content} onChange={e => setD(s.id, 'content', e.target.value)} onBlur={() => save(s)} />
          {/* MAN-5: attach an inline photo — appears where the section renders */}
          <label className="btn btn-sm mt" style={{ display: 'inline-block', cursor: 'pointer' }}>
            📷 Add photo to this section
            <input type="file" accept="image/*" hidden onChange={async e => {
              const file = e.target.files[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('photo', file);
              try { await api(`/manual/${s.id}/photo`, { body: fd }); reload(); } catch (err) { setError(err.message); }
            }} />
          </label>
        </div>
      ))}
      {adding ? (
        <div className="card">
          <label>Group</label><input value={nf.section} onChange={e => setNf({ ...nf, section: e.target.value })} />
          <label>Title</label><input value={nf.title} onChange={e => setNf({ ...nf, title: e.target.value })} />
          <label>Content</label><textarea value={nf.content} onChange={e => setNf({ ...nf, content: e.target.value })} />
          <button className="btn btn-primary btn-block mt" onClick={add} disabled={!nf.title.trim()}>Add section</button>
        </div>
      ) : <button className="btn btn-block" onClick={() => setAdding(true)}>+ Add section</button>}
      <p className="form-note mt">Formatting: blank line = new paragraph, <b>**bold**</b>, lines starting “- ” become lists.</p>
    </div>
  );
}
