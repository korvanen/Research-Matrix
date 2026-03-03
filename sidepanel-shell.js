// sidepanel-shell.js — Sidebar shell  v4
//
// LOAD ORDER (in index.html):
//   1. keyword-utils.js
//   2. sidepanel-utils.js
//   3. sidepanel-find-matches.js  — initFindMatchesTool()
//   4. sidepanel-clusters.js      — initClustersTool()
//   5. sidepanel-mindmap.js       — initConceptMapTool()
//   6. sidepanel-shell.js         — this file
//
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-shell.js v4]');

document.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    const box = document.getElementById('sidebar-box');
    if (!box) return;
    clearInterval(wait);
    initPanel(box);
  }, 50);
});

function initPanel(sidebarBox) {
  sidebarBox.style.pointerEvents = 'auto';
  sidebarBox.style.overflow      = 'hidden';
  sidebarBox.style.display       = 'flex';
  sidebarBox.style.flexDirection = 'column';

  sidebarBox.innerHTML =
    '<div id="pp-tool-nav">' +
      '<button class="pp-tool-btn pp-tool-btn-active" data-tool="find-matches">Find Matches</button>' +
      '<button class="pp-tool-btn" data-tool="concept-map">Concept Map</button>' +
      '<button class="pp-tool-btn" data-tool="clusters">Clusters</button>' +
    '</div>' +
    '<div id="pp-tool-pane-find-matches" class="pp-tool-pane pp-tool-pane-active"></div>' +
    '<div id="pp-tool-pane-concept-map"  class="pp-tool-pane"></div>' +
    '<div id="pp-tool-pane-clusters"     class="pp-tool-pane"></div>';

  const sidebarEl = document.getElementById('sidebar');

  const findMatchesAPI = initFindMatchesTool(
    document.getElementById('pp-tool-pane-find-matches'), sidebarEl
  );
  const conceptMapAPI = initConceptMapTool(
    document.getElementById('pp-tool-pane-concept-map'), sidebarEl
  );
  const clustersAPI = initClustersTool(
    document.getElementById('pp-tool-pane-clusters'), sidebarEl
  );

  const tools = {
    'find-matches': findMatchesAPI,
    'concept-map':  conceptMapAPI,
    'clusters':     clustersAPI,
  };

  let _activeTool = 'find-matches';

  document.getElementById('pp-tool-nav').addEventListener('click', e => {
    const btn = e.target.closest('.pp-tool-btn');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === _activeTool) return;
    if (typeof clearSelection === 'function') clearSelection();
    tools[_activeTool]?.reset?.();
    _activeTool = tool;
    document.querySelectorAll('.pp-tool-btn').forEach(b =>
      b.classList.toggle('pp-tool-btn-active', b.dataset.tool === tool)
    );
    document.querySelectorAll('.pp-tool-pane').forEach(p =>
      p.classList.toggle('pp-tool-pane-active', p.id === 'pp-tool-pane-' + tool)
    );
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Clusters tool  v12  (bug-fix release)
//
// Fixes vs shell v3 / clusters v10:
//   1. _zoom state variable added; applyWorldTransform includes scale(_zoom)
//   2. Wheel + pinch zoom wired up (were missing from shell copy entirely)
//   3. buildCard: removed pp-cl-card-head (badge label + tab name) — content only
//   4. Sub-cluster (depth-1) drag: uses CSS transform:translate instead of
//      left/top which doesn't work on flex-positioned elements
//   5. Drag deltas divided by _zoom so movement is 1:1 at any zoom level
// ════════════════════════════════════════════════════════════════════════════
function initClustersTool(paneEl, sidebarEl) {

  // ── Styles ──────────────────────────────────────────────────────────────
  if (!document.getElementById('pp-cluster-styles')) {
    const s = document.createElement('style');
    s.id = 'pp-cluster-styles';
    s.textContent = `
#pp-cl-head {
  flex-shrink:0; padding:10px 12px 8px;
  border-bottom:1px solid var(--sidebar-box-border,rgba(0,0,0,.1));
  display:flex; flex-direction:column; gap:5px;
}
#pp-cl-subtitle {
  font-size:11px; font-weight:500; color:rgba(0,0,0,.45);
  letter-spacing:.04em; line-height:1.3; min-height:14px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#pp-cl-status {
  display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:6px;
  font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
  transition:opacity .6s ease, background .4s ease;
}
#pp-cl-status.cl-loading { background:rgba(0,0,0,.06); color:rgba(0,0,0,.4); }
#pp-cl-status.cl-ready   { background:rgba(60,180,100,.12); color:rgba(30,130,60,.9); }
#pp-cl-status.cl-error   { background:rgba(200,60,60,.10); color:rgba(180,40,40,.85); }
.pp-cl-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .4s; }
#pp-cl-status.cl-loading .pp-cl-dot { background:rgba(0,0,0,.25);animation:pp-cl-pulse 1.2s ease-in-out infinite; }
#pp-cl-status.cl-ready .pp-cl-dot   { background:rgba(40,160,80,.9); }
#pp-cl-status.cl-error .pp-cl-dot   { background:rgba(180,40,40,.85); }
@keyframes pp-cl-pulse { 0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);} }

#pp-cl-controls { display:flex; flex-direction:column; gap:4px; }
#pp-cl-sliders { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; align-items:center; }
.pp-cl-slider-col { display:flex; flex-direction:column; gap:2px; }
.pp-cl-group-label { font-size:7px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(0,0,0,.28);line-height:1;margin-bottom:1px; }
.pp-cl-range-row { display:flex;align-items:center;gap:3px; }
.pp-cl-range-label { font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.35);flex-shrink:0;width:18px; }
.pp-cl-range-val { font-size:9px;font-weight:700;color:rgba(0,0,0,.55);flex-shrink:0;width:12px;text-align:right; }
.pp-cl-range {
  -webkit-appearance:none;appearance:none;flex:1;height:3px;border-radius:2px;
  background:rgba(0,0,0,.12);outline:none;cursor:pointer;min-width:0;
}
.pp-cl-range::-webkit-slider-thumb {
  -webkit-appearance:none;appearance:none;width:11px;height:11px;border-radius:50%;
  background:var(--color-topbar-sheet,#111);box-shadow:0 1px 3px rgba(0,0,0,.22);cursor:pointer;transition:transform .12s;
}
.pp-cl-range::-webkit-slider-thumb:hover { transform:scale(1.2); }
.pp-cl-range::-moz-range-thumb { width:11px;height:11px;border-radius:50%;border:none;background:var(--color-topbar-sheet,#111);cursor:pointer; }
.pp-cl-btn-col { display:flex;align-items:stretch;justify-content:stretch;align-self:stretch;height:100%; }
#pp-cl-recluster {
  flex:1;border:none;border-radius:5px;padding:4px 6px;
  font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:rgba(0,0,0,.07);color:rgba(0,0,0,.45);cursor:pointer;
  transition:background .15s,color .15s;display:flex;align-items:center;justify-content:center;
  text-align:center;line-height:1.3;white-space:nowrap;
}
#pp-cl-recluster:hover { background:rgba(0,0,0,.13);color:rgba(0,0,0,.75); }
#pp-cl-recluster.pp-cl-reclustering { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }

/* ══ Canvas ══ */
#pp-cl-canvas {
  flex:1; min-height:0; overflow:hidden; position:relative;
  cursor:default; user-select:none;
}
#pp-cl-canvas.pp-cl-panning { cursor:grabbing !important; }
#pp-cl-canvas-world {
  position:absolute; top:0; left:0; width:100%; height:100%;
  transform-origin:0 0; will-change:transform;
}
#pp-cl-empty {
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:8px;
  font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(0,0,0,.25); text-align:center; padding:24px; pointer-events:none;
}
#pp-cl-zoom-hint {
  position:absolute; bottom:7px; right:9px; font-size:9px; font-weight:600;
  letter-spacing:.05em; color:rgba(0,0,0,.22); pointer-events:none; z-index:20;
}

/* ── Nests ── */
.pp-cl-nest {
  position:relative; flex-shrink:0; display:flex; flex-direction:column;
  overflow:hidden; box-sizing:border-box;
  animation:pp-cl-nest-in .30s cubic-bezier(0.22,1,0.36,1) both;
  transition:box-shadow .18s ease;
}
@keyframes pp-cl-nest-in { from{opacity:0;transform:scale(.92);}to{opacity:1;transform:none;} }
.pp-cl-nest[data-depth="0"] {
  position:absolute; border-radius:16px; border-width:2px; border-style:solid;
  box-shadow:0 2px 14px rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="0"].pp-cl-nest-lifted { box-shadow:0 10px 36px rgba(0,0,0,.20); }
.pp-cl-nest[data-depth="1"] { border-radius:11px;border-width:1.5px;border-style:solid;box-shadow:0 1px 7px rgba(0,0,0,.07); }
.pp-cl-nest[data-depth="2"] { border-radius:8px;border-width:1px;border-style:dashed;box-shadow:0 1px 4px rgba(0,0,0,.05); }
.pp-cl-nest[data-depth="3"] { border-radius:6px;border-width:1px;border-style:dotted; }

/* depth-1 dragging — lifted shadow */
.pp-cl-nest[data-depth="1"].pp-cl-nest-lifted { box-shadow:0 6px 22px rgba(0,0,0,.18); z-index:50; }

/* ── Nest head ── */
.pp-cl-nest-head {
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  border-bottom:1px solid rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-head { cursor:grab; padding:6px 8px 5px; }
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-head:active { cursor:grabbing; }
.pp-cl-nest[data-depth="1"] > .pp-cl-nest-head { cursor:grab; padding:4px 7px; }
.pp-cl-nest[data-depth="1"] > .pp-cl-nest-head:active { cursor:grabbing; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-head { padding:3px 6px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-head { padding:2px 5px; }
.pp-cl-nest-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-dot { width:6px;height:6px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-dot { width:5px;height:5px;opacity:.8; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-dot { width:5px;height:5px;opacity:.6; }
.pp-cl-nest-count {
  font-weight:500; color:rgba(0,0,0,.35); flex:1;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pp-cl-nest[data-depth="0"] .pp-cl-nest-count { font-size:8px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-count { font-size:7px; }
.pp-cl-nest[data-depth="3"] .pp-cl-nest-count { font-size:6px; }

/* ── Nest body ── */
.pp-cl-nest-body {
  display:flex; flex-wrap:wrap; overflow:hidden; box-sizing:border-box;
}
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-body { cursor:grab; overflow:hidden; }
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-body.pp-cl-body-panning { cursor:grabbing; }
.pp-cl-body-inner { display:flex; flex-wrap:wrap; will-change:transform; }

/* ── Cards: content only, no header row ── */
.pp-cl-card {
  flex-shrink:0; border-radius:7px;
  border:1.5px solid var(--ppc-border,rgba(0,0,0,.18));
  background:var(--ppc-bg,#fff);
  box-sizing:border-box; overflow:hidden;
  animation:pp-cl-card-in .22s cubic-bezier(0.22,1,0.36,1) both;
  cursor:default;
}
@keyframes pp-cl-card-in { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;} }
.pp-cl-card-body { padding:5px 6px 5px; display:flex; flex-direction:column; gap:2px; }
.pp-cl-card-cat { font-size:8px;font-weight:500;color:rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.pp-cl-card-text { font-size:9px;font-weight:500;color:rgba(0,0,0,.78);line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden; }

/* ── Resize handles ── */
.pp-cl-resize-handle {
  position:absolute; width:14px; height:14px; z-index:10; opacity:0; transition:opacity .15s;
}
.pp-cl-nest[data-depth="0"]:hover .pp-cl-resize-handle,
.pp-cl-nest[data-depth="1"]:hover .pp-cl-resize-handle { opacity:1; }
.pp-cl-resize-handle.pp-cl-rh-nw { top:0; left:0; cursor:nw-resize; }
.pp-cl-resize-handle.pp-cl-rh-ne { top:0; right:0; cursor:ne-resize; }
.pp-cl-resize-handle.pp-cl-rh-sw { bottom:0; left:0; cursor:sw-resize; }
.pp-cl-resize-handle.pp-cl-rh-se { bottom:0; right:0; cursor:se-resize; }
.pp-cl-resize-handle::after {
  content:''; position:absolute; right:3px; bottom:3px;
  width:5px; height:5px;
  border-right:2px solid rgba(0,0,0,.25); border-bottom:2px solid rgba(0,0,0,.25);
  border-radius:1px;
}
.pp-cl-rh-nw::after { right:auto; bottom:auto; left:3px; top:3px; border-right:none; border-bottom:none; border-left:2px solid rgba(0,0,0,.25); border-top:2px solid rgba(0,0,0,.25); }
.pp-cl-rh-ne::after { right:3px; bottom:auto; top:3px; border-right:2px solid rgba(0,0,0,.25); border-bottom:none; border-top:2px solid rgba(0,0,0,.25); }
.pp-cl-rh-sw::after { right:auto; bottom:3px; left:3px; border-right:none; border-left:2px solid rgba(0,0,0,.25); border-bottom:2px solid rgba(0,0,0,.25); }

/* ── Tooltip ── */
#pp-cl-tooltip {
  position:fixed; z-index:9999; pointer-events:none; opacity:0; transition:opacity .12s; max-width:220px;
  background:rgba(20,20,24,.93); border-radius:8px; padding:8px 10px;
  box-shadow:0 4px 18px rgba(0,0,0,.28); color:#fff;
}
#pp-cl-tooltip.pp-cl-tt-visible { pointer-events:auto; opacity:1; }
.pp-cl-tooltip-cluster { font-size:8px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;opacity:.5;margin-bottom:3px; }
.pp-cl-tooltip-text { font-size:11px;font-weight:500;line-height:1.45;margin-bottom:6px; }
.pp-cl-tooltip-goto { font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.65;cursor:pointer;text-align:right; }
.pp-cl-tooltip-goto:hover { opacity:1; }
`;
    document.head.appendChild(s);
  }

  // ── HTML ────────────────────────────────────────────────────────────────
  paneEl.innerHTML =
    '<div id="pp-cl-head">' +
      '<div id="pp-cl-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cl-status" class="cl-loading">' +
        '<div class="pp-cl-dot"></div><span id="pp-cl-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cl-controls">' +
        '<div id="pp-cl-sliders">' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Outer</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range" id="pp-cl-omin" type="range" min="2" max="20" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-omin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range" id="pp-cl-omax" type="range" min="2" max="20" value="12" step="1"><span class="pp-cl-range-val" id="pp-cl-omax-val">12</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Inner</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range" id="pp-cl-imin" type="range" min="2" max="12" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-imin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range" id="pp-cl-imax" type="range" min="2" max="12" value="4" step="1"><span class="pp-cl-range-val" id="pp-cl-imax-val">4</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Depth</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Lvl</span><input class="pp-cl-range" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-depth-val">2</span></div>' +
          '</div>' +
          '<div class="pp-cl-btn-col">' +
            '<button id="pp-cl-recluster">Re-cluster</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cl-canvas">' +
      '<div id="pp-cl-canvas-world"></div>' +
      '<div id="pp-cl-empty">Clusters will appear<br>once embeddings finish</div>' +
      '<div id="pp-cl-zoom-hint">scroll / pinch to zoom</div>' +
    '</div>' +
    '<div id="pp-cl-tooltip">' +
      '<div class="pp-cl-tooltip-cluster" id="pp-cl-tt-cluster"></div>' +
      '<div class="pp-cl-tooltip-text" id="pp-cl-tt-text"></div>' +
      '<div class="pp-cl-tooltip-goto" id="pp-cl-tt-goto">Go to \u2197</div>' +
    '</div>';

  const subtitle     = paneEl.querySelector('#pp-cl-subtitle');
  const statusEl     = paneEl.querySelector('#pp-cl-status');
  const labelEl      = paneEl.querySelector('#pp-cl-label');
  const canvas       = paneEl.querySelector('#pp-cl-canvas');
  const world        = paneEl.querySelector('#pp-cl-canvas-world');
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

  // ── Constants ────────────────────────────────────────────────────────────
  const LETTERS      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CARD_W       = 78;
  const TILE_COLS    = 3;
  const BODY_GAP     = [7, 5, 4, 3];
  const BODY_PAD     = [7, 5, 4, 3];
  const RESIZE_MIN_W = 90;
  const RESIZE_MIN_H = 50;
  const NEST_GAP     = 16;

  // ── State ────────────────────────────────────────────────────────────────
  let _outerMin = 2, _outerMax = 12, _innerMin = 2, _innerMax = 4, _depth = 2;
  let _rendered = false, _ttRow = null;
  let _cachedEmbedded = null, _cachedVectors = null;
  let _reclusterTimer = null;
  // FIX 1: _zoom added to state
  let _panX = 0, _panY = 0, _zoom = 1;
  let _topZ = 10;

  // FIX 2: applyWorldTransform now includes scale(_zoom)
  function applyWorldTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }

  function e(t) { return typeof panelEscH === 'function' ? panelEscH(t) : String(t); }

  function setStatus(state, text) {
    statusEl.className = 'cl-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders ──────────────────────────────────────────────────────────────
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

  // ── Canvas pan (drag on empty space) ────────────────────────────────────
  let _panActive = false, _panSX = 0, _panSY = 0, _panBaseX = 0, _panBaseY = 0;

  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('.pp-cl-nest')) return;
    _panActive = true;
    _panSX = ev.clientX; _panSY = ev.clientY;
    _panBaseX = _panX;   _panBaseY = _panY;
    canvas.classList.add('pp-cl-panning');
    ev.preventDefault();
  });
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-nest')) return;
    _panActive = true;
    _panSX = ev.touches[0].clientX; _panSY = ev.touches[0].clientY;
    _panBaseX = _panX; _panBaseY = _panY;
  }, { passive: true });
  document.addEventListener('mousemove', ev => {
    if (!_panActive) return;
    _panX = _panBaseX + (ev.clientX - _panSX);
    _panY = _panBaseY + (ev.clientY - _panSY);
    applyWorldTransform();
  });
  document.addEventListener('mouseup', () => {
    if (!_panActive) return;
    _panActive = false;
    canvas.classList.remove('pp-cl-panning');
  });
  document.addEventListener('touchmove', ev => {
    if (!_panActive || ev.touches.length !== 1) return;
    _panX = _panBaseX + (ev.touches[0].clientX - _panSX);
    _panY = _panBaseY + (ev.touches[0].clientY - _panSY);
    applyWorldTransform();
    ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { _panActive = false; });

  // FIX 3: Wheel + pinch zoom (was entirely missing from previous shell copy)
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const dz = ev.deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.max(0.15, Math.min(4, _zoom * dz));
    _panX = mx - (mx - _panX) * nz / _zoom;
    _panY = my - (my - _panY) * nz / _zoom;
    _zoom = nz;
    applyWorldTransform();
  }, { passive: false });

  let _pinchD = null;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length === 2) {
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      _pinchD = Math.hypot(dx, dy);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 2 || !_pinchD) return;
    const dx = ev.touches[0].clientX - ev.touches[1].clientX;
    const dy = ev.touches[0].clientY - ev.touches[1].clientY;
    const d = Math.hypot(dx, dy);
    _zoom = Math.max(0.15, Math.min(4, _zoom * d / _pinchD));
    _pinchD = d;
    applyWorldTransform();
    ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchD = null; });

  // ── Nest drag ────────────────────────────────────────────────────────────
  // FIX 4+5: depth-0 uses left/top (absolute), depth-1 uses CSS translate
  // (left/top have no effect on flex-positioned elements).
  // All deltas divided by _zoom for 1:1 feel at any zoom level.
  let _nestDrag = null;

  function makeNestDraggable(nestEl) {
    const head = nestEl.querySelector(':scope > .pp-cl-nest-head');
    if (!head) return;
    const depth = parseInt(nestEl.dataset.depth) || 0;

    function getPos() {
      if (depth === 0) {
        return [parseInt(nestEl.style.left) || 0, parseInt(nestEl.style.top) || 0];
      }
      // depth-1: read from existing transform
      const m = (nestEl.style.transform || '').match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      return [parseFloat(m?.[1]) || 0, parseFloat(m?.[2]) || 0];
    }

    function setPos(x, y) {
      if (depth === 0) {
        nestEl.style.left = x + 'px';
        nestEl.style.top  = y + 'px';
      } else {
        nestEl.style.transform = `translate(${x}px,${y}px)`;
      }
    }

    function beginDrag(cx, cy) {
      const [ex, ey] = getPos();
      _nestDrag = { el: nestEl, startElX: ex, startElY: ey, startCX: cx, startCY: cy, setPos };
      nestEl.style.zIndex = String(++_topZ);
      nestEl.classList.add('pp-cl-nest-lifted');
      hideTooltip();
    }

    head.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation();
      ev.preventDefault();
      beginDrag(ev.clientX, ev.clientY);
    });
    head.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation();
      beginDrag(ev.touches[0].clientX, ev.touches[0].clientY);
    }, { passive: false });
  }

  document.addEventListener('mousemove', ev => {
    if (!_nestDrag) return;
    _nestDrag.setPos(
      _nestDrag.startElX + (ev.clientX - _nestDrag.startCX) / _zoom,
      _nestDrag.startElY + (ev.clientY - _nestDrag.startCY) / _zoom
    );
  });
  document.addEventListener('mouseup', () => {
    if (!_nestDrag) return;
    _nestDrag.el.classList.remove('pp-cl-nest-lifted');
    _nestDrag = null;
  });
  document.addEventListener('touchmove', ev => {
    if (!_nestDrag || ev.touches.length !== 1) return;
    ev.preventDefault();
    _nestDrag.setPos(
      _nestDrag.startElX + (ev.touches[0].clientX - _nestDrag.startCX) / _zoom,
      _nestDrag.startElY + (ev.touches[0].clientY - _nestDrag.startCY) / _zoom
    );
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!_nestDrag) return;
    _nestDrag.el.classList.remove('pp-cl-nest-lifted');
    _nestDrag = null;
  });

  // ── Inner body pan for depth-0 nests ─────────────────────────────────────
  function makeBodyPannable(bodyEl, innerEl) {
    let active = false, sx = 0, sy = 0, bx = 0, by = 0;
    function getBxy() {
      const m = (innerEl.style.transform || '').match(/translate\(([^,]+)px,([^)]+)px\)/) || [];
      return [parseFloat(m[1]) || 0, parseFloat(m[2]) || 0];
    }
    bodyEl.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('.pp-cl-nest[data-depth="1"]')) return;
      active = true; [bx, by] = getBxy(); sx = ev.clientX; sy = ev.clientY;
      bodyEl.classList.add('pp-cl-body-panning'); ev.stopPropagation();
    });
    document.addEventListener('mousemove', ev => {
      if (!active) return;
      innerEl.style.transform = `translate(${bx + (ev.clientX - sx) / _zoom}px,${by + (ev.clientY - sy) / _zoom}px)`;
    });
    document.addEventListener('mouseup', () => {
      if (!active) return; active = false; bodyEl.classList.remove('pp-cl-body-panning');
    });
    bodyEl.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-nest[data-depth="1"]')) return;
      active = true; [bx, by] = getBxy(); sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
      ev.stopPropagation();
    }, { passive: true });
    document.addEventListener('touchmove', ev => {
      if (!active || ev.touches.length !== 1) return;
      innerEl.style.transform = `translate(${bx + (ev.touches[0].clientX - sx) / _zoom}px,${by + (ev.touches[0].clientY - sy) / _zoom}px)`;
    }, { passive: true });
    document.addEventListener('touchend', () => { active = false; });
  }

  // ── Corner resize ────────────────────────────────────────────────────────
  function makeResizable(nestEl) {
    const corners = [
      { cls: 'nw', dw: -1, dh: -1 }, { cls: 'ne', dw:  1, dh: -1 },
      { cls: 'sw', dw: -1, dh:  1 }, { cls: 'se', dw:  1, dh:  1 },
    ];
    corners.forEach(({ cls, dw, dh }) => {
      const handle = document.createElement('div');
      handle.className = 'pp-cl-resize-handle pp-cl-rh-' + cls;
      nestEl.appendChild(handle);
      let active = false, sx, sy, sw, sh;
      const onDown = (cx, cy) => {
        active = true; sx = cx; sy = cy;
        sw = nestEl.offsetWidth; sh = nestEl.offsetHeight;
        document.body.style.cursor = (cls === 'nw' || cls === 'se') ? 'nwse-resize' : 'nesw-resize';
        document.body.style.userSelect = 'none';
      };
      const onMove = (cx, cy) => {
        if (!active) return;
        nestEl.style.width  = Math.max(RESIZE_MIN_W, sw + dw * (cx - sx) / _zoom) + 'px';
        nestEl.style.height = Math.max(RESIZE_MIN_H, sh + dh * (cy - sy) / _zoom) + 'px';
      };
      const onUp = () => {
        if (!active) return; active = false;
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMM); document.removeEventListener('mouseup', onMU);
        document.removeEventListener('touchmove', onTM); document.removeEventListener('touchend', onTE);
      };
      const onMM = ev => onMove(ev.clientX, ev.clientY);
      const onMU = () => onUp();
      const onTM = ev => { if (!active || !ev.touches.length) return; ev.preventDefault(); onMove(ev.touches[0].clientX, ev.touches[0].clientY); };
      const onTE = () => onUp();
      handle.addEventListener('mousedown', ev => {
        if (ev.button !== 0) return;
        ev.stopPropagation(); ev.preventDefault();
        onDown(ev.clientX, ev.clientY);
        document.addEventListener('mousemove', onMM); document.addEventListener('mouseup', onMU);
      });
      handle.addEventListener('touchstart', ev => {
        if (ev.touches.length !== 1) return;
        ev.stopPropagation(); ev.preventDefault();
        onDown(ev.touches[0].clientX, ev.touches[0].clientY);
        document.addEventListener('touchmove', onTM, { passive: false }); document.addEventListener('touchend', onTE);
      }, { passive: false });
    });
  }

  // FIX 3 (cards): removed pp-cl-card-head block (badge label + tab name)
  // Cards now show content text only, with optional category row
  function buildCard(r, col, delay) {
    const cells  = r.row && r.row.cells ? r.row.cells : [];
    const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const best   = cells.reduce((b, c) => c.length > b.length ? c : b, '');
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };

    const card = document.createElement('div');
    card.className = 'pp-cl-card';
    card.style.width = CARD_W + 'px';
    card.style.setProperty('--ppc-border', col.accentSolid + '88');
    card.style.setProperty('--ppc-bg', col.bg);
    if (delay) card.style.animationDelay = delay + 'ms';

    const body = document.createElement('div');
    body.className = 'pp-cl-card-body';
    if (cats.length) {
      const ce = document.createElement('div');
      ce.className = 'pp-cl-card-cat';
      ce.textContent = cats.join(' \u00b7 ');
      body.appendChild(ce);
    }
    const te = document.createElement('div');
    te.className = 'pp-cl-card-text';
    te.textContent = parsed.body;
    body.appendChild(te);
    card.appendChild(body);

    card.addEventListener('mouseenter', ev => showTooltip(ev, r, parsed.body, col.accentSolid));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  // ── Recursive nest builder ───────────────────────────────────────────────
  function buildNestRecursive(rows, depth, maxDepth, path) {
    const col    = colorForPath(path);
    const isLeaf = (depth >= maxDepth);
    const gap    = BODY_GAP[Math.min(depth, BODY_GAP.length - 1)];
    const pad    = BODY_PAD[Math.min(depth, BODY_PAD.length - 1)];

    let children = null;
    if (!isLeaf) {
      const minK = depth === 0 ? _outerMin : _innerMin;
      const maxK = depth === 0 ? _outerMax : _innerMax;
      const asgn = autoCluster(rows, minK, maxK);
      const numC = Math.max(...asgn, 0) + 1;
      const groups = Array.from({ length: numC }, () => []);
      rows.forEach((r, i) => groups[asgn[i]].push(r));
      children = groups.map((members, ci) => ({ members, childPath: [...path, ci] }));
    }

    const nest = document.createElement('div');
    nest.className = 'pp-cl-nest';
    nest.setAttribute('data-depth', String(depth));
    nest.style.borderColor = col.accentSolid + (depth === 0 ? '55' : '33');
    nest.style.background  = col.accentSolid + (depth === 0 ? '0a' : '07');
    if (depth > 0) nest.style.animationDelay = ((path[path.length - 1] || 0) * 30) + 'ms';

    // Head: coloured dot + count only (no alphanumeric label)
    const countLabel = rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies');
    const subLabel   = children ? ' \u00b7 ' + children.length + ' group' + (children.length === 1 ? '' : 's') : '';
    const head = document.createElement('div');
    head.className = 'pp-cl-nest-head';
    head.style.background = col.accentSolid + (depth === 0 ? '18' : '10');
    const dot = document.createElement('span');
    dot.className = 'pp-cl-nest-dot';
    dot.style.background = col.accentSolid;
    const cnt = document.createElement('span');
    cnt.className = 'pp-cl-nest-count';
    cnt.textContent = countLabel + subLabel;
    head.appendChild(dot);
    head.appendChild(cnt);
    nest.appendChild(head);

    const body = document.createElement('div');
    body.className = 'pp-cl-nest-body';
    body.style.gap = gap + 'px';
    body.style.padding = pad + 'px';
    nest.appendChild(body);

    // depth-0: wrap content in inner div for inner pan
    let contentEl = body;
    if (depth === 0) {
      const inner = document.createElement('div');
      inner.className = 'pp-cl-body-inner';
      inner.style.gap = gap + 'px';
      body.appendChild(inner);
      contentEl = inner;
      makeBodyPannable(body, inner);
    }

    if (isLeaf) {
      rows.forEach((r, ri) => contentEl.appendChild(buildCard(r, col, ri * 14)));
      nest.style.width = nestInitialWidth(depth, rows.length, true) + 'px';
    } else {
      let childNestW = 0;
      const childEls = (children || [])
        .filter(c => c.members.length > 0)
        .map(({ members, childPath }) => {
          const child = buildNestRecursive(members, depth + 1, maxDepth, childPath);
          childNestW = Math.max(childNestW, parseInt(child.style.width) || 180);
          contentEl.appendChild(child);
          // FIX 4: depth-1 nests are now draggable via makeNestDraggable
          if (depth + 1 === 1) makeNestDraggable(child);
          return child;
        });
      nest.style.width = nestInitialWidth(depth, childEls.length, false, childNestW + gap) + 'px';
    }

    makeResizable(nest);
    if (depth === 0) makeNestDraggable(nest);
    return nest;
  }

  // ── Main render ──────────────────────────────────────────────────────────
  function render(rows) {
    Array.from(world.children).forEach(c => c.remove());
    emptyEl.style.display = 'none';
    _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform();
    _topZ = 10;

    const maxDepth  = _depth - 1;
    const topAsgn   = autoCluster(rows, _outerMin, _outerMax);
    const numTop    = Math.max(...topAsgn, 0) + 1;
    const topGroups = Array.from({ length: numTop }, () => []);
    rows.forEach((r, i) => topGroups[topAsgn[i]].push(r));

    const nestEls = [];
    topGroups.forEach((members, oi) => {
      if (!members.length) return;
      const nest = buildNestRecursive(members, 0, maxDepth, [oi]);
      nest.style.animationDelay = (oi * 55) + 'ms';
      world.appendChild(nest);
      nestEls.push(nest);
    });

    requestAnimationFrame(() => {
      const canvasW = canvas.offsetWidth || 400;
      let curX = NEST_GAP, curY = NEST_GAP, rowH = 0;
      nestEls.forEach(n => {
        const nw = n.offsetWidth  || parseInt(n.style.width)  || 200;
        const nh = n.offsetHeight || 200;
        if (curX + nw > canvasW - NEST_GAP && curX > NEST_GAP) {
          curX = NEST_GAP; curY += rowH + NEST_GAP; rowH = 0;
        }
        n.style.left = curX + 'px';
        n.style.top  = curY + 'px';
        curX += nw + NEST_GAP;
        rowH = Math.max(rowH, nh);
      });
    });

    subtitle.textContent =
      numTop + ' cluster' + (numTop === 1 ? '' : 's') +
      ' \u00b7 ' + rows.length + ' entries' +
      ' \u00b7 ' + _depth + ' level' + (_depth === 1 ? '' : 's');
    _rendered = true;
  }

  // ── Tooltip ──────────────────────────────────────────────────────────────
  function showTooltip(ev, r, text, accentColor) {
    _ttRow = r;
    ttCluster.textContent = '';
    ttCluster.style.color = accentColor;
    ttText.textContent = text.slice(0, 160) + (text.length > 160 ? '\u2026' : '');
    ttGoto.style.color = accentColor;
    tooltip.classList.add('pp-cl-tt-visible');
    moveTooltip(ev);
  }
  function moveTooltip(ev) {
    const pad = 12, tw = tooltip.offsetWidth || 220, th = tooltip.offsetHeight || 80;
    let lx = ev.clientX + pad, ly = ev.clientY + pad;
    if (lx + tw > window.innerWidth)  lx = ev.clientX - tw - pad;
    if (ly + th > window.innerHeight) ly = ev.clientY - th - pad;
    tooltip.style.left = lx + 'px';
    tooltip.style.top  = ly + 'px';
  }
  function hideTooltip() { tooltip.classList.remove('pp-cl-tt-visible'); _ttRow = null; }

  ttGoto.addEventListener('click', () => {
    if (!_ttRow) return;
    hideTooltip();
    if (typeof panelGoTo === 'function')
      panelGoTo({ tabIdx: _ttRow.tabIdx, rowIdx: _ttRow.rowIdx, row: _ttRow.row, shared: new Set() }, 0);
  });

  // ── Clustering (k-medoids on dim-fingerprint Jaccard distance) ───────────
  function topDims(vec, n) {
    return vec.map((v, i) => ({ i, v: Math.abs(v) }))
      .sort((a, b) => b.v - a.v).slice(0, n || 5).map(d => d.i);
  }
  function dimJaccard(a, b) {
    const sa = new Set(a); let inter = 0;
    b.forEach(d => { if (sa.has(d)) inter++; });
    const u = new Set([...a, ...b]).size;
    return u === 0 ? 0 : inter / u;
  }
  function buildDist(rows) {
    const n = rows.length;
    const fps = rows.map(r => {
      const v = _cachedVectors.get(r.tabIdx + ':' + r.rowIdx);
      return v ? topDims(v, 5) : [];
    });
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? 0 : 1 - dimJaccard(fps[i], fps[j])));
  }
  function kMedoids(dist, n, k) {
    const meds = [Math.floor(Math.random() * n)];
    while (meds.length < k) {
      const md = Array.from({ length: n }, (_, i) => Math.min(...meds.map(m => dist[i][m])));
      const tot = md.reduce((a, b) => a + b, 0);
      let r = Math.random() * tot, cum = 0, added = false;
      for (let i = 0; i < n; i++) { cum += md[i]; if (cum >= r) { meds.push(i); added = true; break; } }
      if (!added) meds.push(Math.floor(Math.random() * n));
    }
    let asgn = new Array(n).fill(0);
    for (let iter = 0; iter < 30; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        meds.forEach((m, ci) => { if (dist[i][m] < bd) { bd = dist[i][m]; best = ci; } });
        if (asgn[i] !== best) { asgn[i] = best; changed = true; }
      }
      if (!changed) break;
      for (let ci = 0; ci < k; ci++) {
        const mb = asgn.map((a, i) => a === ci ? i : -1).filter(x => x >= 0);
        if (!mb.length) continue;
        let bm = mb[0], bs = Infinity;
        mb.forEach(m => { const s = mb.reduce((a, o) => a + dist[m][o], 0); if (s < bs) { bs = s; bm = m; } });
        meds[ci] = bm;
      }
    }
    let variance = 0;
    for (let ci = 0; ci < k; ci++) {
      const mb = asgn.map((a, i) => a === ci ? i : -1).filter(x => x >= 0);
      if (mb.length < 2) continue;
      mb.forEach(m => mb.forEach(o => { variance += dist[m][o]; }));
    }
    return { asgn, variance: variance / (n * n) };
  }
  function autoCluster(rows, minK, maxK) {
    const n = rows.length;
    if (n === 0) return [];
    if (n <= 2) return new Array(n).fill(0).map((_, i) => i);
    const dist  = buildDist(rows);
    const sqrtN = Math.max(2, Math.round(Math.sqrt(n)));
    minK = Math.max(2, minK || 2);
    maxK = Math.min(Math.max(minK, maxK || 6), sqrtN * 2, n - 1);
    if (maxK < minK) return new Array(n).fill(0);
    if (minK === maxK) {
      let best = null;
      for (let t = 0; t < 4; t++) { const r = kMedoids(dist, n, minK); if (!best || r.variance < best.variance) best = r; }
      return best.asgn;
    }
    const results = [];
    for (let k = minK; k <= maxK; k++) {
      let best = null;
      for (let t = 0; t < 4; t++) { const r = kMedoids(dist, n, k); if (!best || r.variance < best.variance) best = r; }
      results.push({ k, ...best });
    }
    const vars  = results.map(r => r.variance);
    const range = (vars[0] - vars[vars.length - 1]) || 1;
    let chosenK = results[0].k;
    for (let i = 1; i < results.length; i++) {
      if ((vars[i - 1] - vars[i]) / range < 0.10) { chosenK = results[i - 1].k; break; }
      chosenK = results[i].k;
    }
    chosenK = Math.max(minK, Math.min(maxK, chosenK));
    return (results.find(r => r.k === chosenK) || results[results.length - 1]).asgn;
  }

  // ── Colour per path ──────────────────────────────────────────────────────
  function colorForPath(path) {
    const outerIdx = path[0] || 0;
    const depth    = path.length;
    const tname = (typeof TAB_THEMES !== 'undefined' ?
      TAB_THEMES[outerIdx % TAB_THEMES.length] : 'default') || 'default';
    const theme  = (typeof THEMES !== 'undefined' ? (THEMES[tname] || THEMES.default) : {}) || {};
    const accent = theme['--tab-active-bg']    || '#888';
    const label  = theme['--tab-active-color'] || '#fff';
    const bg     = theme['--bg-data']          || '#f8f8f8';
    const alphaAccent = Math.max(0.35, 1 - (depth - 1) * 0.18);
    return {
      accent:      accent + Math.round(alphaAccent * 255).toString(16).padStart(2, '0'),
      accentSolid: accent, label, bg
    };
  }

  // ── Initial width calculation ────────────────────────────────────────────
  function nestInitialWidth(depth, childCount, isLeaf, childWidth) {
    const gap  = BODY_GAP[Math.min(depth, BODY_GAP.length - 1)];
    const pad  = BODY_PAD[Math.min(depth, BODY_PAD.length - 1)];
    const cw   = isLeaf ? CARD_W : (childWidth || 180);
    const cols = Math.min(TILE_COLS, Math.max(1, Math.ceil(Math.sqrt(Math.max(1, childCount)))));
    return cols * cw + (cols - 1) * gap + pad * 2;
  }

  // ── Fetch + render pipeline ──────────────────────────────────────────────
  function finishRender(embedded) {
    try { render(embedded); }
    catch (err) { console.error('[clusters]', err); setStatus('error', 'Clustering failed'); }
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
      const text = ((r.row && r.row.cells) ? r.row.cells : (r.cells || [])).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx + ':' + r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map();
      results.forEach(res => { if (res && res.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) {
        setStatus('error', 'No vectors');
        emptyEl.textContent = 'No embeddings'; emptyEl.style.display = 'flex'; return;
      }
      const embedded = rows.filter(r => vectors.has(r.tabIdx + ':' + r.rowIdx));
      if (embedded.length < 3) { setStatus('error', 'Not enough data'); return; }
      _cachedEmbedded = embedded; _cachedVectors = vectors;
      requestAnimationFrame(() => finishRender(embedded));
    });
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 100);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 100));
  window.addEventListener('embedding-progress', ev => {
    if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%');
  });

  return {
    reset() {
      _rendered = false; _cachedEmbedded = null; _cachedVectors = null;
      Array.from(world.children).forEach(c => c.remove());
      emptyEl.style.display = 'flex';
      _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform();
      hideTooltip();
    }
  };
}
