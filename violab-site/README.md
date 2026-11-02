# VIOLAB website

The website of VIOLAB (Visual Intelligence and Other-cool-things Lab), KAUST.
It is a static site: plain HTML, CSS and JavaScript, with all content in JSON files.
It runs on GitHub Pages at **violab.science** (the `CNAME` file sets the address).

## The folders

| Path | What is inside |
|---|---|
| `index.html` | The page itself (header, the 3D box, the empty page sections) |
| `assets/css/site.css` | All the styles |
| `assets/js/main.js` | Loads the data files, then starts the 3D lab and the pages |
| `assets/js/app.js` | The pages: Home, Publications, paper pages, Software & Data, People, News, Join us |
| `assets/js/lab.js` | The 3D floor: walking, camera, avatars, cards, minimap |
| `assets/js/admin.js` | The admin tools (edit buttons, forms, PDF reading, preview, saving to GitHub, sharing on X) |
| `assets/vendor/three.min.js` | three.js r128 (MIT license, file next to it) |
| `data/` | **All the content. Edit these files to change the site.** |
| `images/papers/`, `images/software/` | Images used by papers, news and software |
| `download/` | **Copy the big files of the old site here** (programs, models, videos, posters). Links use `download/<file>` |
| `floor/` | The Building 1, Level 2 floor: the floor texture (`floor.png`), room and desk numbers (`labels.png`), walls, desks, furniture, rooms, workplaces |
| `tools/floor/` | Scripts that made the floor files from the plan (only needed to rebuild the floor) |

## How to see the site on your computer

The site reads JSON files, so a browser cannot open `index.html` directly.
Start a small local server in this folder:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## How to change content

You only edit files in `data/`. After saving, reload the page.

In the examples below, the `// ...` notes only explain the fields. Do not put them in the real JSON files.

### Add a paper — `data/papers.json`

Copy one paper block and change it. The newest papers go at the top.

```json
{
  "slug": "my-paper",                    // short unique name, used in the link #paper-my-paper
  "title": "My Paper: A Great Idea",
  "year": "2026",
  "preprint": false,                     // true for arXiv preprints
  "venue": "IEEE Transactions on Visualization and Computer Graphics (TVCG), 2026",
  "authors": [ {"name": "Ivan Viola", "url": "https://cemse.kaust.edu.sa/profiles/ivan-viola"} ],
  "brief": "One or two sentences shown in the list.",
  "abstract": "The full abstract, shown on the paper page.",
  "image": "images/papers/my-paper.jpg",
  "links": [
    {"kind": "Paper", "url": "https://doi.org/..."},
    {"kind": "PDF",   "url": "https://.../paper.pdf"},
    {"kind": "Code",  "url": "https://github.com/nanovis/..."},
    {"kind": "Data",  "url": "https://osf.io/..."},
    {"kind": "Video", "url": "https://youtu.be/..."}
  ],
  "bibtex": "@article{...}",
  "doi": "10.1109/TVCG.2026.xxxxx",
  "topic": "xr",                         // a research field id from data/topics.json
  "award": "Best Paper Award"            // optional
}
```

Link `kind` can be: `Paper`, `PDF`, `arXiv`, `Code` (shown as GitHub), `Software`, `Data`, `Supplementary`, `Poster`, `Video`, `Project page`.
A link can also point to a file in the site's own folder, for example `"url": "download/LoXR_Poster.pdf"`.

### Research fields — `data/topics.json`

Each field has an `id`, a `name` and a short `text`. Papers use the `id` in their `topic`.

### Add or move a person — `data/people.json`

```json
{
  "id": "dilara",                        // short unique name
  "name": "Full Name",
  "role": "Ph.D. Student, Computer Science",
  "group": "Students",                   // Principal Investigators, Research Scientists, Postdoctoral Fellows, Students, Visiting Scholars or Alumni
  "email": "name@kaust.edu.sa",          // optional
  "web": "https://...",
  "scholar": "https://scholar.google.com/...",
  "research": "Their research fields, as on the KAUST profile page.",
  "seat": "_2106_ws07",                  // their desk, from floor/workplaces.json (or "office_2115")
  "papers": ["difffit", "voice"],        // slugs of their papers
  "avatar": {                            // how their pixel avatar looks (all optional)
    "hairStyle": "long", "hair": "#3A2A20",
    "shirt": "#5B5FC7", "pants": "#34395F",
    "hat": "none", "hatColor": "#E0823A", "glasses": "round"
  }
}
```

