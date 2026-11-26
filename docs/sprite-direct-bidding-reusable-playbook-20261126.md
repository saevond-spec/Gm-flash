# Sprite #1878 — repeatable authenticated ClawHunt direct-bidding procedure

Last updated: 2026-11-26. This procedure applies **only to Sprite**, never to Star, Nova, Mother, other customer environments or a browser profile.

## The verified method

1. Discover eligible marketplace tasks from ClawHunt's **authenticated official API**, not just cached inventory labels or an HTML simulated-bounty banner. Retain the marketplace task ID and public ticket code. Do not ingest buyer-private files or customer records into Sprite.
2. Independently screen each task: current `open`/`bidding` status, future/open award window, explicit real/escrow contract when reported, USD cents and price floor, public acceptance criteria, honest ability to deliver. Publicly known simulated tasks, contradictions, inaccessible work and duplicate or uncertain own-bids are not eligible.
3. Generate a **different, task-specific** buyer message and proposal from the public brief. Specify deliverables and formats, exact acceptance items, verification process, price, realistic timeline, material/resource assumptions and anything not yet secured. Never fabricate existing artifacts, screenshots, results, expert feedback, completed research or access.
4. Use only Sprite's private Cloudflare-managed `gm-flash` Worker and its existing `CPH_API_KEY` and `CONTROL_TOKEN` **secret bindings**; never export the tokens or borrow another agent's login. In the same script, verify `spriteMetadata` is approved Sprite **#1878** and the approved webhook matches Sprite.
5. Operator authorizes concrete task IDs and quote ceilings in Sprite's private `sprite_operator_bid_requests_v1` D1 table. This table stores IDs, cents, queue status and coarse diagnostic codes **only**. No buyer text, customer files, proposal body, credentials, logs or private artifacts.
6. The Worker **atomically claims one queued task**; performs fresh `autoRequest`, `qualifyTask` and `verifiedMarketBounds`; assembles the exact `buildClawHuntBidRequest` payload and freezes it with `canonicalSignedClawHuntPayload`; calls `submitWithReservation` and `autoRequest` to send **only one authenticated POST**. This uses the existing immutable `bid_reservations(agent_id,problem_id)` anti-duplicate key.
7. `reserveThenScan` triggers the post-send heartbeat and authenticated readback. Check `sprite_bid_receipts`, `sprite_authenticated_presence_v1`, `sprite_reconciled_bid_provenance_v1` and `sprite_own_outcomes_poll_v1`. A HTTP 200 or provisional bid ID **alone is not an exact price-verified receipt**. The marketplace may omit the bid amount, in which case preserve `uncertain`, retain the irreversible reservation and verify through authenticated own bid queue; **never resend**.
8. If awarded, create and verify a **separate per-customer/per-job execution sandbox** before accepting private files or performing the work. Never cross-mount files, code, data, credentials, prompts, logs, deployments or artifacts into any other job or agent.
9. Temporary one-minute cron pacing is for one user-authorized 20-job batch. Legacy scan, heartbeat and Council monitoring remain every five minutes inside the scheduled Worker. Return the cron trigger to the baseline `*/5 * * * *` when the batch is no longer running, or explicitly choose a documented bounded schedule. Never leave an unrestricted submission sweep active.
10. A user asking for another batch authorizes the **specified quantity**, not permanent unlimited bidding. Independently verify new listings and submit at most once per distinct eligible task. Do not count a queued command or a simulated probe as a submitted bid.

## Live implementation

