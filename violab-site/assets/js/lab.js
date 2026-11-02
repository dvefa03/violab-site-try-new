/* VIOLAB 3D lab: the Gather-style floor of Building 1, Level 2.
   Reads: window.SITE (data/*.json), FLOOR, MESHES, ROOMS, FLOOR_PNG (set in main.js). */
(function(){
"use strict";
/* =====================================================================
   PEOPLE  (example data — on the real site this comes from members.json)
   seat = a workplace id from workplaces.json, e.g. "_2106_ws07" or "office_2221"
   photo = "people/name.jpg"  → the face of the pixel avatar is made from it
   ===================================================================== */
const SITE = window.SITE;
const PUB = Object.fromEntries(SITE.pubs.map(p=>[p.slug,p]));
// everyone who has a desk (seat) in the members list appears in the lab
const MEMBERS = SITE.people.filter(p=>p.seat).map(p=>Object.assign({}, p, {
  papers: (p.papers||[]).slice(0,3).map(s=>({t:PUB[s].title.split(":")[0], v:(PUB[s].venue||"").split(",")[0]+(PUB[s].year?" "+PUB[s].year:""), slug:s}))
}));
const START = {x:44.3, z:20.9};          // Elevator lobby 2201
const PALETTE = {skin:["#F3CFA8","#D9A27A","#B57B55","#8A5A3C","#F6DCC2"], hair:["#2B2233","#5A3A22","#8B5E34","#1B1B1F","#C9903E","#6B4C9A"]};

/* ---------------- setup ---------------- */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(pointer: coarse)").matches;
const $ = id => document.getElementById(id);
const stage=$("stage"), slot=$("slot"), canvas=$("c");
const previewUI=$("previewUI"), labUI=$("labUI"), promptEl=$("prompt"), toastEl=$("toast");
const helpEl=$("help"), joyEl=$("joy"), card=$("card");
$("helpList").innerHTML = isTouch
  ? "<dt>Walk</dt><dd>Tap where you want to go</dd><dt>Turn</dt><dd>Drag with one finger</dd><dt>Talk</dt><dd>Tap a person</dd><dt>Rooms</dt><dd>The Rooms button shows room and desk numbers</dd>"
  : "<dt>Walk</dt><dd>Arrow keys ← ↑ → ↓ (or W A S D), or click where you want to go</dd><dt>Turn</dt><dd>Drag with the mouse (3D view)</dd><dt>Zoom</dt><dd>Mouse wheel</dd><dt>Talk</dt><dd>Click a person</dd><dt>N</dt><dd>Show or hide room and desk numbers</dd>";
$("previewHint").textContent = isTouch ? "Tap to walk around and meet the team" : "Walk around with your keyboard and mouse";

// the changing "O"
(function(){
  const words=["Other cool things","Organisms","Optics","Objects","Observation","Omics","Optical Microscopy"], el=$("oword"); let i=0;
  // measure the title with every word and keep the tallest height, so the page below never moves
  const h1=el.closest("h1");
  const fit=()=>{ const cur=el.textContent; h1.style.minHeight=""; let max=0;
    for(const w of words){ el.textContent=w; max=Math.max(max,h1.getBoundingClientRect().height); }
    el.textContent=cur; h1.style.minHeight=Math.ceil(max)+"px"; };
  fit(); addEventListener("resize",fit); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fit);
  if(reduceMotion) return;
  setInterval(()=>{ el.classList.add("out"); setTimeout(()=>{ i=(i+1)%words.length; el.textContent=words[i]; el.classList.remove("out"); },350); },2600);
})();

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerpAngle(a,b,t){ let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*t; }
function ease(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
function firstName(m){ return m.name.split(" ")[0]; }
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

/* ---------------- renderer + scene ---------------- */
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,0.1,600);
// the 2D map: an orthographic camera straight above the visitor, north (top of the plan) up
const mapCam=new THREE.OrthographicCamera(-10,10,10,-10,1,300); mapCam.up.set(0,0,-1);
let mapZoom=8;                                   // half of the visible height, in metres
function is2D(){ return VIEW==="2d" && mode==="lab"; }
function activeCam(){ return is2D() ? mapCam : camera; }
const hemi=new THREE.HemisphereLight(0xFFFFFF,0x9AA0C0,0.85); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xFFF6E8,0.45); sun.position.set(-40,80,30); scene.add(sun); scene.add(sun.target);
renderer.shadowMap.type=THREE.PCFSoftShadowMap; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:200}); sun.shadow.bias=-0.0008;

// see-through circle: walls and furniture between the camera and you are cut away
function seeThrough(mat){ return mat; }
let groundMesh=null, groundTex=null;
const DARK = matchMedia("(prefers-color-scheme: dark)").matches;
const GROUND = DARK ? {base:"#2E3354",dot:"#363C61",bg:0x262A47} : {base:"#D3D7E6",dot:"#C8CDE0",bg:0xCDD2E3};
scene.background=new THREE.Color(GROUND.bg);
(function(){
  const c=document.createElement("canvas"); c.width=c.height=16; const g=c.getContext("2d");
  g.fillStyle=GROUND.base; g.fillRect(0,0,16,16);
  g.fillStyle=GROUND.dot; g.fillRect(0,0,16,1); g.fillRect(0,0,1,16);
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.LinearMipmapLinearFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(260/2,140/2);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(260,140),new THREE.MeshBasicMaterial({map:t}));
  m.rotation.x=-Math.PI/2; m.position.set(78,-0.12,26); scene.add(m);
  groundMesh=m; groundTex=t;
})();

// floor: the plan drawn as Gather-style pixel tiles (wood, carpet, tiles per room)
const floorImg=new Image();
const floorTex=new THREE.Texture(floorImg);
floorTex.magFilter=THREE.NearestFilter; floorTex.minFilter=THREE.LinearMipmapLinearFilter; floorTex.anisotropy=4;
let FW=156.5625, FH=51.9375;
const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:floorTex,transparent:true,alphaTest:0.5}));
floorMesh.rotation.x=-Math.PI/2; scene.add(floorMesh);

// room numbers: their own see-through layer just above the floor; hidden until the visitor presses N
const labelImg=new Image(), labelTex=new THREE.Texture(labelImg);
labelTex.minFilter=THREE.LinearMipmapLinearFilter; labelTex.anisotropy=4;
const labelMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
labelMesh.rotation.x=-Math.PI/2; labelMesh.position.y=0.01; labelMesh.renderOrder=1; labelMesh.visible=false; scene.add(labelMesh);
labelImg.onload=()=>{ labelTex.needsUpdate=true; };
function toggleRooms(on){ labelMesh.visible = on===undefined ? !labelMesh.visible : on; document.querySelectorAll("[data-rooms]").forEach(b=>b.setAttribute("aria-pressed",String(labelMesh.visible))); toast(labelMesh.visible?"Room and desk numbers shown. Press N to hide them.":"Room and desk numbers hidden"); }

