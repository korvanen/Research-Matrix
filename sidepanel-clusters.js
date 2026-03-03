// ════════════════════════════════════════════════════════════════════════════
// sidepanel-clusters.js — "Clusters" tool  v11
//
// Changes vs v10:
//  • Canvas wheel/pinch ZOOM (toward pointer) in addition to pan
//  • Cluster & sub-cluster head-bars are the ONLY draggable handles
//    (cards are NOT draggable — they stay inside their nest)
//  • Inside each depth-0 cluster the BODY is pannable (overflow:hidden + pan-on-drag)
//  • Cards: removed cluster-label badge AND tab-name span — shows ONLY card text
//  • Zoom hint label shown in bottom-right of canvas
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-clusters.js v11]');

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

/* ══ Controls ══ */
#pp-cl-controls { display: flex; flex-direction: column; gap: 4px; }
#pp-cl-sliders {
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px; align-items: center;
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
.pp-cl-btn-col {
  display: flex; align-items: stretch; justify-content: stretch; align-self: stretch; height: 100%;
}
#pp-cl-recluster {
  flex: 1; border:none;border-radius:5px;padding:4px 6px;
  font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:rgba(0,0,0,.07);color:rgba(0,0,0,.45);
  cursor:pointer;transition:background .15s,color .15s;
  display:flex;align-items:center;justify-content:center;
  text-align:center;line-height:1.3;white-space:nowrap;
}
#pp-cl-recluster:hover { background:rgba(0,0,0,.13);color:rgba(0,0,0,.75); }
#pp-cl-recluster.pp-cl-reclustering { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }

/* ══ CANVAS ══ */
#pp-cl-canvas {
  flex: 1; min-height: 0;
  overflow: hidden; position: relative;
  cursor: default; user-select: none;
}
#pp-cl-canvas.pp-cl-panning { cursor: grabbing !important; }
#pp-cl-canvas-world {
  position: absolute; top: 0; left: 0; width: 0; height: 0;
  will-change: transform;
}
#pp-cl-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.25); text-align: center; padding: 24px;
  pointer-events: none;
}
#pp-cl-zoom-hint {
  position:absolute; bottom:7px; right:9px; font-size:9px; font-weight:600;
  letter-spacing:.05em; color:rgba(0,0,0,.22); pointer-events:none; z-index:9999;
}

/* ─── Nests ─── */
.pp-cl-nest {
  position: relative; flex-shrink: 0;
  display: flex; flex-direction: column;
  overflow: hidden; box-sizing: border-box;
  animation: pp-cl-nest-in .30s cubic-bezier(0.22,1,0.36,1) both;
  transition: box-shadow .18s ease;
}
@keyframes pp-cl-nest-in { from{opacity:0;transform:scale(.92);}to{opacity:1;transform:scale(1);} }

.pp-cl-nest[data-depth="0"] {
  position: absolute; border-radius: 16px; border-width: 2px; border-style: solid;
  box-shadow: 0 2px 14px rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="0"].pp-cl-nest-lifted { box-shadow: 0 10px 36px rgba(0,0,0,.20); transition: box-shadow .10s ease; }
.pp-cl-nest[data-depth="1"] { border-radius:11px;border-width:1.5px;border-style:solid;box-shadow:0 1px 7px rgba(0,0,0,.07); }
.pp-cl-nest[data-depth="2"] { border-radius:8px;border-width:1px;border-style:dashed;box-shadow:0 1px 4px rgba(0,0,0,.05); }
.pp-cl-nest[data-depth="3"] { border-radius:6px;border-width:1px;border-style:dotted;box-shadow:none; }

