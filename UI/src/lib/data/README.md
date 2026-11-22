# Phase 2: shared clinical data

## Entities

`models.ts` defines normalized records linked by opaque IDs:

- **Patients**: contact, clinical context, recording consent, provenance.
- **Patient relationships**: user-to-patient links with role and validity dates, separate from login/profile data.
- **Monitoring plans**: patient/clinician links, individual goals, local schedule and timezone, available measurement types, fictional clinician-configured criteria. No questionnaires.
- **Calls / attempts**: schedule, start/end, completion status, optional recording reference; each attempt has its own time and outcome.
- **Conversation turns**: arbitrary ordered AI/patient statements with source call and timestamp. No question bank or fixed question count.
- **Summaries**: source turn IDs, concerns, wellbeing, patient questions, generator and review status.
- **Symptom observations**: patient, call, exact source turn, original statement, observation/extraction times, qualitative description; optional explicitly patient-reported score with scale. Missing/unasked scores stay null, not zero.
- **Measurements**: patient/call/source turn, value, unit, time and origin. Missing measurements have no row.
- **Alerts**: criteria and evidence links, severity, review status and separate resolution status. A review does not resolve a clinical problem.
- **Notifications**: recipient, channel, delivery/read status and timestamps; all fixture deliveries are simulated.
- **Clinical notes / reviews**: author/reviewer, patient and call references, follow-up or review state and timestamps.

## Data access

`ClinicalRepository` is the centralized asynchronous read contract (`listPatients`, `getPatientRecord`). `createDemoRepository(demoUserId)` scopes **fictional records only** to fixture relationships and returns detached copies. Unknown/unlinked demo users get no records. Clinical notes/review records are doctor-only; notifications are recipient-scoped. This illustrates future authorization behavior but is not real-user access control.

The guardian page loads through shared TanStack Query options and route loaders. `guardian-adapter.ts` projects normalized records into the existing page format, including dynamically derived question/answer pairs. Display numbering is not a clinical data model. The original `QUESTIONS` bank and conflicting mock records were removed.

The development switcher remains navigation only; it is not connected to this repository's identity or permissions.

## What is persistent?

**No clinical data is currently persistent.** No Lovable Cloud connection, generated client, or existing table integration is present. The existing login remains visual-only. No service was enabled, tables created, profiles added, or authentication changed in Phase 2. This follows the requested fictional fallback when tables are unavailable.

The source-controlled fixture covers November 16–21, 2026 for Marija Novak and Franc Kranjc: 12 calls, including two missed calls, separate attempts, varying conversations, measurements and source-linked observations. Dates are fixed demonstration dates, not live current-day events. No AI extraction, telephone call, SMS, email or recording actually occurs. Consent does not imply a recording exists.

All records are rebuilt deterministically in memory; reloads reproduce the same history. No localStorage, network writes or persistence API is used. The repository fixtures remain read-only.

## Phase 4 detail actions and recordings

The doctor detail at `/zdravnik/pacient/$id` selects arbitrary call/turn evidence through `patient-detail.ts`. Call, transcript visibility and supporting turn are URL search values. The older patient preview URL redirects to the detail route.

Demo note and review actions are pure transitions applied to the browser's existing Query cache. They update notes, report/alert review statuses and overview pending counts during navigation, but reset on reload. Every acknowledgement explicitly says **session-only, not persistently saved**. Reviews do not resolve alerts. Empty notes, unknown/cross-patient calls, non-doctor relationships and backend data are rejected. There is no real user authorization or persistent save implementation in this phase.

`getAuthorizedRecording` is a capability contract for future server-verified, short-lived HTTPS recording URLs. The fictional repository always returns null. The player never turns storage paths into public URLs, never synthesizes audio, and requires backend provenance, consent and a matching unexpired verified grant. No real recordings currently exist; all available fixture transcripts are labeled simulated. Missing real transcripts must remain missing rather than being replaced with invented statements.

## Later persistent implementation

Implement the same repository contract against verified hosted tables once a backend exists. Resolve the authenticated caller server-side, enforce authorized patient relationships with RLS, preserve caller-scoped reads, and use private recording storage. Never accept a role-switcher value or demo user ID as real authorization, and never substitute demo rows after a denied persistent read. Preserve separate roles/relationship records; do not add a profiles table.

No speculative client/table mappings or migrations have been introduced. Charts, new dashboard content, AI simulation, and live integrations remain later phases.