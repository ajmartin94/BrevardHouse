import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { renderContent } from './Manual.jsx';
import Emergency from './Emergency.jsx';

// AUTH-4: read-only house guide via capability link — no account needed.
export default function Guest() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('checkin');
  const [error, setError] = useState('');
  useEffect(() => { api(`/guest/${token}`).then(setD).catch(e => setError(e.message)); }, [token]);

  if (error) return <div className="shell"><main><div className="error">{error}</div></main></div>;
  if (!d) return <div className="shell"><div className="spin">Loading…</div></div>;

  return (
    <div className="shell">
      <header className="hdr">
        <div className="hdr-logo" style={{ cursor: 'default' }}>
          <div className="hdr-mark" aria-hidden>M</div>
          <div className="hdr-title">Martin Brevard House — Guest Guide</div>
        </div>
      </header>
      <main style={{ paddingBottom: 30 }}>
        <p className="page-sub">Read-only guide for visitors. Save this link!</p>

        <div className="tabs" role="tablist">
          {[['checkin', 'Check In'], ['checkout', 'Check Out'], ['manual', 'Manual'], ['emergency', 'Emergency'], ['things', 'To Do']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {(tab === 'checkin' || tab === 'checkout') && d[tab].map(item => (
          <div key={item.id} className="check-row" style={{ cursor: 'default' }}>
            <span className="check-box" aria-hidden />
            <span className="check-text">{item.text}</span>
          </div>
        ))}

        {tab === 'manual' && d.manual.map(s => (
          <div className="card" key={s.id}>
            <b style={{ fontSize: 14 }}>{s.title}</b> <span className="muted">· {s.section}</span>
            <div style={{ fontSize: 13.5, color: '#4a3a2c' }}>{renderContent(s.content)}</div>
          </div>
        ))}

        {tab === 'emergency' && <Emergency guestItems={d.emergency} />}

        {tab === 'things' && d.things.map(t => (
          <div className="card" key={t.id}>
            <div className="row-between">
              <b style={{ fontSize: 14 }}>{t.title}</b>
              {!!t.is_family_favorite && <span className="pill pill-fave">★ Family fave</span>}
            </div>
            <div className="muted">{t.category}</div>
            {t.description && <p style={{ fontSize: 13, margin: '5px 0 0' }}>{t.description}</p>}
          </div>
        ))}
      </main>
    </div>
  );
}
