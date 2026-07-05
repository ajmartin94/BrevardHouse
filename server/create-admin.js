// One-time production bootstrap: creates (or promotes) an admin account and
// issues a real sign-in link, so a fresh deploy never needs seeded demo data
// or a hardcoded password to get the first admin logged in.
//
// Usage: node server/create-admin.js "Full Name" admin@example.com
require('dotenv').config({ quiet: true });
const { get, run } = require('./db');
const L = require('./lib');

const [name, email] = process.argv.slice(2);
if (!name || !email) {
  console.error('Usage: node server/create-admin.js "Full Name" admin@example.com');
  process.exit(1);
}
const trimmedEmail = String(email).trim();

let user = get('SELECT * FROM users WHERE email = ?', trimmedEmail);
if (user) {
  if (user.role !== 'admin' || !user.active) {
    run("UPDATE users SET role = 'admin', active = 1 WHERE id = ?", user.id);
    user = get('SELECT * FROM users WHERE id = ?', user.id);
  }
  console.log(`${trimmedEmail} is set up as an active admin.`);
} else {
  // Random, never-shown password: sign-in for this account happens via the
  // magic link below. The admin can set a real password afterwards in Account.
  const r = run('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)',
    String(name).trim(), trimmedEmail, L.hashPassword(L.token(24)), 'admin');
  user = get('SELECT * FROM users WHERE id = ?', Number(r.lastInsertRowid));
  console.log(`Created admin account for ${trimmedEmail}.`);
}

const t = L.token();
run(`INSERT INTO magic_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))`, t, user.id);
const base = (process.env.APP_URL || `http://localhost:${process.env.PORT || 4545}`).replace(/\/$/, '');
const link = `${base}/api/auth/magic/${t}`;

console.log('');
console.log('Sign-in link (valid 24 hours):');
console.log(`  ${link}`);
console.log('');
console.log('Open it in a browser to log in, then set a password from Account -> Change password.');

L.sendMail(trimmedEmail, 'Martin Brevard House — your admin sign-in link', `Tap to sign in (valid 24 hours):\n${link}`);
