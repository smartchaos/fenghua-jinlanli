# CSS Inventory + Dark-Mode Assessment — /Users/leerobbin/game/spax

Generated read-only. No pre-existing project file was modified.

## Method notes / caveats

- `bash` was unavailable (pi permission system: "rule '*' requires approval, no interactive UI"), so the
  prescribed `find ... -prune` command could not be run. Equivalent enumeration used the native `find`/`ls`/`grep`
  tools plus a full recursive manifest (`find **/*`) and a dot-file pass (`find **/.*`).
- Native `find`/`grep` honour `.gitignore`. A separate literal pattern check for `*.css`, `*.{scss,sass,less,styl,pcss}`,
  and `*.CSS` all returned "No files found matching pattern".
- Hidden directories: the dot-file glob returned zero hits and the full manifest shows no dot-directories at all
  (no `.github`, no `.vscode`; `scripts/__pycache__/` is the only hidden-style dir and holds only `parse.cpython-313.pyc`).
  So nothing theme-related is hiding in a dot-dir.
- Symlinks / duplicate paths: none observed in the manifest. Empty items: `shots/` was empty before this report was written.
- No `<link rel="stylesheet">`, no `@import`, no CDN/font CSS request anywhere (grep for
  `<link|rel="stylesheet"|@import|cdn.|unpkg|jsdelivr|fonts.googleapis` → no matches). Only local script links exist.
- No build tooling that could generate CSS: no `package.json`, `tailwind.config*`, `postcss.config*`, `*.config.js`
  (glob → no files). `vendor/` contains only `three.min.js` and `OrbitControls.min.js`.

## A. Stylesheet inventory (all extensions)

| path | lines | bytes | dark-mode rules? | mechanism |
|---|---|---|---|---|
| *(none)* | — | — | — | — |

**Zero `.css`, `.scss`, `.sass`, `.less` (also `.styl`, `.pcss`) files exist in the repo outside
node_modules/.git/dist/build/coverage.** All styling lives in inline `<style>` blocks inside the three HTML pages.

### Actual repo file manifest (non-excluded)

| path | kind | relevance |
|---|---|---|
| index.html | HTML page, 821 lines | inline `<style>` L7–L134 |
| model.html | HTML page, 858 lines | inline `<style>` L7–L169 — **only theme code in repo** |
| report.html | HTML page, 346 lines | inline `<style>` L7–L150 |
| data/app-data.js | JS data | no colors/theme (grep for `theme\|dark\|light\|color\|#hex` → no matches) |
| data/members.csv, data/owners.csv, data/unresolved.csv, data/stats.json | data | n/a |
| data/raw/dense_00..24.txt | raw text | n/a |
| scripts/check-model.mjs, parse.py, validate-layout.mjs | tooling | no CSS refs (grep `\.css\|stylesheet\|tailwind\|sass\|scss\|lessc` → no matches) |
| vendor/three.min.js, vendor/OrbitControls.min.js | 3D lib | n/a |
| ref/plan1.png, plan2.jpg, plan2_bottom.png, plan2_top.png | images | n/a |

## B. Per-file evidence (inline stylesheets, since no .css files exist)

### B1. index.html — style block L7–L134 — NO theme rules

Grep of the whole file for `day|Day|theme|Theme|body.classList|documentElement|matchMedia|localStorage|setAttribute`
→ **No matches found**. Buttons are only tour/reset/report link (L153–L155):
```
153: <button class="btn" id="tour">…
154: <button class="btn" id="reset">…
155: <a class="btn" href="report.html">统计报表</a>
```
There is no theme toggle and no alternate palette. The single palette is hardcoded dark:
```
  8: :root{
  9:   --bg:#070b12; --text:#edf2f9; --muted:#93a0b3; --faint:#5f6c7e;
 10:   --amber:#f6b26b; --amber-2:#ffd2a1; --teal:#67d5c0;
 11:   --line:rgba(255,255,255,.07); --glass:rgba(13,20,32,.72);
 12:   --display:"Songti SC","Noto Serif SC","Source Han Serif SC",serif;
 13:   --mono:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
 14: }
```
Hardcoded light-on-dark values with no var indirection (would break under a light theme):
```
 52: .legend .off{background:#223043}
 54: .legend .void{background:#161e2a}
 67: #tip{…background:rgba(8,13,21,.92);border:1px solid rgba(246,178,107,.28);…}
 74: .panel{position:fixed;top:0;right:0;height:100%;width:392px;background:#0b1220;…}
 94: .p-floors::-webkit-scrollbar{width:8px}
 95: .p-floors::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);…}
102: .frow:hover{background:rgba(246,178,107,.05)}
```
Only `@media` queries present are responsive breakpoints (L120 `max-width:900px`, L126 `max-height:700px`) —
no `prefers-color-scheme`. Line 132 `canvas{filter:saturate(.9)}` is a global filter, not theme code.
WebGL scene is night-lit with no day variant: L236 `scene.add(new THREE.HemisphereLight(0x9db3d6, 0x0a0e15, 0.62));`

