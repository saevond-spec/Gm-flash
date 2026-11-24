// Fictional UAT severity policy capability. No customer data or service access.
export const LEVELS=['Blocker','Critical','Major','Minor'];
export const RULES={
 Blocker:'No-go: unauthorized cross-tenant access or inaccurate money or data integrity',
 Critical:'No-go by default: major workflow unavailable without reliable workaround',
 Major:'Conditional go: bounded impact with tested workaround, owner and deadline',
 Minor:'Deferrable: small copy or visual problem, no monetary or privacy impact'
};
export const EXAMPLES=[
 ['Blocker','Wrong payable amount on an approved quotation'],
 ['Blocker','Record of one tenant accessible to another tenant'],
 ['Critical','Registration fails for a large set of members'],
 ['Critical','Opportunity handoff fails without a safe fallback'],
 ['Major','Attendance export late but manual audited import possible'],
 ['Major','Knowledge citation temporarily unavailable with verified FAQ fallback'],
 ['Minor','Typo in a non-binding event reminder'],
 ['Minor','Dashboard heading wraps on mobile without lost information']
];
export function priority(level,affected,workaround,risk=false,urgent=false){
 if(!LEVELS.includes(level)||!Number.isInteger(affected)||affected<0||typeof workaround!=='boolean')throw Error('Invalid hypothetical case');
 if(risk||level==='Blocker'||(level==='Critical'&&!workaround))return 'P0';
 if(level==='Critical'||(level==='Major'&&(affected>=25||!workaround||urgent)))return 'P1';
 if(level==='Major'||(level==='Minor'&&urgent))return 'P2';
 return 'P3';
}
export function generateFictionalUatPolicy(){
 const samples=EXAMPLES.map(([level,text],i)=>({id:'U'+(i+1),level,description:text,affected:i%2?3:40,workaround:level==='Major'||level==='Minor'}));
 const lines=['# Fictional UAT severity and priority policy','Severity = impact; priority = urgency. Never assume fictional rules are official customer policy.'];
 for(const level of LEVELS){
  lines.push('## '+level,RULES[level]);
  for(const c of samples.filter(c=>c.level===level))lines.push(c.id+': '+c.description+'; priority '+priority(level,c.affected,c.workaround));
 }
 lines.push('## P0-P3 priority', 'P0: money, privacy, blocker, unmitigated critical. P1: critical or major with broad impact/no workaround. P2: manageable major or urgent minor. P3: low-risk minor.',
 'Inputs: severity, affected user count, safe workaround, privacy or financial risk, release urgency.',
 '## Go-live release gates','Blocker: NO GO until fix/retest. Critical: NO GO unless designated owner signs off verified mitigation. Major: CONDITIONAL with tested workaround and due date. Minor: defer with owner.',
 '## Acceptance evidence','A1: 4 severity definitions and 2 examples per severity.','A2: P0-P3 map to affected users and workaround.','A3: go-live blockers and exceptions are specified.');
 return {markdown:lines.join('\n\n'),samples,fictional_only:true};
}
export function verifyFictionalUatPolicy(x){
 return !!x?.fictional_only&&typeof x.markdown==='string'&&x.markdown.length>800&&Array.isArray(x.samples)&&x.samples.length===8&&
 LEVELS.every(l=>x.samples.filter(c=>c.level===l).length===2&&x.markdown.includes('## '+l))&&
 ['P0','P1','P2','P3','Go-live release gates','A1:','A2:','A3:'].every(v=>x.markdown.includes(v));
}
