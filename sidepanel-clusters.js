// ════════════════════════════════════════════════════════════════════════════
// sidepanel-clusters.js — "Clusters" tool  v6
//
// Recursive N-level nesting. Depth slider controls how many layers.
// Cards and cluster boxes tile/wrap in CSS flex (like tiles mode).
// Themed scrollbars appear when content overflows a bounding box.
// Bounding boxes are corner-drag resizable.
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-clusters.js v8]');

(function injectClusterStyles() {
  if (document.getElementById('pp-cluster-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cluster-styles';
  s.textContent = `
#pp-cl-head {
  flex-shrink: 0; padding: 10px 12px 8px;
  border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));
  display: flex; flex-direction: column; gap: 5px;
}
#pp-cl-subtitle {
  font-size: 11px; font-weight: 500; color: rgba(0,0,0,.45);
  letter-spacing: .04em; line-height: 1.3; min-height: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#pp-cl-status {
  display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  transition: opacity .6s ease, background .4s ease;
}
#pp-cl-status.cl-loading { background: rgba(0,0,0,.06); color: rgba(0,0,0,.4); }
#pp-cl-status.cl-ready   { background: rgba(60,180,100,.12); color: rgba(30,130,60,.9); }
#pp-cl-status.cl-error   { background: rgba(200,60,60,.10); color: rgba(180,40,40,.85); }
.pp-cl-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .4s; }
#pp-cl-status.cl-loading .pp-cl-dot { background:rgba(0,0,0,.25);animation:pp-cl-pulse 1.2s ease-in-out infinite; }
#pp-cl-status.cl-ready .pp-cl-dot   { background:rgba(40,160,80,.9); }
#pp-cl-status.cl-error .pp-cl-dot   { background:rgba(180,40,40,.85); }
@keyframes pp-cl-pulse { 0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);} }

/* ── Controls: 3-column slider grid + recluster button ── */
#pp-cl-controls { display: flex; flex-direction: column; gap: 4px; }
#pp-cl-sliders {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; align-items: start;
}
.pp-cl-slider-col { display: flex; flex-direction: column; gap: 2px; }
.pp-cl-group-label {
  font-size:7px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(0,0,0,.28);line-height:1;margin-bottom:1px;
}
.pp-cl-range-row { display:flex;align-items:center;gap:3px; }
.pp-cl-range-label {
  font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(0,0,0,.35);flex-shrink:0;width:18px;
}
.pp-cl-range-val { font-size:9px;font-weight:700;color:rgba(0,0,0,.55);flex-shrink:0;width:12px;text-align:right; }
.pp-cl-range {
  -webkit-appearance:none;appearance:none;flex:1;height:3px;border-radius:2px;
  background:rgba(0,0,0,.12);outline:none;cursor:pointer;min-width:0;
}
.pp-cl-range::-webkit-slider-thumb {
  -webkit-appearance:none;appearance:none;width:11px;height:11px;border-radius:50%;
  background:var(--color-topbar-sheet,#111);box-shadow:0 1px 3px rgba(0,0,0,.22);
  cursor:pointer;transition:transform .12s;
}
.pp-cl-range.pp-cl-inner::-webkit-slider-thumb { background:rgba(0,0,0,.38); }
.pp-cl-range.pp-cl-depth::-webkit-slider-thumb { background:rgba(100,80,200,.75); }
.pp-cl-range::-webkit-slider-thumb:hover { transform:scale(1.2); }
.pp-cl-range::-moz-range-thumb {
  width:11px;height:11px;border-radius:50%;border:none;
  background:var(--color-topbar-sheet,#111);box-shadow:0 1px 3px rgba(0,0,0,.22);cursor:pointer;
}
#pp-cl-recluster {
  width:100%;border:none;border-radius:5px;padding:4px 8px;height:22px;
  font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:rgba(0,0,0,.07);color:rgba(0,0,0,.45);
  cursor:pointer;transition:background .15s,color .15s;
  display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.2;
}
#pp-cl-recluster:hover { background:rgba(0,0,0,.13);color:rgba(0,0,0,.75); }
#pp-cl-recluster.pp-cl-reclustering { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }

/* ═══════════════════════════════════════════════════════
   ── CANVAS — tiles flow (mirrors #pp-body-wrap style) ──
   ═══════════════════════════════════════════════════════ */
#pp-cl-canvas {
  flex: 1; min-height: 0;
  overflow: auto;
  display: flex; flex-wrap: wrap;
  gap: 12px; padding: 12px;
  align-content: flex-start;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
}
#pp-cl-canvas::-webkit-scrollbar { width: 8px; height: 8px; }
#pp-cl-canvas::-webkit-scrollbar-track { background: var(--scrollbar-track); }
#pp-cl-canvas::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
#pp-cl-canvas::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
#pp-cl-canvas::-webkit-scrollbar-corner { background: var(--scrollbar-track); }

/* ─── Nest container ─── */
.pp-cl-nest {
  position: relative;
  flex-shrink: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  animation: pp-cl-nest-in .30s cubic-bezier(0.22,1,0.36,1) both;
  transition: box-shadow .18s ease;
}
@keyframes pp-cl-nest-in { from{opacity:0;transform:scale(.92);}to{opacity:1;transform:scale(1);} }

.pp-cl-nest[data-depth="0"] {
  border-radius:16px;border-width:2px;border-style:solid;
  box-shadow:0 2px 14px rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="1"] {
  border-radius:11px;border-width:1.5px;border-style:solid;
  box-shadow:0 1px 7px rgba(0,0,0,.07);
}
.pp-cl-nest[data-depth="2"] {
  border-radius:8px;border-width:1px;border-style:dashed;
  box-shadow:0 1px 4px rgba(0,0,0,.05);
}
.pp-cl-nest[data-depth="3"] {
  border-radius:6px;border-width:1px;border-style:dotted;
  box-shadow:none;
}

.pp-cl-nest-head {
  display:flex;align-items:center;gap:4px;flex-shrink:0;
  border-bottom:1px solid rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-head { padding:5px 8px 4px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-head { padding:3px 7px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-head { padding:2px 6px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-head { padding:2px 5px; }

.pp-cl-nest-badge {
  font-weight:800;letter-spacing:.10em;text-transform:uppercase;border-radius:20px;flex-shrink:0;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-badge { font-size:8px;padding:1px 6px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-badge { font-size:7px;padding:1px 5px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-badge { font-size:7px;padding:1px 4px;opacity:.85; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-badge { font-size:6px;padding:1px 4px;opacity:.80; }

.pp-cl-nest-count {
  font-weight:500;color:rgba(0,0,0,.35);flex:1;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-count { font-size:8px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-count { font-size:6px; }

/* ─── Nest body — tiling flex-wrap + themed scrollbar ─── */
.pp-cl-nest-body {
  flex: 1; min-height: 0;
  overflow: auto;
  display: flex; flex-wrap: wrap;
  align-content: flex-start;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
}
.pp-cl-nest-body::-webkit-scrollbar { width: 8px; height: 8px; }
.pp-cl-nest-body::-webkit-scrollbar-track { background: var(--scrollbar-track); }
.pp-cl-nest-body::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
.pp-cl-nest-body::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
.pp-cl-nest-body::-webkit-scrollbar-corner { background: var(--scrollbar-track); }

/* Per-depth body padding + gap */
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-body { padding:7px; gap:7px; }
.pp-cl-nest[data-depth="1"] > .pp-cl-nest-body { padding:5px; gap:5px; }
.pp-cl-nest[data-depth="2"] > .pp-cl-nest-body { padding:4px; gap:4px; }
.pp-cl-nest[data-depth="3"] > .pp-cl-nest-body { padding:3px; gap:3px; }

/* ─── Corner resize handles — sit inside the nest corners ─── */
.pp-cl-resize-handle {
  position: absolute; width: 18px; height: 18px; z-index: 30;
  opacity: 0; transition: opacity .15s; box-sizing: border-box;
}
.pp-cl-nest:hover > .pp-cl-resize-handle,
.pp-cl-nest.pp-cl-resizing > .pp-cl-resize-handle { opacity: 1; }

/* Two perpendicular bars forming an L-shape per corner */
.pp-cl-resize-handle::before,
.pp-cl-resize-handle::after {
  content: ''; position: absolute; background: rgba(0,0,0,.36);
  border-radius: 1.5px; transition: background .12s;
}
.pp-cl-resize-handle:hover::before,
.pp-cl-resize-handle:hover::after { background: rgba(0,0,0,.72); }
.pp-cl-resize-handle::before { width: 9px; height: 2.5px; }
.pp-cl-resize-handle::after  { width: 2.5px; height: 9px; }

/* NW — bars in top-left */
.pp-cl-rh-nw { top:3px; left:3px; cursor:nwse-resize; }
.pp-cl-rh-nw::before { top:6px; left:0; }
.pp-cl-rh-nw::after  { top:0; left:6px; }

/* NE — bars in top-right */
.pp-cl-rh-ne { top:3px; right:3px; cursor:nesw-resize; }
.pp-cl-rh-ne::before { top:6px; right:0; }
.pp-cl-rh-ne::after  { top:0; right:6px; }

/* SW — bars in bottom-left */
.pp-cl-rh-sw { bottom:3px; left:3px; cursor:nesw-resize; }
.pp-cl-rh-sw::before { bottom:6px; left:0; }
.pp-cl-rh-sw::after  { bottom:0; left:6px; }

/* SE — bars in bottom-right */
.pp-cl-rh-se { bottom:3px; right:3px; cursor:nwse-resize; }
.pp-cl-rh-se::before { bottom:6px; right:0; }
.pp-cl-rh-se::after  { bottom:0; right:6px; }

/* ─── Cards — tiled in flex-wrap, not absolutely positioned ─── */
.pp-cl-card {
  flex: 0 0 78px;
  width: 78px; height: 56px;
  border: 1.5px solid var(--ppc-border,#aaa);
  border-radius: 6px;
  background: var(--ppc-bg,#f8f8f8);
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  overflow: hidden; box-sizing: border-box;
  animation: pp-cl-card-in .20s ease both;
  transition: box-shadow .12s, transform .12s;
  cursor: default;
  display: flex; flex-direction: column;
}
.pp-cl-card:hover {
  box-shadow: 0 2px 10px rgba(0,0,0,.16);
  transform: translateY(-1px);
  z-index: 2; position: relative;
}
@keyframes pp-cl-card-in { from{opacity:0;transform:scale(.82);}to{opacity:1;transform:scale(1);} }

.pp-cl-card-head { padding:2px 5px;display:flex;align-items:center;gap:3px;flex-shrink:0; }
.pp-cl-card-badge {
  font-size:7px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
  border-radius:20px;padding:1px 5px;flex-shrink:0;opacity:.85;
}
.pp-cl-card-tab {
  font-size:7px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  color:rgba(0,0,0,.35);flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pp-cl-card-body { padding:2px 5px 4px;flex:1;min-height:0;overflow:hidden; }
.pp-cl-card-cat {
  font-size:7px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:rgba(0,0,0,.30);margin-bottom:1px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pp-cl-card-text {
  font-size:9px;line-height:1.3;color:rgba(0,0,0,.70);overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
}

/* ─── Tooltip ─── */
.pp-cl-tooltip {
  position:fixed;z-index:9000;max-width:220px;background:white;
  border:1.5px solid var(--border-strong,#d0d0d0);border-radius:8px;padding:7px 10px;
  box-shadow:0 4px 18px rgba(0,0,0,.15);pointer-events:none;
  font-size:10px;line-height:1.45;color:rgba(0,0,0,.75);display:none;
}
.pp-cl-tooltip.visible { display:block; }
.pp-cl-tooltip-head { font-size:8px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:rgba(0,0,0,.35);margin-bottom:4px; }
.pp-cl-tooltip-cluster { font-size:8px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;margin-bottom:3px; }
.pp-cl-tooltip-text { margin-bottom:2px; }
.pp-cl-tooltip-goto {
  margin-top:5px;font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(0,0,0,.4);cursor:pointer;pointer-events:auto;
  display:inline-block;padding:2px 6px;border-radius:4px;border:1px solid rgba(0,0,0,.15);transition:background .12s;
}
.pp-cl-tooltip-goto:hover { background:rgba(0,0,0,.06); }

/* ─── Empty state ─── */
#pp-cl-empty {
  flex: 1;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:8px;
  font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(0,0,0,.25);text-align:center;padding:24px;pointer-events:none;
  min-width: 100%;
}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initClustersTool(paneEl, sidebarEl) {

  paneEl.innerHTML =
    '<div id="pp-cl-head">' +
      '<div id="pp-cl-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cl-status" class="cl-loading"><div class="pp-cl-dot"></div><span id="pp-cl-label">Embeddings loading\u2026</span></div>' +
      '<div id="pp-cl-controls">' +
        '<div id="pp-cl-sliders">' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Outer</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range" id="pp-cl-omin" type="range" min="2" max="16" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-omin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range" id="pp-cl-omax" type="range" min="2" max="16" value="12" step="1"><span class="pp-cl-range-val" id="pp-cl-omax-val">12</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Inner</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imin" type="range" min="2" max="8" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-imin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imax" type="range" min="2" max="8" value="4" step="1"><span class="pp-cl-range-val" id="pp-cl-imax-val">4</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Depth</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Lvl</span><input class="pp-cl-range pp-cl-depth" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-depth-val">2</span></div>' +
          '</div>' +
        '</div>' +
        '<button id="pp-cl-recluster">Re-cluster</button>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cl-canvas"><div id="pp-cl-empty">Clusters will appear<br>once embeddings finish</div></div>' +
    '<div class="pp-cl-tooltip" id="pp-cl-tooltip">' +
      '<div class="pp-cl-tooltip-head">Entry</div>' +
      '<div class="pp-cl-tooltip-cluster" id="pp-cl-tt-cluster"></div>' +
      '<div class="pp-cl-tooltip-text" id="pp-cl-tt-text"></div>' +
      '<div class="pp-cl-tooltip-goto" id="pp-cl-tt-goto">Go to \u2197</div>' +
    '</div>';

  const subtitle     = paneEl.querySelector('#pp-cl-subtitle');
  const statusEl     = paneEl.querySelector('#pp-cl-status');
  const labelEl      = paneEl.querySelector('#pp-cl-label');
  const canvas       = paneEl.querySelector('#pp-cl-canvas');
  const emptyEl      = paneEl.querySelector('#pp-cl-empty');
  const tooltip      = document.getElementById('pp-cl-tooltip');
  const ttCluster    = document.getElementById('pp-cl-tt-cluster');
  const ttText       = document.getElementById('pp-cl-tt-text');
  const ttGoto       = document.getElementById('pp-cl-tt-goto');
  const reclusterBtn = paneEl.querySelector('#pp-cl-recluster');

  const oMinSlider = paneEl.querySelector('#pp-cl-omin'), oMinVal = paneEl.querySelector('#pp-cl-omin-val');
  const oMaxSlider = paneEl.querySelector('#pp-cl-omax'), oMaxVal = paneEl.querySelector('#pp-cl-omax-val');
  const iMinSlider = paneEl.querySelector('#pp-cl-imin'), iMinVal = paneEl.querySelector('#pp-cl-imin-val');
  const iMaxSlider = paneEl.querySelector('#pp-cl-imax'), iMaxVal = paneEl.querySelector('#pp-cl-imax-val');
  const depthSlider = paneEl.querySelector('#pp-cl-depth'), depthVal = paneEl.querySelector('#pp-cl-depth-val');

  // ── Constants ─────────────────────────────────────────────────────────────
  const LETTERS   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CARD_W    = 78;
  const CARD_H    = 56;
  // Tile columns cap for initial sizing
  const TILE_COLS = 3;
  // Per-depth gap between items inside body (mirrors CSS gap values)
  const BODY_GAP  = [7, 5, 4, 3];
  const BODY_PAD  = [7, 5, 4, 3];

  const RESIZE_MIN_W = 90;
  const RESIZE_MIN_H = 50;

  // ── State ─────────────────────────────────────────────────────────────────
  let _outerMin = 2, _outerMax = 12, _innerMin = 2, _innerMax = 4, _depth = 2;
  let _rendered = false, _ttRow = null;
  let _cachedEmbedded = null, _cachedVectors = null;
  let _reclusterTimer = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function e(t) { return typeof panelEscH === 'function' ? panelEscH(t) : String(t); }

  function setStatus(state, text) {
    statusEl.className = 'cl-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders ───────────────────────────────────────────────────────────────
  function syncSliders() {
    if (+oMinSlider.value > +oMaxSlider.value) oMaxSlider.value = oMinSlider.value;
    if (+iMinSlider.value > +iMaxSlider.value) iMaxSlider.value = iMinSlider.value;
    _outerMin = +oMinSlider.value; _outerMax = +oMaxSlider.value;
    _innerMin = +iMinSlider.value; _innerMax = +iMaxSlider.value;
    _depth    = +depthSlider.value;
    oMinVal.textContent = _outerMin; oMaxVal.textContent = _outerMax;
    iMinVal.textContent = _innerMin; iMaxVal.textContent = _innerMax;
    depthVal.textContent = _depth;
  }
  function scheduleRecluster() {
    syncSliders();
    if (!_cachedEmbedded) return;
    clearTimeout(_reclusterTimer);
    reclusterBtn.classList.add('pp-cl-reclustering');
    reclusterBtn.textContent = '\u2026';
    _reclusterTimer = setTimeout(() => { _rendered = false; tryRender(); }, 420);
  }
  [oMinSlider, oMaxSlider, iMinSlider, iMaxSlider, depthSlider].forEach(s =>
    s.addEventListener('input', scheduleRecluster));
  reclusterBtn.addEventListener('click', () => {
    clearTimeout(_reclusterTimer); _rendered = false; tryRender();
  });

  // ── Clustering ────────────────────────────────────────────────────────────
  function topDims(vec, n) {
    return vec.map((v,i)=>({i,v:Math.abs(v)})).sort((a,b)=>b.v-a.v).slice(0,n||5).map(d=>d.i);
  }
  function dimJaccard(a, b) {
    const sa = new Set(a); let inter = 0;
    b.forEach(d => { if (sa.has(d)) inter++; });
    const u = new Set([...a,...b]).size;
    return u === 0 ? 0 : inter / u;
  }
  function buildDist(rows) {
    const n = rows.length;
    const fps = rows.map(r => {
      const v = _cachedVectors.get(r.tabIdx+':'+r.rowIdx);
      return v ? topDims(v, 5) : [];
    });
    return Array.from({length:n}, (_,i) =>
      Array.from({length:n}, (_,j) => i===j ? 0 : 1-dimJaccard(fps[i],fps[j])));
  }
  function kMedoids(dist, n, k) {
    const meds = [Math.floor(Math.random()*n)];
    while (meds.length < k) {
      const md = Array.from({length:n}, (_,i) => Math.min(...meds.map(m => dist[i][m])));
      const tot = md.reduce((a,b)=>a+b,0); let r=Math.random()*tot, cum=0, added=false;
      for (let i=0;i<n;i++) { cum+=md[i]; if(cum>=r){meds.push(i);added=true;break;} }
      if (!added) meds.push(Math.floor(Math.random()*n));
    }
    let asgn = new Array(n).fill(0);
    for (let iter=0;iter<30;iter++) {
      let changed=false;
      for (let i=0;i<n;i++) {
        let best=0, bd=Infinity;
        meds.forEach((m,ci)=>{ if(dist[i][m]<bd){bd=dist[i][m];best=ci;} });
        if(asgn[i]!==best){asgn[i]=best;changed=true;}
      }
      if(!changed) break;
      for (let ci=0;ci<k;ci++) {
        const mb=asgn.map((a,i)=>a===ci?i:-1).filter(x=>x>=0); if(!mb.length) continue;
        let bm=mb[0],bs=Infinity;
        mb.forEach(m=>{const s=mb.reduce((a,o)=>a+dist[m][o],0);if(s<bs){bs=s;bm=m;}});
        meds[ci]=bm;
      }
    }
    let variance=0;
    for(let ci=0;ci<k;ci++){
      const mb=asgn.map((a,i)=>a===ci?i:-1).filter(x=>x>=0); if(mb.length<2) continue;
      mb.forEach(m=>mb.forEach(o=>{variance+=dist[m][o];}));
    }
    return {asgn, variance:variance/(n*n)};
  }
  function autoCluster(rows, minK, maxK) {
    const n = rows.length; if(n===0) return [];
    if(n<=2) return new Array(n).fill(0).map((_,i)=>i);
    const dist  = buildDist(rows);
    const sqrtN = Math.max(2, Math.round(Math.sqrt(n)));
    minK = Math.max(2, minK||2);
    maxK = Math.min(Math.max(minK, maxK||6), sqrtN*2, n-1);
    if(maxK < minK) return new Array(n).fill(0);
    if(minK===maxK) {
      let best=null;
      for(let t=0;t<4;t++){const r=kMedoids(dist,n,minK);if(!best||r.variance<best.variance)best=r;}
      return best.asgn;
    }
    const results=[];
    for(let k=minK;k<=maxK;k++){
      let best=null;
      for(let t=0;t<4;t++){const r=kMedoids(dist,n,k);if(!best||r.variance<best.variance)best=r;}
      results.push({k,...best});
    }
    const vars=results.map(r=>r.variance);
    const range=(vars[0]-vars[vars.length-1])||1;
    let chosenK=results[0].k;
    for(let i=1;i<results.length;i++){
      if((vars[i-1]-vars[i])/range<0.10){chosenK=results[i-1].k;break;}
      chosenK=results[i].k;
    }
    chosenK=Math.max(minK,Math.min(maxK,chosenK));
    return (results.find(r=>r.k===chosenK)||results[results.length-1]).asgn;
  }

  // ── Colour per path ───────────────────────────────────────────────────────
  function colorForPath(path) {
    const outerIdx = path[0] || 0;
    const depth    = path.length;
    const tname = (typeof TAB_THEMES!=='undefined' ? TAB_THEMES[outerIdx % TAB_THEMES.length] : 'default') || 'default';
    const theme = (typeof THEMES!=='undefined' ? (THEMES[tname]||THEMES.default) : {}) || {};
    const accent = theme['--tab-active-bg']    || '#888';
    const label  = theme['--tab-active-color'] || '#fff';
    const bg     = theme['--bg-data']          || '#f8f8f8';
    const alphaAccent = Math.max(0.35, 1 - (depth-1)*0.18);
    return {
      accent:      accent + Math.round(alphaAccent*255).toString(16).padStart(2,'0'),
      accentSolid: accent,
      label, bg
    };
  }

  // ── Initial width calculation ─────────────────────────────────────────────
  // Returns a px width string for a nest given its depth and number of direct children.
  // isLeaf = true → children are CARD_W-wide cards; false → children are sub-nests.
  function nestInitialWidth(depth, childCount, isLeaf, childWidth) {
    const gap = BODY_GAP[Math.min(depth, BODY_GAP.length-1)];
    const pad = BODY_PAD[Math.min(depth, BODY_PAD.length-1)];
    const cw  = isLeaf ? CARD_W : (childWidth || 180);
    const cols = Math.min(TILE_COLS, Math.max(1, Math.ceil(Math.sqrt(Math.max(1, childCount)))));
    return cols * cw + (cols - 1) * gap + pad * 2;
  }

  // ── Corner resize ─────────────────────────────────────────────────────────
  function makeResizable(nestEl) {
    const corners = [
      { cls: 'nw', dw: -1, dh: -1 },
      { cls: 'ne', dw:  1, dh: -1 },
      { cls: 'sw', dw: -1, dh:  1 },
      { cls: 'se', dw:  1, dh:  1 },
    ];

    corners.forEach(({ cls, dw, dh }) => {
      const handle = document.createElement('div');
      handle.className = 'pp-cl-resize-handle pp-cl-rh-' + cls;
      nestEl.appendChild(handle);

      let active = false, sx, sy, sw, sh;

      function onDown(cx, cy) {
        active = true; sx = cx; sy = cy;
        sw = nestEl.offsetWidth;
        sh = nestEl.offsetHeight;
        nestEl.classList.add('pp-cl-resizing');
        document.body.style.cursor = (cls === 'nw' || cls === 'se') ? 'nwse-resize' : 'nesw-resize';
        document.body.style.userSelect = 'none';
      }
      function onMove(cx, cy) {
        if (!active) return;
        const newW = Math.max(RESIZE_MIN_W, sw + dw * (cx - sx));
        const newH = Math.max(RESIZE_MIN_H, sh + dh * (cy - sy));
        nestEl.style.width  = newW + 'px';
        nestEl.style.height = newH + 'px';
      }
      function onUp() {
        if (!active) return; active = false;
        nestEl.classList.remove('pp-cl-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMM);
        document.removeEventListener('mouseup',   onMU);
        document.removeEventListener('touchmove', onTM);
        document.removeEventListener('touchend',  onTE);
      }

      function onMM(ev) { onMove(ev.clientX, ev.clientY); }
      function onMU()   { onUp(); }
      function onTM(ev) {
        if (!active || !ev.touches.length) return;
        ev.preventDefault(); onMove(ev.touches[0].clientX, ev.touches[0].clientY);
      }
      function onTE() { onUp(); }

      handle.addEventListener('mousedown', ev => {
        if (ev.button !== 0) return;
        ev.stopPropagation(); ev.preventDefault();
        onDown(ev.clientX, ev.clientY);
        document.addEventListener('mousemove', onMM);
        document.addEventListener('mouseup',   onMU);
      });
      handle.addEventListener('touchstart', ev => {
        if (ev.touches.length !== 1) return;
        ev.stopPropagation(); ev.preventDefault();
        onDown(ev.touches[0].clientX, ev.touches[0].clientY);
        document.addEventListener('touchmove', onTM, { passive: false });
        document.addEventListener('touchend',  onTE);
      }, { passive: false });
    });
  }

  // ── Card builder ──────────────────────────────────────────────────────────
  function buildCard(r, path, col, delay) {
    const tabObj  = typeof TABS!=='undefined' ? TABS[r.tabIdx] : null;
    const tabData = tabObj && typeof processSheetData==='function' ? processSheetData(tabObj.grid) : null;
    const tabName = (tabData&&tabData.title) ? tabData.title : (tabObj ? tabObj.name : '');
    const cells   = r.row&&r.row.cells ? r.row.cells : [];
    const cats    = r.row&&r.row.cats  ? r.row.cats.filter(c=>c.trim()) : [];
    const best    = cells.reduce((b,c)=>c.length>b.length?c:b,'');
    const parsed  = typeof parseCitation==='function' ? parseCitation(best) : {body:best};
    const label   = path.map((idx,d) => d===0 ? (LETTERS[idx]||idx) : (idx+1)).join('.');

    const card = document.createElement('div');
    card.className = 'pp-cl-card';
    card.style.setProperty('--ppc-border', col.accentSolid + '77');
    card.style.setProperty('--ppc-bg',     col.bg);
    if (delay) card.style.animationDelay = delay + 'ms';
    card.innerHTML =
      '<div class="pp-cl-card-head">' +
        '<span class="pp-cl-card-badge" style="background:'+col.accentSolid+';color:'+col.label+'">' + e(label) + '</span>' +
        '<span class="pp-cl-card-tab">' + e(tabName) + '</span>' +
      '</div>' +
      '<div class="pp-cl-card-body">' +
        (cats.length ? '<div class="pp-cl-card-cat">' + cats.map(e).join(' \u00b7 ') + '</div>' : '') +
        '<div class="pp-cl-card-text">' + e(parsed.body) + '</div>' +
      '</div>';

    card.addEventListener('mouseenter', ev => showTooltip(ev, r, path, col, parsed.body, cats, tabName));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  // ── Recursive nest builder ────────────────────────────────────────────────
  // Returns the nest DOM element; all children are in normal flex flow.
  function buildNestRecursive(rows, depth, maxDepth, path) {
    const col    = colorForPath(path);
    const isLeaf = (depth >= maxDepth);
    const gap    = BODY_GAP[Math.min(depth, BODY_GAP.length-1)];
    const pad    = BODY_PAD[Math.min(depth, BODY_PAD.length-1)];

    // ── Cluster if non-leaf ───────────────────────────────────────────────
    let children = null;
    if (!isLeaf) {
      const minK = depth===0 ? _outerMin : _innerMin;
      const maxK = depth===0 ? _outerMax : _innerMax;
      const asgn = autoCluster(rows, minK, maxK);
      const numC = Math.max(...asgn, 0) + 1;
      const groups = Array.from({length:numC}, ()=>[]);
      rows.forEach((r,i) => groups[asgn[i]].push(r));
      children = groups.map((members, ci) => ({ members, childPath: [...path, ci] }));
    }

    // ── Build nest shell ──────────────────────────────────────────────────
    const nest = document.createElement('div');
    nest.className = 'pp-cl-nest';
    nest.setAttribute('data-depth', String(depth));
    nest.style.borderColor = col.accentSolid + (depth===0 ? '55' : '33');
    nest.style.background  = col.accentSolid + (depth===0 ? '0a' : '07');
    nest.style.animationDelay = ((path[path.length-1]||0) * (depth===0 ? 55 : 30)) + 'ms';

    const label      = path.map((idx,d) => d===0 ? (LETTERS[idx]||idx) : (idx+1)).join('.');
    const countLabel = rows.length + ' entr' + (rows.length===1 ? 'y' : 'ies');
    const subLabel   = children ? ' \u00b7 '+children.length+' group'+(children.length===1?'':'s') : '';

    const head = document.createElement('div');
    head.className = 'pp-cl-nest-head';
    head.style.background = col.accentSolid + (depth===0 ? '18' : '10');
    head.innerHTML =
      '<span class="pp-cl-nest-badge" style="background:'+col.accentSolid+';color:'+col.label+'">' + e(label) + '</span>' +
      '<span class="pp-cl-nest-count">' + countLabel + subLabel + '</span>';
    nest.appendChild(head);

    const body = document.createElement('div');
    body.className = 'pp-cl-nest-body';
    nest.appendChild(body);

    // ── Populate body ─────────────────────────────────────────────────────
    if (isLeaf) {
      // Cards tile in the body's flex-wrap
      rows.forEach((r, ri) => {
        const card = buildCard(r, [...path], col, ri * 14);
        body.appendChild(card);
      });
      // Initial nest width: ceil(sqrt(N)) columns of cards
      nest.style.width = nestInitialWidth(depth, rows.length, true) + 'px';

    } else {
      // Child nests tile in the body's flex-wrap
      let childNestW = 0;
      const childEls = (children||[])
        .filter(c => c.members.length > 0)
        .map(({ members, childPath }) => {
          const child = buildNestRecursive(members, depth+1, maxDepth, childPath);
          childNestW = Math.max(childNestW, parseInt(child.style.width)||180);
          body.appendChild(child);
          return child;
        });

      // Initial nest width: tile child nests
      const numChildren = childEls.length;
      nest.style.width = nestInitialWidth(depth, numChildren, false, childNestW + gap) + 'px';
    }

    makeResizable(nest);
    return nest;
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function render(rows) {
    Array.from(canvas.children).forEach(c => { if (c !== emptyEl) c.remove(); });
    emptyEl.style.display = 'none';

    const maxDepth  = _depth - 1;
    const topAsgn   = autoCluster(rows, _outerMin, _outerMax);
    const numTop    = Math.max(...topAsgn, 0) + 1;
    const topGroups = Array.from({length:numTop}, ()=>[]);
    rows.forEach((r,i) => topGroups[topAsgn[i]].push(r));

    topGroups.forEach((members, oi) => {
      if (!members.length) return;
      canvas.appendChild(buildNestRecursive(members, 0, maxDepth, [oi]));
    });

    subtitle.textContent =
      numTop + ' cluster'+(numTop===1?'':'s') +
      ' \u00b7 ' + rows.length + ' entries' +
      ' \u00b7 ' + _depth + ' level'+(_depth===1?'':'s');
    _rendered = true;
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  function showTooltip(ev, r, path, col, text, cats, tabName) {
    _ttRow = r;
    ttCluster.textContent = path.map((idx,d)=>d===0?(LETTERS[idx]||idx):(idx+1)).join(' \u203a ');
    ttCluster.style.color = col.accentSolid;
    ttText.textContent    = text.slice(0,160)+(text.length>160?'\u2026':'');
    ttGoto.style.color    = col.accentSolid;
    moveTooltip(ev); tooltip.classList.add('visible');
  }
  function moveTooltip(ev) {
    const pad=12, tw=tooltip.offsetWidth||220, th=tooltip.offsetHeight||80;
    let lx=ev.clientX+pad, ly=ev.clientY+pad;
    if(lx+tw>window.innerWidth)  lx=ev.clientX-tw-pad;
    if(ly+th>window.innerHeight) ly=ev.clientY-th-pad;
    tooltip.style.left=lx+'px'; tooltip.style.top=ly+'px';
  }
  function hideTooltip() { tooltip.classList.remove('visible'); _ttRow=null; }

  ttGoto.addEventListener('click', () => {
    if (!_ttRow) return; hideTooltip();
    if (typeof panelGoTo === 'function')
      panelGoTo({tabIdx:_ttRow.tabIdx, rowIdx:_ttRow.rowIdx, row:_ttRow.row, shared:new Set()}, 0);
  });

  // ── Fetch + trigger ───────────────────────────────────────────────────────
  function finishRender(embedded) {
    try { render(embedded); }
    catch(err) { console.error('[clusters]', err); setStatus('error', 'Clustering failed'); }
    setStatus('ready', 'Done');
    reclusterBtn.classList.remove('pp-cl-reclustering');
    reclusterBtn.textContent = 'Re-cluster';
  }

  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;
    if (_cachedEmbedded && _cachedVectors) {
      requestAnimationFrame(() => finishRender(_cachedEmbedded)); return;
    }
    const rows = buildRowIndex(); if (!rows.length) return;
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026');
    emptyEl.style.display = 'none';
    Promise.all(rows.map(r => {
      const text = ((r.row&&r.row.cells) ? r.row.cells : (r.cells||[])).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx+':'+r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map();
      results.forEach(res => { if (res&&res.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) {
        setStatus('error','No vectors');
        emptyEl.textContent = 'No embeddings'; emptyEl.style.display = 'flex'; return;
      }
      const embedded = rows.filter(r => vectors.has(r.tabIdx+':'+r.rowIdx));
      if (embedded.length < 3) { setStatus('error','Not enough data'); return; }
      _cachedEmbedded = embedded; _cachedVectors = vectors;
      requestAnimationFrame(() => finishRender(embedded));
    });
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 100);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 100));
  window.addEventListener('embedding-progress', ev => {
    if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%');
  });

  return { reset() {} };
}
