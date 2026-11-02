/* VIOLAB: loads the data files, then starts the 3D lab and the pages.
   To change content, edit the JSON files in /data — no code changes needed. */
(async function(){
  const get = p => fetch(p).then(r => { if(!r.ok) throw new Error(p+" "+r.status); return r.json(); });
  try{
    const [papers, people, news, topics, software, positions, floor, furniture, rooms] = await Promise.all([
      get("data/papers.json"), get("data/people.json"), get("data/news.json"), get("data/topics.json"),
      get("data/software.json"), get("data/positions.json"), get("floor/floor.json"), get("floor/furniture.json"), get("floor/rooms.json")]);
    window.SITE = { pubs: papers, people, news, topics, positions,
      software: software.filter(s => ["Application","Code","GitHub"].includes(s.kind)),
      models:   software.filter(s => ["Mesoscale model","Dataset"].includes(s.kind)) };
    // image fields in the JSON are plain paths, e.g. "images/papers/DiffFit.jpg"
    window.IMAGES = new Proxy({}, { get: (t, k) => (typeof k === "string" && k) ? (t[k] || k) : undefined });
    window.FLOOR = floor; window.MESHES = furniture; window.ROOMS = rooms; window.FLOOR_PNG = "floor/floor.png"; window.FLOOR_LABELS = "floor/labels.png";
  } catch(e){
    document.getElementById("main").insertAdjacentHTML("afterbegin",
      '<p class="wrap" style="padding:24px;color:#b00">Could not load the site data ('+e.message+'). If you opened index.html directly, start a local server instead (see README.md).</p>');
    return;
  }
  const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
  await load("assets/js/lab.js");
  await load("assets/js/app.js");
  await load("assets/js/admin.js");
})();
