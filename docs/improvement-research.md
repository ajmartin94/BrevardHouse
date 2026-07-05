# Sourwood House — Improvement Research

**Inputs:** `vacation-home-site-spec.md` (original intent) vs. `app_prototype.html` (prototyping session result), plus external research on comparable products and established patterns. Companion doc: `ux-audit.md` (journey-level evidence for the gaps cited here).
**Date:** July 3, 2026

---

## A. Fidelity gaps: where the prototype diverged from the spec

These are places the prototype *changed or dropped* stated intent — each needs either a fix or a conscious decision to keep the deviation.

| Spec intent | Prototype result | Type | Recommendation |
|---|---|---|---|
| Calendar proposals are **self-service, no approval** ("family decision, not a system rule") | Member proposals created as `pending`, requiring admin approve/reject | ⚠️ Deviation | **Decide deliberately.** Notably, this is the one deviation research supports — every co-owned-home product (OurSharedPlace, Pacaso) offers a request→approval mode. If the family prefers trust-first, revert to auto-publish with overlap warnings; don't keep the gate by accident |
| Checkout "report something broken" **feeds Ongoing Maintenance automatically** | Inert checklist row; label promises the behavior, nothing happens | ❌ Missing | Build it — a small form (what/where/photo) that creates a maintenance project. This was one of the spec's few explicit integrations |
| Calendar shows **overlapping stays** | Renderer draws first matching stay per day; overlaps invisible | ❌ Missing (bug) | Render multiple stay indicators per day (stacked dots/split bars); warn at proposal time when dates overlap |
| Admin approval required for **project status/cost changes** | Any project *creator* edits status/cost freely, no approval | ⚠️ Deviation | Reasonable relaxation for a family — but it contradicts the spec. Suggest keeping creator-edit for their own projects and requiring admin only for *close-out*; write the decision down |
| Checklist/manual **edits** go through approval | Only free-text *suggestions* exist; approval blind-appends text (manual gets a "Suggested update" junk section) | ⚠️ Partial/broken | Replace with structured suggestions (see §B7) |
| Projects have **description + before/after photos**; members can **claim** | No description field, no photo linkage, no claim interaction (`claimedBy` renders but nothing sets it) | ❌ Missing | Add all three; claiming is the social mechanic that makes goal #2 (shared upkeep) work |
| Manual is **searchable** on a phone | Accordion only, no search | ❌ Missing | Client-side full-text filter is an afternoon of work and serves the highest-stress journey |
| Photos **auto-tag via linked calendar stay**; past stays link to *their* photos | Uploads land in a "New uploads" bucket; past-stay links open the unfiltered gallery | ❌ Missing | Match photo date → stay dates to auto-suggest the trip album (see §B6) |
| Optional: checklist instance **tied to a stay** ("checked in on [date] by [user]") | Global shared checkbox state, never resets | ❌ Missing (optional) | Cheap once stays exist: instantiate list state per stay |
| Things To Do records **submitted_by**; favorites are a tag members apply | Submitter not captured; nothing can set `favorite` | ❌ Missing (minor) | Record submitter; let anyone favorite (or reserve for admin — decide) |
| Dashboard shows **current/next visitors** | `upcomingStays[0]` — insertion order, wrong stay shown | ❌ Bug | Sort by date; also handle "someone is there *right now*" |