// walls: every CAD wall line becomes a thin block, light sides and a dark top (like Gather walls)
const WALL_H=1.5; let wallMesh=null;
(function(){
  const pos=[],nor=[],col=[], t=0.07, side=[0.93,0.91,0.87], top=[0.21,0.23,0.31];
  function quad(a,b,c,d,n,cl){ for(const p of [a,b,c,a,c,d]){ pos.push(p[0],p[1],p[2]); nor.push(n[0],n[1],n[2]); col.push(cl[0],cl[1],cl[2]); } }
  for(const [x1,z1,x2,z2] of FLOOR.walls){
    const dx=x2-x1, dz=z2-z1, L=Math.hypot(dx,dz); if(L<0.03) continue;
    const ux=dx/L, uz=dz/L, nx=-uz*t, nz=ux*t, h=WALL_H;
    const A=[x1+nx,0,z1+nz], B=[x2+nx,0,z2+nz], C=[x2-nx,0,z2-nz], D=[x1-nx,0,z1-nz];
    const At=[A[0],h,A[2]], Bt=[B[0],h,B[2]], Ct=[C[0],h,C[2]], Dt=[D[0],h,D[2]];
    quad(At,Bt,Ct,Dt,[0,1,0],top);
    quad(A,B,Bt,At,[-uz,0,ux],side);
    quad(C,D,Dt,Ct,[uz,0,-ux],side);
    quad(D,A,At,Dt,[-ux,0,-uz],side);
    quad(B,C,Ct,Bt,[ux,0,uz],side);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  wallMesh=new THREE.Mesh(g,seeThrough(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  scene.add(wallMesh);
})();
function wallColors(side,top){
  const c=wallMesh.geometry.attributes.color, n=c.count;
  for(let v=0; v<n; v++){ const k=(v%30)<6 ? top : side; c.setXYZ(v,k[0],k[1],k[2]); }
  c.needsUpdate=true;
}

// desks, chairs and furniture from the 3D model
function b64(s){ const bin=atob(s), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u.buffer; }
function meshFrom(m,color){
  const p16=new Int16Array(b64(m.p)), p=new Float32Array(p16.length); for(let i=0;i<p.length;i++) p[i]=p16[i]/100;
  const idx=m.i32?new Uint32Array(b64(m.i)):new Uint16Array(b64(m.i));
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(p,3)); g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));
  // dark outlines, like Gather's drawn furniture
  mesh.userData.edges=new THREE.LineSegments(new THREE.EdgesGeometry(g,35),new THREE.LineBasicMaterial({color:0x3A3F66}));
  mesh.add(mesh.userData.edges);
  scene.add(mesh); return mesh;
}
const deskMesh=meshFrom(MESHES.workplaces,"#EBD7B4"); deskMesh.scale.y=0.72;
const furnMesh=meshFrom(MESHES.furniture,"#9AA2CC"); furnMesh.scale.y=0.8;

/* ---------------- collision: circle vs line segments, in a grid ---------------- */
const CELL=2, GRID=new Map();
(function(){
  FLOOR.collide.forEach((s,i)=>{
    const x0=Math.floor((Math.min(s[0],s[2])-0.5)/CELL), x1=Math.floor((Math.max(s[0],s[2])+0.5)/CELL);
    const z0=Math.floor((Math.min(s[1],s[3])-0.5)/CELL), z1=Math.floor((Math.max(s[1],s[3])+0.5)/CELL);
    for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++){ const k=x+","+z; if(!GRID.has(k)) GRID.set(k,[]); GRID.get(k).push(s); }
  });
})();
const R=0.24;
function collide(p){
  for(let it=0;it<3;it++){
    const cx=Math.floor(p.x/CELL), cz=Math.floor(p.z/CELL);
    const list=GRID.get(cx+","+cz); if(!list) continue;
    for(const [x1,z1,x2,z2] of list){
      const dx=x2-x1, dz=z2-z1, l2=dx*dx+dz*dz||1e-9;
      const t=clamp(((p.x-x1)*dx+(p.z-z1)*dz)/l2,0,1), qx=x1+dx*t, qz=z1+dz*t;
      const ex=p.x-qx, ez=p.z-qz, d=Math.hypot(ex,ez);
      if(d<R){ if(d>1e-6){ p.x=qx+ex/d*R; p.z=qz+ez/d*R; } else { p.x+= -dz/Math.sqrt(l2)*R; p.z+= dx/Math.sqrt(l2)*R; } }
    }
  }
  p.x=clamp(p.x,-20,175); p.z=clamp(p.z,-20,70);
}

/* ---------------- pixel avatars (Gather style) ----------------
   Everyone has the same friendly face. People are told apart by their clothes and accessories:
   shirt and trousers colours, a hat (cap, beanie, bucket hat, beret, headphones) and glasses.
   Poses: 0 stand, 1-2 walk, 3 sit, 4-5 sit and wave. */
function hashIdx(s,n){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))|0; return Math.abs(h)%n; }
function shade(hex,k){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
  const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k))); return "#"+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,"0")).join(""); }
