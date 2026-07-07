// Seed the dev database. Destructive: rebuilds server/data/brevard.db from scratch.
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
for (const f of ['brevard.db', 'brevard.db-wal', 'brevard.db-shm']) {
  fs.rmSync(path.join(DATA_DIR, f), { force: true });
}

const { run, get, UPLOADS_DIR } = require('./db');
const { hashPassword, token } = require('./lib');

const PASSWORD = 'brevard2026';
const hash = hashPassword(PASSWORD);

const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// ---------- users ----------
const users = {};
function addUser(name, email, role, active = 1) {
  const r = run('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)', name, email, hash, role, active);
  users[name.split(' ')[0].toLowerCase()] = Number(r.lastInsertRowid);
}
addUser('Andrew Martin', 'martin.andrew.94@gmail.com', 'admin');
addUser('Claire Martin', 'claire@example.com', 'member');
addUser('Ben Okafor', 'ben@example.com', 'member');
addUser('Priya Nair', 'priya@example.com', 'member');
addUser('Marcus Boone', 'marcus@example.com', 'member');
addUser('Tom Rivera', 'tom@example.com', 'member');

// ---------- stays ----------
function addStay(proposer, start, end, party, who, notes, status) {
  const r = run('INSERT INTO stays (proposer_id, start_date, end_date, party_size, who_text, notes, status, reviewed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    proposer, start, end, party, who, notes, status, status === 'confirmed' ? users.andrew : null);
  return Number(r.lastInsertRowid);
}
const stayDeckTrip = addStay(users.andrew, daysFromNow(-62), daysFromNow(-59), 1, 'Andrew Martin (solo)', 'Deck repair trip', 'confirmed');
const stayBooneWeek = addStay(users.marcus, daysFromNow(-30), daysFromNow(-23), 5, 'The Boone family', '', 'confirmed');
const stayCurrent = addStay(users.priya, daysFromNow(-1), daysFromNow(2), 4, 'Priya Nair + family', 'First summer visit', 'confirmed');
const stayNext = addStay(users.andrew, daysFromNow(14), daysFromNow(18), 2, 'Andrew & Claire Martin', 'Bringing the dog', 'confirmed');
addStay(users.marcus, daysFromNow(35), daysFromNow(38), 3, 'Marcus Boone + friends', '', 'pending');

// ---------- checklists ----------
const checkin = [
  'Door code: 4817# (garage keypad)',
  'Wifi: MartinBrevardHouse — password is on the fridge whiteboard',
  "Thermostat: set to 68°F — don't go below 60 in winter",
  'Water shutoff: crawlspace access panel, left of the dryer (photo on the Emergency page)',
  'Trash day is Tuesday — bins are in the carport',
  'House quirk: the back door sticks — lift the handle while turning the key',
];
const checkout = [
  'Take all trash to the road bins',
  'Run the dishwasher and start one load of towels',
  'Set the thermostat back to 58°F',
  'Lock both deadbolts — the garage code re-arms automatically',
  'Something broken? Report it below so it lands in House Projects',
];
checkin.forEach((text, i) => run("INSERT INTO checklist_items (type, text, sort_order) VALUES ('checkin', ?, ?)", text, i + 1));
checkout.forEach((text, i) => run("INSERT INTO checklist_items (type, text, sort_order) VALUES ('checkout', ?, ?)", text, i + 1));

// a couple of checks recorded against the current stay (CHK-2 demo)
run('INSERT INTO checklist_checks (stay_id, item_id, checked_by) VALUES (?, ?, ?)', stayCurrent, 1, users.priya);
run('INSERT INTO checklist_checks (stay_id, item_id, checked_by) VALUES (?, ?, ?)', stayCurrent, 2, users.priya);

// ---------- placeholder photos (SVG) ----------
function makeSvg(name, c1, c2, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<path d="M0 420 L140 300 L260 380 L420 240 L560 360 L700 280 L800 340 L800 600 L0 600 Z" fill="rgba(30,25,18,0.28)"/>
<circle cx="650" cy="120" r="52" fill="rgba(255,255,255,0.35)"/>
<text x="30" y="560" font-family="Georgia, serif" font-size="34" fill="rgba(255,255,255,0.92)">${label}</text>
</svg>`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), svg);
}
function addPhoto(uploader, name, c1, c2, label, { stay = null, project = null, phase = null, taken, caption }) {
  makeSvg(name, c1, c2, label);
  const r = run('INSERT INTO photos (uploaded_by, taken_at, stay_id, project_id, phase, path, caption) VALUES (?, ?, ?, ?, ?, ?, ?)',
    uploader, taken, stay, project, phase, name, caption);
  return Number(r.lastInsertRowid);
}

// ---------- projects ----------
function addProject(cat, title, desc, status, cost, time, createdBy, claimedBy, source = 'member') {
  const r = run('INSERT INTO projects (category, title, description, status, estimated_cost, estimated_time, created_by, claimed_by, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    cat, title, desc, status, cost, time, createdBy, claimedBy, source);
  return Number(r.lastInsertRowid);
}
const pGutters = addProject('maintenance', 'Clean gutters', 'Front and back runs, plus the porch overhang. Ladder is in the garage.', 'not_started', '$150', '2 hrs', users.andrew, null);
const pFilters = addProject('maintenance', 'Replace HVAC filters', 'Filters are 16x25x1 — keep 4 spares in the hall closet.', 'in_progress', '$40', '30 min', users.ben, users.ben);
addProject('maintenance', 'Chimney inspection & sweep', 'Annual before first fire of the season.', 'done', '$220', 'half day', users.claire, users.claire);
addProject('maintenance', 'Septic tank pump-out (due 2027)', 'Last pumped 2024 — every 3 years. Use Brevard Septic Co.', 'not_started', '$450', 'scheduled service', users.andrew, null);
const pBackDoor = addProject('maintenance', 'Back door handle sticking', 'Reported at checkout: the back door handle sticks badly even with the lift-and-turn trick. Probably needs the latch assembly replaced.', 'not_started', '', '', users.marcus, null, 'report');
const pDeck = addProject('special', 'Deck repair and repaint',
  'Replace the three rotten boards on the west corner, sand the whole surface, then repaint with the leftover stain color (Cabot "Bark Mulch", 2 cans in the garage).',
  'in_progress', '$600', '2 weekends', users.andrew, users.andrew);
addProject('special', 'Convert bunk room to guest suite', 'Framing plan sketched — queen bed, built-in desk, blackout curtains.', 'not_started', '$4,200', '~3 weekends', users.andrew, null);

run('INSERT INTO issue_reports (reporter_id, stay_id, text, project_id) VALUES (?, ?, ?, ?)',
  users.marcus, stayBooneWeek, 'The back door handle sticks badly even with the lift-and-turn trick.', pBackDoor);

// contributions
function addContribution(project, user, note, daysAgo) {
  const r = run("INSERT INTO contributions (project_id, user_id, note, created_at) VALUES (?, ?, ?, datetime('now', ?))",
    project, user, note, `-${daysAgo} days`);
  return Number(r.lastInsertRowid);
}
addContribution(pFilters, users.ben, 'Picked up 4 filters, swapped the upstairs unit. Downstairs next visit.', 20);
const cDeck1 = addContribution(pDeck, users.andrew, 'Pulled the three rotten boards and replaced them with pressure-treated stock. Sanding next trip.', 59);

// photos: trips + deck project before/during
addPhoto(users.marcus, 'boone-porch.svg', '#8a6f4e', '#b5875e', 'Kids on the porch swing', { stay: stayBooneWeek, taken: daysFromNow(-28), caption: 'Kids on the porch swing' });
addPhoto(users.marcus, 'boone-sunset.svg', '#b5673f', '#e0a45a', 'Sunset from the deck', { stay: stayBooneWeek, taken: daysFromNow(-27), caption: 'Sunset from the deck' });
addPhoto(users.marcus, 'boone-dinner.svg', '#6d8560', '#9db07f', 'Dinner on the porch', { stay: stayBooneWeek, taken: daysFromNow(-25), caption: 'Big family dinner' });
addPhoto(users.andrew, 'ridge-fog.svg', '#5f7752', '#8fa47e', 'Fog over the ridge', { stay: stayDeckTrip, taken: daysFromNow(-61), caption: 'Morning fog over the ridge' });
addPhoto(users.priya, 'creek-walk.svg', '#4e6e78', '#86a8ae', 'Creek behind the house', { stay: stayCurrent, taken: daysFromNow(-1), caption: 'Creek walk with the kids' });
addPhoto(users.andrew, 'deck-before.svg', '#7a6a55', '#a3917a', 'Deck — before', { project: pDeck, phase: 'before', taken: daysFromNow(-62), caption: 'Weathered boards before repair' });
addPhoto(users.andrew, 'deck-during.svg', '#5f4632', '#8a6f4e', 'Deck — new boards in', { project: pDeck, taken: daysFromNow(-59), caption: 'New boards in, ready for sanding' });
// tie the deck "during" photo to Andrew's contribution as well
run('UPDATE photos SET contribution_id = ? WHERE path = ?', cDeck1, 'deck-during.svg');

// ---------- manual ----------
const manual = [
  ['Connectivity', 'Wifi & Router Reset', 'Network: MartinBrevardHouse. The password is on the fridge whiteboard.\n\nIf the internet is down:\n- Unplug the router in the hall closet for 30 seconds\n- Plug it back in and wait 2 minutes\n- The light should go solid white'],
  ['Water', 'Water Shutoff & Well Pump', 'Main shutoff: crawlspace access panel, left of the dryer (photo on the Emergency page).\n\nWell pump switch is in the crawlspace next to the shutoff. If water pressure drops to nothing, check the pump breaker first (breaker panel, switch #14).'],
  ['Water', 'Septic System', "Septic is pumped every 3 years — last done 2024, next due 2027.\n\n**No wipes or grease down the drains.** The tank lid is in the side yard under the green cover."],
  ['Appliances', 'Kitchen Appliances', 'Dishwasher pods are under the sink — use one pod, top rack for plastics.\n\nPropane fireplace: wall switch left of the mantle. The tank gauge is in the side yard; call Blue Ridge Propane (828-555-0170) below 20%.'],
  ['Appliances', 'Hot Water Heater', 'The water heater is in the garage corner. If there is no hot water, check breaker #8, then press the red reset button behind the lower access panel.'],
  ['House', 'Trash & Recycling', 'Pickup is Tuesday morning — bins to the road Monday night, back by Wednesday.\n\nRecycling is single-stream (blue bin). No glass in the county pickup — glass goes to the drop-off by the fire station.'],
  ['House', 'Heating & Cooling', 'Heat pump thermostat is in the hall.\n- Summer: 68–72°F\n- Winter: never below 60°F (pipes!)\n- Leaving in winter: set to 58°F at checkout'],
];
manual.forEach(([section, title, content], i) =>
  run('INSERT INTO manual_entries (section, title, content, sort_order) VALUES (?, ?, ?, ?)', section, title, content, i + 1));

// ---------- emergency ----------
const phShutoff = addPhoto(users.andrew, 'shutoff-panel.svg', '#453324', '#6b5a44', 'Crawlspace shutoff panel', { taken: daysFromNow(-90), caption: 'Main water shutoff — crawlspace panel left of dryer' });
const phBreaker = addPhoto(users.andrew, 'breaker-panel.svg', '#3a3f45', '#5c646d', 'Breaker panel in garage', { taken: daysFromNow(-90), caption: 'Breaker panel — garage wall by the chest freezer' });
const phExting = addPhoto(users.andrew, 'extinguisher.svg', '#8a3a2f', '#b5563f', 'Fire extinguisher under sink', { taken: daysFromNow(-90), caption: 'Fire extinguisher — under the kitchen sink' });
const emergency = [
  ['contact', 'Emergency: 911', 'Cell service is weak at the house — use Wi-Fi calling, or the landline in the kitchen (it works in power outages).', null],
  ['contact', 'Nearest ER — Transylvania Regional Hospital', '260 Hospital Dr, Brevard, NC — about 15 minutes. 828-884-9111.', null],
  ['contact', 'Property manager — Dale Whitfield', '828-555-0142. Call for anything urgent with the house itself.', null],
  ['contact', 'Andrew Martin (family admin)', '828-555-0186 — call or text any time.', null],
  ['location', 'Main water shutoff', 'Crawlspace access panel, LEFT of the dryer. Turn the red valve clockwise to close.', phShutoff],
  ['location', 'Breaker panel', 'Garage wall next to the chest freezer. Well pump is #14, water heater is #8.', phBreaker],
  ['location', 'Fire extinguishers', 'Under the kitchen sink, and on the garage wall by the door.', phExting],
  ['info', 'Propane', 'Tank is in the side yard. If you smell gas: leave the house, then call Blue Ridge Propane 828-555-0170 and Dale.', null],
];
emergency.forEach(([kind, title, content, photoId], i) =>
  run('INSERT INTO emergency_items (kind, title, content, photo_id, sort_order) VALUES (?, ?, ?, ?, ?)', kind, title, content, photoId, i + 1));

// ---------- things to do ----------
const things = [
  ['Hikes', 'Looking Glass Rock', '6 mi round trip, big payoff view at the top.', 1, users.andrew],
  ['Hikes', 'DuPont Waterfalls Loop', 'Easy loop past three waterfalls — good with kids.', 1, users.claire],
  ['Waterfalls', 'High Falls', 'Short walk from the parking lot.', 1, users.claire],
  ['Waterfalls', 'Triple Falls', 'Featured in Last of the Mohicans.', 0, users.marcus],
  ['Restaurants', 'Hobnob Kitchen', 'Our go-to spot for dinner in town.', 1, users.andrew],
  ['Breweries', 'Oskar Blues Brevard', 'Big patio, dog friendly, food trucks most nights.', 0, users.ben],
  ['Rainy Day', 'Cradle of Forestry', 'Museum plus a covered walking trail.', 0, users.priya],
];
things.forEach(([cat, title, desc, fav, by]) =>
  run('INSERT INTO things (category, title, description, is_family_favorite, submitted_by) VALUES (?, ?, ?, ?, ?)', cat, title, desc, fav, by));

// ---------- pending suggestions (ADM-2 demo) ----------
run(`INSERT INTO suggestions (target_type, target_id, checklist_type, action, proposed_text, submitted_by)
     VALUES ('checklist_item', NULL, 'checkin', 'add', 'Check that the crawlspace dehumidifier is running (switch inside the access panel)', ?)`, users.priya);
const wifiSection = get(`SELECT id FROM manual_entries WHERE title = 'Wifi & Router Reset'`);
run(`INSERT INTO suggestions (target_type, target_id, action, proposed_title, proposed_text, submitted_by)
     VALUES ('manual_section', ?, 'modify', 'Wifi & Router Reset', ?, ?)`,
  wifiSection.id,
  'Network: MartinBrevardHouse. The password is on the fridge whiteboard.\n\nIf the internet is down:\n- Unplug BOTH the router and the white fiber box in the hall closet for 30 seconds\n- Plug the fiber box in first, wait for the green light, then the router\n- Total wait is about 3 minutes',
  users.marcus);

// ---------- activity feed ----------
function addEventRow(actor, text, link, daysAgo) {
  run("INSERT INTO events (actor_id, text, link, created_at) VALUES (?, ?, ?, datetime('now', ?))", actor, text, link, `-${daysAgo} days`);
}
addEventRow(users.andrew, 'created a project: Deck repair and repaint', '/projects', 62);
addEventRow(users.andrew, 'logged work on Deck repair and repaint: replaced the rotten boards', '/projects', 59);
addEventRow(users.marcus, 'added 3 photos from the Boone family week', '/gallery', 24);
addEventRow(users.ben, 'logged work on Replace HVAC filters', '/projects', 20);
addEventRow(users.claire, 'finished: Chimney inspection & sweep', '/projects', 15);
addEventRow(users.priya, 'added 1 photo', '/gallery', 1);

// ---------- guest link ----------
const guestToken = token(16);
run("INSERT INTO guest_links (token, scope, created_by) VALUES (?, 'guide_readonly', ?)", guestToken, users.andrew);

console.log('Seed complete.');
console.log('');
console.log('  Logins (all passwords: %s)', PASSWORD);
console.log('    admin:  martin.andrew.94@gmail.com  (Andrew Martin)');
console.log('    member: claire@example.com, ben@example.com, priya@example.com, marcus@example.com, tom@example.com');
console.log('');
console.log('  Guest guide link: /guest/' + guestToken);
