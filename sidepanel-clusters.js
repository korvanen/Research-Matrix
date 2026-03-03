// ════════════════════════════════════════════════════════════════════════════
// sidepanel-clusters.js — "Clusters" tool  v5
//
// Recursive N-level nesting. Depth slider controls how many layers.
// Depth 1 = clusters containing cards directly.
// Depth N = N levels of nested containers before cards appear.
// Outer Min/Max controls top-level cluster count.
// Inner Min/Max is shared across all deeper levels.
// Sliders in 3 columns: Outer | Inner | Depth
// Cluster bounding boxes are corner-draggable to resize.
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-clusters.js v6]');

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
#pp-cl-controls {
  display: flex; flex-direction: column; gap: 4px;
}
#pp-cl-sliders {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  align-items: start;
}
.pp-cl-slider-col {
  display: flex; flex-direction: column; gap: 2px;
}
.pp-cl-group-label {
  font-size:7px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(0,0,0,.28);line-height:1;margin-bottom:1px;
}
.pp-cl-range-row { display:flex;align-items:center;gap:3px; }
.pp-cl-range-label {
  font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(0,0,0,.35);flex-shrink:0;width:18px;
}
.pp-cl-range-val {
  font-size:9px;font-weight:700;color:rgba(0,0,0,.55);flex-shrink:0;width:12px;text-align:right;
}
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
.pp-cl-col-divider {
  width:1px; background:rgba(0,0,0,.08); align-self:stretch; margin:0 1px;
  display:none; /* dividers handled by grid gap */
}

#pp-cl-recluster {
  width:100%;border:none;border-radius:5px;padding:4px 8px;
  font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:rgba(0,0,0,.07);color:rgba(0,0,0,.45);
  cursor:pointer;transition:background .15s,color .15s;
  display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.2;
  height:22px;
}
#pp-cl-recluster:hover { background:rgba(0,0,0,.13);color:rgba(0,0,0,.75); }
#pp-cl-recluster.pp-cl-reclustering { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }

/* ── Canvas ── */
#pp-cl-canvas { flex:1;min-height:0;position:relative;overflow:hidden; }

/* ── Generic nest at any depth level ── */
.pp-cl-nest {
  position:absolute;box-sizing:border-box;user-select:none;cursor:grab;
  animation:pp-cl-nest-in .30s cubic-bezier(0.22,1,0.36,1) both;
  transition:box-shadow .18s ease;
  overflow:hidden;
}
.pp-cl-nest:active,.pp-cl-nest.pp-cl-nest-dragging { cursor:grabbing; }
.pp-cl-nest.pp-cl-nest-dragging { z-index:100; }
@keyframes pp-cl-nest-in { from{opacity:0;transform:scale(.86);}to{opacity:1;transform:scale(1);} }

