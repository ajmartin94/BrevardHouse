# Sourwood House — User Requirements Document

**Version:** 1.0 · July 4, 2026
**Status:** Approved baseline for the official dev prototype
**Supersedes:** `archive/vacation-home-site-spec.md` (v0.1 prototyping spec)
**Supporting references:** `ux-audit.md` (journey-level findings, cited as H1–H16), `improvement-research.md` (sourced patterns, cited as B1–B8), `archive/app_prototype.html` (design prototype — visual and interaction reference)

---

## 1. Purpose & background

A shared hub for the family and friends who stay at the Brevard, NC mountain house (formerly Andrew's grandmother's home). Four product goals, unchanged from v0.1:

1. Make check-in/check-out and visit logistics easy.
2. Keep the house well-maintained over time through visible, shared project ownership.
3. Help people enjoy the area.
4. Preserve memories from stays.

The v0.1 spec was prototyped in a design session (`archive/app_prototype.html`). This document rebaselines requirements from three inputs: the original spec, the prototype as built, and the UX audit + external research performed on both. **Where the prototype deliberately diverged from the v0.1 spec, the prototype's behavior is the requirement** (see §3). Where the audit found the prototype broken or missing specced behavior, the corrected behavior is the requirement.

**Deployment context:** self-hosted app on a personal VPS; real user accounts; ~5–15 users; 1–2 admins. Mobile-first — the primary device is a phone at or en route to a house with weak cell coverage.

## 2. Users & roles

| Role | Description |
|---|---|
| **Member** | Registered family/friend. Views everything; uploads photos; proposes stays; adds things-to-do; creates projects and logs contributions; submits structured edit suggestions. |
| **Admin** | Trusted family member(s) (Andrew + 1–2 others). Everything a Member can do, plus: approve/reject pending items, edit checklists/manual directly, manage accounts and roles, edit or close any project. |
| **Guest (link-based)** | Not an account. A person holding a tokenized capability link with narrow scope (read-only house guide, or per-trip photo upload). See AUTH-4/5. |

**Contribution model (carried through every module):**
- *Auto-published:* photo uploads, things-to-do entries, project creation, contribution logs.
- *Requires admin approval:* member stay proposals, edits to checklists and the House Manual (via structured suggestions), account/role changes.
- Every pending item is visible to its submitter and to admins; every resolution (approve/reject) notifies the submitter.

## 3. Baseline decisions (prototype vs. v0.1 spec conflicts — resolved)

These deviations surfaced in the audit are hereby **decided in favor of the prototype's implementation**, per product owner direction:

| # | Decision |
|---|---|
| D1 | **Member stay proposals require admin approval.** Proposals are created in a `pending` state, visibly badged, and confirmed or rejected by an admin. Admin-created stays publish immediately. (v0.1 said self-service/no approval; the prototype's gate stands — and it matches category norms per B3.) |
| D2 | **Project creators self-edit.** A project's creator (or any admin) may edit its details and status without an approval step. (v0.1 reserved status/cost changes for admins.) |
| D3 | **Home layout is the prototype's Style A** (dashboard cards: next-stay hero, 2×2 quick links, pending card, What's New, recent photos). Styles B and C are discarded. |
| D4 | The prototype's *free-text* suggest-an-edit mechanic is **not** carried forward — it was a broken mechanic (audit H3), not a design decision. It is replaced by structured suggestions (CHK-6, MAN-4, ADM-2). |

## 4. Functional requirements

Priority: **M** = Must (dev prototype), **S** = Should (dev prototype if feasible, else fast-follow), **C** = Could (Phase 2). Requirements say "the system shall."

### AUTH — Accounts & access

| ID | Requirement | Pri |
|---|---|---|
| AUTH-1 | Provide email + password accounts with self-service registration gated by admin approval of new accounts (or admin-issued invites). | M |
| AUTH-2 | Keep sessions effectively permanent on trusted devices: "remember me" on by default, long-lived session cookies. Login friction kills family adoption (B8). | M |
| AUTH-3 | Provide magic-link email flow for first login and password reset (not as the sole auth method). | S |
| AUTH-4 | Support admin-generated **read-only guest links**: unguessable tokenized URLs exposing the house guide (checklists, manual, emergency page, things-to-do) without an account, with optional expiry. | S |
| AUTH-5 | Support **per-trip photo upload links** so visitors without accounts can contribute photos to that trip's album. | C |

### GEN — Platform & global behavior

