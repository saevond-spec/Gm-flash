// Atomic heartbeat request permit; preserves the existing 12-minute cooldown.
// No bid submission or changes to agent status.
export const HEARTBEAT_COOLDOWN_SECONDS=720;
export async function claimHeartbeatPermit(db,nowSeconds){
 if(!db||!Number.isSafeInteger(nowSeconds)||nowSeconds<1)return false;
 await db.prepare("CREATE TABLE IF NOT EXISTS sprite_heartbeat_permit_v1 (id INTEGER PRIMARY KEY CHECK(id=1), last_attempt INTEGER NOT NULL)").run();
 const row=await db.prepare("INSERT INTO sprite_heartbeat_permit_v1(id,last_attempt) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_attempt=excluded.last_attempt WHERE sprite_heartbeat_permit_v1.last_attempt<=excluded.last_attempt-? RETURNING last_attempt").bind(nowSeconds,HEARTBEAT_COOLDOWN_SECONDS).first();
 return row?.last_attempt===nowSeconds;
}
