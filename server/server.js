const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { UPLOADS_DIR } = require('./db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4545;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api', routes);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Serve the built React app (web/dist). SPA fallback for client-side routes.
const DIST = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/(api|uploads)\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Frontend not built yet. Run: npm run build --prefix web'));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nMartin Brevard House dev server running:`);
  console.log(`  local:   http://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  network: http://${a.address}:${PORT}  (${a.name})`);
  console.log('');
});