- Worker `gm-flash` (Cloudflare account ending 4448bf) from the exact 55-module deployment plus `sprite-direct-bid-copy-v184.mjs` (56 modules). V184 version `69f36b87-cbde-48c3-abd8-4c601d46b748`.
- Operator batch helper, source-only repository file: `sprite-direct-batch-worker-v184.mjs`. Added inline to Worker `worker.mjs` so it reuses the *existing*, unchanged trusted API and receipt functions. It processes at most two operator-queued jobs per non-5-minute cron tick and no operator jobs at the busy five-minute ticks. It is restricted to an allowlist of **20 explicit public task IDs**.
- Proposal helper: `sprite-direct-bid-copy-v184.mjs`. Tested **30/30** targeted unit cases; additionally validated **20/20** actual public listing titles, code identities, bid quotes, buyer-message length, proposal length and acceptance-criteria presence. All candidate jobs have a public November 30, 2026 bidding deadline; the earlier November 23 shortlist was rejected as stale.
- Public listing `#3292` had explicit simulated evidence and was excluded. Pre-existing Sprite bid `#4188` / candidate ID `42375` is excluded and its uncertain amount verification is preserved, not retried.
- Reuse only for new candidates after checking actual current marketplace state. **Do not hard-code a permanent 20-bid campaign** or treat an inventory row as proof of verified funds or delivery ability.

## Batch entered Nov 26 2026

These 20 task IDs were queued once after user authorization: 3287, 3288, 3289, 3291, 3293, 3295, 3296, 3297, 3299, 3300, 3301, 3303, 3304, 3305, 3307, 3308, 3309, 3311, 3312, 3313.

Quote ceilings were independently matched against public prices and Sprite D1; all excluded existing reservations and confirmed receipts. **Queue insertion is not marketplace submission.** To claim a task has been bid, use the authenticated own-outcomes record and exact receipt verification, and report outstanding amount mismatches honestly.

## Recovery / rollback

Production v183 version before batch: `630d26e9-f188-448d-9c81-192472d66522`. Before changing code, check active deployment and all 7 bindings; do not overwrite live 56-module source with GitHub's stale `main`. To interrupt remaining bids safely, change only still-queued commands to `held`, never delete submitted/uncertain reservation records. Existing `processing` or `uncertain` commands may already have sent POST and cannot be requeued. Inspect receipt evidence before any further action.

These controls are production safety, not extra Council approval gates. Keep task-specific public bid content transient, never in shared long-term customer storage.


## Verified outcome of the Nov 26 twenty-job batch (09:20 UTC)

**Real marketplace submission completion: 20 / 20.** Sprite Worker \`gm-flash\` v185 (\`95fcec1b-8656-4191-9af8-cf24055b1730\`) ran the twenty user-authorized one-shot commands on the active Cloudflare Cron and posted twenty unique fixed-price ClawHunt bid requests through Sprite's own protected \`CPH_API_KEY\`. Authenticated ClawHunt own-outcomes readback confirmed **exactly twenty unique bid IDs \`42404\` through \`42423\`**, all agent **#1878** and status **\`pending\`**, each matched to its intended individual task ID. None of these tasks is still queued.

The bid amounts (5400–15300 cents, each uniquely reserved against its task) remain in immutable \`bid_reservations\`. ClawHunt's own-outcomes feed **does not return authenticated amount values** for these bid objects, so the conservative exact-price receipt system still has **20 \`uncertain\` reservations**, each with an actual marketplace \`pending\` bid ID; do **NOT** resubmit or manufacture \`sprite_bid_receipts\` rows. Reconcile the exact prices separately through authenticated bid-queue evidence if available; a marketplace-pending bid does not imply buyer selection, earned revenue, or payout.

**Safety restoration:** The private bid command table remains audit-only (20 \`uncertain\`, zero \`queued\`). The temporary \`* * * * *\` trigger was restored to the original **\`*/5 * * * *\`** at 09:20:14 UTC, with successful Cloudflare GET verification. Cron propagation may take up to fifteen minutes. V185 fallback logic allows one user-authorized queued job on old five-minute ticks and two on non-five-minute ticks, but with the allowlisted twenty already processed and the irrevocable reservations it cannot duplicate them. There is no continuous unlimited bid authorization. Preserve the exact deployed 56-module source; never deploy stale GitHub main.

**Future user batches:** Repeat the published workstream, but discover and explicitly authorize **new** distinct public ClawHunt task IDs; check current deadlines, task status, eligibility, real buyer acceptance criteria, independent delivery ability, and duplicates; generate each public-only proposal and buyer message; use Sprite-only inherited credentials inside Worker, single atomic reservation and authenticated own-outcomes readback. Do not automatically reuse old task IDs or resubmit uncertain placements. All customer work remains isolated in its own dedicated per-job environment after award.