### B2. model.html — style block L7–L169 — YES, complete manual theme pair (the only one)

Base palette = dark, declared on `:root`:
```
  8: :root{
  9:   --bg:#071019;--text:#edf2f9;--muted:#93a0b3;--faint:#5f6c7e;
 10:   --amber:#f6b26b;--amber-2:#ffd2a1;--teal:#67d5c0;
 11:   --line:rgba(255,255,255,.07);--glass:rgba(10,18,28,.72);
 12: }
```
Mechanism = **manual class toggle on `<body>` (`body.day`) overriding `:root` custom properties**, plus icon swap:
```
 85: #themeBtn .ic-moon{display:none}
 86: body.day #themeBtn .ic-sun{display:none}
 87: body.day #themeBtn .ic-moon{display:inline}
 89: body.day{
 90:   --bg:#dce7f0;--text:#1d2833;--muted:#54687e;--faint:#8593a5;
 91:   --line:rgba(23,43,63,.13);--glass:rgba(255,255,255,.72);
 92:   --amber-2:#a96a20;
 93: }
 94: body.day .legend .off{background:#c7d2de}
 95: body.day .legend .void{background:#e6ebf1}
 96: body.day .chip{background:#e8edf3;color:#7c8a9b}
 97: body.day .chip.on{background:rgba(217,143,58,.15);color:#a96a20;border-color:rgba(169,106,32,.4)}
 98: body.day #tip{background:rgba(255,255,255,.94)}
 99: body.day .panel{background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.88))}
100: body.day .ring::after{background:#f4f7fa}
101: body.day .p-bar{background:rgba(23,43,63,.08)}
102: body.day .p-floors::-webkit-scrollbar-thumb{background:rgba(23,43,63,.18)}
103: body.day .frow{border-bottom-color:rgba(23,43,63,.06)}
104: body.day .frow .fchips{color:#93a1b1}
```
Toggle button exists in markup:
```
138: <button class="btn" id="themeBtn"><svg class="ic-sun" …><svg class="ic-moon" …></button>
```
Notably **absent**: `@media (prefers-color-scheme: …)` (zero matches repo-wide), `color-scheme:` property
(zero matches), `[data-theme=…]` attribute selectors (zero matches), Tailwind `darkMode` config (no config files at all).

**Dead / orphaned theme code in model.html:** there is no JavaScript that ever adds or removes the `day` class.
All `classList` usage in the file is unrelated to theming:
```
745: panel.classList.add('open');
755: panel.classList.remove('open');
769: tourBtn.classList.toggle('on', controls.autoRotate);
853: setTimeout(()=>document.getElementById('load').classList.add('done'), 420);
```
And `#themeBtn` has no listener (no `getElementById('themeBtn')` / `onclick` / `addEventListener('click'` for it).
So `body.day` can never be reached by a user → the light theme is unreachable dead CSS.

The 3D scene does have a real day/night palette pair, but only the night half is wired up:
```
256: const SITE_PAL = {
257:   night:{ground:'#101720',…,soil:'#1a1f24',trunk:'#241a14',leaf:'#16281f',water:'#0a1622'},
258:   day:{ground:'#9aa29f',…,soil:'#7d7468',trunk:'#4a3a2c',leaf:'#4a6b4f',water:'#7fa8bd'}
259: };
279: function createSite(day){
280:   const P = SITE_PAL[day ? 'day' : 'night'];
367: const siteNight = createSite(false);
368: const siteDay = createSite(true);          // built, then never referenced again
370: const siteMat = new THREE.MeshStandardMaterial({map: siteNight.tex, …});
494: function makeFacade(b, day){                // called without `day` → always falsy/night
590:   const {map, glow} = makeFacade(b);
```
`siteDay` is an unused variable; `makeFacade`'s `day` parameter is never passed a truthy value
(day branches at L520, L528, L540, L544, L547 are unreachable).

