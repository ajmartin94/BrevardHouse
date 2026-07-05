const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { get, all, run } = require('./db');

// ---------- passwords & tokens ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}
function token(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }

// ---------- sessions ----------
const SESSION_DAYS = 365; // AUTH-2: effectively-permanent sessions on trusted devices
function createSession(userId) {
  const t = token();
  run(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`, t, userId);
  return t;
}
function sessionUser(t) {
  if (!t) return null;
  return get(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`, t) || null;
}
function destroySession(t) { if (t) run('DELETE FROM sessions WHERE token = ?', t); }

// ---------- mail (SMTP if configured, else dev outbox + console) ----------
// NTF-1/NTF-2. Every email is always recorded in the outbox (viewable in Admin)
// and logged to the console. If SMTP_USER/SMTP_PASS are set (see .env.example),
// it's also actually sent via SMTP.
let mailTransport = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
function sendMail(toEmail, subject, body) {
  run('INSERT INTO outbox (to_email, subject, body) VALUES (?, ?, ?)', toEmail, subject, body);
  console.log(`[mail → ${toEmail}] ${subject}\n${body}\n`);
  if (mailTransport) {
    mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject,
      text: body,
    }).catch((err) => console.error(`[mail → ${toEmail}] send failed:`, err.message));
  }
}

// ---------- notifications / events / audit ----------
function notify(userId, text, link = '') {
  run('INSERT INTO notifications (user_id, text, link) VALUES (?, ?, ?)', userId, text, link);
  const u = get('SELECT email, name FROM users WHERE id = ?', userId);
  if (u) sendMail(u.email, 'Martin Brevard House — ' + text.slice(0, 80), `Hi ${u.name},\n\n${text}\n\n${link ? 'Open: ' + link + '\n\n' : ''}— Martin Brevard House`);
}
function notifyAdmins(text, link = '', exceptUserId = null) {
  for (const a of all(`SELECT id FROM users WHERE role = 'admin' AND active = 1`)) {
    if (a.id !== exceptUserId) notify(a.id, text, link);
  }
}
function addEvent(actorId, text, link = '') {
  run('INSERT INTO events (actor_id, text, link) VALUES (?, ?, ?)', actorId, text, link);
}
function audit(actorId, action, targetType, targetId, detail = '') {
  run('INSERT INTO audit (actor_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)',
    actorId, action, targetType, targetId, detail);
}

// ---------- misc ----------
function today() { return new Date().toISOString().slice(0, 10); }
function isIsoDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function userName(id) { const u = get('SELECT name FROM users WHERE id = ?', id); return u ? u.name : 'Unknown'; }

module.exports = {
  hashPassword, verifyPassword, token,
  createSession, sessionUser, destroySession,
  sendMail, notify, notifyAdmins, addEvent, audit,
  today, isIsoDate, userName,
};
