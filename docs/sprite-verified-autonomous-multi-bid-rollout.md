# Sprite #1878 — verified autonomous multi-bid production rollout
Status: DESIGN + SYNTHETIC WORK; **NOT DEPLOYED / NOT LIVE CERTIFIED**.
Scope: saevond-spec/Gm-flash and the existing Sprite-only Cloudflare gm-flash Worker / sprite-bid-ledger D1. No Star, other-agent, or customer project resources.

## Goal and limits
- User authorizes Sprite to pursue multiple distinct real ClawHunt bids. Start with affordable, achievable **$5–$20** USD quotes and **$0 additional operating spend**. Avoid paid tools, dependency purchases, infrastructure upgrades, and committing to work that needs unlicensed assets.
- ClawHunt accepts whole-cent **amount** values at POST /api/v1/problems/{id}/bid and expects a substantive plan/message. Never infer a successful bid from HTTP 2xx alone.
- First canary: **one funded/held task** with original acceptance checks independently verified. Expand to many bids only **sequentially, after authenticated bid receipts** and workload/standing checks. Unescrowed candidates are for review only initially; never start their delivery before independent held-funds confirmation.
- No new bid for historical task **#3298 ($6.50 uncertain)** until independently reconciled; keep exact original record quarantined. Different tasks may proceed when otherwise authorized.
- No promise of selection, acceptance, earnings, or guaranteed payout. Public scoring and instant reviews are not receipts.

## Verified baseline (2026-11-22 local)
- ClawHunt agent 1878 has displayed Online and a live API key; the visible activity was repeated open-task browsing, not confirmed submissions.
- Production gm-flash has 15-minute cron, BID_LEDGER D1, CPH_API_KEY secret, existing bid paths, and compiled SPRITE_COUNCIL_GOVERNANCE_HOLD=true.
- Production D1 autonomous_dispatch_status = no_independently_verified_job_readiness, attempted=0; autonomous_readiness empty; sprite_bid_receipts empty; bid_reservations contains one uncertain #3298; reconciliation probes show no receipt candidates.
- PR #4 simulates canonical intent, separate Nova/control approval checks, nonce+reservation, uncertain-before-send, and at-most-once transport. It is **not wired into the deployed Worker**; production source contains additional safety components and cannot be replaced with GitHub source as-is.

## Production architecture / responsibility boundaries

Trusted Sprite-only dispatcher (Cloudflare)
   |-- periodic GET /api/v1/me -> identity 1878, owner active, admission approved
   |-- POST /api/v1/heartbeat -> actual acknowledged timestamp (browse != heartbeat)
   |-- GET /api/v1/bids/criteria -> current threshold/floor/seen rules
   |-- GET /api/v1/bids/queue -> oldest-first queue, floor, budget, own bid
   |-- GET /api/v1/bids/standing -> model gate, account pause, trial capacity
   |-- GET /api/v1/problems/{id} -> exact status/requirements/payment/scope
   |-- task-ISOLATED acceptance + delivery rehearsal -> signed scalar evidence
   |-- deterministic planSpriteMultiBidCycle -> ONE advisory candidate, no writes
   |-- private proposal authoring -> independent acceptance/feasibility check
   |-- Nova independent verifier -> exact canonical bid intent approval (signed)
   |-- separate operator/ChatGPT verifier -> same intent approval (signed)
   |-- existing Sprite D1 singleton reservation + nonce consumption, one transaction
   |-- final authenticated task/standing/owner bid recheck (fresh)
   |-- one-shot POST /api/v1/problems/{id}/bid -> state UNCERTAIN before network
   |-- GET-only reconcile exact agent/id/amount/bid_id through official endpoints
   |-- confirmed -> unlock NEXT distinct bid; unresolved -> stop new bid sends
   +-- status audit: measured attempts, verified receipts, awards, deliveries, settlement

**Critical trust boundary**: scalar data or a claim of reviewer approval received from a public endpoint is NOT authorization. Verifier keys live in individually provisioned services, never in request JSON, repo, buyer content, or the same Worker that can mint all approvals. No caller-supplied verifier or send callback may reach production release paths. Nova must actually issue an authenticated positive decision; currently its verifier returns hold.

## Run modes
1. INSPECT: unauthenticated public discovery OR authenticated read-only GET, heartbeat where authorized; never an external bid.
2. REHEARSE: independent fictional acceptance work, multi-bid contention/SQLite/D1 probes and audit. All mocks visibly labeled simulation.
3. CANARY: precisely one live bid after every gate passes; exact authenticated signed reviews and D1 permit, held funds, recognized receipt, spending review.
4. SERIAL: up to one new bid with unknown result at a time; after authoritative confirmation and workload check, next distinct candidate. Cron every 15 minutes. Never retry after a lost bid response.
5. HOLD: fail closed on stale thresholds, errors, D1 migration/version mismatch, unrecognized API shape, reviewer unavailability, invalid currency, floor conflict, unexpected caller, loss of heartbeat, paused standing, quota/capacity exhaustion, or network ambiguity.

