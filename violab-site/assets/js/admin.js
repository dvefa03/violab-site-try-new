/* VIOLAB admin tools
   - Open with Shift + P on any page (or the address violab.science/#admin, e.g. on a phone).
   - Saving uses the GitHub API with a fine-grained token that only the admins have.
     Every change becomes a commit in the website repo, so it can always be undone.
   - Without a token you can use "trial mode": you can try everything, but nothing is saved. */
(function(){
"use strict";
const APP = window.APP, S = APP.S, esc = APP.esc;
const $ = id => document.getElementById(id);
const FL = (typeof FLOOR !== "undefined") ? FLOOR : window.FLOOR;
const X_HANDLE = "violab_science";
const SITE_URL = "https://violab.science/";
const GROUPS = ["Principal Investigators","Research Scientists","Postdoctoral Fellows","Students","Visiting Scholars","Alumni"];
const LINK_KINDS = [["Paper","Paper (publisher page or DOI)"],["PDF","PDF"],["arXiv","arXiv"],["Code","GitHub"],["Data","Data"],["Video","Video"],["Supplementary","Supplementary"],["Project page","Project page"]];

/* ---------------- settings and state ---------------- */
let cfg = { repo:"kaust-violab/kaust-violab.github.io", branch:"master", root:"", token:"" };
try{ Object.assign(cfg, JSON.parse(localStorage.getItem("violab-admin")||"{}")); }catch(e){}
let active = false, trial = false, pendingImages = {};
const saveCfg = () => { try{ localStorage.setItem("violab-admin", JSON.stringify(cfg)); }catch(e){} };

/* ---------------- small UI helpers ---------------- */
const overlay = document.createElement("div"); overlay.className = "adm-overlay"; overlay.hidden = true;
overlay.innerHTML = `<div class="adm-modal" role="dialog" aria-modal="true" tabindex="-1"><button class="adm-x" type="button" aria-label="Close">✕</button><div id="admBody"></div></div>`;
document.body.appendChild(overlay);
overlay.querySelector(".adm-x").addEventListener("click", closeModal);
overlay.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });
function openModal(html, wide){ $("admBody").innerHTML = html; overlay.firstElementChild.classList.toggle("wide", !!wide); overlay.hidden = false; overlay.firstElementChild.scrollTop = 0; overlay.firstElementChild.focus(); }
function closeModal(){ overlay.hidden = true; $("admBody").innerHTML = ""; }
const bar = document.createElement("div"); bar.className = "adm-bar"; bar.hidden = true; document.body.prepend(bar);
const note = document.createElement("div"); note.className = "adm-note"; note.setAttribute("role","status"); document.body.appendChild(note);
let noteT = 0;
function tell(msg, bad){ note.textContent = msg; note.classList.toggle("bad", !!bad); note.classList.add("show"); clearTimeout(noteT); noteT = setTimeout(() => note.classList.remove("show"), bad ? 7000 : 3500); }
const venueNice = v => { const m = [["Transactions on Visualization","IEEE TVCG"],["Computer Graphics and Applications","IEEE CG&A"],["Workshops","IEEE VR Workshops"],["Virtual Reality","IEEE VR"],["Pacific Visualization","IEEE PacificVis"],["Computer Graphics Forum","Computer Graphics Forum"]];
  for(const [k,n] of m) if((v||"").toLowerCase().includes(k.toLowerCase())) return n; return (v||"").split(",")[0]; };
const slugify = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
const field = (label, inner, hint) => `<label class="adm-f"><span>${label}</span>${inner}${hint?`<small>${hint}</small>`:""}</label>`;
const inp = (id, v, ph) => `<input id="${id}" value="${esc(v||"")}" placeholder="${esc(ph||"")}">`;
const area = (id, v, rows) => `<textarea id="${id}" rows="${rows||4}">${esc(v||"")}</textarea>`;
const val = id => ($(id) ? $(id).value.trim() : "");
function readImage(file, maxW){ return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
  const w = Math.min(maxW||1400, im.width), h = Math.round(im.height*w/im.width), c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0,0,w,h); g.drawImage(im,0,0,w,h); ok(c.toDataURL("image/jpeg",0.85)); }; im.onerror = no; im.src = r.result; }; r.onerror = no; r.readAsDataURL(file); }); }
function setImage(path, dataURL){ pendingImages[path] = dataURL; try{ window.IMAGES[path] = dataURL; }catch(e){} }

