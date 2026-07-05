import React, { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import { api } from '../api.js';
import { ReportModal } from './CheckInOut.jsx';
import { renderContent } from './Manual.jsx';

// GEN-4: printable QR linking back to the app (for the fridge one-pager)
function QrBlock() {
  const qr = qrcode(0, 'M');
  qr.addData(window.location.origin);
  qr.make();
  return (
    <div className="card center" style={{ pageBreakInside: 'avoid' }}>
      <div dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 4, margin: 2 }) }} />
      <div className="muted">Scan for the live house guide — {window.location.host}</div>
    </div>
  );
}

// EMG-1..3: one scannable page — contacts first, then locations with photos.
// Cached offline by the service worker; printable via GEN-4 print styles.
export default function Emergency({ guestItems }) {
  const [items, setItems] = useState(guestItems || null);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!guestItems) api('/emergency').then(d => setItems(d.items)).catch(e => setError(e.message));
  }, [guestItems]);

  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="spin">Loading…</div>;
  const contacts = items.filter(i => i.kind === 'contact');
  const rest = items.filter(i => i.kind !== 'contact');

  return (
    <div>
      <div className="row-between no-print">
        <h1 style={{ color: 'var(--red)' }}>Emergency</h1>
        <button className="btn btn-sm" onClick={() => window.print()}>🖨 Print</button>
      </div>
      <h1 className="print-only">Martin Brevard House — Emergency one-pager</h1>
      <p className="page-sub">Saved on your phone for offline use once you've opened it while connected.</p>

      {contacts.map(i => (
        <div className="card emg-item" key={i.id}>
          <b>{i.title}</b>
          <div style={{ fontSize: 13, marginTop: 3 }}>{renderContent(i.content)}</div>
          {extractPhone(i.content) && <a className="tel no-print" href={`tel:${extractPhone(i.content)}`}>📞 Call {extractPhone(i.content)}</a>}
        </div>
      ))}

      <div className="kicker">Where things are</div>
      {rest.map(i => (
        <div className={`card emg-item ${i.kind === 'location' ? 'loc' : ''}`} key={i.id}>
          <b>{i.title}</b>
          <div style={{ fontSize: 13, marginTop: 3 }}>{renderContent(i.content)}</div>
          {i.photo && <img src={i.photo.url} alt={i.photo.caption || i.title} loading="lazy" />}
        </div>
      ))}

      <QrBlock />

      {!guestItems && (<>
        <div className="kicker no-print">Not urgent, but broken?</div>
        <button className="btn btn-danger btn-block no-print" onClick={() => setReportOpen(true)}>
          ⚠ Report a problem — creates a maintenance project
        </button>
      </>)}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  );
}

function extractPhone(text) {
  const m = String(text).match(/\d{3}[-.\s]\d{3}[-.\s]\d{4}|911/);
  return m ? m[0] : null;
}
