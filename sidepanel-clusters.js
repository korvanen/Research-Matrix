// sidepanel-clusters.js — Clusters tool v12
// Changes vs v11:
//   • Semantically-aligned sub-clustering: sub-cluster index N in cluster A
//     and sub-cluster index N in cluster B will share the same semantic "theme".
//     This is achieved by computing a shared set of global theme centroids from
//     all entries combined, then mapping each top-level cluster's own sub-clusters
//     to those global themes via greedy cosine-similarity matching (Hungarian-lite).
//     Result: A1 ≈ B1 ≈ C1, A2 ≈ B2 ≈ C2, etc.
console.log('[sidepanel-clusters.js v12]');

(function injectClusterStyles() {
  if (document.getElementById('pp-cluster-styles')) return;
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
.pp-cl-range.pp-cl-inner::-webkit-slider-thumb { background:rgba(0,0,0,.38); }
.pp-cl-range.pp-cl-depth::-webkit-slider-thumb { background:rgba(100,80,200,.75); }
.pp-cl-range::-webkit-slider-thumb:hover { transform:scale(1.2); }
.pp-cl-range::-moz-range-thumb { width:11px;height:11px;border-radius:50%;border:none;background:var(--color-topbar-sheet,#111);box-shadow:0 1px 3px rgba(0,0,0,.22);cursor:pointer; }
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
  position:absolute; border-radius:10px; border:1.5px solid transparent;
  display:flex; flex-direction:column; overflow:hidden;
  box-shadow:0 2px 12px rgba(0,0,0,.08); transition:box-shadow .18s;
}
.pp-cl-nest.pp-cl-nest-lifted { box-shadow:0 8px 28px rgba(0,0,0,.18); }
.pp-cl-nest-head {
  display:flex; align-items:center; gap:6px; padding:5px 8px;
  cursor:grab; flex-shrink:0; user-select:none;
}
.pp-cl-nest-head:active { cursor:grabbing; }
.pp-cl-nest-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
.pp-cl-nest-count { font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(0,0,0,.45);white-space:nowrap; }
.pp-cl-nest-body {
  display:flex; flex-wrap:wrap; flex:1; overflow:auto;
  scrollbar-width:thin; scrollbar-color:var(--scrollbar-thumb,rgba(0,0,0,.18)) transparent;
}
.pp-cl-nest-body::-webkit-scrollbar { width:5px;height:5px; }
.pp-cl-nest-body::-webkit-scrollbar-thumb { background:var(--scrollbar-thumb,rgba(0,0,0,.18));border-radius:3px; }
.pp-cl-nest-body::-webkit-scrollbar-track { background:transparent; }
.pp-cl-body-inner { display:flex; flex-wrap:wrap; }
.pp-cl-body-panning { cursor:grabbing !important; }
.pp-cl-resize-handle {
  position:absolute; bottom:0; right:0; width:14px; height:14px; cursor:nwse-resize;
  background:linear-gradient(135deg,transparent 50%,rgba(0,0,0,.15) 50%);
  border-radius:0 0 8px 0;
}

/* ── Cards ── */
.pp-cl-card {
  border-radius:6px; border:1px solid var(--ppc-border,rgba(0,0,0,.12));
  background:var(--ppc-bg,#fff); flex-shrink:0; cursor:pointer;
  transition:transform .12s, box-shadow .12s;
  animation:pp-cl-card-in .22s cubic-bezier(0.22,1,0.36,1) both;
}
.pp-cl-card:hover { transform:translateY(-1px); box-shadow:0 3px 10px rgba(0,0,0,.12); }
@keyframes pp-cl-card-in { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;} }
.pp-cl-card-body { padding:5px 7px 6px; }
.pp-cl-card-cat { font-size:7px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.35);margin-bottom:2px; }
.pp-cl-card-text { font-size:9px;line-height:1.38;color:rgba(0,0,0,.72); }

/* ── Tooltip ── */
#pp-cl-tooltip {
  position:fixed; z-index:9999; pointer-events:none;
  background:#fff; border:1px solid rgba(0,0,0,.12); border-radius:9px;
  padding:8px 11px; max-width:240px; box-shadow:0 6px 22px rgba(0,0,0,.16);
  opacity:0; transition:opacity .14s; display:flex; flex-direction:column; gap:4px;
}
#pp-cl-tooltip.pp-cl-tt-visible { opacity:1; pointer-events:auto; }
.pp-cl-tooltip-cluster { font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase; }
.pp-cl-tooltip-text { font-size:10px;line-height:1.4;color:rgba(0,0,0,.72); }
.pp-cl-tooltip-goto {
  font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  cursor:pointer;align-self:flex-end;margin-top:2px;
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
      '<div id="pp-cl-controls"><div id="pp-cl-sliders">' +
        '<div class="pp-cl-slider-col"><div class="pp-cl-group-label">Outer</div>' +
          '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Min</span><input class="pp-cl-range" id="pp-cl-omin" type="range" min="2" max="20" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-omin-val">2</span></div>' +
          '<div class="pp-cl-range-row"><span class="pp-cl-range-label">Max</span><input class="pp-cl-range" id="pp-cl-omax" type="range" min="2" max="20" value="12" step="1"><span class="pp-cl-range-val" id="pp-cl-omax-val">12</span></div>' +
        '</div>' +
        '<div class="pp-cl-slider-col"><div class="pp-cl-group-label">Inner</div>' +
          '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-inner">Min</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imin" type="range" min="2" max="12" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-imin-val">2</span></div>' +
          '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-inner">Max</span><input class="pp-cl-range pp-cl-inner" id="pp-cl-imax" type="range" min="2" max="12" value="4" step="1"><span class="pp-cl-range-val" id="pp-cl-imax-val">4</span></div>' +
        '</div>' +
        '<div class="pp-cl-slider-col"><div class="pp-cl-group-label">Depth</div>' +
          '<div class="pp-cl-range-row"><span class="pp-cl-range-label pp-cl-depth">Lvl</span><input class="pp-cl-range pp-cl-depth" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1"><span class="pp-cl-range-val" id="pp-cl-depth-val">2</span></div>' +
        '</div>' +
        '<div class="pp-cl-btn-col"><button id="pp-cl-recluster">Re-cluster</button></div>' +
      '</div></div>' +
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
  const tooltip      = paneEl.querySelector('#pp-cl-tooltip');
  const ttCluster    = paneEl.querySelector('#pp-cl-tt-cluster');
  const ttText       = paneEl.querySelector('#pp-cl-tt-text');
  const ttGoto       = paneEl.querySelector('#pp-cl-tt-goto');
  const reclusterBtn = paneEl.querySelector('#pp-cl-recluster');
  const oMinSlider   = paneEl.querySelector('#pp-cl-omin'), oMinVal = paneEl.querySelector('#pp-cl-omin-val');
  const oMaxSlider   = paneEl.querySelector('#pp-cl-omax'), oMaxVal = paneEl.querySelector('#pp-cl-omax-val');
  const iMinSlider   = paneEl.querySelector('#pp-cl-imin'), iMinVal = paneEl.querySelector('#pp-cl-imin-val');
  const iMaxSlider   = paneEl.querySelector('#pp-cl-imax'), iMaxVal = paneEl.querySelector('#pp-cl-imax-val');
  const depthSlider  = paneEl.querySelector('#pp-cl-depth'), depthVal = paneEl.querySelector('#pp-cl-depth-val');

  const CARD_W       = 78;
  const BODY_GAP     = [7, 5, 4, 3];
  const BODY_PAD     = [7, 5, 4, 3];
  const RESIZE_MIN_W = 90;
  const RESIZE_MIN_H = 50;
  const NEST_GAP     = 16;

  let _outerMin=2, _outerMax=12, _innerMin=2, _innerMax=4, _depth=2;
  let _rendered=false, _ttRow=null;
  let _cachedEmbedded=null, _cachedVectors=null;
  let _reclusterTimer=null;
  let _panX=0, _panY=0, _zoom=1;
  let _topZ=10;

  function applyWorldTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }
  function e(t) { return typeof panelEscH === 'function' ? panelEscH(t) : String(t); }
  function setStatus(state, text) {
    statusEl.className = 'cl-' + state; labelEl.textContent = text; statusEl.style.opacity = '1';
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
    syncSliders(); if (!_cachedEmbedded) return;
    clearTimeout(_reclusterTimer);
    reclusterBtn.classList.add('pp-cl-reclustering'); reclusterBtn.textContent = '\u2026';
    _reclusterTimer = setTimeout(() => { _rendered = false; tryRender(); }, 420);
  }
  [oMinSlider, oMaxSlider, iMinSlider, iMaxSlider, depthSlider].forEach(s => s.addEventListener('input', scheduleRecluster));
  reclusterBtn.addEventListener('click', () => { clearTimeout(_reclusterTimer); _rendered = false; tryRender(); });

  // ── Canvas pan ───────────────────────────────────────────────────────────
  let _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('.pp-cl-nest')) return;
    _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY;
    canvas.classList.add('pp-cl-panning'); ev.preventDefault();
  });
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-nest')) return;
    _panning=true; _panSX=ev.touches[0].clientX; _panSY=ev.touches[0].clientY; _panBX=_panX; _panBY=_panY;
  }, { passive: true });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return; _panX=_panBX+ev.clientX-_panSX; _panY=_panBY+ev.clientY-_panSY; applyWorldTransform();
  });
  document.addEventListener('mouseup', () => { if (!_panning) return; _panning=false; canvas.classList.remove('pp-cl-panning'); });
  document.addEventListener('touchmove', ev => {
    if (!_panning || ev.touches.length !== 1) return;
    _panX=_panBX+ev.touches[0].clientX-_panSX; _panY=_panBY+ev.touches[0].clientY-_panSY;
    applyWorldTransform(); ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { _panning = false; });

  // ── Wheel zoom ───────────────────────────────────────────────────────────
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const dz = ev.deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.max(0.15, Math.min(4, _zoom * dz));
    _panX = mx - (mx - _panX) * nz / _zoom; _panY = my - (my - _panY) * nz / _zoom;
    _zoom = nz; applyWorldTransform();
  }, { passive: false });
  let _pinchD = null;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length === 2) {
      _pinchD = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 2 || !_pinchD) return;
    const d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
    _zoom = Math.max(0.15, Math.min(4, _zoom * d / _pinchD)); _pinchD = d; applyWorldTransform(); ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchD = null; });

  // ── Nest drag ────────────────────────────────────────────────────────────
  let _nestDrag = null;
  function makeNestDraggable(nestEl) {
    const head = nestEl.querySelector(':scope > .pp-cl-nest-head');
    if (!head) return;
    head.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation(); ev.preventDefault();
      _nestDrag = { el: nestEl, sx: parseInt(nestEl.style.left)||0, sy: parseInt(nestEl.style.top)||0, cx: ev.clientX, cy: ev.clientY };
      nestEl.style.zIndex = String(++_topZ); nestEl.classList.add('pp-cl-nest-lifted'); hideTooltip();
    });
    head.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-resize-handle')) return;
      ev.stopPropagation();
      _nestDrag = { el: nestEl, sx: parseInt(nestEl.style.left)||0, sy: parseInt(nestEl.style.top)||0, cx: ev.touches[0].clientX, cy: ev.touches[0].clientY };
      nestEl.style.zIndex = String(++_topZ); nestEl.classList.add('pp-cl-nest-lifted'); hideTooltip();
    }, { passive: false });
  }
  document.addEventListener('mousemove', ev => {
    if (!_nestDrag) return;
    _nestDrag.el.style.left = (_nestDrag.sx + (ev.clientX - _nestDrag.cx) / _zoom) + 'px';
    _nestDrag.el.style.top  = (_nestDrag.sy + (ev.clientY - _nestDrag.cy) / _zoom) + 'px';
  });
  document.addEventListener('mouseup', () => { if (!_nestDrag) return; _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null; });
  document.addEventListener('touchmove', ev => {
    if (!_nestDrag || ev.touches.length !== 1) return;
    _nestDrag.el.style.left = (_nestDrag.sx + (ev.touches[0].clientX - _nestDrag.cx) / _zoom) + 'px';
    _nestDrag.el.style.top  = (_nestDrag.sy + (ev.touches[0].clientY - _nestDrag.cy) / _zoom) + 'px';
    ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { if (!_nestDrag) return; _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null; });

  // ── Inner body pan for depth-0 nests ─────────────────────────────────────
  function makeBodyPannable(bodyEl, innerEl) {
    let active=false, sx=0, sy=0, bx=0, by=0;
    function getBxy() { const m=(innerEl.style.transform||'').match(/translate\(([^,]+)px,([^)]+)px\)/)||[]; return [parseFloat(m[1])||0, parseFloat(m[2])||0]; }
    bodyEl.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('.pp-cl-nest[data-depth="1"] > .pp-cl-nest-head')) return;
      if (ev.target.closest('.pp-cl-nest[data-depth="1"]')) return;
      active=true; [bx,by]=getBxy(); sx=ev.clientX; sy=ev.clientY;
      bodyEl.classList.add('pp-cl-body-panning'); ev.stopPropagation();
    });
    document.addEventListener('mousemove', ev => {
      if (!active) return;
      innerEl.style.transform = `translate(${bx+(ev.clientX-sx)/_zoom}px,${by+(ev.clientY-sy)/_zoom}px)`;
    });
    document.addEventListener('mouseup', () => { if (!active) return; active=false; bodyEl.classList.remove('pp-cl-body-panning'); });
    bodyEl.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-nest[data-depth="1"]')) return;
      active=true; [bx,by]=getBxy(); sx=ev.touches[0].clientX; sy=ev.touches[0].clientY; ev.stopPropagation();
    }, { passive: true });
    document.addEventListener('touchmove', ev => {
      if (!active || ev.touches.length !== 1) return;
      innerEl.style.transform = `translate(${bx+(ev.touches[0].clientX-sx)/_zoom}px,${by+(ev.touches[0].clientY-sy)/_zoom}px)`;
    }, { passive: true });
    document.addEventListener('touchend', () => { active = false; });
  }

  // ── Resize ───────────────────────────────────────────────────────────────
  function makeResizable(nestEl) {
    const handle = document.createElement('div'); handle.className = 'pp-cl-resize-handle'; nestEl.appendChild(handle);
    let resizing=false, sw=0, sh=0, sx=0, sy=0;
    handle.addEventListener('mousedown', ev => { resizing=true; sw=nestEl.offsetWidth; sh=nestEl.offsetHeight; sx=ev.clientX; sy=ev.clientY; ev.stopPropagation(); ev.preventDefault(); });
    document.addEventListener('mousemove', ev => { if (!resizing) return; nestEl.style.width=Math.max(RESIZE_MIN_W,sw+(ev.clientX-sx)/_zoom)+'px'; nestEl.style.height=Math.max(RESIZE_MIN_H,sh+(ev.clientY-sy)/_zoom)+'px'; });
    document.addEventListener('mouseup', () => { resizing = false; });
  }

  // ── Tooltip ──────────────────────────────────────────────────────────────
  function showTooltip(ev, r, text, accentColor) {
    _ttRow=r; ttCluster.textContent=''; ttCluster.style.color=accentColor;
    ttText.textContent = text.slice(0,160) + (text.length>160?'\u2026':'');
    ttGoto.style.color = accentColor;
    tooltip.classList.add('pp-cl-tt-visible'); moveTooltip(ev);
  }
  function moveTooltip(ev) {
    const pad=12, tw=tooltip.offsetWidth||200, th=tooltip.offsetHeight||80;
    let tx=ev.clientX+pad, ty=ev.clientY+pad;
    if (tx+tw > window.innerWidth-6)  tx = ev.clientX-tw-pad;
    if (ty+th > window.innerHeight-6) ty = ev.clientY-th-pad;
    tooltip.style.left = tx+'px'; tooltip.style.top = ty+'px';
  }
  function hideTooltip() { tooltip.classList.remove('pp-cl-tt-visible'); _ttRow = null; }
  ttGoto.addEventListener('click', () => { if (_ttRow && typeof panelGoTo === 'function') panelGoTo(_ttRow, 0); hideTooltip(); });

  // ════════════════════════════════════════════════════════════════════════
  // ── Clustering algorithms ────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  function cosineSim(a, b) {
    let d=0, na=0, nb=0;
    for (let i=0; i<a.length; i++) { d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }

  function centroid(rows) {
    if (!rows.length) return null;
    const dim = rows[0].vec.length;
    const sum = new Float32Array(dim);
    rows.forEach(r => r.vec.forEach((x, i) => { sum[i] += x; }));
    return Array.from(sum).map(x => x / rows.length);
  }

  // k-means++ initialisation + cosine distance, multiple trials
  function kMeansCosine(rows, k, iters) {
    iters = iters || 25;
    const n = rows.length;
    if (n <= k) return rows.map((_, i) => i % k);
    // k-means++ seed
    const centers = [rows[Math.floor(Math.random() * n)].vec.slice()];
    while (centers.length < k) {
      const dists = rows.map(r => Math.min(...centers.map(c => 1 - cosineSim(r.vec, c))));
      const sum = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      let picked = false;
      for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { centers.push(rows[i].vec.slice()); picked=true; break; } }
      if (!picked) centers.push(rows[Math.floor(Math.random() * n)].vec.slice());
    }
    let asgn = new Array(n).fill(0);
    for (let iter = 0; iter < iters; iter++) {
      const na = rows.map(r => {
        let best=0, bs=-Infinity;
        centers.forEach((c, ci) => { const s=cosineSim(r.vec, c); if (s > bs) { bs=s; best=ci; } });
        return best;
      });
      centers.forEach((_, ci) => {
        const members = rows.filter((_, i) => na[i] === ci);
        if (!members.length) return;
        const c = centroid(members); if (c) centers[ci] = c;
      });
      if (na.every((a, i) => a === asgn[i])) break;
      asgn = na;
    }
    return asgn;
  }

  function bestKMeans(rows, k, trials) {
    trials = trials || 3;
    let bestAsgn = null, bestInertia = Infinity;
    for (let t = 0; t < trials; t++) {
      const asgn = kMeansCosine(rows, k);
      const groups = Array.from({ length: k }, () => []);
      rows.forEach((r, i) => groups[asgn[i]].push(r));
      const cents = groups.map(g => g.length ? centroid(g) : null);
      const inertia = rows.reduce((s, r, i) => s + (cents[asgn[i]] ? 1 - cosineSim(r.vec, cents[asgn[i]]) : 0), 0);
      if (inertia < bestInertia) { bestInertia = inertia; bestAsgn = asgn; }
    }
    return { asgn: bestAsgn, inertia: bestInertia };
  }

  function autoCluster(rows, minK, maxK) {
    const n = rows.length;
    if (n === 0) return [];
    if (n <= 2) return rows.map((_, i) => i);
    minK = Math.max(2, minK);
    maxK = Math.min(maxK, Math.floor(Math.sqrt(n) * 2), n - 1);
    if (maxK < minK) return new Array(n).fill(0);
    if (minK === maxK) return bestKMeans(rows, minK).asgn;
    const results = [];
    for (let k = minK; k <= maxK; k++) results.push({ k, ...bestKMeans(rows, k) });
    const inertias = results.map(r => r.inertia);
    const totalDrop = (inertias[0] - inertias[inertias.length - 1]) || 1;
    let chosenK = results[0].k;
    for (let i = 1; i < results.length; i++) {
      if ((inertias[i-1] - inertias[i]) / totalDrop < 0.10) { chosenK = results[i-1].k; break; }
      chosenK = results[i].k;
    }
    return (results.find(r => r.k === chosenK) || results[results.length-1]).asgn;
  }

  // ── Semantically aligned sub-clustering ──────────────────────────────────
  // Strategy: compute K global "theme centroids" from ALL entries together
  // (not just one group), then for each top-level group independently cluster
  // it into K sub-clusters, and remap those sub-cluster indices so that each
  // one aligns to its closest global theme centroid.
  // This ensures A1 ≈ B1 ≈ C1 thematically, regardless of how many groups exist.
  function alignedSubCluster(topGroups, minK, maxK) {
    const numGroups = topGroups.length;
    if (numGroups < 2) {
      return numGroups === 0 ? [] : [autoCluster(topGroups[0], minK, maxK)];
    }

    // 1. Decide on a canonical K: run elbow selection on each group individually,
    //    take the most common K (mode) as the canonical sub-cluster count.
    const perGroupK = topGroups.map(members => {
      if (members.length < 2) return 1;
      const asgn = autoCluster(members, minK, maxK);
      return Math.max(...asgn) + 1;
    });
    const kCounts = {};
    perGroupK.forEach(k => { kCounts[k] = (kCounts[k] || 0) + 1; });
    const canonicalK = parseInt(Object.entries(kCounts).sort((a, b) => b[1] - a[1])[0][0]);
    if (canonicalK < 2) return topGroups.map(g => new Array(g.length).fill(0));

    // 2. Compute GLOBAL theme centroids: cluster ALL entries from ALL groups
    //    together into canonicalK themes. These become the shared reference.
    const allRows = topGroups.flat();
    const globalAsgn = bestKMeans(allRows, canonicalK, 5).asgn;
    const globalBuckets = Array.from({ length: canonicalK }, () => []);
    allRows.forEach((r, i) => globalBuckets[globalAsgn[i]].push(r));
    const globalCentroids = globalBuckets.map(b => b.length ? centroid(b) : null);

    // 3. For each top-level group: cluster it into canonicalK sub-clusters,
    //    then build a similarity matrix between its sub-cluster centroids and
    //    the global theme centroids, and use greedy matching to align them.
    return topGroups.map(members => {
      if (members.length < 2) return new Array(members.length).fill(0);

      // Force exactly canonicalK sub-clusters for this group
      const localAsgn = members.length < canonicalK
        ? members.map((_, i) => i % canonicalK)
        : bestKMeans(members, canonicalK, 3).asgn;

      const localBuckets = Array.from({ length: canonicalK }, () => []);
      members.forEach((r, i) => localBuckets[localAsgn[i]].push(r));
      const localCentroids = localBuckets.map(b => b.length ? centroid(b) : null);

      // Build cosine similarity matrix: localCluster ci → globalTheme gi
      const sim = Array.from({ length: canonicalK }, (_, ci) =>
        Array.from({ length: canonicalK }, (_, gi) =>
          (localCentroids[ci] && globalCentroids[gi])
            ? cosineSim(localCentroids[ci], globalCentroids[gi]) : 0
        )
      );

      // Greedy assignment: match each local cluster to its closest unused global theme
      const usedGlobal = new Set();
      const mapping = new Array(canonicalK).fill(-1); // localIdx → globalIdx
      const pairs = [];
      for (let ci = 0; ci < canonicalK; ci++)
        for (let gi = 0; gi < canonicalK; gi++)
          pairs.push({ ci, gi, s: sim[ci][gi] });
      pairs.sort((a, b) => b.s - a.s);

      for (const { ci, gi } of pairs) {
        if (mapping[ci] !== -1 || usedGlobal.has(gi)) continue;
        mapping[ci] = gi;
        usedGlobal.add(gi);
        if (usedGlobal.size === canonicalK) break;
      }
      // Fill any unmatched (shouldn't happen, but defensive)
      for (let ci = 0; ci < canonicalK; ci++) {
        if (mapping[ci] !== -1) continue;
        for (let gi = 0; gi < canonicalK; gi++) {
          if (!usedGlobal.has(gi)) { mapping[ci] = gi; usedGlobal.add(gi); break; }
        }
        if (mapping[ci] === -1) mapping[ci] = ci; // last resort
      }

      // Remap the assignment array from local indices to global theme indices
      return localAsgn.map(ci => mapping[ci]);
    });
  }

  // ── Color palette ─────────────────────────────────────────────────────────
  const PALETTE = [
    { accent: '#4f7af7', bg: '#f0f4ff' }, { accent: '#e05a6a', bg: '#fff0f2' },
    { accent: '#2eb87a', bg: '#edfaf4' }, { accent: '#f59b20', bg: '#fffbf0' },
    { accent: '#9f6ef5', bg: '#f7f0ff' }, { accent: '#20b8c8', bg: '#edfbfd' },
    { accent: '#d4700a', bg: '#fff6ed' }, { accent: '#6aab3e', bg: '#f2fbec' },
  ];
  function colForPath(path) { return PALETTE[(path[0] || 0) % PALETTE.length]; }

  function nestInitialWidth(depth, count, isLeaf, childW) {
    const pad = (BODY_PAD[Math.min(depth, BODY_PAD.length-1)] || 7) * 2;
    const gap = BODY_GAP[Math.min(depth, BODY_GAP.length-1)] || 7;
    if (isLeaf) { const cols = Math.min(count, 3); return pad + cols*CARD_W + (cols-1)*gap; }
    return pad + Math.min(count, 3) * (childW || 140) + Math.min(count-1, 2) * gap;
  }

  // ── Card builder ──────────────────────────────────────────────────────────
  function buildCard(r, col, delay) {
    const cells = r.row && r.row.cells ? r.row.cells : [];
    const cats  = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const best  = cells.reduce((b, c) => c.length > b.length ? c : b, '');
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
    const card = document.createElement('div');
    card.className = 'pp-cl-card';
    card.style.width = CARD_W + 'px';
    card.style.setProperty('--ppc-border', col.accent + '88');
    card.style.setProperty('--ppc-bg', col.bg);
    if (delay) card.style.animationDelay = delay + 'ms';
    const body = document.createElement('div'); body.className = 'pp-cl-card-body';
    if (cats.length) { const ce = document.createElement('div'); ce.className = 'pp-cl-card-cat'; ce.textContent = cats.join(' · '); body.appendChild(ce); }
    const te = document.createElement('div'); te.className = 'pp-cl-card-text'; te.textContent = parsed.body; body.appendChild(te);
    card.appendChild(body);
    card.addEventListener('mouseenter', ev => showTooltip(ev, r, parsed.body, col.accent));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  // ── Recursive nest builder ────────────────────────────────────────────────
  // alignedAsgn: pre-computed aligned assignment array for depth-1 children
  // (passed in from render() which called alignedSubCluster).
  // At deeper levels we just run autoCluster normally — alignment only applies
  // at the first sub-level (depth 1) since that's where cross-cluster comparison matters.
  function buildNestRecursive(rows, depth, maxDepth, path, alignedAsgn) {
    const col    = colForPath(path);
    const isLeaf = depth >= maxDepth;
    const gap    = BODY_GAP[Math.min(depth, BODY_GAP.length-1)];
    const pad    = BODY_PAD[Math.min(depth, BODY_PAD.length-1)];

    let children = null;
    if (!isLeaf) {
      // Use aligned assignment at depth 0 (first sub-level), autoCluster below
      const asgn = alignedAsgn || autoCluster(rows,
        depth === 0 ? _outerMin : _innerMin,
        depth === 0 ? _outerMax : _innerMax
      );
      const numC = Math.max(...asgn, 0) + 1;
      const groups = Array.from({ length: numC }, () => []);
      rows.forEach((r, i) => groups[asgn[i]].push(r));
      children = groups.map((members, ci) => ({ members, childPath: [...path, ci] }));
    }

    const nest = document.createElement('div');
    nest.className = 'pp-cl-nest';
    nest.setAttribute('data-depth', String(depth));
    nest.style.borderColor = col.accent + (depth === 0 ? '55' : '33');
    nest.style.background  = col.accent + (depth === 0 ? '0a' : '07');
    if (depth > 0) nest.style.animationDelay = ((path[path.length-1] || 0) * 30) + 'ms';

    const countLabel = rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies');
    const subLabel   = children ? ' \u00b7 ' + children.length + ' group' + (children.length === 1 ? '' : 's') : '';
    const head = document.createElement('div'); head.className = 'pp-cl-nest-head';
    head.style.background = col.accent + (depth === 0 ? '18' : '10');
    const dot = document.createElement('span'); dot.className = 'pp-cl-nest-dot'; dot.style.background = col.accent;
    const cnt = document.createElement('span'); cnt.className = 'pp-cl-nest-count'; cnt.textContent = countLabel + subLabel;
    head.appendChild(dot); head.appendChild(cnt); nest.appendChild(head);

    const body = document.createElement('div'); body.className = 'pp-cl-nest-body';
    body.style.gap = gap + 'px'; body.style.padding = pad + 'px';
    nest.appendChild(body);

    let contentEl = body;
    if (depth === 0) {
      const inner = document.createElement('div'); inner.className = 'pp-cl-body-inner';
      inner.style.gap = gap + 'px';
      body.appendChild(inner); contentEl = inner;
      makeBodyPannable(body, inner);
    }

    if (isLeaf) {
      rows.forEach((r, ri) => contentEl.appendChild(buildCard(r, col, ri * 14)));
      nest.style.width = nestInitialWidth(depth, rows.length, true) + 'px';
    } else {
      let childNestW = 0;
      const childEls = (children || []).filter(c => c.members.length > 0).map(({ members, childPath }) => {
        const child = buildNestRecursive(members, depth + 1, maxDepth, childPath, null);
        childNestW = Math.max(childNestW, parseInt(child.style.width) || 180);
        contentEl.appendChild(child);
        if (depth + 1 === 1) makeNestDraggable(child);
        return child;
      });
      nest.style.width = nestInitialWidth(depth, childEls.length, false, childNestW + gap) + 'px';
    }

    makeResizable(nest);
    if (depth === 0) makeNestDraggable(nest);
    return nest;
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function render(rows) {
    Array.from(world.children).forEach(c => c.remove());
    emptyEl.style.display = 'none';
    _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform(); _topZ = 10;

    const maxDepth = _depth - 1;

    // Step 1: top-level clustering
    const topAsgn  = autoCluster(rows, _outerMin, _outerMax);
    const numTop   = Math.max(...topAsgn, 0) + 1;
    const topGroups = Array.from({ length: numTop }, () => []);
    rows.forEach((r, i) => topGroups[topAsgn[i]].push(r));

    // Step 2: compute semantically-aligned sub-cluster assignments for all
    // top-level groups in one pass, so every group gets the same canonical K
    // and each sub-cluster index maps to the same global semantic theme.
    let alignedAsgns = null;
    const nonEmpty = topGroups.filter(g => g.length > 0);
    if (maxDepth >= 1 && nonEmpty.length > 1) {
      alignedAsgns = alignedSubCluster(nonEmpty, _innerMin, _innerMax);
    }

    // Step 3: build nests, passing the aligned assignment into each depth-0 nest
    const nestEls = [];
    let alignIdx = 0;
    topGroups.forEach((members, oi) => {
      if (!members.length) return;
      const asgn = (alignedAsgns && maxDepth >= 1) ? alignedAsgns[alignIdx++] : null;
      const nest = buildNestRecursive(members, 0, maxDepth, [oi], asgn);
      nest.style.animationDelay = (oi * 55) + 'ms';
      world.appendChild(nest); nestEls.push(nest);
    });

    requestAnimationFrame(() => {
      const canvasW = canvas.offsetWidth || 400;
      let curX = NEST_GAP, curY = NEST_GAP, rowH = 0;
      nestEls.forEach(n => {
        const nw = n.offsetWidth || parseInt(n.style.width) || 200, nh = n.offsetHeight || 200;
        if (curX + nw > canvasW - NEST_GAP && curX > NEST_GAP) { curX = NEST_GAP; curY += rowH + NEST_GAP; rowH = 0; }
        n.style.left = curX + 'px'; n.style.top = curY + 'px';
        curX += nw + NEST_GAP; rowH = Math.max(rowH, nh);
      });
    });

    subtitle.textContent = numTop + ' cluster' + (numTop === 1 ? '' : 's') + ' \u00b7 ' + rows.length + ' entries';
  }

  // ── Embedding pipeline ────────────────────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;
    if (_cachedEmbedded && _cachedVectors) { doRender(); return; }
    const rows = buildRowIndex(); if (!rows.length) return;
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026'); emptyEl.style.display = 'none';
    Promise.all(rows.map(r => {
      const text = (r.row?.cells || r.cells || []).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text).then(vec => ({ key: r.tabIdx+':'+r.rowIdx, vec })).catch(() => null);
    })).then(results => {
      const vectors = new Map(); results.forEach(res => { if (res?.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) { setStatus('error', 'No vectors available'); return; }
      const embedded = rows.filter(r => vectors.has(r.tabIdx+':'+r.rowIdx));
      if (embedded.length < 2) { setStatus('error', 'Not enough data'); return; }
      embedded.forEach(r => { r.vec = vectors.get(r.tabIdx+':'+r.rowIdx); });
      _cachedEmbedded = embedded; _cachedVectors = vectors; requestAnimationFrame(doRender);
    });
  }
  function doRender() {
    reclusterBtn.classList.remove('pp-cl-reclustering'); reclusterBtn.textContent = 'Re-cluster';
    setStatus('loading', 'Rendering\u2026');
    setTimeout(() => {
      try { render(_cachedEmbedded); setStatus('ready', 'Done'); _rendered = true; }
      catch (err) { console.error('[clusters]', err); setStatus('error', 'Clustering failed'); }
    }, 20);
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  window.addEventListener('embedder-ready', () => setTimeout(tryRender, 120));
  window.addEventListener('embedding-progress', ev => { if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%'); });
  window.addEventListener('embedding-complete', ev => {
    if (!_rendered) { subtitle.textContent = 'Indexed ' + ev.detail.total + ' entries — building clusters\u2026'; tryRender(); }
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
