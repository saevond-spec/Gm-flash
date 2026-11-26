
/** Sprite #1878 public-only, user-scoped list. No customer files or secrets. */
export const BATCH_TASKS=Object.freeze({
 "3110": [
  "S4-SITE-042",
  "site_seo"
 ],
 "3112": [
  "S6-SOPR-009",
  "frontend"
 ],
 "3119": [
  "S4-TRAIN-001",
  "courseware"
 ],
 "3124": [
  "S4-TRAIN-004",
  "storyboard"
 ],
 "3127": [
  "S4-TRAIN-002",
  "quickcard"
 ],
 "3136": [
  "S4-TRAIN-006",
  "courseware"
 ],
 "3142": [
  "S4-TRAIN-012",
  "assessment"
 ],
 "3145": [
  "S4-TRAIN-010",
  "courseware"
 ],
 "3146": [
  "S4-TRAIN-013",
  "storyboard"
 ],
 "3151": [
  "S4-TRAIN-015",
  "courseware"
 ],
 "3152": [
  "S4-TRAIN-016",
  "quickcard"
 ],
 "3154": [
  "S4-TRAIN-014",
  "faq"
 ],
 "3155": [
  "S4-TRAIN-017",
  "assessment"
 ],
 "3160": [
  "S4-TRAIN-020",
  "courseware"
 ],
 "3161": [
  "S4-TRAIN-019",
  "faq"
 ],
 "3163": [
  "S4-TRAIN-018",
  "storyboard"
 ],
 "3164": [
  "S4-TRAIN-021",
  "quickcard"
 ],
 "3169": [
  "S4-TRAIN-024",
  "faq"
 ],
 "3170": [
  "S4-TRAIN-023",
  "storyboard"
 ],
 "3172": [
  "S4-TRAIN-022",
  "assessment"
 ],
 "3173": [
  "S4-TRAIN-025",
  "courseware"
 ],
 "3177": [
  "S4-TRAIN-027",
  "assessment"
 ],
 "3178": [
  "S4-TRAIN-028",
  "storyboard"
 ],
 "3180": [
  "S4-TRAIN-026",
  "quickcard"
 ],
 "3181": [
  "S4-TRAIN-029",
  "courseware"
 ],
 "3185": [
  "S4-TRAIN-032",
  "storyboard"
 ],
 "3188": [
  "S4-TRAIN-030",
  "quickcard"
 ],
 "3189": [
  "S4-TRAIN-033",
  "courseware"
 ],
 "3193": [
  "S4-TRAIN-036",
  "quickcard"
 ],
 "3197": [
  "S4-TRAIN-037",
  "assessment"
 ],
 "3201": [
  "S4-TRAIN-039",
  "quickcard"
 ],
 "3204": [
  "S4-TRAIN-038",
  "courseware"
 ],
 "3221": [
  "S2-SPACE-008",
  "data"
 ],
 "3243": [
  "S2-SPACE-013",
  "data"
 ],
 "3248": [
  "S2-TAX-003",
  "api"
 ],
 "3251": [
  "S2-TAX-001",
  "backend"
 ],
 "3265": [
  "S2-TAX-007",
  "api"
 ],
 "3267": [
  "S2-TAX-011",
  "api"
 ],
 "3276": [
  "S2-TAX-016",
  "frontend"
 ],
 "3284": [
  "S2-TAX-022",
  "backend"
 ]
});
const PROFILES=Object.freeze({
courseware:{
method:"Design the buyer-specified editable PowerPoint training courseware with the precise required page count and chapter sequence, speaker notes on each slide, fictional workflows, diagram or wireframe source files and PDF export. Map chapter, role, permission and policy examples directly to the acceptance checklist without implying private system access.",
deliverables:"Editable PowerPoint deck (.pptx) with speaker/instructor notes on every slide, readable PDF export, required diagram/wireframe source files, a chapter/slide coverage matrix and fully fictional scenarios.",
proof:"Inspect real slide count, chapter coverage, exact role/permission tables, each slide's notes, missing real identities or secrets, export integrity and rendered legibility before claiming acceptance."},
quickcard:{
method:"Create a two-sided A4 quick-reference card with the exact buyer-required front/back checklists, decision steps, fictional example values, thresholds and clearly labeled escalation paths. Keep compact typography accessible and preserve an editable source.",
deliverables:"Editable two-sided A4 quick-reference card source, print-ready PDF, concise rule/mapping tables and a count-based checklist of buyer acceptance items.",
proof:"Check required front/back item count, minimum font size, threshold and escalation rules, fictitious values, bleed/layout where requested and PDF print/render integrity."},
assessment:{
method:"Author the required exact number of original fictional training questions, scenario distributions, model answers, explanations, grading criteria and coverage matrices. Cross-check every scoring method and rule boundary using explicit examples.",
deliverables:"Editable question bank and answer key in DOCX/Markdown, required table or CSV of scoring dimensions and category allocation, fully fictional sample scenarios and a completeness matrix.",
proof:"Count each specified question type and topic category; verify answer rationales, grading consistency, scenario coverage, answer keys and no invented private data or completed training outcomes."},
storyboard:{
method:"Produce the required multi-segment screen-recording storyboard as a timed shot-by-shot script with fictitious UI descriptions, voiceover, on-screen actions, role permissions and review/safety branches. Distinguish planned scenes from captured software footage.",
deliverables:"Editable timed storyboard or shot list in DOCX/Markdown, segment timeline and narration script, fictional annotated UI wireframes when needed and a shot-to-acceptance cross-reference.",
proof:"Verify segment and shot counts, exact timing windows, required columns, human approvals, redaction of personal data, recording directions and continuity; do not claim footage or real screenshots already exist."},
faq:{
method:"Draft exactly the required buyer-specified count and category distribution of FAQs, with distinct realistic fictional questions, canonical responses, operational boundaries, escalation triggers and permitted/unpermitted actions.",
deliverables:"Editable categorized FAQ catalog in DOCX/Markdown plus a count/coverage matrix, four-field answer entries when required, fictional examples and relevant approval or handoff notes.",
proof:"Verify exact category and total question counts, all required fields and policy distinctions, factual consistency and no unsupported business promises or real client data."},
api:{
method:"Implement the ticket-specific Python 3.11 FastAPI/SQLAlchemy APIs or typed services using fictional fixtures, appropriate business-rule authorization, deterministic error contracts, migrations and repeatable pytest integration tests. Mock unavailable external project dependencies.",
deliverables:"Isolated Python API source, request/response specifications, migrations where needed, fictional fixtures, pytest/unit integration tests and run instructions.",
proof:"Check specified API permissions, validation, status codes, transaction semantics, invalid cases and fixed data fixtures against exact buyer tests; attach actual test output only after execution."},
data:{
method:"Implement the specified floor-plan SVG import validation or workstation occupancy calculation as stated in the public ticket, using isolated Python-based schema/model stubs, fictional fixture files and deterministic negative/boundary tests.",
deliverables:"Typed parser or calculation service source, field dictionary/schema, fictional sample input and expected output, unit tests, reproducible README and required diagrams where applicable.",
proof:"For SVG importer, check valid JSON mapping and unknown-unit errors; for occupancy service, independently recalculate denominator exclusions and daily/monthly averages; report only executed test outcomes."},
site_seo:{
method:"Apply official-website SEO technical requirements with per-route metadata and canonical URLs, JSON-LD structured data, sitemap generation and robots directives, using source-level Next.js/TypeScript integration and fictional route fixtures. Verify every required public-page route.",
deliverables:"Source code for canonical/description/title, JSON-LD, sitemap and robots generation; route inventory, original tests, screenshot or check output as requested, and README.",
proof:"Run public route E2E assertions for one canonical and a non-empty description per page, sitemap counts and inclusion, robots directives, structured-data validity and no private client route leaks."},

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
const title=tidy(task.title).slice(0,240),profile=PROFILES[target[1]];if(!profile)throw Error('unsupported_profile');
const expired=task?.deadline==null||!Number.isFinite(Date.parse(task.deadline))||Date.parse(task.deadline)<=nowMs;if(expired)throw Error("deadline_not_future");
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
format:target[1]==="courseware"?"Editable PPTX with notes, PDF and diagram sources":target[1]==="quickcard"?"Two-sided A4 editable source and print PDF":target[1]==="assessment"?"Editable DOCX/Markdown answer key, question bank and coverage tables":target[1]==="storyboard"?"Timecoded shot list, narration and editable storyboard files":target[1]==="faq"?"Editable categorized FAQ and question-count matrix":target[1]==="api"?"FastAPI source, tests, fixtures and README":target[1]==="data"?"Parser or metrics code, fictional fixtures, tests and README":target[1]==="site_seo"?"SEO source, route tests, metadata and sitemap files":target[1]==="frontend"?"React/TypeScript code, tests, screenshots and README":target[1]==="backend"?"API source, typed contract, fictional fixtures, tests and README":target[1]==="devops"?"Docker/Nginx/CI source files, verification scripts and real command logs":target[1]==="prototype"?"Static HTML source zip, PNG screenshots, Markdown":"Editable source documents and Markdown/CSV/XLSX/PDF/PNG according to task acceptance",
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
