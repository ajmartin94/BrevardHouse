# Vacation Home Website — Prototyping Spec (v0.1)

**Purpose:** A shared hub for family and friends staying at the Brevard, NC mountain house (formerly Andrew's grandmother's home). Goals: (1) make check-in/out and visit logistics easy, (2) keep the house well-maintained over time through visible, shared project ownership, (3) help people enjoy the area, and (4) preserve memories from stays.

**Deployment context:** Backend-hosted app on a VPS, with user accounts (not just a shared link). Contribution model is mixed: some actions are open to any logged-in user, others require admin approval.

---

## 1. User Roles & Permissions

| Role | Description |
|---|---|
| **Guest/Member** | Any registered family/friend account. Can view everything, add photos, propose calendar dates, submit change requests. |
| **Admin** | Trusted family member(s) — likely Andrew + maybe 1-2 others. Approves checklist/manual edits, project changes, and manages accounts. |

**General contribution pattern to carry into every section below:**
- **Auto-published, no approval needed:** photo uploads, calendar date proposals, project "I contributed" logs, things-to-do suggestions.
- **Requires admin approval:** edits to check-in/check-out checklists, edits to the House Manual, changes to official project status/cost, account creation/role changes.
- Submitted-but-unapproved changes should sit in a visible "pending" state (to the submitter and admins) rather than disappearing into a queue nobody checks.

---

## 2. Site Map

1. Home / Dashboard
2. Check In / Check Out
3. Calendar
4. House Projects (Maintenance + Special Projects)
5. House Manual
6. Things to Do (Local Guide)
7. Photo Gallery
8. Account / Admin settings

---

## 3. Section-by-Section Feature Breakdown

### Home / Dashboard
- Welcome message, current/next visitor(s) from calendar
- "What's new": recent photos, recently completed projects, pending approvals (admin view)
- Quick links into the four main tools (checklist, calendar, projects, things to do)

### Check In / Check Out
- Two distinct, tap-to-check lists (not just prose)
- **Check-in items:** door code/key location, wifi info, thermostat guidance, water shutoff location, trash schedule, known quirks/house tips
- **Check-out items:** trash out, dishes/linens, thermostat setback, lock-up steps, "report something broken" (feeds directly into Ongoing Maintenance as a new project/request)
- Any member can submit a suggested edit; admin approves before it updates the live list
- Optional: tie a checklist instance to a calendar stay, so there's a light record of "checked in/out on [date] by [user]"

### Calendar
- Members propose stay dates (self-service, no approval needed)
- Simple conflict visibility — overlapping stays shown, not necessarily blocked (family decision, not a system rule)
- Each stay entry can show who's coming, roughly how many people, and notes (e.g. "bringing the dog")
- Past stays remain visible/linked to that trip's photos and any checklist record

### House Projects
- Two lanes: **Ongoing Maintenance** (recurring: gutters, HVAC filters, deck staining) and **Special Projects** (one-off remodels/upgrades)
- Each project: description, status (not started / in progress / done), estimated cost/time, who's claimed it, before/after photos
- Any member can log a contribution ("I did X on [date]") — auto-published
- Admin approval required to change official status, cost estimates, or close out a project
- Check-out "report something broken" items land here as new maintenance entries automatically

### House Manual
- Appliance instructions, emergency contacts, septic/well info, insurance/emergency shutoffs, wifi/router reset steps, etc.
- Reference-only for most users; edits require admin approval
- Should be easy to scan/search on a phone — this is the "it's 9pm and something's wrong" section

### Things to Do (Local Guide)
- Categorized: hikes (Pisgah/DuPont), waterfalls, restaurants, breweries, rainy-day options
- "Family favorites" tag vs. general/new suggestions
- Any member can add a suggestion (auto-published) — this is meant to grow organically as people visit

### Photo Gallery
- Organize by trip/date (auto-tag via linked calendar stay) and/or by project (before/after sets)
- Upload flow must be low-friction — this is the feature most likely to get skipped if clunky
- Home page "recent additions" strip
- No approval gate — photos post immediately

### Account / Admin
- Simple account creation (email + password is fine to start; no need for enterprise auth)
- Admin panel: approve pending checklist/manual/project edits, manage user roles, view all pending items in one place

---

## 4. Data Model Sketch (for planning, not final schema)

- **User**: id, name, email, role (member/admin), password hash
- **Stay**: id, user_id, start_date, end_date, party_size, notes
- **ChecklistItem**: id, type (checkin/checkout), text, order, status (approved/pending), submitted_by, approved_by
- **Project**: id, category (maintenance/special), title, description, status, estimated_cost, estimated_time, claimed_by
- **ProjectContribution**: id, project_id, user_id, date, notes, photo_ids
- **ManualEntry**: id, section, title, content, status (approved/pending)
- **ThingToDo**: id, category, title, description, is_family_favorite, submitted_by
- **Photo**: id, uploaded_by, date, stay_id (nullable), project_id (nullable), url/path, caption

---

## 5. Open Questions to Resolve Before/During Prototyping

1. How many admins, and is admin-ship permanent or rotating?
2. Should checklist "pending edit" notifications go to all admins or a specific one?
3. Does the calendar need any conflict resolution logic, or is overlap purely informational?
4. Is there a shared cost/contribution ledger for special projects (money, not just labor), or is that tracked elsewhere?
5. Photo storage: how much volume/resolution do you want to plan for on the VPS (affects storage sizing, not just UI)?
6. Any guests who shouldn't get full accounts (e.g., one-time visitors) — is there a lightweight/limited-role tier needed?

---

## 6. Suggested Next Step

Bring this doc into your Design module to sketch page-by-page wireframes (Home, Checklist, Calendar, Projects, Manual, Things to Do, Gallery, Admin), then layer in the data model once the UI feels right.