/* ---------------- GitHub saving ---------------- */
async function gh(path, method, body){
  let r;
  try{ r = await fetch(`https://api.github.com/repos/${cfg.repo}/${path}`, { method: method||"GET",
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" }, body: body ? JSON.stringify(body) : undefined }); }
  catch(e){ throw new Error("the browser could not reach GitHub. Open the real website (…github.io/…), not a preview, and turn off ad or content blockers for it"); }
  if(!r.ok){ let t = ""; try{ t = (await r.json()).message; }catch(e){} throw new Error(`GitHub said ${r.status}${t?": "+t:""}`); }
  return r.json();
}
const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ""; for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); return btoa(bin); };
async function putFile(path, contentB64, message){
  const full = (cfg.root ? cfg.root.replace(/\/$/,"") + "/" : "") + path, enc = full.split("/").map(encodeURIComponent).join("/");
  let sha; try{ sha = (await gh(`contents/${enc}?ref=${encodeURIComponent(cfg.branch)}`)).sha; }catch(e){}
  return gh(`contents/${enc}`, "PUT", { message, content: contentB64, branch: cfg.branch, sha });
}
function dataFiles(){ return {
  "data/papers.json": JSON.stringify(S.pubs, null, 2),
  "data/people.json": JSON.stringify(S.people, null, 2),
  "data/news.json":   JSON.stringify(S.news, null, 2),
  "data/positions.json": JSON.stringify(S.positions || {mode:"general",positions:[]}, null, 2) }; }
async function save(what, files){
  APP.refresh(); decorateSoon();
  if(trial){ tell(`Changed in this browser only (trial mode): ${what}`); bar.querySelector("[data-dl]").hidden = false; return true; }
  tell("Saving to GitHub…");
  try{
    for(const [path, url] of Object.entries(pendingImages)) await putFile(path, url.split(",")[1], `Add image ${path}`);
    pendingImages = {};
    const all = dataFiles();
    for(const f of files) await putFile(f, b64(all[f]+"\n"), what);
    tell(`Saved: ${what}. The live site updates in about a minute.`); return true;
  }catch(e){ tell(`Could not save to GitHub. ${e.message}. Your change is still visible here, so you can try again.`, true); return false; }
}
function downloadData(){
  const all = dataFiles();
  Object.entries(all).forEach(([name, text]) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text+"\n"],{type:"application/json"})); a.download = name.split("/").pop(); a.click(); });
  Object.entries(pendingImages).forEach(([path, url]) => { const a = document.createElement("a"); a.href = url; a.download = path.split("/").pop(); a.click(); });
  tell("Downloaded the data files. Put them in the data/ folder (and images in images/papers/).");
}

/* ---------------- login ---------------- */
function openLogin(){
  if(active){ return; }
  openModal(`<h2>Admin</h2>
    <p class="adm-lead">Admins can add and edit members, papers and news. Changes are saved straight to the website’s GitHub repository.</p>
    ${field("GitHub repository", inp("aRepo", cfg.repo, "owner/name"), "The repository of this website, for example kaust-violab/kaust-violab.github.io")}
    <div class="adm-row">${field("Branch", inp("aBranch", cfg.branch, "master"))}${field("Folder of the site in the repo", inp("aRoot", cfg.root, "empty = top folder"))}</div>
    ${field("GitHub token", `<input id="aToken" type="password" value="${esc(cfg.token)}" autocomplete="off">`, "Make one on GitHub: Settings → Developer settings → Fine-grained tokens. Choose only this repository, and give <b>Contents: Read and write</b>. The token is kept only in this browser.")}
    <div class="adm-actions"><button class="btn primary" type="button" id="aLogin">Log in</button><button class="btn" type="button" id="aTrial">Try without saving</button></div>`);
  $("aTrial").onclick = () => { trial = true; start(); closeModal(); tell("Trial mode: try everything. Nothing is saved to the website."); };
  $("aLogin").onclick = async () => {
    cfg.repo = val("aRepo"); cfg.branch = val("aBranch") || "master"; cfg.root = val("aRoot"); cfg.token = $("aToken").value.trim();
    if(!cfg.token){ tell("Please paste a GitHub token, or use “Try without saving”.", true); return; }
    try{ const r = await gh(""); if(!(r.permissions && r.permissions.push)) throw new Error("this token can read the repository but cannot change it");
      // use the repository's real branch name (new repositories use "main", older ones "master")
      if(r.default_branch && r.default_branch !== cfg.branch){ tell(`Using the branch “${r.default_branch}” of this repository.`); cfg.branch = r.default_branch; }
      saveCfg(); trial = false; start(); closeModal(); tell("Logged in. Edit buttons are now on the People, Publications and News pages.");
    }catch(e){ tell(`Login failed: ${e.message}`, true); }
  };
}
function start(){
  active = true; document.body.classList.add("adm-on"); bar.hidden = false;
  bar.innerHTML = `<b>Admin mode</b><span>${trial ? "Trial: changes stay in this browser" : "Saving to "+esc(cfg.repo)+" ("+esc(cfg.branch)+")"}</span>
    <span class="adm-sp"></span><a href="#people">People</a><a href="#publications">Papers</a><a href="#news">News</a>
    <button type="button" data-dl hidden title="Download the changed data files, to put in the data/ folder by hand">Download my changes</button><button type="button" data-out>Log out</button>`;
  bar.querySelector("[data-dl]").onclick = downloadData;
  bar.querySelector("[data-out]").onclick = () => { active = false; trial = false; document.body.classList.remove("adm-on"); bar.hidden = true;
    document.querySelectorAll(".adm-tools,.adm-add").forEach(x => x.remove()); };
  decorate(); new MutationObserver(decorateSoon).observe($("main"), {childList:true, subtree:true});
}
document.addEventListener("keydown", e => {
  if(e.shiftKey && (e.key === "P" || e.key === "p") && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||"")) && !e.target.isContentEditable){ e.preventDefault(); openLogin(); }
});
function checkHash(){ if(location.hash === "#admin"){ history.replaceState(null, "", location.pathname + location.search); openLogin(); } }
window.addEventListener("hashchange", checkHash); checkHash();

