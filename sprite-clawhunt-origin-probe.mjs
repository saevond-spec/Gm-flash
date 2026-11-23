// Sprite-only transport-aware ClawHunt GET probe classification.
// No fetch, write, secret, authorization grant or D1 access in this module.
// In particular, "Forbidden: requests to clawhunt.store are not allowed" is
// a caller-environment egress denial, NOT a ClawHunt seller/agent verdict.
const ROUTES=new Set([
  '/api/v1/me','/api/v1/problems/3298','/api/v1/problems/3298/bids',
  '/api/v1/bids/outcomes','/api/v1/bids/standing','/openapi.json'
]);
const deny=(reason,extra={})=>({state:'unresolved',reason,can_submit:false,
  may_resubmit:false,confirmed:false,source_authentic:false,...extra});
export function classifyClawhuntGetProbe({
 method,path,httpStatus,responseText='',contentType='',finalUrl='',redirected=false
}={}){
 if(method!=='GET'||!ROUTES.has(path)||!Number.isInteger(httpStatus)
  ||typeof responseText!=='string'||responseText.length>65536
  ||typeof contentType!=='string'||contentType.length>256
  ||typeof finalUrl!=='string'||finalUrl.length>512||redirected!==false)
   return deny('probe_input_untrusted');
 // Insist on verified HTTPS host. Never follow redirects to an arbitrary origin.
 if(finalUrl&&finalUrl!==('https://clawhunt.store'+path))
   return deny('unexpected_origin_or_redirect');
 const proxyMarker=/^Forbidden: requests to clawhunt[.]store are not allowed\s*$/i;
 if(httpStatus===403&&proxyMarker.test(responseText.trim()))
   return deny('probe_environment_network_egress_blocked',
     {http_status:403,upstream_auth_status:'not_observed',recommended_action:'retry_from_authenticated_sprite_runtime_GET_only'});
 if(httpStatus===403||httpStatus===401)
   return deny('authenticated_origin_access_unverified',
     {http_status:httpStatus,upstream_auth_status:'unresolved'});
 if(httpStatus!==200)
   return deny('upstream_or_transport_failure',{http_status:httpStatus});
 if(!/^application\/(?:json|problem\+json)(?:[;\s]|$)/i.test(contentType))
   return deny('response_not_verified_json',{http_status:200});
 // Response body and header origin alone do NOT authenticate owner identity,
 // or prove ownership of any bid. It must be checked separately using Sprite's
 // real authenticated private collector and exact receipt verifier.
 return {state:'json_candidate_only',reason:'private_agent_identity_and_receipt_not_verified',
   http_status:200,can_submit:false,may_resubmit:false,confirmed:false,
   source_authentic:false,requires_private_identity:true};
}
