import React, { useState } from 'react';
import { api } from '../api.js';

const SECTIONS = [
  { label: 'Home', desc: "What's happening now — the current stay, recent activity and photos." },
  { label: 'Check In/Out', desc: 'Checklists for arriving and leaving, plus a place to report anything broken.' },
  { label: 'Calendar', desc: 'See upcoming stays and propose new ones. Admins confirm stay requests.' },
  { label: 'Projects', desc: 'Maintenance and special projects — claim one, log work, and track progress.' },
  { label: 'House Manual', desc: 'How things work: wifi, water shutoff, appliances, and more.' },
  { label: 'Things To Do', desc: 'A family-built local guide to hikes, restaurants and more nearby.' },
  { label: 'Photo Gallery', desc: 'Photos from stays and projects, organized automatically by date.' },
  { label: 'Emergency', desc: 'Contacts and key locations (water shutoff, breaker panel, extinguishers) — always one tap away.' },
];

export default function Help() {
  return (
    <div>
      <h1>Help</h1>
      <p className="page-sub">A quick guide to the app, plus a way to reach me directly.</p>

      <div className="card">
        <b>What this is</b>
        <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>
          Martin Brevard House is the family hub for the house in Brevard, NC — one place to plan
          stays, share the house guide, track projects, and keep photos from every visit.
        </p>
      </div>

      <div className="kicker">Where things are</div>
      {SECTIONS.map(s => (
        <div className="card" key={s.label} style={{ padding: '10px 14px' }}>
          <b style={{ fontSize: 13.5 }}>{s.label}</b>
          <div className="muted" style={{ marginTop: 2 }}>{s.desc}</div>
        </div>
      ))}

      <FeedbackForm />
    </div>
  );
}

function FeedbackForm() {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api('/feedback', { body: { text } });
      setSent(true);
      setText('');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <div>
      <div className="kicker">Feedback</div>
      <form className="card" onSubmit={submit}>
        <p className="form-note">Found a bug, or have an idea for the app? This goes straight to me.</p>
        <label htmlFor="fb-text">Your feedback</label>
        <textarea id="fb-text" style={{ minHeight: 100 }} value={text} onChange={e => setText(e.target.value)}
          placeholder="What's on your mind?" required />
        {error && <div className="error">{error}</div>}
        {sent && <div className="notice">Sent — thanks! I'll get an alert and follow up if needed.</div>}
        <button className="btn btn-primary btn-block mt" disabled={busy || !text.trim()}>Send feedback</button>
      </form>
      <p className="muted center">
        Prefer email? <a href="mailto:martin.andrew.94@gmail.com">martin.andrew.94@gmail.com</a>
      </p>
    </div>
  );
}
