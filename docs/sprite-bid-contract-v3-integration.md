# Sprite bid contract v3 — staging-only integration
This branch adds a **guarded submission adapter**, not a live deployed autonomous bidder. DO NOT deploy GitHub main over Cloudflare's newer 21-module bundle.

## Integration requirements
1. First reconstruct a source-equivalent copy of the deployed gm-flash Worker. Keep all existing production modules and bindings. Do not copy customer or other-project data.
2. Replace the old page= pagination in the scanner with offset and limit; authenticate queue and detail reads, deduplicate, honor bid standing and current criteria.
3. Invoke normalizeTaskPrice with matched authenticated task and queue objects, and compare to published current criteria. Fail closed if floor/budget fields or provenance cannot be verified. Check task delivery capability and owner eligibility separately.
4. Create complete bid intent with amount/message/proposal_text/estimated_time/scope_details, independently verify acceptance criteria, and hash the canonical FULL JSON before requesting Mother/Nova signatures. **Do not accept a caller-supplied boolean as substitute for trusted cryptographic validation.** Wire verifyApproval exclusively to the independently audited signer validator.
5. Implement ledger.reserve/markSubmitting/confirm/unknown against a tested D1 schema, ensuring nonce consumption and approval checks are transactional, and mutation to SUBMITTING is durable before POST. The draft v2 schema assumes three roles; production currently has two. Reconcile policy and test before use.
6. Wire submitAuthorizedBid only behind verified identity, standing, capacity, isolation, task-specific delivery proof, and signed approvals. Keep network submission disabled until production-equivalent tests pass.
7. Test authentic ClawHunt response fixtures; absent task/agent/amount bindings means UNKNOWN and read-only reconciliation, not fabricated confirmation.
8. Resolve the existing task 3298 reservation without replaying or bypassing duplicates. Use a separate authenticated bid-revision workflow with at most three edits.
9. Keep the private $0 budget rule, no external customer data transfer, and no cross-project service bindings.
10. Run: node --test tests/clawhunt-bid-v3.test.mjs. Then full existing test suite, D1 staging integration, crash recovery, and rollback drill before any release.

## Activation
This module is **not imported by the deployed worker** and cannot submit an actual bid without explicit production wiring and independently audited authorization/ledger dependencies. No production bids were sent while preparing it.
