# Sourwood House Prototype — UX Audit & User Journey Mapping

**Scope:** `app_prototype.html` (extracted app logic + markup), audited against the intent in `vacation-home-site-spec.md` (v0.1).
**Date:** July 3, 2026
**Method:** Heuristic review of every screen and interaction handler in the prototype, then journey mapping across the eight scenarios the spec's goals imply. Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

---

## 1. What the prototype gets right

Worth stating before the findings, because a lot of the spec's *hard* requirements landed:

- **Pending states are visible, not buried** — the spec's #1 process rule. Members see their own "Pending review" suggestions inline on the page they edited; admins get a badge dot on More, a pending card on Home, and inline banners on Checklist/Manual. This is the best-executed part of the prototype.
- **The mixed contribution model is mostly legible.** Auto-publish (photos, things-to-do, contributions) vs. approval-gated (checklist/manual edits) is expressed with clear microcopy ("posts immediately" vs. "admin reviews before it changes").
- **Tap-to-check checklists** (not prose), exactly as specced, with good real content ordering (door code first, wifi second).
- **Member/Admin preview toggle** with a "dev switch, not final product" banner — honest prototyping.
- **Nice additions beyond spec:** Google Maps links on every Things To Do entry, a real month-grid calendar with a legend, "Family fave" badges.
- Warm, cohesive visual identity (Lora/Inter, olive-on-cream) that feels like a family place, not a SaaS tool.

---

## 2. User journey maps

### J1 — Arrival day: "I'm in the driveway, what's the door code?"
*Priya arrives at 4pm with her family after a six-hour drive. One bar of LTE on the mountain road.*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Driveway | Opens site on phone | "Just need the code" | App requires a live connection; nothing is cached offline. Spotty Brevard cell service makes this the single riskiest moment of the whole product | 🔴 |
| Find the checklist | Home → quick-link card (or More → Check In/Out) | "Where's check-in?" | Check In/Out is **not in the bottom nav** — Gallery got the slot instead. Home quick-links mitigate on style A, but from any other screen it's a 2-tap detour through More | 🟡 |
| Work the list | Taps items to check them off | "Done, done, done" | Checkbox state is global — her checkmarks are everyone's checkmarks, and nothing ties this run of the list to *her* stay (spec's "checked in on [date] by [user]" record is absent) | 🟡 |
| Settle in | Reads wifi, thermostat, quirks | "The back door trick, good to know" | Content itself is excellent | — |

**Opportunities:** Offline-first PWA + a printed QR card at the house (see improvement doc §B1). Put Check In/Out in the bottom nav. Instantiate a checklist per stay.

---

### J2 — Mid-stay emergency: "It's 9pm and water is on the floor"
*The spec explicitly names this journey: the House Manual is "the 'it's 9pm and something's wrong' section."*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Panic | Opens app | "Shutoff. Where." | No emergency affordance anywhere in the chrome. The Manual — the designated emergency section — is buried under **More** | 🟠 |
| Hunt | Opens Manual, scans accordion | "Which section?" | **No search** (spec: "easy to scan/search on a phone"). Wifi section is open by default; she must tap through "Septic & Well" to find the well pump switch. Water shutoff location actually lives in the *check-in list*, a different page | 🟠 |
| Act | Finds shutoff, kills water | "OK. Now what?" | — | — |
| Report | Returns to checkout list, taps "Report something broken (adds to House Projects)" | "This will tell Andrew" | **The row is inert** — it's a plain checklist item that toggles a checkmark. The promised feed into House Projects does not exist. The report evaporates | 🔴 |

**Opportunities:** Persistent emergency entry point; manual search; a real "report a problem" flow that creates a maintenance project (spec required it; the label already promises it).

---

### J3 — Checkout morning
*Marcus, last morning, kids in the car.*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Open list | Check In/Out → Check Out tab | — | Tab pattern works well | — |
| Work the list | Checks off trash, dishes, thermostat, locks | "Almost out" | Same shared-checkbox issue as J1 — if the previous guest's checks weren't reset, the list starts half-done | 🟡 |
| Report broken | Sees the report row | — | Dead end, as in J2 | (counted in J2) |
| Leave | Closes app | "Did I do everything?" | No completion state, no record. The spec's optional per-stay checklist record would give the family a light "house was closed up properly on Jun 21" log | ⚪ |

---

### J4 — Planning a stay: "Can we come the weekend of the 22nd?"
*Claire proposes dates from her couch.*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Look for openings | Calendar month view | "Is it free?" | Calendar renders **only one stay per day** (`find()` takes the first match) — if two stays overlap, the second is invisible. The spec's single explicit calendar requirement was *conflict visibility* | 🔴 |
| Propose | + Propose dates → form | "Easy enough" | No validation: end date can precede start; party size is free text. No overlap warning at submit time | 🟡 |
| Submit | Form posts | "Done!" | Stay is created as **pending, requiring admin approval** — the spec says date proposals are *self-service, no approval needed*. The prototype added a gate the family decided against | 🟠 |
| Wait | Checks back later | "Did Andrew see it?" | No notification when approved/rejected; rejection silently deletes the stay with no trace or reason | 🟡 |
| Glance at Home | "Next stay" card | — | **"Next stay" shows the wrong stay**: it's `upcomingStays[0]`, insertion order, not date order. Demo data shows Aug 8 as "next" while a Jul 18 stay exists; every new proposal appends to the bottom | 🟠 |

**Opportunities:** Decide the approval question deliberately (it contradicts the spec — see improvement doc §A). Render overlapping stays (stacked bars/dots). Sort stays by date everywhere. Date-range validation.

---

