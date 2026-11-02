/* =========================== the pages =========================== */
(function(){
"use strict";
const S=window.SITE, IM=window.IMAGES;
let PUB, PEOPLE, TOPIC;
function reindex(){ PUB=Object.fromEntries(S.pubs.map(p=>[p.slug,p])); PEOPLE=Object.fromEntries(S.people.map(p=>[p.id,p])); TOPIC=Object.fromEntries(S.topics.map(t=>[t.id,t])); }
reindex();
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const page=n=>document.querySelector(`[data-page="${n}"]`);
const members=new Set(S.people.filter(p=>p.group!=="Alumni").map(p=>norm(p.name)));
function norm(n){ return String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,""); }
function isMember(name){ const a=name.split(" "), af=norm(a[0]).charAt(0), al=norm(a[a.length-1]);
  return S.people.some(p=>p.group!=="Alumni" && (()=>{ const t=p.name.replace("A.","").split(" ").filter(Boolean); return norm(t[0]).charAt(0)===af && t.slice(1).some(x=>norm(x)===al); })()); }

const ICON={Paper:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
 PDF:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"/></svg>',
 arXiv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 16M20 4L4 20"/></svg>',
 Code:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>',
 Data:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
 Video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l13 8-13 8z"/></svg>',
 "Project page":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14L21 3M15 3h6v6M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>',
 BibTeX:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>'};
const LABEL={Code:"GitHub",PDF:"PDF",Paper:"Paper",arXiv:"arXiv",Data:"Data",Video:"Video","Project page":"Project page",Supplementary:"Supplementary",Poster:"Poster",Software:"Software"};
ICON.Supplementary=ICON.Paper; ICON.Poster=ICON.Paper; ICON.Software=ICON.Code;

function img(key,alt,cls){ return IM[key] ? `<img src="${IM[key]}" alt="${esc(alt||"")}" loading="lazy">` : `<div class="ph" aria-hidden="true">${esc((alt||"").split(/[:\s]/)[0].slice(0,10))}</div>`; }
function authorsHTML(p){ return p.authors.map(a=>{ const me=isMember(a.name); return `<span${me?' class="me"':''}>${esc(a.name)}</span>`; }).join(", "); }
function venueText(p){ let v=p.venue||""; if(p.year && !v.includes(p.year)) v=(v?v+", ":"")+p.year; return v; }
function linkBtns(p,{bib=true,primary=false}={}){
  const vids=p.links.filter(l=>l.kind==="Video");
  let h=p.links.map((l,i)=>{ const n=l.kind==="Video"&&vids.length>1?` ${vids.indexOf(l)+1}`:"";
    return `<a class="btn${primary&&i===0?" primary":""}" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON[l.kind]||""}${LABEL[l.kind]||l.kind}${n}</a>`; }).join("");
  if(bib && p.bibtex) h+=`<button class="btn" type="button" data-bib="${esc(p.slug)}">${ICON.BibTeX}BibTeX</button>`;
  return `<div class="btns">${h}</div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-bib]"); if(!b) return;
  const t=PUB[b.dataset.bib].bibtex;
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{ const o=b.innerHTML; b.textContent="Copied"; setTimeout(()=>b.innerHTML=o,1400); },()=>{ location.hash="paper-"+b.dataset.bib; });
});

/* ---- tiles used on the home page ---- */
function paperTile(p){ return `<article class="tile"><a class="thumb" href="#paper-${p.slug}" tabindex="-1">${img(p.image,p.title)}</a>
  <div class="body"><h3><a href="#paper-${p.slug}">${esc(p.title)}</a></h3><div class="meta">${esc(venueText(p))}${p.award?` <span class="award">${esc(p.award)}</span>`:""}</div>
  <p>${esc(p.brief)}</p>${linkBtns(p,{bib:false})}</div></article>`; }
function newsTile(n){ const h=n.paper?`#paper-${n.paper}`:"#news"; return `<article class="tile"><a class="thumb" href="${h}" tabindex="-1">${img(n.images[0],n.title)}</a><div class="body"><div class="meta">${esc(n.date)}</div><h3><a href="${h}">${esc(n.title)}</a></h3><p>${esc(n.text)}</p></div></article>`; }
// Home shows one full row of the newest papers and news: as many as fit the screen width.
// The lists come straight from papers.json and news.json (newest first), so new items appear here by themselves.
function columnsOf(el){ const t=getComputedStyle(el).gridTemplateColumns; return t && t!=="none" ? t.split(" ").filter(Boolean).length : 3; }

function renderHome(){
  const P=$("homePapers"), N=$("homeNews");
  P.innerHTML=S.pubs.filter(p=>!p.preprint).slice(0,Math.max(2,columnsOf(P))).map(paperTile).join("");
  $("homeTopics").innerHTML=S.topics.map(t=>{ const ps=S.pubs.filter(p=>p.topic===t.id); const k=ps.find(p=>p.image);
    const sw=t.software&&[...S.software,...S.models].find(r=>r.title===t.software.split(",")[0].trim()); const im=(k&&k.image)||(sw&&sw.image);
    return `<article class="tile"><a class="thumb" href="#topic-${t.id}" tabindex="-1">${img(im,t.name)}</a><div class="body"><h3><a href="#topic-${t.id}">${esc(t.name)}</a></h3><div class="meta">${ps.length ? ps.length+" paper"+(ps.length===1?"":"s") : (t.software ? "Software and 3D models" : "")}</div></div></article>`; }).join("");
  N.innerHTML=S.news.slice(0,Math.max(2,columnsOf(N))).map(newsTile).join("");
}
let homeCols="";
addEventListener("resize",()=>{ clearTimeout(window.__homeT); window.__homeT=setTimeout(()=>{ const P=$("homePapers"); if(!P||page("home").hidden) return;
  const c=columnsOf(P)+"/"+columnsOf($("homeNews")); if(c!==homeCols){ homeCols=c; renderHome(); } },150); });

/* ---- publications ---- */
const pubState={q:"",topic:"",year:"",person:""};
function renderPublications(){
  const el=page("publications");
  const years=[...new Set(S.pubs.map(p=>p.year).filter(Boolean))].sort().reverse();
  const person=pubState.person&&PEOPLE[pubState.person];
  el.innerHTML=`<div class="page-head"><h1>${person?"Papers by "+esc(person.name):"Publications"}</h1><p>${person?`<a href="#publications">Show all papers</a>`:"All our research and papers, newest first. Choose a research field to see only its papers. Each paper has its own page with the abstract, downloads and BibTeX."}</p></div>
  <div class="filters" role="search">
    <input id="pubQ" type="search" placeholder="Search titles, authors or venues" value="${esc(pubState.q)}" aria-label="Search publications">
    <select id="pubY" aria-label="Year"><option value="">All years</option>${years.map(y=>`<option${y===pubState.year?" selected":""}>${y}</option>`).join("")}</select>
    <div class="chips" role="group" aria-label="Research field"><button class="chip" type="button" data-topic="" aria-pressed="${!pubState.topic}">All fields</button>${S.topics.map(t=>`<button class="chip" type="button" data-topic="${t.id}" aria-pressed="${pubState.topic===t.id}">${esc(t.name)}</button>`).join("")}</div>
  </div><div id="topicNote"></div><div id="pubList"></div>`;
  $("pubQ").addEventListener("input",e=>{ pubState.q=e.target.value; drawList(); });
  $("pubY").addEventListener("change",e=>{ pubState.year=e.target.value; drawList(); });
  el.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>{ pubState.topic=b.dataset.topic; el.querySelectorAll("[data-topic]").forEach(x=>x.setAttribute("aria-pressed",x===b)); drawList(); }));
  drawList();
}
function drawList(){
  const q=pubState.q.trim().toLowerCase(), pp=pubState.person&&PEOPLE[pubState.person];
  const list=S.pubs.filter(p=>(!pubState.topic||p.topic===pubState.topic)&&(!pubState.year||p.year===pubState.year)
    &&(!pp||pp.papers.includes(p.slug))
    &&(!q||(p.title+" "+p.venue+" "+p.authors.map(a=>a.name).join(" ")).toLowerCase().includes(q)));
  const t=TOPIC[pubState.topic]; const sw=t&&t.software;
  $("topicNote").innerHTML = t && (t.text||sw) ? `<div class="topic-note"><b>${esc(t.name)}</b>${t.text?`<p>${esc(t.text)}</p>`:""}${sw?`<p>See also <a href="#software">${esc(sw)}</a> in Software &amp; Data.</p>`:""}</div>` : "";
  const groups=[]; let cur=null;
  list.forEach(p=>{ const g=p.preprint?"Preprints":p.year||"Other"; if(!cur||cur.g!==g){ cur={g,items:[]}; groups.push(cur); } cur.items.push(p); });
  $("pubList").innerHTML=`<p class="count">${list.length} paper${list.length===1?"":"s"}</p>`+(groups.map(g=>`<h2 class="year-h">${esc(g.g)}</h2>`+g.items.map(p=>`
    <article class="pub" data-pub="${esc(p.slug)}">
      <a class="thumb" href="#paper-${p.slug}" tabindex="-1">${img(p.image,p.title)}</a>
      <div>
        <h3><a href="#paper-${p.slug}">${esc(p.title)}</a></h3>
        <p class="authors">${authorsHTML(p)}</p>
        <p class="venue">${esc(venueText(p))}${p.award?`<span class="award">${esc(p.award)}</span>`:""}</p>
        <p class="brief">${esc(p.brief)}</p>
        ${linkBtns(p)}
      </div>
    </article>`).join("")).join("")||`<p>No papers match. Try another word or clear the filters.</p>`);
}

function pubItemHTML(p){ return `<article class="pub"><a class="thumb" tabindex="-1">${img(p.image,p.title)}</a><div><h3><a>${esc(p.title)}</a></h3><p class="authors">${authorsHTML(p)}</p><p class="venue">${esc(venueText(p))}${p.award?`<span class="award">${esc(p.award)}</span>`:""}</p><p class="brief">${esc(p.brief)}</p>${linkBtns(p)}</div></article>`; }
/* ---- one standard page per paper ---- */
function venueShort(v){
  const m=[["Transactions on Visualization","IEEE Trans. Vis. Comput. Graph."],["Computer Graphics and Applications","IEEE Comput. Graph. Appl."],["Workshops","IEEE VR Workshops"],["Virtual Reality","IEEE VR"],
    ["Pacific Visualization","IEEE PacificVis"],["visual computer","The Visual Computer"],["Nucleic Acids","Nucleic Acids Res."],["Computer Graphics Forum","Comput. Graph. Forum"],["arXiv","arXiv preprint"],["BMC Bioinformatics","BMC Bioinformatics"],["molecular biology","J. Mol. Biol."]];
  for(const [k,n] of m) if((v||"").toLowerCase().includes(k.toLowerCase())) return n;
  return (v||"").split(",")[0];
}
function hostName(u){
  const h=(u||"").toLowerCase();
  if(h.includes("ieeexplore")||h.includes("doi.org/10.1109")||h.includes("computer.org")) return "IEEE Xplore";
  if(h.includes("arxiv")) return "arXiv"; if(h.includes("wiley")||h.includes("10.1111")) return "Wiley"; if(h.includes("springer")||h.includes("10.1007")||h.includes("10.1186")) return "Springer";
  if(h.includes("sciencedirect")||h.includes("10.1016")) return "ScienceDirect"; if(h.includes("acm.org")||h.includes("10.1145")) return "ACM Digital Library"; if(h.includes("academic.oup")||h.includes("10.1093")) return "Oxford Academic";
  if(h.includes("biorxiv")) return "bioRxiv"; return "";
}
function renderPaper(slug){
  const p=PUB[slug], el=page("paper");
  if(!p){ el.innerHTML=`<div class="page-head"><h1>Paper not found</h1><p><a href="#publications">Go to all publications</a></p></div>`; return; }
  el.innerHTML=paperHTML(p);
}
function paperHTML(p){
  const abs=(p.abstract||p.brief).split(/\n\n+/).map(x=>`<p>${esc(x)}</p>`).join("");
  const main=p.links.find(l=>l.kind==="Paper")||p.links.find(l=>l.kind==="arXiv")||p.links.find(l=>l.kind==="PDF");
  const host=main?hostName(main.url):"";
  const others=p.links.filter(l=>l!==main);
  const field=TOPIC[p.topic]?TOPIC[p.topic].name:"Research";
  const vs=p.preprint?"Preprint":venueShort(p.venue);
  return `<article class="paper2" data-paper="${esc(p.slug)}">
    ${IM[p.image]?`<figure class="p2-teaser"><img src="${IM[p.image]}" alt="Overview figure of ${esc(p.title)}"></figure>`:""}
    <p class="p2-kicker"><a href="#topic-${esc(p.topic)}">${esc(field)}</a> · ${esc(vs)}${p.award?` · <span class="p2-award">${esc(p.award)}</span>`:""}</p>
    <h1>${esc(p.title)}</h1>
    <p class="p2-authors">${p.authors.map(a=>a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`:esc(a.name)).join(", ")}</p>
    <div class="p2-body">
      <aside class="p2-side">
        <div class="p2-label">Abstract</div>
        <p>${esc(venueText(p))}</p>
      </aside>
      <div class="p2-main">
        <div class="p2-abstract">${abs}</div>
        <div class="p2-read">
          <div>
            <div class="p2-read-h">Read the full paper</div>
            <div class="p2-meta">${p.doi?`DOI: ${esc(p.doi)}`:""}${p.doi&&host?" · ":""}${esc(host)}</div>
          </div>
          ${main?`<a class="p2-cta" href="${esc(main.url)}" target="_blank" rel="noopener">${host?"View on "+esc(host):"View the paper"}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>`:""}
        </div>
        ${others.length||p.bibtex?`<div class="p2-more">${others.map(l=>`<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON[l.kind]||""}${LABEL[l.kind]||l.kind}</a>`).join("")}${p.bibtex?`<button class="btn" type="button" data-bib="${p.slug}">${ICON.BibTeX}Copy BibTeX</button>`:""}</div>`:""}
      </div>
    </div>
  </article>`;
}

/* ---- software / data ---- */
function resTile(r){ return `<article class="tile">${r.image?`<div class="thumb">${img(r.image,r.title)}</div>`:""}<div class="body"><div class="meta">${esc(r.kind)}</div><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p>
  <div class="btns">${r.links.slice(0,4).map((l,i)=>`<a class="btn${i===0?" primary":""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}${r.paper?`<a class="btn" href="#paper-${r.paper}">The paper</a>`:""}</div></div></article>`; }
const swState={kind:""};
function renderSoftware(){
  const items=[...S.software,...S.models];
  const kinds=[["","All"],["Application","Applications"],["Code","Code and builds"],["Mesoscale model","Mesoscale models"]];
  const el=page("software");
  el.innerHTML=`<div class="page-head"><h1>Software &amp; Data</h1><p>Applications, code and mesoscale models from our research.</p></div>
   <div class="filters"><div class="chips" role="group" aria-label="Type">${kinds.map(([k,n])=>`<button class="chip" type="button" data-kind="${k}" aria-pressed="${swState.kind===k}">${n}</button>`).join("")}</div></div>
   <div class="grid c3" id="swList"></div>`;
  const draw=()=>{ $("swList").innerHTML=items.filter(r=>!swState.kind||r.kind===swState.kind).map(resTile).join(""); };
  el.querySelectorAll("[data-kind]").forEach(b=>b.addEventListener("click",()=>{ swState.kind=b.dataset.kind; el.querySelectorAll("[data-kind]").forEach(x=>x.setAttribute("aria-pressed",x===b)); draw(); }));
  draw();
}

/* ---- people ---- */
const avatarImgs={};
function avatarFor(p){ return (window.LAB&&LAB.avatar)? LAB.avatar(LAB.lookFor(p)) : ""; }
function renderPeople(){
  const groups=["Principal Investigators","Research Scientists","Postdoctoral Fellows","Students","Visiting Scholars","Alumni"];
  page("people").innerHTML=`<div class="page-head"><h1>People</h1><p>The VIOLAB team. People with a desk on our floor can also be found on the 3D floor map on the home page.</p></div>`+
   groups.map(g=>{ const ps=S.people.filter(p=>p.group===g); if(!ps.length) return "";
    return `<h2 class="group-h">${g}</h2><div class="people">${ps.map(p=>`<article class="person" data-person="${esc(p.id)}"><img data-av="${p.id}" src="${avatarImgs[p.id]||avatarFor(p)}" alt="">
      <div><h3>${esc(p.name)}</h3><div class="role">${esc(p.role)}</div>${p.research?`<p class="${p.research.startsWith("Here we will")?"todo":""}">${esc(p.research)}</p>`:""}
      <div class="links">${p.email?`<a href="mailto:${esc(p.email)}">Email</a>`:""}${p.web?`<a href="${esc(p.web)}" target="_blank" rel="noopener">${/kaust\.edu\.sa/.test(p.web)?"KAUST profile":"Website"}</a>`:""}${p.scholar?`<a href="${esc(p.scholar)}" target="_blank" rel="noopener">Scholar</a>`:""}${p.seat?`<button type="button" data-find="${p.id}">Find me on the floor</button>`:""}</div></div></article>`).join("")}</div>`; }).join("");
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-find]"); if(!b) return; location.hash=""; setTimeout(()=>window.LAB&&LAB.enter(b.dataset.find),60); });

/* ---- news + join ---- */
function renderNews(){
  page("news").innerHTML=`<div class="page-head"><h1>News</h1><p>New papers, awards and other news from the lab.</p></div>`+S.news.map((n,i)=>newsItemHTML(n,i)).join("");
}
function newsItemHTML(n,i){
  return `<article class="news-item" data-news="${i}"><a class="thumb" href="${n.paper?"#paper-"+n.paper:"#news"}" tabindex="-1">${img(n.images[0],n.title)}</a><div><time>${esc(n.date)}</time><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${n.paper?`<div class="btns"><a class="btn primary" href="#paper-${n.paper}">Read the paper</a>${((PUB[n.paper]||{links:[]}).links.find(l=>l.kind==="Code")||{}).url?`<a class="btn" href="${esc(PUB[n.paper].links.find(l=>l.kind==="Code").url)}" target="_blank" rel="noopener">${ICON.Code}GitHub</a>`:""}</div>`:""}</div></article>`;
}
// positions: data/positions.json = { mode: "closed" | "general" | "specific", positions: [ {title, text, deadline, apply} ] }
const PI_EMAIL="ivan.viola@kaust.edu.sa";
function renderJoin(){
  const P=S.positions||{mode:"general",positions:[]};
  const list=(P.positions||[]).filter(p=>p.title);
  const mode = P.mode==="specific" && !list.length ? "closed" : P.mode;
  const general=`<p>Maybe we can include a general text here.</p>
  <p>this case would be if we are not looking for a specific position but willing to discuss opportunities</p>`;
  let box;
  if(mode==="closed") box=`<div class="callout" data-positions><h2>Open positions</h2><p>We don’t have open positions at the moment. Please check this page again later.</p>
    <p class="muted">You are still welcome to write to us about future opportunities.</p><div class="btns"><a class="btn" href="mailto:${PI_EMAIL}">Contact Prof. Ivan Viola</a></div></div>`;
  else if(mode==="specific") box=`<div data-positions><h2 class="group-h" style="margin-top:0">Open positions</h2>${list.map(p=>`<div class="callout pos">
      <h2>${esc(p.title)}</h2>${p.deadline?`<p class="pos-deadline">Apply by ${esc(p.deadline)}</p>`:""}
      ${String(p.text||"").split(/\n\n+/).map(x=>`<p>${esc(x)}</p>`).join("")}
      <div class="btns">${p.apply&&/^https?:/.test(p.apply)?`<a class="btn primary" href="${esc(p.apply)}" target="_blank" rel="noopener">How to apply</a>`:`<a class="btn primary" href="mailto:${esc(p.apply||PI_EMAIL)}">Email to apply</a>`}</div></div>`).join("")}</div>`;
  else box=`<div class="callout" data-positions><h2>Open positions</h2>${general}<div class="btns"><a class="btn primary" href="mailto:${PI_EMAIL}">Email Prof. Ivan Viola</a></div></div>`;
  page("join").innerHTML=`<div class="page-head"><h1>Join us</h1><p>We are looking for curious people who like graphics, visualization and AI.</p></div>
  ${box}
  <div class="callout" style="margin-top:18px"><h2>Visit us</h2><p>Building 1 (Al Khawarizmi), Level 2, King Abdullah University of Science and Technology, Thuwal, Saudi Arabia.</p><div class="btns"><a class="btn" href="#">Walk through our floor in 3D</a></div></div>`;
}

/* ---- email links open a small window with the address (works everywhere, also without an email app) ---- */
const mailBox=document.createElement("div"); mailBox.className="mail-pop"; mailBox.hidden=true; mailBox.setAttribute("role","dialog"); mailBox.setAttribute("aria-modal","true");
mailBox.innerHTML=`<div class="mail-card" tabindex="-1"><button class="mail-x" type="button" aria-label="Close">✕</button><h3>Email</h3><div class="mail-row"><span class="mail-addr" id="mailAddr"></span><button class="btn primary" type="button" id="mailCopy">Copy</button></div>
  <p class="mail-app"><a id="mailApp">Open my email app</a></p></div>`;
document.body.appendChild(mailBox);
const closeMail=()=>{ mailBox.hidden=true; };
mailBox.addEventListener("click",e=>{ if(e.target===mailBox||e.target.closest(".mail-x")) closeMail(); });
mailBox.addEventListener("keydown",e=>{ if(e.key==="Escape") closeMail(); });
document.addEventListener("click",e=>{
  const a=e.target.closest('a[href^="mailto:"]'); if(!a||a.closest(".mail-pop")) return;
  e.preventDefault(); e.stopPropagation();
  const addr=decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]);
  $("mailAddr").textContent=addr; $("mailApp").href="mailto:"+addr;
  $("mailCopy").textContent="Copy";
  mailBox.hidden=false; mailBox.firstElementChild.focus();
},true);
$("mailCopy").addEventListener("click",()=>{ const t=$("mailAddr").textContent;
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{ $("mailCopy").textContent="Copied"; },()=>{ const r=document.createRange(); r.selectNodeContents($("mailAddr")); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); $("mailCopy").textContent="Selected, press Ctrl+C"; }); });

