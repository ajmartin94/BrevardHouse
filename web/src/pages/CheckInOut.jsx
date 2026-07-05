import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtRange } from '../api.js';
import { useApp, Modal } from '../App.jsx';

export default function CheckInOut() {
  const { user, isAdmin, refreshMe } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('checkin');
  const [data, setData] = useState(null);
  const [localChecks, setLocalChecks] = useState({}); // when no active stay
  const [editMode, setEditMode] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/checklists').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="spin">Loading…</div>;

  const items = data.items[tab];
  const stay = data.activeStay;
  const checkFor = (itemId) => stay
    ? data.checks.find(c => c.item_id === itemId)
    : (localChecks[itemId] ? { checked_by_name: null } : null);

  async function toggle(item) {
    const cur = !!checkFor(item.id);
    if (stay) {
      // optimistic
      setData(d => ({
        ...d,
        checks: cur ? d.checks.filter(c => c.item_id !== item.id)
          : [...d.checks, { item_id: item.id, checked_by_name: user.name, stay_id: stay.id }],
      }));
      try { await api('/checklists/check', { body: { item_id: item.id, stay_id: stay.id, checked: !cur } }); }
      catch (e) { setError(e.message); load(); }
    } else {
      setLocalChecks(l => ({ ...l, [item.id]: !cur }));
    }
  }

  return (
    <div>
      <div className="row-between">
        <h1>Check In / Out</h1>
        <span className="row">
          {/* GEN-4: printable check-in essentials one-pager */}
          <button className="btn btn-sm no-print" onClick={() => window.print()} aria-label="Print this list">🖨</button>
          {isAdmin && <button className="btn btn-dark btn-sm" onClick={() => setEditMode(m => !m)}>{editMode ? 'Done editing' : 'Edit lists'}</button>}
        </span>
      </div>
      <h2 className="print-only">Martin Brevard House — {tab === 'checkin' ? 'check-in' : 'check-out'} essentials</h2>

      {stay ? (
        <p className="page-sub">Checking for the current stay: <b>{stay.who_text}</b> ({fmtRange(stay.start_date, stay.end_date)}) — ticks are saved with your name.</p>
      ) : (
        <p className="page-sub">No one is checked in today — ticks below won't be saved to a stay record.</p>
      )}

      {isAdmin && data.pendingCount > 0 && !editMode && (
        <button className="notice" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--amber-line)' }} onClick={() => nav('/account')}>
          {data.pendingCount} pending list suggestion{data.pendingCount === 1 ? '' : 's'} — review in Account →
        </button>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'checkin'} className={tab === 'checkin' ? 'on' : ''} onClick={() => setTab('checkin')}>Check In</button>
        <button role="tab" aria-selected={tab === 'checkout'} className={tab === 'checkout' ? 'on' : ''} onClick={() => setTab('checkout')}>Check Out</button>
      </div>

      {editMode
        ? <AdminEdit tab={tab} items={items} reload={load} />
        : (<>
          {items.map(item => {
            const c = checkFor(item.id);
            return (
              <button key={item.id} className={`check-row ${c ? 'done' : ''}`} onClick={() => toggle(item)} aria-pressed={!!c}>
                <span className="check-box" aria-hidden>{c ? '✓' : ''}</span>
                <span className="grow">
                  <span className="check-text">{item.text}</span>
                  {c && c.checked_by_name && <span className="check-by">✓ {c.checked_by_name}</span>}
                </span>
              </button>
            );
          })}

          {tab === 'checkout' && (
            <button className="btn btn-danger btn-block mt" onClick={() => setReportOpen(true)}>
              ⚠ Report something broken — goes straight to House Projects
            </button>
          )}

          <div className="center mt">
            <button className="btn-link" onClick={() => setSuggestOpen(true)}>+ Suggest an edit to this list</button>
          </div>
          {data.mySuggestions.filter(s => !s.checklist_type || s.checklist_type === tab || s.action !== 'add').map(s => (
            <div key={s.id} className="notice">Pending review ({s.action}): “{s.proposed_text || '(remove item)'}”</div>
          ))}
        </>)}

      {suggestOpen && <SuggestModal targetType="checklist_item" tab={tab} items={items} onClose={() => { setSuggestOpen(false); load(); }} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} done={() => { setReportOpen(false); refreshMe(); }} />}
    </div>
  );
}

