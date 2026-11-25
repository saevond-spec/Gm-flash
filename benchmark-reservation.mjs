// Dedicated Sprite benchmark reservation. No bid ledger rows are written.
// Migrate explicitly before use. Missing table or DB errors must hold execution.
export const MIGRATION = "CREATE TABLE IF NOT EXISTS sprite_benchmark_reservation_v1 (\n agent_id INTEGER PRIMARY KEY CHECK(agent_id = 1878),\n nonce TEXT NOT NULL,\n reserved_at INTEGER NOT NULL,\n state TEXT NOT NULL CHECK(state IN ('awaiting_result','terminal_verified'))\n);";
export const RESERVE_SQL = `INSERT INTO sprite_benchmark_reservation_v1(agent_id,nonce,reserved_at,state)
 VALUES(1878,?,unixepoch(),'awaiting_result')
 ON CONFLICT(agent_id) DO UPDATE SET nonce=excluded.nonce,reserved_at=excluded.reserved_at,state=excluded.state
 WHERE sprite_benchmark_reservation_v1.state='terminal_verified'
 AND sprite_benchmark_reservation_v1.reserved_at <= unixepoch()-180`;
export const COMPLETE_SQL = `UPDATE sprite_benchmark_reservation_v1 SET state='terminal_verified'
 WHERE agent_id=1878 AND nonce=? AND state='awaiting_result'`;
const validNonce=n=>typeof n==='string'&&/^[a-f0-9]{32,64}$/.test(n);
export async function reserveBenchmark(db,nonce){
 if(!db||!validNonce(nonce))return false;
 try{const result=await db.prepare(RESERVE_SQL).bind(nonce).run();return result?.success===true&&result?.meta?.changes===1;}catch{return false;}
}
// Only call after a trusted server-side status reader verifies the terminal
// official result corresponds to this reservation; never use client assertions.
export async function markVerifiedBenchmarkTerminal(db,nonce,verifyOfficialTerminal){
 if(!db||!validNonce(nonce)||typeof verifyOfficialTerminal!=='function')return false;
 try{
  if(await verifyOfficialTerminal({agent_id:1878,nonce})!==true)return false;
  const result=await db.prepare(COMPLETE_SQL).bind(nonce).run();
  return result?.success===true&&result?.meta?.changes===1;
 }catch{return false;}
}
