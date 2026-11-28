/* VIOLAB floor: phone and tablet controls.
   This file is only loaded on touch screens. Everything about how the floor works on a phone is here,
   so it can be changed without touching the computer controls in lab.js.

   How it works ("map first", like a maps app):
   - one finger drag  -> move the map (in 3D view: turn the camera)
   - two fingers      -> pinch to zoom (and move the map)
   - tap the floor    -> walk there (a small ring shows where you tapped)
   - tap a person, poster or model -> walk there and open its card
   - the card is a bottom sheet: swipe it down to close
   - "Jump to" opens a list of labs and people
   - "Me" brings the map back to your avatar after moving it around

   To try it on a computer, add ?phone=1 to the page address. */
(function(){
"use strict";
const ON = matchMedia("(pointer: coarse)").matches || /[?&#]phone=1\b/.test(location.href);
if(!ON || !window.LAB || !LAB.phone) return;
const P = LAB.phone, canvas = P.canvas, $ = id => document.getElementById(id);
P.enable();
document.body.classList.add("phone-ui");

/* ---------- settings to tune ---------- */
const TAP_MOVE  = 10;    // a finger that moves less than this (px) is a tap
const TAP_TIME  = 450;   // ... and is lifted within this time (ms)
const SHEET_MAX = 0.46;  // the card covers at most this part of the screen height
const LIFT      = 0.22;  // with a card open, the scene is moved up by this part of the screen, so it is not hidden

/* ---------- styles for phones only ---------- */
const css = document.createElement("style");
css.textContent = `
.phone-ui .lab-ui .goto{display:none}
.phone-ui .lab-ui .help{bottom:auto}
.phone-ui .lab-ui .card{left:0;right:0;bottom:0;top:auto;width:auto;max-height:${SHEET_MAX*100}%;
  border-radius:20px 20px 0 0;padding:26px 18px calc(16px + env(safe-area-inset-bottom,0px));animation:ph-up .25s ease-out;touch-action:pan-y}
.phone-ui .lab-ui .card::before{content:"";position:absolute;top:9px;left:50%;width:42px;height:5px;margin-left:-21px;border-radius:3px;background:var(--line,#D5D8E8)}
.phone-ui .lab-ui .card .actions a,.phone-ui .lab-ui .card .actions button{min-height:44px;display:inline-flex;align-items:center}
.phone-ui .lab-ui .card .card-close{width:44px;height:44px}
@keyframes ph-up{from{transform:translateY(40%);opacity:.4}to{transform:none;opacity:1}}
.ph-bar{position:absolute;left:10px;right:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;justify-content:flex-start;pointer-events:none;z-index:4}
.ph-bar button{pointer-events:auto;min-height:46px;padding:0 16px;border-radius:999px;border:0;font:600 .95rem "DM Sans",system-ui,sans-serif;
  background:rgba(32,36,71,.92);color:#fff;box-shadow:0 6px 18px rgba(10,12,30,.3)}
.ph-bar .ph-me[hidden]{display:none}
.phone-ui .lab-ui .minimap{bottom:calc(70px + env(safe-area-inset-bottom,0px))}
.phone-ui.ph-card-open .ph-bar,.phone-ui.ph-card-open .lab-ui .minimap{display:none}
.ph-list{position:absolute;left:0;right:0;bottom:0;max-height:70%;overflow:auto;background:var(--surface,#fff);color:var(--ink,#1F2342);
  border-radius:20px 20px 0 0;padding:24px 16px calc(18px + env(safe-area-inset-bottom,0px));z-index:6;box-shadow:0 -10px 40px rgba(10,12,30,.35);animation:ph-up .25s ease-out}
.ph-list h3{margin:6px 4px 8px;font-size:.85rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#5A5F82)}
.ph-list .ph-items{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.ph-list .ph-items button{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:4px 14px 4px 6px;border-radius:999px;
  border:1px solid var(--line,#E0E3EF);background:var(--paper,#F6F7FB);color:inherit;font:500 .95rem "DM Sans",system-ui,sans-serif}
.ph-list .ph-items img{width:32px;height:32px;border-radius:50%;image-rendering:pixelated;background:#DDE0F5}
.ph-list .ph-dot{width:14px;height:14px;border-radius:50%;margin-left:8px}
.ph-list .ph-close{position:absolute;top:10px;right:10px;width:44px;height:44px;border:0;background:none;font-size:1.2rem;color:inherit}
@media (min-width:760px){
  .phone-ui .lab-ui .card{left:auto;right:12px;bottom:12px;width:380px;border-radius:18px}
  .ph-list{left:auto;right:12px;bottom:12px;width:420px;border-radius:18px}
}`;
document.head.appendChild(css);

/* ---------- help text ---------- */
const help = $("helpList");
if(help) help.innerHTML = "<dt>Walk</dt><dd>Tap where you want to go</dd><dt>Map</dt><dd>Drag with one finger to look around, pinch to zoom</dd>"
  + "<dt>Talk</dt><dd>Tap a person or a poster</dd><dt>Jump</dt><dd>“Jump to” lists the labs and people</dd>";

/* ---------- bottom buttons: Jump to, Me ---------- */
const labUI = $("labUI");
const bar = document.createElement("div"); bar.className = "ph-bar";
bar.innerHTML = `<button type="button" class="ph-jump">Jump to…</button><button type="button" class="ph-me" hidden>◎ Me</button>`;
labUI.appendChild(bar);
const meBtn = bar.querySelector(".ph-me");
meBtn.onclick = () => P.recentre();
bar.querySelector(".ph-jump").onclick = openList;

let list = null;
function openList(){
  closeList(); P.closeCards();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  list = document.createElement("div"); list.className = "ph-list"; list.setAttribute("role","dialog"); list.setAttribute("aria-label","Jump to");
  list.innerHTML = `<button type="button" class="ph-close" aria-label="Close">✕</button>
    <h3>Labs</h3><div class="ph-items">${P.labs().map(l => `<button type="button" data-go="${esc(l.name)}"><span class="ph-dot" style="background:${l.color}"></span>${esc(l.name)}</button>`).join("")}</div>
    <h3>People</h3><div class="ph-items">${P.people().map(m => `<button type="button" data-go="${esc(m.name)}"><img src="${m.img}" alt="">${esc(m.name)}</button>`).join("")}</div>`;
  list.querySelector(".ph-close").onclick = closeList;
  list.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { closeList(); P.recentre(); P.goto(b.dataset.go); });
  labUI.appendChild(list); swipeToClose(list, closeList);
}
function closeList(){ if(list){ list.remove(); list = null; } }

/* ---------- swipe a sheet down to close it ---------- */
function swipeToClose(el, close){
  let y0 = null, dy = 0;
  el.addEventListener("touchstart", e => { if(el.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; el.style.transition = "none"; }, {passive:true});
  el.addEventListener("touchmove", e => { if(y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, {passive:true});
  el.addEventListener("touchend", () => { if(y0 === null) return; el.style.transition = "transform .2s"; el.style.transform = "";
    if(dy > 80) close(); y0 = null; });
}
document.querySelectorAll("#labUI .card").forEach(c => swipeToClose(c, () => P.closeCards()));
// cards made later (posters, models) use the same class
new MutationObserver(() => document.querySelectorAll("#labUI .card:not([data-ph])").forEach(c => { c.dataset.ph = "1"; swipeToClose(c, () => P.closeCards()); }))
  .observe(labUI, {childList:true});
document.querySelectorAll("#labUI .card").forEach(c => c.dataset.ph = "1");

/* ---------- fingers on the floor ---------- */
const pts = new Map();          // pointerId -> {x, y}
let start = null, moved = false, pinch = null;
canvas.addEventListener("pointerdown", e => {
  if(P.mode() !== "lab") return;
  canvas.setPointerCapture(e.pointerId); closeList();
  const help = $("help"); if(help) help.classList.add("is-faded");    // the help hides as soon as the map is touched
  pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pts.size === 1){ start = {x:e.clientX, y:e.clientY, t:performance.now()}; moved = false; }
  if(pts.size === 2){ moved = true; pinch = pinchInfo(); }
});
canvas.addEventListener("pointermove", e => {
  if(!pts.has(e.pointerId) || P.mode() !== "lab") return;
  const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if(pts.size === 1){
    if(!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_MOVE) moved = true;
    if(moved){ if(P.view() === "3d") P.turn(dx, dy); else P.pan(dx, dy); }
  } else if(pts.size === 2 && pinch){
    const now = pinchInfo();
    if(now.d > 0 && pinch.d > 0) P.zoom(now.d / pinch.d);
    P.pan(now.x - pinch.x, now.y - pinch.y);
    pinch = now;
  }
});
function end(e){
  if(!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if(pts.size === 0){
    if(e.type === "pointerup" && start && !moved && performance.now() - start.t < TAP_TIME) P.tap(e.clientX, e.clientY);
    start = null; pinch = null;
  } else if(pts.size === 1){ pinch = null; }  // one finger left after a pinch: no tap
}
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);
function pinchInfo(){
  const [a, b] = [...pts.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/* ---------- every frame: keep the open card's subject above the sheet; show "Me" when the map was moved ---------- */
P.onFrame = (dt, k) => {
  const cam = P.camera, w = canvas.clientWidth, h = canvas.clientHeight, narrow = w < 760;
  const lift = narrow ? LIFT * k : 0;
  if(lift > 0.002){ cam.setViewOffset(w, h, 0, h * lift, w, h); } else if(cam.view && cam.view.enabled){ cam.clearViewOffset(); }
  document.body.classList.toggle("ph-card-open", P.cardOpen());
  meBtn.hidden = !(P.view() === "auto" && P.panAmount() > 3);
};
})();
