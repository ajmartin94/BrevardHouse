import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo, fmtRange } from '../api.js';
import { useApp } from '../App.jsx';

export default function Home() {
  const { user, isAdmin } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/dashboard').then(setD).catch(e => setError(e.message)); }, []);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <div className="spin">Loading…</div>;
  const first = user.name.split(' ')[0];

  return (
    <div>
      <h1>Welcome back, {first}</h1>
      <p className="page-sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      {/* HOME-3: stay-aware banner */}
      {d.myStayToday && (
        <div className="card card-amber">
          <b>{d.myStayToday.arriving ? 'You arrive today! 🎉' : 'Heading out today?'}</b>
          <div className="muted" style={{ margin: '4px 0 8px' }}>
            {d.myStayToday.arriving
              ? 'The check-in list has the door code, wifi and house quirks.'
              : 'Run the check-out list before you lock up.'}
          </div>
          {(d.myStayToday.essentials || []).map(it => (
            <div key={it.id} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid rgba(58,47,40,0.08)' }}>• {it.text}</div>
          ))}
          <button className="btn btn-dark btn-sm mt" onClick={() => nav('/checkinout')}>
            Full {d.myStayToday.arriving ? 'check-in' : 'check-out'} list →
          </button>
        </div>
      )}

      {/* HOME-2: current + date-sorted next stay */}
      <div className="card card-dark">
        {d.currentStay ? (<>
          <div className="kicker">At the house now</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{d.currentStay.who_text}</div>
          <div style={{ fontSize: 13, color: '#e3dac6', marginTop: 3 }}>
            {fmtRange(d.currentStay.start_date, d.currentStay.end_date)} · {d.currentStay.party_size} people
            {d.currentStay.notes ? ` · “${d.currentStay.notes}”` : ''}
          </div>
        </>) : d.nextStay ? (<>
          <div className="kicker">Next stay</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{fmtRange(d.nextStay.start_date, d.nextStay.end_date)}</div>
          <div style={{ fontSize: 13, color: '#e3dac6', marginTop: 3 }}>
            {d.nextStay.who_text} · {d.nextStay.party_size} people{d.nextStay.notes ? ` · “${d.nextStay.notes}”` : ''}
          </div>
        </>) : (<>
          <div className="kicker">Next stay</div>
          <div style={{ fontSize: 14 }}>Nothing on the calendar — plan one!</div>
        </>)}
        {d.currentStay && d.nextStay && (
          <div style={{ fontSize: 12, color: '#c9b89a', marginTop: 8 }}>
            Next: {fmtRange(d.nextStay.start_date, d.nextStay.end_date)} · {d.nextStay.who_text}
          </div>
        )}
      </div>

      <div className="quick-grid">
        <button className="quick-card" onClick={() => nav('/checkinout')}><span className="glyph" aria-hidden>✓</span><b>Check In / Out</b><span>Codes, wifi, quirks</span></button>
        <button className="quick-card" onClick={() => nav('/calendar')}><span className="glyph" aria-hidden>▦</span><b>Calendar</b><span>Plan a stay</span></button>
        <button className="quick-card" onClick={() => nav('/projects')}><span className="glyph" aria-hidden>⚒</span><b>House Projects</b><span>Maintenance &amp; upgrades</span></button>
        <button className="quick-card" onClick={() => nav('/things')}><span className="glyph" aria-hidden>✺</span><b>Local Guide</b><span>Hikes, food &amp; fun</span></button>
      </div>

      {isAdmin && d.pendingCount > 0 && (
        <button className="card card-amber row-between mt" style={{ width: '100%', cursor: 'pointer' }} onClick={() => nav('/account')}>
          <span><b style={{ color: 'var(--amber-ink)' }}>{d.pendingCount} pending approval{d.pendingCount === 1 ? '' : 's'}</b><br />
            <span className="muted">Suggestions, stays &amp; accounts waiting</span></span>
          <span style={{ color: 'var(--amber-ink)', fontSize: 18 }} aria-hidden>→</span>
        </button>
      )}

      <div className="card mt">
        <b style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>What's new</b>
        {d.activity.length === 0 && <p className="muted">Quiet so far.</p>}
        {d.activity.map(a => (
          <div className="feed-item" key={a.id}>
            <div className="feed-dot" aria-hidden />
            <div><b>{a.actor_name}</b> {a.text} <span className="muted">· {timeAgo(a.created_at)}</span></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>Recent photos</b>
          <button className="btn-link" onClick={() => nav('/gallery')}>See all</button>
        </div>
        <div className="strip">
          {d.recentPhotos.map(p => (
            <button key={p.id} className="photo-cell" onClick={() => nav('/gallery')} aria-label={p.caption || 'photo'}>
              <img src={p.thumb_url || p.url} alt={p.caption || 'House photo'} loading="lazy" />
            </button>
          ))}
          {d.recentPhotos.length === 0 && <p className="muted">No photos yet — add the first!</p>}
        </div>
      </div>
    </div>
  );
}