const FACE="#FFD87A", OUT="#1D2040", SHOE="#1D2040";
function drawChar(g,o,dir,pose){
  g.clearRect(0,0,16,24);
  const P=(c,x,y,w,h)=>{ g.fillStyle=c; g.fillRect(x,y+dy,w,h); };
  const sit = pose>=3, wave = pose>=4, dy = sit?2:0, PANTS=o.pants||"#34395F", SH=o.shirt, HR=o.hair||"#3A2A20", hs=o.hairStyle||"short";
  // legs
  if(sit){
    if(dir==="side"){ P(OUT,5,15,9,3); P(PANTS,6,15,7,2); P(OUT,11,17,3,5); P(PANTS,12,17,1,3); P(SHOE,11,20,4,2); }
    else if(dir==="front"){ P(OUT,3,15,10,5); P(PANTS,4,15,8,3); P(SHOE,4,18,3,2); P(SHOE,9,18,3,2); }
    else { P(OUT,3,15,10,3); P(PANTS,4,15,8,2); }
  } else if(dir==="side"){
    P(OUT,5,16,6,7); P(PANTS,6,16,4,5); P(SHOE,pose===1?7:pose===2?5:6,21,4,2);
  } else {
    const l1=pose===1?1:0, l2=pose===2?1:0;
    P(OUT,4,16,8,8); P(PANTS,5,16,2,5-l1); P(PANTS,9,16,2,5-l2); P(SHOE,5,21-l1,3,2); P(SHOE,8,21-l2,3,2); P(OUT,7,17,2,6);
  }
  // body and arms
  if(dir==="side"){ P(OUT,4,9,8,9); P(SH,5,10,6,7); P(OUT,7,10,3,7); P(shade(SH,-0.15),8,11,1,4); P(FACE,8,15,1,1); }
  else {
    P(OUT,3,9,10,9); P(SH,4,10,8,7);
    if(dir==="front") P(shade(SH,0.25),7,10,2,2);               // collar
    P(OUT,2,10,3,7); P(SH,3,11,1,4); P(FACE,3,15,1,1);           // left arm
    if(wave && dir==="front"){ const up=pose===4?0:1; P(OUT,12,3+up,3,8); P(SH,13,5+up,1,5); P(FACE,13,4+up,1,1); }
    else { P(OUT,11,10,3,7); P(SH,12,11,1,4); P(FACE,12,15,1,1); }
  }
  // head: round, same friendly face for everybody
  P(OUT,3,0,10,11); g.clearRect(3,dy,1,1); g.clearRect(12,dy,1,1); g.clearRect(3,10+dy,1,1); g.clearRect(12,10+dy,1,1);
  P(FACE,4,1,8,9);
  if(dir==="front"){ P(OUT,6,5,1,2); P(OUT,9,5,1,2); P("#F2A38F",5,7,1,1); P("#F2A38F",10,7,1,1); P(OUT,6,8,1,1); P(OUT,7,9,2,1); P(OUT,9,8,1,1); }
  else if(dir==="side"){ P(OUT,10,5,1,2); P(OUT,10,8,1,1); P("#F2A38F",9,7,1,1); }
  else if(hs==="none"){ P(shade(FACE,-0.08),4,6,8,4); }
  // hair: short, long, curly, bun, or none
  if(hs!=="none"){
    if(dir==="back"){ P(HR,4,1,8,8); if(hs==="long"){ P(OUT,3,8,10,5); P(HR,4,8,8,4); } if(hs==="bun"){ P(OUT,5,0,6,1); P(HR,6,0,4,2); } if(hs==="curly"){ P(HR,3,2,1,5); P(HR,12,2,1,5); } }
    else if(dir==="side"){ P(HR,4,1,8,3); P(HR,4,4,4,4); if(hs==="long") P(HR,4,4,4,8); if(hs==="curly"){ P(HR,3,1,1,4); P(HR,11,1,1,2); } if(hs==="bun") P(HR,4,0,3,2); }
    else { P(HR,4,1,8,3); P(HR,4,4,1,3); P(HR,11,4,1,3);
      if(hs==="long"){ P(OUT,2,3,1,10); P(OUT,13,3,1,10); P(HR,3,3,1,10); P(HR,12,3,1,10); P(HR,4,4,1,6); P(HR,11,4,1,6); }
      if(hs==="curly"){ P(HR,3,1,1,5); P(HR,12,1,1,5); P(HR,5,3,1,1); P(HR,10,3,1,1); }
      if(hs==="bun"){ P(OUT,5,0,6,1); P(HR,6,0,4,2); } }
  }
  // glasses
  const F="#1D2040", L="#CFE2F7";
  if(o.glasses && o.glasses!=="none"){
    if(dir==="front"){
      if(o.glasses==="sun"){ P(F,4,4,8,3); P("#5E6A8A",5,5,1,1); P("#5E6A8A",9,5,1,1); }
      else { P(F,4,4,4,3); P(F,8,4,4,3); P(L,5,5,2,1); P(L,9,5,2,1); P(OUT,6,5,1,1); P(OUT,9,5,1,1);
        if(o.glasses==="round"){ g.clearRect(4,4+dy,1,1); P(FACE,4,4,1,1); P(FACE,11,4,1,1); P(FACE,4,6,1,1); P(FACE,11,6,1,1); } }
    } else if(dir==="side"){ if(o.glasses==="sun") P(F,8,4,4,3); else { P(F,9,4,3,3); P(L,10,5,1,1); P(OUT,10,5,1,1); P(F,6,5,3,1); } }
    else { P(F,3,5,1,1); P(F,12,5,1,1); }
  }
  // hats
  const H=o.hatColor||"#E0823A", HD=shade(H,-0.25), HL=shade(H,0.35);
  switch(o.hat){
    case "cap":
      P(OUT,3,0,10,4); P(H,4,0,8,3); P(HL,7,0,2,1);
      if(dir==="front"){ P(OUT,2,3,12,2); P(HD,3,3,10,1); }
      else if(dir==="side"){ P(OUT,10,2,5,2); P(HD,10,3,4,1); }
      break;
    case "beanie":
      P(OUT,3,0,10,5); P(H,4,0,8,3); P(HL,4,3,8,1); P(OUT,4,4,8,1); P("#FFFFFF",7,0,2,1); break;
    case "bucket":
      P(OUT,4,0,8,3); P(H,5,0,6,2); P(OUT,2,2,12,2); P(HD,3,3,10,1); break;
    case "beret":
      P(OUT,3,0,10,3); P(H,4,0,9,2); P(OUT,7,0,1,1); P(HD,4,2,8,1); break;
    case "headphones":
      P(OUT,4,0,8,1); P(H,5,0,6,1);
      if(dir==="side"){ P(OUT,5,3,4,5); P(H,6,4,2,3); }
      else { P(OUT,1,4,3,5); P(H,2,5,1,3); P(OUT,12,4,3,5); P(H,13,5,1,3); }
      break;
  }
}
const POSES=6;
function makeAvatar(o){
  const frames={};
  ["front","back","side"].forEach(dir=>{
    frames[dir]=[...Array(POSES).keys()].map(f=>{
      const c=document.createElement("canvas"); c.width=32; c.height=48; const g=c.getContext("2d"); g.imageSmoothingEnabled=false;
      g.scale(2,2); drawChar(g,o,dir,f);
      const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; return {tex:t,canvas:c};
    });
  });
  // big version for cards and the team list
  const big=document.createElement("canvas"); big.width=64; big.height=64; const bg=big.getContext("2d");
  bg.imageSmoothingEnabled=false; bg.fillStyle="#DDE0F5"; bg.fillRect(0,0,64,64); bg.drawImage(frames.front[0].canvas,0,0,32,32,8,4,48,48);
  return {frames, img:big.toDataURL()};
}
const SHIRTS=["#5B5FC7","#2A93B8","#1F9A7C","#D9577F","#E0823A","#8A5FD6","#3A9A62","#C2861A"];
// The look is saved per person in people.json as "avatar": {shirt, pants, hair, hairStyle, hat, hatColor, glasses}
function lookFor(m){ const a=m.avatar||{}; return {shirt:a.shirt||m.shirt||SHIRTS[hashIdx(m.id||"x",SHIRTS.length)], pants:a.pants||"#34395F",
  hair:a.hair||"#3A2A20", hairStyle:a.hairStyle||"short",
  hat:a.hat||"none", hatColor:a.hatColor||"#E0823A", glasses:(a.glasses===true?"square":a.glasses)||"none"}; }
function setLook(m,changes){ m.avatar=Object.assign({},m.avatar||{},changes); const look=lookFor(m); m._look0=look; const av=makeAvatar(look);
  if(m._ch){ m._ch.av=av; m._ch.dir=""; } m._img=av.img; if(window.APP) APP.setAvatar(m.id,av.img); if(cardMember===m) $("cardImg").src=av.img; }
