
/** Sprite #1878 public-only, user-scoped list. No customer files or secrets. */
export const BATCH_TASKS=Object.freeze({
"3287":["S2-WB-001","frontend"],"3288":["S2-TAX-025","backend"],
"3289":["S2-WB-002","frontend"],"3291":["S2-WB-004","frontend"],
"3293":["S2-WB-005","frontend"],"3295":["S2-WB-007","frontend"],
"3296":["S2-WB-008","frontend"],"3297":["S2-WB-006","frontend"],
"3299":["S2-WB-010","frontend"],"3300":["S2-WB-009","frontend"],
"3301":["S2-WB-011","frontend"],"3303":["S2-WB-013","frontend"],
"3304":["S2-WB-012","frontend"],"3305":["S2-WB-014","frontend"],
"3307":["S2-WB-016","frontend"],"3308":["S2-WB-015","frontend"],
"3309":["S2-WB-017","frontend"],"3311":["S2-WB-019","frontend"],
"3312":["S2-WB-018","frontend"],"3313":["S2-WB-020","devops"]
});
const PROFILES=Object.freeze({
frontend:{
method:"Implement the named feature using Vite, React, TypeScript and TDesign with typed components, appropriate permission/role checks, responsive states, API adapter stubs and focused Vitest/Playwright cases. Follow the existing project conventions without copying customer data, and derive exact tests from each acceptance criterion.",
deliverables:"React/TypeScript source files and module integration instructions; typed components, fictional fixtures, unit/integration tests, screenshots and reproducible README as requested by the ticket.",
proof:"Validate all ticket-specific UI behaviors, permission boundaries, loading/error states, i18n and navigation where relevant; supply real test output and actual screenshots only after running them in an isolated task environment."},
backend:{
method:"Build the named dictionary API and page integration contract using FastAPI/SQLAlchemy and typed frontend client stubs, with fictional fixtures, explicit status/error handling and deterministic API/integration tests. Use mocks for unprovided dependencies.",
deliverables:"Backend API code, typed request/response contracts, frontend integration adapter, isolated fictional test fixtures, pytest/Vitest integration cases and README.",
proof:"Test API status and schema constraints, dictionary filtering, invalid inputs and page integration against all buyer acceptance items; provide logs from real execution, not invented assertions."},
devops:{
method:"Prepare a reproducible multi-stage Docker build, minimal Nginx static server, whitelisted runtime configuration injection, secure HTTP headers and a bounded CI pipeline. Use fictional environment variables only and verify image size, curl output, bundle budget and non-whitelisted variable exclusion.",
deliverables:"Dockerfile, Nginx configuration, runtime config injection script, CI workflow, size and security verification scripts, command transcripts and README.",
proof:"Execute docker build, inspect real image size, verify whitelisted config.js values with multiple APP_API_BASE values, check required security headers and JS bundle size; hold final acceptance evidence until the isolated runner performs these tests."},

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
format:target[1]==="frontend"?"React/TypeScript code, tests, screenshots and README":target[1]==="backend"?"API source, typed contract, fictional fixtures, tests and README":target[1]==="devops"?"Docker/Nginx/CI source files, verification scripts and real command logs":target[1]==="prototype"?"Static HTML source zip, PNG screenshots, Markdown":"Editable source documents and Markdown/CSV/XLSX/PDF/PNG according to task acceptance",
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