/* ---------------- edit buttons on the pages ---------------- */
let decoT = 0; function decorateSoon(){ clearTimeout(decoT); decoT = setTimeout(decorate, 60); }
function tools(el, edit, remove){
  if(el.querySelector(":scope > .adm-tools")) return;
  const t = document.createElement("div"); t.className = "adm-tools";
  t.innerHTML = `<button type="button" data-e>Edit</button>${remove?`<button type="button" data-r>Remove</button>`:""}`;
  t.querySelector("[data-e]").onclick = e => { e.preventDefault(); e.stopPropagation(); edit(); };
  if(remove) t.querySelector("[data-r]").onclick = e => { e.preventDefault(); e.stopPropagation(); remove(); };
  el.prepend(t);
}
function addButton(pageName, label, fn){
  const head = document.querySelector(`[data-page="${pageName}"] .page-head`); if(!head || head.querySelector(".adm-add")) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "btn primary adm-add"; b.textContent = label; b.onclick = fn; head.appendChild(b);
}
function decorate(){
  if(!active) return;
  addButton("people", "+ Add member", () => personForm(null));
  addButton("publications", "+ Add paper", () => paperUpload());
  addButton("news", "+ Add news", () => newsForm(null));
  document.querySelectorAll("[data-person]").forEach(el => { const p = S.people.find(x => x.id === el.dataset.person); if(p) tools(el, () => personForm(p), () => removePerson(p)); });
  document.querySelectorAll("[data-pub]").forEach(el => { const p = S.pubs.find(x => x.slug === el.dataset.pub); if(p) tools(el, () => paperForm(p, false), () => removePaper(p)); });
  document.querySelectorAll("[data-paper]").forEach(el => { const p = S.pubs.find(x => x.slug === el.dataset.paper); if(p) tools(el, () => paperForm(p, false), () => removePaper(p)); });
  document.querySelectorAll("[data-news]").forEach(el => { const n = S.news[+el.dataset.news]; if(n) tools(el, () => newsForm(n), () => removeNews(n)); });
  document.querySelectorAll("[data-positions]").forEach(el => tools(el, () => positionsForm(), null));
}

/* ================= PEOPLE ================= */
function seatOptions(current, selfId){
  const taken = {}; S.people.forEach(p => { if(p.seat && p.id !== selfId) taken[p.seat] = p.name; });
  const seats = (FL && FL.seats ? FL.seats : []).slice().sort((a,b) => (a.room+a.id).localeCompare(b.room+b.id));
  return `<option value="">No desk on the floor</option>` + seats.map(s => {
    const label = s.id.startsWith("office_") ? `${s.room} · office` : `${s.room} · ${s.id.split("_").pop()}`, t = taken[s.id];
    return `<option value="${s.id}"${s.id===current?" selected":""}${t?" disabled":""}>${label}${t?" (taken: "+esc(t)+")":""}</option>`; }).join("");
}
const AV = {
  hairStyle:[["short","Short"],["long","Long"],["curly","Curly"],["bun","Bun"],["none","No hair"]],
  hair:[["#3A2A20","Dark brown"],["#1B1B1F","Black"],["#7A4E2D","Brown"],["#D4AA5A","Blonde"],["#A8492B","Red"],["#9A9AA2","Gray"],["#E4E4E8","White"],["#6B5FC7","Violet"],["#2FA9A0","Teal"],["#E86A92","Pink"]],
  hat:[["none","No hat"],["cap","Cap"],["beanie","Beanie"],["bucket","Bucket hat"],["beret","Beret"],["headphones","Headphones"]],
  glasses:[["none","No glasses"],["square","Glasses"],["round","Round glasses"],["sun","Sunglasses"]] };
