import React, { useEffect, useState, useCallback } from 'react';
import { api, timeAgo, fmtRange } from '../api.js';
import { useApp, Modal } from '../App.jsx';

export default function Account() {
  const { user, isAdmin, refreshMe, setUnread } = useApp();
  const [notifs, setNotifs] = useState([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/notifications').then(d => {
      setNotifs(d.notifications);
      if (d.notifications.some(n => !n.read)) api('/notifications/read', { body: {} }).then(() => setUnread(0)).catch(() => {});
    }).catch(e => setError(e.message));
  }, [setUnread]);

  async function logout() {
    await api('/auth/logout', { body: {} });
    location.href = '/';
  }

  return (
    <div>
      <h1>Account</h1>
      {error && <div className="error">{error}</div>}
      <div className="card row">
        <div className="hdr-mark" style={{ width: 44, height: 44, fontSize: 18, borderRadius: '50%' }} aria-hidden>{user.name[0]}</div>
        <div className="grow">
          <b>{user.name}</b>
          <div className="muted">{user.email} · {user.role === 'admin' ? 'Admin' : 'Member'}</div>
        </div>
        <button className="btn btn-sm" onClick={logout}>Log out</button>
      </div>
      <div className="row">
        <button className="btn btn-sm" onClick={() => setPwOpen(true)}>Change password</button>
      </div>

      {isAdmin && <AdminPanel refreshMe={refreshMe} />}

      <div className="kicker">Your notifications</div>
      {notifs.length === 0 && <p className="muted">Nothing yet.</p>}
      {notifs.map(n => (
        <div className="card" key={n.id} style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 13 }}>{n.text}</div>
          <div className="muted">{timeAgo(n.created_at)}</div>
        </div>
      ))}

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function PasswordModal({ onClose }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  async function submit() {
    setError('');
    try { await api('/auth/password', { body: { password: pw } }); setMsg('Password changed.'); setTimeout(onClose, 900); }
    catch (e) { setError(e.message); }
  }
  return (
    <Modal title="Change password" onClose={onClose}>
      <label htmlFor="pw-new">New password (8+ characters)</label>
      <input id="pw-new" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
      {error && <div className="error">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn btn-primary btn-block mt" onClick={submit} disabled={pw.length < 8}>Save</button>
    </Modal>
  );
}

// =====================================================================
// ADMIN (ADM-1..5, AUTH-4)
// =====================================================================
function AdminPanel({ refreshMe }) {
  const [pending, setPending] = useState(null);
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);
  const [auditRows, setAuditRows] = useState(null);
  const [outbox, setOutbox] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/admin/pending').then(setPending).catch(e => setError(e.message));
    api('/admin/users').then(d => setUsers(d.users)).catch(() => {});
    api('/admin/guest-links').then(d => setLinks(d.links)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(path, body) {
    setError('');
    try { await api(path, { body: body || {} }); load(); refreshMe(); } catch (e) { setError(e.message); }
  }
  async function reviewStay(s, action) {
    let reason = '';
    if (action === 'reject') reason = prompt(`Optional: why decline? (sent to ${s.proposer_name})`) ?? '';
    act(`/stays/${s.id}/${action}`, { reason });
  }
  async function makeGuestLink() {
    setError('');
    try {
      const d = await api('/admin/guest-links', { body: {} });
      load();
      const url = location.origin + d.url;
      try { await navigator.clipboard.writeText(url); alert('Guest link copied:\n' + url); }
      catch { alert('Guest link:\n' + url); }
    } catch (e) { setError(e.message); }
  }

  if (!pending) return <div className="spin">Loading admin…</div>;
  const total = pending.suggestions.length + pending.stays.length + pending.accounts.length;

  return (
    <div>
      <div className="kicker">Pending approvals ({total})</div>
      {error && <div className="error">{error}</div>}
      {total === 0 && <p className="muted">Nothing waiting — all caught up.</p>}

      {pending.accounts.map(a => (
        <div className="card card-amber" key={'acct' + a.id}>
          <b style={{ fontSize: 13 }}>Account request</b>
          <div style={{ fontSize: 13, marginTop: 2 }}>{a.name} · {a.email}</div>
          <div className="row mt">
            <button className="btn btn-approve btn-sm" onClick={() => act(`/admin/users/${a.id}/approve`)}>Approve</button>
            <button className="btn btn-sm" onClick={() => {
              const reason = prompt(`Optional: why decline? (emailed to ${a.name})`);
              if (reason !== null) act(`/admin/users/${a.id}/decline`, { reason });
            }}>Decline…</button>
          </div>
        </div>
      ))}

      {pending.stays.map(s => (
        <div className="card card-amber" key={'stay' + s.id}>
          <b style={{ fontSize: 13 }}>Stay proposal</b>
          <div style={{ fontSize: 13, marginTop: 2 }}>{fmtRange(s.start_date, s.end_date)} · {s.who_text} · {s.party_size} people</div>
          <div className="muted">proposed by {s.proposer_name}</div>
          <div className="row mt">
            <button className="btn btn-approve btn-sm" onClick={() => reviewStay(s, 'approve')}>Approve</button>
            <button className="btn btn-sm" onClick={() => reviewStay(s, 'reject')}>Decline…</button>
          </div>
        </div>
      ))}

      {pending.suggestions.map(s => (
        <div className="card card-amber" key={'sg' + s.id}>
          <b style={{ fontSize: 13 }}>
            {s.target_type === 'checklist_item' ? `Checklist ${s.checklist_type || ''}` : 'Manual'} — {s.action}
          </b>
          <div className="muted">from {s.submitter_name} · {timeAgo(s.created_at)}</div>
          {/* ADM-2: before/after diff */}
          {s.current && <div className="diff-block diff-old">{s.current.title ? s.current.title + '\n' : ''}{s.current.text}</div>}
          {s.action !== 'delete' && <div className="diff-block diff-new">{s.proposed_title ? s.proposed_title + '\n' : ''}{s.proposed_text}</div>}
          <div className="row mt">
            <button className="btn btn-approve btn-sm" onClick={() => setReview(s)}>Review &amp; approve…</button>
            <button className="btn btn-sm" onClick={() => {
              const reason = prompt(`Optional: why decline? (sent to ${s.submitter_name})`) ?? '';
              act(`/suggestions/${s.id}/reject`, { reason });
            }}>Decline…</button>
          </div>
        </div>
      ))}

      <div className="kicker">Household accounts</div>
      {users.map(u => (
        <div className="card row-between" key={u.id} style={{ padding: '10px 14px' }}>
          <div>
            <b style={{ fontSize: 13.5 }}>{u.name}</b> {!u.active && <span className="pill pill-pending">inactive</span>}
            <div className="muted">{u.email}</div>
          </div>
          <div className="row">
            <select className="btn btn-sm" style={{ width: 'auto' }} value={u.role} aria-label={`Role for ${u.name}`}
              onChange={e => act(`/admin/users/${u.id}/role`, { role: e.target.value })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            {u.active
              ? <button className="btn btn-danger btn-sm" onClick={() => confirm(`Deactivate ${u.name}? They can no longer log in.`) && act(`/admin/users/${u.id}/deactivate`)}>Off</button>
              : <button className="btn btn-approve btn-sm" onClick={() => act(`/admin/users/${u.id}/approve`)}>Activate</button>}
          </div>
        </div>
      ))}

      <div className="kicker">Guest guide links</div>
      <p className="form-note">Read-only link to the house guide (checklists, manual, emergency, local guide) — for visitors without accounts.</p>
      {links.map(l => (
        <div className="card row-between" key={l.id} style={{ padding: '10px 14px' }}>
          <div className="grow" style={{ overflow: 'hidden' }}>
            <code style={{ fontSize: 12 }}>/guest/{l.token.slice(0, 10)}…</code>
            <div className="muted">{l.expires_at ? 'expires ' + l.expires_at.slice(0, 10) : 'no expiry'}</div>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={async () => {
              const url = location.origin + '/guest/' + l.token;
              try { await navigator.clipboard.writeText(url); alert('Copied:\n' + url); } catch { alert(url); }
            }}>Copy</button>
            <button className="btn btn-danger btn-sm" onClick={() => {
              if (!confirm('Revoke this guest link?')) return;
              api(`/admin/guest-links/${l.id}`, { method: 'DELETE' }).then(load).catch(e => setError(e.message));
            }}>Revoke</button>
          </div>
        </div>
      ))}
      <button className="btn btn-block" onClick={makeGuestLink}>+ New guest link</button>

      <div className="kicker">Records</div>
      <div className="row">
        <button className="btn btn-sm" onClick={() => auditRows ? setAuditRows(null) : api('/admin/audit').then(d => setAuditRows(d.audit))}>
          {auditRows ? 'Hide audit log' : 'Audit log'}
        </button>
        <button className="btn btn-sm" onClick={() => outbox ? setOutbox(null) : api('/admin/outbox').then(d => setOutbox(d.outbox))}>
          {outbox ? 'Hide outbox' : 'Email outbox (dev)'}
        </button>
      </div>
      {auditRows && auditRows.map(a => (
        <div className="card" key={a.id} style={{ padding: '8px 12px', fontSize: 12 }}>
          <b>{a.actor_name}</b> · {a.action} {a.target_type}{a.target_id ? ' #' + a.target_id : ''} {a.detail && <span className="muted">— {a.detail}</span>}
          <div className="muted">{timeAgo(a.created_at)}</div>
        </div>
      ))}
      {outbox && outbox.map(m => (
        <div className="card" key={m.id} style={{ padding: '8px 12px', fontSize: 12 }}>
          <b>→ {m.to_email}</b> · {m.subject}
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.body}</div>
          <div className="muted">{timeAgo(m.created_at)}</div>
        </div>
      ))}

      {review && <ApproveModal suggestion={review} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); refreshMe(); }} />}
    </div>
  );
}