function AdminEdit({ tab, items, reload }) {
  const [newText, setNewText] = useState('');
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const save = async (item) => {
    try { await api(`/checklist-items/${item.id}`, { method: 'PUT', body: { text: drafts[item.id] ?? item.text } }); reload(); }
    catch (e) { setError(e.message); }
  };
  const del = async (item) => {
    if (!confirm(`Remove “${item.text}”?`)) return;
    try { await api(`/checklist-items/${item.id}`, { method: 'DELETE' }); reload(); } catch (e) { setError(e.message); }
  };
  const add = async () => {
    if (!newText.trim()) return;
    try { await api('/checklist-items', { body: { type: tab, text: newText.trim() } }); setNewText(''); reload(); } catch (e) { setError(e.message); }
  };
  return (
    <div>
      {error && <div className="error">{error}</div>}
      {items.map(item => (
        <div className="row" style={{ marginBottom: 8 }} key={item.id}>
          <input aria-label="Item text" value={drafts[item.id] ?? item.text}
            onChange={e => setDrafts(d => ({ ...d, [item.id]: e.target.value }))}
            onBlur={() => (drafts[item.id] !== undefined && drafts[item.id] !== item.text) && save(item)} />
          <button className="btn btn-danger btn-sm" onClick={() => del(item)} aria-label={`Delete: ${item.text}`}>✕</button>
        </div>
      ))}
      <div className="row mt">
        <input placeholder="New item…" value={newText} onChange={e => setNewText(e.target.value)} aria-label="New item text" />
        <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
      </div>
    </div>
  );
}

// CHK-6 / MAN-4: structured suggestion — targets a specific item, or adds a new one
export function SuggestModal({ targetType, tab, items, sections, onClose }) {
  const list = targetType === 'checklist_item' ? items : sections;
  const [action, setAction] = useState('add');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const isManual = targetType === 'manual_section';
  const target = list.find(x => String(x.id) === String(targetId));

  useEffect(() => {
    if (action !== 'add' && target) {
      setText(target.text || target.content || '');
      if (isManual) setTitle(target.title || '');
    } else if (action === 'add') { setText(''); setTitle(''); }
  }, [action, targetId]); // eslint-disable-line

  async function submit() {
    setError('');
    try {
      await api('/suggestions', {
        body: {
          target_type: targetType,
          target_id: action === 'add' ? null : Number(targetId),
          checklist_type: targetType === 'checklist_item' ? tab : null,
          action, proposed_title: isManual ? title : null,
          proposed_text: action === 'delete' ? '' : text,
        },
      });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title="Suggest an edit" onClose={onClose}>
      {done ? <div className="notice">Sent! An admin will review it — you'll get a note either way.</div> : (<>
        <p className="form-note">An admin reviews the exact change before it goes live.</p>
        <label htmlFor="sg-action">What kind of change?</label>
        <select id="sg-action" value={action} onChange={e => setAction(e.target.value)}>
          <option value="add">Add something new</option>
          <option value="modify">Change an existing {isManual ? 'section' : 'item'}</option>
          <option value="delete">Remove an existing {isManual ? 'section' : 'item'}</option>
        </select>
        {action !== 'add' && (<>
          <label htmlFor="sg-target">Which {isManual ? 'section' : 'item'}?</label>
          <select id="sg-target" value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Choose…</option>
            {list.map(x => <option key={x.id} value={x.id}>{(x.title || x.text).slice(0, 60)}</option>)}
          </select>
        </>)}
        {isManual && action !== 'delete' && (<>
          <label htmlFor="sg-title">Section title</label>
          <input id="sg-title" value={title} onChange={e => setTitle(e.target.value)} />
        </>)}
        {action !== 'delete' && (<>
          <label htmlFor="sg-text">{action === 'add' ? 'Proposed text' : 'Proposed new text'}</label>
          <textarea id="sg-text" value={text} onChange={e => setText(e.target.value)} />
        </>)}
        {action === 'delete' && targetId && <div className="diff-block diff-old">{target?.text || target?.content}</div>}
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary btn-block mt" onClick={submit}
          disabled={(action !== 'add' && !targetId) || (action !== 'delete' && !text.trim() && !title.trim())}>
          Submit for review
        </button>
      </>)}
    </Modal>
  );
}

// CHK-4 / EMG-3: report-broken → creates a Maintenance project
export function ReportModal({ onClose, done }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  async function submit() {
    setError('');
    const fd = new FormData();
    fd.append('text', text);
    if (file) fd.append('photo', file);
    try {
      await api('/reports', { body: fd });
      setOk(true);
      setTimeout(done || onClose, 1400);
    } catch (e) { setError(e.message); }
  }
  return (
    <Modal title="Report something broken" onClose={onClose}>
      {ok ? <div className="notice">Thanks — it's now a Maintenance project and the admins were notified.</div> : (<>
        <label htmlFor="rp-text">What's broken, and where?</label>
        <textarea id="rp-text" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. The porch ceiling fan wobbles badly on high" />
        <label htmlFor="rp-photo">Photo (optional)</label>
        <input id="rp-photo" type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files[0])} />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary btn-block mt" onClick={submit} disabled={!text.trim()}>Send report</button>
      </>)}
    </Modal>
  );
}