const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k,n]) => `<option value="${k}"${k===v?" selected":""}>${n}</option>`).join("")}</select>`;
function personForm(p){
  const isNew = !p, d = p ? JSON.parse(JSON.stringify(p)) : { id:"", name:"", role:"", group:"Students", avatar:{} };
  const a = Object.assign({ shirt:"#5B5FC7", pants:"#34395F", hair:"#3A2A20", hairStyle:"short", hat:"none", hatColor:"#E0823A", glasses:"none" }, d.avatar||{});
  if(a.glasses===true) a.glasses="square"; if(a.glasses===false) a.glasses="none";
  openModal(`<h2>${isNew ? "Add a member" : "Edit "+esc(d.name)}</h2>
    <div class="adm-row">${field("Full name", inp("pName", d.name))}${field("Role", inp("pRole", d.role, "Ph.D. Student, Computer Science"))}</div>
    <div class="adm-row">${field("Group", sel("pGroup", GROUPS.map(g=>[g,g]), d.group), "Choose Alumni to move a person to the past members.")}${field("Desk on the floor", `<select id="pSeat">${seatOptions(d.seat||"", d.id)}</select>`, "Press N on the 3D floor to see the desk numbers.")}</div>
    ${field("Research fields", inp("pResearch", d.research, "Computer graphics, visualization"))}
    <div class="adm-row">${field("Email", inp("pEmail", d.email))}${field("Google Scholar link", inp("pScholar", d.scholar))}</div>
    ${field("Website or KAUST profile", inp("pWeb", d.web))}
    <h3>Avatar</h3>
    <p class="adm-lead">Everyone has the same friendly face. Choose the hair, clothes and accessories to make each avatar different.</p>
    <div class="adm-av">
      <img id="pAvImg" alt="Avatar preview">
      <div class="adm-av-grid">
        ${field("Hair", sel("avHairStyle", AV.hairStyle, a.hairStyle))}${field("Hair color", sel("avHair", AV.hair, a.hair))}
        ${field("Shirt", `<input id="avShirt" type="color" value="${esc(a.shirt)}">`)}${field("Trousers", `<input id="avPants" type="color" value="${esc(a.pants)}">`)}
        ${field("Hat", sel("avHat", AV.hat, a.hat))}${field("Hat color", `<input id="avHatColor" type="color" value="${esc(a.hatColor)}">`)}
        ${field("Glasses", sel("avGlasses", AV.glasses, a.glasses))}
      </div>
    </div>
    <div class="adm-actions"><button class="btn primary" type="button" id="pSave">${isNew?"Add member":"Save changes"}</button><button class="btn" type="button" id="pCancel">Cancel</button></div>`);
  const look = () => ({ hairStyle:val("avHairStyle"), hair:val("avHair"), shirt:$("avShirt").value, pants:$("avPants").value, hat:val("avHat"), hatColor:$("avHatColor").value, glasses:val("avGlasses") });
  const preview = () => { $("pAvImg").src = window.LAB ? LAB.avatar(LAB.lookFor({ id:d.id||"new", avatar:look() })) : ""; };
  ["avHairStyle","avHair","avShirt","avPants","avHat","avHatColor","avGlasses"].forEach(id => { $(id).addEventListener("input", preview); $(id).addEventListener("change", preview); }); preview();
  $("pCancel").onclick = closeModal;
  $("pSave").onclick = async () => {
    const name = val("pName"); if(!name){ tell("Please write the name.", true); return; }
    Object.assign(d, { name, role:val("pRole"), group:val("pGroup"), research:val("pResearch"), email:val("pEmail"), scholar:val("pScholar"), web:val("pWeb"), seat:val("pSeat"), avatar:look() });
    ["email","scholar","web","seat","research"].forEach(k => { if(!d[k]) delete d[k]; });
    if(d.group === "Alumni") delete d.seat;
    if(isNew){ let id = slugify(name), n = 2; while(S.people.some(x => x.id === id)) id = slugify(name)+"-"+(n++); d.id = id; d.papers = []; S.people.push(d); }
    else { Object.keys(p).forEach(k => delete p[k]); Object.assign(p, d); if(window.LAB) LAB.setLook(p.id, p.avatar); }
    closeModal();
    await save(`${isNew?"Add":"Update"} member ${d.name}`, ["data/people.json"]);
    if(isNew || (p && p.seat !== d.seat)) tell("Saved. A new or moved desk shows on the 3D floor after the page reloads.");
  };
}
async function removePerson(p){
  if(!confirm(`Remove ${p.name} from the website?\n\nTip: to keep them as a past member, use Edit and choose the group “Alumni” instead.`)) return;
  S.people.splice(S.people.indexOf(p), 1); await save(`Remove member ${p.name}`, ["data/people.json"]);
}

/* ================= JOIN US: OPEN POSITIONS ================= */
function positionsForm(){
  const P = JSON.parse(JSON.stringify(S.positions || { mode:"general", positions:[] })); P.positions = P.positions || [];
  const posHTML = (p, i) => `<div class="adm-pos" data-i="${i}">
      <div class="adm-row">${field("Position title", `<input data-k="title" value="${esc(p.title||"")}" placeholder="PhD student in neural rendering">`)}${field("Apply by (optional)", `<input data-k="deadline" value="${esc(p.deadline||"")}" placeholder="31 January 2027">`)}</div>
      ${field("Description", `<textarea data-k="text" rows="4">${esc(p.text||"")}</textarea>`, "Leave an empty line between paragraphs.")}
      ${field("How to apply", `<input data-k="apply" value="${esc(p.apply||"")}" placeholder="an email address or a link">`, "Empty = Ivan’s email.")}
      <button class="btn" type="button" data-del>Remove this position</button></div>`;
  openModal(`<h2>Open positions</h2><p class="adm-lead">Choose what the Join us page shows.</p>
    <label class="adm-check"><input type="radio" name="pm" value="closed"${P.mode==="closed"?" checked":""}> <b>No open positions</b> (the page says we don’t have positions at the moment)</label>
    <label class="adm-check"><input type="radio" name="pm" value="general"${P.mode==="general"?" checked":""}> <b>General invitation</b> (the text we have now, for MS, PhD, postdocs and research scientists)</label>
    <label class="adm-check"><input type="radio" name="pm" value="specific"${P.mode==="specific"?" checked":""}> <b>Specific positions</b> (write each position below)</label>
    <div id="posList">${P.positions.map(posHTML).join("")}</div>
    <button class="btn" type="button" id="posAdd">+ Add a position</button>
    <div class="adm-actions"><button class="btn primary" type="button" id="posSave">Save</button><button class="btn" type="button" id="posCancel">Cancel</button></div>`, true);
  const sync = () => { $("posList").hidden = $("posAdd").hidden = overlay.querySelector('input[name=pm]:checked').value !== "specific"; };
  overlay.querySelectorAll('input[name=pm]').forEach(r => r.onchange = sync); sync();
  const read = () => [...overlay.querySelectorAll(".adm-pos")].map(el => { const o = {}; el.querySelectorAll("[data-k]").forEach(x => { const v = x.value.trim(); if(v) o[x.dataset.k] = v; }); return o; });
  $("posAdd").onclick = () => { $("posList").insertAdjacentHTML("beforeend", posHTML({}, $("posList").children.length)); };
  $("posList").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if(b) b.closest(".adm-pos").remove(); });
  $("posCancel").onclick = closeModal;
  $("posSave").onclick = async () => {
    const mode = overlay.querySelector('input[name=pm]:checked').value, positions = read().filter(p => p.title);
    if(mode === "specific" && !positions.length){ tell("Please add at least one position with a title, or choose another option.", true); return; }
    S.positions = { mode, positions }; closeModal();
    await save(mode === "closed" ? "Join us: no open positions" : mode === "general" ? "Join us: general invitation" : `Join us: ${positions.length} open position${positions.length>1?"s":""}`, ["data/positions.json"]);
  };
}

/* ================= PAPERS ================= */
function loadScript(src){ return new Promise((ok,no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("could not load "+src)); document.head.appendChild(s); }); }
async function pdfjs(){
  if(!window.pdfjsLib){ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }
  return window.pdfjsLib;
}
// Read title, authors, abstract, DOI, arXiv id, venue and year from the PDF text, and make a picture of page 1.
async function extractPDF(file){
  const lib = await pdfjs(), doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise, page = await doc.getPage(1);
  const tc = await page.getTextContent(), lines = [];
  for(const it of tc.items){ if(!it.str.trim()) continue; const size = Math.round(Math.hypot(it.transform[2], it.transform[3])*10)/10, y = Math.round(it.transform[5]);
    let L = lines.find(l => Math.abs(l.y - y) < 2 && Math.abs(l.size - size) < 1.5); if(!L){ L = { y, size, parts:[] }; lines.push(L); } L.parts.push({ x: it.transform[4], e: it.transform[4]+(it.width||0), s: it.str }); }
  // a big gap between words on one line (names placed in columns) becomes a comma
  lines.forEach(l => { l.parts.sort((a,b)=>a.x-b.x); l.text = l.parts.map((p,i)=> (i && p.x - l.parts[i-1].e > Math.max(14, l.size*1.6) ? ", " : i ? " " : "") + p.s.trim().replace(/\s{2,}/g, ", ")).join("").replace(/\s+/g," ").replace(/\s+,/g,",").trim(); });
  lines.sort((a,b) => b.y - a.y);
  const top = lines.slice(0, 40), maxSize = Math.max(...top.map(l => l.size));
  const ti = top.findIndex(l => l.size >= maxSize*0.92);
  let title = "", k = ti; while(k < top.length && top[k].size >= maxSize*0.85){ title += " " + top[k].text; k++; }
  title = title.replace(/\s+/g," ").trim();
  let authorLines = []; for(; k < top.length && authorLines.length < 4; k++){ const t = top[k].text; if(/abstract|index terms|keywords|^\d+\s|introduction/i.test(t)) break; if(/@|universit|institute|kaust|department|school|lab\b|science and technology|saudi|email/i.test(t)) continue; authorLines.push(t); }
  const authors = authorLines.join(", ").replace(/[\d*†‡§¶,]+(?=\s|,|$)/g, ",").replace(/\s+and\s+/gi, ", ").split(/\s*,\s*/).map(s => s.replace(/[^\p{L}\s.\-']/gu,"").trim()).filter(s => s.split(" ").length >= 2 && s.length < 40);
  // all text of pages 1-2 in reading order (handles two-column pages)
  const pageText = async (n) => {
    const pg = n===1 ? page : await doc.getPage(n), p = n===1 ? tc : await pg.getTextContent(), W = pg.getViewport({scale:1}).width, mid = W/2;
    const rows = [];
    for(const it of p.items){ if(!it.str.trim()) continue; const y = Math.round(it.transform[5]);
      let r = rows.find(r => Math.abs(r.y-y) < 2.5); if(!r){ r = { y, items:[] }; rows.push(r); } r.items.push({ x: it.transform[4], e: it.transform[4]+(it.width||0), s: it.str }); }
    const txt = a => a.map(q=>q.s).join(" ").replace(/\s+/g," ").trim();
    rows.forEach(r => { r.items.sort((a,b)=>a.x-b.x); r.split = -1;
      // a gap around the middle of the page means two columns side by side
      for(let i=0;i<r.items.length-1;i++){ if(r.items[i].e < mid+4 && r.items[i+1].x > mid-4 && r.items[i+1].x - r.items[i].e > 8){ r.split = i; break; } } });
    rows.sort((a,b)=>b.y-a.y);
    const splitRows = rows.filter(r => r.split >= 0);
    if(splitRows.length < 5) return rows.map(r => txt(r.items)).join("\n");         // one column
    const colTop = splitRows[0].y;                                                   // where the two columns start
    const top = rows.filter(r => r.y > colTop + 1).map(r => txt(r.items));          // title, authors, full-width abstract
    const left = [], right = [];
    rows.filter(r => r.y <= colTop + 1).forEach(r => {
      if(r.split >= 0){ left.push(txt(r.items.slice(0, r.split+1))); right.push(txt(r.items.slice(r.split+1))); }
      else if(r.items[0].x < mid - 10) left.push(txt(r.items)); else right.push(txt(r.items)); });
    return [...top, ...left, ...right].join("\n");
  };
  let full = ""; for(let i = 1; i <= Math.min(doc.numPages, 2); i++) full += "\n" + await pageText(i);
  full = full.replace(/\b([A-Z]) (?=[A-Z]{2,}\b)/g, "$1")                 // "A BSTRACT" -> "ABSTRACT"
             .replace(/([a-z])-\n([a-z])/g, "$1$2").replace(/\n/g, " ").replace(/\s+/g, " ");
  const START = /\b(?:abstract|summary)\b\s*[—–:.\-]?\s*/i;
  const END = /\s(?:index terms|keywords|key words|ccs concepts|additional key words|general terms|1\.?\s+introduction|i\.\s+introduction|introduction\s+[A-Z]|manuscript received|digital object identifier|©|\(c\)\s*20\d\d|permission to make digital|author'?s? (?:address|contact))/i;
  let abstract = "";
  const sm = START.exec(full);
  if(sm){ let rest = full.slice(sm.index + sm[0].length, sm.index + sm[0].length + 4000); const em = END.exec(rest);
    abstract = em ? rest.slice(0, em.index) : rest.slice(0, 1800).replace(/[^.]*$/, ""); }
  abstract = abstract.replace(/\s+/g," ").replace(/^[\s—–:.\-]+/, "").trim();
  const doi = (full.match(/10\.\d{4,9}\/[^\s,;)]+/) || [""])[0].replace(/[.]$/,"");
  const arxiv = (full.match(/arXiv:(\d{4}\.\d{4,5})/i) || [])[1] || "";
  let venue = ""; const V = [[/transactions on visualization and computer graphics/i,"IEEE Transactions on Visualization and Computer Graphics (TVCG)"],[/computer graphics forum/i,"Computer Graphics Forum"],[/computer graphics and applications/i,"IEEE Computer Graphics and Applications (CG&A)"],[/pacific visualization|pacificvis/i,"IEEE Pacific Visualization (PacificVis)"],[/eurovis/i,"EuroVis"],[/ieee vis\b/i,"IEEE VIS"],[/\bCVPR\b/,"CVPR"],[/\bICCV\b/,"ICCV"],[/\bECCV\b/,"ECCV"],[/SIGGRAPH Asia/i,"SIGGRAPH Asia"],[/SIGGRAPH/i,"SIGGRAPH"],[/virtual reality/i,"IEEE VR"]];
  for(const [re,n] of V){ if(re.test(full.slice(0,4000))){ venue = n; break; } }
  const year = ((full.slice(0,6000).match(/\b(20[1-3]\d)\b/g) || []).sort().pop()) || String(new Date().getFullYear());
  const vp = page.getViewport({ scale: 1 }), sc = Math.min(2, 1200/vp.width), vp2 = page.getViewport({ scale: sc });
  const c = document.createElement("canvas"); c.width = vp2.width; c.height = vp2.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp2 }).promise;
  // top part of page 1 (title area and teaser figure) as a starting picture
  const crop = document.createElement("canvas"); crop.width = c.width; crop.height = Math.round(c.height*0.55); crop.getContext("2d").drawImage(c, 0, 0);
  return { title, authors, abstract, doi, arxiv, venue, year, pageImage: crop.toDataURL("image/jpeg", 0.85) };
}
window.VIOLAB_ADMIN = { extractPDF: f => extractPDF(f) };   // used by tests
function paperUpload(){
  openModal(`<h2>Add a paper</h2><p class="adm-lead">Upload the PDF of the accepted paper. The system reads the title, the authors, the abstract and the DOI. You check them, add the links, see a preview, and then publish.</p>
    <label class="adm-drop"><input id="ppFile" type="file" accept="application/pdf"><b>Choose the paper PDF</b><span>or drop it here</span></label>
    <div class="adm-actions"><button class="btn" type="button" id="ppManual">Fill in by hand instead</button></div><p id="ppStatus" class="adm-lead"></p>`);
  const drop = overlay.querySelector(".adm-drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("on"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("on"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("on"); if(e.dataTransfer.files[0]) go(e.dataTransfer.files[0]); });
  $("ppFile").onchange = e => { if(e.target.files[0]) go(e.target.files[0]); };
  $("ppManual").onclick = () => paperForm(null, true);
  async function go(file){
    $("ppStatus").textContent = "Reading the paper…";
    try{ const x = await extractPDF(file);
      const draft = { slug:"", title:x.title, year:x.year, preprint:!!x.arxiv && !x.venue, venue:x.venue ? `${x.venue}, ${x.year}` : (x.arxiv ? `arXiv preprint (${x.year})` : ""),
        authors:x.authors.map(n => ({ name:n, url:"" })), brief:"", abstract:x.abstract, image:"", links:[], bibtex:"", doi:x.doi, topic:"", _pageImage:x.pageImage };
      if(x.doi) draft.links.push({ kind:"Paper", url:"https://doi.org/"+x.doi });
      if(x.arxiv) draft.links.push({ kind:"arXiv", url:"https://arxiv.org/abs/"+x.arxiv });
      paperForm(draft, true);
      tell("Done. Please check every field: reading a PDF is not always perfect.");
    }catch(e){ $("ppStatus").textContent = "Could not read this PDF ("+e.message+"). You can fill in the fields by hand."; }
  }
}
function linkValue(d, kind){ const l = (d.links||[]).find(l => l.kind === kind); return l ? l.url : ""; }
function paperForm(p, isNew, origIn){
  const d = p ? JSON.parse(JSON.stringify(p)) : { slug:"", title:"", year:String(new Date().getFullYear()), preprint:false, venue:"", authors:[], brief:"", abstract:"", image:"", links:[], bibtex:"", doi:"", topic:"" };
  if(p && p._pageImage) d._pageImage = p._pageImage;
  const orig = isNew ? null : (origIn || p);
  openModal(`<h2>${isNew ? "New paper" : "Edit paper"}</h2>
    ${field("Title", inp("fTitle", d.title))}
    ${field("Authors", area("fAuthors", d.authors.map(a=>a.name).join(", "), 2), "Separate the names with commas.")}
    <div class="adm-row">${field("Venue", inp("fVenue", d.venue, "IEEE Transactions on Visualization and Computer Graphics (TVCG), 2026"))}${field("Year", inp("fYear", d.year))}</div>
    <div class="adm-row">${field("Research field", sel("fTopic", [["","No field"],...S.topics.map(t=>[t.id,t.name])], d.topic))}${field("Award (optional)", inp("fAward", d.award, "Best Paper Award"))}</div>
    <label class="adm-check"><input id="fPre" type="checkbox"${d.preprint?" checked":""}> This is a preprint (not yet published)</label>
    ${field("Short summary for the list", area("fBrief", d.brief, 2), "One or two sentences. If empty, the first two sentences of the abstract are used.")}
    ${field("Abstract", area("fAbs", d.abstract, 8), "Leave an empty line between paragraphs.")}
    <h3>Links</h3>
    <div class="adm-row">${field("DOI", inp("fDoi", d.doi, "10.1109/TVCG.2026.xxxxx"))}${LINK_KINDS.map(([k,n]) => field(n, inp("fL_"+k.replace(/\s/g,""), linkValue(d,k), "https://…"))).join("")}</div>
    <h3>Picture</h3>
    <div class="adm-pic">
      <img id="fImg" alt="" ${APP.S && (d.image||d._pageImage) ? "" : "hidden"}>
      <div>${field("Teaser image", `<input id="fImgFile" type="file" accept="image/*">`, d._pageImage ? "Now showing the top of page 1 of the PDF. You can choose a better teaser image." : "Choose the teaser figure of the paper.")}</div>
    </div>
    ${field("BibTeX (optional)", area("fBib", d.bibtex, 4), "Leave empty to make one from the fields above.")}
    <div class="adm-actions"><button class="btn primary" type="button" id="fPrev">Preview</button><button class="btn" type="button" id="fCancel">Cancel</button></div>`, true);
  let imgData = d._pageImage || null;
  const curImg = d.image && window.IMAGES[d.image]; if(imgData || curImg){ $("fImg").src = imgData || curImg; $("fImg").hidden = false; }
  $("fImgFile").onchange = async e => { const f = e.target.files[0]; if(!f) return; imgData = await readImage(f, 1400); $("fImg").src = imgData; $("fImg").hidden = false; };
  $("fCancel").onclick = closeModal;
  $("fPrev").onclick = () => {
    const title = val("fTitle"); if(!title){ tell("Please write the title.", true); return; }
    const out = Object.assign({}, d, { title, year:val("fYear"), venue:val("fVenue"), topic:val("fTopic"), preprint:$("fPre").checked, abstract:val("fAbs"), doi:val("fDoi") });
    out.authors = val("fAuthors").split(",").map(s => s.trim()).filter(Boolean).map(n => { const old = (d.authors||[]).find(a => a.name === n); return { name:n, url: old ? old.url : "" }; });
    out.brief = val("fBrief") || out.abstract.split(/(?<=[.!?])\s+/).slice(0,2).join(" ");
    const aw = val("fAward"); if(aw) out.award = aw; else delete out.award;
    out.links = LINK_KINDS.map(([k]) => ({ kind:k, url: val("fL_"+k.replace(/\s/g,"")) })).filter(l => l.url);
    if(out.doi && !out.links.some(l => l.kind === "Paper")) out.links.unshift({ kind:"Paper", url:"https://doi.org/"+out.doi });
    if(isNew || !out.slug){ let s = slugify(title.split(":")[0]), n = 2; while(S.pubs.some(x => x.slug === s && x !== orig)) s = slugify(title.split(":")[0])+"-"+(n++); out.slug = s; }
    out.bibtex = val("fBib") || makeBib(out);
    delete out._pageImage;
    if(imgData && imgData !== curImg){ const path = `images/papers/${out.slug}.jpg`; setImage(path, imgData); out.image = path; }
    paperPreview(out, orig);
  };
}
function makeBib(p){
  const first = (p.authors[0] ? p.authors[0].name.split(" ").pop() : "paper").toLowerCase().replace(/[^a-z]/g,"");
  const isJ = /transactions|journal|forum|applications|computer\b/i.test(p.venue);
  return `@${isJ?"article":"inproceedings"}{${first}${p.year}${p.slug.split("-")[0]},\n  title={${p.title}},\n  author={${p.authors.map(a=>a.name).join(" and ")}},\n  ${isJ?"journal":"booktitle"}={${p.venue.replace(/,\s*\d{4}$/,"")}},\n  year={${p.year}}${p.doi?`,\n  doi={${p.doi}}`:""}\n}`;
}
function xText(kind, obj){
  if(kind === "paper"){ const v = obj.preprint ? "preprint" : venueNice(obj.venue);
    return `${obj.preprint ? "New preprint" : "New paper"}: “${obj.title}”${v && !obj.preprint ? " in "+v : ""} 🎉\n${SITE_URL}#paper-${obj.slug}`; }
  return `${obj.title}\n${obj.paper ? SITE_URL+"#paper-"+obj.paper : SITE_URL+"#news"}`;
}
function xBox(text){ return `<div class="adm-x-box">
    <label class="adm-check"><input id="xOn" type="checkbox" checked> Also share it on X as <b>@${X_HANDLE}</b></label>
    <textarea id="xText" rows="3">${esc(text)}</textarea><small id="xCount"></small>
    <small>When you publish, X opens in a new tab with this text. Check that you are logged in as @${X_HANDLE} there, then click <b>Post</b>.</small></div>`; }