function makeTag(text){
  const cv=document.createElement("canvas"), g=cv.getContext("2d"), font='600 40px "DM Sans", system-ui, sans-serif';
  g.font=font; const w=Math.ceil(g.measureText(text).width)+84, h=72; cv.width=w; cv.height=h; g.font=font;
  roundRect(g,2,2,w-4,h-4,16); g.fillStyle="rgba(32,36,71,0.92)"; g.fill();
  g.beginPath(); g.arc(34,h/2,10,0,Math.PI*2); g.fillStyle="#2FBF7A"; g.fill();
  g.fillStyle="#FFFFFF"; g.textBaseline="middle"; g.fillText(text,54,h/2+2);
  const t=new THREE.CanvasTexture(cv); t.minFilter=THREE.LinearFilter;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,sizeAttenuation:false}));
  const sh=0.032; s.scale.set(sh*w/h,sh,1); s.renderOrder=7; s.userData.aspect=w/h; return s;
}
const blobMat=new THREE.MeshBasicMaterial({color:0x101330,transparent:true,opacity:0.22,depthWrite:false});
const blobGeo=new THREE.CircleGeometry(0.28,16);
function makeCharacter(o,label,seated){
  const av=makeAvatar(o);
  const grp=new THREE.Group();
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:av.frames.front[seated?3:0].tex,transparent:true,alphaTest:0.5}));
  sp.center.set(0.5,0); sp.scale.set(0.9,1.35,1); grp.add(sp);
  const blob=new THREE.Mesh(blobGeo,blobMat); blob.rotation.x=-Math.PI/2; blob.position.y=0.02; grp.add(blob);
  const tag=makeTag(label); tag.position.y=seated?1.55:1.68; grp.add(tag);
  scene.add(grp);
  return {grp,sp,tag,av,seated,dir:"front",frame:0,flip:false};
}
// pick front / back / side frame from where the camera is
const _v=new THREE.Vector3();
function poseSprite(ch,facing,frame){
  const fx=Math.sin(facing), fz=Math.cos(facing);
  let dir, flip;
  if(is2D()){ dir = fz<-0.6?"back":fz>0.6?"front":"side"; flip = dir==="side" && fx<0; }
  else {
    _v.subVectors(ch.grp.position,camera.position); const vx=_v.x, vz=_v.z, l=Math.hypot(vx,vz)||1;
    const dot=(fx*vx+fz*vz)/l, cross=(fx*vz-fz*vx)/l;
    dir = dot>0.6?"back":dot<-0.6?"front":"side"; flip = dir==="side" && cross>0;
  }
  if(ch.dir!==dir||ch.frame!==frame){ ch.sp.material.map=ch.av.frames[dir][frame].tex; ch.dir=dir; ch.frame=frame; }
  const sx=Math.abs(ch.sp.scale.x)*(flip?-1:1); ch.sp.scale.x=sx;
}

/* ---------------- members at their desks ---------------- */
const seatsById={}; FLOOR.seats.forEach(s=>seatsById[s.id]=s);
const people=[], clickable=[];
function buildPeople(){
  MEMBERS.forEach(m=>{
    const s=seatsById[m.seat];
    if(!s){ console.warn("No workplace called",m.seat,"for",m.name); return; }
    const look=lookFor(m); m._look0=look;
    const ch=makeCharacter(look,m.name,true);
    ch.grp.position.set(s.sx??s.x,0,s.sz??s.z);
    m._ch=ch; m._face=s.face||0; m._pos=ch.grp.position; m._seat=s; m._img=ch.av.img;
    ch.sp.userData.member=m; clickable.push(ch.sp);
    
    people.push(m);
  });
}

/* ---------------- the visitor ---------------- */
let VIEW="3d";                         // "3d" or "2d" (map seen from above)
const VISITOR_LOOK={shirt:"#2FBF7A",pants:"#34395F",hat:"cap",hatColor:"#5B5FC7",glasses:"none"};
const visitor=makeCharacter(VISITOR_LOOK,"You",false);
const player={pos:new THREE.Vector3(START.x,0,START.z),rot:0,walkT:0,moving:false};
let yaw=Math.PI, pitch=0.95, dist=11;
let lastLook=0, dragging=false;
const keys={}, joy={x:0,y:0};
function updatePlayer(dt){
  let ix=0, iz=0;
  if(keys.KeyW||keys.ArrowUp) iz+=1; if(keys.KeyS||keys.ArrowDown) iz-=1;
  if(keys.KeyA||keys.ArrowLeft) ix-=1; if(keys.KeyD||keys.ArrowRight) ix+=1;
  ix+=joy.x; iz+=joy.y; let len=Math.hypot(ix,iz); if(len>1){ ix/=len; iz/=len; len=1; }
  player.moving=len>0.08;
  if(player.moving && path){ clearPath(); }
  if(!player.moving && path){ followPath(dt); collide(player.pos); return; }
  if(player.moving){
    const my=is2D()?0:yaw, fx=-Math.sin(my), fz=-Math.cos(my), rx=Math.cos(my), rz=-Math.sin(my);
    const dx=rx*ix+fx*iz, dz=rz*ix+fz*iz, sp=(keys.ShiftLeft||keys.ShiftRight)?8:4;
    player.pos.x+=dx*sp*dt; player.pos.z+=dz*sp*dt;
    player.rot=lerpAngle(player.rot,Math.atan2(dx,dz),1-Math.exp(-dt*14));
    player.walkT+=dt*sp*2.2;
    if(!is2D() && !dragging && iz>0.3 && performance.now()-lastLook>900) yaw=lerpAngle(yaw,player.rot+Math.PI,1-Math.exp(-dt*1.2));
  }
  collide(player.pos);
}

/* ---------------- click to walk: A* on a grid made from the walls and furniture ---------------- */
const GS=0.2; let GW=0, GH=0, blocked=null, path=null, pathTalk=null;
function buildWalkGrid(){
  GW=Math.ceil(FW/GS); GH=Math.ceil(FH/GS); blocked=new Uint8Array(GW*GH);
  // outside the building = blocked (from the floor picture's transparent area)
  const c=document.createElement("canvas"); c.width=GW; c.height=GH; const g=c.getContext("2d"); g.drawImage(floorImg,0,0,GW,GH);
  const a=g.getImageData(0,0,GW,GH).data; for(let i=0;i<GW*GH;i++) if(a[i*4+3]<128) blocked[i]=1;
  const rad=0.19, rc=Math.ceil(rad/GS);
  for(const [x1,z1,x2,z2] of FLOOR.collide){
    const L=Math.hypot(x2-x1,z2-z1), n=Math.max(1,Math.ceil(L/(GS*0.5)));
    for(let s=0;s<=n;s++){ const x=x1+(x2-x1)*s/n, z=z1+(z2-z1)*s/n, cx=Math.floor(x/GS), cz=Math.floor(z/GS);
      for(let dz=-rc;dz<=rc;dz++) for(let dx=-rc;dx<=rc;dx++){ const gx=cx+dx, gz=cz+dz; if(gx<0||gz<0||gx>=GW||gz>=GH) continue;
        const px=(gx+0.5)*GS, pz=(gz+0.5)*GS; if((px-x)*(px-x)+(pz-z)*(pz-z)<rad*rad) blocked[gz*GW+gx]=1; } }
  }
}
function cellOf(x,z){ return [clamp(Math.floor(x/GS),0,GW-1), clamp(Math.floor(z/GS),0,GH-1)]; }
function nearestFree(gx,gz,maxR){ if(!blocked[gz*GW+gx]) return [gx,gz];
  for(let r=1;r<=maxR;r++) for(let dz=-r;dz<=r;dz++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
    const x=gx+dx,z=gz+dz; if(x>=0&&z>=0&&x<GW&&z<GH&&!blocked[z*GW+x]) return [x,z]; } return null; }
