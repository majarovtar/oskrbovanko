<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep role shells in shared dashboard layouts and render nested pages through Outlet; this reuses navigation without duplicating the guardian view.
- Treat the role switcher as development-only Link navigation, never as role/session state; production authorization must come from verified server permissions when authentication is connected.
- Phase 1 role pages contain only placeholders or existing fictional guardian data; no live patient reads or access grants are implemented until server authorization exists.
- Keep normalized clinical entities in src/lib/data and access them through ClinicalRepository; the guardian compatibility projection derives all displayed fields from the same records to avoid conflicting histories.
- Explicitly select the fictional repository until a hosted backend and server-verified identity exist; never fall back to demo data after a persistent authorization/network error.
- Demo fixtures are deterministic read-only snapshots with fresh copies per repository; mutable state must never leak between SSR requests.
- Model conversations as ordered turns and symptom scores as nullable patient-reported evidence with scale and source turn; never infer numerical severity from qualitative text.
- Derive doctor aggregates and patient filters in the shared data projection, not UI fixtures; distinct pending call IDs prevent double-counting summary and alert reviews.
- Anchor fictional doctor daily counts to the labeled snapshot date; this prevents old demo calls from being presented as live activity.
- Use `/zdravnik/pacient/$id` for detailed doctor records and redirect the former preview URL; both preserve the shared doctor shell and existing patient links.
- Keep demo notes and review transitions in the per-browser Query cache only, never in read-only fixtures or SSR singletons; label every acknowledgement as session-only, not a persistent save.
- Use URL search for the expanded detail call; accept former transcript/source links without advanced highlighting so existing evidence links still open the correct patient conversation.
- Resolve recording playback only through the repository's server-verified, expiring recording URL contract; consent or a storage path alone never grants playback.
- Derive symptom evolution in the shared data layer from source-resolved observations; the compact seven-day chart uses separate axes/series for incompatible scales and null calendar gaps without interpolation.
- Keep all same-day severity observations as separate chart slots and link each mark to its stored observation; missing mentions never imply symptom resolution or numerical zero.

- Keep doctor MVP details to four sections with five recent calls and a simple transcript expansion; preserve older direct-linked calls and all underlying records while hiding notes and advanced analysis.
- Derive guardian status, recent symptoms, and event deliveries from guardian-scoped repository records; missing check-ins never imply normal health and call events never imply notification delivery.
- Keep guardian conversation playback scoped to the guardian repository and server-verified recording grant; reuse the timestamped chat renderer without doctor actions or doctor-scoped reads.
- Load patient dashboards through a single self-scoped repository identity; use explicit future calls or timezone-aware daily monitoring plans and label fictional snapshot schedules to avoid presenting old demo activity as live.
- Patient clinic dialing uses only an optional configured clinicPhone field, never the patient's own number; missing clinic numbers keep the call control disabled with an explanation.