/* ─── Nest header — drag handle ─── */
.pp-cl-nest-head {
  display:flex;align-items:center;gap:4px;flex-shrink:0;
  border-bottom:1px solid rgba(0,0,0,.08);
}
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-head { cursor:grab; padding:5px 8px 4px; }
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-head:active { cursor:grabbing; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-head { cursor:grab; padding:3px 7px; }
.pp-cl-nest[data-depth="1"] .pp-cl-nest-head:active { cursor:grabbing; }
.pp-cl-nest[data-depth="2"] .pp-cl-nest-head { cursor:grab; padding:2px 6px; }
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

/* ─── Nest body ─── */
.pp-cl-nest-body {
  display: flex; flex-wrap: wrap;
  overflow: hidden; /* inner pan container */
  box-sizing: border-box; position: relative;
}
/* depth-0 body is pannable; inner content div scrolls */
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-body {
  overflow: hidden;
  cursor: grab;
}
.pp-cl-nest[data-depth="0"] > .pp-cl-nest-body.pp-cl-body-panning { cursor: grabbing; }
.pp-cl-nest-body-inner {
  display: flex; flex-wrap: wrap;
  will-change: transform;
}

/* ─── Cards — title ONLY (no head badge/tab) ─── */
.pp-cl-card {
  width: var(--pp-cl-card-w, 78px); flex-shrink: 0;
  border-radius: 7px; border: 1.5px solid var(--ppc-border, rgba(0,0,0,.18));
  background: var(--ppc-bg, #fff);
  display: flex; flex-direction: column;
  overflow: hidden; box-sizing: border-box;
  animation: pp-cl-card-in .22s cubic-bezier(0.22,1,0.36,1) both;
  cursor: default;
}
@keyframes pp-cl-card-in { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;} }
.pp-cl-card-body {
  padding: 5px 6px 4px; display: flex; flex-direction: column; gap: 2px;
}
/* cat row kept (small dim text above title) */
.pp-cl-card-cat {
  font-size:8px;font-weight:500;color:rgba(0,0,0,.35);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.pp-cl-card-text {
  font-size:9px;font-weight:500;color:rgba(0,0,0,.75);line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
}

/* ─── Resize handle ─── */
.pp-cl-resize-handle {
  position:absolute;right:0;bottom:0;width:14px;height:14px;
  cursor:se-resize;z-index:10;opacity:0;transition:opacity .15s;
}
.pp-cl-nest[data-depth="0"]:hover .pp-cl-resize-handle { opacity:1; }
.pp-cl-resize-handle::after {
  content:''; position:absolute;right:3px;bottom:3px;
  width:5px;height:5px;
  border-right:2px solid rgba(0,0,0,.25);border-bottom:2px solid rgba(0,0,0,.25);
  border-radius:1px;
}

/* ─── Tooltip ─── */
#pp-cl-tooltip {
  position:fixed; z-index:9999; pointer-events:none; opacity:0;
  transition:opacity .12s; max-width:220px;
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
})();

