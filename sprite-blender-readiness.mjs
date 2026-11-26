/**
 * Sprite #1878 — truthful Blender 5.0 task capability evidence gate.
 *
 * This pure module is not a Blender installer, render service, human expert,
 * or authority to bid. It never generates or asserts proof. Only verified,
 * non-customer evidence from a physically operational isolated task runner
 * and an actually available human supervisor can pass.
 *
 * Renders, client media, prompts and human private data must stay in the
 * dedicated per-job environment, not in Sprite inventory or shared agents.
 */
const validISO=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const hours=72;
const codeProof=x=>typeof x==='string'&&/^sha256:[0-9a-f]{64}$/i.test(x);
export function verifySpriteBlenderReadiness(proof,{nowMs=Date.now()}={}){
  const missing=[];
  const requires=(key,condition)=>{if(!condition)missing.push(key)};
  if(!proof||typeof proof!=='object'||Array.isArray(proof))
    return {ready:false,missing:['verifiable_capability_proof'],bid_authorized:false,
      full_scope_review_stage:'post_award'};
  const at=validISO(proof.checked_at)?Date.parse(proof.checked_at):NaN;
  requires('fresh_independent_capability_check',
    Number.isFinite(at)&&Number.isFinite(nowMs)&&at<=nowMs&&nowMs-at<=7*86400000);
  requires('blender_5_0_0_executable_verified',
    proof.blender_version==='5.0.0'&&proof.blender_binary_check==='executed_in_isolated_runner'&&
    proof.blender_version_exit_code===0&&codeProof(proof.blender_build_digest));
  requires('native_4k_render_execution_verified',
    proof.actual_test_render===true&&proof.render_source==='blender_5.0.0_native'&&
    Number.isInteger(proof.render_width)&&Number.isInteger(proof.render_height)&&
    Math.max(proof.render_width,proof.render_height)>=3840&&
    Math.min(proof.render_width,proof.render_height)>=2160&&
    codeProof(proof.test_render_sha256));
  requires('exact_requested_codex_model_access_verified',
    proof.codex_access_verified===true&&
    proof.model_provider==='OpenAI'&&proof.model_name==='GPT 6.2 Astra'&&
    proof.model_verified_from_actual_execution===true&&
    codeProof(proof.model_run_digest));
  requires('genuine_human_expert_scheduled',
    proof.expert_confirmation_source==='independent_human_signed_confirmation'&&
    proof.expert_is_available===true&&proof.expert_supervises_each_round===true&&
    proof.human_guidance_will_be_real_not_generated===true&&
    codeProof(proof.human_confirmation_digest));
  requires('full_artifact_chain_available',
    proof.snapshot_automation_verified===true&&proof.cadence_rounds_supported>=5&&
    proof.codex_export_supported===true&&proof.hashes_from_real_files===true);
  requires('licensed_inputs_and_delivery_toolchain_available',
    proof.licensed_references_confirmed===true&&
    proof.encrypted_7zip_verified===true&&proof.age_encryption_verified===true&&
    proof.public_release_upload_verified===true);
  requires('zero_spend_and_isolated_resources',
    proof.additional_spend_cents===0&&proof.dedicated_task_runner_verified===true&&
    proof.no_customer_content_crossing===true);
  requires('within_buyer_delivery_window',
    Number.isFinite(proof.estimated_delivery_hours)&&
    proof.estimated_delivery_hours>0&&proof.estimated_delivery_hours<=hours);
  return {ready:missing.length===0,missing,
    bid_authorized:false,full_scope_review_stage:'post_award',
    requires_independent_authenticated_task_and_bid_receipt:true,
    human_rounds_are_not_claimed_completed:true};
}