### B3. report.html — style block L7–L150 — NO theme rules

Grep for `theme|Theme|day|Day|body.classList|documentElement|matchMedia|localStorage` → **No matches found**.
Single hardcoded dark document palette:
```
  8: :root{
  9:   --bg:#070b12; --panel:#0d1420; --panel2:#101a29; --line:rgba(255,255,255,.075);
 10:   --text:#edf2f9; --muted:#93a0b3; --faint:#5f6c7e;
 11:   --amber:#f6b26b; --amber-2:#ffd2a1; --teal:#67d5c0; --coral:#e8896b;
 12:   --display:"Songti SC",…; --mono:"PingFang SC",…;
 13: }
```
Print stylesheet present (nearest thing to an alternate media query, still not dark mode):
```
141: @media print{
142:   body{background:#fff}
143:   .tab-nav,.method,#banner{display:none}
144:   .card,.heat,.hero{border-color:#ddd;break-inside:avoid}
145: }
```
Other hardcoded dark literals: L23 `thead th{…background:#0a121e}`, L30 `tbody tr:nth-child(even){background:rgba(255,255,255,.018)}`,
L31 `tbody tr:hover{background:rgba(246,178,107,.06)}`, L49 `.tag.villa{…background:rgba(103,213,192,.1)}`.
`@media` at L135/L141 are layout/print only. Inline `style="…"` occurrences carry only progress widths
(`style="--p:0"`, `style="width:0%"`) and template hex fills (`background:${k===1?'#f6b26b':…}`), no theme logic.

## C. Conclusion

1. **Stylesheet count is zero.** There is no `.css`/`.scss`/`.sass`/`.less` file anywhere in the repo (outside the
   excluded dirs), so the requested table's stylesheet rows are empty by fact, not by oversight. 100% of CSS is in
   three inline `<style>` blocks.
2. **Dark mode is implemented nowhere in the OS sense.** Zero `@media (prefers-color-scheme)`, zero `color-scheme:`,
   zero `[data-theme]`, zero Tailwind `darkMode` config (there is no build tooling at all).
3. **A manual light/dark pair exists exactly once: `model.html` L85–L104**, via `body.day` overriding `:root` vars —
   but it is **dead code**: `#themeBtn` (L138) has no click handler and nothing ever toggles the `day` class, so the
   app is permanently dark. Its 3D counterpart is equally stranded (`siteDay` unused at L368, `makeFacade`'s `day`
   arg never set).
4. **Effective state: the project is dark-only.** `index.html` and `report.html` hardcode a dark palette
   (`--bg:#070b12`, `--glass:rgba(13,20,32,.72)`, `#0b1220`, `#0a121e`) with no light counterpart.
5. **To add real dark/light support**, the work belongs in these files (no new .css needed unless extracting):
   - `model.html` L85–L104 — already correct; only needs the missing wiring: a `themeBtn` click listener that
     toggles `document.body.classList` + persists to `localStorage` + seeds from
     `matchMedia('(prefers-color-scheme: light)')`; also pass `day` through to `makeFacade`/swap `siteDay.tex`.
   - `index.html` L8–L13 — hoist its hardcoded dark literals (L52, L54, L67, L74, L95, L102) into `:root` vars,
     then add a `body.day{…}` block cloned from `model.html` L89–L104.
   - `report.html` L8–L13 — same treatment: variables already exist, so add a `body.day`/`[data-theme=light]`
     override block and convert the literal `#0a121e` / `rgba(255,255,255,.0x)` values to vars.
   - Since palettes are duplicated across all three files (`--bg`, `--text`, `--muted`, `--faint`, `--amber`,
     `--line`, `--glass` repeat 3×), the highest-leverage change is to extract one shared stylesheet
     (e.g. `assets/theme.css`) holding both themes and `<link>` it from all three pages — currently each page
     would otherwise need its own edit kept in sync.
