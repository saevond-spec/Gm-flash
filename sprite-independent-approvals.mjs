// Sprite-only Ed25519 APPROVAL VERIFIER. Does not issue keys, create approvals,
// submit bids, or replace independent Nova and operator approval services.
// Production verifiers must be created from pinned, separately provisioned
// public keys in trusted Worker initialization, NOT keys passed by API callers.
// Binding to one canonical intent is enforced again in council-preflight.mjs.
const B64=/^[A-Za-z0-9+/]{86}==$/; // exactly 64-byte Ed25519 signature
const hasCrypto=()=>typeof crypto!=='undefined'&&crypto.subtle;
const bytesEq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const validInteger=(x)=>Number.isSafeInteger(x)&&x>0;
const reviewerNames=new Set(['nova','chatgpt_operator']);

export function spriteApprovalSigningMessage(approval,reviewer,canonical){
  if(!approval||typeof approval!=='object'||!reviewerNames.has(reviewer)||
    typeof canonical!=='string'||canonical.length<30||canonical.length>2000||
    !canonical.startsWith('sprite-bid-v1|')||
    approval.reviewer!==reviewer||approval.decision!=='approve'||
    approval.canonical_intent!==canonical||
    typeof approval.problem_id!=='string'||!/^[1-9]\d{0,9}$/.test(approval.problem_id)||
    !Number.isSafeInteger(approval.amount_cents)||approval.amount_cents<500||approval.amount_cents>2000||
    typeof approval.nonce!=='string'||!/^[0-9a-f]{32,64}$/.test(approval.nonce)||
    !validInteger(approval.approved_at)||!validInteger(approval.expires_at)||
    approval.expires_at<=approval.approved_at||
    approval.expires_at>approval.approved_at+900) return null;
  const pieces=canonical.split('|');
  if(pieces.length!==12||pieces[1]!=='1878'||pieces[2]!==approval.problem_id||
    Number(pieces[3])!==approval.amount_cents||pieces[10]!==approval.nonce)
    return null;
  // Unambiguous array encoding; the signature binds reviewer, action, intent,
  // amount, nonce and the approval validity timestamps in a versioned domain.
  return JSON.stringify(['sprite-council-approval-ed25519-v1',
    reviewer,'approve',canonical,approval.problem_id,approval.amount_cents,
    approval.nonce,approval.approved_at,approval.expires_at]);
}
function decodeSignature(s){
  if(typeof s!=='string'||!B64.test(s))return null;
  try{const a=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return a.length===64?a:null}
  catch{return null}
}
function validPublicKey(x){
 return x instanceof Uint8Array&&x.length===32&&!x.every(b=>b===0);
}
export async function verifySpriteApprovalSignature({approval,reviewer,canonical,publicKeyBytes}={}){
  if(!hasCrypto()||!validPublicKey(publicKeyBytes))return false;
  const msg=spriteApprovalSigningMessage(approval,reviewer,canonical);
  const sig=decodeSignature(approval?.signature);
  if(!msg||!sig)return false;
  try{
    const key=await crypto.subtle.importKey('raw',publicKeyBytes,
      {name:'Ed25519'},false,['verify']);
    return await crypto.subtle.verify({name:'Ed25519'},key,sig,
      new TextEncoder().encode(msg))===true;
  }catch{return false}
}
export function createSpriteIndependentVerifiers({novaPublicKey,operatorPublicKey}={}){
  // A live Worker must pin these keys and check that the holders are independent.
  if(!validPublicKey(novaPublicKey)||!validPublicKey(operatorPublicKey)||
    bytesEq(novaPublicKey,operatorPublicKey))return null;
  const nova=new Uint8Array(novaPublicKey);
  const operator=new Uint8Array(operatorPublicKey);
  return Object.freeze({
    verifyNova:(approval,canonical)=>verifySpriteApprovalSignature({
      approval,reviewer:'nova',canonical,publicKeyBytes:nova}),
    verifyControl:(approval,canonical)=>verifySpriteApprovalSignature({
      approval,reviewer:'chatgpt_operator',canonical,publicKeyBytes:operator})
  });
}
