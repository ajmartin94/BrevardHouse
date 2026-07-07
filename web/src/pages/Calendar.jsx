import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtRange } from '../api.js';
import { useApp, StatusPill } from '../App.jsx';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Calendar() {
  const { isAdmin, refreshMe } = useApp();
  const nav = useNavigate();
  const now = new Date();
  const [data, setData] = useState(null);
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/stays').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const allStays = useMemo(() => {
    if (!data) return [];
    return [
      ...data.upcoming.map(s => ({ ...s, kind: s.status === 'pending' ? 'pending' : 'confirmed' })),
      ...data.past.map(s => ({ ...s, kind: 'past' })),
    ];
  }, [data]);

  // CAL-2: every stay touching a day renders — stacked bars, never first-match-wins
  const days = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = first.getDay();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(cursor.y, cursor.m, 1 - offset + i);
      const dIso = iso(d);
      const bars = allStays
        .filter(s => s.start_date <= dIso && s.end_date >= dIso)
        .map(s => ({ id: s.id, kind: s.kind, start: s.start_date === dIso, end: s.end_date === dIso }));
      cells.push({ iso: dIso, num: d.getDate(), inMonth: d.getMonth() === cursor.m, today: data && dIso === data.today, bars });
    }
    return cells;
  }, [cursor, allStays, data]);

  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (dir) => setCursor(c => {
    const m = c.m + dir;
    return m < 0 ? { y: c.y - 1, m: 11 } : m > 11 ? { y: c.y + 1, m: 0 } : { ...c, m };
  });

  async function review(stay, action) {
    let reason = '';
    if (action === 'reject') reason = prompt('Optional: why? (sent to ' + stay.proposer_name + ')') ?? '';
    try {
      await api(`/stays/${stay.id}/${action}`, { body: { reason } });
      load(); refreshMe();
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="row-between">
        <h1>Calendar</h1>
        <button className="btn btn-dark btn-sm" onClick={() => setFormOpen(o => !o)}>{formOpen ? 'Cancel' : '+ Propose dates'}</button>
      </div>
      <p className="page-sub">{isAdmin ? 'Your stays publish immediately (admin).' : 'Propose dates — an admin confirms them and you get a note.'}</p>
      {error && <div className="error">{error}</div>}

      {formOpen && <StayForm isAdmin={isAdmin} onDone={(startIso) => {
        setFormOpen(false); load();
        const [y, m] = startIso.split('-').map(Number);
        setCursor({ y, m: m - 1 });
      }} />}

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <button className="btn btn-sm" onClick={() => move(-1)} aria-label="Previous month">‹</button>
          <b style={{ fontFamily: 'var(--serif)' }}>{monthLabel}</b>
          <button className="btn btn-sm" onClick={() => move(1)} aria-label="Next month">›</button>
        </div>
        <div className="cal-head" aria-hidden><div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div></div>
        <div className="cal-grid">
          {days.map(d => (
            <div key={d.iso} className={`cal-cell ${d.today ? 'today' : ''} ${d.inMonth ? '' : 'dim'}`}>
              <span className="cal-num">{d.num}</span>
              <span className="cal-bars">
                {d.bars.slice(0, 3).map((b, i) => (
                  <span key={b.id + '-' + i} className={`cal-bar ${b.kind} ${b.start ? 'start' : ''} ${b.end ? 'end' : ''}`} />
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--olive)' }} />Confirmed</span>
          <span><i style={{ background: '#d9a441' }} />Pending</span>
          <span><i style={{ background: '#b3a486' }} />Past</span>
        </div>
      </div>

      <div className="kicker">Upcoming</div>
      {data.upcoming.length === 0 && <p className="muted">Nothing planned yet.</p>}
      {data.upcoming.map(s => (
        <div className="card" key={s.id}>
          <div className="row-between">
            <b style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{fmtRange(s.start_date, s.end_date)}</b>
            {s.status === 'pending' && <StatusPill status="pending" />}
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>{s.who_text} · {s.party_size} people</div>
          {s.notes && <div className="muted" style={{ fontStyle: 'italic', marginTop: 3 }}>{s.notes}</div>}
          {isAdmin && s.status === 'pending' && (
            <div className="row mt">
              <button className="btn btn-approve btn-sm" onClick={() => review(s, 'approve')}>Approve</button>
              <button className="btn btn-sm" onClick={() => review(s, 'reject')}>Decline…</button>
            </div>
          )}
        </div>
      ))}

      <div className="kicker">Past stays</div>
      {data.past.map(s => (
        <button className="card" key={s.id} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--cream-2)' }} onClick={() => nav(`/stays/${s.id}`)}>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{fmtRange(s.start_date, s.end_date)}</b>
          <div className="muted" style={{ marginTop: 2 }}>{s.who_text} · {s.party_size} people</div>
          <div style={{ fontSize: 12, color: 'var(--olive-dark)', marginTop: 4 }}>📷 Trip photos &amp; checklist record →</div>
        </button>
      ))}
    </div>
  );
}

function StayForm({ isAdmin, onDone }) {
  const [f, setF] = useState({ start_date: '', end_date: '', party_size: '', who_text: '', notes: '' });
  const [overlaps, setOverlaps] = useState([]);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // CAL-3: live overlap warning (informational, not blocking)
  useEffect(() => {
    if (f.start_date && f.end_date && f.end_date >= f.start_date) {
      api(`/stays/overlap?start=${f.start_date}&end=${f.end_date}`).then(d => setOverlaps(d.overlaps)).catch(() => {});
    } else setOverlaps([]);
  }, [f.start_date, f.end_date]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (f.end_date < f.start_date) { setError('End date must be on or after the start date.'); return; }
    try {
      await api('/stays', { body: f });
      onDone(f.start_date);
    } catch (err) { setError(err.message); }
  }

  return (
    <form className="card" onSubmit={submit}>
      <b>{isAdmin ? 'Add a stay (publishes immediately)' : 'Propose a stay'}</b>
      <div className="row mt">
        <div className="grow"><label htmlFor="st-start">Start</label><input id="st-start" type="date" required value={f.start_date} onChange={set('start_date')} /></div>
        <div className="grow"><label htmlFor="st-end">End</label><input id="st-end" type="date" required min={f.start_date} value={f.end_date} onChange={set('end_date')} /></div>
      </div>
      <label htmlFor="st-party">How many people?</label>
      <input id="st-party" type="number" min="1" max="30" required value={f.party_size} onChange={set('party_size')} />
      <label htmlFor="st-who">Who's coming?</label>
      <input id="st-who" placeholder="e.g. The Martins + grandma" value={f.who_text} onChange={set('who_text')} />
      <label htmlFor="st-notes">Notes (optional)</label>
      <input id="st-notes" placeholder="e.g. bringing the dog" value={f.notes} onChange={set('notes')} />
      {overlaps.length > 0 && (
        <div className="notice mt">
          ⚠ Overlaps {overlaps.map(o => `${o.who_text} (${fmtRange(o.start_date, o.end_date)})`).join(', ')} — that's allowed, just so you know.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block mt">{isAdmin ? 'Add to calendar' : 'Send proposal'}</button>
    </form>
  );
}