- To move someone to the past members, change `group` to `"Alumni"` and remove `seat`.
- A person with a `seat` appears at that desk in the 3D lab.
- Everyone has the same friendly face; avatars differ by hair, clothes and accessories.
- `hairStyle` can be `short`, `long`, `curly`, `bun` or `none`.
- `hat` can be `none`, `cap`, `beanie`, `bucket`, `beret` or `headphones`. `glasses` can be `none`, `square`, `round` or `sun`.

### Desks

`floor/workplaces.json` lists all 122 workplaces on the floor with their `id` and `room`.
Desks in open offices look like `_2106_ws07` (room 2106, workstation 7). Single offices look like `office_2115`.

### News — `data/news.json`

```json
{ "title": "DiffFit is published in IEEE TVCG", "date": "2024",
  "text": "Short text.", "images": ["images/papers/DiffFit.jpg"], "paper": "difffit" }
```

`paper` is optional. When it is set, the news item gets a "Read the paper" button.

### Open positions — `data/positions.json`

```json
{ "mode": "specific",                    // "closed", "general" or "specific"
  "positions": [ { "title": "PhD student in neural rendering", "deadline": "31 January 2027",
                   "text": "Description...", "apply": "ivan.viola@kaust.edu.sa or a link" } ] }
```

- `closed`: the Join us page says there are no open positions.
- `general`: the general invitation for MS and PhD students, postdocs and research scientists.
- `specific`: the positions in the list. The admin can also change this with the **Edit** button on the Join us page.

### Software and data — `data/software.json`

Each item has a `kind`: `Application`, `Code` or `Mesoscale model`,
plus `title`, `text`, `image` and `links` (`label` + `url`).

## Admin

Press **Shift + P** on any page (on a phone, open `violab.science/#admin`). There is no visible admin link.

1. **Log in once** with a GitHub token:
   GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   Choose **only the website repository**, and under *Repository permissions* set **Contents** to **Read and write**.
   Paste the token, the repository name (for example `kaust-violab/kaust-violab.github.io`) and the branch (`master`).
   The token is kept only in that browser. Never put it in the code.
2. Now **Edit / Remove** buttons appear on every person, paper and news item, and **+ Add** buttons on the People,
   Publications and News pages.
   - **People:** name, role, group (choose *Alumni* to move someone to past members), desk on the floor, links and avatar.
   - **Papers:** upload the PDF. The title, authors, abstract, DOI, venue and year are read from it.
     Check them, add the GitHub/PDF/data/video links and a teaser image, then **Preview** shows the real paper page
     and how it looks in the list. **Publish** saves it, and can also add a news item.
   - **News:** title, date, text and an image (you can paste an image into the text box), with a preview.
   - **Join us:** choose *no open positions*, *general invitation* or *specific positions*, and add or remove positions.
3. **Sharing on X:** before publishing a paper or news item, tick *Also share it on X as @violab_science*.
   X opens in a new tab with the text ready. Make sure you are logged in as @violab_science there, then click **Post**.
4. Every save is a **commit** in the repository, so any change can be undone in GitHub's history.
   The live site updates about a minute later.

**Try without saving** lets anyone test the tools. Nothing is saved on the website. The button *Download my changes* gives you the changed JSON files, which you can put in the `data/` folder by hand.

## Publish

Push this folder to the `nanovis/nanovis.github.io` repository (the old site there should be
kept in a branch or another folder first). GitHub Pages serves it at violab.science.
The old site's `download/` folder (big files like MesoCraft) is linked from here, so keep it in the repo.

## The 3D floor

- Visitors walk by clicking the floor (the path goes around walls and desks), or with W A S D. Dragging turns the camera.
- Clicking a person walks to them and opens their card.
- Room numbers are hidden. Visitors press **N** (or the Rooms button on phones) to show them, together with the desk numbers (ws01, ws19 …) from `workplaces.json`.
- The **3D / 2D map** switch changes the view. The 2D map is seen from straight above, like Gather. The choice is remembered in the browser.
- The walls and desks come from the official plan (`floor/floor.json`), so they match the real building.

## Notes

- The building plan comes from KAUST's space system. Ask C&C or Security before the site is public.
- Page links use `#` (for example `#paper-difffit`). Later, the admin tool will also make a real page
  per paper, so links shared on X and Bluesky show a preview card.
