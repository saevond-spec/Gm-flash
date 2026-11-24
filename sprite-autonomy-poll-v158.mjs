// Sprite-only Worker adaptation of Python browse/poll loop. No claim/solve/bid effects.
export const POLL_VERSION='sprite-poll-v158';
export function pollBackoff(failures){if(!Number.isSafeInteger(failures)||failures<0)return 3600;return Math.min(3600,60*2**Math.min(failures,6));}
export function safeCandidateIds(record){if(record?.outcome!=='scanned'||!Array.isArray(record.candidate_ids))return [];return [...new Set(record.candidate_ids.filter(v=>typeof v==='string'&&/^[1-9][0-9]{0,9}$/.test(v)))].slice(0,50);}
export async function guardedBrowse(env,browse,{now=Math.floor(Date.now()/1000)}={}){
 if(!env?.BID_LEDGER||typeof browse!=='function')return{outcome:'ledger_unavailable',candidate_ids:[],attempted:false};
 const db=env.BID_LEDGER;let old=null;
 try{old=await db.prepare('SELECT next_due_at,failures FROM sprite_safe_poll_v1 WHERE id=1').first();}catch{return{outcome:'poll_state_unavailable',candidate_ids:[],attempted:false};}
 if(old&&Number.isSafeInteger(old.next_due_at)&&old.next_due_at>now)return{outcome:'backoff',candidate_ids:[],attempted:false,records_examined:0,funded_candidates:0,skipped_until:old.next_due_at};
 const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 let acquired=null;try{acquired=await db.prepare('INSERT INTO sprite_scan_lease_v1(id,lease_until,lease_token) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until,lease_token=excluded.lease_token WHERE sprite_scan_lease_v1.lease_until<=? RETURNING lease_token').bind(now+720,token,now).first();}catch{return{outcome:'scan_lease_unavailable',candidate_ids:[],attempted:false};}
 if(acquired?.lease_token!==token)return{outcome:'overlapping_scan_prevented',candidate_ids:[],attempted:false};
 let record,failed=false;try{try{record=await browse(env);if(!record||record.outcome!=='scanned')failed=true;}catch{failed=true;}
 const failures=failed?Math.min(20,(Number.isSafeInteger(old?.failures)?old.failures:0)+1):0;const candidates=failed?[]:safeCandidateIds(record);
 // Real cron is 15 minutes; never report an impossible 60-second next run.
 const nextDue=now+(failed?Math.max(900,pollBackoff(failures)):900);
 const outcome=failed?'scan_unavailable':candidates.length?'verified_candidate_observed':'scanned_no_verified_candidates';
 try{await db.prepare('INSERT INTO sprite_safe_poll_v1(id,last_scan_at,next_due_at,failures,outcome,candidates,claim_attempted,solve_attempted,bid_attempted) VALUES(1,?,?,?,?,?,0,0,0) ON CONFLICT(id) DO UPDATE SET last_scan_at=excluded.last_scan_at,next_due_at=excluded.next_due_at,failures=excluded.failures,outcome=excluded.outcome,candidates=excluded.candidates,claim_attempted=0,solve_attempted=0,bid_attempted=0').bind(now,nextDue,failures,outcome,candidates.length).run();}catch{return{outcome:'poll_ledger_write_failed',candidate_ids:[],attempted:false};}
 return failed?{outcome,records_examined:0,funded_candidates:0,candidate_ids:[],attempted:false}:{...record,candidate_ids:candidates,attempted:false,poll_outcome:outcome};
 }finally{try{await db.prepare('DELETE FROM sprite_scan_lease_v1 WHERE id=1 AND lease_token=?').bind(token).run();}catch{}}
}

export function pollSelfTest(){const cases=[pollBackoff(0)===60,pollBackoff(1)===120,pollBackoff(6)===3600,pollBackoff(100)===3600,safeCandidateIds({outcome:'scanned',candidate_ids:['1808','1808','0','bad']}).join(',')==='1808',safeCandidateIds({outcome:'unavailable',candidate_ids:['1808']}).length===0];return {passed:cases.every(Boolean),checks:cases.length,bid_sent:false,claims_sent:false,solutions_sent:false};}