function wireX(){ const t = $("xText"), c = $("xCount"); const upd = () => { const len = t.value.replace(/https?:\/\/\S+/g, "x".repeat(23)).length; c.textContent = `${len} / 280`; c.classList.toggle("bad", len > 280); }; t.addEventListener("input", upd); upd();
  $("xOn").onchange = () => { t.disabled = !$("xOn").checked; }; }
function openX(){ if(!$("xOn") || !$("xOn").checked) return; window.open("https://x.com/intent/post?text=" + encodeURIComponent($("xText").value), "_blank", "noopener"); }
function paperPreview(out, orig){
  openModal(`<h2>Preview</h2><p class="adm-lead">This is exactly how the paper will look on the website. If something is wrong, go back and fix it.</p>
    <div class="adm-tabs" role="tablist"><button type="button" class="on" data-t="page">Paper page</button><button type="button" data-t="list">In the publication list</button></div>
    <div class="adm-preview" id="pvPage">${APP.paperHTML(out)}</div><div class="adm-preview" id="pvList" hidden>${APP.pubItemHTML(out)}</div>
    ${orig ? "" : `<label class="adm-check"><input id="nAlso" type="checkbox" checked> Also add a news item about this paper</label>`}
    ${orig ? "" : xBox(xText("paper", out))}
    <div class="adm-actions"><button class="btn primary" type="button" id="pvOk">Publish</button><button class="btn" type="button" id="pvBack">Back to edit</button></div>`, true);
  overlay.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { overlay.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x === b)); $("pvPage").hidden = b.dataset.t !== "page"; $("pvList").hidden = b.dataset.t !== "list"; });
  overlay.querySelectorAll(".adm-preview a").forEach(a => a.addEventListener("click", e => e.preventDefault()));
  if(!orig) wireX();
  $("pvBack").onclick = () => paperForm(Object.assign({}, out, { _pageImage: pendingImages[out.image] || null }), !orig, orig);
  $("pvOk").onclick = async () => {
    if(!orig) openX();
    const files = ["data/papers.json"];
    if(orig){ Object.keys(orig).forEach(k => delete orig[k]); Object.assign(orig, out); }
    else {
      // newest first: preprints at the top, then by year
      S.pubs.unshift(out); S.pubs.sort((a,b) => (a.preprint===b.preprint ? 0 : a.preprint ? -1 : 1) || (+b.year||0)-(+a.year||0));
      const me = n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");
      S.people.forEach(pe => { const last = me(pe.name.split(" ").pop()); if(out.authors.some(a => me(a.name.split(" ").pop()) === last && me(a.name)[0] === me(pe.name)[0])){ pe.papers = [out.slug, ...(pe.papers||[])]; if(!files.includes("data/people.json")) files.push("data/people.json"); } });
      if($("nAlso") && $("nAlso").checked){
        S.news.unshift({ title: out.preprint ? `New preprint: ${out.title.split(":")[0]}` : `${out.title.split(":")[0]} is published in ${venueNice(out.venue)}`, date: todayText(), text: out.brief, images: out.image ? [out.image] : [], paper: out.slug });
        files.push("data/news.json"); }
    }
    closeModal();
    const ok = await save(`${orig ? "Update" : "Add"} paper ${out.title.split(":")[0]}`, files);
    if(ok) location.hash = "paper-" + out.slug;
  };
}
async function removePaper(p){
  if(!confirm(`Remove the paper “${p.title}” from the website?`)) return;
  S.pubs.splice(S.pubs.indexOf(p), 1);
  S.people.forEach(pe => { if(pe.papers) pe.papers = pe.papers.filter(s => s !== p.slug); });
  S.news.forEach(n => { if(n.paper === p.slug) delete n.paper; });
  if(location.hash === "#paper-"+p.slug) location.hash = "publications";
  await save(`Remove paper ${p.title.split(":")[0]}`, ["data/papers.json","data/people.json","data/news.json"]);
}

