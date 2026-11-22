# Phase 1
- [x] Preserve visual login and existing guardian dashboard.
- [x] Add three role layouts, routes, and role-specific placeholder navigation.
- [x] Add development-only navigation switcher without permission changes.
- [x] Verify desktop/mobile navigation and existing patient/call selection.
- [x] Report working routes and deferred phases; do not begin Phase 2.

# Phase 2
- [x] Define normalized shared clinical data models and read-only repository contract.
- [x] Replace fixed questionnaires with consistent fictional conversation histories for both demo patients.
- [x] Connect the existing guardian view to the shared repository without redesign.
- [x] Test source provenance, relationship scoping, consistency, and existing navigation.
- [x] Document simulated versus persistent data; stop after Phase 2.

# Phase 3
- [x] Derive doctor overview, priorities, and latest evidence from the shared repository.
- [x] Build overview cards, attention section, searchable/sortable table, and filters.
- [x] Add selected-patient preview links without full reports or charts.
- [x] Verify data rules and desktop/tablet workflows; stop after Phase 3.

# Phase 4
- [x] Build `/zdravnik/pacient/$id` with monitoring context and call-linked detail sections.
- [x] Render arbitrary timestamped conversation turns and source-linked observations.
- [x] Add gated recording player and authorization contract; demo recordings remain absent, actual playback unverified until real recordings/backend exist.
- [x] Add truthful session-only demo notes and reviews; preserve read-only fixtures.
- [x] Verify detail flows, old links, errors, and desktop/tablet layouts; defer Phase 5 charts.

# Phase 5
- [x] Derive scale-compatible symptom series, gaps, and changes from stored observations only.
- [x] Add interactive charts, date filters, series toggles, tooltips, and source links.
- [x] Add symptom cards, sparklines, and qualitative timelines without invented scores.
- [x] Verify point provenance, both patient histories, and desktop/tablet/mobile interactions; stop after Phase 5.

# Doctor MVP simplification
- [x] Reduce overview to four statistics, urgent patients, and a simple patient list.
- [x] Reduce patient details to overview, latest measurements, one seven-day chart, and five recent calls.
- [x] Preserve records, clinical warnings, dynamic transcripts, and authorized recording checks.
- [x] Verify both patient flows and compact desktop/mobile layouts; actual audio remains unavailable in demo records.

# Phase 6 — Guardian MVP
- [x] Preserve patient cards and add current status with explicit missing check-in states.
- [x] Add latest call and a simple transcript modal with authorized recording checks; real audio remains unavailable in demo records.
- [x] Derive compact symptom changes and notification/contact information from shared records without invented contact numbers or deliveries.
- [x] Verify patient switching, data rules, desktop/mobile, and unchanged doctor pages.

# Phase 7 — Minimal patient dashboard
- [x] Add patient-scoped greeting, next call, three simple steps, and help.
- [x] Derive daily schedule and completed/missed states without inventing a clinic phone number; clinic calling is disabled until a number is configured.
- [x] Keep doctor/guardian experiences unchanged and verify desktop/mobile and data rules.