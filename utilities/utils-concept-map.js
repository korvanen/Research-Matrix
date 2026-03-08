// utils-concept-map.js — Concept Map v20
// v19 → v20 changes:
//   • Fixed light/dark mode support: depthColor() now reads live CSS custom
//     properties instead of static THEMES object values
//   • Text color (--ppc-on) now adapts based on html.dark/html.light class
//   • Background and accent colors read from --raw-{theme}-bg and --raw-{theme}-mid
//     which update automatically when theme changes
// v20 fixes:
//   • depthColor: added missing paletteIdx + theme variable (was ReferenceError)
//   • depthColor: rewrote getLuminance without array destructuring (was SyntaxError)
//   • Removed dead CMAP_LEVEL_THEMES constant
console.log('[utils-concept-map.js v.pneeeel]');

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

/* ── Card top layout ── */
.pp-cmap-card-top {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:5px 9px 4px; gap:6px;
}
.pp-cmap-card-cat-num {
  font-size:11px; font-weight:800; letter-spacing:.02em; line-height:1.35;
  flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pp-cmap-card-level-block {
  display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0;
}
.pp-cmap-card-level-num {
  font-size:14px; font-weight:900; line-height:1;
}
.pp-cmap-card-level-label {
  font-size:7px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
}
.pp-cmap-card-merged {
  font-size:8px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  padding:0 9px 3px;
}
.pp-cmap-card-rule {
  height:1px; margin:0 9px; opacity:.5;
}

/* ── All text elements driven by --ppc-on ── */
.pp-cmap-card .pp-cmap-card-cat-num    { color: color-mix(in srgb, var(--ppc-on,#fff) 92%, black); }
.pp-cmap-card .pp-cmap-card-level-num  { color: color-mix(in srgb, var(--ppc-on,#fff) 95%, black); }
.pp-cmap-card .pp-cmap-card-level-label { color: color-mix(in srgb, var(--ppc-on,#fff) 55%, var(--ppc-bg,#888)); }
.pp-cmap-card .pp-cmap-card-merged     { color: color-mix(in srgb, var(--ppc-on,#fff) 50%, var(--ppc-bg,#888)); }
.pp-cmap-card .pp-cmap-card-rule       { background: color-mix(in srgb, var(--ppc-on,#fff) 22%, var(--ppc-bg,#888)); opacity: 1; }
.pp-cmap-card .pp-cmap-cell-cat        { color: color-mix(in srgb, var(--ppc-on,#fff) 60%, var(--ppc-bg,#888)); }
.pp-cmap-card .pp-cmap-cell-text       { color: color-mix(in srgb, var(--ppc-on,#fff) 92%, black); }
.pp-cmap-card .pp-cmap-merge-sep       { background: color-mix(in srgb, var(--ppc-on,#fff) 20%, var(--ppc-bg,#888)); border-color: transparent; }
.pp-cmap-card .pp-cmap-card-footer     { border-top-color: color-mix(in srgb, var(--ppc-on,#fff) 18%, var(--ppc-bg,#888)); }
.pp-cmap-card .pp-cmap-sim-line        { color: color-mix(in srgb, var(--ppc-on,#fff) 60%, var(--ppc-bg,#888)); }
.pp-cmap-card .pp-cmap-sim-pct         { color: color-mix(in srgb, var(--ppc-on,#fff) 92%, black); }
.pp-cmap-card .pp-cmap-leaf-badge      { color: color-mix(in srgb, var(--ppc-on,#fff) 55%, var(--ppc-bg,#888)); }

.pp-cmap-card-head { padding:5px 9px 4px; display:flex; align-items:flex-start; gap:5px; flex-wrap:wrap; }
.pp-cmap-level-badge {
  font-size:8px; font-weight:800; letter-spacing:.10em; text-transform:uppercase;
  opacity:.9; flex:1; min-width:0; line-height:1.4;
}
.pp-cmap-split-pill { font-size:8px; font-weight:800; letter-spacing:.06em; opacity:.9; flex:1; min-width:0; line-height:1.4; }
.pp-cmap-split-fraction {
  font-size:9px; font-weight:900; letter-spacing:.04em; opacity:.8; flex-shrink:0;
  align-self:center; padding:1px 6px; border-radius:8px;
}
.pp-cmap-parent-count {
  font-size:8px; font-weight:700; letter-spacing:.06em; padding:1px 5px;
  border-radius:8px; flex-shrink:0; align-self:center;
  background:color-mix(in srgb, var(--ppc-on,#fff) 20%, transparent); color:color-mix(in srgb, var(--ppc-on,#fff) 90%, transparent);
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
.pp-cmap-split-pill {
  font-size:9px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
  color: var(--ppc-on, #fff); opacity: 0.65;
  padding:4px 9px 6px; text-align:right; display:block;
}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initConceptMapTool(paneEl, sidebarEl) {

  const DRAG_DELAY = 600;

  // ── Build nav rail + side panel via global PPNavRail component ──
  const nav = window.PPNavRail.create(paneEl, {
    toolName: 'Concept Map',
    panelSections: [
      {
        label: 'Parameters',
        html:
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Depth</span>' +
            '<input class="pp-range" id="pp-cmap-depth" type="range" min="1" max="8" value="5" step="1">' +
            '<span class="pp-range-val" id="pp-cmap-depth-val">5</span>' +
          '</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Thresh</span>' +
            '<input class="pp-range" id="pp-cmap-thresh" type="range" min="20" max="90" value="50" step="5">' +
            '<span class="pp-range-val" id="pp-cmap-thresh-val">50%</span>' +
          '</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label" style="color:#7c5cbf">Parents</span>' +
            '<input class="pp-range pp-range--accent" id="pp-cmap-maxpar" type="range" min="1" max="6" value="1" step="1">' +
            '<span class="pp-range-val" id="pp-cmap-maxpar-val" style="color:#7c5cbf">1</span>' +
          '</div>' +
          '<button id="pp-cmap-rebuild" style="margin-top:4px">Rebuild</button>',
      },
      {
        label: 'Layout',
        html:
          '<div id="pp-cmap-layout-list">' +
            '<button class="pp-cmap-layout-opt" data-layout="hflow">Horizontal Flow</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="vflow">Vertical Flow</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="htree">Horizontal Tree</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="vtree">Vertical Tree</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="radial">Radial Tree</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="circle">Circle</button>' +
            '<button class="pp-cmap-layout-opt active" data-layout="organic">Organic</button>' +
          '</div>',
      },
    ],
  });

  // ── Inject canvas into main area ──
  nav.mainEl.innerHTML =
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

  if (typeof upgradeSlider === 'function') {
    paneEl.querySelectorAll('.pp-range').forEach(upgradeSlider);
  }

  // Status chip lives in the panel header's status slot
  nav.statusEl.innerHTML =
    '<div id="pp-cmap-status" class="cmap-loading">' +
      '<div class="pp-cmap-dot"></div><span id="pp-cmap-label">Embeddings loading\u2026</span>' +
    '</div>';

  const subtitleEl  = nav.subtitleEl;
  const statusEl    = paneEl.querySelector('#pp-cmap-status');
  const labelEl     = paneEl.querySelector('#pp-cmap-label');
  const canvas      = paneEl.querySelector('#pp-cmap-canvas');
  const world       = paneEl.querySelector('#pp-cmap-world');
  const emptyEl     = paneEl.querySelector('#pp-cmap-empty');
  const rebuildBtn  = paneEl.querySelector('#pp-cmap-rebuild');
  const layoutOpts  = paneEl.querySelectorAll('.pp-cmap-layout-opt');
  const depthSlider = paneEl.querySelector('#pp-cmap-depth');
  const depthValEl  = paneEl.querySelector('#pp-cmap-depth-val');
  const threshSlider= paneEl.querySelector('#pp-cmap-thresh');
  const threshValEl = paneEl.querySelector('#pp-cmap-thresh-val');
  const maxParSlider= paneEl.querySelector('#pp-cmap-maxpar');
  const maxParValEl = paneEl.querySelector('#pp-cmap-maxpar-val');

  const CARD_W = 225;
  const MM_PAD = 16;

  let _depth      = 5;
  let _threshold  = CMAP_PARENT_CHILD_THRESHOLD;
  let _maxParents = 1;
  let _layout     = 'organic';
  let _rows       = null;
  let _rendered   = false;
  let _everRendered = false;
  let _rebuildTimer = null;
  let _topZ       = 10;
  let _panX = 0, _panY = 0, _zoom = 1;
  let _liveRects  = new Map();

  function applyTransform() {
    world.style.transform = 'translate(' + _panX + 'px,' + _panY + 'px) scale(' + _zoom + ')';
  }

  function setStatus(state, text) {
    statusEl.className = 'cmap-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(function() { statusEl.style.opacity = '0'; }, 3200);
  }

  [
    { el: depthSlider,  valEl: depthValEl,  read: function() { _depth = +depthSlider.value; depthValEl.textContent = _depth; } },
    { el: threshSlider, valEl: threshValEl, read: function() { _threshold = +threshSlider.value / 100; threshValEl.textContent = threshSlider.value + '%'; } },
    { el: maxParSlider, valEl: maxParValEl, read: function() { _maxParents = +maxParSlider.value; maxParValEl.textContent = _maxParents; } },
  ].forEach(function(item) {
    item.el.addEventListener('input', function() {
      item.read();
      clearTimeout(_rebuildTimer);
      rebuildBtn.classList.add('pp-cmap-busy');
      _rebuildTimer = setTimeout(function() {
        rebuildBtn.classList.remove('pp-cmap-busy');
        _rendered = false; tryRender();
      }, DRAG_DELAY);
    });
  });

  rebuildBtn.addEventListener('click', function() { clearTimeout(_rebuildTimer); _rendered = false; tryRender(); });

  layoutOpts.forEach(function(opt) {
    opt.addEventListener('click', function() {
      var l = opt.dataset.layout; if (!l) return;
      _layout = l;
      layoutOpts.forEach(function(o) { o.classList.toggle('active', o.dataset.layout === l); });
      if (_rendered) { _rendered = false; tryRender(); }
    });
  });

  function fitAll() {
    if (!_liveRects.size) return;
    var minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    _liveRects.forEach(function(r) { minX=Math.min(minX,r.x); minY=Math.min(minY,r.y); maxX=Math.max(maxX,r.x+(r.w||CARD_W)); maxY=Math.max(maxY,r.y+(r.h||80)); });
    if (!isFinite(minX)) return;
    var W=canvas.clientWidth||400, H=canvas.clientHeight||400, pad=32;
    var scaleX=(W-pad*2)/Math.max(maxX-minX,1), scaleY=(H-pad*2)/Math.max(maxY-minY,1);
    _zoom=Math.min(scaleX,scaleY,2.5);
    _panX=pad-minX*_zoom+(W-pad*2-(maxX-minX)*_zoom)/2;
    _panY=pad-minY*_zoom+(H-pad*2-(maxY-minY)*_zoom)/2;
    applyTransform();
  }
  fitBtn.addEventListener('click', fitAll);

  var _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;

  canvas.addEventListener('mousedown', function(ev) {
    if (ev.button !== 2) return;
    _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY;
    canvas.classList.add('pp-cmap-panning'); ev.preventDefault();
  });
  document.addEventListener('mousemove', function(ev) {
    if (!_panning) return;
    _panX=_panBX+(ev.clientX-_panSX); _panY=_panBY+(ev.clientY-_panSY); applyTransform();
  });
  document.addEventListener('mouseup', function(ev) {
    if (ev.button !== 2 || !_panning) return;
    _panning=false; canvas.classList.remove('pp-cmap-panning');
  });
  canvas.addEventListener('contextmenu', function(ev) { ev.preventDefault(); });

  canvas.addEventListener('wheel', function(ev) {
    ev.preventDefault();
    var rect=canvas.getBoundingClientRect(), mx=ev.clientX-rect.left, my=ev.clientY-rect.top;
    if (ev.ctrlKey || (Math.abs(ev.deltaY) >= 50 && Math.abs(ev.deltaX) < 50)) {
      var dz=ev.deltaY>0?0.94:1/0.94, nz=Math.max(0.15,Math.min(4,_zoom*dz));
      _panX=mx-(mx-_panX)*nz/_zoom; _panY=my-(my-_panY)*nz/_zoom; _zoom=nz;
    } else {
      _panX-=ev.deltaX; _panY-=ev.deltaY;
    }
    applyTransform();
  }, {passive:false});

  var _pointers = new Map();
  var _cardDrag   = null;
  var _pinchState = null;

  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', function(ev) {
    if (ev.target.closest('.pp-cmap-card')) return;
    canvas.setPointerCapture(ev.pointerId);
    _pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (_pointers.size === 2) {
      var pts = Array.from(_pointers.values());
      _pinchState = {
        midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2,
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        panX: _panX, panY: _panY, zoom: _zoom,
      };
    } else {
      _pinchState = null;
    }
  });

  canvas.addEventListener('pointermove', function(ev) {
    if (!_pointers.has(ev.pointerId)) return;
    var prev = _pointers.get(ev.pointerId);
    _pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (_pointers.size === 1 && !_pinchState) {
      ev.preventDefault();
      _panX += ev.clientX - prev.x;
      _panY += ev.clientY - prev.y;
      applyTransform();
      return;
    }
    if (_pinchState && _pointers.size >= 2) {
      ev.preventDefault();
      var pts     = Array.from(_pointers.values());
      var newMidX = (pts[0].x + pts[1].x) / 2;
      var newMidY = (pts[0].y + pts[1].y) / 2;
      var newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      var rect    = canvas.getBoundingClientRect();
      var cmx     = newMidX - rect.left;
      var cmy     = newMidY - rect.top;
      var sf      = newDist / _pinchState.dist;
      var nz      = Math.max(0.15, Math.min(4, _pinchState.zoom * sf));
      var origCmx = _pinchState.midX - rect.left;
      var origCmy = _pinchState.midY - rect.top;
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

    el.addEventListener('pointerdown', function(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.stopPropagation();
      el.setPointerCapture(ev.pointerId);
      var r = _liveRects.get(cid) || { x: 0, y: 0 };
      _cardDrag = { el: el, cid: cid, pointerId: ev.pointerId, ox: ev.clientX, oy: ev.clientY, sx: r.x, sy: r.y };
      el.style.zIndex = String(++_topZ);
      ev.preventDefault();
    });

    el.addEventListener('pointermove', function(ev) {
      if (!_cardDrag || ev.pointerId !== _cardDrag.pointerId) return;
      ev.preventDefault();
      var dx = (ev.clientX - _cardDrag.ox) / _zoom;
      var dy = (ev.clientY - _cardDrag.oy) / _zoom;
      var nx = _cardDrag.sx + dx;
      var ny = _cardDrag.sy + dy;
      var r  = _liveRects.get(cid) || { w: CARD_W, h: 80 };
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
      _liveRects.set(cid, { x: nx, y: ny, w: r.w, h: r.h });
      redrawConnectors();
    });

    el.addEventListener('pointerup',     function(ev) { if (_cardDrag && ev.pointerId === _cardDrag.pointerId) _cardDrag = null; });
    el.addEventListener('pointercancel', function(ev) { if (_cardDrag && ev.pointerId === _cardDrag.pointerId) _cardDrag = null; });
  }

  function cosineSim(a, b) {
    if (!a||!b||a.length!==b.length) return 0;
    var dot=0, na=0, nb=0;
    for (var i=0;i<a.length;i++) { dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return (na&&nb) ? Math.max(0,Math.min(1,dot/(Math.sqrt(na)*Math.sqrt(nb)))) : 0;
  }

  function avgVec(vecs) {
    var valid=vecs.filter(Boolean); if (!valid.length) return null;
    var dim=valid[0].length, sum=new Float32Array(dim);
    valid.forEach(function(v){ v.forEach(function(x,i){ sum[i]+=x; }); });
    return Array.from(sum).map(function(x){ return x/valid.length; });
  }

  function sentenceSplit(text) {
    return text
      .replace(/\r\n|\r/g, '\n')
      .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
      .replace(/([;])\s+/g, '$1\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/:\s{1,3}(?=\S)/g, ':\n')
      .replace(/\s+[—–]\s+/g, '\n')
      .split('\n')
      .map(function(s){ return s.trim(); })
      .filter(function(s){ return s.length >= 30; });
  }

  async function maybySplitRow(row) {
    var cells=row.row&&row.row.cells?row.row.cells:(row.cells||[]);
    var cats=row.row&&row.row.cats?row.row.cats.filter(function(c){ return c.trim(); }):[];
    var catStr=cats.join(' \u00b7 ')||'Cell';
    var bestText='', bestIdx=0;
    cells.forEach(function(c,i){ if(c.trim().length>bestText.length){ bestText=c.trim(); bestIdx=i; } });
    if (bestText.length < 60) return [row];
    var segments=sentenceSplit(bestText);
    if (segments.length<=1) return [row];

    // Try to get per-sentence embeddings first
    var segVecs;
    try { segVecs=await Promise.all(segments.map(function(s){ return window.EmbeddingUtils.getCachedEmbedding(s); })); }
    catch(e){ segVecs=null; }

    var valid=segVecs
      ? segments.map(function(s,i){ return {text:s,vec:segVecs[i]}; }).filter(function(x){ return x.vec&&x.vec.length; })
      : [];

    // If embeddings unavailable for sentences (common — bridge only stores full-cell vectors),
    // fall back to structural split: use the parent row's vector for all segments.
    // This still produces multiple cards with x/n labels, grouped by topic proximity.
    if (valid.length <= 1) {
      var parentVec = row.vec;
      if (!parentVec) return [row];
      // Each segment gets the parent's vector — they'll cluster together, which is correct
      // since they came from the same source cell. The split is purely structural/display.
      return segments.map(function(seg, ni) {
        return {
          tabIdx: row.tabIdx, rowIdx: row.rowIdx,
          headers: row.headers||[], title: row.title||'',
          kws: row.kws||new Set(),
          _splitFrom: catStr, _splitN: ni+1, _splitT: segments.length,
          vec: parentVec,
          row: { cells: cells.map(function(c,ci){ return ci===bestIdx ? seg : c; }), cats: cats }
        };
      });
    }

    // We have real per-sentence embeddings — do semantic grouping
    var SPLIT_THRESHOLD = 0.55;
    var n=valid.length;
    var sim=Array.from({length:n},function(_,i){ return Array.from({length:n},function(_,j){ return i===j?1:cosineSim(valid[i].vec,valid[j].vec); }); });
    var groupOf=new Array(n).fill(-1); var numGroups=0;
    for (var i=0;i<n;i++) {
      if (groupOf[i]!==-1) continue; var g=numGroups++; groupOf[i]=g;
      for (var j=i+1;j<n;j++) {
        if (groupOf[j]!==-1) continue;
        var membersOfG=valid.map(function(_,k){ return k; }).filter(function(k){ return groupOf[k]===g; });
        var allSimilar=membersOfG.every(function(k){ return sim[k][j]>=SPLIT_THRESHOLD; });
        if (allSimilar) groupOf[j]=g;
      }
    }
    if (numGroups<=1) return [row];
    var t=numGroups, groups=Array.from({length:t},function(){ return []; });
    valid.forEach(function(seg,i){ groups[groupOf[i]].push(seg); });
    return groups.map(function(segs,ni){ return { tabIdx:row.tabIdx, rowIdx:row.rowIdx, headers:row.headers||[], title:row.title||'', kws:row.kws||new Set(), _splitFrom:catStr, _splitN:ni+1, _splitT:t, vec:avgVec(segs.map(function(s){ return s.vec; })), row:{cells:cells.map(function(c,ci){ return ci===bestIdx?segs.map(function(s){ return s.text; }).join(' '):''; }), cats:cats} }; });
  }

  async function splitAllRows(rows) {
    var result=[];
    for (var i=0; i<rows.length; i++) { var parts=await maybySplitRow(rows[i]); parts.forEach(function(r){ result.push(r); }); }
    return result;
  }

  function buildHierarchy(rows) {
    var n=rows.length; if (n<2) return null;

    // Split siblings share the same parent vec — exclude them from comparing against each other
    function areSplitSiblings(i, j) {
      return rows[i]._splitFrom && rows[j]._splitFrom && rows[i]._splitFrom === rows[j]._splitFrom
        && rows[i].tabIdx === rows[j].tabIdx && rows[i].rowIdx === rows[j].rowIdx;
    }

    var scores=new Float32Array(n);
    for (var i=0;i<n;i++) { var sum=0, cnt=0; for (var j=0;j<n;j++) { if (i!==j&&!areSplitSiblings(i,j)) { sum+=cosineSim(rows[i].vec,rows[j].vec); cnt++; } } scores[i]=cnt?sum/cnt:0; }

    var rankOrder=Array.from({length:n},function(_,i){ return i; }).sort(function(a,b){ return scores[b]-scores[a]; });
    var levels=new Int32Array(n);
    rankOrder.forEach(function(ri,rank){ levels[ri]=Math.max(1,Math.min(_depth,Math.floor(rank*_depth/n)+1)); });

    var parentsOf    = new Map();
    var parentSimsOf = new Map();

    for (var i=0;i<n;i++) {
      parentsOf.set(i,[]); parentSimsOf.set(i,[]);
      if (levels[i]===1) continue;
      var candidates=[];
      for (var j=0;j<n;j++) {
        if (j===i||levels[j]!==levels[i]-1||areSplitSiblings(i,j)) continue;
        var s=cosineSim(rows[i].vec,rows[j].vec);
        if (s>=_threshold) candidates.push({j:j,s:s});
      }
      candidates.sort(function(a,b){ return b.s-a.s; });
      var kept=candidates.slice(0,_maxParents);
      parentsOf.set(i,kept.map(function(c){ return c.j; }));
      parentSimsOf.set(i,kept.map(function(c){ return c.s; }));
    }

    var relaxed=_threshold*ORPHAN_RECOVERY_THRESHOLD;
    for (var i=0;i<n;i++) {
      if (levels[i]<=1||parentsOf.get(i).length>0) continue;
      var bestJ=-1, bestSim=relaxed;
      for (var j=0;j<n;j++) {
        if (j===i||levels[j]>=levels[i]||areSplitSiblings(i,j)) continue;
        var s=cosineSim(rows[i].vec,rows[j].vec); if (s>bestSim){ bestSim=s; bestJ=j; }
      }
      if (bestJ!==-1) { levels[i]=levels[bestJ]+1; parentsOf.set(i,[bestJ]); parentSimsOf.set(i,[bestSim]); }
      else levels[i]=1;
    }

    var childrenOf=Array.from({length:n},function(){ return []; });
    for (var i=0;i<n;i++) { parentsOf.get(i).forEach(function(p){ if(!childrenOf[p].includes(i)) childrenOf[p].push(i); }); }

    var simToChildren=new Float32Array(n);
    for (var i=0;i<n;i++) { if (!childrenOf[i].length) continue; var sum=0; childrenOf[i].forEach(function(c){ sum+=cosineSim(rows[i].vec,rows[c].vec); }); simToChildren[i]=sum/childrenOf[i].length; }

    var simToParents=new Float32Array(n);
    for (var i=0;i<n;i++) { var pars=parentsOf.get(i)||[]; if (!pars.length) continue; var sum=0; pars.forEach(function(p){ sum+=cosineSim(rows[i].vec,rows[p].vec); }); simToParents[i]=sum/pars.length; }

    var absorbedInto=new Int32Array(n).fill(-1), mergeExtras=new Map();
    var mkKey=function(i){ return levels[i]+':p'+parentsOf.get(i).slice().sort(function(a,b){ return a-b; }).join(',')+':c'+childrenOf[i].slice().sort(function(a,b){ return a-b; }).join(','); };
    var seenKeys=new Map();
    for (var i=0;i<n;i++) {
      if (!childrenOf[i].length) continue;
      var k=mkKey(i);
      if (seenKeys.has(k)) { var primary=seenKeys.get(k); absorbedInto[i]=primary; if (!mergeExtras.has(primary)) mergeExtras.set(primary,[]); mergeExtras.get(primary).push(i); }
      else seenKeys.set(k,i);
    }

    return { rows:rows, n:n, levels:levels, parentsOf:parentsOf, parentSimsOf:parentSimsOf, childrenOf:childrenOf, simToChildren:simToChildren, simToParents:simToParents, absorbedInto:absorbedInto, mergeExtras:mergeExtras };
  }

  var _connSvg=null, _connEdges=[];

  function redrawConnectors() {
    if (!_connSvg) return;
    var rects = _liveRects;
    var ns='http://www.w3.org/2000/svg';
    _connSvg.innerHTML='';
    _connEdges.forEach(function(edge) {
      var fromId=edge.fromId, toId=edge.toId, color=edge.color, depth=edge.depth;
      var ra=rects.get(fromId), rb=rects.get(toId); if (!ra||!rb) return;
      function pts(r){ var x=r.x,y=r.y,w=r.w,h=r.h; return [{x:x+w*.25,y:y},{x:x+w*.5,y:y},{x:x+w*.75,y:y},{x:x+w*.25,y:y+h},{x:x+w*.5,y:y+h},{x:x+w*.75,y:y+h},{x:x,y:y+h*.33},{x:x,y:y+h*.67},{x:x+w,y:y+h*.33},{x:x+w,y:y+h*.67}]; }
      var pA=pts(ra), pB=pts(rb); var best=null, bd=Infinity;
      pA.forEach(function(a){ pB.forEach(function(b){ var d=Math.hypot(a.x-b.x,a.y-b.y); if(d<bd){bd=d;best={a:a,b:b};} }); });
      if (!best) return;
      var a=best.a, b=best.b, dist=Math.hypot(b.x-a.x,b.y-a.y), off=Math.min(dist*.4,80);
      function tang(pt,r){ var t=3; if(Math.abs(pt.y-r.y)<t) return{dx:0,dy:-1}; if(Math.abs(pt.y-(r.y+r.h))<t) return{dx:0,dy:1}; if(Math.abs(pt.x-r.x)<t) return{dx:-1,dy:0}; if(Math.abs(pt.x-(r.x+r.w))<t) return{dx:1,dy:0}; return{dx:0,dy:1}; }
      var tA=tang(a,ra), tB=tang(b,rb);
      var path=document.createElementNS(ns,'path');
      path.setAttribute('d','M'+a.x+','+a.y+' C'+(a.x+tA.dx*off)+','+(a.y+tA.dy*off)+' '+(b.x+tB.dx*off)+','+(b.y+tB.dy*off)+' '+b.x+','+b.y);
      path.setAttribute('fill','none'); path.setAttribute('stroke',color);
      path.setAttribute('stroke-width',depth===0?'2.5':'2');
      path.setAttribute('stroke-opacity',depth===0?'1':'0.9');
      path.setAttribute('stroke-dasharray',depth===0?'none':'5 3');
      _connSvg.appendChild(path);
      var dotChild=document.createElementNS(ns,'circle');
      dotChild.setAttribute('cx',String(b.x)); dotChild.setAttribute('cy',String(b.y)); dotChild.setAttribute('r','3.5');
      dotChild.setAttribute('fill',color); dotChild.setAttribute('opacity','1');
      _connSvg.appendChild(dotChild);
      var dotParent=document.createElementNS(ns,'circle');
      dotParent.setAttribute('cx',String(a.x)); dotParent.setAttribute('cy',String(a.y)); dotParent.setAttribute('r','4');
      dotParent.setAttribute('fill',color); dotParent.setAttribute('opacity','0.9');
      dotParent.setAttribute('stroke','#ffffff'); dotParent.setAttribute('stroke-width','1.5');
      _connSvg.appendChild(dotParent);
    });
  }

  // ── Color by hierarchy level ──────────────────────────────
  // paletteIdx maps level (1-based) to palette slot.
  // Edit this array to change which theme each level uses.
  // e.g. [0,1,2,3,4,5,6,7] uses all 8 themes in order.
  function depthColor(level) {
    var idx = level - 1;
    var palette = (typeof getPalette === 'function') ? getPalette() : (window.PP_PALETTE || []);
    var paletteIdx = [0, 1, 2, 3, 4, 0][Math.min(idx, 5)];
    var theme = palette[paletteIdx] || { accent: '#888888', bg: '#f7f7f8', label: '#ffffff' };

    // Compute contrast text color from accent luminance (no array destructuring)
    function getLuminance(hex) {
      var c = String(hex).replace('#', '');
      if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      var rgb = parseInt(c, 16);
      var r = ((rgb >> 16) & 0xff) / 255;
      var g = ((rgb >> 8)  & 0xff) / 255;
      var b = (rgb & 0xff) / 255;
      function toLinear(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    var lum = getLuminance(theme.accent);
    var label = lum > 0.5 ? '#1a1a1a' : '#ffffff';

    return {
      accent: theme.accent || '#888888',
      bg:     theme.bg     || '#f7f7f8',
      label:  label
    };
  }

  function renderConceptMap(hier) {
    // Capture old positions before wiping — used as animation start points
    var _oldRects = new Map(_liveRects);
    var isFirstRender = (_oldRects.size === 0);

    world.innerHTML=''; emptyEl.style.display='none'; _liveRects.clear(); _connEdges=[]; _topZ=10;
    // Only reset pan/zoom on first render — during re-renders keep current
    // viewport so the animation isn't interrupted by a sudden transform snap
    if (isFirstRender) { _panX=0; _panY=0; _zoom=1; applyTransform(); }
    if (!hier) { emptyEl.style.display='flex'; return; }

    var ns='http://www.w3.org/2000/svg';
    _connSvg=document.createElementNS(ns,'svg');
    _connSvg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1';
    world.appendChild(_connSvg);

    var rows=hier.rows, n=hier.n, levels=hier.levels, parentsOf=hier.parentsOf,
        childrenOf=hier.childrenOf, simToChildren=hier.simToChildren,
        simToParents=hier.simToParents, absorbedInto=hier.absorbedInto, mergeExtras=hier.mergeExtras;
    var cardEls=new Map();

    for (var i=0;i<n;i++) {
      if (absorbedInto[i]!==-1) continue;
      var level=levels[i];
      var dc = depthColor(level);
      var accent=dc.accent, lc=dc.label, bg=dc.bg;
      var extras=mergeExtras.get(i)||[], allRows=[i].concat(extras);

      var card=document.createElement('div');
      card.className='pp-cmap-card';
      // Start card at an old position for morph animation.
      // Distribute across old positions round-robin so every new card has a "from" spot.
      var _oldKeys = Array.from(_oldRects.keys());
      var _startPos = _oldKeys.length > 0
        ? _oldRects.get(_oldKeys[i % _oldKeys.length])
        : { x: canvas.clientWidth/2 - CARD_W/2, y: canvas.clientHeight/2 - 40 };
      card.style.cssText='width:'+CARD_W+'px;position:absolute;z-index:'+(++_topZ)
        +';left:'+_startPos.x+'px;top:'+_startPos.y+'px;transition:none';
      card.style.setProperty('--ppc-border', accent);
      card.style.setProperty('--ppc-bg',     accent);
      card.style.setProperty('--ppc-on',     lc);

      var primaryRow=rows[i], isSplit=!!primaryRow._splitFrom;
      if (isSplit) console.log('[concept-map] card',i,'isSplit=true _splitN='+primaryRow._splitN+'/'+primaryRow._splitT);
      var numParents=(parentsOf.get(i)||[]).length;

      var topRow=document.createElement('div');
      topRow.className='pp-cmap-card-top';

      var catNumEl=document.createElement('div');
      catNumEl.className='pp-cmap-card-cat-num';
      var allCats = primaryRow.row&&primaryRow.row.cats ? primaryRow.row.cats.filter(function(c){ return c.trim(); }) : [];
      var catChar = allCats.length ? allCats.join(' \u00b7 ') : String(level);
      catNumEl.textContent = catChar;

      var levelBlock=document.createElement('div');
      levelBlock.className='pp-cmap-card-level-block';
      var levelNum=document.createElement('div');
      levelNum.className='pp-cmap-card-level-num';
      levelNum.textContent = String(level);
      var levelLbl=document.createElement('div');
      levelLbl.className='pp-cmap-card-level-label';
      levelLbl.textContent = 'Level';
      levelBlock.appendChild(levelNum);
      levelBlock.appendChild(levelLbl);

      topRow.appendChild(catNumEl);
      topRow.appendChild(levelBlock);
      card.appendChild(topRow);

      if (extras.length>0) {
        var mg=document.createElement('div');
        mg.className='pp-cmap-card-merged';
        mg.textContent='\u00d7'+allRows.length+' merged';
        card.appendChild(mg);
      }

      var rule=document.createElement('div');
      rule.className='pp-cmap-card-rule';
      card.appendChild(rule);

      var body=document.createElement('div');
      body.className='pp-cmap-card-body';
      allRows.forEach(function(ri,idx){
        if (idx>0) { var sep=document.createElement('div'); sep.className='pp-cmap-merge-sep'; body.appendChild(sep); }
        var r=rows[ri], cells=r.row&&r.row.cells?r.row.cells:(r.cells||[]);
        var cats=r.row&&r.row.cats?r.row.cats.filter(function(c){ return c.trim(); }):[];
        var best=cells.reduce(function(b,c){ return c.trim().length>b.length?c.trim():b; },'');
        var parsed=typeof parseCitation==='function'?parseCitation(best):{body:best};
        if (cats.length) {
          var ce=document.createElement('div');
          ce.className='pp-cmap-cell-cat';
          ce.textContent=cats.join(' \u00b7 ');
          body.appendChild(ce);
        }
        var te=document.createElement('div');
        te.className='pp-cmap-cell-text';
        te.textContent=parsed.body;
        body.appendChild(te);
        var r2=rows[ri];
        if (r2._splitFrom) {
          var sb=document.createElement('div');
          sb.style.cssText='font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:'+lc+';opacity:0.7;padding:5px 0 2px;';
          sb.textContent=r2._splitN+'/'+r2._splitT+' Split';
          body.appendChild(sb);
        }
      });
      card.appendChild(body);

      var hasChildren=childrenOf[i].length>0;
      var hasParents=numParents>0;

      if (hasChildren||hasParents) {
        var footer=document.createElement('div');
        footer.className='pp-cmap-card-footer';

        function makeSimLine(arrow, sim, label) {
          var pct=Math.round(sim*100);
          var line=document.createElement('div');
          line.className='pp-cmap-sim-line';
          var pctEl=document.createElement('span');
          pctEl.className='pp-cmap-sim-pct';
          pctEl.textContent=pct+'%';
          line.innerHTML='<span>'+arrow+'</span>';
          line.appendChild(pctEl);
          var lblEl=document.createElement('span');
          lblEl.textContent=' '+label;
          line.appendChild(lblEl);
          return line;
        }

        if (hasParents) footer.appendChild(makeSimLine('\u2191', simToParents[i], numParents>1?numParents+' parents':'to parent'));
        if (hasChildren) footer.appendChild(makeSimLine('\u2193', simToChildren[i], 'to children'));
        card.appendChild(footer);
      } else {
        var leaf=document.createElement('span');
        leaf.className='pp-cmap-leaf-badge';
        leaf.textContent='Terminal concept';
        card.appendChild(leaf);
      }

      world.appendChild(card); cardEls.set(i,card);
      var _startR = _oldRects.size > 0 ? (_oldRects.get(Array.from(_oldRects.keys())[i % _oldRects.size]) || {x:0,y:0}) : {x:0,y:0};
      _liveRects.set(i,{x:_startR.x,y:_startR.y,w:CARD_W,h:80});
      makeDraggable(card,i);
      (function(cardEl, cardId) {
        if (window.ResizeObserver) {
          new ResizeObserver(function(){ var r=_liveRects.get(cardId); if(r){r.h=cardEl.offsetHeight;redrawConnectors();} }).observe(cardEl);
        }
      })(card, i);
    }

    for (var i=0;i<n;i++) {
      if (absorbedInto[i]!==-1) continue;
      (parentsOf.get(i)||[]).forEach(function(par){
        var parPrimary=absorbedInto[par]!==-1?absorbedInto[par]:par;
        if (!cardEls.has(i)||!cardEls.has(parPrimary)) return;
        var dc=depthColor(levels[parPrimary]);
        _connEdges.push({fromId:parPrimary,toId:i,color:dc.accent,depth:levels[parPrimary]-1});
      });
    }

    requestAnimationFrame(function(){
      var W=canvas.clientWidth||500, H=canvas.clientHeight||500;
      var nodeIds=[]; cardEls.forEach(function(_,id){ nodeIds.push(id); });
      var byLevel=new Map();
      nodeIds.forEach(function(id){ var lv=levels[id]; if(!byLevel.has(lv)) byLevel.set(lv,[]); byLevel.get(lv).push(id); });
      var maxLevel=Math.max.apply(null, Array.from(byLevel.keys()).concat([1]));

      var primaryParentOf=new Map(), childrenOfPrimary=new Map();
      nodeIds.forEach(function(id){ childrenOfPrimary.set(id,[]); });
      _connEdges.forEach(function(e){
        if (!primaryParentOf.has(e.toId)) { primaryParentOf.set(e.toId,e.fromId); if(childrenOfPrimary.has(e.fromId)) childrenOfPrimary.get(e.fromId).push(e.toId); }
      });
      var roots=nodeIds.filter(function(id){ return !primaryParentOf.has(id); });
      var cH=function(id){ var el=cardEls.get(id); return el?(el.offsetHeight||80):80; };
      var GAP_X=MM_PAD+10, GAP_Y=MM_PAD+20;

      function applyPositions(posMap) {

        // Collision detection on target positions
        var targetRects = new Map();
        posMap.forEach(function(pos, id) {
          targetRects.set(id, { x: pos.x, y: pos.y, w: CARD_W, h: cH(id) });
        });
        for (var pass = 0; pass < 30; pass++) {
          var moved = false;
          targetRects.forEach(function(ra, ka) {
            targetRects.forEach(function(rb, kb) {
              if (ka === kb) return;
              if (ra.x < rb.x+rb.w+MM_PAD && ra.x+ra.w+MM_PAD > rb.x &&
                  ra.y < rb.y+rb.h+MM_PAD && ra.y+ra.h+MM_PAD > rb.y) {
                var dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x;
                var dD=rb.y+rb.h+MM_PAD-ra.y, dU=ra.y+ra.h+MM_PAD-rb.y;
                if (Math.min(dR,dL) <= Math.min(dD,dU)) ra.x += dR<dL ? dR : -dL;
                else ra.y += dD<dU ? dD : -dU;
                moved = true;
              }
            });
          });
          if (!moved) break;
        }

        var ids = Array.from(targetRects.keys());

        // Capture start positions from current card styles
        var startRects = new Map();
        ids.forEach(function(id) {
          var el = cardEls.get(id);
          if (!el) return;
          el.style.transition = 'none'; // disable CSS transitions — we drive everything in JS
          startRects.set(id, {
            x: parseFloat(el.style.left) || 0,
            y: parseFloat(el.style.top)  || 0
          });
        });

        // Easing: cubic-bezier approximation of ease-out
        function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

        var DURATION = 700;
        var startTime = null;
        var stagger = Math.min(18, 180 / Math.max(ids.length, 1));

        function frame(now) {
          if (!startTime) startTime = now;
          var elapsed = now - startTime;

          ids.forEach(function(id, i) {
            var el = cardEls.get(id);
            if (!el) return;
            var delay = i * stagger;
            var t = Math.max(0, Math.min(1, (elapsed - delay) / DURATION));
            var et = easeOut(t);
            var from = startRects.get(id);
            var to   = targetRects.get(id);
            var cx = from.x + (to.x - from.x) * et;
            var cy = from.y + (to.y - from.y) * et;
            el.style.left = cx + 'px';
            el.style.top  = cy + 'px';
            // Keep _liveRects in sync so connectors draw at real current positions
            var r = _liveRects.get(id) || { w: CARD_W, h: 80 };
            _liveRects.set(id, { x: cx, y: cy, w: r.w, h: r.h });
          });

          redrawConnectors(); // always reads _liveRects which is current interpolated pos

          var maxDelay = (ids.length - 1) * stagger;
          if (elapsed < DURATION + maxDelay) {
            requestAnimationFrame(frame);
          } else {
            // Snap to exact final positions
            ids.forEach(function(id) {
              var el = cardEls.get(id);
              var to = targetRects.get(id);
              if (!el || !to) return;
              el.style.left = to.x + 'px';
              el.style.top  = to.y + 'px';
              _liveRects.set(id, { x: to.x, y: to.y, w: to.w, h: to.h });
            });
            redrawConnectors();
          }
        }

        requestAnimationFrame(frame);

        _everRendered = true;
      }

      // ── CIRCLE — nodes evenly spaced on a circle, BFS-ordered so connected nodes sit adjacent ──
      function layoutCircle() {
        var pos=new Map(), cx=W/2, cy=H/2;
        var order=[], visited=new Set();
        var queue=roots.slice();
        while (queue.length) { var id=queue.shift(); if (visited.has(id)) continue; visited.add(id); order.push(id); (childrenOfPrimary.get(id)||[]).forEach(function(c){ queue.push(c); }); }
        nodeIds.forEach(function(id){ if (!visited.has(id)) order.push(id); });
        var n=order.length, R=Math.min(W,H)*0.38;
        order.forEach(function(id,i){ var a=(2*Math.PI*i/n)-Math.PI/2, h=cH(id); pos.set(id,{x:cx+R*Math.cos(a)-CARD_W/2,y:cy+R*Math.sin(a)-h/2}); });
        applyPositions(pos);
      }

      // ── RADIAL TREE — root at center, children on concentric rings by depth ──
      function layoutRadial() {
        var pos=new Map(), cx=W/2, cy=H/2;
        // Single root at center; if multiple roots treat them as level-1 ring
        if (roots.length===1 && byLevel.size > 1) {
          var rootId=roots[0], h=cH(rootId);
          pos.set(rootId,{x:cx-CARD_W/2, y:cy-h/2});
          byLevel.forEach(function(ids,lv){
            if (lv===1) return; // root already placed
            var R=(0.18+(lv-2)*0.20)*Math.min(W,H);
            ids.forEach(function(id,idx){ var h2=cH(id), a=(2*Math.PI*idx/ids.length)-Math.PI/2; pos.set(id,{x:cx+R*Math.cos(a)-CARD_W/2,y:cy+R*Math.sin(a)-h2/2}); });
          });
        } else {
          // Fallback: concentric rings by level
          byLevel.forEach(function(ids,lv){
            var R=maxLevel===1?0:(0.12+0.20*(lv-1))*Math.min(W,H);
            ids.forEach(function(id,idx){ var h=cH(id); if(lv===1&&ids.length===1){pos.set(id,{x:cx-CARD_W/2,y:cy-h/2});return;} var a=(2*Math.PI*idx/ids.length)-Math.PI/2; pos.set(id,{x:cx+R*Math.cos(a)-CARD_W/2,y:cy+R*Math.sin(a)-h/2}); });
          });
        }
        applyPositions(pos);
      }

      // ── TREE — recursive subtree placement, roots at top (vtree) or left (htree) ──
      function subtreeW(id){ var kids=childrenOfPrimary.get(id)||[]; if(!kids.length) return CARD_W; return kids.reduce(function(s,k){ return s+subtreeW(k); },0)+GAP_X*(kids.length-1); }
      function subtreeH(id){ var kids=childrenOfPrimary.get(id)||[]; if(!kids.length) return cH(id); return kids.reduce(function(s,k){ return Math.max(s,subtreeH(k)); },0)+cH(id)+GAP_Y*2; }
      function layoutTree(vertical) {
        var pos=new Map();
        function place(id,left,depth){
          var kids=childrenOfPrimary.get(id)||[], myW=subtreeW(id), mid=left+myW/2, h=cH(id);
          var rowY=depth*(120+GAP_Y);
          if (vertical) pos.set(id,{x:mid-CARD_W/2,y:rowY});
          else pos.set(id,{x:rowY,y:mid-h/2});
          var childLeft=left;
          kids.forEach(function(kid){ place(kid,childLeft,depth+1); childLeft+=subtreeW(kid)+GAP_X; });
        }
        var totalW=roots.reduce(function(s,r){ return s+subtreeW(r); },0)+GAP_X*(roots.length-1);
        var curX=vertical ? W/2-totalW/2 : GAP_Y;
        roots.forEach(function(r){ place(r,curX,0); curX+=subtreeW(r)+GAP_X; });
        applyPositions(pos);
      }

      // ── FLOW — strict lanes by hierarchy level, nodes spread evenly in each lane ──
      function layoutFlow(vertical) {
        var pos=new Map();
        var levelList=[]; byLevel.forEach(function(ids,lv){ levelList.push({lv:lv,ids:ids}); });
        levelList.sort(function(a,b){ return a.lv-b.lv; });
        var layerOffset=0;
        levelList.forEach(function(layer){
          var ids=layer.ids;
          var layerMaxH=Math.max.apply(null,ids.map(cH).concat([80]));
          var totalSpan=ids.length*(CARD_W+GAP_X)-GAP_X;
          ids.forEach(function(id,idx){
            var h=cH(id);
            var span=vertical ? W : H;
            var start=span/2-totalSpan/2;
            if (vertical) pos.set(id,{x:start+idx*(CARD_W+GAP_X), y:layerOffset+(layerMaxH-h)/2});
            else           pos.set(id,{x:layerOffset+(layerMaxH-h)/2, y:start+idx*(CARD_W+GAP_X)});
          });
          layerOffset+=layerMaxH+GAP_Y*3;
        });
        applyPositions(pos);
      }

      // ── ORGANIC — force-directed, clusters naturally emerge ──
      // Uses Fruchterman-Reingold with semantic similarity as edge weights:
      // connected nodes attract, all nodes repel, clusters form naturally.
      function layoutOrganic() {
        var px={}, py={};
        // Seed positions: spread on circle with slight jitter so force sim has room to work
        nodeIds.forEach(function(id,i){
          var a=(2*Math.PI*i/nodeIds.length)-Math.PI/2;
          var R=Math.min(W,H)*.30;
          px[id]=W/2+R*Math.cos(a)+(Math.random()-.5)*80;
          py[id]=H/2+R*Math.sin(a)+(Math.random()-.5)*80;
        });

        var AREA=W*H, k=Math.sqrt(AREA/Math.max(nodeIds.length,1))*1.1;
        var temp=Math.min(W,H)*.3;

        for (var it=0;it<200;it++) {
          var dx={}, dy={}; nodeIds.forEach(function(id){ dx[id]=0; dy[id]=0; });

          // Repulsion between all pairs
          for (var ii=0;ii<nodeIds.length;ii++) {
            for (var jj=ii+1;jj<nodeIds.length;jj++) {
              var u=nodeIds[ii],v=nodeIds[jj];
              var ddx=px[u]-px[v], ddy=py[u]-py[v];
              var d=Math.sqrt(ddx*ddx+ddy*ddy)||.01;
              var f=k*k/d;
              dx[u]+=ddx/d*f; dy[u]+=ddy/d*f;
              dx[v]-=ddx/d*f; dy[v]-=ddy/d*f;
            }
          }

          // Attraction along edges (weighted by depth — deeper edges pull harder)
          _connEdges.forEach(function(e){
            var u=e.fromId,v=e.toId;
            if (!px.hasOwnProperty(u)||!px.hasOwnProperty(v)) return;
            var ddx=px[v]-px[u], ddy=py[v]-py[u];
            var d=Math.sqrt(ddx*ddx+ddy*ddy)||.01;
            var w=e.depth===0?1.4:1.0;
            var f=d*d/k*w;
            dx[u]+=ddx/d*f; dy[u]+=ddy/d*f;
            dx[v]-=ddx/d*f; dy[v]-=ddy/d*f;
          });

          // Gravity toward center so graph doesn't drift off canvas
          var grav=0.04;
          nodeIds.forEach(function(id){
            dx[id]+=(W/2-px[id])*grav;
            dy[id]+=(H/2-py[id])*grav;
          });

          // Apply with temperature cooling
          nodeIds.forEach(function(id){
            var d=Math.sqrt(dx[id]*dx[id]+dy[id]*dy[id])||.01;
            var disp=Math.min(d,temp);
            px[id]+=dx[id]/d*disp;
            py[id]+=dy[id]/d*disp;
          });
          temp*=0.95;
        }

        var pos=new Map();
        nodeIds.forEach(function(id){ var h=cH(id); pos.set(id,{x:px[id]-CARD_W/2,y:py[id]-h/2}); });
        applyPositions(pos);
      }

      switch (_layout) {
        case 'hflow':  layoutFlow(false); break;
        case 'vflow':  layoutFlow(true);  break;
        case 'htree':  layoutTree(false); break;
        case 'vtree':  layoutTree(true);  break;
        case 'radial': layoutRadial();    break;
        case 'circle': layoutCircle();    break;
        default:       layoutOrganic();   break;
      }
      // fitAll intentionally not called here — user controls viewport
    });
  }

  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils||!window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex!=='function') return;
    if (_rows) { doRender(); return; }
    var rawRows=buildRowIndex(); if (!rawRows.length) return;
    setStatus('loading','Embedding '+rawRows.length+' cells\u2026'); emptyEl.style.display='none';
    Promise.all(rawRows.map(function(r){ var text=(r.row&&r.row.cells?r.row.cells:(r.cells||[])).join(' ').trim(); if(!text) return Promise.resolve(null); return window.EmbeddingUtils.getCachedEmbedding(text).then(function(vec){ return {key:r.tabIdx+':'+r.rowIdx,vec:vec}; }).catch(function(){ return null; }); })).then(function(results){
      var vectors=new Map(); results.forEach(function(res){ if(res&&res.vec) vectors.set(res.key,res.vec); });
      if (!vectors.size){ setStatus('error','No vectors available'); return; }
      var embedded=rawRows.filter(function(r){ return vectors.has(r.tabIdx+':'+r.rowIdx); });
      if (embedded.length<3){ setStatus('error','Not enough data (\u22653 cells needed)'); return; }
      embedded.forEach(function(r){ r.vec=vectors.get(r.tabIdx+':'+r.rowIdx); }); _rows=embedded; doRender();
    });
  }

  async function doRender() {
    rebuildBtn.classList.remove('pp-cmap-busy');
    setStatus('loading','Splitting cells\u2026');
    var workRows;
    try { workRows=await splitAllRows(_rows); } catch(e){ console.warn('[concept-map] split error:',e); workRows=_rows; }
    var splitCount=workRows.length-_rows.length;
    setStatus('loading','Building hierarchy for '+workRows.length+' concepts\u2026');
    setTimeout(function(){
      try {
        var hier=buildHierarchy(workRows);
        if (!hier){ setStatus('error','Not enough data'); return; }
        var visibleCount=0, multiParentCount=0;
        var levelCounts=new Map();
        for (var i=0;i<hier.n;i++) {
          if (hier.absorbedInto[i]!==-1) continue; visibleCount++;
          var lv=hier.levels[i]; levelCounts.set(lv,(levelCounts.get(lv)||0)+1);
          if ((hier.parentsOf.get(i)||[]).length>1) multiParentCount++;
        }
        var levelStr=Array.from(levelCounts.keys()).sort(function(a,b){ return a-b; }).map(function(l){ return 'L'+l+': '+levelCounts.get(l); }).join(' \u00b7 ');
        var splitStr=splitCount>0?' \u00b7 '+splitCount+' split'+(splitCount===1?'':'s'):'';
        var mpStr=multiParentCount>0?' \u00b7 '+multiParentCount+' multi-parent':'';
        renderConceptMap(hier);
        subtitleEl.textContent=visibleCount+' cards \u00b7 '+levelStr+splitStr+mpStr;
        setStatus('ready','Done'); _rendered=true;
      } catch(err){ console.error('[concept-map]',err); setStatus('error','Failed: '+err.message); }
    },20);
  }

  if (window.EmbeddingUtils&&window.EmbeddingUtils.isReady()) setTimeout(tryRender,120);
  document.addEventListener('embeddings-ready',function(){ setTimeout(tryRender,120); });
  window.addEventListener('embedding-progress',function(ev){ if(!_rendered) setStatus('loading','Indexing\u2026 '+ev.detail.pct+'%'); });
  window.addEventListener('embedder-ready',function(){ setTimeout(tryRender,120); });
  window.addEventListener('df-theme-change', function() { _rendered=false; tryRender(); });

  return {
    reset: function() {
      _rendered=false; _everRendered=false; _rows=null; _liveRects.clear(); _connEdges=[]; _connSvg=null;
      world.innerHTML=''; emptyEl.style.display='flex'; _panX=0; _panY=0; _zoom=1; applyTransform();
    },
    resize: function() {
      if (_rendered) fitAll();
    },
    start: function() {
      setTimeout(tryRender, 120);
    }
  };
}