// Search from where you stand; if the clicked spot can't be reached (inside a desk or a closed room),
// walk to the nearest spot that can be reached.
function findPath(sx,sz,tx,tz){
  const N=GW*GH, par=new Int32Array(N).fill(-2), q=new Int32Array(N); let qh=0, qt=0;
  const s=sz*GW+sx; par[s]=-1; q[qt++]=s;
  let best=s, bestD=1e18;
  while(qh<qt){
    const i=q[qh++], x=i%GW, z=(i/GW)|0, d=(x-tx)*(x-tx)+(z-tz)*(z-tz);
    if(d<bestD){ bestD=d; best=i; if(d===0) break; }
    for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dz) continue; const nx=x+dx, nz=z+dz;
      if(nx<0||nz<0||nx>=GW||nz>=GH) continue; const j2=nz*GW+nx;
      if(blocked[j2]||par[j2]!==-2) continue; if(dx&&dz&&(blocked[z*GW+nx]||blocked[nz*GW+x])) continue;
      par[j2]=i; q[qt++]=j2; }
  }
  if(Math.sqrt(bestD)*GS>4) return null;          // too far from anything we can reach
  const cells=[]; for(let i=best;i!==-1;i=par[i]) cells.push(i); cells.reverse();
  const free=(a,b)=>{ const x0=a%GW,z0=(a/GW)|0, x1=b%GW,z1=(b/GW)|0, n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0))*2||1;
    for(let k=0;k<=n;k++){ const x=Math.round(x0+(x1-x0)*k/n), z=Math.round(z0+(z1-z0)*k/n); if(blocked[z*GW+x]) return false; } return true; };
  const pts=[]; let a=0; while(a<cells.length-1){ let b=cells.length-1; while(b>a+1 && !free(cells[a],cells[b])) b--; pts.push(cells[b]); a=b; }
  return pts.map(i=>new THREE.Vector3((i%GW+0.5)*GS,0,(((i/GW)|0)+0.5)*GS));
}
const marker=new THREE.Mesh(new THREE.RingGeometry(0.22,0.32,28),new THREE.MeshBasicMaterial({color:0x2FBF7A,transparent:true,opacity:0.9,depthWrite:false}));
marker.rotation.x=-Math.PI/2; marker.position.y=0.03; marker.visible=false; scene.add(marker);
function walkTo(x,z,talk){
  if(!blocked) return false;
  const [sx,sz]=cellOf(player.pos.x,player.pos.z), s0=nearestFree(sx,sz,6), [tx,tz]=cellOf(x,z);
  if(!s0){ toast("You can’t walk there"); return false; }
  const p=findPath(s0[0],s0[1],tx,tz); if(!p){ toast("You can’t walk there"); return false; } if(!p.length){ if(talk) openCard(talk); return true; }
  path=p; pathTalk=talk||null; marker.position.x=p[p.length-1].x; marker.position.z=p[p.length-1].z; marker.visible=!talk; return true;
}
const stuckP=new THREE.Vector3(); let stuckT=0;
function clearPath(){ path=null; pathTalk=null; marker.visible=false; stuckT=0; }
function followPath(dt){
  const t=path[0], dx=t.x-player.pos.x, dz=t.z-player.pos.z, d=Math.hypot(dx,dz), sp=4.2;
  if(d<0.12){ path.shift(); if(!path.length){ const m=pathTalk; clearPath(); player.moving=false; if(m){ player.rot=Math.atan2(m._pos.x-player.pos.x,m._pos.z-player.pos.z); openCard(m); } } return; }
  const step=Math.min(d,sp*dt); player.pos.x+=dx/d*step; player.pos.z+=dz/d*step; player.moving=true;
  // give up if something blocks the way for more than a second
  stuckT+=dt; if(stuckT>1.2){ if(Math.hypot(player.pos.x-stuckP.x,player.pos.z-stuckP.z)<0.3){ clearPath(); player.moving=false; return; } stuckT=0; stuckP.copy(player.pos); }
  player.rot=lerpAngle(player.rot,Math.atan2(dx,dz),1-Math.exp(-dt*14)); player.walkT+=dt*sp*2.2;
  marker.material.opacity=0.6+Math.sin(time*6)*0.3;
}

/* ---------------- camera ---------------- */
let mode="preview", trans=0, previewT=0, pendingCard=null, visible=true, time=0;
const prevPos=new THREE.Vector3(), prevLook=new THREE.Vector3(78,0,26), labPos=new THREE.Vector3(), labLook=new THREE.Vector3(), labSmooth=new THREE.Vector3(), curLook=new THREE.Vector3();
function computePreview(dt){
  if(mode==="preview" && !reduceMotion) previewT+=dt;
  const a=Math.sin(previewT*0.1)*0.12, R=128*Math.max(1,Math.pow(1.9/camera.aspect,0.85)), el=1.12;
  prevLook.set(78,0,26);
  prevPos.set(prevLook.x+Math.sin(a)*R*Math.cos(el), R*Math.sin(el), prevLook.z+Math.cos(a)*R*Math.cos(el));
}
const camRay=new THREE.Raycaster(), _cd=new THREE.Vector3();
let camDist=dist;
function computeLab(dt,snap){
  labLook.set(player.pos.x,0.9,player.pos.z);
  if(VIEW==="2d"){ // straight above, at the height that matches the map zoom
    const h=mapZoom/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    labSmooth.set(player.pos.x,h,player.pos.z+0.4); labPos.copy(labSmooth); return; }
  const cp=Math.cos(pitch); _cd.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp);
  // the camera stays at the same distance (walls are low, so from this height they rarely hide you)
  camDist = dist;
  const d=labLook.clone().addScaledVector(_cd,camDist);
  if(snap) labSmooth.copy(d); else labSmooth.lerp(d,1-Math.exp(-dt*12));
  labPos.copy(labSmooth);
}

