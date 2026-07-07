const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'brevard.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  household TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS magic_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS guest_links (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'guide_readonly',
  stay_id INTEGER REFERENCES stays(id),
  expires_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stays (
  id INTEGER PRIMARY KEY,
  proposer_id INTEGER NOT NULL REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  who_text TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  review_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('checkin','checkout')),
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS checklist_checks (
  id INTEGER PRIMARY KEY,
  stay_id INTEGER NOT NULL REFERENCES stays(id),
  item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  checked_by INTEGER NOT NULL REFERENCES users(id),
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (stay_id, item_id)
);
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('checklist_item','manual_section')),
  target_id INTEGER,
  checklist_type TEXT CHECK (checklist_type IN ('checkin','checkout')),
  action TEXT NOT NULL CHECK (action IN ('add','modify','delete')),
  proposed_title TEXT,
  proposed_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  review_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('maintenance','special')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','done')),
  estimated_cost TEXT NOT NULL DEFAULT '',
  estimated_time TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  claimed_by INTEGER REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'member' CHECK (source IN ('member','report')),
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS manual_entries (
  id INTEGER PRIMARY KEY,
  section TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS emergency_items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('contact','location','info')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  photo_id INTEGER REFERENCES photos(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS things (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_family_favorite INTEGER NOT NULL DEFAULT 0,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  taken_at TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  stay_id INTEGER REFERENCES stays(id),
  project_id INTEGER REFERENCES projects(id),
  contribution_id INTEGER REFERENCES contributions(id),
  phase TEXT CHECK (phase IN ('before','after')),
  path TEXT NOT NULL,
  thumb_path TEXT,
  caption TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS issue_reports (
  id INTEGER PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  stay_id INTEGER REFERENCES stays(id),
  text TEXT NOT NULL,
  photo_id INTEGER REFERENCES photos(id),
  project_id INTEGER REFERENCES projects(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function get(sql, ...params) { return db.prepare(sql).get(...params); }
function all(sql, ...params) { return db.prepare(sql).all(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }

module.exports = { db, get, all, run, DATA_DIR, UPLOADS_DIR };