| ID | Requirement | Pri |
|---|---|---|
| GEN-1 | Be an installable PWA. A service worker shall pre-cache the check-in/check-out lists, House Manual, and emergency page so they are fully readable offline after one online visit (H1, B1). | M |
| GEN-2 | Mobile-first layout (~480px primary), functional up to desktop widths. | M |
| GEN-3 | Interactive controls shall be semantic (`button`, `a`, `input`) with visible focus states and accessible labels; text shall meet WCAG AA contrast; no interactive text below 12px (H15). | M |
| GEN-4 | Provide a print stylesheet for the emergency page and check-in essentials, suitable for a laminated fridge one-pager, plus a printable QR code linking to the app (B1, B5). | S |

### NAV — Information architecture

| ID | Requirement | Pri |
|---|---|---|
| NAV-1 | Bottom navigation: **Home, Check In/Out, Calendar, Projects, More**. Manual, Things To Do, Gallery, and Account live under More. (Fixes H7 — check-in is goal #1 and must not be buried; Gallery access is preserved via Home's recent-photos strip and More.) | M |
| NAV-2 | A persistent emergency affordance (header icon) shall open the Emergency page from any screen (H9, B5). | M |
| NAV-3 | Admins shall see a pending-count badge on More/Account and a pending card on Home whenever items await review (carried from prototype — it worked). | M |

### HOME — Dashboard

| ID | Requirement | Pri |
|---|---|---|
| HOME-1 | Style A layout per D3: next-stay hero, quick-link cards (Check In/Out, Calendar, Projects, Local Guide), admin pending card, What's New activity feed, recent-photos strip. | M |
| HOME-2 | "Next stay" shall be computed by date (soonest upcoming), not insertion order, and shall distinguish a stay **in progress** ("Priya & family are at the house now") from a future one (fixes H5). | M |
| HOME-3 | The dashboard shall be **stay-aware** (B2): on a visitor's arrival day it leads with their check-in list and essentials; on their departure day it leads with the checkout list. | S |
| HOME-4 | What's New shall aggregate real events (contributions, completed projects, new photos, new things-to-do) with actor, action, and relative time. | M |

### CHK — Check In / Check Out

| ID | Requirement | Pri |
|---|---|---|
| CHK-1 | Two admin-maintained checklist templates (check-in, check-out) rendered as tap-to-check lists. | M |
| CHK-2 | Checklist state shall be instantiated **per stay** — checking items records "[user] checked [item] on [date]" against that stay, and each stay starts a fresh instance (fixes H11; makes the v0.1 optional record a requirement). | M |
| CHK-3 | A stay's checklist record shall be visible from the stay's detail/history. | S |
| CHK-4 | **Report something broken** shall be a real flow: a short form (what/where, optional photo) reachable from the checkout list and the emergency page, which automatically creates an Ongoing Maintenance project attributed to the reporter (fixes H2). | M |
| CHK-5 | Admins may edit checklist templates directly (add/edit/delete/reorder items). | M |
| CHK-6 | Members shall suggest edits as **structured suggestions**: add a new item, or modify/delete a *specific existing item*, with proposed text — routed to the admin queue (D4, B7). Submitters see their pending suggestions inline on the page. | M |

### CAL — Calendar & stays

| ID | Requirement | Pri |
|---|---|---|
| CAL-1 | Members propose stays (date range, party size, who's coming, notes). Member proposals enter `pending`; admins approve/reject (D1). Admin entries publish as confirmed. | M |
| CAL-2 | Month grid shall render **every** stay touching a day — overlapping stays appear simultaneously (stacked indicators), never first-match-wins (fixes H4). | M |
| CAL-3 | The proposal form shall validate end ≥ start and numeric party size, and shall warn inline when proposed dates overlap an existing stay (informational, not blocking). | M |
| CAL-4 | Upcoming and past stay lists shall be date-sorted; stays move to "past" automatically by date. | M |
| CAL-5 | Each past stay links to *its own* trip photo album and its checklist record (fixes H12 partially; see PHO-3). | S |
| CAL-6 | Rejecting a stay shall require an optional reason and notify the proposer (NTF-1); rejected stays are archived, not silently deleted (H10). | M |
| CAL-7 | Show a per-household/per-member **nights-used tally** for the current year alongside the calendar (fairness transparency, B3). | C |
| CAL-8 | Support an admin-configurable note/rule for contested peak weeks (e.g., July 4th rotation), displayed on the calendar (B3). | C |

### PRJ — House Projects

| ID | Requirement | Pri |
|---|---|---|
| PRJ-1 | Two lanes: Ongoing Maintenance and Special Projects, as tabs. | M |
| PRJ-2 | Project fields: title, **description**, category, status (not started / in progress / done), estimated cost, estimated time, created-by, claimed-by, linked photos (fixes H14's missing description). | M |
| PRJ-3 | Any member may create a project (publishes immediately, attributed as creator). | M |
| PRJ-4 | Any member may **claim** an unclaimed project (one-tap "I'll take this"), and unclaim their own claim (fixes H8's missing claim UI). | M |
| PRJ-5 | Logging a contribution shall prompt for a note (required) and photos (optional) — no canned text (fixes H8). Contributions publish immediately. | M |
| PRJ-6 | Status shall be editable in any direction (including reopening a done project) by the creator or an admin (D2; fixes one-way status). | M |
| PRJ-7 | The creator or an admin may edit project details; only an admin may permanently close/archive a project. | M |
| PRJ-8 | Projects created from broken-item reports (CHK-4) shall carry the report's text/photo and land in Ongoing Maintenance flagged as "reported." | M |
| PRJ-9 | Support before/after photo pairs on a project, shown on the project card and in the gallery's project view (v0.1 intent, PHO-4). | S |
| PRJ-10 | Seed Ongoing Maintenance with a recurring seasonal template (gutters, HVAC filters, deck staining, winterization, septic reminder) that regenerates tasks on schedule (B4). | C |
| PRJ-11 | Model major appliances/systems as records linking manual sections to their maintenance history (B4). | C |

### MAN — House Manual

| ID | Requirement | Pri |
|---|---|---|
| MAN-1 | Sectioned reference content (appliances, septic/well, wifi/router, shutoffs, contacts…) in a scannable accordion. | M |
| MAN-2 | Provide **search/filter** across section titles and body text (fixes H9; v0.1 required it). | M |
| MAN-3 | Admins edit sections directly (add/edit/delete). | M |
| MAN-4 | Members submit structured suggestions targeting a specific section (modify/delete) or proposing a new one, with proposed text (D4, B7). | M |
| MAN-5 | Section content shall support basic formatting (line breaks, bold, lists) and inline photos (e.g., a photo of the crawlspace shutoff panel). | S |

### EMG — Emergency page

| ID | Requirement | Pri |
|---|---|---|
| EMG-1 | A single scannable page: 911 guidance, nearest ER (Transylvania Regional), property manager, urgent contacts, and shut-off/breaker/extinguisher **locations with photos** (B5). Sourced from manual content but curated for panic-speed reading. | M |
| EMG-2 | Reachable via NAV-2 from every screen, cached offline (GEN-1), and printable (GEN-4). | M |
| EMG-3 | Includes the "report a problem" entry point (CHK-4) for non-urgent issues. | M |

### TTD — Things To Do (Local Guide)

| ID | Requirement | Pri |
|---|---|---|
| TTD-1 | Categorized entries (hikes, waterfalls, restaurants, breweries, rainy-day…) with category filter chips; entries auto-publish. | M |
| TTD-2 | The add form shall offer existing categories in a picker plus new-category entry (prevents "Hikes/hiking" fragmentation, H13). | M |
| TTD-3 | Record and display the submitter on each entry. | M |
| TTD-4 | Any member may toggle **Family favorite** on an entry (fixes H8-adjacent gap; v0.1 intended favorites as a living tag). | S |
| TTD-5 | Each entry links to Google Maps (carried from prototype — keep). | M |

### PHO — Photo Gallery

| ID | Requirement | Pri |
|---|---|---|
| PHO-1 | Upload shall be one tap from the PWA (file picker / camera capture; PWA share-target where supported), multiple photos at once, with optional caption. No approval gate; publishes immediately. | M |
| PHO-2 | On upload, the system shall **auto-match photos to a stay** by comparing photo date to the stay calendar and pre-select that trip album (member can override) (fixes H12, B6). | M |
| PHO-3 | Gallery organizes by trip album (and by project for project-linked photos); past-stay links open the trip album filtered view (CAL-5). | M |
| PHO-4 | Photos may be attached to projects (before/after) via PRJ-5/PRJ-9. | S |
| PHO-5 | Uploaders may delete their own photos; admins may delete any. Deletion asks for confirmation (H10-adjacent: no silent destructive taps). | M |
| PHO-6 | Home shows a recent-additions strip (HOME-1). | M |

### ADM — Admin & approvals

| ID | Requirement | Pri |
|---|---|---|
| ADM-1 | A single Account/Admin page lists all pending items (suggestions, stay proposals, account requests) with type, submitter, and summary. | M |
| ADM-2 | Suggestion review shall show a **before/after diff** of the targeted item/section, with the ability to **edit the proposed text before approving** (fixes H3; B7). Approving applies the change exactly as reviewed. | M |
| ADM-3 | Reject requires-optional reason; rejected items are archived with reviewer, timestamp, and reason (audit log), not deleted (H10, B7). | M |
| ADM-4 | Maintain a simple audit log of who approved/rejected/edited what, when. | S |
| ADM-5 | Admins manage accounts: approve registrations, change roles, deactivate accounts. | M |

### NTF — Notifications

| ID | Requirement | Pri |
|---|---|---|
| NTF-1 | Email the submitter when their pending item is approved or rejected (with reason if given) (H10, B7). | M |
| NTF-2 | Email **all admins** when a new pending item arrives (volume is tiny at this scale; resolves v0.1 open question #2). | M |
| NTF-3 | Optional weekly digest (new photos, completed projects, upcoming stays). | C |

## 5. Non-functional requirements

| ID | Requirement | Pri |
|---|---|---|
| NFR-1 | Self-hosted on the family VPS; no third-party account dependencies beyond outbound email (SMTP). | M |
| NFR-2 | Offline: GEN-1 content readable with zero connectivity; writes made offline may fail gracefully with a clear "you're offline — try again when connected" state (write queueing is Phase 2). | M |
| NFR-3 | Photo storage: originals retained on the VPS; serve resized derivatives; plan for low tens of GB initially with a documented path to object storage or an Immich sidecar if volume grows (resolves v0.1 open question #5 direction). | S |
| NFR-4 | Nightly automated backup of the database and uploaded media. | M |
| NFR-5 | Accessibility per GEN-3 across all screens. | M |
| NFR-6 | Visual design carries the prototype's identity: Lora/Inter type, warm cream/olive/brown palette, card-based mobile layout. | S |

## 6. Data model (planning sketch, revised from v0.1)

- **User**: id, name, email, password_hash, role (member/admin), household (nullable), active, created_at
- **Stay**: id, proposer_id, start_date, end_date, party_size, who_text, notes, status (pending/confirmed/rejected), reviewed_by, review_reason, created_at
- **ChecklistItem** (template): id, type (checkin/checkout), text, sort_order
- **ChecklistInstance**: id, stay_id, type; **ChecklistCheck**: instance_id, item_id, checked_by, checked_at
- **Suggestion**: id, target_type (checklist_item/manual_section), target_id (nullable = add), action (add/modify/delete), proposed_text, status (pending/approved/rejected), submitted_by, reviewed_by, review_reason, reviewed_at
- **Project**: id, category (maintenance/special), title, description, status, estimated_cost, estimated_time, created_by, claimed_by, source (member/report), archived, created_at
- **ProjectContribution**: id, project_id, user_id, date, note, photo_ids
- **IssueReport**: id, reporter_id, stay_id (nullable), text, photo_id (nullable), project_id (created)
- **ManualEntry**: id, section, title, content, photo_ids, sort_order
- **ThingToDo**: id, category, title, description, is_family_favorite, submitted_by, created_at
- **Photo**: id, uploaded_by, taken_at, uploaded_at, stay_id (nullable, auto-matched), project_id (nullable), path, caption
- **GuestLink**: id, token, scope (guide_readonly/trip_upload), stay_id (nullable), expires_at, created_by
- **AuditEntry**: id, actor_id, action, target_type, target_id, detail, at

## 7. Out of scope (this phase)

- Native mobile apps and background photo sync (B6 — PWA one-tap upload instead).
- Offline write queueing (NFR-2 keeps offline read-only).
- Money/expense ledger for special projects (v0.1 open question #4 — track labor and estimates only; revisit after real use).
- Enterprise auth/SSO; conflict-*blocking* calendar logic (overlap stays informational per CAL-3).
- Booking fairness *enforcement* (CAL-7/8 are transparency-only).

## 8. Traceability

- **Audit fixes required:** H1→GEN-1 · H2→CHK-4/PRJ-8 · H3→ADM-2/CHK-6/MAN-4 · H4→CAL-2 · H5→HOME-2 · H7→NAV-1 · H8→PRJ-4/PRJ-5 · H9→MAN-2/NAV-2 · H10→CAL-6/ADM-3/NTF-1 · H11→CHK-2 · H12→PHO-2/PHO-3 · H13→CAL-3/TTD-2 · H14→PRJ-2/PRJ-6 · H15→GEN-3 · H16→D3/D4
- **Research adoptions:** B1→GEN-1/GEN-4 · B2→HOME-3 · B3→CAL-7/CAL-8 (+D1 rationale) · B4→PRJ-10/PRJ-11 · B5→EMG-1..3 · B6→PHO-1/PHO-2/AUTH-5/NFR-3 · B7→ADM-2/ADM-3/NTF-1/CHK-6/MAN-4 · B8→AUTH-2/AUTH-3/AUTH-4
- **Prototype-priority decisions:** D1 (stay approval gate), D2 (creator edit rights), D3 (Home Style A).

**Next step:** official dev prototype implementing all **M** requirements, using `archive/app_prototype.html` as the visual/interaction reference.
