// sidepanel-concept-map.js — Concept Map v17
// v16 → v17 changes:
//   • depthColor() now reads window.PP_PALETTE (set by script.js) as first
//     priority so all tools share one color source. Falls back to THEMES
//     globals then hardcoded CMAP_FALLBACK_PALETTE for standalone/bridge mode.
//   • CMAP_FALLBACK_PALETTE upgraded from 5 plain hex strings to 7 full
//     { accent, bg, label } objects matching the global theme palette.
console.log('[sidepanel-concept-map.js [v.7]');
// Level themes (used by THEMES fallback path only):
const CMAP_LEVEL_THEMES = ['yellow','visions','relational','organizational','physical','yellow'];

const CMAP_PARENT_CHILD_THRESHOLD = 0.50;
const CMAP_MIN_SPLIT_LENGTH = 60;
const ORPHAN_RECOVERY_THRESHOLD = 0.85;

(function injectCmapStyles() {
  if (document.getElementById('pp-cmap-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cmap-styles';
  s.textContent = `
#pp-cmap-head {
  flex-shrink:0; padding:10px 12px 8px;
  border-bottom:1px solid var(--md-sys-color-outline-variant);
  background:var(--md-sys-color-surface-container-low);
  display:flex; flex-direction:column; gap:5px;
}
#pp-cmap-subtitle {
  font-size:11px; font-weight:500; color:var(--md-sys-color-on-surface-variant);
  letter-spacing:.04em; line-height:1.3; min-height:14px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#pp-cmap-status {
  display:inline-flex; align-items:center; gap:6px; padding:4px 8px;
  border-radius:var(--radius-full); width:fit-content;
  font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
  border:1px solid transparent;
  transition:opacity .6s ease, background .4s ease;
}
#pp-cmap-status.cmap-loading { background:color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);color:var(--md-sys-color-on-surface-variant);border-color:var(--md-sys-color-outline-variant); }
#pp-cmap-status.cmap-ready   { background:color-mix(in srgb, var(--md-sys-color-secondary) 12%, transparent);color:var(--md-sys-color-secondary);border-color:color-mix(in srgb, var(--md-sys-color-secondary) 30%, transparent); }
#pp-cmap-status.cmap-error   { background:color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);color:var(--md-sys-color-error);border-color:color-mix(in srgb, var(--md-sys-color-error) 30%, transparent); }
.pp-cmap-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .4s; }
#pp-cmap-status.cmap-loading .pp-cmap-dot { background:var(--md-sys-color-outline);animation:pp-cmap-pulse 1.2s ease-in-out infinite; }
#pp-cmap-status.cmap-ready .pp-cmap-dot   { background:var(--md-sys-color-secondary); }
#pp-cmap-status.cmap-error .pp-cmap-dot   { background:var(--md-sys-color-error); }
@keyframes pp-cmap-pulse { 0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);} }

/* ── Controls grid ── */
#pp-cmap-controls {
  display:grid; grid-template-columns:1fr 1fr 1fr auto auto; gap:6px; align-items:end;
}
.pp-cmap-ctrl-col { display:flex; flex-direction:column; gap:2px; }

#pp-cmap-rebuild {
  border:none; border-radius:var(--radius-full); padding:4px 12px; align-self:stretch;
  font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
  background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container); cursor:pointer;
  transition:background .15s,color .15s,box-shadow .15s; white-space:nowrap;
}
#pp-cmap-rebuild:hover { box-shadow:var(--md-elev-1); }
#pp-cmap-rebuild.pp-cmap-busy { background:color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);color:color-mix(in srgb, var(--md-sys-color-on-surface) 38%, transparent);cursor:default; }

#pp-cmap-layout-wrap { position:relative; align-self:stretch; }
#pp-cmap-layout-btn {
  height:100%; border:1px solid var(--md-sys-color-outline-variant); border-radius:var(--radius-full); padding:4px 10px;
  font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
  background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface-variant); cursor:pointer;
  transition:background .15s,color .15s,box-shadow .15s; white-space:nowrap;
  display:flex; align-items:center; gap:4px;
}
#pp-cmap-layout-btn:hover, #pp-cmap-layout-btn.open { background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);box-shadow:var(--md-elev-1); }
#pp-cmap-layout-menu {
  position:absolute; top:calc(100% + 5px); right:0; z-index:300;
  background:var(--md-sys-color-surface-container-lowest);border:1px solid var(--md-sys-color-outline-variant); border-radius:var(--radius-md);
  box-shadow:var(--md-elev-3); padding:5px; min-width:148px;
  display:none; flex-direction:column; gap:1px;
  animation:pp-cmap-menu-in .15s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes pp-cmap-menu-in { from{opacity:0;transform:scale(.92) translateY(-6px);}to{opacity:1;transform:scale(1) translateY(0);} }
#pp-cmap-layout-menu.open { display:flex; }
.pp-cmap-layout-opt {
  display:flex; align-items:center; gap:6px; width:100%; border:none; background:transparent;
  text-align:left; padding:5px 9px; border-radius:var(--radius-sm); cursor:pointer;
  font-size:9px; font-weight:600; letter-spacing:.03em; color:var(--md-sys-color-on-surface-variant); transition:background .12s;
}
.pp-cmap-layout-opt:hover { background:var(--md-sys-color-surface-container); color:var(--md-sys-color-on-surface); }
.pp-cmap-layout-opt.active { color:var(--md-sys-color-on-surface); background:var(--md-sys-color-surface-container); }
.pp-cmap-layout-sep { height:1px; background:var(--md-sys-color-outline-variant); margin:3px 4px; }
.pp-cmap-layout-group { font-size:7px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--md-sys-color-on-surface-variant);padding:4px 9px 2px; }

#pp-cmap-canvas {
  flex:1; min-height:0; position:relative; overflow:hidden; cursor:default; user-select:none;
}
#pp-cmap-canvas.pp-cmap-panning { cursor:grabbing !important; }
#pp-cmap-world { position:absolute; top:0; left:0; width:100%; height:100%; transform-origin:0 0; }
#pp-cmap-empty {
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:8px;
  font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--md-sys-color-on-surface-variant); text-align:center; padding:24px; pointer-events:none;
}
#pp-cmap-zoom-hint {
  position:absolute; bottom:7px; right:9px; font-size:9px; font-weight:600;
  letter-spacing:.05em; color:var(--md-sys-color-outline); pointer-events:none; z-index:20;
}
#pp-cmap-fit {
  position:absolute; bottom:28px; right:9px; z-index:25;
  width:28px; height:28px; border:1px solid var(--md-sys-color-outline-variant); border-radius:var(--radius-sm); padding:0;
  background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface-variant); cursor:pointer;
  display:grid; place-items:center; transition:background .15s,color .15s,box-shadow .15s;
}
#pp-cmap-fit:hover { background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);box-shadow:var(--md-elev-1); }

.pp-cmap-card {
  position:absolute; border-radius:9px;
  border:none; background:var(--ppc-bg,#fff);
  box-shadow:var(--md-elev-2); cursor:grab; user-select:none;
  overflow:hidden; transition:box-shadow .15s;
}
.pp-cmap-card:active { cursor:grabbing; }
.pp-cmap-card:hover  { box-shadow:var(--md-elev-4); }

/* ── Solid-color card: all text becomes white ── */
.pp-cmap-card .pp-cmap-card-cat-num { color:rgba(255,255,255,0.92) !important; }
.pp-cmap-card .pp-cmap-card-level-num { color:rgba(255,255,255,0.95) !important; }
.pp-cmap-card .pp-cmap-card-level-label { color:rgba(255,255,255,0.55) !important; }
.pp-cmap-card .pp-cmap-card-merged { color:rgba(255,255,255,0.5) !important; }
.pp-cmap-card .pp-cmap-card-rule { background:rgba(255,255,255,0.22) !important; opacity:1 !important; }
.pp-cmap-card .pp-cmap-cell-cat { color:rgba(255,255,255,0.6) !important; }
.pp-cmap-card .pp-cmap-cell-text { color:rgba(255,255,255,0.92) !important; }
.pp-cmap-card .pp-cmap-merge-sep { background:rgba(255,255,255,0.2) !important; border-color:transparent !important; }
.pp-cmap-card .pp-cmap-card-footer { border-top-color:rgba(255,255,255,0.18) !important; }
.pp-cmap-card .pp-cmap-sim-line { color:rgba(255,255,255,0.6) !important; }
.pp-cmap-card .pp-cmap-sim-pct { color:rgba(255,255,255,0.92) !important; }
.pp-cmap-card .pp-cmap-leaf-badge { color:rgba(255,255,255,0.55) !important; }

.pp-cmap-card-head { padding:5px 9px 4px; display:flex; align-items:flex-start; gap:5px; flex-wrap:wrap; }
.pp-cmap-level-badge {
  font-size:8px; font-weight:800; letter-spacing:.10em; text-transform:uppercase;
  opacity:.9; flex:1; min-width:0; line-height:1.4;
}
.pp-cmap-split-badge { font-size:8px; font-weight:800; letter-spacing:.06em; opacity:.9; flex:1; min-width:0; line-height:1.4; }
.pp-cmap-split-fraction {
  font-size:9px; font-weight:900; letter-spacing:.04em; opacity:.8; flex-shrink:0;
  align-self:center; padding:1px 6px; border-radius:8px;
}
.pp-cmap-parent-count {
  font-size:8px; font-weight:700; letter-spacing:.06em; padding:1px 5px;
  border-radius:8px; flex-shrink:0; align-self:center;
  background:rgba(255,255,255,.2); color:rgba(255,255,255,.9);
}
.pp-cmap-merged-count {
  font-size:8px; font-weight:700; letter-spacing:.07em;
  padding:1px 6px; border-radius:10px; margin-left:auto; opacity:.7; flex-shrink:0;
}
.pp-cmap-card-body { padding:6px 9px 4px; display:flex; flex-direction:column; gap:4px; }
.pp-cmap-cell-cat {
  font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:var(--md-sys-color-on-surface-variant); margin-bottom:1px;
}
.pp-cmap-cell-text { font-size:10px; line-height:1.38; color:var(--md-sys-color-on-surface); word-break:break-word; overflow-wrap:break-word; }
.pp-cmap-merge-sep { border-top:1px solid var(--md-sys-color-outline-variant); margin:3px 0; }
.pp-cmap-card-footer {
  padding:4px 9px 7px; border-top:1px solid var(--md-sys-color-outline-variant); margin-top:2px;
  display:flex; flex-direction:column; gap:3px;
}
.pp-cmap-sim-row { display:flex; align-items:center; gap:5px; }
.pp-cmap-sim-arrow {
  font-size:9px; font-weight:800; flex-shrink:0; width:10px; text-align:center; opacity:.55;
}
.pp-cmap-sim-bar { flex:1; height:3px; border-radius:2px; background:var(--md-sys-color-surface-container-high); overflow:hidden; }
.pp-cmap-sim-fill { height:100%; border-radius:2px; transition:width .3s ease; }
.pp-cmap-sim-label { font-size:9px; font-weight:700; letter-spacing:.04em; flex-shrink:0; color:var(--md-sys-color-on-surface-variant); min-width:52px; }
.pp-cmap-leaf-badge {
  font-size:8px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:var(--md-sys-color-on-surface-variant); padding:4px 9px 7px; display:block;
}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initConceptMapTool(paneEl, sidebarEl) {

  const DRAG_DELAY = 600; // ms debounce while slider is being dragged

  paneEl.innerHTML =
    '<div id="pp-cmap-head">' +
      '<div id="pp-cmap-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cmap-status" class="cmap-loading">' +
        '<div class="pp-cmap-dot"></div><span id="pp-cmap-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cmap-controls">' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-group-label">Max Depth</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Lvl</span>' +
            '<input class="pp-range" id="pp-cmap-depth" type="range" min="1" max="8" value="5" step="1">' +
            '<span class="pp-range-val" id="pp-cmap-depth-val">5</span>' +
          '</div>' +
        '</div>' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-group-label">Link Threshold</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Min</span>' +
            '<input class="pp-range" id="pp-cmap-thresh" type="range" min="20" max="90" value="50" step="5">' +
            '<span class="pp-range-val" id="pp-cmap-thresh-val">50%</span>' +
          '</div>' +
        '</div>' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-group-label" style="color:#7c5cbf">Max Parents</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label" style="color:#7c5cbf">Par</span>' +
            '<input class="pp-range pp-range--accent" id="pp-cmap-maxpar" type="range" min="1" max="6" value="1" step="1">' +
            '<span class="pp-range-val" id="pp-cmap-maxpar-val" style="color:#7c5cbf">1</span>' +
          '</div>' +
        '</div>' +
        '<div id="pp-cmap-layout-wrap">' +
          '<button id="pp-cmap-layout-btn" title="Change layout">' +
            '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="6" r="5" stroke-dasharray="2 2"/></svg>' +
            '<span id="pp-cmap-layout-label">Radial</span>' +
          '</button>' +
          '<div id="pp-cmap-layout-menu">' +
            '<div class="pp-cmap-layout-group">Layout</div>' +
            '<button class="pp-cmap-layout-opt active" data-layout="radial">Radial</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="vtree">Vertical Tree</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="htree">Horizontal Tree</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="vflow">Vertical Flow</button>' +
            '<div class="pp-cmap-layout-sep"></div>' +
            '<button class="pp-cmap-layout-opt" data-layout="organic">Organic</button>' +
          '</div>' +
        '</div>' +
        '<button id="pp-cmap-rebuild">Rebuild</button>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cmap-canvas">' +
      '<div id="pp-cmap-world"></div>' +
      '<div id="pp-cmap-empty">Concept map will appear<br>once the spreadsheet loads</div>' +
      '<button id="pp-cmap-fit" title="Fit all into view">' +
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3"/>' +
          '<rect x="4" y="4" width="8" height="8" rx="1" opacity=".4"/>' +
        '</svg>' +
      '</button>' +
      '<div id="pp-cmap-zoom-hint">scroll = zoom \u00b7 RMB drag = pan \u00b7 pinch/2-finger = touch</div>' +
    '</div>';

  // ── Upgrade all sliders with bounce animation ──────────────────────────────
  if (typeof upgradeSlider === 'function') {
    paneEl.querySelectorAll('.pp-range').forEach(upgradeSlider);
  }

  const subtitleEl  = paneEl.querySelector('#pp-cmap-subtitle');
  const statusEl    = paneEl.querySelector('#pp-cmap-status');
  const labelEl     = paneEl.querySelector('#pp-cmap-label');
  const canvas      = paneEl.querySelector('#pp-cmap-canvas');
  const world       = paneEl.querySelector('#pp-cmap-world');
  const emptyEl     = paneEl.querySelector('#pp-cmap-empty');
  const rebuildBtn  = paneEl.querySelector('#pp-cmap-rebuild');
  const fitBtn      = paneEl.querySelector('#pp-cmap-fit');
  const layoutBtn   = paneEl.querySelector('#pp-cmap-layout-btn');
  const layoutMenu  = paneEl.querySelector('#pp-cmap-layout-menu');
  const layoutLabel = paneEl.querySelector('#pp-cmap-layout-label');
  const layoutOpts  = paneEl.querySelectorAll('.pp-cmap-layout-opt');
  const depthSlider = paneEl.querySelector('#pp-cmap-depth');
  const depthValEl  = paneEl.querySelector('#pp-cmap-depth-val');
  const threshSlider= paneEl.querySelector('#pp-cmap-thresh');
  const threshValEl = paneEl.querySelector('#pp-cmap-thresh-val');
  const maxParSlider= paneEl.querySelector('#pp-cmap-maxpar');
  const maxParValEl = paneEl.querySelector('#pp-cmap-maxpar-val');

  const CARD_W = 170;
  const MM_PAD = 16;

  let _depth      = 5;
  let _threshold  = CMAP_PARENT_CHILD_THRESHOLD;
  let _maxParents = 1;
  let _layout     = 'organic';
  let _rows       = null;
  let _rendered   = false;
  let _rebuildTimer = null;
  let _topZ       = 10;
  let _panX = 0, _panY = 0, _zoom = 1;
  let _liveRects  = new Map();

  function applyTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }

  function setStatus(state, text) {
    statusEl.className = 'cmap-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders: delay while dragging, instant on release ─────────────────────
  [
    { el: depthSlider,  valEl: depthValEl,  read: () => { _depth = +depthSlider.value; depthValEl.textContent = _depth; } },
    { el: threshSlider, valEl: threshValEl, read: () => { _threshold = +threshSlider.value / 100; threshValEl.textContent = threshSlider.value + '%'; } },
    { el: maxParSlider, valEl: maxParValEl, read: () => { _maxParents = +maxParSlider.value; maxParValEl.textContent = _maxParents; } },
  ].forEach(({ el, read }) => {
    el.addEventListener('input', () => {
      read();
      clearTimeout(_rebuildTimer);
      rebuildBtn.classList.add('pp-cmap-busy');
      _rebuildTimer = setTimeout(() => { _rendered = false; tryRender(); }, DRAG_DELAY);
    });
    el.addEventListener('change', () => {
      read();
      clearTimeout(_rebuildTimer);
      rebuildBtn.classList.remove('pp-cmap-busy');
      _rendered = false; tryRender();
    });
  });

  rebuildBtn.addEventListener('click', () => { clearTimeout(_rebuildTimer); _rendered = false; tryRender(); });

  // ── Layout dropdown ───────────────────────────────────────────────────────
  const LAYOUT_LABELS = { radial:'Radial', vtree:'Vertical Tree', htree:'Horizontal Tree', vflow:'Vertical Flow', organic:'Organic' };
  layoutBtn.addEventListener('click', e => { e.stopPropagation(); layoutMenu.classList.toggle('open'); layoutBtn.classList.toggle('open', layoutMenu.classList.contains('open')); });
  document.addEventListener('click', () => { layoutMenu.classList.remove('open'); layoutBtn.classList.remove('open'); });
  layoutMenu.addEventListener('click', e => e.stopPropagation());
  layoutOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const l = opt.dataset.layout; if (!l) return;
      _layout = l; layoutLabel.textContent = LAYOUT_LABELS[l] || l;
      layoutOpts.forEach(o => o.classList.toggle('active', o.dataset.layout === l));
      layoutMenu.classList.remove('open'); layoutBtn.classList.remove('open');
      if (_rendered) { _rendered = false; tryRender(); }
    });
  });

  // ── Fit-all ───────────────────────────────────────────────────────────────
  function fitAll() {
    if (!_liveRects.size) return;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    _liveRects.forEach(r => { minX=Math.min(minX,r.x); minY=Math.min(minY,r.y); maxX=Math.max(maxX,r.x+(r.w||CARD_W)); maxY=Math.max(maxY,r.y+(r.h||80)); });
    if (!isFinite(minX)) return;
    const W=canvas.clientWidth||400, H=canvas.clientHeight||400, pad=32;
    const scaleX=(W-pad*2)/Math.max(maxX-minX,1), scaleY=(H-pad*2)/Math.max(maxY-minY,1);
    _zoom=Math.min(scaleX,scaleY,2.5);
    _panX=pad-minX*_zoom+(W-pad*2-(maxX-minX)*_zoom)/2;
    _panY=pad-minY*_zoom+(H-pad*2-(maxY-minY)*_zoom)/2;
    applyTransform();
  }
  fitBtn.addEventListener('click', fitAll);

  // ── Pan & zoom ────────────────────────────────────────────────────────────
  let _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;

  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 2) return;
    _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY;
    canvas.classList.add('pp-cmap-panning'); ev.preventDefault();
  });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return;
    _panX=_panBX+(ev.clientX-_panSX); _panY=_panBY+(ev.clientY-_panSY); applyTransform();
  });
  document.addEventListener('mouseup', ev => {
    if (ev.button !== 2 || !_panning) return;
    _panning=false; canvas.classList.remove('pp-cmap-panning');
  });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect=canvas.getBoundingClientRect(), mx=ev.clientX-rect.left, my=ev.clientY-rect.top;
    if (ev.ctrlKey || (Math.abs(ev.deltaY) >= 50 && Math.abs(ev.deltaX) < 50)) {
      const dz=ev.deltaY>0?0.94:1/0.94, nz=Math.max(0.15,Math.min(4,_zoom*dz));
      _panX=mx-(mx-_panX)*nz/_zoom; _panY=my-(my-_panY)*nz/_zoom; _zoom=nz;
    } else {
      _panX-=ev.deltaX; _panY-=ev.deltaY;
    }
    applyTransform();
  }, {passive:false});

  // Touch pinch/pan handled by Pointer Events in makeDraggable block above

  // ── Card drag — Pointer Events API (works on touch + mouse) ──────────────
  // Per-card pointerdown + capture → only that card's events route here.
  // Canvas pointerdown only fires when NOT hitting a card → canvas pan only.
  const _pointers = new Map(); // pointerId → {x,y}
  let _cardDrag   = null;      // {el, cid, pointerId, ox, oy, sx, sy}
  let _pinchState = null;      // {midX, midY, dist, panX, panY, zoom}

  canvas.style.touchAction = 'none';

  // ── Canvas pan (bare canvas touch, not on a card) ──────────────────────
  canvas.addEventListener('pointerdown', ev => {
    // If the pointer landed on a card, card's own handler takes over
    if (ev.target.closest('.pp-cmap-card')) return;
    canvas.setPointerCapture(ev.pointerId);
    _pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (_pointers.size === 2) {
      const pts = [..._pointers.values()];
      _pinchState = {
        midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2,
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        panX: _panX, panY: _panY, zoom: _zoom,
      };
    } else {
      // Single finger on bare canvas = pan
      _pinchState = null;
    }
  });

  canvas.addEventListener('pointermove', ev => {
    if (!_pointers.has(ev.pointerId)) return;
    const prev = _pointers.get(ev.pointerId);
    _pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (_pointers.size === 1 && !_pinchState) {
      // Single-finger pan on bare canvas
      ev.preventDefault();
      _panX += ev.clientX - prev.x;
      _panY += ev.clientY - prev.y;
      applyTransform();
      return;
    }

    if (_pinchState && _pointers.size >= 2) {
      ev.preventDefault();
      const pts     = [..._pointers.values()];
      const newMidX = (pts[0].x + pts[1].x) / 2;
      const newMidY = (pts[0].y + pts[1].y) / 2;
      const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect    = canvas.getBoundingClientRect();
      const cmx     = newMidX - rect.left;
      const cmy     = newMidY - rect.top;
      const sf      = newDist / _pinchState.dist;
      const nz      = Math.max(0.15, Math.min(4, _pinchState.zoom * sf));
      const origCmx = _pinchState.midX - rect.left;
      const origCmy = _pinchState.midY - rect.top;
      _zoom = nz;
      _panX = cmx - (origCmx - _pinchState.panX) * nz / _pinchState.zoom + (newMidX - _pinchState.midX);
      _panY = cmy - (origCmy - _pinchState.panY) * nz / _pinchState.zoom + (newMidY - _pinchState.midY);
      applyTransform();
      redrawConnectors();
    }
  });

  function _canvasPointerEnd(ev) {
    _pointers.delete(ev.pointerId);
    if (_pointers.size < 2) { _pinchState = null; }
  }
  canvas.addEventListener('pointerup',     _canvasPointerEnd);
  canvas.addEventListener('pointercancel', _canvasPointerEnd);

  function makeDraggable(el, cid) {
    el.dataset.cid = String(cid);
    el.style.touchAction = 'none';

    // Each card captures its own pointer — completely isolated from canvas pan
    el.addEventListener('pointerdown', ev => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.stopPropagation(); // prevent canvas pointerdown from also firing
      el.setPointerCapture(ev.pointerId);
      const r = _liveRects.get(cid) || { x: 0, y: 0 };
      _cardDrag = { el, cid, pointerId: ev.pointerId, ox: ev.clientX, oy: ev.clientY, sx: r.x, sy: r.y };
      el.style.zIndex = String(++_topZ);
      ev.preventDefault();
    });

    el.addEventListener('pointermove', ev => {
      if (!_cardDrag || ev.pointerId !== _cardDrag.pointerId) return;
      ev.preventDefault();
      const dx = (ev.clientX - _cardDrag.ox) / _zoom;
      const dy = (ev.clientY - _cardDrag.oy) / _zoom;
      const nx = _cardDrag.sx + dx;
      const ny = _cardDrag.sy + dy;
      const r  = _liveRects.get(cid) || { w: CARD_W, h: 80 };
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
      _liveRects.set(cid, { x: nx, y: ny, w: r.w, h: r.h });
      redrawConnectors();
    });

    el.addEventListener('pointerup',     ev => { if (_cardDrag && ev.pointerId === _cardDrag.pointerId) _cardDrag = null; });
    el.addEventListener('pointercancel', ev => { if (_cardDrag && ev.pointerId === _cardDrag.pointerId) _cardDrag = null; });
  }

  // ── Cosine similarity ─────────────────────────────────────────────────────
  function cosineSim(a, b) {
    if (!a||!b||a.length!==b.length) return 0;
    let dot=0, na=0, nb=0;
    for (let i=0;i<a.length;i++) { dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return (na&&nb) ? Math.max(0,Math.min(1,dot/(Math.sqrt(na)*Math.sqrt(nb)))) : 0;
  }

  function avgVec(vecs) {
    const valid=vecs.filter(Boolean); if (!valid.length) return null;
    const dim=valid[0].length, sum=new Float32Array(dim);
    valid.forEach(v=>v.forEach((x,i)=>{ sum[i]+=x; }));
    return Array.from(sum).map(x=>x/valid.length);
  }

  // ── Intra-cell splitting ──────────────────────────────────────────────────
  function sentenceSplit(text) {
    return text.replace(/([.!?;])\s+/g,'$1\n').split('\n').map(s=>s.trim()).filter(s=>s.length>=CMAP_MIN_SPLIT_LENGTH);
  }

  async function maybeSplitRow(row) {
    const cells=row.row?.cells||row.cells||[], cats=row.row?.cats?row.row.cats.filter(c=>c.trim()):[], catStr=cats.join(' \u00b7 ')||'Cell';
    let bestText='', bestIdx=0;
    cells.forEach((c,i)=>{ if(c.trim().length>bestText.length){ bestText=c.trim(); bestIdx=i; } });
    if (bestText.length<CMAP_MIN_SPLIT_LENGTH*2) return [row];
    const segments=sentenceSplit(bestText); if (segments.length<=1) return [row];
    let segVecs;
    try { segVecs=await Promise.all(segments.map(s=>window.EmbeddingUtils.getCachedEmbedding(s))); } catch(e){ return [row]; }
    const valid=segments.map((s,i)=>({text:s,vec:segVecs[i]})).filter(x=>x.vec&&x.vec.length);
    if (valid.length<=1) return [row];
    const n=valid.length;
    const sim=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:cosineSim(valid[i].vec,valid[j].vec)));
    const groupOf=new Array(n).fill(-1); let numGroups=0;
    for (let i=0;i<n;i++) {
      if (groupOf[i]!==-1) continue; const g=numGroups++; groupOf[i]=g;
      for (let j=i+1;j<n;j++) { if (groupOf[j]!==-1) continue; let linked=false; for (let k=0;k<j;k++) { if (groupOf[k]===g&&sim[k][j]>=_threshold){linked=true;break;} } if (linked) groupOf[j]=g; }
    }
    if (numGroups<=1) return [row];
    const t=numGroups, groups=Array.from({length:t},()=>[]);
    valid.forEach((seg,i)=>groups[groupOf[i]].push(seg));
    return groups.map((segs,ni)=>({ tabIdx:row.tabIdx, rowIdx:row.rowIdx, headers:row.headers||[], title:row.title||'', kws:row.kws||new Set(), _splitFrom:catStr, _splitN:ni+1, _splitT:t, vec:avgVec(segs.map(s=>s.vec)), row:{cells:cells.map((c,ci)=>ci===bestIdx?segs.map(s=>s.text).join(' '):''), cats} }));
  }

  async function splitAllRows(rows) {
    const result=[];
    for (const row of rows) { const parts=await maybeSplitRow(row); parts.forEach(r=>result.push(r)); }
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════
  // ── Hierarchy builder — multi-parent DAG ────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════
  function buildHierarchy(rows) {
    const n=rows.length; if (n<2) return null;

    const scores=new Float32Array(n);
    for (let i=0;i<n;i++) { let sum=0; for (let j=0;j<n;j++) { if (i!==j) sum+=cosineSim(rows[i].vec,rows[j].vec); } scores[i]=sum/(n-1); }

    const rankOrder=Array.from({length:n},(_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
    const levels=new Int32Array(n);
    rankOrder.forEach((ri,rank)=>{ levels[ri]=Math.max(1,Math.min(_depth,Math.floor(rank*_depth/n)+1)); });

    const parentsOf    = new Map();
    const parentSimsOf = new Map();

    for (let i=0;i<n;i++) {
      parentsOf.set(i,[]); parentSimsOf.set(i,[]);
      if (levels[i]===1) continue;
      const candidates=[];
      for (let j=0;j<n;j++) {
        if (j===i||levels[j]!==levels[i]-1) continue;
        const s=cosineSim(rows[i].vec,rows[j].vec);
        if (s>=_threshold) candidates.push({j,s});
      }
      candidates.sort((a,b)=>b.s-a.s);
      const kept=candidates.slice(0,_maxParents);
      parentsOf.set(i,kept.map(c=>c.j));
      parentSimsOf.set(i,kept.map(c=>c.s));
    }

    const relaxed=_threshold*ORPHAN_RECOVERY_THRESHOLD;
    for (let i=0;i<n;i++) {
      if (levels[i]<=1||parentsOf.get(i).length>0) continue;
      let bestJ=-1, bestSim=relaxed;
      for (let j=0;j<n;j++) {
        if (j===i||levels[j]>=levels[i]) continue;
        const s=cosineSim(rows[i].vec,rows[j].vec); if (s>bestSim){ bestSim=s; bestJ=j; }
      }
      if (bestJ!==-1) { levels[i]=levels[bestJ]+1; parentsOf.set(i,[bestJ]); parentSimsOf.set(i,[bestSim]); }
      else levels[i]=1;
    }

    const childrenOf=Array.from({length:n},()=>[]);
    for (let i=0;i<n;i++) { parentsOf.get(i).forEach(p=>{ if(!childrenOf[p].includes(i)) childrenOf[p].push(i); }); }

    const simToChildren=new Float32Array(n);
    for (let i=0;i<n;i++) { if (!childrenOf[i].length) continue; let sum=0; childrenOf[i].forEach(c=>{sum+=cosineSim(rows[i].vec,rows[c].vec);}); simToChildren[i]=sum/childrenOf[i].length; }

    const simToParents=new Float32Array(n);
    for (let i=0;i<n;i++) { const pars=parentsOf.get(i)||[]; if (!pars.length) continue; let sum=0; pars.forEach(p=>{sum+=cosineSim(rows[i].vec,rows[p].vec);}); simToParents[i]=sum/pars.length; }

    const absorbedInto=new Int32Array(n).fill(-1), mergeExtras=new Map();
    const mkKey=i=>levels[i]+':p'+parentsOf.get(i).slice().sort((a,b)=>a-b).join(',')+':c'+childrenOf[i].slice().sort((a,b)=>a-b).join(',');
    const seenKeys=new Map();
    for (let i=0;i<n;i++) {
      if (!childrenOf[i].length) continue;
      const k=mkKey(i);
      if (seenKeys.has(k)) { const primary=seenKeys.get(k); absorbedInto[i]=primary; if (!mergeExtras.has(primary)) mergeExtras.set(primary,[]); mergeExtras.get(primary).push(i); }
      else seenKeys.set(k,i);
    }

    return { rows, n, levels, parentsOf, parentSimsOf, childrenOf, simToChildren, simToParents, absorbedInto, mergeExtras };
  }

  // ── Connectors ────────────────────────────────────────────────────────────
  let _connSvg=null, _connEdges=[];

  function redrawConnectors() {
    if (!_connSvg) return;
    const ns='http://www.w3.org/2000/svg';
    _connSvg.innerHTML='';
    _connEdges.forEach(({fromId,toId,color,depth})=>{
      const ra=_liveRects.get(fromId), rb=_liveRects.get(toId); if (!ra||!rb) return;
      function pts(r){ const{x,y,w,h}=r; return [{x:x+w*.25,y},{x:x+w*.5,y},{x:x+w*.75,y},{x:x+w*.25,y:y+h},{x:x+w*.5,y:y+h},{x:x+w*.75,y:y+h},{x,y:y+h*.33},{x,y:y+h*.67},{x:x+w,y:y+h*.33},{x:x+w,y:y+h*.67}]; }
      const pA=pts(ra), pB=pts(rb); let best=null, bd=Infinity;
      pA.forEach(a=>pB.forEach(b=>{ const d=Math.hypot(a.x-b.x,a.y-b.y); if(d<bd){bd=d;best={a,b};} }));
      if (!best) return;
      const{a,b}=best, dist=Math.hypot(b.x-a.x,b.y-a.y), off=Math.min(dist*.4,80);
      function tang(pt,r){ const t=3; if(Math.abs(pt.y-r.y)<t) return{dx:0,dy:-1}; if(Math.abs(pt.y-(r.y+r.h))<t) return{dx:0,dy:1}; if(Math.abs(pt.x-r.x)<t) return{dx:-1,dy:0}; if(Math.abs(pt.x-(r.x+r.w))<t) return{dx:1,dy:0}; return{dx:0,dy:1}; }
      const tA=tang(a,ra), tB=tang(b,rb);
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d',`M${a.x},${a.y} C${a.x+tA.dx*off},${a.y+tA.dy*off} ${b.x+tB.dx*off},${b.y+tB.dy*off} ${b.x},${b.y}`);
      path.setAttribute('fill','none'); path.setAttribute('stroke',color);
      path.setAttribute('stroke-width',depth===0?'2.5':'2');
      path.setAttribute('stroke-opacity',depth===0?'1':'0.9');
      path.setAttribute('stroke-dasharray',depth===0?'none':'5 3');
      _connSvg.appendChild(path);
      const dot=document.createElementNS(ns,'circle');
      dot.setAttribute('cx',String(b.x)); dot.setAttribute('cy',String(b.y)); dot.setAttribute('r','3.5');
      dot.setAttribute('fill',color); dot.setAttribute('opacity','1');
      _connSvg.appendChild(dot);
    });
  }

  // ── Color by hierarchy level ──────────────────────────────────────────────
  const CMAP_FALLBACK_PALETTE = [
    { accent: '#c8991a', bg: '#fffdf5', label: '#fff' },
    { accent: '#2e7d5e', bg: '#f4faf7', label: '#fff' },
    { accent: '#4a56c8', bg: '#f4f5fd', label: '#fff' },
    { accent: '#5e3d9e', bg: '#f6f3fb', label: '#fff' },
    { accent: '#c44035', bg: '#fdf5f4', label: '#fff' },
    { accent: '#c8991a', bg: '#fffdf5', label: '#fff' },
    { accent: '#888888', bg: '#f7f7f8', label: '#fff' },
  ];

  function depthColor(level) {
    const idx = level - 1;
    const pal = (typeof getPalette === 'function' ? getPalette() : null)
             || window.PP_PALETTE
             || CMAP_FALLBACK_PALETTE;

    if (pal && pal.length >= 5) {
      const rotated = [pal[4], pal[0], pal[1], pal[2], pal[3], pal[4], pal[5] || pal[0]];
      return rotated[Math.min(idx, rotated.length - 1)];
    }

    if (typeof THEMES !== 'undefined') {
      const tname = (idx < CMAP_LEVEL_THEMES.length) ? CMAP_LEVEL_THEMES[idx] : 'default';
      const theme = THEMES[tname] || THEMES.default || {};
      const fb = CMAP_FALLBACK_PALETTE[Math.min(idx, CMAP_FALLBACK_PALETTE.length - 1)];
      return {
        accent: theme['--tab-active-bg']    || fb.accent,
        label:  theme['--tab-active-color'] || '#fff',
        bg:     theme['--bg-data']          || fb.bg,
      };
    }

    return CMAP_FALLBACK_PALETTE[Math.min(idx, CMAP_FALLBACK_PALETTE.length - 1)];
  }

  function renderConceptMap(hier) {
    world.innerHTML=''; emptyEl.style.display='none'; _liveRects.clear(); _connEdges=[]; _topZ=10;
    _panX=0; _panY=0; _zoom=1; applyTransform();
    if (!hier) { emptyEl.style.display='flex'; return; }

    const ns='http://www.w3.org/2000/svg';
    _connSvg=document.createElementNS(ns,'svg');
    _connSvg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1';
    world.appendChild(_connSvg);

    const{rows,n,levels,parentsOf,childrenOf,simToChildren,simToParents,absorbedInto,mergeExtras}=hier;
    const cardEls=new Map();

    for (let i=0;i<n;i++) {
      if (absorbedInto[i]!==-1) continue;
      const level=levels[i], {accent,label:lc,bg}=depthColor(level);
      const extras=mergeExtras.get(i)||[], allRows=[i,...extras];

      const card=document.createElement('div');
      card.className='pp-cmap-card';
      card.style.cssText=`width:${CARD_W}px;position:absolute;z-index:${++_topZ}`;
      card.style.setProperty('--ppc-border',accent);
      card.style.setProperty('--ppc-bg',accent);

      // ── Top row: big category letter (left) + level block (right) ──────
      const primaryRow=rows[i], isSplit=!!primaryRow._splitFrom;
      const numParents=(parentsOf.get(i)||[]).length;

      const topRow=document.createElement('div');
      topRow.className='pp-cmap-card-top';

      const catNumEl=document.createElement('div');
      catNumEl.className='pp-cmap-card-cat-num';
      const allCats = primaryRow.row?.cats?.filter(c => c.trim()) || [];
      const catChar = allCats.length ? allCats.join(' · ') : String(level);
      catNumEl.textContent = catChar;

      const levelBlock=document.createElement('div');
      levelBlock.className='pp-cmap-card-level-block';
      const levelNum=document.createElement('div');
      levelNum.className='pp-cmap-card-level-num';
      levelNum.textContent = isSplit ? (primaryRow._splitN+'/'+primaryRow._splitT) : String(level);
      const levelLbl=document.createElement('div');
      levelLbl.className='pp-cmap-card-level-label';
      levelLbl.textContent = isSplit ? 'Split' : 'Level';
      levelBlock.appendChild(levelNum);
      levelBlock.appendChild(levelLbl);

      topRow.appendChild(catNumEl);
      topRow.appendChild(levelBlock);
      card.appendChild(topRow);

      if (extras.length>0) {
        const mg=document.createElement('div');
        mg.className='pp-cmap-card-merged';
        mg.textContent='\u00d7'+allRows.length+' merged';
        card.appendChild(mg);
      }

      const rule=document.createElement('div');
      rule.className='pp-cmap-card-rule';
      card.appendChild(rule);

      const body=document.createElement('div');
      body.className='pp-cmap-card-body';
      allRows.forEach((ri,idx)=>{
        if (idx>0) { const sep=document.createElement('div'); sep.className='pp-cmap-merge-sep'; body.appendChild(sep); }
        const r=rows[ri], cells=r.row?.cells||r.cells||[], cats=r.row?.cats?r.row.cats.filter(c=>c.trim()):[];
        const best=cells.reduce((b,c)=>c.trim().length>b.length?c.trim():b,'');
        const parsed=typeof parseCitation==='function'?parseCitation(best):{body:best};
        if (cats.length) {
          const ce=document.createElement('div');
          ce.className='pp-cmap-cell-cat';
          ce.textContent=cats.join(' \u00b7 ');
          body.appendChild(ce);
        }
        const te=document.createElement('div');
        te.className='pp-cmap-cell-text';
        te.textContent=parsed.body;
        body.appendChild(te);
      });
      card.appendChild(body);

      const hasChildren=childrenOf[i].length>0;
      const hasParents=numParents>0;

      if (hasChildren||hasParents) {
        const footer=document.createElement('div');
        footer.className='pp-cmap-card-footer';

        function makeSimLine(arrow, sim, label) {
          const pct=Math.round(sim*100);
          const line=document.createElement('div');
          line.className='pp-cmap-sim-line';
          const pctEl=document.createElement('span');
          pctEl.className='pp-cmap-sim-pct';
          pctEl.textContent=pct+'%';
          line.innerHTML='<span>'+arrow+'</span>';
          line.appendChild(pctEl);
          const lblEl=document.createElement('span');
          lblEl.textContent=' '+label;
          line.appendChild(lblEl);
          return line;
        }

        if (hasParents) footer.appendChild(makeSimLine('\u2191', simToParents[i], numParents>1?numParents+' parents':'to parent'));
        if (hasChildren) footer.appendChild(makeSimLine('\u2193', simToChildren[i], 'to children'));
        card.appendChild(footer);
      } else {
        const leaf=document.createElement('span');
        leaf.className='pp-cmap-leaf-badge';
        leaf.textContent='Terminal concept';
        card.appendChild(leaf);
      }

      world.appendChild(card); cardEls.set(i,card); _liveRects.set(i,{x:0,y:0,w:CARD_W,h:80});
      makeDraggable(card,i);
      if (window.ResizeObserver) { new ResizeObserver(()=>{ const r=_liveRects.get(i); if(r){r.h=card.offsetHeight;redrawConnectors();} }).observe(card); }
    }

    for (let i=0;i<n;i++) {
      if (absorbedInto[i]!==-1) continue;
      (parentsOf.get(i)||[]).forEach(par=>{
        const parPrimary=absorbedInto[par]!==-1?absorbedInto[par]:par;
        if (!cardEls.has(i)||!cardEls.has(parPrimary)) return;
        const{accent}=depthColor(levels[parPrimary]);
        _connEdges.push({fromId:parPrimary,toId:i,color:accent,depth:levels[parPrimary]-1});
      });
    }

    // ── Layout ────────────────────────────────────────────────────────────
    requestAnimationFrame(()=>{
      const W=canvas.clientWidth||500, H=canvas.clientHeight||500;
      const nodeIds=[]; cardEls.forEach((_,id)=>nodeIds.push(id));
      const byLevel=new Map();
      nodeIds.forEach(id=>{ const lv=levels[id]; if(!byLevel.has(lv)) byLevel.set(lv,[]); byLevel.get(lv).push(id); });
      const maxLevel=Math.max(...byLevel.keys(),1);

      const primaryParentOf=new Map(), childrenOfPrimary=new Map();
      nodeIds.forEach(id=>{ childrenOfPrimary.set(id,[]); });
      _connEdges.forEach(({fromId,toId})=>{
        if (!primaryParentOf.has(toId)) { primaryParentOf.set(toId,fromId); if(childrenOfPrimary.has(fromId)) childrenOfPrimary.get(fromId).push(toId); }
      });
      const roots=nodeIds.filter(id=>!primaryParentOf.has(id));
      const cH=id=>{ const el=cardEls.get(id); return el?(el.offsetHeight||80):80; };
      const GAP_X=MM_PAD+10, GAP_Y=MM_PAD+20;

      function applyPositions(posMap) {
        posMap.forEach((pos,id)=>{ const el=cardEls.get(id); if(!el) return; el.style.left=pos.x+'px'; el.style.top=pos.y+'px'; _liveRects.set(id,{x:pos.x,y:pos.y,w:CARD_W,h:cH(id)}); });
        for (let pass=0;pass<30;pass++) {
          let moved=false;
          _liveRects.forEach((ra,ka)=>{ _liveRects.forEach((rb,kb)=>{ if(ka===kb) return; if(ra.x<rb.x+rb.w+MM_PAD&&ra.x+ra.w+MM_PAD>rb.x&&ra.y<rb.y+rb.h+MM_PAD&&ra.y+ra.h+MM_PAD>rb.y){ const dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x, dD=rb.y+rb.h+MM_PAD-ra.y, dU=ra.y+ra.h+MM_PAD-rb.y; if(Math.min(dR,dL)<=Math.min(dD,dU)) ra.x+=dR<dL?dR:-dL; else ra.y+=dD<dU?dD:-dU; const el=cardEls.get(ka); if(el){el.style.left=ra.x+'px';el.style.top=ra.y+'px';} moved=true; } }); });
          if (!moved) break;
        }
        redrawConnectors();
      }

      function layoutRadial() {
        const pos=new Map(), cx=W/2, cy=H/2;
        byLevel.forEach((ids,lv)=>{ const R=maxLevel===1?0:(0.12+0.20*(lv-1))*Math.min(W,H); ids.forEach((id,idx)=>{ const h=cH(id); if(lv===1&&ids.length===1){pos.set(id,{x:cx-CARD_W/2,y:cy-h/2});return;} const a=(2*Math.PI*idx/ids.length)-Math.PI/2; pos.set(id,{x:cx+R*Math.cos(a)-CARD_W/2,y:cy+R*Math.sin(a)-h/2}); }); });
        applyPositions(pos);
      }
      function subtreeW(id){ const kids=childrenOfPrimary.get(id)||[]; if(!kids.length) return CARD_W; return kids.reduce((s,k)=>s+subtreeW(k),0)+GAP_X*(kids.length-1); }
      function layoutTree(vertical) {
        const pos=new Map();
        function place(id,left,depth){ const kids=childrenOfPrimary.get(id)||[], myW=subtreeW(id), cx=left+myW/2, h=cH(id), rowY=depth*(90+GAP_Y); if(vertical) pos.set(id,{x:cx-CARD_W/2,y:rowY}); else pos.set(id,{x:rowY,y:cx-h/2}); let childLeft=left; kids.forEach(kid=>{place(kid,childLeft,depth+1);childLeft+=subtreeW(kid)+GAP_X;}); }
        const totalW=roots.reduce((s,r)=>s+subtreeW(r),0)+GAP_X*(roots.length-1); let curX=W/2-totalW/2;
        roots.forEach(r=>{place(r,curX,0);curX+=subtreeW(r)+GAP_X;});
        applyPositions(pos);
      }
      function layoutFlow(vertical) {
        const pos=new Map();
        byLevel.forEach((ids,lv)=>{ const layerH=Math.max(...ids.map(cH),80), totalW=ids.length*(CARD_W+GAP_X)-GAP_X, startX=W/2-totalW/2, rowY=(lv-1)*(layerH+GAP_Y*2); ids.forEach((id,idx)=>{ const h=cH(id); if(vertical) pos.set(id,{x:startX+idx*(CARD_W+GAP_X),y:rowY+(layerH-h)/2}); else pos.set(id,{x:rowY,y:startX+idx*(CARD_W+GAP_X)}); }); });
        applyPositions(pos);
      }
      function layoutOrganic() {
        const px={}, py={};
        nodeIds.forEach((id,i)=>{ const a=(2*Math.PI*i/nodeIds.length)-Math.PI/2, R=Math.min(W,H)*.35; px[id]=W/2+R*Math.cos(a); py[id]=H/2+R*Math.sin(a); });
        const AREA=W*H, k=Math.sqrt(AREA/Math.max(nodeIds.length,1))*.9; let temp=Math.min(W,H)*.25;
        for (let it=0;it<80;it++) {
          const dx={}, dy={}; nodeIds.forEach(id=>{dx[id]=0;dy[id]=0;});
          for (let i=0;i<nodeIds.length;i++) for (let j=i+1;j<nodeIds.length;j++) { const u=nodeIds[i],v=nodeIds[j]; let ddx=px[u]-px[v],ddy=py[u]-py[v]; const d=Math.sqrt(ddx*ddx+ddy*ddy)||.01,f=k*k/d; ddx/=d;ddy/=d; dx[u]+=ddx*f;dy[u]+=ddy*f;dx[v]-=ddx*f;dy[v]-=ddy*f; }
          _connEdges.forEach(({fromId:u,toId:v})=>{ if(!px.hasOwnProperty(u)||!px.hasOwnProperty(v)) return; let ddx=px[v]-px[u],ddy=py[v]-py[u]; const d=Math.sqrt(ddx*ddx+ddy*ddy)||.01,f=d*d/k; ddx/=d;ddy/=d; dx[u]+=ddx*f;dy[u]+=ddy*f;dx[v]-=ddx*f;dy[v]-=ddy*f; });
          nodeIds.forEach(id=>{ const d=Math.sqrt(dx[id]*dx[id]+dy[id]*dy[id])||.01,disp=Math.min(d,temp); px[id]+=dx[id]/d*disp;py[id]+=dy[id]/d*disp; }); temp*=.93;
        }
        const pos=new Map(); nodeIds.forEach(id=>{ const h=cH(id); pos.set(id,{x:px[id]-CARD_W/2,y:py[id]-h/2}); }); applyPositions(pos);
      }

      switch (_layout) {
        case 'vtree': layoutTree(true); break;
        case 'htree': layoutTree(false); break;
        case 'vflow': layoutFlow(true); break;
        case 'organic': layoutOrganic(); break;
        default: layoutRadial(); break;
      }
      setTimeout(fitAll,80);
    });
  }

  // ── Data pipeline ─────────────────────────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils||!window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex!=='function') return;
    if (_rows) { doRender(); return; }
    const rawRows=buildRowIndex(); if (!rawRows.length) return;
    setStatus('loading','Embedding '+rawRows.length+' cells\u2026'); emptyEl.style.display='none';
    Promise.all(rawRows.map(r=>{ const text=(r.row?.cells||r.cells||[]).join(' ').trim(); if(!text) return Promise.resolve(null); return window.EmbeddingUtils.getCachedEmbedding(text).then(vec=>({key:r.tabIdx+':'+r.rowIdx,vec})).catch(()=>null); })).then(results=>{
      const vectors=new Map(); results.forEach(res=>{ if(res?.vec) vectors.set(res.key,res.vec); });
      if (!vectors.size){ setStatus('error','No vectors available'); return; }
      const embedded=rawRows.filter(r=>vectors.has(r.tabIdx+':'+r.rowIdx));
      if (embedded.length<3){ setStatus('error','Not enough data (\u22653 cells needed)'); return; }
      embedded.forEach(r=>{ r.vec=vectors.get(r.tabIdx+':'+r.rowIdx); }); _rows=embedded; doRender();
    });
  }

  async function doRender() {
    rebuildBtn.classList.remove('pp-cmap-busy');
    setStatus('loading','Splitting cells\u2026');
    let workRows;
    try { workRows=await splitAllRows(_rows); } catch(e){ console.warn('[concept-map v17] split error:',e); workRows=_rows; }
    const splitCount=workRows.length-_rows.length;
    setStatus('loading','Building hierarchy for '+workRows.length+' concepts\u2026');
    setTimeout(()=>{
      try {
        const hier=buildHierarchy(workRows);
        if (!hier){ setStatus('error','Not enough data'); return; }
        let visibleCount=0, multiParentCount=0;
        const levelCounts=new Map();
        for (let i=0;i<hier.n;i++) {
          if (hier.absorbedInto[i]!==-1) continue; visibleCount++;
          const lv=hier.levels[i]; levelCounts.set(lv,(levelCounts.get(lv)||0)+1);
          if ((hier.parentsOf.get(i)||[]).length>1) multiParentCount++;
        }
        const levelStr=[...levelCounts.keys()].sort((a,b)=>a-b).map(l=>'L'+l+': '+levelCounts.get(l)).join(' \u00b7 ');
        const splitStr=splitCount>0?' \u00b7 '+splitCount+' split'+(splitCount===1?'':'s'):'';
        const mpStr=multiParentCount>0?' \u00b7 '+multiParentCount+' multi-parent':'';
        renderConceptMap(hier);
        subtitleEl.textContent=visibleCount+' cards \u00b7 '+levelStr+splitStr+mpStr;
        setStatus('ready','Done'); _rendered=true;
      } catch(err){ console.error('[concept-map v17]',err); setStatus('error','Failed: '+err.message); }
    },20);
  }

  if (window.EmbeddingUtils&&window.EmbeddingUtils.isReady()) setTimeout(tryRender,120);
  document.addEventListener('embeddings-ready',()=>setTimeout(tryRender,120));
  window.addEventListener('embedding-progress',ev=>{ if(!_rendered) setStatus('loading','Indexing\u2026 '+ev.detail.pct+'%'); });
  window.addEventListener('embedder-ready',()=>setTimeout(tryRender,120));

  // Re-render cards when dark/light mode changes so palette colours update
  window.addEventListener('df-theme-change', () => { _rendered=false; tryRender(); });

return {
    reset() {
      _rendered=false; _rows=null; _liveRects.clear(); _connEdges=[]; _connSvg=null;
      world.innerHTML=''; emptyEl.style.display='flex'; _panX=0; _panY=0; _zoom=1; applyTransform();
    },
    resize() {
      if (_rendered) fitAll();
    },
    start() {
      setTimeout(tryRender, 120);
    }
  };
}
