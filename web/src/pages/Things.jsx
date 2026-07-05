import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

export default function Things() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => api('/things').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;
  const cats = ['All', ...data.categories];
  const things = data.things.filter(t => filter === 'All' || t.category === filter);

  async function toggleFave(t) {
    try { await api(`/things/${t.id}/favorite`); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="row-between">
        <div>
          <h1>Things To Do</h1>
          <p className="page-sub">The local guide — grows as people visit. Adds post immediately.</p>
        </div>
        <button className="btn btn-dark btn-sm" onClick={() => setFormOpen(o => !o)}>{formOpen ? 'Cancel' : '+ Add'}</button>
      </div>
      {error && <div className="error">{error}</div>}

      {formOpen && <AddForm categories={data.categories} onDone={() => { setFormOpen(false); load(); }} />}

      <div className="chips" role="tablist" aria-label="Filter by category">
        {cats.map(c => (
          <button key={c} role="tab" aria-selected={filter === c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {things.map(t => (
        <div className="card" key={t.id}>
          <div className="row-between">
            <b style={{ fontSize: 14.5 }}>{t.title}</b>
            <button className={`pill ${t.is_family_favorite ? 'pill-fave' : ''}`}
              onClick={() => toggleFave(t)}
              style={{ border: 'none', cursor: 'pointer', background: t.is_family_favorite ? undefined : 'var(--sand)', color: t.is_family_favorite ? undefined : 'var(--ink-faint)' }}
              aria-pressed={!!t.is_family_favorite} aria-label={`Family favorite: ${t.title}`}>
              ★ {t.is_family_favorite ? 'Family fave' : 'Fave?'}
            </button>
          </div>
          <div className="muted" style={{ marginTop: 2 }}>{t.category} · added by {t.submitter_name}</div>
          {t.description && <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>{t.description}</p>}
          <a style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 600 }}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.title + ', Brevard, NC')}`}
            target="_blank" rel="noopener noreferrer">📍 Open in Google Maps ↗</a>
        </div>
      ))}
    </div>
  );
}

function AddForm({ categories, onDone }) {
  const [f, setF] = useState({ category: '', title: '', description: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try { await api('/things', { body: f }); onDone(); } catch (err) { setError(err.message); }
  }
  return (
    <form className="card" onSubmit={submit}>
      <b>Add a suggestion — posts immediately</b>
      <label htmlFor="th-cat">Category</label>
      {/* TTD-2: existing categories offered, free text allowed */}
      <input id="th-cat" list="th-cats" required value={f.category} onChange={set('category')} placeholder="Pick one or type a new one" />
      <datalist id="th-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
      <label htmlFor="th-title">Name</label>
      <input id="th-title" required value={f.title} onChange={set('title')} />
      <label htmlFor="th-desc">Short description</label>
      <input id="th-desc" value={f.description} onChange={set('description')} />
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt">Add to the guide</button>
    </form>
  );
}
