// Merge authenticated outcome rows without depending on response ordering.
// No network, authorization changes or marketplace writes.
export function mergeReceiptEvidence(prior,next){
 if(!prior)return {conflict:false,evidence:next};
 if(prior.bid!==next.bid||prior.status!==next.status||(prior.cents!==null&&next.cents!==null&&prior.cents!==next.cents))return {conflict:true,evidence:null};
 return {conflict:false,evidence:{bid:prior.bid,status:prior.status,cents:prior.cents??next.cents}};
}
