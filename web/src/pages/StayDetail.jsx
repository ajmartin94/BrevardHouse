import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, fmtRange, timeAgo } from '../api.js';
import { StatusPill } from '../App.jsx';

// CAL-5 / CHK-3: a stay's photos and checklist record in one place
export default function StayDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [big, setBig] = useState(null);
  useEffect(() => { api(`/stays/${id}`).then(setD).catch(e => setError(e.message)); }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <div className="spin">Loading…</div>;
  const s = d.stay;
  const checkin = d.checks.filter(c => c.list_type === 'checkin');
  const checkout = d.checks.filter(c => c.list_type === 'checkout');

  return (
    <div>
      <button className="btn-link" onClick={() => nav('/calendar')}>‹ Calendar</button>
      <div className="row-between">
        <h1>{fmtRange(s.start_date, s.end_date)}</h1>
        <StatusPill status={s.status} />
      </div>
      <p className="page-sub">{s.who_text} · {s.party_size} people{s.notes ? ` · “${s.notes}”` : ''}</p>

      <div className="kicker">Trip photos</div>
      {d.photos.length === 0 ? <p className="muted">No photos linked to this stay yet.</p> : (
        <div className="photo-grid">
          {d.photos.map(p => (
            <button key={p.id} className="photo-cell" onClick={() => setBig(p)} aria-label={p.caption || 'photo'}>
              <img src={p.thumb_url || p.url} alt={p.caption || 'Trip photo'} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="kicker">Checklist record</div>
      {d.checks.length === 0 && <p className="muted">No checklist activity was recorded for this stay.</p>}
      {[['Check-in', checkin], ['Check-out', checkout]].map(([label, list]) => list.length > 0 && (
        <div className="card" key={label}>
          <b style={{ fontSize: 13 }}>{label}</b>
          {list.map(c => (
            <div key={c.id} className="feed-item">
              <div className="feed-dot" aria-hidden />
              <div>{c.item_text}<div className="muted">✓ {c.checked_by_name} · {timeAgo(c.checked_at)}</div></div>
            </div>
          ))}
        </div>
      ))}

      {big && (
        <div className="modal-back" onClick={() => setBig(null)}>
          <div className="modal lightbox" onClick={e => e.stopPropagation()}>
            <img src={big.url} alt={big.caption || 'Trip photo'} />
            <p className="muted">{big.caption} — {big.uploader_name}</p>
            <button className="btn btn-block" onClick={() => setBig(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