/* ---------------- people: near, talk, tags ---------------- */
let nearMember=null, cardMember=null;
function updatePeople(dt){
  let best=null, bestD=2.3;
  for(const m of people){
    const d=Math.hypot(player.pos.x-m._pos.x, player.pos.z-m._pos.z);
    if(mode==="lab" && d<bestD){ best=m; bestD=d; }
    // face the visitor when they come close, otherwise face the desk
    const want = (mode==="lab" && d<3) ? Math.atan2(player.pos.x-m._pos.x, player.pos.z-m._pos.z) : m._face;
    m._look = m._look===undefined ? want : lerpAngle(m._look,want,1-Math.exp(-dt*6));
    const waving = mode==="lab" && d<3.2;
    poseSprite(m._ch,m._look, waving ? (Math.floor(time*4)%2?5:4) : 3);
    { const close=is2D()||(mode==="lab"&&d<6); m._ch.sp.material.depthTest=!close; m._ch.sp.renderOrder=close?(is2D()?6:4):0; }
    m._ch.tag.visible = mode==="preview" ? false : (d<18 && m!==best);
  }
  nearMember=best;
  if(cardMember && Math.hypot(player.pos.x-cardMember._pos.x, player.pos.z-cardMember._pos.z)>4) closeCard();
}
function updateVisitor(){
  visitor.grp.position.copy(player.pos);
  const frame = player.moving ? (Math.floor(player.walkT)%2===0?1:2) : 0;
  poseSprite(visitor,player.rot,frame);
  visitor.tag.visible = mode!=="preview";
}

/* ---------------- stage open / close ---------------- */
function expandStage(){
  const r=stage.getBoundingClientRect();
  Object.assign(stage.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});
  stage.classList.add("fixed"); void stage.offsetWidth;
  if(!reduceMotion) stage.classList.add("animating");
  stage.classList.add("is-open");
  Object.assign(stage.style,{left:"0px",top:"0px",width:innerWidth+"px",height:innerHeight+"px"});
  setTimeout(()=>{ stage.classList.remove("animating"); stage.style.width="100%"; stage.style.height="100%"; },reduceMotion?0:720);
}
function collapseStage(){
  Object.assign(stage.style,{width:innerWidth+"px",height:innerHeight+"px"}); void stage.offsetWidth;
  const r=slot.getBoundingClientRect();
  if(!reduceMotion) stage.classList.add("animating");
  stage.classList.remove("is-open");
  Object.assign(stage.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});
  setTimeout(()=>{ stage.classList.remove("animating","fixed"); stage.removeAttribute("style"); },reduceMotion?0:720);
}
let helpTimer=0;
function showHelp(){ helpEl.classList.remove("is-faded"); clearTimeout(helpTimer); helpTimer=setTimeout(()=>helpEl.classList.add("is-faded"),25000); }
$("helpToggle").addEventListener("click",()=>{ if(helpEl.classList.contains("is-faded")) showHelp(); else helpEl.classList.add("is-faded"); });

function enterLab(focus){
  if(mode!=="preview"){ if(mode==="lab" && focus){ placeNear(focus); openCard(focus); } return; }
  if(focus){ slot.scrollIntoView({block:"center"}); placeNear(focus); }
  computeLab(0,true); pendingCard=focus||null;
  expandStage(); document.body.style.overflow="hidden";
  previewUI.hidden=true; labUI.hidden=false; showHelp(); mode="toLab";
}
function exitLab(){
  if(mode!=="lab") return;
  closeCard(); promptEl.hidden=true; joyEnd(); for(const k in keys) keys[k]=false;
  collapseStage(); mode="toPreview";
}
function onArrive(){ if(pendingCard){ openCard(pendingCard); pendingCard=null; } }
function onLeave(){ labUI.hidden=true; previewUI.hidden=false; document.body.style.overflow=""; $("enterBtn").focus({preventScroll:true}); }

// stand next to a person, looking at them
function placeNear(m){
  const s=m._pos; let best=null;
  for(let k=0;k<12;k++){
    const a=m._face+Math.PI+k*Math.PI/6, p=new THREE.Vector3(s.x+Math.sin(a)*1.25,0,s.z+Math.cos(a)*1.25), q=p.clone();
    collide(q); const score=q.distanceTo(p)*4+k*0.03;
    if(!best||score<best.score) best={score,q};
  }
  clearPath(); player.pos.copy(best.q); player.rot=Math.atan2(s.x-best.q.x,s.z-best.q.z); yaw=player.rot+Math.PI+0.5; pitch=0.95; dist=10;
  labSmooth.set(NaN,0,0); computeLab(0,true);
}
function teleport(x,z){ clearPath(); player.pos.set(x,0,z); collide(player.pos); computeLab(0,true); }

/* ---------------- card ---------------- */
function li(text,sub,slug){ const el=document.createElement("li"), a=document.createElement("a"); a.href="#paper-"+slug; a.textContent=text; a.dataset.slug=slug; el.appendChild(a);
  if(sub){ const s=document.createElement("span"); s.textContent=sub; el.appendChild(s); } return el; }
function roomName(n){ const r=ROOMS.find(r=>r.number===n); return r? `${r.name} ${r.number}` : `Room ${n}`; }
function openCard(m){
  cardMember=m;
  $("cardImg").src=m._img; $("cardName").textContent=m.name; $("cardRole").textContent=m.role+" · "+roomName(m._seat.room);
  $("cardResearch").textContent=m.research;
  const set=(id,url)=>{ const a=$(id); a.hidden=!url; if(url) a.href=url; };
  set("aEmail",m.email?"mailto:"+m.email:""); set("aChat",m.chat||""); set("aWeb",m.web||""); set("aScholar",m.scholar||"");
  const P=$("cardPapers"); P.innerHTML="";
  m.papers.forEach(p=>P.appendChild(li(p.t,p.v,p.slug)));
  $("cardPapersH").hidden=!m.papers.length; $("aAll").href="#by-"+m.id; $("aAll").hidden=!m.papers.length;
  card.hidden=false; promptEl.hidden=true; card.focus({preventScroll:true});
}
function closeCard(){ if(!cardMember) return; card.hidden=true; cardMember=null; canvas.focus({preventScroll:true}); }
$("cardClose").addEventListener("click",closeCard);
card.addEventListener("click",e=>{ const a=e.target.closest("a"); if(!a) return;
  const h=a.getAttribute("href")||""; if(h.startsWith("#")){ e.preventDefault(); exitLab(); setTimeout(()=>{ location.hash=h; },reduceMotion?0:760); } });
// setLook(m,{hairStyle:"curly",hat:"cap",glasses:"round"}) changes an avatar; the admin side uses it.
card.addEventListener("keydown",e=>{ if(e.code==="Escape"){ e.stopPropagation(); closeCard(); } });
let toastTimer=0;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.classList.remove("show"),2600); }

