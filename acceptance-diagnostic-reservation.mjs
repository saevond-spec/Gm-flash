// Sprite-only acceptance diagnostic reservation. Separate from bids and capability probes.
// One-shot by design: no retry or automatic reset after uncertain transport outcomes.
export const ACCEPTANCE_MIGRATION = `CREATE TABLE IF NOT EXISTS sprite_acceptance_diagnostic_v1 (
 agent_id INTEGER PRIMARY KEY CHECK(agent_id=1878),
 approval_id TEXT NOT NULL UNIQUE,
 reserved_at INTEGER NOT NULL DEFAULT (unixepoch()),
 state TEXT NOT NULL CHECK(state IN ('awaiting_result','terminal_verified')),
 benchmark_id INTEGER UNIQUE CHECK(benchmark_id IS NULL OR benchmark_id>0)
);`;
export const RESERVE_ACCEPTANCE_SQL = `INSERT INTO sprite_acceptance_diagnostic_v1(agent_id,approval_id,state)
 VALUES(1878,?,'awaiting_result') ON CONFLICT(agent_id) DO NOTHING`;
export const COMPLETE_ACCEPTANCE_SQL = `UPDATE sprite_acceptance_diagnostic_v1 SET state='terminal_verified',benchmark_id=?
 WHERE agent_id=1878 AND approval_id=? AND state='awaiting_result' AND benchmark_id IS NULL`;
const validApproval=x=>typeof x==='string'&&/^[a-f0-9]{32,64}$/.test(x);
export async function reserveAcceptanceOnce(db,approvalId){
 if(!db||!validApproval(approvalId))return false;
 try{const r=await db.prepare(RESERVE_ACCEPTANCE_SQL).bind(approvalId).run();return r?.success===true&&r?.meta?.changes===1;}catch{return false;}
}
// The trusted verifier must check the authoritative result, agent, baseline,
// dispatch correlation and completion. Caller-provided benchmark IDs alone are insufficient.
export async function reconcileAcceptance(db,approvalId,benchmarkId,verify){
 if(!db||!validApproval(approvalId)||!Number.isSafeInteger(benchmarkId)||benchmarkId<1||typeof verify!=='function')return false;
 try{
  if(await verify({agent_id:1878,approval_id:approvalId,benchmark_id:benchmarkId})!==true)return false;
  const r=await db.prepare(COMPLETE_ACCEPTANCE_SQL).bind(benchmarkId,approvalId).run();
  return r?.success===true&&r?.meta?.changes===1;
 }catch{return false;}
}
