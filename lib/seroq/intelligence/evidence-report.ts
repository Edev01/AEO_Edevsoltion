import type { AuditReport, ScrapeRun } from "@/components/dashboard/types";
import { classifyRecommendation } from "@/lib/seroq/intelligence/recommendation-core.mjs";

type Input = { brand: string; websites: string[]; runs: ScrapeRun[]; audit: AuditReport | null };
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function link(value: string): string {
  const url = safeUrl(value);
  return url ? `<a href="${esc(url)}" rel="noreferrer">${esc(url)}</a>` : '<span>Invalid or unsafe source URL omitted</span>';
}
// Literal configured name, with word boundaries; alias matching is not inferred.
function mentions(text: string, brand: string): boolean {
  const escaped = brand.trim().split(/\s+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return Boolean(escaped) && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}
const ratio = (n: number, d: number): string => d ? `${n}/${d} (${(100*n/d).toFixed(1)}%)` : 'Unknown - no usable observations';
const identity = (r: ScrapeRun): string => JSON.stringify([r.provider, r.createdAt, r.prompt]);

export function renderEvidenceReport(input: Input): string {
  const brand = input.brand.trim();
  if (!brand) throw new Error('Configure the target brand before exporting.');
  const seen = new Map<string, ScrapeRun>();
  const conflicts = new Set<string>();
  let duplicates = 0;
  for (const run of input.runs) {
    const key = identity(run), previous = seen.get(key);
    if (!previous) seen.set(key, run);
    else if (JSON.stringify(previous) === JSON.stringify(run)) duplicates++;
    else conflicts.add(key);
  }
  const records = [...seen.entries()].map(([key, run], i) => {
    const usable = !conflicts.has(key) && Boolean(run.prompt?.trim() && run.answer?.trim());
    const verdict = usable ? classifyRecommendation({targetBrand:brand,queryText:run.prompt,responseText:run.answer}) : null;
    return {id:`E${i+1}`,run,usable,conflict:conflicts.has(key),mention:usable && mentions(run.answer,brand),branded:mentions(run.prompt,brand),label:verdict?.label ?? 'UNCLASSIFIED'};
  });
  const usable = records.filter(r=>r.usable);
  const discovery = usable.filter(r=>!r.branded);
  const classifiedDiscovery = discovery.filter(r=>r.label!=='UNCLASSIFIED');
  const primary = classifiedDiscovery.filter(r=>r.label==='PRIMARY_RECOMMENDATION').length;
  const strong = classifiedDiscovery.filter(r=>['PRIMARY_RECOMMENDATION','SHORTLISTED'].includes(r.label)).length;
  const providers = [...new Set(records.map(r=>r.run.provider))];
  const prompts = [...new Set(records.map(r=>r.run.prompt))];
  const sources = new Map<string,Set<string>>();
  for (const row of usable) for (const raw of row.run.sources ?? []) {
    const url = safeUrl(raw); if (!url) continue;
    const domain = new URL(url).hostname;
    if (!sources.has(domain)) sources.set(domain,new Set());
    sources.get(domain)!.add(row.id);
  }
  const websiteHosts = input.websites.map(safeUrl).filter((u): u is string=>Boolean(u)).map(u=>new URL(u).hostname.replace(/^www\./,''));
  const auditUrl = input.audit && safeUrl(input.audit.url);
  const auditMatches = Boolean(auditUrl && websiteHosts.includes(new URL(auditUrl).hostname.replace(/^www\./,'')));
  const audit = auditMatches ? input.audit : null;
  const dates = usable.map(r=>r.run.createdAt).filter(s=>/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s))).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const missingDates = usable.length-dates.length;
  const table = (head: string[], rows: string[][]): string => `<table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const questionRows = prompts.map(prompt=>{
    const selected=records.filter(r=>r.run.prompt===prompt), valid=selected.filter(r=>r.usable);
    return [esc(prompt),mentions(prompt,brand)?'Branded check':'Unbranded; buyer intent requires review',esc(ratio(valid.filter(r=>r.mention).length,valid.length)),esc(ratio(valid.filter(r=>r.label==='PRIMARY_RECOMMENDATION').length,valid.filter(r=>r.label!=='UNCLASSIFIED').length)),selected.map(r=>`<a href="#${r.id}">${r.id}</a>`).join(', ')];
  });
  const checks = audit?.checks ?? [];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${esc(brand)} - Seroq evidence report</title><style>
  *{box-sizing:border-box}body{margin:0;color:#16362e;background:#f3f6f3;font:15px/1.6 Arial,sans-serif}main{max-width:1050px;margin:auto;padding:48px;background:white}h1{font-size:38px;line-height:1.15}h2{margin-top:36px;font-size:23px;border-bottom:2px solid #16805e;padding-bottom:8px}h3{font-size:17px}.eyebrow{letter-spacing:2px;font-size:12px;color:#167457}.notice{padding:16px;background:#fff5df;border-left:4px solid #ba831b}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:18px;background:#eef6f1;border:1px solid #d7e7dd}.card b{display:block;font-size:23px}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}th,td{text-align:left;padding:10px;border-bottom:1px solid #dae3dc;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2ed}a{color:#11644d;overflow-wrap:anywhere}.answer{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 Arial,sans-serif;background:#f5f7f5;padding:15px}.evidence{margin-top:24px;border-top:1px solid #d7e7dd;padding-top:10px}.muted{color:#53675d;font-size:12px}li{margin:8px 0}@media print{@page{size:A4;margin:16mm}body,main{background:white}main{padding:0;max-width:none}h1{font-size:29px}h2,h3{break-after:avoid}tr,.card{break-inside:avoid}thead{display:table-header-group}.no-print{display:none}.answer{background:white;padding:6px 0}a{color:inherit;text-decoration:none}}@media(max-width:650px){main{padding:20px}.cards{grid-template-columns:1fr}}
  </style></head><body><main><p class="eyebrow">SEROQ / EVIDENCE REVIEW</p><h1>${esc(brand)}<br>Website &amp; AI answer evidence</h1>
  <p>Exported ${esc(new Date().toISOString())}. Saved capture range: ${dates.length?esc(dates[0])+' to '+esc(dates[dates.length-1]):'unknown'}.</p>
  <p class="no-print">Use your browser's Print command and choose Save as PDF. The HTML includes the complete saved-answer appendix.</p>
  <div class="notice"><b>Review required before client delivery.</b> This report describes the selected workspace's saved records. It does not independently authenticate provider responses or confirm that every record belongs to this brand. Collection completeness, model versions and session settings are unknown. No revenue impact or cause of visibility is established.</div>
  <h2>1. What was observed</h2><div class="cards">
  <div class="card">Usable unique saved answers<b>${usable.length}</b>${records.length} unique identities; ${duplicates} duplicate rows excluded; ${conflicts.size} conflicting identities excluded.</div>
  <div class="card">Literal brand-name mentions<b>${esc(ratio(usable.filter(r=>r.mention).length,usable.length))}</b>All usable answers, including branded checks.</div>
  <div class="card">Primary recommendations<b>${esc(ratio(primary,classifiedDiscovery.length))}</b>Unbranded classified answers only; heuristic labels.</div></div>
  <p>Strong recommendations (primary + shortlisted): ${esc(ratio(strong,classifiedDiscovery.length))} in unbranded classified answers. ${discovery.length-classifiedDiscovery.length} unbranded answers remain unclassified. Branded checks: ${usable.filter(r=>r.branded).length} usable answers, reported separately below.</p>
  <p>Planned trials and completion coverage: <b>unknown</b>. Failure-event counts: <b>unknown</b>. ${records.filter(r=>!r.usable).length} saved identities are unusable or conflicting. ${missingDates} usable records lack a recognised timezone-qualified capture date. Missing records are never counted as brand absence.</p>
  ${table(['Recorded provider identifier','Usable / saved unique identities'],providers.map(p=>[esc(p),esc(usable.filter(r=>r.run.provider===p).length+' / '+records.filter(r=>r.run.provider===p).length)]))}
  <h2>2. Questions and results</h2><p>Unbranded questions are not automatically commercial buying questions. An informational answer may appropriately name no vendor. Mention means literal configured-name presence, including negative or analytical references; it does not mean endorsement. Aliases and spelling variants are not included.</p>
  ${table(['Exact question','Question group','Literal mention / usable','Primary / classified','Evidence'],questionRows)}
  <h2>3. Saved website checks</h2>
  ${audit?`<p>Recorded audit URL: ${link(audit.url)}. These are saved checker outputs, not a fresh crawl. The source format provides no audit timestamp or page-level capture archive.</p>${table(['Check','Recorded result','Recorded value / detail'],checks.map(c=>[esc(c.label),c.pass?'PASS':'FAIL',esc(c.value)+'<br>'+esc(c.detail)]))}`:`<p>No website audit matching the configured website host is available. ${input.audit?'A saved audit for another or unrecognised host was excluded.':''} No site defect is asserted.</p>`}
  <h2>4. Captured source domains</h2><p>Counts represent distinct usable saved answers containing a source URL from each domain. They do not verify that the model relied on the source, or why a competitor was selected.</p>
  ${sources.size?table(['Domain','Distinct answers','Evidence'],[...sources.entries()].sort((a,b)=>b[1].size-a[1].size).map(([domain,ids])=>[esc(domain),String(ids.size),[...ids].map(id=>`<a href="#${id}">${id}</a>`).join(', ')])):'<p>No safe HTTP(S) citation URLs were recorded.</p>'}
  <h2>5. Evidence-based next steps</h2><ol>
  <li><b>Confirm scope.</b> Verify the workspace, brand spelling, services and intended buyer questions. Review branded and informational questions separately from vendor discovery.</li>
  ${checks.filter(c=>!c.pass).slice(0,3).map(c=>`<li><b>Inspect reported failure: ${esc(c.label)}.</b> Review ${link(audit!.url)} against the recorded finding: ${esc(c.detail||c.value)}. Confirm it on the current page before implementing a fix. Success criterion: rerun this check and retain the supporting page evidence. Recommendation uplift remains unproven.</li>`).join('')}
  <li><b>Complete collection metadata.</b> Record intended trial counts, engine/model, country, locale, session strategy, settings and failure events. This report cannot reconstruct missing metadata.</li>
  <li><b>Review the raw answers and cited pages.</b> Establish a specific, verified page difference before proposing new content or structured data. Do not assume that citations prove an indexing problem.</li>
  <li><b>Measure any approved change again.</b> Preserve a baseline and use the same questions and collection protocol. Describe observed changes and confounders; do not promise a ranking or revenue outcome.</li></ol>
  <h2>6. Original saved-answer appendix</h2><p>Text below is reproduced from the stored answer field, not rewritten as an executive summary. Its provenance still requires checking against collector records. Labels use the existing deterministic classifier and require human review. Conflicting identities are excluded from metrics; their first stored version is shown only for diagnosis.</p>
  ${records.map(r=>`<article class="evidence" id="${r.id}"><h3>${r.id} / ${esc(r.run.provider)} / ${esc(r.run.createdAt)}</h3><p><b>Question:</b> ${esc(r.run.prompt)}</p><p class="muted">Country: ${esc(r.run.country||'unknown')}. Status: ${r.conflict?'CONFLICT':r.usable?'usable saved text':'unusable'}. Literal brand name: ${r.usable?(r.mention?'present':'absent'):'unknown'}. Recommendation label: ${esc(r.label)}.</p><div class="answer">${esc(r.run.answer)}</div><p>Recorded source URLs:</p><ul>${(r.run.sources??[]).map(u=>`<li>${link(u)}</li>`).join('')||'<li>None recorded.</li>'}</ul></article>`).join('')}
  <p class="muted">Seroq evidence export v1. No generated statistics, competitor findings, verbatim quotations or implementation outcomes are substituted for missing records.</p></main></body></html>`;
}

export function downloadEvidenceReport(input: Input): void {
  const html = renderEvidenceReport(input);
  const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
  const anchor = document.createElement('a');
  anchor.href=url;
  anchor.download=`seroq-${input.brand.replace(/[^a-z0-9]+/gi,'-').slice(0,60)}-evidence.html`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