/* ================= NEWS ================= */
function todayText(){ return new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }); }
function newsForm(n, draft){
  const isNew = !n, src = draft || n, d = src ? JSON.parse(JSON.stringify(src)) : { title:"", date:todayText(), text:"", images:[], paper:"" };
  let imgData = null; const cur = d.images && d.images[0] ? window.IMAGES[d.images[0]] : "";
  openModal(`<h2>${isNew ? "Add news" : "Edit news"}</h2>
    ${field("Title", inp("nTitle", d.title))}
    ${field("Date", inp("nDate", d.date))}
    ${field("Text", area("nText", d.text, 6), "You can paste an image straight into this box.")}
    <div class="adm-pic"><img id="nImg" alt="" ${cur?"":"hidden"} src="${cur||""}"><div>${field("Image (optional)", `<input id="nImgFile" type="file" accept="image/*">`)}</div></div>
    ${field("Link to a paper (optional)", sel("nPaper", [["","No paper"],...S.pubs.map(p => [p.slug, p.title.split(":")[0]])], d.paper||""))}
    <div class="adm-actions"><button class="btn primary" type="button" id="nPrev">Preview</button><button class="btn" type="button" id="nCancel">Cancel</button></div>`, true);
  const useImg = async f => { imgData = await readImage(f, 1400); $("nImg").src = imgData; $("nImg").hidden = false; };
  $("nImgFile").onchange = e => { if(e.target.files[0]) useImg(e.target.files[0]); };
  $("nText").addEventListener("paste", e => { const it = [...(e.clipboardData||{}).items||[]].find(i => i.type.startsWith("image/")); if(it){ e.preventDefault(); useImg(it.getAsFile()); tell("Image added."); } });
  $("nCancel").onclick = closeModal;
  $("nPrev").onclick = () => {
    const title = val("nTitle"); if(!title){ tell("Please write a title.", true); return; }
    const out = Object.assign({}, d, { title, date:val("nDate"), text:val("nText"), paper:val("nPaper") }); if(!out.paper) delete out.paper;
    if(imgData){ const path = `images/news/${slugify(title)}-${Date.now().toString(36)}.jpg`; setImage(path, imgData); out.images = [path]; }
    else if(!out.images || !out.images.length){ const pp = out.paper && S.pubs.find(p => p.slug === out.paper); out.images = pp && pp.image ? [pp.image] : []; }
    openModal(`<h2>Preview</h2><p class="adm-lead">This is how the news will look on the News page.</p>
      <div class="adm-preview">${APP.newsItemHTML(out, -1)}</div>
      ${xBox(xText("news", out))}
      <div class="adm-actions"><button class="btn primary" type="button" id="nOk">Publish</button><button class="btn" type="button" id="nBack">Back to edit</button></div>`, true);
    overlay.querySelectorAll(".adm-preview a").forEach(a => a.addEventListener("click", e => e.preventDefault()));
    wireX();
    $("nBack").onclick = () => newsForm(n, out);
    $("nOk").onclick = async () => {
      openX();
      if(isNew) S.news.unshift(out); else { Object.keys(n).forEach(k => delete n[k]); Object.assign(n, out); }
      closeModal(); await save(`${isNew?"Add":"Update"} news: ${out.title}`, ["data/news.json"]);
    };
  };
}
async function removeNews(n){ if(!confirm(`Remove the news “${n.title}”?`)) return; S.news.splice(S.news.indexOf(n), 1); await save(`Remove news: ${n.title}`, ["data/news.json"]); }
})();
