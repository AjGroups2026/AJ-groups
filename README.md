# AJ GROUPS websites

Static site (plain HTML, CSS, JavaScript). No build step.

| Folder | What it is |
|---|---|
| `/` | Opens the AJ GROUPS page |
| `/` (`index.html`) | The group page, served at the domain root: ventures, about, vision, contact. `aj-groups/` is only a redirect to it |
| `alven/` | Alven Studio |
| `fovo/` | House of Fovo (`draft-mac/` is an unused earlier version) |
| `bunbun/` | Bun Bun Bakes. Menu and prices are in `bunbun/menu.js` |
| `clothing/` | Atelier (not linked yet, hidden from search) |
| `assets/` | Shared scripts (`motion.js`, `vt.js`, `vt.css`) and images |
| `tools/` | Helper scripts (`prep_photos.py` prepares menu photos) |

## Run it locally
```bash
python -m http.server 5173
```
Then open http://localhost:5173.

## Notes
- Forms are demos until a form service is connected.
- Older drafts (3D prototypes and the first version of the home page) were moved out of the public site into `AJ-Groups-Drafts` next to this folder.