const proj=new THREE.Vector3(), _vd=new THREE.Vector3();
function viewDepth(x,y,z){ return -_vd.set(x,y,z).applyMatrix4(camera.matrixWorldInverse).z; }
function updatePrompt(){
  if(mode!=="lab"||!nearMember||cardMember){ promptEl.hidden=true; return; }
  proj.set(nearMember._pos.x,is2D()?0:1.72,nearMember._pos.z).project(activeCam());
  if(proj.z>1){ promptEl.hidden=true; return; }
  const w=canvas.clientWidth,h=canvas.clientHeight;
  promptEl.style.transform=`translate(${(proj.x+1)/2*w}px,${(1-proj.y)/2*h}px) translate(-50%,-100%)`;
  if(promptEl.dataset.who!==nearMember.id){ promptEl.innerHTML=(isTouch?"":"<kbd>E</kbd>")+(isTouch?"Tap to talk to ":"Talk to ")+firstName(nearMember); promptEl.dataset.who=nearMember.id; }
  promptEl.hidden=false;
}
promptEl.addEventListener("click",()=>{ if(nearMember) openCard(nearMember); });

/* ---------------- go to + minimap ---------------- */
function fillGoto(){
  const dl=$("gotoList"); const opts=[];
  people.forEach(m=>opts.push(m.name));
  ROOMS.forEach(r=>opts.push(`${r.number} ${r.name}`));
  dl.innerHTML=opts.map(o=>`<option value="${o.replace(/"/g,"&quot;")}"></option>`).join("");
}
function gotoValue(v){
  v=v.trim(); if(!v) return;
  const m=people.find(p=>p.name.toLowerCase()===v.toLowerCase()) || people.find(p=>p.name.toLowerCase().includes(v.toLowerCase()));
  if(m){ placeNear(m); toast("You are next to "+m.name); return true; }
  const num=(v.match(/\d{4}/)||[])[0];
  const r=ROOMS.find(r=>r.number===num) || ROOMS.find(r=>r.name.toLowerCase()===v.toLowerCase());
  if(r){ teleport(r.x,r.z); toast(`${r.name} ${r.number}`); return true; }
  toast("No person or room found for “"+v+"”"); return false;
}
$("gotoInput").addEventListener("change",e=>{ if(gotoValue(e.target.value)){ e.target.value=""; e.target.blur(); } });
$("gotoInput").addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter"&&gotoValue(e.target.value)){ e.target.value=""; e.target.blur(); } });

const mini=$("mini"), mg=mini.getContext("2d"); let miniBase=null;
function buildMini(){
  miniBase=document.createElement("canvas"); miniBase.width=mini.width; miniBase.height=mini.height;
  const g=miniBase.getContext("2d"); g.fillStyle=DARK?"#2E3354":"#D3D7E6"; g.fillRect(0,0,mini.width,mini.height);
  g.imageSmoothingEnabled=true; g.drawImage(floorImg,0,0,mini.width,mini.height);
}
function drawMini(){
  if(!miniBase) return;
  mg.drawImage(miniBase,0,0); const sx=mini.width/FW, sz=mini.height/FH;
  mg.fillStyle="#5B5FC7"; people.forEach(m=>{ mg.fillRect(m._pos.x*sx-3,m._pos.z*sz-3,6,6); });
  const px=player.pos.x*sx, pz=player.pos.z*sz;
  mg.fillStyle="#FFFFFF"; mg.beginPath(); mg.arc(px,pz,7,0,Math.PI*2); mg.fill();
  mg.fillStyle="#2FBF7A"; mg.beginPath(); mg.arc(px,pz,5,0,Math.PI*2); mg.fill();
  // view direction
  if(!is2D()){ mg.strokeStyle="#FFFFFF"; mg.lineWidth=3; mg.beginPath(); mg.moveTo(px,pz); mg.lineTo(px-Math.sin(yaw)*14,pz-Math.cos(yaw)*14); mg.stroke(); }
}
mini.addEventListener("click",e=>{
  const r=mini.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*FW, z=(e.clientY-r.top)/r.height*FH;
  teleport(x,z);
});

/* ---------------- input ---------------- */
$("enterBtn").addEventListener("click",()=>enterLab());
$("exitBtn").addEventListener("click",exitLab);
canvas.tabIndex=-1;
window.addEventListener("keydown",e=>{
  if(mode!=="lab") return;
  if(e.target && e.target.tagName==="INPUT") return;
  if(e.code==="Escape"){ if(cardMember) closeCard(); else exitLab(); return; }
  if(e.code==="KeyN"){ toggleRooms(); return; }
  if(e.code==="KeyE"){ if(nearMember){ openCard(nearMember); return; } if(cardMember){ closeCard(); return; } }
  keys[e.code]=true;
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup",e=>{ keys[e.code]=false; });
window.addEventListener("blur",()=>{ for(const k in keys) keys[k]=false; });
canvas.addEventListener("wheel",e=>{ if(mode!=="lab") return; e.preventDefault(); const k=1+Math.sign(e.deltaY)*0.1;
  if(VIEW==="2d") mapZoom=clamp(mapZoom*k,4,45); else dist=clamp(dist*k,3,48); },{passive:false});

let joyId=null, joyO=null, lookId=null, lookLast=null, downAt=null;
function joyEnd(){ joyId=null; joy.x=joy.y=0; joyEl.hidden=true; }
const clickRay=new THREE.Raycaster(), ndc=new THREE.Vector2();
canvas.addEventListener("pointerdown",e=>{
  if(mode==="preview"){ downAt={x:e.clientX,y:e.clientY}; return; }
  if(mode!=="lab") return;
  canvas.setPointerCapture(e.pointerId);
  const r=canvas.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  downAt={x:e.clientX,y:e.clientY,t:performance.now()};
  if(false){ // (on-screen joystick switched off: on phones you tap to walk and drag to turn)
    joyId=e.pointerId; joyO={x:e.clientX,y:e.clientY}; joyEl.style.left=x+"px"; joyEl.style.top=y+"px"; joyEl.firstElementChild.style.transform=""; joyEl.hidden=false;
  } else if(lookId===null){ lookId=e.pointerId; lookLast={x:e.clientX,y:e.clientY}; dragging=true; }
});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerId===joyId){
    let dx=e.clientX-joyO.x, dy=e.clientY-joyO.y; const l=Math.hypot(dx,dy), RR=52; if(l>RR){ dx*=RR/l; dy*=RR/l; }
    joy.x=dx/RR; joy.y=-dy/RR; joyEl.firstElementChild.style.transform=`translate(${dx}px,${dy}px)`;
  } else if(e.pointerId===lookId){
    const dx=e.clientX-lookLast.x, dy=e.clientY-lookLast.y; lookLast={x:e.clientX,y:e.clientY};
    if(!is2D()){ yaw-=dx*(e.pointerType==="touch"?0.008:0.006); pitch=clamp(pitch+dy*0.004,0.55,1.4); lastLook=performance.now(); }
  }
});
canvas.addEventListener("pointerup",e=>{
  if(mode==="preview"){ if(downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<8) enterLab(); downAt=null; return; }
  if(e.pointerId===joyId) joyEnd();
  if(e.pointerId===lookId){ lookId=null; dragging=false; if(downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<7&&performance.now()-downAt.t<500) handleTap(e); }
  downAt=null;
});
canvas.addEventListener("pointercancel",e=>{ if(e.pointerId===joyId) joyEnd(); if(e.pointerId===lookId){ lookId=null; dragging=false; } });
function handleTap(e){
  const r=canvas.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  clickRay.setFromCamera(ndc,activeCam());
  const shown=o=>{ for(let x=o;x;x=x.parent){ if(!x.visible) return false; } return true; };
  const hit=clickRay.intersectObjects(clickable.filter(shown),false)[0];
  if(hit){ const m=hit.object.userData.member, d=Math.hypot(player.pos.x-m._pos.x,player.pos.z-m._pos.z);
    if(d<2.4){ openCard(m); return; }
    // walk to the person, then open their card
    const a=m._face+Math.PI, tx=m._pos.x+Math.sin(a)*1.0, tz=m._pos.z+Math.cos(a)*1.0; walkTo(tx,tz,m); return; }
  // click on the floor: walk there
  const t=clickRay.ray.direction.y<-0.01 ? -clickRay.ray.origin.y/clickRay.ray.direction.y : -1;
  if(t>0){ const x=clickRay.ray.origin.x+clickRay.ray.direction.x*t, z=clickRay.ray.origin.z+clickRay.ray.direction.z*t; closeCard(); walkTo(x,z); }
}

