import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import CheckInOut from './pages/CheckInOut.jsx';
import Calendar from './pages/Calendar.jsx';
import StayDetail from './pages/StayDetail.jsx';
import Projects from './pages/Projects.jsx';
import Manual from './pages/Manual.jsx';
import Emergency from './pages/Emergency.jsx';
import Things from './pages/Things.jsx';
import Gallery from './pages/Gallery.jsx';
import Account from './pages/Account.jsx';
import Login from './pages/Login.jsx';
import Guest from './pages/Guest.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// NAV-1: Home, Check In/Out, Calendar, Projects, More
const NAV = [
  { path: '/', label: 'Home', glyph: '⌂' },
  { path: '/checkinout', label: 'Check In/Out', glyph: '✓' },
  { path: '/calendar', label: 'Calendar', glyph: '▦' },
  { path: '/projects', label: 'Projects', glyph: '⚒' },
];
const MORE = [
  { path: '/manual', label: 'House Manual' },
  { path: '/things', label: 'Things To Do' },
  { path: '/gallery', label: 'Photo Gallery' },
  { path: '/account', label: 'Account' },
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [unread, setUnread] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const refreshMe = useCallback(async () => {
    try {
      const d = await api('/auth/me');
      setUser(d.user);
      setUnread(d.unread || 0);
      if (d.user?.role === 'admin') {
        const dash = await api('/dashboard');
        setPendingCount(dash.pendingCount || 0);
      } else {
        setPendingCount(0);
      }
    } catch {
      setUser(null);
    }
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);
  useEffect(() => { setMoreOpen(false); }, [loc.pathname]);

  if (loc.pathname.startsWith('/guest/')) {
    return <Routes><Route path="/guest/:token" element={<Guest />} /></Routes>;
  }
  if (user === undefined) return <div className="shell"><div className="spin">Loading…</div></div>;
  if (!user) return <Login onLogin={refreshMe} />;

  const ctx = { user, unread, setUnread, pendingCount, refreshMe, isAdmin: user.role === 'admin' };
  const badge = pendingCount + unread;
  const moreActive = MORE.some(m => loc.pathname.startsWith(m.path)) || moreOpen;

  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <header className="hdr">
          <button className="hdr-logo" onClick={() => nav('/')} aria-label="Home">
            <div className="hdr-mark" aria-hidden>M</div>
            <div className="hdr-title">Martin Brevard House</div>
          </button>
          {/* NAV-2: emergency access from every screen */}
          <button className="hdr-emg" onClick={() => nav('/emergency')}>⚠ Emergency</button>
          <button className="hdr-user" onClick={() => nav('/account')} aria-label="Account">
            {user.name[0]}
            {badge > 0 && <span className="dot" aria-label={`${badge} items waiting`} />}
          </button>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/checkinout" element={<CheckInOut />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/stays/:id" element={<StayDetail />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/things" element={<Things />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {moreOpen && (
          <div className="sheet-back" onClick={() => setMoreOpen(false)}>
            <nav className="sheet" onClick={e => e.stopPropagation()} aria-label="More pages">
              <div className="sheet-grip" />
              {MORE.map(m => (
                <button key={m.path} onClick={() => nav(m.path)}>
                  <span>{m.label}</span>
                  <span aria-hidden>{m.path === '/account' && badge > 0 ? `${badge} ›` : '›'}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        <nav className="nav" aria-label="Main">
          {NAV.map(n => (
            <button key={n.path} className={loc.pathname === n.path ? 'on' : ''} onClick={() => nav(n.path)}>
              <span className="glyph" aria-hidden>{n.glyph}</span>{n.label}
            </button>
          ))}
          <button className={moreActive ? 'on' : ''} onClick={() => setMoreOpen(true)}>
            <span className="glyph" aria-hidden>☰</span>More
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        </nav>
      </div>
    </Ctx.Provider>
  );
}

// ---------- shared small components ----------
export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="row-between">
          <h3>{title}</h3>
          <button className="btn btn-sm no-print" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  const labels = { not_started: 'Not started', in_progress: 'In progress', done: 'Done', pending: 'Pending', confirmed: 'Confirmed' };
  return <span className={`pill pill-${status}`}>{labels[status] || status}</span>;
}
