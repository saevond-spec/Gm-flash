# Sprite #1878 — per-bid council authorization release (draft implementation handoff)

## Root cause verified from deployed Cloudflare Workers on 2026-11-22

1. `nova-verifier` private `preflightSpriteAction()` unconditionally returns `decision:'hold'` for otherwise valid 4-field packets.
2. `sprite-isolation-lab` private `preflightSpriteAction()` only accepts the Nova hold response; it exposes no approve transition and intentionally fails closed.
3. `gm-flash` hard-codes `SPRITE_COUNCIL_GOVERNANCE_HOLD=true`. The automatic scheduler returns early. The outgoing bid `autoRequest()` unconditionally returns HTTP 423 before the POST. `autonomous_readiness` is empty.
4. Current Worker source is materially newer than the public GitHub draft. Never deploy the public draft over the running Worker.
5. Historical task #3298 / $6.50 is still `uncertain` without a verified bid receipt. Never retry this task or delete its reservation to unblock another.
6. Escrow is optional per operator instruction. Do not require or rank by held escrow. Keep independently verified USD task budget/floor, scope, deadlines, fee, authorization and $0 incremental spend.

## Release protocol to implement **only in staged private Sprite services**

- **Nova / separate private signer:** add a new `reviewBidIntent()` private method without modifying the original hold-only preflight. Require independently collected fresh scalar job-readiness evidence, correct task identity/agent #1878, full acceptance coverage, own-bid check, scope + isolated-delivery verification, policy $5–$20, trusted timestamp and prior review. Never accept user-provided `verified:true` booleans as proof. If review actually passes, sign the exact canonical intent using a Nova-only nonexportable private key. Keep the key outside source and public GitHub. No direct marketplace network write from Nova.
- **Operator control / independent private signer:** issue its own separately authorized, signed exact-intent approval only following the actual operator and ChatGPT review. Current user permission to develop autonomous bidding is not an authorization to fabricate an approval for an unknown task. Signer cannot be the Nova service, same key, public HTTP route, or a code-controlled Boolean.
- **Sprite-only isolation service:** forward exact-intent packets to each signer via private service bindings; verify separate pinned public keys, expiry, recipient, task, amount, nonce and proposal/scope hashes. On any hold or exception preserve hold; do not treat a Nova hold as approval.
- **Sprite main Worker:** preserve the existing global hold until the private release route is completely integrated and independently tested. For each bid use only a narrow one-shot permit from the private council service; never flip the global switch to `false` or accept a generic `approved` request field.
- **Sprite D1:** migrate `sprite_council_nonce_consumption` only after backup and staged concurrency tests. Require atomic reservation + unique nonce, bind approved SHA256 proposal and approval expiration. Mark `uncertain` before the single network send; never auto-retry an unknown HTTP response. Verify authoritative ClawHunt bid receipt before clearing it and dispatching another.
- **Scope isolation:** Do not copy Star, AmaanaYT, SweatyClanker, customer task files, secrets, source, logs or deployments into the Sprite repo. Do not publish full private production Worker modules or signer code with credentials.

## Executable draft components

- `sprite-council-handshake.mjs`: demonstrates fail-closed Nova + operator approval exchange and exact-intent verification, always `can_submit:false` before reservation.
- `council-preflight.mjs`: validates both approvals, timestamps and existing ledger state.
- `council-release.mjs`: stages a one-shot nonce and claim with proposal/expiry checks; does not integrate with production.
- `migrations/20261122_sprite_council_nonces.sql`: migration definition only, not deployed.
- `tests/sprite-council-handshake.test.mjs`: reproduces permanent live Nova hold, verifies that only independently signed fictional approvals advance to preflight; forged signatures, task/amount changes, missing services, expired intent, uncertain reservation all hold.

## Independent release acceptance criteria

- Pin reviewed build to exact currently deployed production source; no unexpected changes to other services or bindings.
- Real Nova and operator signer are distinct, authenticated, cannot issue each other's approvals, and each can deny separately.
- An expired/replayed/mismatched/unreviewed bid **cannot** produce a POST even with concurrency, stale cache, crash or malformed receipt.
- A genuine eligible **unescrowed** $5–$20 candidate can pass the same readiness workflow as an escrowed candidate. Missing USD budget or scope remains a hold.
- Tests pass on a staged private Worker and staged D1, including real service-to-service RPC and exact single transport call to a mock ClawHunt server. No simulated approval keys enter production.
- Production change reviewed separately, and a single authorized small live bid verified by authoritative marketplace receipt. Only then consider larger continuous bidding volume.

**Status:** Staged implementation pending; no honest basis to claim live authorization release fixed solely from synthetic green tests.
