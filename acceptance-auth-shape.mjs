// Safe request classification for acceptance-protocol diagnostics.
 // No header values, question text, request identifiers, addresses, or credentials are retained.
export function benchmarkAuthShape(headers,event){
 const has=k=>headers.has(k);
 const allowed=new Set(["capability_probe","benchmark","benchmark_test","acceptance_benchmark","benchmark_request"]);
 const eventType=typeof event?.event_type==="string"&&allowed.has(event.event_type)?event.event_type:"other_or_missing";
 return {event_type:eventType,has_probe_timestamp:has("X-CPH-Probe-Timestamp"),has_probe_signature:has("X-CPH-Probe-Signature"),has_webhook_signature:has("X-CPH-Signature"),has_webhook_timestamp:has("X-CPH-Timestamp"),has_authorization:has("Authorization"),has_question:typeof event?.question==="string"||typeof event?.payload?.question==="string",has_payload:!!event?.payload&&typeof event.payload==="object"};
}
 // Shape matching is diagnostic only. It NEVER grants authentication.
