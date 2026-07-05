const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { get, all, run, UPLOADS_DIR } = require('./db');
const L = require('./lib');

const router = express.Router();

// ---------- upload handling ----------
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.svg']);
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${L.token(6)}${ALLOWED_EXT.has(ext) ? ext : '.jpg'}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    cb(null, ALLOWED_EXT.has(ext) || file.mimetype.startsWith('image/'));
  },
});

// ---------- auth middleware ----------
router.use((req, res, next) => {
  req.user = L.sessionUser(req.cookies.session);
  next();
});
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
const isAdmin = (req) => req.user && req.user.role === 'admin';

// ---------- helpers ----------
function publicUser(u) {
  return u ? { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, created_at: u.created_at } : null;
}
function stayView(s) {
  if (!s) return null;
  return { ...s, proposer_name: L.userName(s.proposer_id), reviewer_name: s.reviewed_by ? L.userName(s.reviewed_by) : null };
}
function overlappingStays(start, end, excludeId = 0) {
  return all(
    `SELECT * FROM stays WHERE status IN ('pending','confirmed') AND id != ?
     AND NOT (end_date < ? OR start_date > ?) ORDER BY start_date`, excludeId, start, end).map(stayView);
}
function currentStay(dateStr) {
  return get(`SELECT * FROM stays WHERE status = 'confirmed' AND start_date <= ? AND end_date >= ?
              ORDER BY start_date LIMIT 1`, dateStr, dateStr);
}
function photoView(p) {
  // NFR-3: thumb_url serves the resized derivative when one exists
  return p && { ...p, url: '/uploads/' + p.path, thumb_url: '/uploads/' + (p.thumb_path || p.path), uploader_name: L.userName(p.uploaded_by) };
}
function projectView(p, req) {
  if (!p) return null;
  const contributions = all(
    `SELECT c.*, u.name AS user_name FROM contributions c JOIN users u ON u.id = c.user_id
     WHERE c.project_id = ? ORDER BY c.created_at`, p.id)
    .map(c => ({ ...c, photos: all('SELECT * FROM photos WHERE contribution_id = ?', c.id).map(photoView) }));
  const photos = all('SELECT * FROM photos WHERE project_id = ? ORDER BY uploaded_at', p.id).map(photoView);
  return {
    ...p,
    creator_name: L.userName(p.created_by),
    claimant_name: p.claimed_by ? L.userName(p.claimed_by) : null,
    can_edit: !!req.user && (isAdmin(req) || p.created_by === req.user.id), // D2
    contributions, photos,
  };
}
function suggestionView(s) {
  let current = null;
  if (s.target_id) {
    if (s.target_type === 'checklist_item') {
      const item = get('SELECT * FROM checklist_items WHERE id = ?', s.target_id);
      if (item) current = { title: null, text: item.text };
    } else {
      const sec = get('SELECT * FROM manual_entries WHERE id = ?', s.target_id);
      if (sec) current = { title: sec.title, text: sec.content };
    }
  }
  return { ...s, submitter_name: L.userName(s.submitted_by), reviewer_name: s.reviewed_by ? L.userName(s.reviewed_by) : null, current };
}

// =====================================================================
// AUTH
// =====================================================================
router.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (get('SELECT id FROM users WHERE email = ?', email)) return res.status(400).json({ error: 'That email is already registered' });
  const r = run('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)',
    String(name).trim(), String(email).trim(), L.hashPassword(password), 'member');
  const id = Number(r.lastInsertRowid);
  L.audit(id, 'register', 'user', id);
  const t = L.createSession(id);
  res.cookie('session', t, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', id)) });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = get('SELECT * FROM users WHERE email = ?', String(email || '').trim());
  if (!u || !L.verifyPassword(password || '', u.password_hash)) return res.status(401).json({ error: 'Wrong email or password' });
  if (!u.active) return res.status(403).json({ error: 'Your account is waiting for admin approval' });
  const t = L.createSession(u.id);
  res.cookie('session', t, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  res.json({ user: publicUser(u) });
});

router.post('/auth/logout', (req, res) => {
  L.destroySession(req.cookies.session);
  res.clearCookie('session');
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', req.user.id).n;
  res.json({ user: publicUser(req.user), unread });
});

// AUTH-3: magic link (first login / reset). Dev transport = outbox.
router.post('/auth/magic-request', (req, res) => {
  const u = get('SELECT * FROM users WHERE email = ?', String(req.body?.email || '').trim());
  if (u && u.active) {
    const t = L.token();
    run(`INSERT INTO magic_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))`, t, u.id);
    const link = `${req.protocol}://${req.get('host')}/api/auth/magic/${t}`;
    L.sendMail(u.email, 'Your Martin Brevard House sign-in link', `Tap to sign in (valid 1 hour):\n${link}`);
  }
  res.json({ ok: true, message: 'If that email has an account, a sign-in link was sent.' });
});
router.get('/auth/magic/:token', (req, res) => {
  const m = get(`SELECT * FROM magic_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')`, req.params.token);
  if (!m) return res.status(400).send('This sign-in link is invalid or expired.');
  run('UPDATE magic_tokens SET used = 1 WHERE token = ?', req.params.token);
  const t = L.createSession(m.user_id);
  res.cookie('session', t, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  res.redirect('/');
});

router.post('/auth/password', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  run('UPDATE users SET password_hash = ? WHERE id = ?', L.hashPassword(password), req.user.id);
  res.json({ ok: true });
});