/* Level-specific visual styling */
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
.pp-cl-nest[data-depth="0"] .pp-cl-nest-head { padding:5px 8px 4px;border-radius:14px 14px 0 0; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-head { padding:3px 7px;border-radius:9px 9px 0 0; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-head { padding:2px 6px;border-radius:6px 6px 0 0; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-head { padding:2px 5px;border-radius:4px 4px 0 0; }

.pp-cl-nest-badge {
  font-weight:800;letter-spacing:.10em;text-transform:uppercase;border-radius:20px;flex-shrink:0;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-badge { font-size:8px;padding:1px 6px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-badge { font-size:7px;padding:1px 5px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-badge { font-size:7px;padding:1px 4px;opacity:.85; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-badge { font-size:6px;padding:1px 4px;opacity:.80; }

.pp-cl-nest-count {
  font-weight:500;color:rgba(0,0,0,.35);flex:1;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-count { font-size:8px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-count { font-size:6px; }

.pp-cl-nest-body {
  position:relative;
  overflow:auto;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-body { padding:7px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-body { padding:5px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-body { padding:4px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-body { padding:3px; }

/* ── Corner resize handles ── */
.pp-cl-resize-handle {
  position: absolute;
  width: 14px; height: 14px;
  z-index: 30;
  opacity: 0;
  transition: opacity .15s;
  box-sizing: border-box;
  flex-shrink: 0;
}
.pp-cl-nest:hover > .pp-cl-resize-handle { opacity: 1; }
.pp-cl-resize-handle::after {
  content: '';
  position: absolute;
  inset: 3px;
  background: rgba(0,0,0,.28);
  border-radius: 3px;
  transition: background .12s;
}
.pp-cl-resize-handle:hover::after { background: rgba(0,0,0,.55); }
.pp-cl-rh-nw { top: -6px; left: -6px; cursor: nwse-resize; }
.pp-cl-rh-ne { top: -6px; right: -6px; cursor: nesw-resize; }
.pp-cl-rh-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.pp-cl-rh-se { bottom: -6px; right: -6px; cursor: nwse-resize; }

/* ── Cards ── */
.pp-cl-card {
  position:absolute;border:1.5px solid var(--ppc-border,#aaa);border-radius:6px;
  background:var(--ppc-bg,#f8f8f8);box-shadow:0 1px 4px rgba(0,0,0,.07);
  user-select:none;overflow:hidden;box-sizing:border-box;
  animation:pp-cl-card-in .20s ease both;transition:box-shadow .12s;cursor:default;
}
.pp-cl-card:hover { box-shadow:0 2px 10px rgba(0,0,0,.16);z-index:10; }
@keyframes pp-cl-card-in { from{opacity:0;transform:scale(.82);}to{opacity:1;transform:scale(1);} }
.pp-cl-card-head { padding:2px 5px;display:flex;align-items:center;gap:3px; }
.pp-cl-card-badge {
  font-size:7px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
  border-radius:20px;padding:1px 5px;flex-shrink:0;opacity:.85;
}
.pp-cl-card-tab {
  font-size:7px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  color:rgba(0,0,0,.35);flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pp-cl-card-body { padding:2px 5px 4px; }
.pp-cl-card-cat {
  font-size:7px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:rgba(0,0,0,.30);margin-bottom:1px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pp-cl-card-text {
  font-size:9px;line-height:1.3;color:rgba(0,0,0,.70);overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
}

/* ── Tooltip ── */
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

/* ── Empty ── */
#pp-cl-empty {
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:8px;
  font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(0,0,0,.25);text-align:center;padding:24px;pointer-events:none;
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
        // ── 3-column slider grid ──
        '<div id="pp-cl-sliders">' +
          // Column 1: Outer clusters
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Outer</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range" id="pp-cl-omin" type="range" min="2" max="16" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-omin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range" id="pp-cl-omax" type="range" min="2" max="16" value="12" step="1"><span class="pp-cl-range-val" id="pp-cl-omax-val">12</span></div>' +
          '</div>' +
          // Column 2: Inner sub-clusters
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Inner</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imin" type="range" min="2" max="8" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-imin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imax" type="range" min="2" max="8" value="4" step="1"><span class="pp-cl-range-val" id="pp-cl-imax-val">4</span></div>' +
          '</div>' +
          // Column 3: Depth
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Depth</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Lvl</span><input class="pp-cl-range pp-cl-depth" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-depth-val">2</span></div>' +
          '</div>' +
        '</div>' +
        // ── Recluster button (full-width below grid) ──
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
  const LETTERS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CARD_W   = 78, CARD_H = 56;
  const CARD_PAD = 5, CARD_GAP = 4;
  const BODY_PAD = [8, 6, 5, 4];
  const BODY_GAP = [8, 6, 5, 4];
  const MM_PAD   = 12, MM_ITERS = 32;

  // Minimum size for resized nests
  const RESIZE_MIN_W = 90;
  const RESIZE_MIN_H = 50;

  // ── State ─────────────────────────────────────────────────────────────────
  let _outerMin = 2, _outerMax = 12, _innerMin = 2, _innerMax = 4, _depth = 2;
  let _rendered = false, _ttRow = null;
  let _cachedEmbedded = null, _cachedVectors = null;
  let _reclusterTimer = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function cW() { return canvas.clientWidth  || 320; }
  function cH() { return canvas.clientHeight || 440; }
  function e(t) { return typeof panelEscH === 'function' ? panelEscH(t) : String(t); }

  function setStatus(state, text) {
    statusEl.className = 'cl-' + state; labelEl.textContent = text; statusEl.style.opacity = '1';
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

  // ── Fingerprint + clustering ──────────────────────────────────────────────
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

  // ── Collision ─────────────────────────────────────────────────────────────
  function pushApart(rects, skipId, maxX, maxY, pad) {
    pad = pad||MM_PAD;
    for(let pass=0;pass<MM_ITERS;pass++){
      let moved=false;
      for(const [idA,rA] of rects){
        if(idA===skipId) continue;
        for(const [idB,rB] of rects){
          if(idB===idA) continue;
          if(!(rA.x<rB.x+rB.w+pad&&rA.x+rA.w+pad>rB.x&&rA.y<rB.y+rB.h+pad&&rA.y+rA.h+pad>rB.y)) continue;
          const dR=rB.x+rB.w+pad-rA.x, dL=rA.x+rA.w+pad-rB.x;
          const dD=rB.y+rB.h+pad-rA.y, dU=rA.y+rA.h+pad-rB.y;
          if(Math.min(dR,dL)<=Math.min(dD,dU)) rA.x+=dR<dL?dR:-dL;
          else rA.y+=dD<dU?dD:-dU;
          if(maxX) rA.x=Math.max(0,Math.min(maxX-rA.w,rA.x));
          if(maxY) rA.y=Math.max(0,Math.min(maxY-rA.h,rA.y));
          moved=true;
        }
      }
      if(!moved) break;
    }
  }
  function applyPos(elMap, rectMap) {
    elMap.forEach((el,id)=>{ const r=rectMap.get(id); if(r){el.style.left=r.x+'px';el.style.top=r.y+'px';} });
  }

  // ── Colour for a path of cluster indices ─────────────────────────────────
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
      accent: accent + Math.round(alphaAccent*255).toString(16).padStart(2,'0'),
      accentSolid: accent,
      label, bg
    };
  }

  // ── Build a card DOM element ──────────────────────────────────────────────
  function buildCard(r, path, col) {
    const tabObj  = typeof TABS!=='undefined' ? TABS[r.tabIdx] : null;
    const tabData = tabObj && typeof processSheetData==='function' ? processSheetData(tabObj.grid) : null;
    const tabName = (tabData&&tabData.title) ? tabData.title : (tabObj?tabObj.name:'');
    const cells   = r.row&&r.row.cells ? r.row.cells : [];
    const cats    = r.row&&r.row.cats  ? r.row.cats.filter(c=>c.trim()) : [];
    const best    = cells.reduce((b,c)=>c.length>b.length?c:b,'');
    const parsed  = typeof parseCitation==='function' ? parseCitation(best) : {body:best};
    const label   = path.map((idx,d) => d===0 ? (LETTERS[idx]||idx) : (idx+1)).join('.');

    const card = document.createElement('div');
    card.className='pp-cl-card';
    card.style.setProperty('--ppc-border', col.accentSolid+'77');
    card.style.setProperty('--ppc-bg',     col.bg);
    card.innerHTML=
      '<div class="pp-cl-card-head">'+
        '<span class="pp-cl-card-badge" style="background:'+col.accentSolid+';color:'+col.label+'">'+
          e(label)+
        '</span>'+
        '<span class="pp-cl-card-tab">'+e(tabName)+'</span>'+
      '</div>'+
      '<div class="pp-cl-card-body">'+
        (cats.length?'<div class="pp-cl-card-cat">'+cats.map(e).join(' \u00b7 ')+'</div>':'')+
        '<div class="pp-cl-card-text">'+e(parsed.body)+'</div>'+
      '</div>';

    card.addEventListener('mouseenter', ev => showTooltip(ev, r, path, col, parsed.body, cats, tabName));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  // ── Card grid layout ──────────────────────────────────────────────────────
  function layoutCardGrid(cardEls, bodyEl) {
    const count=cardEls.length, cols=Math.ceil(Math.sqrt(count));
    const cw=CARD_W+CARD_GAP, ch=CARD_H+CARD_GAP, rows=Math.ceil(count/cols);
    const tw=cols*cw-CARD_GAP+CARD_PAD*2, th=rows*ch-CARD_GAP+CARD_PAD*2;
    cardEls.forEach((el,i)=>{
      el.style.left=(CARD_PAD+(i%cols)*cw)+'px';
      el.style.top=(CARD_PAD+Math.floor(i/cols)*ch)+'px';
      el.style.width=CARD_W+'px';
      el.style.animationDelay=(i*14)+'ms';
    });
    bodyEl.style.width=tw+'px'; bodyEl.style.height=th+'px';
    return {w:tw,h:th};
  }

  // ── Corner resize ─────────────────────────────────────────────────────────
  // Adds 4 corner drag handles to a nest element.
  // Resizing locks explicit width/height and makes the body scroll.
  function makeResizable(nestEl, nestId, nestRects) {
    const corners = [
      { cls: 'nw', dw: -1, dh: -1, moveL: true,  moveT: true  },
      { cls: 'ne', dw:  1, dh: -1, moveL: false, moveT: true  },
      { cls: 'sw', dw: -1, dh:  1, moveL: true,  moveT: false },
      { cls: 'se', dw:  1, dh:  1, moveL: false, moveT: false },
    ];

    corners.forEach(({ cls, dw, dh, moveL, moveT }) => {
      const handle = document.createElement('div');
      handle.className = `pp-cl-resize-handle pp-cl-rh-${cls}`;
      nestEl.appendChild(handle);

      let active = false;
      let sx, sy, sw, sh, sl, st;

      function onDown(cx, cy) {
        active = true;
        sx = cx; sy = cy;
        sw = nestEl.offsetWidth;
        sh = nestEl.offsetHeight;
        const r = nestRects.get(nestId);
        sl = r ? r.x : parseFloat(nestEl.style.left) || 0;
        st = r ? r.y : parseFloat(nestEl.style.top)  || 0;
      }

      function onMove(cx, cy) {
        if (!active) return;
        const ddx = cx - sx;
        const ddy = cy - sy;
        let newW = Math.max(RESIZE_MIN_W, sw + dw * ddx);
        let newH = Math.max(RESIZE_MIN_H, sh + dh * ddy);

        // Adjust position for anchored corners (nw / sw move left; nw / ne move top)
        let newL = moveL ? sl + sw - newW : sl;
        let newT = moveT ? st + sh - newH : st;

        nestEl.style.width   = newW + 'px';
        nestEl.style.height  = newH + 'px';
        nestEl.style.left    = newL + 'px';
        nestEl.style.top     = newT + 'px';

        // Make body fill remaining vertical space and scroll if content overflows
        const headEl = nestEl.querySelector('.pp-cl-nest-head');
        const bodyEl = nestEl.querySelector('.pp-cl-nest-body');
        if (headEl && bodyEl) {
          const headH = headEl.offsetHeight;
          bodyEl.style.height   = Math.max(20, newH - headH) + 'px';
          bodyEl.style.overflow = 'auto';
          bodyEl.style.flexShrink = '0';
        }

        // Keep rect map in sync
        const r = nestRects.get(nestId);
        if (r) { r.x = newL; r.y = newT; r.w = newW; r.h = newH; }
      }

      function onUp() {
        if (!active) return;
        active = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend',  onTouchEnd);
      }

      function onMouseMove(e) { onMove(e.clientX, e.clientY); }
      function onMouseUp()    { onUp(); }
      function onTouchMove(e) {
        if (!active || !e.touches.length) return;
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
      function onTouchEnd() { onUp(); }

      handle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation(); e.preventDefault();
        onDown(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
      });

      handle.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        e.stopPropagation(); e.preventDefault();
        onDown(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend',  onTouchEnd);
      }, { passive: false });
    });
  }

  // ── Recursive nest builder ────────────────────────────────────────────────
  function buildNestRecursive(rows, depth, maxDepth, path, parentBody, siblings) {
    const col     = colorForPath(path);
    const pad     = BODY_PAD[Math.min(depth, BODY_PAD.length-1)];
    const gap     = BODY_GAP[Math.min(depth, BODY_GAP.length-1)];
    const headH   = depth===0?28:depth===1?22:18;

    let children;
    if (depth < maxDepth) {
      const minK = depth===0 ? _outerMin : _innerMin;
      const maxK = depth===0 ? _outerMax : _innerMax;
      const asgn = autoCluster(rows, minK, maxK);
      const numC = Math.max(...asgn, 0) + 1;
      const groups = Array.from({length:numC}, ()=>[]);
      rows.forEach((r,i) => groups[asgn[i]].push(r));
      children = groups.map((members, ci) => ({ members, childPath:[...path, ci] }));
    } else {
      children = null;
    }

    const nest = document.createElement('div');
    nest.className = 'pp-cl-nest';
    nest.setAttribute('data-depth', String(depth));
    nest.style.setProperty('--nest-border', col.accentSolid + (depth===0?'44':'33'));
    nest.style.setProperty('--nest-bg',     col.accentSolid + (depth===0?'09':'06'));
    nest.style.animationDelay = (path[path.length-1]||0) * (depth===0?60:35) + 'ms';
    // Border colour via inline style so it picks up the per-nest accent
    nest.style.borderColor = col.accentSolid + (depth===0?'55':'33');
    nest.style.background  = col.accentSolid + (depth===0?'0a':'07');

    const label = path.map((idx,d) => d===0?(LETTERS[idx]||idx):(idx+1)).join('.');
    const countLabel = rows.length + ' entr'+(rows.length===1?'y':'ies');
    const subLabel = children ? ' \u00b7 '+children.length+' sub-group'+(children.length===1?'':'s') : '';

    const head = document.createElement('div');
    head.className = 'pp-cl-nest-head';
    head.style.background = col.accentSolid + (depth===0?'18':'10');
    head.innerHTML =
      '<span class="pp-cl-nest-badge" style="background:'+col.accentSolid+';color:'+col.label+'">'+
        e(label)+
      '</span>'+
      '<span class="pp-cl-nest-count">'+countLabel+subLabel+'</span>';
    nest.appendChild(head);

    const body = document.createElement('div');
    body.className = 'pp-cl-nest-body';
    nest.appendChild(body);

    let bodyW = 0, bodyH = 0;

    if (children === null) {
      const cardEls = rows.map(r => {
        const card = buildCard(r, path, col);
        body.appendChild(card);
        return card;
      });
      const {w,h} = layoutCardGrid(cardEls, body);
      bodyW = w; bodyH = h;
    } else {
      const childEls   = new Map();
      const childRects = new Map();
      body.style.position = 'relative';

      children.forEach(({members, childPath}, ci) => {
        if (!members.length) return;
        const {el, w, h} = buildNestRecursive(members, depth+1, maxDepth, childPath, body, childRects);
        const cid = 'c'+ci;
        let startX=pad, startY=pad;
        childRects.forEach(r=>{ startX=Math.max(startX,r.x+r.w+gap); });
        el.style.position='absolute';
        el.style.left=startX+'px'; el.style.top=pad+'px';
        el.style.width=w+'px';
        childEls.set(cid, el);
        childRects.set(cid, {x:startX, y:pad, w, h});
        body.appendChild(el);
        makeConstrainedDraggable(el, cid, childEls, childRects, body, depth+1);
        makeResizable(el, cid, childRects);
      });

      let maxX=0, maxY=0;
      childRects.forEach(r=>{ maxX=Math.max(maxX,r.x+r.w); maxY=Math.max(maxY,r.y+r.h); });
      bodyW = maxX + pad;
      bodyH = maxY + pad;
      body.style.width  = bodyW+'px';
      body.style.height = bodyH+'px';
    }

    const nestW = bodyW;
    const nestH = headH + bodyH;
    nest.style.width = nestW+'px';

    return { el: nest, w: nestW, h: nestH, bodyEl: body };
  }

  // ── Dragging for any nest level ───────────────────────────────────────────
  function makeConstrainedDraggable(nestEl, nestId, nestEls, nestRects, containerEl, depth) {
    let dragging=false, ox=0, oy=0, sl=0, st=0;
    const colPad = depth===0?4:2;

    function getContainerSize() {
      if (!containerEl) return {w:cW(), h:cH()};
      return {w:containerEl.offsetWidth||200, h:containerEl.offsetHeight||200};
    }

    function start(cx, cy, tgt) {
      if (tgt && tgt !== nestEl && (
        tgt.closest('.pp-cl-nest') !== nestEl ||
        tgt.closest('.pp-cl-card') ||
        tgt.classList.contains('pp-cl-resize-handle') ||
        tgt.closest('.pp-cl-resize-handle')
      )) return false;
      dragging=true; ox=cx; oy=cy;
      const r=nestRects.get(nestId); sl=r?r.x:0; st=r?r.y:0;
      nestEl.classList.add('pp-cl-nest-dragging');
      return true;
    }
    function move(cx, cy) {
      if (!dragging) return;
      const r=nestRects.get(nestId); if(!r) return;
      const {w:cw,h:ch}=getContainerSize();
      r.x=Math.max(0,Math.min(cw-r.w, sl+cx-ox));
      r.y=Math.max(0,Math.min(ch-r.h, st+cy-oy));
      nestEl.style.left=r.x+'px'; nestEl.style.top=r.y+'px';
      pushApart(nestRects, nestId, cw, ch, colPad);
      applyPos(nestEls, nestRects);
      if (containerEl) {
        let maxX=0,maxY=0;
        nestRects.forEach(r2=>{maxX=Math.max(maxX,r2.x+r2.w);maxY=Math.max(maxY,r2.y+r2.h);});
        const pad=BODY_PAD[Math.min(depth-1,BODY_PAD.length-1)]||6;
        containerEl.style.width=(maxX+pad)+'px';
        containerEl.style.height=(maxY+pad)+'px';
      }
    }
    function end() {
      if(!dragging) return; dragging=false;
      nestEl.classList.remove('pp-cl-nest-dragging');
      if (!containerEl) { pushApart(nestRects,null,cW(),cH(),colPad); applyPos(nestEls,nestRects); }
    }

    nestEl.addEventListener('mousedown', e=>{
      if(e.button!==0) return;
      if(start(e.clientX,e.clientY,e.target)){e.preventDefault();e.stopPropagation();}
    });
    document.addEventListener('mousemove', e=>move(e.clientX,e.clientY));
    document.addEventListener('mouseup', end);
    nestEl.addEventListener('touchstart',e=>{
      if(e.touches.length!==1) return;
      if(start(e.touches[0].clientX,e.touches[0].clientY,e.target)){e.preventDefault();e.stopPropagation();}
    },{passive:false});
    nestEl.addEventListener('touchmove',e=>{
      if(!dragging||e.touches.length!==1) return;
      move(e.touches[0].clientX,e.touches[0].clientY); e.preventDefault();
    },{passive:false});
    nestEl.addEventListener('touchend',end);
    nestEl.addEventListener('touchcancel',end);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function render(rows) {
    Array.from(canvas.children).forEach(c=>{if(c!==emptyEl)c.remove();});
    emptyEl.style.display='none';

    const maxDepth = _depth - 1;
    const W=cW(), H=cH();

    const minK = _outerMin, maxK = _outerMax;
    const topAsgn = autoCluster(rows, minK, maxK);
    const numTop  = Math.max(...topAsgn, 0) + 1;
    const topGroups = Array.from({length:numTop}, ()=>[]);
    rows.forEach((r,i) => topGroups[topAsgn[i]].push(r));

    const rootEls   = new Map();
    const rootRects = new Map();

    topGroups.forEach((members, oi) => {
      if (!members.length) return;
      const {el, w, h} = buildNestRecursive(members, 0, maxDepth, [oi], null, rootRects);

      const angle = (2*Math.PI*oi/numTop) - Math.PI/2;
      const ringR = numTop===1 ? 0 : Math.min(W,H)*0.26;
      const nx = Math.max(0, Math.min(W-w, W/2+ringR*Math.cos(angle)-w/2));
      const ny = Math.max(0, Math.min(H-h, H/2+ringR*Math.sin(angle)-h/2));
      el.style.left=nx+'px'; el.style.top=ny+'px';

      canvas.appendChild(el);
      rootEls.set('r'+oi, el);
      rootRects.set('r'+oi, {x:nx, y:ny, w, h});
      makeConstrainedDraggable(el, 'r'+oi, rootEls, rootRects, null, 0);
      makeResizable(el, 'r'+oi, rootRects);
    });

    requestAnimationFrame(()=>{
      rootEls.forEach((el,id)=>{
        const r=rootRects.get(id);
        const bh=el.getBoundingClientRect().height;
        if(bh>0) r.h=bh;
      });
      pushApart(rootRects, null, cW(), cH(), MM_PAD);
      applyPos(rootEls, rootRects);
    });

    subtitle.textContent = numTop+' cluster'+(numTop===1?'':'s')+
      ' \u00b7 '+rows.length+' entries \u00b7 '+_depth+' level'+(+_depth===1?'':'s');
    _rendered = true;
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  function showTooltip(e, r, path, col, text, cats, tabName) {
    _ttRow = r;
    ttCluster.textContent = path.map((idx,d)=>d===0?(LETTERS[idx]||idx):(idx+1)).join(' \u203a ');
    ttCluster.style.color = col.accentSolid;
    ttText.textContent    = text.slice(0,160)+(text.length>160?'\u2026':'');
    ttGoto.style.color    = col.accentSolid;
    moveTooltip(e); tooltip.classList.add('visible');
  }
  function moveTooltip(e) {
    const pad=12,tw=tooltip.offsetWidth||220,th=tooltip.offsetHeight||80;
    let lx=e.clientX+pad, ly=e.clientY+pad;
    if(lx+tw>window.innerWidth)  lx=e.clientX-tw-pad;
    if(ly+th>window.innerHeight) ly=e.clientY-th-pad;
    tooltip.style.left=lx+'px'; tooltip.style.top=ly+'px';
  }
  function hideTooltip() { tooltip.classList.remove('visible'); _ttRow=null; }
  ttGoto.addEventListener('click', ()=>{
    if(!_ttRow) return; hideTooltip();
    if(typeof panelGoTo==='function')
      panelGoTo({tabIdx:_ttRow.tabIdx,rowIdx:_ttRow.rowIdx,row:_ttRow.row,shared:new Set()},0);
  });

  // ── Fetch + trigger ───────────────────────────────────────────────────────
  function finishRender(embedded) {
    try { render(embedded); }
    catch(err) { console.error('[clusters]',err); setStatus('error','Clustering failed'); }
    setStatus('ready','Done');
    reclusterBtn.classList.remove('pp-cl-reclustering');
    reclusterBtn.textContent='Re-cluster';
  }

  function tryRender() {
    if(_rendered) return;
    if(!window.EmbeddingUtils||!window.EmbeddingUtils.isReady()) return;
    if(typeof buildRowIndex!=='function') return;
    if(_cachedEmbedded&&_cachedVectors){
      requestAnimationFrame(()=>finishRender(_cachedEmbedded)); return;
    }
    const rows=buildRowIndex(); if(!rows.length) return;
    setStatus('loading','Clustering '+rows.length+' entries\u2026');
    emptyEl.style.display='none';
    Promise.all(rows.map(r=>{
      const text=((r.row&&r.row.cells)?r.row.cells:(r.cells||[])).join(' ').trim();
      if(!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec=>({key:r.tabIdx+':'+r.rowIdx,vec})).catch(()=>null);
    })).then(results=>{
      const vectors=new Map();
      results.forEach(res=>{if(res&&res.vec)vectors.set(res.key,res.vec);});
      if(!vectors.size){setStatus('error','No vectors');emptyEl.textContent='No embeddings';emptyEl.style.display='flex';return;}
      const embedded=rows.filter(r=>vectors.has(r.tabIdx+':'+r.rowIdx));
      if(embedded.length<3){setStatus('error','Not enough data');return;}
      _cachedEmbedded=embedded; _cachedVectors=vectors;
      requestAnimationFrame(()=>finishRender(embedded));
    });
  }

  if(window.EmbeddingUtils&&window.EmbeddingUtils.isReady()) setTimeout(tryRender,100);
  document.addEventListener('embeddings-ready',()=>setTimeout(tryRender,100));
  window.addEventListener('embedding-progress',e=>{if(!_rendered)setStatus('loading','Indexing\u2026 '+e.detail.pct+'%');});

  return {reset(){}};
}