**Prototype artifacts to strip before build:** Home style A/B/C switcher (pick one — A best serves the spec's dashboard intent), member/admin dev toggle (replace with real roles), simulated photo upload.

---

## B. Research-backed improvements

Findings from comparable products, with sources. Ordered roughly by impact for this app.

### B1. Offline-first PWA + printed QR fallback — the category-standard for remote houses
Every guest-guidebook product converges on the same combo: **Touch Stay** is an installable PWA whose docs tell guests to browse once online so the guide caches for offline use ("for remote locations"), and it generates a **printable QR code** to post in the house ([offline](https://help.touchstay.com/article/104-how-can-my-guest-view-the-pack-when-theyre-offline), [QR](https://help.touchstay.com/article/113-how-to-create-a-qr-code-for-your-guide)). **Breezeway Guide** is deliberately a plain browser link, "no app necessary" ([Breezeway](https://www.breezeway.io/guide)).
**For Sourwood:** service worker pre-caching the checklist + manual + emergency page; "add to home screen" prompt; a laminated QR card on the fridge. Directly addresses the audit's #1 risk (arrival with no signal).

### B2. Stay-aware home screen
**Airbnb** time-gates door codes to 24–48h before check-in ([help](https://www.airbnb.com/help/article/100)); **Breezeway Guide's content changes across the stay** — arrival info first, checkout tasks on departure day ([launch post](https://www.breezeway.io/blog/meetbreezewayguide)).
**For Sourwood:** since stays are already on the calendar, the dashboard can know Priya arrives *today* and lead with her check-in list + door code; on her last morning, lead with checkout. This is what separates the good products from static wikis, and the data model already supports it.

### B3. Usage fairness on the calendar — the missing table-stakes feature
**OurSharedPlace** (purpose-built for family co-owned homes) leads with **automatic nights-per-family tallies** and configurable rules for contested weeks (FCFS vs. approval, rotating priority for peak dates) ([product](https://www.oursharedplace.com/)); **Pacaso SmartStay** guarantees each owner one "special date" per year ([Pacaso](https://www.pacaso.com/blog/how-smartstay-scheduling-works)); **SharedKey** and **Plum** bundle the same calendar+rules+documents set ([SharedKey](https://www.sharedkey.com/), [Plum](https://www.plumcoownership.com/)).
**For Sourwood:** a simple visible nights-per-household tally for the year, and an agreed (written-down) rule for July 4th/Thanksgiving-type weeks. Cheap on top of existing stay data; answers spec open question #3 with evidence.

### B4. Seeded seasonal maintenance + history-as-byproduct
**HomeZada auto-generates a recurring seasonal plan** from a checklist library at signup (filters quarterly, water heater annually) rather than making users build from scratch, and attaches photos/receipts to *completed* tasks so the maintenance history builds itself ([HomeZada](https://www.homezada.com/homeowners/home-maintenance)). **Dwellin** models appliances as first-class records that manuals, warranties, and service history hang off ([Dwellin](https://dwellin.com/)).
**For Sourwood:** seed Ongoing Maintenance with a mountain-house seasonal template (gutters, HVAC filters, deck, winterization, septic pump reminder — the 3-year cycle is already in the manual copy); prompt for a note+photo when marking work done, which simultaneously fixes the canned-note contribution bug (audit H8) and builds the before/after record the spec wanted.

### B5. Emergency page done right
Industry guidance is consistently **layered**: a laminated one-pager (contacts, shut-off *locations* with photos) posted in the house, backed by detail in the guide, because "in an actual emergency people don't browse" ([Rent Responsibly](https://www.rentresponsibly.org/guide-to-emergency-preparedness-for-vacation-rentals/), [Avantio](https://www.avantio.com/blog/vacation-rental-welcome-book/)). **Breezeway** puts "report an issue" inside the guest guide, creating an ops task ([Breezeway](https://www.breezeway.io/guide)).
**For Sourwood:** one scannable emergency page — 911 / Transylvania Regional / property manager / shut-offs *with photos of the actual crawlspace panel* — reachable from a persistent button, cached offline, with a print stylesheet so the same page is the fridge one-pager. Wire "report a problem" into maintenance (§A row 2).

### B6. Photos: don't build sync, build stay-matching
**Immich** won self-hosted family photos on automatic background upload via native apps ([docs](https://docs.immich.app/features/mobile-backup/)); **PhotoPrism's** PWA-only approach is the documented cautionary tale for family adoption ([bakeoff](https://empty.coffee/photo-backup-bakeoff-photoprism-vs-immich-review/)). Immich albums are overlays on a timeline, and **public share links allow upload without an account** ([sharing](https://docs.immich.app/features/sharing/)).
**For Sourwood:** background sync is out of reach for a custom VPS app — instead make upload one tap (`<input capture>` / PWA share-target), **auto-suggest the trip album by matching photo date to the stay calendar** (the one advantage a custom app has over Immich), and offer per-trip upload links so account-less visitors can contribute. Alternative worth considering: run Immich alongside and deep-link trip albums from stays.

### B7. Approval queue: structured diffs, not comment boxes
**MediaWiki's Moderation extension** is the reference: pending edits are real edits shown as before/after diffs, submitters see "sent to moderation" and can keep working on their version, rejections are archived with an audit log ([Extension:Moderation](https://www.mediawiki.org/wiki/Extension:Moderation)). **phpBB** notifies submitters of approve/disapprove **with the moderator's reason** ([guide](https://www.phpbb.com/support/docs/en/3.3/ug/moderatorguide/moderator_queue/)). **Hostfully** structures guidebook content as typed cards so a change is bounded and reviewable ([docs](https://help.hostfully.com/en/articles/2532570-create-a-guidebook-template)).
**For Sourwood:** "Suggest an edit" should target a *specific* checklist item or manual section and carry proposed new text (add/modify/delete), admins see before/after with edit-before-approve, submitters get notified of outcomes with an optional reason. Fixes the audit's 🔴 H3 (junk content on approval) and 🟡 H10 (silent rejections). At 5–15 users this is a page, not a system.

### B8. Auth: passwords, but almost never typed
The self-hosted ecosystem's lesson is that **login friction kills family adoption** ([Immich vs PhotoPrism](https://selfhostable.dev/blog/immich-vs-photoprism-photo-management-2026/)); magic links remove passwords but fail cross-device/offline — risky with spotty service ([FusionAuth](https://fusionauth.io/articles/identity-basics/magic-links)). Capability URLs (unguessable links, optional expiry) are an accepted low-stakes pattern ([Immich sharing](https://docs.immich.app/features/sharing/)).
**For Sourwood:** keep email+password as specced, but make sessions effectively permanent on trusted devices ("remember me" default-on, long-lived cookies), use magic links for first-login/reset only, and add a **tokenized read-only guest link** for one-time visitors — which also answers spec open question #6 (lightweight tier) without building a role.

---

## C. Prioritized roadmap

**P0 — Resolve in the prototype/design phase (decisions & broken mechanics):**
1. Decide the calendar approval question (§A row 1) and the creator-edit-rights question (§A row 4); update spec to match.
2. Fix conflict rendering + stay sorting (audit H4, H5).
3. Redesign suggest-an-edit as structured per-item edits (§B7).
4. Build the report-broken → maintenance flow (§A row 2).
5. Nav: promote Check In/Out and Manual; pick Home style A; add persistent emergency access.

**P1 — Build-phase must-haves:**
6. PWA offline caching + QR/print emergency one-pager (§B1, §B5).
7. Stay-aware dashboard (§B2) + per-stay checklist instances.
8. Real contribution logging (note + photo) and project claiming; project descriptions.
9. Photo↔stay auto-matching on upload; past-stay → filtered trip view (§B6).
10. Manual search; outcome notifications for suggestions/stays.

**P2 — Once the family is using it:**
11. Nights-per-household fairness tally + written peak-week rule (§B3).
12. Seeded seasonal maintenance templates; appliance/system records linking manual ↔ maintenance history (§B4).
13. Guest capability links (read-only guide, per-trip photo upload) (§B6, §B8).
14. Accessibility pass: semantic buttons, focus states, contrast, calendar label sizing (audit H15).

This also disposes of the spec's open questions: #2 (notify all admins; volume is tiny), #3 (informational overlap + fairness tally, per §B3 evidence), #5 (photo volume argues for the Immich-alongside option if uploads take off), #6 (guest capability links, per §B8).