// =====================================================================
// DASHBOARD (HOME-1..4)
// =====================================================================
router.get('/dashboard', requireAuth, (req, res) => {
  const today = L.today();
  const current = currentStay(today);
  const next = get(`SELECT * FROM stays WHERE status = 'confirmed' AND start_date > ? ORDER BY start_date LIMIT 1`, today);
  // HOME-3: stay-aware — does the current user arrive or depart today?
  const mineToday = get(
    `SELECT * FROM stays WHERE proposer_id = ? AND status = 'confirmed' AND (start_date = ? OR end_date = ?) LIMIT 1`,
    req.user.id, today, today);
  // HOME-3: lead with the relevant list's first items, not just a link
  const essentials = mineToday
    ? all(`SELECT id, text FROM checklist_items WHERE type = ? AND deleted = 0 ORDER BY sort_order, id LIMIT 3`,
        mineToday.start_date === today ? 'checkin' : 'checkout')
    : [];
  const activity = all(
    `SELECT e.*, u.name AS actor_name FROM events e JOIN users u ON u.id = e.actor_id
     ORDER BY e.created_at DESC, e.id DESC LIMIT 12`);
  const recentPhotos = all('SELECT * FROM photos ORDER BY uploaded_at DESC, id DESC LIMIT 6').map(photoView);
  let pendingCount = 0;
  if (isAdmin(req)) {
    pendingCount =
      get(`SELECT COUNT(*) AS n FROM suggestions WHERE status = 'pending'`).n +
      get(`SELECT COUNT(*) AS n FROM stays WHERE status = 'pending'`).n;
  }
  res.json({
    currentStay: stayView(current),
    nextStay: stayView(next),
    myStayToday: mineToday ? { ...stayView(mineToday), arriving: mineToday.start_date === today, departing: mineToday.end_date === today, essentials } : null,
    activity, recentPhotos, pendingCount,
  });
});

// =====================================================================
// STAYS / CALENDAR (CAL-1..6)
// =====================================================================
router.get('/stays', requireAuth, (req, res) => {
  const today = L.today();
  const upcoming = all(`SELECT * FROM stays WHERE status IN ('pending','confirmed') AND end_date >= ? ORDER BY start_date`, today).map(stayView);
  const past = all(`SELECT * FROM stays WHERE status = 'confirmed' AND end_date < ? ORDER BY start_date DESC`, today).map(stayView);
  res.json({ upcoming, past, today });
});

router.get('/stays/overlap', requireAuth, (req, res) => {
  const { start, end } = req.query;
  if (!L.isIsoDate(start) || !L.isIsoDate(end)) return res.json({ overlaps: [] });
  res.json({ overlaps: overlappingStays(start, end) });
});

