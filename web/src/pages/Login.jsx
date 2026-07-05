import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | register | magic
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'login') {
        await api('/auth/login', { body: { email: form.email, password: form.password } });
        onLogin();
      } else if (mode === 'register') {
        const d = await api('/auth/register', { body: form });
        setMessage(d.message);
        setMode('login');
      } else {
        const d = await api('/auth/magic-request', { body: { email: form.email } });
        setMessage(d.message + ' (Dev build: the link is in the admin Outbox / server log.)');
      }
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <div className="shell">
      <main style={{ paddingTop: 48 }}>
        <div className="center" style={{ marginBottom: 22 }}>
          <div className="hdr-mark" style={{ width: 54, height: 54, fontSize: 26, margin: '0 auto 10px' }} aria-hidden>M</div>
          <h1>Martin Brevard House</h1>
          <p className="page-sub">The family hub for stays, projects &amp; the house guide</p>
        </div>
        <form className="card" onSubmit={submit}>
          {mode === 'register' && (<><label htmlFor="name">Your name</label><input id="name" value={form.name} onChange={set('name')} autoComplete="name" required /></>)}
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          {mode !== 'magic' && (<>
            <label htmlFor="password">Password{mode === 'register' ? ' (8+ characters)' : ''}</label>
            <input id="password" type="password" value={form.password} onChange={set('password')}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : undefined} />
          </>)}
          {error && <div className="error" role="alert">{error}</div>}
          {message && <div className="notice">{message}</div>}
          <button className="btn btn-primary btn-block mt" disabled={busy}>
            {mode === 'login' ? 'Log in' : mode === 'register' ? 'Request an account' : 'Email me a sign-in link'}
          </button>
        </form>
        <div className="center">
          {mode !== 'login' && <button className="btn-link" onClick={() => setMode('login')}>Back to log in</button>}
          {mode === 'login' && <>
            <button className="btn-link" onClick={() => setMode('register')}>New here? Request an account</button>
            <br />
            <button className="btn-link" onClick={() => setMode('magic')}>Forgot password? Get a sign-in link</button>
          </>}
        </div>
        <p className="muted center" style={{ marginTop: 30 }}>Dev build — seeded accounts all use password <b>brevard2026</b></p>
      </main>
    </div>
  );
}
