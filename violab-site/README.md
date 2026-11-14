# VIOLAB website

There is no framework and no build step. It's plain HTML, CSS and JavaScript, and all the content
(papers, people, news, positions, software) lives in JSON files under `data/`

## What's where

- `index.html` – the page shell
- `assets/css/site.css` - styles
- `assets/js/main.js` - loads the data, then starts everything else
- `assets/js/app.js` - the pages (home, publications, paper pages, software, people, news, join us)
- `assets/js/lab.js` - the walkable floor (map/3D view, avatars, labs, posters, minimap)
- `assets/js/admin.js` – admin tools for editing the site from the browser
- `data/` – all the content
- `images/` - pictures for papers, news and software
- `download/` - big files from the old site (MesoCraft, models, videos, posters)
- `floor/` - the Building 1, Level 2 floor: texture, room labels, walls, desks, rooms
- `tools/floor/` - the floor files from the official plan

## Running it locally

Browsers won't load the JSON files if you just double-click `index.html`, so start a small server in the folder:

```
python3 -m http.server 8000
```

and open http://localhost:8000.

## Editing content

Most of the time you don't need to touch the JSON at all: press **Shift + P** on the site and use the admin tools
If you do edit by hand, these are the files:

**`data/papers.json`** – one entry per paper, newest first. The important fields:

```json
{
  "slug": "difffit",
  "title": "DiffFit: Visually-Guided Differentiable Fitting of Molecule Structures to a Cryo-EM Map",
  "year": "2024",
  "preprint": false,
  "venue": "IEEE TVCG, 2024",
  "authors": [{ "name": "First person" }, { "name": "second person" }],
  "brief": "One or two sentences for the list.",
  "abstract": "Full abstract for the paper page.",
  "image": "images/papers/DiffFit.jpg",
  "links": [{ "kind": "Paper", "url": "https://doi.org/..." }, { "kind": "Code", "url": "https://github.com/..." }],
  "doi": "10.1109/...",
  "topic": "cryo"
}
```

The `slug` is used in the paper's link (`#paper-difffit`). `topic` is one of the field ids from `data/topics.json`:
`conv`, `recon`, `meso`, `scale` or `cryo`. A paper with a topic also gets a poster in that field's lab on the floor
Link kinds we use: Paper, PDF, arXiv, Code, Software, Data, Supplementary, Poster, Video, Project page

**`data/people.json`** – members and alumni. `group` decides the section on the People page
(Principal Investigators, Research Scientists, Postdoctoral Fellows, Students, Visiting Scholars, Alumni)
`seat` is the person's desk, taken from `floor/workplaces.json` (for example `_2106_ws19` or `office_2124`)
Anyone with a seat shows up at their desk on the floor. The optional `avatar` sets shirt, trousers, hat, hat color and glasses

**`data/news.json`** – title, date, text, images, and optionally the `slug` of a paper it's about

**`data/positions.json`** – what the Join us page shows: `closed`, `general`, or `specific` with a list of positions

**`data/software.json`** – apps, code and mesoscale models. Items with `"featured": true` are shown first; the rest are folded under "Smaller projects"

**`data/labs.json`** - field labs

## The floor

The home page has a walkable version of our floor in Building 1, Level 2, built from the official plan.
By default it shows a map from above, and the camera moves in when you open a person, a poster or a model.
Visitors can also switch to a full 3D view or a flat 2D map. Five rooms are turned into field labs with paper
posters on the walls, and the lobby has boards with the latest news and open positions.

## Notes
- Pages use `#` links (`#people`, `#paper-difffit`), so sharing a paper link shows the general site preview, not the paper's own image
