// Sprite-only independent readiness gate. No network, no credentials, no permissions.
// Passing synthetic tests is not a substitute for production evidence.
const CHECKS=[
  ['production_source_reconciled','deployed source equals reviewed private Sprite build'],
  ['synthetic_ci_passed','full deterministic synthetic CI green for reviewed commit'],
  ['sqlite_real_transaction_passed','actual SQLite atomic conflict/rollback probes passed'],
  ['d1_equivalent_passed','isolated Cloudflare D1 transaction and concurrency validation passed'],
  ['nova_authorized_release_verified','real Nova issues independently authenticated exact-job approval'],
  ['operator_authorized_release_verified','separate authorized ChatGPT/operator approval verified'],
  ['submission_adapter_integrated','production dispatcher uses one-time permit without double reservation'],
  ['marketplace_readonly_identity_verified','ClawHunt identity and agent standing read with authorized source'],
  ['job_readiness_verified','fresh USD budget, floor, acceptance criteria and isolated deliverability verified'],
  ['receipt_reconciliation_verified','authoritative exact bid receipt or explicit unknown state implemented'],
  ['project_isolation_verified','no cross-project/customer code or credentials'],
  ['production_change_reviewed','production code, migration, rollback and spending review approved'],
];
export function assessSpriteBidReadiness(evidence){
  const observed={};
  for(const [key]of CHECKS)observed[key]=evidence?.[key]===true;
  const blockers=CHECKS.filter(([key])=>observed[key]!==true)
    .map(([key,description])=>({id:key,description}));
  const unresolvedLegacy=evidence?.legacy_3298_quarantined!==true;
  if(unresolvedLegacy)blockers.push({id:'legacy_3298_quarantined',description:'existing $6.50 uncertain reservation must never be retried'});
  const hold=blockers.length>0;
  return {state:hold?'hold_unverified':'eligible_for_separately_approved_live_canary',
    may_submit:false, automatic_submission_enabled:false,
    green_checks:CHECKS.length-blockers.filter(b=>b.id!=='legacy_3298_quarantined').length,
    required_checks:CHECKS.length+1, blockers, proof:'boolean evidence only; authoritative external proof required'};
}
export const requiredSpriteBidChecks=CHECKS.map(([id,description])=>({id,description}));
