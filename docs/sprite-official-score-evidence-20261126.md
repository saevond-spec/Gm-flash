# Sprite #1878 — official ClawHunt score evidence and gates (2026-11-26)

This document distinguishes **historically reported official ClawHunt scores** from **new independent execution**. It contains no tokens, buyer information, customer materials, or credentials.

## Previously recorded official marketplace results
- **Capability probe #2935:** completed 2026-11-21T18:21:06.574935Z; passed with overall **95/100**; file_transfer **100/100**, visual_observation **90/100**. Earlier official probe #2932 also reported 95/100 and passed, #2931 72.5/100 and failed.
- **Acceptance benchmark:** last reported **23/100** as of November 25, 2026. The exact detailed criteria breakdown and a newer authenticated response were not available in this read-only source audit. Treat **23 as historical, not a refreshed live result**.
- Do not conflate these with local regression tests (38 source-check cases) or with buyer acceptance of a real assigned job.

## Published scoring contract
ClawHunt's [official webhook/capability documentation](https://clawhunt.store/agent-docs/webhook) defines:
- `GET /api/v1/capability-probe/status` with `scoring_breakdown.file_transfer` and `scoring_breakdown.visual_observation`.
- Passing each >=70/100 earns a Verified Capabilities badge, which is **advisory**, not required to bid.
- File transfer rubric: HTTP 200 (15), valid JSON (10), probe-ID match (10), raw-byte SHA-256 hash (30), content prefix (15), exact byte size (10), response <=10s (10).
- Visual-observation tier-1 rubric: HTTP 200 (15), JSON (10), ID (10), keyword hits (max 40), description >=20 characters (5), response <=10s (10). This sums to **90**, and fallback LLM judging is capped at 80. Under the published rubric, the maximum combined 100+90 averaged score is **95/100**.
- Do not simulate or hardcode the probe image description; downloads and genuine vision inference must be real.

## Authenticated score retrieval (existing deployed Worker, no new development or credential exposure)
The live Worker already implements protected endpoints:
- `GET https://gm-flash.saevond.workers.dev/api/benchmark-status` -> official `GET /api/v1/capability-probe/status`.
- `GET https://gm-flash.saevond.workers.dev/api/acceptance-benchmark-status` -> official `GET /api/v1/benchmark/results/1878`.
- These routes require the existing private `x-control-token` header and verify approved Sprite identity and webhook URL. The dashboard exposes corresponding score-view buttons. Do **not** remove access controls or store/print secret token values.
- The existing Worker also has `/api/benchmark-run`, but this patch DOES NOT invoke or automate scoring runs, which may be rate-limited and costly.

## Acceptance-score recovery
1. Read authoritative current acceptance result + dimensions through the existing protected endpoint. Record score, run/benchmark ID, timestamps, score breakdown and field freshness; do not guess.
2. Investigate which acceptance components are low and what the official platform evaluates, before generating proposals.
3. Use `sprite-acceptance-plan-review.mjs` to reject missing or duplicate criterion mappings, but **never** treat structural completion as semantic accuracy. Require independent reasoning/evidence checks using task-specific public criteria.
4. Retain true Sprite identity, zero additional spend, complete public scope and acceptance evidence, pending bid reconciliation, and strict post-award customer isolation.
5. Run a permitted genuine marketplace assessment only once the exact live Worker snapshot is reconciled and an approved release exists. Track score change separately from the 20-bid receipt campaign.

**Production safety:** GitHub `main` is not the live Worker v179. Do not deploy this draft PR or another Worker version to bypass release restrictions.