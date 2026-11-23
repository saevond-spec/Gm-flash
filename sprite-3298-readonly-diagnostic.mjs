// Sprite-only diagnostic for #3298. Never POSTs, clears a reservation,
// or infers that a missing receipt proves a bid was rejected.
const noRecord=Object.freeze({state:'uncertain',may_resubmit:false,may_mark_submitted:false,receipt_id:null});
export function diagnoseSpriteBid3298({
 reservation,authenticatedIdentity,taskDetail,bidHistory,outcomes
}={}){
 const errors=[],probes=[];
 if(reservation?.problem_id!=='3298'||reservation?.amount_cents!==650||
    !['uncertain','reserved','submitted'].includes(reservation?.state))
   errors.push('ledger_reservation_unverified');
 if(authenticatedIdentity?.agent_id!==1878||authenticatedIdentity?.verified!==true)
   errors.push('sprite_authenticated_identity_missing');
 if(taskDetail?.http_status!==200||taskDetail?.problem_id!=='3298')
   errors.push('task_detail_unavailable');
 const count=Number.isSafeInteger(taskDetail?.bid_count)&&taskDetail.bid_count>=0
   ?taskDetail.bid_count:null;
 if(count!==null)probes.push({source:'task_aggregate',finding:'total_bid_count_only',bid_count:count,
   proves_sprite_ownership:false});
 if([401,403].includes(bidHistory?.http_status))
   probes.push({source:'bid_history',finding:'access_denied_not_negative_proof',http_status:bidHistory.http_status});
 else if(bidHistory?.http_status===200)
   probes.push({source:'bid_history',finding:'readable_requires_independent_exact_record_validation'});
 else probes.push({source:'bid_history',finding:'not_verified'});
 if(outcomes?.http_status===200)
   probes.push({source:'outcomes',finding:'visible_records_not_exact_receipt',
     record_count:Number.isSafeInteger(outcomes.record_count)?outcomes.record_count:null});
 else probes.push({source:'outcomes',finding:'not_verified'});
 return {...noRecord,observed_task_bid_count:count,errors,probes,
   next_safe_readonly_checks:[
     {method:'GET',path:'/api/v1/bids/outcomes',goal:'revalidate authenticated outcomes and exact bid ID'},
     {method:'GET',path:'/api/v1/bids/standing',goal:'verify Sprite account and own-bid standing'},
     {method:'GET',path:'/api/v1/problems/3298',goal:'check current status, not just aggregate count'},
     {method:'GET',path:'/api/v1/problems/3298/bids',goal:'check access permissions; 403 is not negative proof'}
   ],
   requires_independently_authenticated_exact_receipt:true};
}
