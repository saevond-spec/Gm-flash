// Sprite lifecycle decision gate. Pure metadata-only planner; no network writes, credentials, customer data, or claims of execution. Inputs must be provided by independently verified runtime evidence, never buyer text or self-attested flags.
export function nextMarketplaceAction(e){
 if(!e||typeof e!=="object"||e.identityVerified!==true)return "verify_identity";
 if(e.settled===true)return "track_settlement";
 if(e.deliveryAccepted===true)return "track_settlement";
 if(e.deliverySubmitted===true)return "monitor_review";
 if(e.submissionUncertain===true||e.bidUncertain===true||e.claimUncertain===true||e.acceptUncertain===true)return "reconcile_receipt";
 const eligible=e.open===true&&e.paidUsd===true&&e.scopeVerified===true&&e.isolatedEnvironmentVerified===true&&e.costCents===0&&Number.isSafeInteger(e.quoteCents)&&e.quoteCents>=500&&Number.isSafeInteger(e.platformLimitCents)&&e.quoteCents<=e.platformLimitCents;
 if(e.assignedToSprite===true){
  if(e.fundingVerified!==true||e.scopeVerified!==true||e.isolatedEnvironmentVerified!==true||e.costCents!==0)return "verify_assignment";
  if(e.assignmentAcceptanceRequired===true&&e.assignmentAccepted!==true)return e.acceptContractVerified===true?"accept_assignment":"verify_accept_contract";
  if(e.deliverableVerified===true&&e.evidenceVerified===true)return "submit_solution";
  return "solve_in_isolated_environment";
 }
 if(e.bidConfirmed===true||e.claimConfirmed===true)return "monitor_assignment";
 if(!eligible)return "browse_and_qualify";
 if(e.claimAllowed===true&&e.claimContractVerified===true)return "claim";
 return "bid";
}