// ════════════════════════════════════════════════════════════════════════════
function initClustersTool(paneEl, sidebarEl) {

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
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span>' +
              '<input class="pp-cl-range" id="pp-cl-omin" type="range" min="2" max="20" value="2" step="1">' +
              '<span class="pp-cl-range-val" id="pp-cl-omin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span>' +
              '<input class="pp-cl-range" id="pp-cl-omax" type="range" min="2" max="20" value="12" step="1">' +
              '<span class="pp-cl-range-val" id="pp-cl-omax-val">12</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Inner</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-inner">Min</span>' +
              '<input class="pp-cl-range pp-cl-inner" id="pp-cl-imin" type="range" min="2" max="12" value="2" step="1">' +
              '<span class="pp-cl-range-val" id="pp-cl-imin-val">2</span></div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-inner">Max</span>' +
              '<input class="pp-cl-range pp-cl-inner" id="pp-cl-imax" type="range" min="2" max="12" value="4" step="1">' +
              '<span class="pp-cl-range-val" id="pp-cl-imax-val">4</span></div>' +
          '</div>' +
          '<div class="pp-cl-slider-col">' +
            '<div class="pp-cl-group-label">Depth</div>' +
            '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-depth">Lvl</span>' +
              '<input class="pp-cl-range pp-cl-depth" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1">' +
              '<span class="pp-cl-range-val" id="pp-cl-depth-val">2</span></div>' +
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
      '<div id="pp-cl-zoom-hint">scroll to zoom</div>' +
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

  const LETTERS      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CARD_W       = 78;
  const BODY_GAP     = [7, 5, 4, 3];
  const BODY_PAD     = [7, 5, 4, 3];
  const RESIZE_MIN_W = 90;
  const RESIZE_MIN_H = 50;
  const NEST_GAP     = 16;

  let _outerMin = 2, _outerMax = 12, _innerMin = 2, _innerMax = 4, _depth = 2;
  let _rendered = false, _ttRow = null;
  let _cachedEmbedded = null, _cachedVectors = null;
  let _reclusterTimer = null;
  let _panX = 0, _panY = 0, _zoom = 1;
  let _topZ = 10;

  function applyWorldTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
    world.style.transformOrigin = '0 0';
  }

  function e(t) { return typeof panelEscH === 'function' ? panelEscH(t) : String(t); }

  function setStatus(state, text) {
    statusEl.className = 'cl-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders ────────────────────────────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── Canvas pan (drag on empty canvas space) ────────────────────────────────
  let _panActive = false, _panSX = 0, _panSY = 0, _panBaseX = 0, _panBaseY = 0;

  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0) return;
    if (ev.target.closest('.pp-cl-nest')) return;
    _panActive = true;
    _panSX = ev.clientX; _panSY = ev.clientY;
    _panBaseX = _panX; _panBaseY = _panY;
    canvas.classList.add('pp-cl-panning');
    ev.preventDefault();
  });
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1) return;
    if (ev.target.closest('.pp-cl-nest')) return;
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

  // ── Wheel zoom (zoom toward pointer) ──────────────────────────────────────
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const delta = ev.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.15, _zoom * delta));
    _panX = mx - (mx - _panX) * (newZoom / _zoom);
    _panY = my - (my - _panY) * (newZoom / _zoom);
    _zoom = newZoom;
    applyWorldTransform();
  }, { passive: false });

  // Pinch zoom
  let _pinchDist = null;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length === 2) {
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      _pinchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 2 || _pinchDist === null) return;
    const dx = ev.touches[0].clientX - ev.touches[1].clientX;
    const dy = ev.touches[0].clientY - ev.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    _zoom = Math.min(3, Math.max(0.15, _zoom * (dist / _pinchDist)));
    _pinchDist = dist;
    applyWorldTransform();
    ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchDist = null; });

  // ══════════════════════════════════════════════════════════════════════════
  // ── Free-drag for depth-0 (and sub-cluster) nests via header ──────────────
  let _nestDrag = null;

  function makeNestFreeDraggable(nestEl, depth0El) {
    // depth0El = the root depth-0 ancestor (to update its position on world)
    const head = nestEl.querySelector(':scope > .pp-cl-nest-head');
    if (!head) return;

    function beginDrag(cx, cy) {
      _nestDrag = {
        el:       nestEl,
        root:     depth0El || nestEl,
        startElX: parseInt(nestEl.style.left) || 0,
        startElY: parseInt(nestEl.style.top)  || 0,
        startCX:  cx,
        startCY:  cy,
      };
      nestEl.style.zIndex = String(++_topZ);
      nestEl.classList.add('pp-cl-nest-lifted');
      hideTooltip();
    }

    head.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation(); ev.preventDefault();
      beginDrag(ev.clientX, ev.clientY);
    });
    head.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1) return;
      if (ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation();
      beginDrag(ev.touches[0].clientX, ev.touches[0].clientY);
    }, { passive: false });
  }

  document.addEventListener('mousemove', ev => {
    if (!_nestDrag) return;
    const { el, startElX, startElY, startCX, startCY } = _nestDrag;
    el.style.left = (startElX + (ev.clientX - startCX) / _zoom) + 'px';
    el.style.top  = (startElY + (ev.clientY - startCY) / _zoom) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!_nestDrag) return;
    _nestDrag.el.classList.remove('pp-cl-nest-lifted');
    _nestDrag = null;
  });
  document.addEventListener('touchmove', ev => {
    if (!_nestDrag || ev.touches.length !== 1) return;
    const { el, startElX, startElY, startCX, startCY } = _nestDrag;
    el.style.left = (startElX + (ev.touches[0].clientX - startCX) / _zoom) + 'px';
    el.style.top  = (startElY + (ev.touches[0].clientY - startCY) / _zoom) + 'px';
    ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!_nestDrag) return;
    _nestDrag.el.classList.remove('pp-cl-nest-lifted');
    _nestDrag = null;
  });

  // ── Inner-body pan for depth-0 nests ──────────────────────────────────────
  function makeBodyPannable(bodyEl) {
    // We use an inner div that gets translated
    const inner = bodyEl.querySelector('.pp-cl-nest-body-inner');
    if (!inner) return;
    let active = false, sx = 0, sy = 0, bx = 0, by = 0;

    bodyEl.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.pp-cl-nest[data-depth="1"]')) return; // sub-cluster drags
      active = true; sx = ev.clientX; sy = ev.clientY;
      const m = (inner.style.transform.match(/translate\(([^,]+)px,([^)]+)px\)/) || []);
      bx = parseFloat(m[1]) || 0; by = parseFloat(m[2]) || 0;
      bodyEl.classList.add('pp-cl-body-panning');
      ev.stopPropagation();
    });
    document.addEventListener('mousemove', ev => {
      if (!active) return;
      const nx = bx + (ev.clientX - sx) / _zoom;
      const ny = by + (ev.clientY - sy) / _zoom;
      inner.style.transform = `translate(${nx}px,${ny}px)`;
    });
    document.addEventListener('mouseup', () => {
      if (!active) return;
      active = false; bodyEl.classList.remove('pp-cl-body-panning');
    });
    bodyEl.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1) return;
      if (ev.target.closest('.pp-cl-nest[data-depth="1"]')) return;
      active = true; sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
      const m = (inner.style.transform.match(/translate\(([^,]+)px,([^)]+)px\)/) || []);
      bx = parseFloat(m[1]) || 0; by = parseFloat(m[2]) || 0;
      ev.stopPropagation();
    }, { passive: true });
    document.addEventListener('touchmove', ev => {
      if (!active || ev.touches.length !== 1) return;
      const nx = bx + (ev.touches[0].clientX - sx) / _zoom;
      const ny = by + (ev.touches[0].clientY - sy) / _zoom;
      inner.style.transform = `translate(${nx}px,${ny}px)`;
    }, { passive: true });
    document.addEventListener('touchend', () => { active = false; });
  }

  // ── Resize handle ──────────────────────────────────────────────────────────
  function makeResizable(nestEl) {
    const handle = document.createElement('div');
    handle.className = 'pp-cl-resize-handle';
    nestEl.appendChild(handle);
    let resizing = false, startW = 0, startH = 0, startX = 0, startY = 0;
    handle.addEventListener('mousedown', ev => {
      resizing = true;
      startW = nestEl.offsetWidth; startH = nestEl.offsetHeight;
      startX = ev.clientX; startY = ev.clientY;
      ev.stopPropagation(); ev.preventDefault();
    });
    document.addEventListener('mousemove', ev => {
      if (!resizing) return;
      const nw = Math.max(RESIZE_MIN_W, startW + (ev.clientX - startX) / _zoom);
      const nh = Math.max(RESIZE_MIN_H, startH + (ev.clientY - startY) / _zoom);
      nestEl.style.width = nw + 'px';
      nestEl.style.height = nh + 'px';
    });
    document.addEventListener('mouseup', () => { resizing = false; });
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  function showTooltip(ev, r, path, col, text, cats, tabName) {
    _ttRow = r;
    const label = path.map((idx, d) => d === 0 ? (LETTERS[idx] || idx) : (idx + 1)).join('.');
    ttCluster.textContent = 'Cluster ' + label;
    ttCluster.style.color = col.accentSolid;
    ttText.textContent = text;
    tooltip.classList.add('pp-cl-tt-visible');
    moveTooltip(ev);
  }
  function moveTooltip(ev) {
    const pad = 12, tw = tooltip.offsetWidth || 200, th = tooltip.offsetHeight || 80;
    let tx = ev.clientX + pad, ty = ev.clientY + pad;
    if (tx + tw > window.innerWidth  - 6) tx = ev.clientX - tw - pad;
    if (ty + th > window.innerHeight - 6) ty = ev.clientY - th - pad;
    tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px';
  }
  function hideTooltip() { tooltip.classList.remove('pp-cl-tt-visible'); _ttRow = null; }

  ttGoto.addEventListener('click', () => {
    if (_ttRow && typeof panelGoTo === 'function') panelGoTo(_ttRow, 0);
    hideTooltip();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── Clustering algorithm (k-means) ────────────────────────────────────────
  function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }
  function autoCluster(rows, minK, maxK) {
    const n = rows.length;
    if (n <= minK) return rows.map((_, i) => i);
    const k = Math.min(maxK, Math.max(minK, Math.round(Math.sqrt(n))));
    const vecs = rows.map(r => r.vec);
    // k-means++ init
    const centers = [vecs[Math.floor(Math.random() * n)]];
    while (centers.length < k) {
      const dists = vecs.map(v => Math.min(...centers.map(c => 1 - cosineSim(v, c))));
      const sum = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum, pick = 0;
      for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { pick = i; break; } }
      centers.push(vecs[pick]);
    }
    let asgn = new Array(n).fill(0);
    for (let iter = 0; iter < 20; iter++) {
      const newAsgn = vecs.map(v => {
        let best = 0, bsim = -Infinity;
        centers.forEach((c, ci) => { const s = cosineSim(v, c); if (s > bsim) { bsim = s; best = ci; } });
        return best;
      });
      // recompute centers
      centers.forEach((_, ci) => {
        const members = vecs.filter((_, i) => newAsgn[i] === ci);
        if (!members.length) return;
        const dim = members[0].length;
        const sum = new Float32Array(dim);
        members.forEach(v => v.forEach((x, i) => { sum[i] += x; }));
        centers[ci] = sum.map(x => x / members.length);
      });
      const changed = newAsgn.some((a, i) => a !== asgn[i]);
      asgn = newAsgn;
      if (!changed) break;
    }
    return asgn;
  }

  // ── Color palette ──────────────────────────────────────────────────────────
  const PALETTE = [
    { accentSolid: '#4f7af7', label: '#fff', bg: '#f0f4ff' },
    { accentSolid: '#e05a6a', label: '#fff', bg: '#fff0f2' },
    { accentSolid: '#2eb87a', label: '#fff', bg: '#edfaf4' },
    { accentSolid: '#f59b20', label: '#fff', bg: '#fffbf0' },
    { accentSolid: '#9f6ef5', label: '#fff', bg: '#f7f0ff' },
    { accentSolid: '#20b8c8', label: '#fff', bg: '#edfbfd' },
    { accentSolid: '#d4700a', label: '#fff', bg: '#fff6ed' },
    { accentSolid: '#6aab3e', label: '#fff', bg: '#f2fbec' },
  ];
  function colorForPath(path) {
    const idx = (path[0] || 0) % PALETTE.length;
    return PALETTE[idx];
  }

  // ── nestInitialWidth ───────────────────────────────────────────────────────
  function nestInitialWidth(depth, count, isLeaf, childW) {
    const pad = (BODY_PAD[Math.min(depth, BODY_PAD.length - 1)] || 7) * 2;
    const gap = BODY_GAP[Math.min(depth, BODY_GAP.length - 1)] || 7;
    if (isLeaf) {
      const cols = Math.min(count, 3);
      return pad + cols * CARD_W + (cols - 1) * gap;
    }
    return pad + Math.min(count, 3) * (childW || 140) + Math.min(count - 1, 2) * gap;
  }

  // ── buildCard — title text only, no badge/tab label ────────────────────────
  function buildCard(r, path, col, delay) {
    const cells  = r.row && r.row.cells ? r.row.cells : [];
    const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const best   = cells.reduce((b, c) => c.length > b.length ? c : b, '');
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };

    const card = document.createElement('div');
    card.className = 'pp-cl-card';
    card.style.setProperty('--ppc-border', col.accentSolid + '77');
    card.style.setProperty('--ppc-bg', col.bg);
    if (delay) card.style.animationDelay = delay + 'ms';

    // Body: optionally category row + main text (NO badge, NO tab label)
    const body = document.createElement('div');
    body.className = 'pp-cl-card-body';
    if (cats.length) {
      const catEl = document.createElement('div');
      catEl.className = 'pp-cl-card-cat';
      catEl.textContent = cats.join(' \u00b7 ');
      body.appendChild(catEl);
    }
    const textEl = document.createElement('div');
    textEl.className = 'pp-cl-card-text';
    textEl.textContent = parsed.body;
    body.appendChild(textEl);
    card.appendChild(body);

    card.addEventListener('mouseenter', ev => showTooltip(ev, r, path, col, parsed.body, cats, ''));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  // ── buildNestRecursive ────────────────────────────────────────────────────
  function buildNestRecursive(rows, depth, maxDepth, path, depth0El) {
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

    // ── Head: count only (no path badge — clean look) ─────────────────────
    const countLabel = rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies');
    const subLabel   = children ? ' \u00b7 ' + children.length + ' group' + (children.length === 1 ? '' : 's') : '';

    const head = document.createElement('div');
    head.className = 'pp-cl-nest-head';
    head.style.background = col.accentSolid + (depth === 0 ? '18' : '10');
    // coloured dot only — no text badge
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${col.accentSolid};flex-shrink:0;`;
    const cnt = document.createElement('span');
    cnt.className = 'pp-cl-nest-count';
    cnt.textContent = countLabel + subLabel;
    head.appendChild(dot);
    head.appendChild(cnt);
    nest.appendChild(head);

    // ── Body ──────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'pp-cl-nest-body';
    body.style.gap     = gap + 'px';
    body.style.padding = pad + 'px';
    nest.appendChild(body);

    // For depth-0 use an inner scrollable div
    let contentEl = body;
    if (depth === 0) {
      const inner = document.createElement('div');
      inner.className = 'pp-cl-nest-body-inner';
      inner.style.gap     = gap + 'px';
      inner.style.padding = '0';
      body.appendChild(inner);
      contentEl = inner;
    }

    if (isLeaf) {
      rows.forEach((r, ri) => contentEl.appendChild(buildCard(r, [...path], col, ri * 14)));
      nest.style.width = nestInitialWidth(depth, rows.length, true) + 'px';
    } else {
      let childNestW = 0;
      const childEls = (children || [])
        .filter(c => c.members.length > 0)
        .map(({ members, childPath }) => {
          const child = buildNestRecursive(members, depth + 1, maxDepth, childPath, depth0El || nest);
          childNestW = Math.max(childNestW, parseInt(child.style.width) || 180);
          contentEl.appendChild(child);
          return child;
        });
      nest.style.width = nestInitialWidth(depth, childEls.length, false, childNestW + gap) + 'px';
    }

    makeResizable(nest);
    // depth-0 nests: drag via head, body is pannable
    if (depth === 0) {
      makeNestFreeDraggable(nest, null);
      makeBodyPannable(body);
    } else if (depth === 1) {
      // sub-clusters are also draggable within the inner-pan body
      makeNestFreeDraggable(nest, depth0El);
    }
    return nest;
  }

  // ── Main render ────────────────────────────────────────────────────────────
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
      const nest = buildNestRecursive(members, 0, maxDepth, [oi], null);
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
        rowH  = Math.max(rowH, nh);
      });
    });

    subtitle.textContent =
      numTop + ' cluster' + (numTop === 1 ? '' : 's') +
      ' \u00b7 ' + rows.length + ' entries';
  }

  // ── Embedding / data pipeline ──────────────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;

    if (_cachedEmbedded && _cachedVectors) { doRender(); return; }

    const rows = buildRowIndex();
    if (!rows.length) return;
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026');
    emptyEl.style.display = 'none';

    Promise.all(rows.map(r => {
      const text = (r.row?.cells || r.cells || []).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx + ':' + r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map();
      results.forEach(res => { if (res?.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) { setStatus('error', 'No vectors available'); return; }
      const embedded = rows.filter(r => vectors.has(r.tabIdx + ':' + r.rowIdx));
      if (embedded.length < 2) { setStatus('error', 'Not enough data'); return; }
      embedded.forEach(r => { r.vec = vectors.get(r.tabIdx + ':' + r.rowIdx); });
      _cachedEmbedded = embedded; _cachedVectors = vectors;
      requestAnimationFrame(doRender);
    });
  }

  function doRender() {
    reclusterBtn.classList.remove('pp-cl-reclustering');
    reclusterBtn.textContent = 'Re-cluster';
    setStatus('loading', 'Rendering\u2026');
    setTimeout(() => {
      try {
        render(_cachedEmbedded);
        setStatus('ready', 'Done');
        _rendered = true;
      } catch (err) {
        console.error('[clusters]', err);
        setStatus('error', 'Clustering failed');
      }
    }, 20);
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 120));
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
