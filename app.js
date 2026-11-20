"use strict";
const el = id => document.getElementById(id);
const samples = [
 [104,"Export dialog freezes on large reports","Opening export for reports over 500 rows freezes the dialog. Expected a CSV download."],
 [101,"Large reports freeze the export dialog","The export dialog freezes with large reports. Steps: open a report with 900 rows, select Export."],
 [98,"Keyboard focus skips the search field","Pressing Tab from navigation skips the search input. Expected the input to receive focus."],
 [94,"Add a compact view for issue lists","Feature request: allow maintainers to fit more issues on a laptop display."],
 [89,"Document the webhook setup","The installation guide omits webhook configuration."]
].map(([number,title,body])=>({number,title,body}));
let issues=samples, repository="Sample workspace", selected=104, generation=0;
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const words=s=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>w.length>2&&!["the","for","with","and","from"].includes(w)).map(w=>w.replace(/s$/,""))||[]);
function matches(issue){
 const a=words(issue.title);
 return issues.filter(i=>i!==issue).map(i=>{const b=words(i.title);return {i,score:[...a].filter(w=>b.has(w)).length/new Set([...a,...b]).size}}).filter(m=>m.score>=0.22).sort((x,y)=>y.score-x.score).slice(0,3);
}
function reviewKey(i){return "relay:review:"+repository.toLowerCase()+":"+i.number}
const memory=new Map();
function reviewed(i){const key=reviewKey(i);if(memory.has(key))return memory.get(key);try{return localStorage.getItem(key)==="1"}catch{return false}}
const savedKey="relay:workspace:v1";
try {
 const saved=JSON.parse(localStorage.getItem(savedKey));
 if(saved && /^[\w.-]+\/[\w.-]+$/.test(saved.repo) && Array.isArray(saved.issues) && saved.issues.every(i=>Number.isInteger(i.number)&&typeof i.title==="string"&&typeof i.body==="string")){
  repository=saved.repo;issues=saved.issues;selected=issues[0]?.number;el("repo").value=repository;
  el("status").textContent="Restored saved issues. Import again to refresh.";
 }
} catch {}
function draw(){
 const done=issues.filter(reviewed).length;
 const needsInfo=issues.filter(i=>[/steps|reproduc|1[.)]/i,/expected|should/i,/version|environment|browser|windows|linux|macos/i].some(p=>!p.test(i.body||""))).length;
 for(const [id,value] of Object.entries({statTotal:issues.length,statPending:issues.length-done,statReviewed:done,statMissing:needsInfo})) if(el(id))el(id).textContent=value;
 if(el("activityChart")){
  const chart=el("activityChart");chart.replaceChildren();
  for(const [label,value] of [["Pending",issues.length-done],["Reviewed",done]]){
   const row=node("div","","chart-row"),bar=document.createElement("progress");bar.max=issues.length||1;bar.value=value;bar.setAttribute("aria-label",label);
   row.append(node("span",label+" · "+value),bar);chart.append(row);
  }
 }
 if(el("reviewMetrics")){
  const progress=document.createElement("progress");progress.max=issues.length||1;progress.value=done;progress.setAttribute("aria-label","Review completion");
  el("reviewMetrics").replaceChildren(node("span",done+" of "+issues.length+" reviewed"),progress);
 }
 const list=el("list"), panel=el("detail");list.replaceChildren();panel.replaceChildren();
 const filter=el("reviewFilter")?.value||"all"; const visible=issues.filter(i=>filter==="all"||(filter==="reviewed")===reviewed(i)).filter(i=>(i.title+" #"+i.number).toLowerCase().includes(el("search").value.toLowerCase().trim()));
 el("queueTitle").textContent=repository;
 if(!visible.length){list.append(node("p","No matching issues."));panel.append(node("p","Select an issue to inspect its report."));return}
 const issue=visible.find(i=>i.number===selected)||visible[0];selected=issue.number;
 for(const i of visible){const b=node("button","","issue"+(i===issue?" active":""));b.type="button";b.setAttribute("aria-pressed",String(i===issue));b.append(node("small","#"+i.number),node("strong",i.title),node("span",reviewed(i)?"Reviewed":"Open","tag"));b.onclick=()=>{selected=i.number;draw();list.querySelector('[aria-pressed=true]')?.focus({preventScroll:true})};list.append(b)}
 panel.append(node("small","ISSUE / "+issue.number),node("h2",issue.title),node("p",(issue.body||"No description supplied.").slice(0,1500)));
 const label=/documen|guide|readme/i.test(issue.title)?"documentation":/feature|add |support /i.test(issue.title)?"enhancement":/freeze|fail|error|crash|skip|broken/i.test(issue.title)?"bug":"needs triage";
 panel.append(node("h3","Suggested label"),node("span",label,"tag"),node("small","Based on title keywords."),node("h3","Possible duplicates"));
 const similar=matches(issue);if(!similar.length)panel.append(node("p","No close title matches in this queue."));
 for(const {i} of similar){const b=node("button","#"+i.number+" · "+i.title);b.onclick=()=>{el("search").value="";if(el("reviewFilter"))el("reviewFilter").value="all";selected=i.number;draw()};panel.append(b)}
 const missing=[[/steps|reproduc|1[.)]/i,"steps to reproduce"],[/expected|should/i,"expected behavior"],[/version|environment|browser|windows|linux|macos/i,"environment"]].filter(([pattern])=>!pattern.test(issue.body||"")).map(([,name])=>name);
 panel.append(node("h3","Report checklist"),node("p",missing.length?"Consider asking for "+missing.join(", ")+".":"All checklist keywords found."));
 const toggle=node("button",reviewed(issue)?"Reopen review":"Mark reviewed");toggle.onclick=()=>{const value=!reviewed(issue),key=reviewKey(issue);memory.set(key,value);try{localStorage.setItem(key,value?"1":"0")}catch{}draw()};panel.append(toggle);
 if(issues!==samples){const link=node("a","Open on GitHub ↗");link.href="https://github.com/"+repository+"/issues/"+issue.number;link.target="_blank";link.rel="noopener";panel.append(link)}
}
if(el("reviewFilter"))el("reviewFilter").onchange=draw;
if(el("exportReport"))el("exportReport").onclick=()=>{
 const report={repository,exportedAt:new Date().toISOString(),issues:issues.map(i=>({number:i.number,title:i.title,reviewed:reviewed(i),possibleDuplicates:matches(i).map(m=>m.i.number)}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="relay-review.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
};
el("search").oninput=draw;
el("demo").onclick=()=>{generation++;try{localStorage.removeItem(savedKey)}catch{};if(el("reviewFilter"))el("reviewFilter").value="all";issues=samples;repository="Sample workspace";selected=104;el("search").value="";el("status").textContent="Showing sample issues.";draw()};
el("importForm").onsubmit=async event=>{
 event.preventDefault();const seq=++generation;
 const repo=el("repo").value.trim().replace(/^https:\/\/github\.com\//i,"").replace(/\/$/,"");
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||repo.split("/").some(s=>/^\.+$/.test(s))){el("status").textContent="Enter a GitHub repository as owner/name.";return}
 el("status").textContent="Fetching recent issues…";
 try{const response=await fetch("https://api.github.com/repos/"+repo+"/issues?state=open&per_page=100");
 if(!response.ok)throw Error(response.status===404?"Public repository not found.":response.status===403||response.status===429?"GitHub request limit reached. Try again later.":"GitHub could not load this repository.");
 const data=await response.json();if(seq!==generation)return;
 issues=data.filter(i=>!i.pull_request).map(i=>({number:i.number,title:i.title,body:(i.body||"").slice(0,6000)}));repository=repo;try{localStorage.setItem(savedKey,JSON.stringify({repo,issues}))}catch{};if(el("reviewFilter"))el("reviewFilter").value="all";selected=issues[0]?.number;el("search").value="";draw();el("status").textContent=issues.length+" open issues from the latest "+data.length+" entries.";
 }catch(error){if(seq===generation)el("status").textContent=error.message||"Could not connect to GitHub."}
};
draw();