/* ---- router (one page at a time; the 3D stage stays alive on home) ---- */
const rendered={};
function route(){
  const h=(location.hash||"").slice(1);
  let name=h||"home", arg="";
  if(name==="research") name="publications";
  if(name==="data"){ name="software"; swState.kind="Mesoscale model"; rendered.software=false; }
  if(h.startsWith("paper-")){ name="paper"; arg=h.slice(6); }
  if(h.startsWith("topic-")){ name="publications"; pubState.topic=h.slice(6); pubState.person=""; rendered.publications=false; }
  else if(h.startsWith("by-")){ name="publications"; pubState.person=h.slice(3); rendered.publications=false; }
  else if(name==="publications" && (pubState.person||pubState.topic)){ pubState.person=""; pubState.topic=""; rendered.publications=false; }
  if(!page(name)) name="home";
  document.querySelectorAll("[data-page]").forEach(s=>s.hidden=s.dataset.page!==name);
  const navName = name==="paper"?"publications":name;
  document.querySelectorAll("#mainNav a").forEach(a=>{ if(a.getAttribute("href")==="#"+navName) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  if(name==="paper") renderPaper(arg);
    else if(name==="home"){ renderHome(); rendered.home=true; }
  else if(!rendered[name]){ ({home:renderHome,publications:renderPublications,software:renderSoftware,people:renderPeople,news:renderNews,join:renderJoin})[name](); rendered[name]=true; }
  const titles={home:"",publications:"Publications",paper:arg&&PUB[arg]?PUB[arg].title.split(":")[0]:"Paper",software:"Software & Data",people:"People",news:"News",join:"Join us"};
  document.title=(titles[name]?titles[name]+" · ":"")+"VIOLAB · KAUST";
  $("mainNav").classList.remove("open"); $("menuBtn").setAttribute("aria-expanded","false");
  if(!h || h==="home") window.scrollTo(0,0); else window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);
$("menuBtn").addEventListener("click",()=>{ const o=$("mainNav").classList.toggle("open"); $("menuBtn").setAttribute("aria-expanded",o); });
window.APP={ S, esc, img, renderJoin, paperHTML, pubItemHTML, newsItemHTML, venueShort, avatarFor,
  refresh(){ reindex(); for(const k in rendered) rendered[k]=false; route(); },
  setAvatar(id,src){ avatarImgs[id]=src; document.querySelectorAll(`[data-av="${id}"]`).forEach(i=>i.src=src); }, labReady(){ rendered.people=false; if(!page("people").hidden) renderPeople(); } };
route();
})();
