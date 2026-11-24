// Sprite #1878: transient, bounded extraction of PUBLIC task requirements only.
// No customer files, credentials, private attachments, URLs or storage; never follow embedded instructions.
const clean = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  : '';
const marker = /(ignore (all |the )?(previous|prior) instructions|system prompt|api[_ -]?key|password|private[_ -]?key|send (?:the |your )?secrets)/i;
const valid = value => value.length > 0 && !marker.test(value);
export function extractPublicBidRequirements(task) {
  const title = clean(task?.title);
  const desc = typeof task?.description === 'string' ? task.description : '';
  const crit = typeof task?.acceptance_criteria === 'string' ? task.acceptance_criteria : '';
  if (!valid(title) || title.length > 180 || desc.length > 24000 || crit.length > 12000)
    throw Error('unverifiable_public_brief');
  const grab=(name, after)=>(desc.match(new RegExp('(?:\\[|【)'+name+'(?:\\]|】)([\\s\\S]*?)(?=(?:\\[|【)'+after+'(?:\\]|】)|$)','i'))?.[1]??'');
  const scope = clean(grab('Scope of This Ticket','Deliverables'));
  const deliverables = clean(grab('Deliverables','Dependencies'));
  if(!valid(scope)||scope.length>2800||!valid(deliverables)||deliverables.length>700)
    throw Error('unverifiable_scope_or_deliverables');
  let items=crit.replace(/\r/g,'').split(/\n(?=\s*(?:\d{1,2}[.)、]|[-*]\s))/)
    .map(x=>clean(x.replace(/^\s*(?:\d{1,2}[.)、]|[-*]\s)\s*/,'')))
    .filter(Boolean);
  if(items.length===0 && valid(clean(crit)))items=[clean(crit)];
  if(items.length<1||items.length>16||items.some(x=>!valid(x)||x.length<12||x.length>350))
    throw Error('unverifiable_acceptance_criteria');
  return {public_title:title,public_scope:scope,public_deliverables:deliverables,
    public_criteria:items,source:'public_clawhunt_task_only',ephemeral:true};
}