## Exact evidence checklist before first live POST
1. Recover and diff the **exact current deployed** gm-flash source in private Sprite-only review. Never push runtime source, tokens, customer briefs, or private code blindly into this public repo; preserve existing safety modules.
2. Audit and test the real sender route: only internal runtime with protected access can call POST /bid; disable/retire any older direct POST routes that bypass council. Preserve proof the public Internet cannot invoke submission.
3. Verify API response schemas with authentic read-only requests and pinned parsers: /me, /bids/criteria, /bids/queue, /bids/standing, /problems/{id}, and receipt/outcomes. Unknown field = STOP, not a default.
4. Confirm the operator's scope limits, price floor, USD cents, current held escrow, deadline, 0 incremental cost, no own bid, and available capacity. Request separate dedicated customer environment only after assignment. Never use customer files within Sprite's source/control ledger.
5. Add separate trusted review services and authenticate actual positive, expiring, exact intent signatures. Verify each independently in production; approvals bind agent, task, quote, proposal SHA-256, acceptance/scope SHA-256, nonce and time. An unsigned boolean, screenshot, simulation approval, or user input cannot sign on behalf of Nova/ChatGPT.
6. Backup D1, inspect existing unique indices and legacy rows, apply the **reviewed** nonce migration only to Sprite D1 after real D1 atomic/concurrent rollback proofs. Preserve #3298; reject any duplicate task or spent nonce. Do not double-reserve through both old and new dispatchers.
7. Verify D1 reservation cannot create a permit without both authenticated signatures; transition reserved -> uncertain **before** outbound network; exactly one sender POST; no retries on timeout or worker crash.
8. Reconcile via official authenticated bid identity (agent 1878, problem ID, quote cents, bid ID, server receipt), not local arbitrary strings, random IDs, self-declared status, or HTTP 201. When no authoritative receipt exists, keep uncertain indefinitely for operator investigation.
9. Implement delivery/award monitoring and account-level trial limit. ClawHunt says trial agents share open-order capacity; multiple sent bids do not imply unlimited concurrent deliverables.
10. Verify $0 spend, client isolation, changeset review, fresh CI, and production rollback. Only then independently approve a dedicated canary deployment. Keep production HOLD=true until all evidence is complete.

## Bid quality
- Start with public, clearly scoped simple CSV normalization, deterministic arithmetic reconciliation, or another capability that Sprite can demonstrably deliver within hours and cost $0.
- Proposal text is composed privately and reviewed against EACH acceptance criterion: objective, steps, specific deliverable, evidence/check, realistic timeline, exclusions, revisions/dependencies, and no unsupported claims.
- Respect current ClawHunt minimum message+proposal length from /bids/criteria, not a hardcoded guess. A lower price does not independently improve proposal fit; choose feasible price at/above floor.
- Follow oldest-first official queue for eligible jobs; do not invent win probabilities. Keep sample/customer data in separate dedicated delivery environments, NOT in shared code, D1, logs, or this public repository.
- Marketplace instant_review and standing identify proposal gaps; no fictional claim that all checks passed.

## Acceptance tests for the engineering team
- False/stale /me, queue, standing, criteria, heartbeat or detail -> 0 POST.
- Two tasks simultaneously race for one release -> at most one permit / one outbound POST.
- Duplicate task, nonce replay, two approvers mismatching task/price/sha/time -> 0 POST.
- D1 partial failure or ambiguous return -> 0 POST, persistent hold; no client-supplied function gets execution control.
- Worker crash immediately after marking uncertain -> no retry; reconciliation only.
- Response status 201 without authoritative receipt -> remains uncertain; second distinct bid blocked until reconciled.
- Receipt for another ID, agent, amount or pre-existing timestamp -> cannot clear hold.
- Legacy 3298 never re-sent, but does not globally bar unrelated verified bids after canary approval.
- New candidate $5–$20 in USD, source verified, funded, no paid tools, isolated scope -> advisory review (not automatic permission).
- Multiple sequential bids demonstrated in a D1-equivalent isolated test, zero customer material and zero real spend.
- Existing production Worker safety regression suite must pass using the exact deployed source and any integrated modules.

## Release/rollback
- Deploy progressively: 0% live writes / read-only introspection -> signed-verifier shadow mode -> isolated D1 migration -> one held-funds canary -> independent receipt check -> serial campaigns.
- Keep emergency hold, route-level deny, D1 reservation preservation, and connection revocation available. Do not delete uncertain rows to unblock throughput.
- Monitoring: last heartbeat; queue scan age; verified candidate count; rejected gate reasons; authorized grants; uncertain/confirmed receipt totals; active awarded orders; settlement; runtime cost. Never retain buyer descriptions or credentials in analytics.
- Source-of-truth: deployment hash + D1 schema version + authenticated ClawHunt receipts, not GitHub CI alone.

## Official documentation references
- https://clawhunt.store/guide (amount in cents, /me, /problems, /bid, /solution, bid criteria, queue, standing, heartbeat, selection)
- https://clawhunt.store/for-agents (bid message quality, lifecycle, settlement)
- https://clawhunt.store/agent-docs/webhook (signed event/optional capability probe)

## Current status
The companion sprite-multi-bid-campaign.mjs and tests are purely deterministic synthetic planner components. They produce **no live POST** and **cannot lift** the governance hold. The exact production integration, independent genuine signers, authoritative receipt mapping and first canary must be verified separately. No other projects or customer files are touched.
