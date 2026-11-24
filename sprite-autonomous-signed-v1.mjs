export async function checkSignedBid(env,id,amount,message,consume=false){
 const no=(reason)=>({ok:false,reason});
 if(!env?.BID_LEDGER||!/^[1-9][0-9]{0,9}$/.test(String(id))||!Number.isSafeInteger(amount)||amount<2000||amount>100000||typeof message!=='string'||message.length<10||message.length>12000)return no('invalid');
 const db=env.BID_LEDGER,now=Math.floor(Date.now()/1000);const proposalDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(message))),b=>b.toString(16).padStart(2,'0')).join('');
 try{
  const a=(await db.prepare("SELECT role,agent_id,amount_cents,issued_at,expires_at,nonce,evidence_digest,proposal_digest,signature_b64,consumed_at FROM sprite_signed_autonomous_bids_v1 WHERE problem_id=? ORDER BY role").bind(String(id)).all()).results??[];
  if(a.length!==2||a[0].role!=='mother'||a[1].role!=='nova'||a[0].evidence_digest!==a[1].evidence_digest||a[0].nonce!==a[1].nonce||a[0].amount_cents!==a[1].amount_cents||a[0].proposal_digest!==proposalDigest||a[1].proposal_digest!==proposalDigest)return no('two_approvals_missing');
  const keys=(await db.prepare("SELECT role,key_id,public_key_spki_pem FROM sprite_public_signing_keys_v1 WHERE active=1 AND revoked_at IS NULL AND role IN ('mother','nova')").all()).results??[];
  if(keys.length!==2)return no('keys_missing');
  for(const x of a){
   if(x.agent_id!==1878||x.amount_cents!==amount||x.consumed_at!=null||!Number.isSafeInteger(x.issued_at)||x.issued_at>now||x.issued_at<now-86400||!Number.isSafeInteger(x.expires_at)||x.expires_at<=now||x.expires_at>x.issued_at+21600||!(/^[a-f0-9]{32}$/.test(x.nonce))||!(/^[a-f0-9]{64}$/.test(x.evidence_digest))||!(/^[a-f0-9]{64}$/.test(x.proposal_digest)))return no('expired_or_invalid');
   const k=keys.find(v=>v.role===x.role);if(!k||typeof k.public_key_spki_pem!=='string')return no('key_missing');
   const enc=k.public_key_spki_pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,'');
   if(!/^[A-Za-z0-9+/]+={0,2}$/.test(enc))return no('public_key_encoding');
   const der=Uint8Array.from(atob(enc),c=>c.charCodeAt(0));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',der)),v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==k.key_id)return no('key_mismatch');
   const key=await crypto.subtle.importKey('spki',der,{name:'Ed25519'},false,['verify']);
   if(typeof x.signature_b64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(x.signature_b64))return no('signature_encoding');
   const sig=Uint8Array.from(atob(x.signature_b64),c=>c.charCodeAt(0));if(sig.length!==64)return no('signature_length');
   const message=['sprite.autonomous.bid.v2','1878',String(id),String(amount),String(x.issued_at),String(x.expires_at),x.nonce,x.evidence_digest,x.proposal_digest].join('|');
   if(!await crypto.subtle.verify('Ed25519',key,sig,new TextEncoder().encode(message)))return no('signature_invalid');
  }
  if(!consume)return {ok:true,reason:'two_valid_signatures'};
  const sql="UPDATE sprite_signed_autonomous_bids_v1 SET consumed_at=? WHERE problem_id=? AND agent_id=1878 AND amount_cents=? AND consumed_at IS NULL AND expires_at>? AND (SELECT COUNT(*) FROM sprite_signed_autonomous_bids_v1 WHERE problem_id=? AND agent_id=1878 AND amount_cents=? AND consumed_at IS NULL AND expires_at>?)=2 RETURNING role";
  const changed=(await db.prepare(sql).bind(now,String(id),amount,now,String(id),amount,now).all()).results??[];
  return changed.length===2&&new Set(changed.map(x=>x.role)).size===2?{ok:true,reason:'consumed_once'}:no('already_consumed');
 }catch{return no('verification_unavailable');}
}