### J5 — On-site work: "I swapped the HVAC filters"
*Ben does an hour of house work; goal #2 of the whole product is making this visible.*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Find the task | Projects → Maintenance tab | "There it is" | Two-lane structure matches spec | — |
| Claim it | — | "I'll take the gutters too" | **No way to claim a project.** `claimedBy` exists in the data and renders on cards, but no interaction sets it | 🟠 |
| Log the work | + Log contribution | "Let me say what I did" | Button instantly posts a **canned note ("Checked in on this project")** — no text input, no photo attach. The contribution log, the heart of the shared-ownership goal, can only ever say one meaningless thing | 🟠 |
| Update status | Change status | — | One-way cycle (not started → in progress → done, then stuck); no reopen. Also: any project *creator* can change official status/cost with no approval — spec reserved that for admins | 🟡 |
| Document | — | "Before/after pics" | Projects have no description field (spec had one) and no photo linkage; before/after sets can't exist | 🟡 |

---

### J6 — Admin triage: "What's waiting on me?"
*Andrew, Sunday evening.*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Notice | Badge dot on More, pending card on Home | "Three things" | Discoverability is genuinely good | — |
| Review | Account → pending list | "What is this change?" | Suggestions are **free text**, not edits. "Update well pump reset steps" — update it *to what*? Admin can't see a before/after or edit before approving | 🟠 |
| Approve | Taps Approve | "Done" | Approving a manual suggestion creates a section literally titled **"Suggested update"** with the raw suggestion as body — the approval flow *inserts junk into the manual* that Andrew must then go edit manually. Checklist approvals blindly append the text as a new item (suggestions can never modify or remove an existing item) | 🔴 |
| Reject | Taps Reject | — | Silent delete. No reason, no notification; submitter's "Pending review" chip just vanishes | 🟡 |

**Opportunities:** Structured suggestions (proposed change to a *specific* item/section, with before/after), edit-before-approve, outcome notifications. See improvement doc §B7.

---

### J7 — After the trip: photos
*Marcus uploads from the drive home. The spec flags upload as "the feature most likely to get skipped if clunky."*

| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Upload | Gallery → + Upload | "One tap, nice" | Simulated but appropriately low-friction | — |
| File it | — | — | Upload lands in a generic **"New uploads"** group — not his just-ended trip. The spec's auto-tag-via-calendar-stay is absent, so the sorting burden lands on the least-motivated moment | 🟡 |
| Revisit | Calendar → past stay → "📷 view trip photos" | "Show me June" | Link goes to the **whole unfiltered gallery**, not the trip's photos | 🟡 |

---

### J8 — Trip inspiration: rainy Saturday
| Stage | Doing | Thinking | Pain points | Sev |
|---|---|---|---|---|
| Browse | Things To Do → chips filter | "Rainy Day… Cradle of Forestry" | Filter + favorites badges + maps links all work well | — |
| Add | + Add → posts immediately | "Adding the new taco place" | Can't mark it a family favorite (nothing sets `favorite`); category is free text, so "Hikes"/"hiking"/"Hike" will fragment the chips; submitter isn't recorded (spec's data model has `submitted_by`) | ⚪ |

---

## 3. Heuristic findings summary

| # | Finding | Where | Sev |
|---|---|---|---|
| H1 | No offline capability; the app is useless exactly where it's needed (remote house, weak cell) | Global | 🔴 |
| H2 | "Report something broken" is an inert label; the specced checkout→maintenance pipeline doesn't exist | Check Out | 🔴 |
| H3 | Approving a suggestion inserts malformed content ("Suggested update" sections, blind-appended checklist items) | Admin/Manual/Checklist | 🔴 |
| H4 | Calendar hides overlapping stays (first-match-wins rendering); conflict visibility was the spec's one calendar rule | Calendar | 🔴 |
| H5 | "Next stay" is insertion-ordered, not date-ordered — Home shows the wrong stay with the demo data itself | Home | 🟠 |
| H6 | Stay proposals require admin approval, contradicting the spec's self-service decision | Calendar | 🟠 |
| H7 | Check In/Out and House Manual (goals #1 and the emergency section) are buried under More; Gallery holds a nav slot | Bottom nav | 🟠 |
| H8 | Contribution logging takes no note text and no photo; project claiming has no UI | Projects | 🟠 |
| H9 | No manual search; no emergency quick access | Manual | 🟠 |
| H10 | No outcome feedback loop: rejections (stays, suggestions) silently vanish for the submitter | Cross-cutting | 🟡 |
| H11 | Checklist state is global and never resets; no per-stay instance | Checklist | 🟡 |
| H12 | Photos don't auto-associate with stays; past-stay photo links are unfiltered | Gallery/Calendar | 🟡 |
| H13 | Form gaps: end-before-start dates accepted, party size free text, things-to-do category free text | Forms | 🟡 |
| H14 | Projects lack description and photo linkage; status is one-way; creators bypass the specced admin gate on status/cost | Projects | 🟡 |
| H15 | Accessibility: all buttons are `div onclick` (no keyboard/focus/ARIA), 7px calendar labels, several sub-12px low-contrast text runs | Global | 🟡 |
| H16 | Prototype artifacts to strip before build: Home style A/B/C switcher (pick one — A is the strongest for the spec's dashboard intent), `onchange` handlers that only fire on blur | Global | ⚪ |

**Bottom line:** The prototype nails the *feel* and the approval-visibility model, but four of the spec's load-bearing mechanics — offline/arrival reliability, report-broken → maintenance, meaningful suggestion approval, and calendar conflict visibility — are either missing or actively misleading, and the two highest-stakes journeys (arrival day, 9pm emergency) are the ones most exposed.