let framesRendered=0;
window.LAB={ state:()=>({x:player.pos.x,z:player.pos.z,yaw,pitch,mode,path:path?path.length:0,grid:!!blocked}), walkTo:(x,z)=>walkTo(x,z), setLook:(id,c)=>{ const m=people.find(p=>p.id===id); if(m) setLook(m,c); }, enter:id=>{ const m=people.find(p=>p.id===id); if(!m) return; const go=()=>{ if(framesRendered<3){ setTimeout(go,60); return; } enterLab(m); }; go(); }, avatar:o=>makeAvatar(Object.assign({shirt:"#5B5FC7"},o)).img, lookFor };

/* ---------------- loop ---------------- */
let lastW=0,lastH=0;
function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w&&h&&(w!==lastW||h!==lastH)){ renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov=camera.aspect<1?54:40; camera.updateProjectionMatrix(); lastW=w; lastH=h; }
}
new IntersectionObserver(es=>{ visible=es[0].isIntersecting; }).observe(slot);
const clock=new THREE.Clock(); let miniT=0;
function tick(){
  requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),0.05);
  if(mode==="preview"&&(!visible||document.hidden)) return;
  time+=dt; resize();
  if(mode==="lab") updatePlayer(dt);
  computePreview(dt); computeLab(dt,mode!=="lab");
  if(mode==="preview"){ camera.position.copy(prevPos); curLook.copy(prevLook); }
  else if(mode==="lab"){ camera.position.copy(labPos); curLook.copy(labLook); }
  else{
    const dur=reduceMotion?0.001:1.5; trans=mode==="toLab"?Math.min(1,trans+dt/dur):Math.max(0,trans-dt/dur);
    const e=ease(trans); camera.position.lerpVectors(prevPos,labPos,e); curLook.lerpVectors(prevLook,labLook,e);
    if(mode==="toLab"&&trans>=1){ mode="lab"; onArrive(); } else if(mode==="toPreview"&&trans<=0){ mode="preview"; onLeave(); }
  }
  camera.lookAt(curLook);
  { const dd=camera.position.distanceTo(curLook), nn=clamp(dd*0.04,0.1,6); if(Math.abs(camera.near-nn)>0.01){ camera.near=nn; camera.updateProjectionMatrix(); }
    deskMesh.userData.edges.visible=furnMesh.userData.edges.visible = is2D() || dd<45; }
  camera.updateMatrixWorld();
  if(is2D()){ const a=lastW/lastH||1; mapCam.left=-mapZoom*a; mapCam.right=mapZoom*a; mapCam.top=mapZoom; mapCam.bottom=-mapZoom; mapCam.updateProjectionMatrix();
    mapCam.position.set(player.pos.x,120,player.pos.z); mapCam.lookAt(player.pos.x,0,player.pos.z); mapCam.updateMatrixWorld(); }
  applyViewToCharacters();
  updateVisitor(); updatePeople(dt);
  updatePrompt();
  if(mode!=="preview"&&(miniT+=dt)>0.08){ miniT=0; drawMini(); }
  renderer.render(scene,activeCam()); framesRendered++;
}

/* ---------------- view: "3d" (walking camera) or "2d" (map from above, like Gather) ---------------- */
let charsIn2D=null;
function applyViewToCharacters(){
  const flat=is2D(); if(charsIn2D===flat) return; charsIn2D=flat;
  [visitor,...people.map(m=>m._ch)].forEach(ch=>{ if(!ch) return;
    // seen from above, people and names are drawn on top of the desks
    ch.sp.material.depthTest=!flat; ch.sp.renderOrder=flat?6:0; ch.tag.material.depthTest=!flat;
    const a=ch.tag.userData.aspect; if(flat) ch.tag.scale.set(0.42*a,0.42,1); else ch.tag.scale.set(0.032*a,0.032,1);
    ch.tag.position.y = flat ? 0 : (ch.seated?1.55:1.68); ch.tag.center.set(0.5, flat?-3.6:0.5); });
}
function setView(v){
  VIEW = v==="2d" ? "2d" : "3d";
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===VIEW)));
  computeLab(0,true);
  try{ localStorage.setItem("violab-floor-view",VIEW); }catch(e){}
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",e=>{ e.stopPropagation(); setView(b.dataset.view); }));
document.querySelectorAll("[data-rooms]").forEach(b=>b.addEventListener("click",()=>toggleRooms()));

function start(){
  FW=floorImg.width/16; FH=floorImg.height/16;
  floorMesh.scale.set(FW,FH,1); floorMesh.position.set(FW/2,0,FH/2); floorTex.needsUpdate=true;
  labelMesh.scale.set(FW,FH,1); labelMesh.position.set(FW/2,0.01,FH/2); labelImg.src=FLOOR_LABELS;
  buildPeople(); fillGoto(); buildMini(); buildWalkGrid(); if(window.APP) APP.labReady(people);
  let saved="3d"; try{ saved=localStorage.getItem("violab-floor-view")||"3d"; }catch(e){}
  setView(saved);
  player.rot=0; yaw=Math.PI;
  $("loading").remove(); tick();
}
floorImg.onload=()=>{
  const fonts = document.fonts&&document.fonts.load ? Promise.all([document.fonts.load('600 40px "DM Sans"')]) : Promise.resolve();
  Promise.race([fonts,new Promise(r=>setTimeout(r,1200))]).then(start,start);
};
floorImg.src=FLOOR_PNG;
})();