router.post('/stays', requireAuth, (req, res) => {
  const { start_date, end_date, party_size, who_text, notes } = req.body || {};
  if (!L.isIsoDate(start_date) || !L.isIsoDate(end_date)) return res.status(400).json({ error: 'Start and end dates are required' });
  if (end_date < start_date) return res.status(400).json({ error: 'End date must be on or after the start date' }); // CAL-3
  const party = parseInt(party_size, 10);
  if (!Number.isInteger(party) || party < 1 || party > 30) return res.status(400).json({ error: 'Party size must be a number (1–30)' });
  const status = isAdmin(req) ? 'confirmed' : 'pending'; // D1/CAL-1
  const r = run('INSERT INTO stays (proposer_id, start_date, end_date, party_size, who_text, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    req.user.id, start_date, end_date, party, String(who_text || req.user.name), String(notes || ''), status);
  const id = Number(r.lastInsertRowid);
  if (status === 'pending') {
    L.notifyAdmins(`${req.user.name} proposed a stay ${start_date} → ${end_date} (${party} people).`, '/account', req.user.id);
  } else {
    L.addEvent(req.user.id, `added a stay ${start_date} → ${end_date}`, '/calendar');
  }
  L.audit(req.user.id, 'create', 'stay', id, `${start_date}..${end_date} ${status}`);
  res.json({ stay: stayView(get('SELECT * FROM stays WHERE id = ?', id)), overlaps: overlappingStays(start_date, end_date, id) });
});

router.get('/stays/:id', requireAuth, (req, res) => {
  const s = get('SELECT * FROM stays WHERE id = ?', req.params.id);
  if (!s) return res.status(404).json({ error: 'Stay not found' });
  const checks = all(
    `SELECT cc.*, ci.text AS item_text, ci.type AS list_type, u.name AS checked_by_name
     FROM checklist_checks cc JOIN checklist_items ci ON ci.id = cc.item_id JOIN users u ON u.id = cc.checked_by
     WHERE cc.stay_id = ? ORDER BY cc.checked_at`, s.id);
  const photos = all('SELECT * FROM photos WHERE stay_id = ? ORDER BY uploaded_at', s.id).map(photoView);
  res.json({ stay: stayView(s), checks, photos });
});

router.post('/stays/:id/approve', requireAdmin, (req, res) => {
  const s = get(`SELECT * FROM stays WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!s) return res.status(404).json({ error: 'No pending stay with that id' });
  run(`UPDATE stays SET status = 'confirmed', reviewed_by = ? WHERE id = ?`, req.user.id, s.id);
  L.notify(s.proposer_id, `Your stay ${s.start_date} → ${s.end_date} was approved.`, '/calendar');
  L.addEvent(s.proposer_id, `has a confirmed stay ${s.start_date} → ${s.end_date}`, '/calendar');
  L.audit(req.user.id, 'approve', 'stay', s.id);
  res.json({ ok: true });
});

router.post('/stays/:id/reject', requireAdmin, (req, res) => {
  const s = get(`SELECT * FROM stays WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!s) return res.status(404).json({ error: 'No pending stay with that id' });
  const reason = String(req.body?.reason || '');
  run(`UPDATE stays SET status = 'rejected', reviewed_by = ?, review_reason = ? WHERE id = ?`, req.user.id, reason, s.id); // CAL-6: archived, not deleted
  L.notify(s.proposer_id, `Your stay ${s.start_date} → ${s.end_date} was declined${reason ? ': ' + reason : '.'}`, '/calendar');
  L.audit(req.user.id, 'reject', 'stay', s.id, reason);
  res.json({ ok: true });
});

// =====================================================================
// CHECKLISTS (CHK-1..6)
// =====================================================================
router.get('/checklists', requireAuth, (req, res) => {
  const items = {
    checkin: all(`SELECT * FROM checklist_items WHERE type = 'checkin' AND deleted = 0 ORDER BY sort_order, id`),
    checkout: all(`SELECT * FROM checklist_items WHERE type = 'checkout' AND deleted = 0 ORDER BY sort_order, id`),
  };
  const active = currentStay(L.today());
  const checks = active
    ? all(`SELECT cc.*, u.name AS checked_by_name FROM checklist_checks cc JOIN users u ON u.id = cc.checked_by WHERE cc.stay_id = ?`, active.id)
    : [];
  const mySuggestions = all(
    `SELECT * FROM suggestions WHERE target_type = 'checklist_item' AND submitted_by = ? AND status = 'pending' ORDER BY created_at`,
    req.user.id).map(suggestionView);
  const pendingCount = isAdmin(req)
    ? get(`SELECT COUNT(*) AS n FROM suggestions WHERE target_type = 'checklist_item' AND status = 'pending'`).n : 0;
  res.json({ items, activeStay: stayView(active), checks, mySuggestions, pendingCount });
});

// CHK-2: checks record per stay (who/when)
router.post('/checklists/check', requireAuth, (req, res) => {
  const { item_id, stay_id, checked } = req.body || {};
  const stay = get(`SELECT * FROM stays WHERE id = ? AND status = 'confirmed'`, stay_id);
  const item = get('SELECT * FROM checklist_items WHERE id = ? AND deleted = 0', item_id);
  if (!stay || !item) return res.status(400).json({ error: 'Unknown stay or item' });
  if (checked) {
    run('INSERT OR IGNORE INTO checklist_checks (stay_id, item_id, checked_by) VALUES (?, ?, ?)', stay.id, item.id, req.user.id);
  } else {
    run('DELETE FROM checklist_checks WHERE stay_id = ? AND item_id = ?', stay.id, item.id);
  }
  res.json({ ok: true });
});

// CHK-5: direct admin CRUD
router.post('/checklist-items', requireAdmin, (req, res) => {
  const { type, text } = req.body || {};
  if (!['checkin', 'checkout'].includes(type) || !text) return res.status(400).json({ error: 'type and text required' });
  const max = get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM checklist_items WHERE type = ?', type).m;
  const r = run('INSERT INTO checklist_items (type, text, sort_order) VALUES (?, ?, ?)', type, String(text), max + 1);
  L.audit(req.user.id, 'create', 'checklist_item', Number(r.lastInsertRowid), text);
  res.json({ ok: true });
});
router.put('/checklist-items/:id', requireAdmin, (req, res) => {
  const item = get('SELECT * FROM checklist_items WHERE id = ?', req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (req.body?.text !== undefined) run('UPDATE checklist_items SET text = ? WHERE id = ?', String(req.body.text), item.id);
  if (Number.isInteger(req.body?.sort_order)) run('UPDATE checklist_items SET sort_order = ? WHERE id = ?', req.body.sort_order, item.id);
  L.audit(req.user.id, 'edit', 'checklist_item', item.id, String(req.body?.text || ''));
  res.json({ ok: true });
});
router.delete('/checklist-items/:id', requireAdmin, (req, res) => {
  run('UPDATE checklist_items SET deleted = 1 WHERE id = ?', req.params.id);
  L.audit(req.user.id, 'delete', 'checklist_item', Number(req.params.id));
  res.json({ ok: true });
});

// =====================================================================
// SUGGESTIONS (CHK-6, MAN-4, ADM-2/3) — structured, targeted edits
// =====================================================================
router.post('/suggestions', requireAuth, (req, res) => {
  const { target_type, target_id, checklist_type, action, proposed_title, proposed_text } = req.body || {};
  if (!['checklist_item', 'manual_section'].includes(target_type)) return res.status(400).json({ error: 'Bad target type' });
  if (!['add', 'modify', 'delete'].includes(action)) return res.status(400).json({ error: 'Bad action' });
  if (action !== 'delete' && !proposed_text && !(target_type === 'manual_section' && proposed_title)) {
    return res.status(400).json({ error: 'Proposed text is required' });
  }
  if (action !== 'add') {
    const exists = target_type === 'checklist_item'
      ? get('SELECT id FROM checklist_items WHERE id = ? AND deleted = 0', target_id)
      : get('SELECT id FROM manual_entries WHERE id = ? AND deleted = 0', target_id);
    if (!exists) return res.status(400).json({ error: 'Target not found' });
  }
  if (target_type === 'checklist_item' && action === 'add' && !['checkin', 'checkout'].includes(checklist_type)) {
    return res.status(400).json({ error: 'checklist_type required for new checklist items' });
  }
  const r = run(
    `INSERT INTO suggestions (target_type, target_id, checklist_type, action, proposed_title, proposed_text, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    target_type, target_id || null, checklist_type || null, action, String(proposed_title || '') || null, String(proposed_text || ''), req.user.id);
  const label = target_type === 'checklist_item' ? 'checklist' : 'House Manual';
  L.notifyAdmins(`${req.user.name} suggested a ${label} edit (${action}).`, '/account', req.user.id);
  L.audit(req.user.id, 'create', 'suggestion', Number(r.lastInsertRowid), `${target_type}/${action}`);
  res.json({ ok: true });
});

router.get('/suggestions/mine', requireAuth, (req, res) => {
  res.json({ suggestions: all('SELECT * FROM suggestions WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 20', req.user.id).map(suggestionView) });
});

// ADM-2: approve, optionally with admin-edited text (edit-before-approve)
router.post('/suggestions/:id/approve', requireAdmin, (req, res) => {
  const s = get(`SELECT * FROM suggestions WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!s) return res.status(404).json({ error: 'No pending suggestion with that id' });
  const text = String(req.body?.edited_text ?? s.proposed_text);
  const title = String(req.body?.edited_title ?? s.proposed_title ?? '');
  if (s.target_type === 'checklist_item') {
    if (s.action === 'add') {
      const max = get('SELECT COALESCE(MAX(sort_order),0) AS m FROM checklist_items WHERE type = ?', s.checklist_type).m;
      run('INSERT INTO checklist_items (type, text, sort_order) VALUES (?, ?, ?)', s.checklist_type, text, max + 1);
    } else if (s.action === 'modify') {
      run('UPDATE checklist_items SET text = ? WHERE id = ?', text, s.target_id);
    } else {
      run('UPDATE checklist_items SET deleted = 1 WHERE id = ?', s.target_id);
    }
  } else {
    if (s.action === 'add') {
      const max = get('SELECT COALESCE(MAX(sort_order),0) AS m FROM manual_entries').m;
      run('INSERT INTO manual_entries (section, title, content, sort_order) VALUES (?, ?, ?, ?)', 'General', title || 'New section', text, max + 1);
    } else if (s.action === 'modify') {
      const sec = get('SELECT * FROM manual_entries WHERE id = ?', s.target_id);
      run('UPDATE manual_entries SET title = ?, content = ? WHERE id = ?', title || sec.title, text, s.target_id);
    } else {
      run('UPDATE manual_entries SET deleted = 1 WHERE id = ?', s.target_id);
    }
  }
  run(`UPDATE suggestions SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`, req.user.id, s.id);
  L.notify(s.submitted_by, `Your suggested edit was approved and is now live. Thanks!`,
    s.target_type === 'checklist_item' ? '/checkinout' : '/manual'); // NTF-1
  L.audit(req.user.id, 'approve', 'suggestion', s.id, text.slice(0, 120)); // ADM-4
  res.json({ ok: true });
});

router.post('/suggestions/:id/reject', requireAdmin, (req, res) => {
  const s = get(`SELECT * FROM suggestions WHERE id = ? AND status = 'pending'`, req.params.id);
  if (!s) return res.status(404).json({ error: 'No pending suggestion with that id' });
  const reason = String(req.body?.reason || '');
  run(`UPDATE suggestions SET status = 'rejected', reviewed_by = ?, review_reason = ?, reviewed_at = datetime('now') WHERE id = ?`,
    req.user.id, reason, s.id); // ADM-3: archived with reason
  L.notify(s.submitted_by, `Your suggested edit was declined${reason ? ': ' + reason : '.'}`,
    s.target_type === 'checklist_item' ? '/checkinout' : '/manual');
  L.audit(req.user.id, 'reject', 'suggestion', s.id, reason);
  res.json({ ok: true });
});

// =====================================================================
// ISSUE REPORTS (CHK-4, PRJ-8, EMG-3)
// =====================================================================
router.post('/reports', requireAuth, upload.single('photo'), (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Describe what is broken' });
  const stay = currentStay(L.today());
  const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
  const pr = run(
    `INSERT INTO projects (category, title, description, status, created_by, source) VALUES ('maintenance', ?, ?, 'not_started', ?, 'report')`,
    title, text, req.user.id);
  const projectId = Number(pr.lastInsertRowid);
  let photoId = null;
  if (req.file) {
    const ph = run('INSERT INTO photos (uploaded_by, project_id, path, caption, taken_at) VALUES (?, ?, ?, ?, ?)',
      req.user.id, projectId, req.file.filename, 'Reported issue', L.today());
    photoId = Number(ph.lastInsertRowid);
  }
  run('INSERT INTO issue_reports (reporter_id, stay_id, text, photo_id, project_id) VALUES (?, ?, ?, ?, ?)',
    req.user.id, stay ? stay.id : null, text, photoId, projectId);
  L.notifyAdmins(`${req.user.name} reported something broken: "${title}" — it's now in Maintenance.`, '/projects', req.user.id);
  L.addEvent(req.user.id, `reported an issue: ${title}`, '/projects');
  L.audit(req.user.id, 'create', 'report', projectId, title);
  res.json({ ok: true, project_id: projectId });
});

// =====================================================================
// PROJECTS (PRJ-1..9)
// =====================================================================
router.get('/projects', requireAuth, (req, res) => {
  const rows = all(`SELECT * FROM projects WHERE archived = 0 ORDER BY (status = 'done'), created_at DESC`);
  res.json({ projects: rows.map(p => projectView(p, req)) });
});

router.post('/projects', requireAuth, (req, res) => {
  const { category, title, description, estimated_cost, estimated_time } = req.body || {};
  if (!['maintenance', 'special'].includes(category) || !title) return res.status(400).json({ error: 'Category and title are required' });
  const r = run('INSERT INTO projects (category, title, description, estimated_cost, estimated_time, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    category, String(title), String(description || ''), String(estimated_cost || ''), String(estimated_time || ''), req.user.id);
  L.addEvent(req.user.id, `created a project: ${title}`, '/projects');
  L.audit(req.user.id, 'create', 'project', Number(r.lastInsertRowid), title);
  res.json({ project: projectView(get('SELECT * FROM projects WHERE id = ?', Number(r.lastInsertRowid)), req) });
});

router.put('/projects/:id', requireAuth, (req, res) => {
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin(req) && p.created_by !== req.user.id) return res.status(403).json({ error: 'Only the creator or an admin can edit this project' }); // D2/PRJ-7
  const b = req.body || {};
  run('UPDATE projects SET title = ?, description = ?, estimated_cost = ?, estimated_time = ? WHERE id = ?',
    String(b.title ?? p.title), String(b.description ?? p.description),
    String(b.estimated_cost ?? p.estimated_cost), String(b.estimated_time ?? p.estimated_time), p.id);
  L.audit(req.user.id, 'edit', 'project', p.id);
  res.json({ ok: true });
});

router.post('/projects/:id/status', requireAuth, (req, res) => {
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin(req) && p.created_by !== req.user.id) return res.status(403).json({ error: 'Only the creator or an admin can change status' });
  const status = req.body?.status;
  if (!['not_started', 'in_progress', 'done'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  run('UPDATE projects SET status = ? WHERE id = ?', status, p.id); // PRJ-6: any direction, incl. reopen
  if (status === 'done') L.addEvent(req.user.id, `finished: ${p.title}`, '/projects');
  L.audit(req.user.id, 'status:' + status, 'project', p.id);
  res.json({ ok: true });
});

router.post('/projects/:id/claim', requireAuth, (req, res) => {
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body?.unclaim) {
    if (p.claimed_by !== req.user.id && !isAdmin(req)) return res.status(403).json({ error: 'Not your claim' });
    run('UPDATE projects SET claimed_by = NULL WHERE id = ?', p.id);
  } else {
    if (p.claimed_by) return res.status(400).json({ error: 'Already claimed by ' + L.userName(p.claimed_by) });
    run('UPDATE projects SET claimed_by = ? WHERE id = ?', req.user.id, p.id); // PRJ-4
    L.addEvent(req.user.id, `claimed the project: ${p.title}`, '/projects');
  }
  L.audit(req.user.id, req.body?.unclaim ? 'unclaim' : 'claim', 'project', p.id);
  res.json({ ok: true });
});

// PRJ-5: contribution requires a note; photos optional (also PRJ-9 phase tag)
router.post('/projects/:id/contributions', requireAuth, upload.array('photos', 10), (req, res) => {
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const note = String(req.body?.note || '').trim();
  if (!note) return res.status(400).json({ error: 'Say what you did — a note is required' });
  const r = run('INSERT INTO contributions (project_id, user_id, note) VALUES (?, ?, ?)', p.id, req.user.id, note);
  const cid = Number(r.lastInsertRowid);
  const phase = ['before', 'after'].includes(req.body?.phase) ? req.body.phase : null;
  for (const f of req.files || []) {
    run('INSERT INTO photos (uploaded_by, project_id, contribution_id, phase, path, caption, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.user.id, p.id, cid, phase, f.filename, note.slice(0, 80), L.today());
  }
  L.addEvent(req.user.id, `logged work on ${p.title}: ${note.slice(0, 60)}`, '/projects');
  L.audit(req.user.id, 'contribute', 'project', p.id, note.slice(0, 120));
  res.json({ ok: true });
});

router.post('/projects/:id/archive', requireAdmin, (req, res) => {
  run('UPDATE projects SET archived = 1 WHERE id = ?', req.params.id); // PRJ-7: admin-only close-out
  L.audit(req.user.id, 'archive', 'project', Number(req.params.id));
  res.json({ ok: true });
});

// =====================================================================
// MANUAL (MAN-1..4)
// =====================================================================
router.get('/manual', requireAuth, (req, res) => {
  const sections = all('SELECT * FROM manual_entries WHERE deleted = 0 ORDER BY sort_order, id');
  const mySuggestions = all(
    `SELECT * FROM suggestions WHERE target_type = 'manual_section' AND submitted_by = ? AND status = 'pending' ORDER BY created_at`,
    req.user.id).map(suggestionView);
  const pendingCount = isAdmin(req)
    ? get(`SELECT COUNT(*) AS n FROM suggestions WHERE target_type = 'manual_section' AND status = 'pending'`).n : 0;
  res.json({ sections, mySuggestions, pendingCount });
});
router.post('/manual', requireAdmin, (req, res) => {
  const { section, title, content } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const max = get('SELECT COALESCE(MAX(sort_order),0) AS m FROM manual_entries').m;
  const r = run('INSERT INTO manual_entries (section, title, content, sort_order) VALUES (?, ?, ?, ?)',
    String(section || 'General'), String(title), String(content || ''), max + 1);
  L.audit(req.user.id, 'create', 'manual_section', Number(r.lastInsertRowid), title);
  res.json({ ok: true });
});
router.put('/manual/:id', requireAdmin, (req, res) => {
  const sec = get('SELECT * FROM manual_entries WHERE id = ?', req.params.id);
  if (!sec) return res.status(404).json({ error: 'Not found' });
  run('UPDATE manual_entries SET section = ?, title = ?, content = ? WHERE id = ?',
    String(req.body?.section ?? sec.section), String(req.body?.title ?? sec.title), String(req.body?.content ?? sec.content), sec.id);
  L.audit(req.user.id, 'edit', 'manual_section', sec.id);
  res.json({ ok: true });
});
// MAN-5: attach an inline photo to a manual section (appends an /uploads path the renderer shows as an image)
router.post('/manual/:id/photo', requireAdmin, upload.single('photo'), (req, res) => {
  const sec = get('SELECT * FROM manual_entries WHERE id = ? AND deleted = 0', req.params.id);
  if (!sec) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No photo received' });
  run('INSERT INTO photos (uploaded_by, taken_at, path, caption) VALUES (?, ?, ?, ?)',
    req.user.id, L.today(), req.file.filename, `Manual — ${sec.title}`);
  run('UPDATE manual_entries SET content = ? WHERE id = ?', `${sec.content}\n\n/uploads/${req.file.filename}`, sec.id);
  L.audit(req.user.id, 'photo', 'manual_section', sec.id);
  res.json({ ok: true });
});
router.delete('/manual/:id', requireAdmin, (req, res) => {
  run('UPDATE manual_entries SET deleted = 1 WHERE id = ?', req.params.id);
  L.audit(req.user.id, 'delete', 'manual_section', Number(req.params.id));
  res.json({ ok: true });
});

// =====================================================================
// EMERGENCY (EMG-1..3)
// =====================================================================
router.get('/emergency', requireAuth, (req, res) => {
  const items = all('SELECT * FROM emergency_items ORDER BY sort_order, id')
    .map(i => ({ ...i, photo: i.photo_id ? photoView(get('SELECT * FROM photos WHERE id = ?', i.photo_id)) : null }));
  res.json({ items });
});
router.put('/emergency/:id', requireAdmin, (req, res) => {
  const item = get('SELECT * FROM emergency_items WHERE id = ?', req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  run('UPDATE emergency_items SET title = ?, content = ? WHERE id = ?',
    String(req.body?.title ?? item.title), String(req.body?.content ?? item.content), item.id);
  L.audit(req.user.id, 'edit', 'emergency_item', item.id);
  res.json({ ok: true });
});

// =====================================================================
// THINGS TO DO (TTD-1..5)
// =====================================================================
router.get('/things', requireAuth, (req, res) => {
  const things = all('SELECT t.*, u.name AS submitter_name FROM things t JOIN users u ON u.id = t.submitted_by ORDER BY t.is_family_favorite DESC, t.created_at DESC');
  const categories = all('SELECT DISTINCT category FROM things ORDER BY category').map(r => r.category);
  res.json({ things, categories });
});
router.post('/things', requireAuth, (req, res) => {
  const { category, title, description } = req.body || {};
  if (!category || !title) return res.status(400).json({ error: 'Category and name are required' });
  const r = run('INSERT INTO things (category, title, description, submitted_by) VALUES (?, ?, ?, ?)',
    String(category).trim(), String(title).trim(), String(description || ''), req.user.id);
  L.addEvent(req.user.id, `added to the local guide: ${title}`, '/things');
  L.audit(req.user.id, 'create', 'thing', Number(r.lastInsertRowid), title);
  res.json({ ok: true });
});
router.post('/things/:id/favorite', requireAuth, (req, res) => {
  const t = get('SELECT * FROM things WHERE id = ?', req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  run('UPDATE things SET is_family_favorite = ? WHERE id = ?', t.is_family_favorite ? 0 : 1, t.id); // TTD-4
  L.audit(req.user.id, 'favorite', 'thing', t.id, t.is_family_favorite ? 'off' : 'on');
  res.json({ ok: true, is_family_favorite: t.is_family_favorite ? 0 : 1 });
});

// =====================================================================
// PHOTOS (PHO-1..6)
// =====================================================================
router.get('/photos', requireAuth, (req, res) => {
  const photos = all('SELECT * FROM photos ORDER BY COALESCE(taken_at, uploaded_at) DESC, id DESC').map(photoView);
  const stays = all(`SELECT * FROM stays WHERE status = 'confirmed' ORDER BY start_date DESC`).map(stayView);
  const projects = all('SELECT id, title FROM projects ORDER BY created_at DESC');
  res.json({ photos, stays, projects });
});

// PHO-2: auto-match photos to stays by date, overridable via explicit stay_id/project_id.
// NFR-3: accepts optional client-generated thumbnails (thumbs + thumb_map).
function savePhotos(req, files, thumbFiles = [], thumbMap = []) {
  const caption = String(req.body?.caption || '');
  const explicitStay = req.body?.stay_id ? Number(req.body.stay_id) : null;
  const explicitProject = req.body?.project_id ? Number(req.body.project_id) : null;
  let takenList = [];
  try { takenList = JSON.parse(req.body?.taken || '[]'); } catch { takenList = []; }
  const saved = [];
  files.forEach((f, i) => {
    let takenAt = L.today();
    if (takenList[i]) {
      const d = new Date(Number(takenList[i]));
      if (!Number.isNaN(d.getTime())) takenAt = d.toISOString().slice(0, 10);
    }
    let stayId = explicitStay;
    if (!stayId && !explicitProject) {
      const match = get(`SELECT id FROM stays WHERE status = 'confirmed' AND start_date <= ? AND end_date >= ? ORDER BY start_date LIMIT 1`, takenAt, takenAt);
      stayId = match ? match.id : null;
    }
    const thumb = Number.isInteger(thumbMap[i]) && thumbMap[i] >= 0 && thumbFiles[thumbMap[i]] ? thumbFiles[thumbMap[i]].filename : null;
    const r = run('INSERT INTO photos (uploaded_by, taken_at, stay_id, project_id, path, thumb_path, caption) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.user.id, takenAt, stayId, explicitProject, f.filename, thumb, caption);
    saved.push(photoView(get('SELECT * FROM photos WHERE id = ?', Number(r.lastInsertRowid))));
  });
  if (saved.length) L.addEvent(req.user.id, `added ${saved.length} photo${saved.length === 1 ? '' : 's'}`, '/gallery');
  return saved;
}

router.post('/photos', requireAuth, upload.fields([{ name: 'photos', maxCount: 20 }, { name: 'thumbs', maxCount: 20 }]), (req, res) => {
  const files = req.files?.photos || [];
  if (!files.length) return res.status(400).json({ error: 'No photos received' });
  let thumbMap = [];
  try { thumbMap = JSON.parse(req.body?.thumb_map || '[]'); } catch { thumbMap = []; }
  res.json({ photos: savePhotos(req, files, req.files?.thumbs || [], thumbMap) });
});

// PHO-1: PWA share-target — the OS share sheet posts here, then we land in the gallery
router.post('/share', upload.array('photos', 20), (req, res) => {
  if (!req.user) return res.redirect(303, '/');
  if (req.files?.length) savePhotos(req, req.files);
  res.redirect(303, '/gallery');
});

router.delete('/photos/:id', requireAuth, (req, res) => {
  const p = get('SELECT * FROM photos WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin(req) && p.uploaded_by !== req.user.id) return res.status(403).json({ error: 'You can only delete your own photos' }); // PHO-5
  run('UPDATE emergency_items SET photo_id = NULL WHERE photo_id = ?', p.id);
  run('UPDATE issue_reports SET photo_id = NULL WHERE photo_id = ?', p.id);
  run('DELETE FROM photos WHERE id = ?', p.id);
  fs.unlink(path.join(UPLOADS_DIR, p.path), () => {});
  L.audit(req.user.id, 'delete', 'photo', p.id);
  res.json({ ok: true });
});

// =====================================================================
// NOTIFICATIONS (in-app mirror of emails)
// =====================================================================
router.get('/notifications', requireAuth, (req, res) => {
  res.json({ notifications: all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30', req.user.id) });
});
router.post('/notifications/read', requireAuth, (req, res) => {
  run('UPDATE notifications SET read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

// =====================================================================
// ADMIN (ADM-1..5) + guest links (AUTH-4)
// =====================================================================
router.get('/admin/pending', requireAdmin, (req, res) => {
  res.json({
    suggestions: all(`SELECT * FROM suggestions WHERE status = 'pending' ORDER BY created_at`).map(suggestionView),
    stays: all(`SELECT * FROM stays WHERE status = 'pending' ORDER BY start_date`).map(stayView),
  });
});
router.get('/admin/users', requireAdmin, (req, res) => {
  res.json({ users: all('SELECT id, name, email, role, active, created_at FROM users ORDER BY active DESC, name') });
});
router.post('/admin/users/:id/approve', requireAdmin, (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  run('UPDATE users SET active = 1 WHERE id = ?', u.id);
  L.sendMail(u.email, 'Your Martin Brevard House account is approved', `Hi ${u.name},\n\nYou're in — log in and plan a stay.\n\n— Martin Brevard House`);
  L.audit(req.user.id, 'approve', 'user', u.id);
  res.json({ ok: true });
});
router.post('/admin/users/:id/role', requireAdmin, (req, res) => {
  const role = req.body?.role;
  if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'Bad role' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "You can't change your own role" });
  run('UPDATE users SET role = ? WHERE id = ?', role, req.params.id);
  L.audit(req.user.id, 'role:' + role, 'user', Number(req.params.id));
  res.json({ ok: true });
});
router.post('/admin/users/:id/deactivate', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "You can't deactivate yourself" });
  run('UPDATE users SET active = 0 WHERE id = ?', req.params.id);
  run('DELETE FROM sessions WHERE user_id = ?', req.params.id);
  L.audit(req.user.id, 'deactivate', 'user', Number(req.params.id));
  res.json({ ok: true });
});
router.get('/admin/audit', requireAdmin, (req, res) => {
  res.json({ audit: all(`SELECT a.*, u.name AS actor_name FROM audit a JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC, a.id DESC LIMIT 100`) });
});
router.get('/admin/outbox', requireAdmin, (req, res) => {
  res.json({ outbox: all('SELECT * FROM outbox ORDER BY created_at DESC, id DESC LIMIT 50') });
});
router.get('/admin/guest-links', requireAdmin, (req, res) => {
  res.json({ links: all('SELECT * FROM guest_links ORDER BY created_at DESC') });
});
router.post('/admin/guest-links', requireAdmin, (req, res) => {
  const t = L.token(16);
  const days = parseInt(req.body?.expires_days, 10);
  const expiresAt = Number.isInteger(days) && days > 0 ? `datetime('now', '+${days} days')` : 'NULL';
  run(`INSERT INTO guest_links (token, scope, created_by, expires_at) VALUES (?, 'guide_readonly', ?, ${expiresAt})`, t, req.user.id);
  L.audit(req.user.id, 'create', 'guest_link', null, t.slice(0, 6) + '…');
  res.json({ ok: true, url: `/guest/${t}` });
});
router.delete('/admin/guest-links/:id', requireAdmin, (req, res) => {
  run('DELETE FROM guest_links WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// =====================================================================
// GUEST (AUTH-4): read-only guide via capability link, no account
// =====================================================================
router.get('/guest/:token', (req, res) => {
  const link = get(
    `SELECT * FROM guest_links WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`, req.params.token);
  if (!link) return res.status(404).json({ error: 'This guest link is invalid or expired' });
  res.json({
    checkin: all(`SELECT id, text FROM checklist_items WHERE type = 'checkin' AND deleted = 0 ORDER BY sort_order, id`),
    checkout: all(`SELECT id, text FROM checklist_items WHERE type = 'checkout' AND deleted = 0 ORDER BY sort_order, id`),
    manual: all('SELECT id, section, title, content FROM manual_entries WHERE deleted = 0 ORDER BY sort_order, id'),
    emergency: all('SELECT * FROM emergency_items ORDER BY sort_order, id')
      .map(i => ({ ...i, photo: i.photo_id ? photoView(get('SELECT * FROM photos WHERE id = ?', i.photo_id)) : null })),
    things: all('SELECT id, category, title, description, is_family_favorite FROM things ORDER BY is_family_favorite DESC, category'),
  });
});

module.exports = router;