// ADM-2: edit-before-approve — what the admin sees is exactly what gets applied
function ApproveModal({ suggestion: s, onClose, onDone }) {
  const [title, setTitle] = useState(s.proposed_title || s.current?.title || '');
  const [text, setText] = useState(s.proposed_text);
  const [error, setError] = useState('');
  const isManual = s.target_type === 'manual_section';
  async function approve() {
    setError('');
    try {
      await api(`/suggestions/${s.id}/approve`, { body: { edited_text: text, edited_title: title } });
      onDone();
    } catch (e) { setError(e.message); }
  }
  return (
    <Modal title={`Approve ${s.action}`} onClose={onClose}>
      {s.current && (<><label>Current</label><div className="diff-block diff-old">{s.current.title ? s.current.title + '\n' : ''}{s.current.text}</div></>)}
      {s.action === 'delete' ? (
        <p className="form-note mt">Approving removes the {isManual ? 'section' : 'item'} above.</p>
      ) : (<>
        {isManual && (<><label htmlFor="ap-title">Title (editable before approving)</label>
          <input id="ap-title" value={title} onChange={e => setTitle(e.target.value)} /></>)}
        <label htmlFor="ap-text">Text (editable before approving)</label>
        <textarea id="ap-text" style={{ minHeight: 120 }} value={text} onChange={e => setText(e.target.value)} />
      </>)}
      {error && <div className="error">{error}</div>}
      <button className="btn btn-approve btn-block mt" onClick={approve}>Approve &amp; apply</button>
    </Modal>
  );
}
