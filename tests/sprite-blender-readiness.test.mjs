import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySpriteBlenderReadiness as verify} from '../sprite-blender-readiness.mjs';
const hash='sha256:'+'a'.repeat(64),now=Date.parse('2026-11-26T07:45:00Z');
function proof(over={}){
 return {checked_at:'2026-11-26T07:44:00Z',
 blender_version:'5.0.0',blender_binary_check:'executed_in_isolated_runner',
 blender_version_exit_code:0,blender_build_digest:hash,
 actual_test_render:true,render_source:'blender_5.0.0_native',render_width:3840,
 render_height:2160,test_render_sha256:hash,codex_access_verified:true,
 model_provider:'OpenAI',model_name:'GPT 6.2 Astra',
 model_verified_from_actual_execution:true,model_run_digest:hash,
 expert_confirmation_source:'independent_human_signed_confirmation',
 expert_is_available:true,expert_supervises_each_round:true,
 human_guidance_will_be_real_not_generated:true,
 human_confirmation_digest:hash,snapshot_automation_verified:true,
 cadence_rounds_supported:5,codex_export_supported:true,
 hashes_from_real_files:true,licensed_references_confirmed:true,
 encrypted_7zip_verified:true,age_encryption_verified:true,
 public_release_upload_verified:true,additional_spend_cents:0,
 dedicated_task_runner_verified:true,no_customer_content_crossing:true,
 estimated_delivery_hours:70,...over}
}
const v=x=>verify(x,{nowMs:now});
test('complete fictional proof passes evaluation but never authorizes a bid',()=>{
 const r=v(proof());assert.equal(r.ready,true);assert.equal(r.bid_authorized,false);
 assert.equal(r.full_scope_review_stage,'post_award');
 assert.equal(r.human_rounds_are_not_claimed_completed,true);
});
test('empty evidence fails closed',()=>assert.equal(v(null).ready,false));
test('exact Blender 5.0.0 needed',()=>assert.ok(v(proof({blender_version:'5.0.1'})).missing.includes('blender_5_0_0_executable_verified')));
test('version claim without executable proof fails',()=>assert.ok(v(proof({blender_version_exit_code:1})).missing.includes('blender_5_0_0_executable_verified')));
test('must have actual native 4K run',()=>assert.ok(v(proof({actual_test_render:false})).missing.includes('native_4k_render_execution_verified')));
test('no upscaled render proof',()=>assert.ok(v(proof({render_source:'upscaled'})).missing.includes('native_4k_render_execution_verified')));
test('4K width without sufficient height fails',()=>assert.ok(v(proof({render_height:1440})).missing.includes('native_4k_render_execution_verified')));
test('must use exact requested model',()=>assert.ok(v(proof({model_name:'GPT 6'})).missing.includes('exact_requested_codex_model_access_verified')));
test('model runtime must be verified',()=>assert.ok(v(proof({model_verified_from_actual_execution:false})).missing.includes('exact_requested_codex_model_access_verified')));
test('cannot fake human guidance with AI',()=>assert.ok(v(proof({human_guidance_will_be_real_not_generated:false})).missing.includes('genuine_human_expert_scheduled')));
test('human signed independent confirmation required',()=>assert.ok(v(proof({expert_confirmation_source:'self_generated'})).missing.includes('genuine_human_expert_scheduled')));
test('expert supervision every round required',()=>assert.ok(v(proof({expert_supervises_each_round:false})).missing.includes('genuine_human_expert_scheduled')));
test('five genuine guidance rounds need supported snapshots',()=>assert.ok(v(proof({cadence_rounds_supported:4})).missing.includes('full_artifact_chain_available')));
test('Codex export support mandatory',()=>assert.ok(v(proof({codex_export_supported:false})).missing.includes('full_artifact_chain_available')));
test('licensed references mandatory',()=>assert.ok(v(proof({licensed_references_confirmed:false})).missing.includes('licensed_inputs_and_delivery_toolchain_available')));
test('encrypted delivery mandatory',()=>assert.ok(v(proof({age_encryption_verified:false})).missing.includes('licensed_inputs_and_delivery_toolchain_available')));
test('no paid processing accepted',()=>assert.ok(v(proof({additional_spend_cents:500})).missing.includes('zero_spend_and_isolated_resources')));
test('no cross-project customer material',()=>assert.ok(v(proof({no_customer_content_crossing:false})).missing.includes('zero_spend_and_isolated_resources')));
test('72h deadline must be credible',()=>assert.ok(v(proof({estimated_delivery_hours:73})).missing.includes('within_buyer_delivery_window')));
test('stale proof not sufficient',()=>assert.ok(v(proof({checked_at:'2026-11-10T02:00:00Z'})).missing.includes('fresh_independent_capability_check')));
test('future proof not sufficient',()=>assert.ok(v(proof({checked_at:'2026-11-27T02:00:00Z'})).missing.includes('fresh_independent_capability_check')));
test('invalid digest rejected',()=>assert.ok(v(proof({test_render_sha256:'SHA256:abcdef'})).missing.includes('native_4k_render_execution_verified')));
test('does not leak customer/human private fields in result',()=>{
 const r=v(proof({buyer_documents:'SENSITIVE BUYER FILE',expert_email:'PERSONAL-EMAIL'}));
 assert.ok(!JSON.stringify(r).includes('SENSITIVE BUYER FILE'));
 assert.ok(!JSON.stringify(r).includes('PERSONAL-EMAIL'));
});
