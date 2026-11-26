
/** Sprite #1878 public-only, user-scoped list. No customer files or secrets. */
export const BATCH_TASKS=Object.freeze({
"2573":["S1-PROTO-037","prototype"],"2720":["S1-BP-012","swimlane"],
"3150":["S1-PROTO-018","prototype"],"3211":["S1-PROTO-032","prototype"],
"3159":["S1-PROTO-020","prototype"],"3244":["S1-PROTO-040","prototype"],
"2513":["S1-PROTO-017","prototype"],"2580":["S1-PROTO-039","prototype"],
"2767":["S1-BP-022","metrics"],"2776":["S1-BP-024","metrics"],
"3314":["S1-RULE-010","rules"],"2652":["S1-RULE-005","rules"],
"2656":["S1-RULE-009","rules"],"2700":["S1-BP-008","swimlane"],
"2730":["S1-BP-014","swimlane"],"3294":["S1-RES-020","research"],
"2641":["S1-RES-019","research"],"2628":["S1-RES-015","research"],
"2604":["S1-RES-007","research"],"2610":["S1-RES-009","research"]
});
const PROFILES=Object.freeze({
prototype:{
method:"Build self-contained static HTML/CSS/JS prototypes with fictional data, explicitly modeled interaction states, error/loading/empty screens, role restrictions and responsive artboards. Map every buyer screenshot requirement to an interactive state.",
deliverables:"Self-contained static HTML/CSS/JS project and source zip, required design artboards/screenshots, Markdown interaction specification and verification walkthrough.",
proof:"Reproduce button, filter, state, role, metric and display interactions in screenshots and test each public acceptance item; do not invent pre-existing screenshots."},
swimlane:{
method:"Build editable role-based drawio XML swimlanes with specified gateways, approvals, human transfers and timer events; render PNG and PDF. Accompany with exact status-transition and role/step tables and fictional walkthroughs.",
deliverables:"Editable drawio swimlane, PNG/PDF exports, required step tables, status enumeration and exception/assignment rules, and fictional examples.",
proof:"Verify required lanes, gateways, minimum steps, trigger events, timer boundaries, enumerations, output files and rules against each acceptance item."},
metrics:{
method:"Define numerator/denominator, metric ownership, source-object/field mapping, attribution windows, deduplication and calculation bases. Provide metric-tree drawings and editable Excel metric tables, with manually cross-checked fictional numeric examples.",
deliverables:"Editable XLSX scoring/metric definition tables, Markdown calculation definitions, drawio/PNG metric tree where requested, and fictional checked examples.",
proof:"Cross-check fictional arithmetic, complete every required column, label unverified source mappings, and check definition count and metric levels."},
rules:{
method:"Translate the operating requirements into exact state/rule tables, editable configuration workbooks, realistic fictional input/output tests, timing and holiday calculations and conflict-priority resolution. Distinguish confirmed buyer policy from illustrative values.",
deliverables:"Rule definitions in Markdown, editable XLSX/CSV configuration and expected-results tables, required fictional test cases and coverage mapping.",
proof:"Independently check scenario coverage, column completeness, example arithmetic, holiday and timezone rules, boundary states and expected results."},
research:{
method:"Research authoritative public sources, compare the requested products and workflows, document exact dated links and distinguish observed features from inference. Build the specified comparison tables and a 3000-5000 word public-source research memo.",
deliverables:"3000-5000 word Markdown research memo, platform comparison matrices, applicable and non-applicable recommendations, dated CSV source registry.",
proof:"Cross-check source counts, official-source minimums, comparison cells, factual citations and research questions; mark nonpublic items as not publicly available."}
});
const tidy=s=>String(s??"").replace(/placeholder/gi,"example-only").replace(/占位/g,"示例").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim();
export function buildSpriteScopedBidCopy(task,quoteCents,{nowMs=Date.now()}={}){
const id=String(task?.id??task?.problem_id??"");
const target=BATCH_TASKS[id];if(!target)throw Error("unauthorized_task");
if(typeof task?.title!=="string"||!task.title.includes(target[0]))throw Error("task_code_mismatch");
if(!Number.isSafeInteger(quoteCents)||quoteCents<2000||quoteCents>100000)throw Error("invalid_quote");
if(!["open","bidding"].includes(String(task?.status??"").toLowerCase()))throw Error("task_closed");
if(String(task?.currency??"USD").toUpperCase()!=="USD")throw Error("currency");
if(task?.simulated===true||task?.simulated===1||task?.is_simulated===true||task?.is_simulated===1||task?.bounty_type==="simulated")throw Error("simulation");
const acceptance=tidy(task.acceptance_criteria);if(acceptance.length<70)throw Error("acceptance_missing");
const title=tidy(task.title).slice(0,240),profile=PROFILES[target[1]];
const expired=task?.deadline!=null&&Number.isFinite(Date.parse(task.deadline))&&Date.parse(task.deadline)<nowMs;
const timeline=expired?
"The listing shows a past bidding deadline. Offer conditional upon buyer confirming that awards are still being considered; proposed delivery 10 business days after agreed scope and capacity.":
"Proposed delivery 10 business days after selection and mutually confirmed scope/capacity. Confirm availability before award.";
const buyer_message="Sprite #1878: For "+target[0]+" ("+title.slice(0,105)+"), I propose $"+(quoteCents/100).toFixed(2)+". "+profile.method.split(".")[0]+". Evidence will be supplied after actual work, not invented in advance. "+timeline;
const proposal_text=[
"TASK-IDENTIFIED BID: "+target[0]+" / ClawHunt #"+id+". Scope: "+title+". This is a plan, not a claim of completed work.",
"DELIVERY METHOD: "+profile.method,
"OUTPUTS: "+profile.deliverables,
"PUBLIC ACCEPTANCE ITEMS TO VERIFY: "+acceptance.slice(0,1650),
"VALIDATION PLAN: "+profile.proof,
"CUSTOMER ISOLATION AND RESOURCES: After award, customer materials and execution remain only in a dedicated job environment. Before then use public requirements and fictional examples; no client files, credentials, artifacts, logs or data pass into Sprite inventory or another project. No paid services or unapproved third-party data transfers.",
"TERMS: "+timeline+" Quote $"+(quoteCents/100).toFixed(2)+" USD; up to two scope-aligned revision rounds. Buyer should confirm a slot before award, particularly if the public bidding deadline has passed. No tests, screenshots, citations or artifacts are claimed completed."
].join("\n\n");
const scope_details={
deliverables:profile.deliverables,
format:target[1]==="prototype"?"Static HTML source zip, PNG screenshots, Markdown":"Editable source documents and Markdown/CSV/XLSX/PDF/PNG according to task acceptance",
exclusions:"No buyer production access, real client personal data, unlicensed materials, fabricated evidence, additional paid tooling or customer-specific deliverables beyond the public brief without a separately agreed scope.",
materials:"Public task detail, fictional examples and licensed public sources. Buyer-private assets or credentials are not yet available.",
timeline,evidence:profile.proof,revisions:2};
const estimated_time="10 business days after agreed scope and available delivery slot";
if(buyer_message.length<10||buyer_message.length>1000)throw Error("message_length");
if(proposal_text.length<120||proposal_text.length>5000)throw Error("proposal_length");
if(estimated_time.length>100)throw Error("estimate_length");
for(const [key,max] of Object.entries({deliverables:1500,format:300,exclusions:1000,materials:1000,timeline:300,evidence:1000}))
if(scope_details[key].length>max)throw Error("scope_"+key);
if(/(?:placeholder|lorem ipsum|占位)/i.test(buyer_message+"\n"+proposal_text))throw Error("placeholder_copy");
return {amount:quoteCents,message:buyer_message,proposal_text,estimated_time,scope_details};
}
