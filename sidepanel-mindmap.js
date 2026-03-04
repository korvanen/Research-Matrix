// sidepanel-mindmap.js — Concept Map tool v14 (cell-level hierarchy)

// Global tuning constants (kept from previous)
const CMAP_CHILD_K_MIN = 3;
console.log("Aalto Ai version")
// Inject styles (from your existing tool)
(function injectCmapStyles() { if (document.getElementById('pp-cmap-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cmap-styles';
  s.textContent = `
#pp-cmap-head { flex-shrink:0; padding:10px 12px 8px; border-bottom:1px solid var(--sidebar-box-border,rgba(0,0,0,.1)); display:flex; flex-direction:column; gap:5px; }
#pp-cmap-subtitle { font-size:11px; font-weight:500; color:rgba(0,0,0,.45); letter-spacing:.04em; line-height:1.3; min-height:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#pp-cmap-status { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:6px; font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; transition:opacity .6s ease, background .4s ease; }
#pp-cmap-status.cmap-loading { background:rgba(0,0,0,.06); color:rgba(0,0,0,.4); }
#pp-cmap-status.cmap-ready { background:rgba(60,180,100,.12); color:rgba(30,130,60,.9); }
#pp-cmap-status.cmap-error { background:rgba(200,60,60,.10); color:rgba(180,40,40,.85); }
.pp-cmap-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .4s; }
#pp-cmap-status.cmap-loading .pp-cmap-dot { background:rgba(0,0,0,.25);animation:pp-cmap-pulse 1.2s ease-in-out infinite; }
#pp-cmap-status.cmap-ready .pp-cmap-dot { background:rgba(40,160,80,.9); }
#pp-cmap-status.cmap-error .pp-cmap-dot { background:rgba(180,40,40,.85); }
@keyframes pp-cmap-pulse { 0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);} }
/* Controls row: depth | layout-btn | rebuild */
#pp-cmap-controls { display:grid; grid-template-columns:1fr auto auto; gap:6px; align-items:end; }
.pp-cmap-ctrl-col { display:flex; flex-direction:column; gap:2px; }
.pp-cmap-group-label { font-size:7px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:rgba(0,0,0,.28); line-height:1; margin-bottom:1px; }
.pp-cmap-range-row { display:flex; align-items:center; gap:3px; }
.pp-cmap-range-label { font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(0,0,0,.35); flex-shrink:0; width:18px; }
.pp-cmap-range-val { font-size:9px; font-weight:700; color:rgba(0,0,0,.55); flex-shrink:0; width:12px; text-align:right; }
.pp-cmap-range { -webkit-appearance:none; appearance:none; flex:1; height:3px; border-radius:2px; background:rgba(0,0,0,.12); outline:none; cursor:pointer; min-width:0; }
.pp-cmap-range::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:11px; height:11px; border-radius:50%; background:var(--color-topbar-sheet,#111); box-shadow:0 1px 3px rgba(0,0,0,.22); cursor:pointer; transition:transform .12s; }
.pp-cmap-range::-webkit-slider-thumb:hover { transform:scale(1.2); }
.pp-cmap-range::-moz-range-thumb { width:11px; height:11px; border-radius:50%; border:none; background:var(--color-topbar-sheet,#111); box-shadow:0 1px 3px rgba(0,0,0,.22); cursor:pointer; }
#pp-cmap-rebuild { border:none; border-radius:5px; padding:4px 8px; font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; background:rgba(0,0,0,.07); color:rgba(0,0,0,.45); cursor:pointer; transition:background .15s,color .15s; white-space:nowrap; align-self:stretch; }
#pp-cmap-rebuild:hover { background:rgba(0,0,0,.13); color:rgba(0,0,0,.75); }
#pp-cmap-rebuild.pp-cmap-busy { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }
/* Layout dropdown */
#pp-cmap-layout-wrap { position:relative; align-self:stretch; }
#pp-cmap-layout-btn { height:100%; border:none; border-radius:5px; padding:4px 7px; font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; background:rgba(0,0,0,.07); color:rgba(0,0,0,.45); cursor:pointer; transition:background .15s,color .15s; white-space:nowrap; display:flex; align-items:center; gap:3px; }
#pp-cmap-layout-btn:hover, #pp-cmap-layout-btn.open { background:rgba(0,0,0,.13); color:rgba(0,0,0,.75); }
#pp-cmap-layout-btn svg { flex-shrink:0; }
#pp-cmap-layout-menu { position:absolute; top:calc(100% + 5px); right:0; z-index:300; background:#fff; border:1px solid rgba(0,0,0,.13); border-radius:9px; box-shadow:0 6px 22px rgba(0,0,0,.18); padding:5px; min-width:148px; display:none; flex-direction:column; gap:1px; transform-origin:top right; animation:pp-cmap-menu-in .15s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes pp-cmap-menu-in { from { opacity:0; transform:scale(.92) translateY(-6px); } to { opacity:1; transform:scale(1) translateY(0); } }
#pp-cmap-layout-menu.open { display:flex; }
.pp-cmap-layout-sep { height:1px; background:rgba(0,0,0,.07); margin:3px 4px; }
.pp-cmap-layout-group { font-size:7px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:rgba(0,0,0,.28); padding:4px 9px 2px; }
.pp-cmap-layout-opt { display:flex; align-items:center; gap:6px; width:100%; border:none; background:transparent; text-align:left; padding:5px 9px; border-radius:6px; cursor:pointer; font-size:9px; font-weight:600; letter-spacing:.03em; color:rgba(0,0,0,.6); transition:background .12s; }
.pp-cmap-layout-opt:hover { background:rgba(0,0,0,.06); color:rgba(0,0,0,.85); }
.pp-cmap-layout-opt.active { color:var(--color-topbar-sheet,#111); background:rgba(0,0,0,.07); }
.pp-cmap-layout-opt svg { flex-shrink:0; opacity:0.55; }
.pp-cmap-layout-opt.active svg { opacity:1; }
#pp-cmap-canvas { flex:1; min-height:0; position:relative; overflow:hidden; cursor:default; user-select:none; }
#pp-cmap-canvas.pp-cmap-panning { cursor:grabbing !important; }
#pp-cmap-world { position:absolute; top:0; left:0; width:100%; height:100%; transform-origin:0 0; }
#pp-cmap-empty { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(0,0,0,.25); text-align:center; padding:24px; pointer-events:none; }
#pp-cmap-zoom-hint { position:absolute; bottom:7px; right:9px; font-size:9px; font-weight:600; letter-spacing:.05em; color:rgba(0,0,0,.22); pointer-events:none; z-index:20; }
#pp-cmap-fit { position:absolute; bottom:28px; right:9px; z-index:25; width:24px; height:24px; border:none; border-radius:5px; padding:0; background:rgba(0,0,0,.07); color:rgba(0,0,0,.4); cursor:pointer; display:grid; place-items:center; transition:background .15s, color .15s; }
#pp-cmap-fit:hover { background:rgba(0,0,0,.14); color:rgba(0,0,0,.75); }
.pp-cmap-d0 { opacity:1; }.pp-cmap-d1 { opacity:0.82; }.pp-cmap-d2 { opacity:0.65; }.pp-cmap-d3 { opacity:0.48; }.pp-cmap-d4 { opacity:0.34; }
/* Concept-map cards are always fully open — override find-matches card defaults */
.pp-cmap-card { overflow:visible !important; cursor:grab; }
.pp-cmap-card:active { cursor:grabbing; }
.pp-cmap-card .pp-mm-card-body { padding:6px 9px 8px; }
.pp-cmap-card .pp-mm-field { display:block !important; -webkit-line-clamp:unset !important; -webkit-box-orient:unset !important; overflow:visible !important; font-size:10px; line-height:1.4; color:rgba(0,0,0,.72); }
.pp-cmap-card .pp-mm-lock { display:none; }
.pp-cmap-card .pp-mm-head-label { display:none; }
.pp-cmap-footer { font-size:9px; font-weight:600; letter-spacing:.05em; color:rgba(0,0,0,.38); padding:0 9px 7px; border-top:1px solid rgba(0,0,0,.06); margin-top:4px; padding-top:5px; }
/* Non-leaf cards have no body — header + footer only */
.pp-cmap-card-nonleaf .pp-mm-card-body { display: none; }
`;
  document.head.appendChild(s);
})();

function initConceptMapTool(paneEl, sidebarEl) {
  // UI markup
  paneEl.innerHTML =
    '<div id="pp-cmap-head">' +
      '<div id="pp-cmap-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cmap-status" class="cmap-loading">' +
        '<div class="pp-cmap-dot"></div><span id="pp-cmap-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cmap-controls">' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-cmap-group-label">Max Depth</div>' +
          '<div class="pp-cmap-range-row">' +
            '<span class="pp-cmap-range-label">Lvl</span>' +
            '<input class="pp-cmap-range" id="pp-cmap-depth" type="range" min="1" max="8" value="5" step="1">' +
            '<span class="pp-cmap-range-val" id="pp-cmap-depth-val">5</span>' +
          '</div>' +
        '</div>' +
        '<button id="pp-cmap-rebuild">Rebuild</button>' +
        '<div id="pp-cmap-layout-wrap">' +
          '<button id="pp-cmap-layout-btn" title="Change layout">' +
            '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
              '<rect x="1" y="1" width="4" height="4" rx="1"/>' +
              '<rect x="7" y="1" width="4" height="4" rx="1"/>' +
              '<rect x="1" y="7" width="4" height="4" rx="1"/>' +
              '<rect x="7" y="7" width="4" height="4" rx="1"/>' +
            '</svg><span id="pp-cmap-layout-label">Radial</span>' +
          '</button>' +
          '<div id="pp-cmap-layout-menu">' +
            '<div class="pp-cmap-layout-group">Tree</div>' +
            '<button class="pp-cmap-layout-opt active" data-layout="radial">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="2"/><circle cx="7" cy="7" r="5.5" stroke-dasharray="2 2"/></svg>Radial' +
            '</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="vtree">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="1" width="4" height="3" rx="1"/><rect x="1" y="10" width="4" height="3" rx="1"/><rect x="9" y="10" width="4" height="3" rx="1"/><path d="M7 4v3M7 7l-3 3M7 7l3 3"/></svg>Vertical Tree' +
            '</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="htree">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="5" width="3" height="4" rx="1"/><rect x="10" y="1" width="3" height="4" rx="1"/><rect x="10" y="9" width="3" height="4" rx="1"/><path d="M4 7h3M7 7V3l3 0M7 7v4l3 0"/></svg>Horizontal Tree' +
            '</button>' +
            '<div class="pp-cmap-layout-sep"></div>' +
            '<div class="pp-cmap-layout-group">Flow</div>' +
            '<button class="pp-cmap-layout-opt" data-layout="vflow">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="1" width="10" height="3" rx="1"/><rect x="2" y="6" width="10" height="3" rx="1"/><rect x="2" y="11" width="10" height="2" rx="1"/><path d="M7 4v2M7 9v2" marker-end="url(#a)"/></svg>Vertical Flow' +
            '</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="hflow">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="2" width="3" height="10" rx="1"/><rect x="6" y="2" width="3" height="10" rx="1"/><rect x="11" y="2" width="2" height="10" rx="1"/><path d="M4 7h2M9 7h2"/></svg>Horizontal Flow' +
            '</button>' +
            '<div class="pp-cmap-layout-sep"></div>' +
            '<div class="pp-cmap-layout-group">Other</div>' +
            '<button class="pp-cmap-layout-opt" data-layout="circle">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5.5"/><circle cx="7" cy="1.5" r="1" fill="currentColor" stroke="none"/><circle cx="12.2" cy="4.75" r="1" fill="currentColor" stroke="none"/><circle cx="12.2" cy="9.25" r="1" fill="currentColor" stroke="none"/><circle cx="7" cy="12.5" r="1" fill="currentColor" stroke="none"/><circle cx="1.8" cy="9.25" r="1" fill="currentColor" stroke="none"/><circle cx="1.8" cy="4.75" r="1" fill="currentColor" stroke="none"/></svg>Circle' +
            '</button>' +
            '<button class="pp-cmap-layout-opt" data-layout="organic">' +
              '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="4" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="11" cy="10" r="1.5"/><circle cx="7" cy="9" r="1.5"/><path d="M7 5.5L3 8.5M7 5.5l4 4M7 5.5v2"/></svg>Organic' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cmap-canvas">' +
      '<div id="pp-cmap-world"></div>' +
      '<div id="pp-cmap-empty">Concept map will appear<br>once the spreadsheet loads</div>' +
      '<button id="pp-cmap-fit" title="Fit all cards into view">' +
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3"/>' +
          '<rect x="4" y="4" width="8" height="8" rx="1" opacity=".4"/>' +
        '</svg>' +
      '</button>' +
      '<div id="pp-cmap-zoom-hint">scroll / pinch to zoom</div>' +
    '</div>';

  // Grab elements and set up state (from your existing tool)
  const subtitleEl = paneEl.querySelector('#pp-cmap-subtitle');
  const statusEl = paneEl.querySelector('#pp-cmap-status');
  const labelEl = paneEl.querySelector('#pp-cmap-label');
  const canvas = paneEl.querySelector('#pp-cmap-canvas');
  const world = paneEl.querySelector('#pp-cmap-world');
  const emptyEl = paneEl.querySelector('#pp-cmap-empty');
  const rebuildBtn = paneEl.querySelector('#pp-cmap-rebuild');
  const fitBtn = paneEl.querySelector('#pp-cmap-fit');
  const layoutBtn = paneEl.querySelector('#pp-cmap-layout-btn');
  const layoutMenu = paneEl.querySelector('#pp-cmap-layout-menu');
  const layoutLabel = paneEl.querySelector('#pp-cmap-layout-label');
  const layoutOpts = paneEl.querySelectorAll('.pp-cmap-layout-opt');
  const depthSlider = paneEl.querySelector('#pp-cmap-depth');
  const depthValEl = paneEl.querySelector('#pp-cmap-depth-val');

  const CARD_W = 160;
  const MM_PAD = 12;
  const MM_ITERS = 25;

  let _depth = 5, _layout = 'radial';
  let _rows = null, _rendered = false;
  let _rebuildTimer = null, _topZ = 10;
  let _panX = 0, _panY = 0, _zoom = 1;

  // Position cache and live state [3], [1]
  let _posCache = new Map();           // stableKey -> {x,y}
  let _preservePan = false;
  let _liveRects = new Map();          // cid -> {x,y,w,h}
  let _liveCidToNode = new Map();      // cid -> node

  // Utils [1]
  function nodeStableKey(node) { return node.rows.map(r => (r.tabIdx||0)+':'+(r.rowIdx||0)).sort().join(','); }
  const esc = t => typeof panelEscH === 'function' ? panelEscH(t) : String(t);
  const tv = i => typeof panelThemeVars === 'function' ? panelThemeVars(i) : {};
  function ordinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[1]); }
  function applyTransform() { world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`; }

  // Fit all [1]
  function fitAll() {
    if (!_liveRects.size) return;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    _liveRects.forEach(r => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + (r.w || CARD_W));
      maxY = Math.max(maxY, r.y + (r.h || 80));
    });
    if (!isFinite(minX)) return;
    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 400;
    const pad = 24;
    const scaleX = (W - pad * 2) / Math.max(maxX - minX, 1);
    const scaleY = (H - pad * 2) / Math.max(maxY - minY, 1);
    _zoom = Math.min(scaleX, scaleY, 2);
    _panX = pad - minX * _zoom + (W - pad * 2 - (maxX - minX) * _zoom) / 2;
    _panY = pad - minY * _zoom + (H - pad * 2 - (maxY - minY) * _zoom) / 2;
    applyTransform();
  }
  fitBtn.addEventListener('click', fitAll);

  // Layout dropdown [1]
  const LAYOUT_LABELS = {radial:'Radial',vtree:'Vertical Tree',htree:'Horizontal Tree',vflow:'Vertical Flow',hflow:'Horizontal Flow',circle:'Circle',organic:'Organic'};
  layoutBtn.addEventListener('click', e => {
    e.stopPropagation();
    layoutMenu.classList.toggle('open');
    layoutBtn.classList.toggle('open', layoutMenu.classList.contains('open'));
  });
  document.addEventListener('click', () => {
    layoutMenu.classList.remove('open');
    layoutBtn.classList.remove('open');
  });
  layoutMenu.addEventListener('click', e => e.stopPropagation());
  layoutOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const l = opt.dataset.layout;
      if(!l) return;
      _layout = l;
      layoutLabel.textContent = LAYOUT_LABELS[l] || l;
      layoutOpts.forEach(o => o.classList.toggle('active', o.dataset.layout === l));
      layoutMenu.classList.remove('open');
      layoutBtn.classList.remove('open');
      if (_rendered && _liveRects.size) {
        _posCache.clear();
        _preservePan = true;
        _rendered = false;
        tryRender();
      }
    });
  });

  // Pan/zoom [1]
  let _panning = false, _panSX = 0, _panSY = 0, _panBX = 0, _panBY = 0;
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('.pp-mm-card')) return;
    _panning = true; _panSX = ev.clientX; _panSY = ev.clientY; _panBX = _panX; _panBY = _panY;
    canvas.classList.add('pp-cmap-panning');
  });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return;
    _panX = _panBX + (ev.clientX - _panSX);
    _panY = _panBY + (ev.clientY - _panSY);
    applyTransform();
  });
  document.addEventListener('mouseup', () => {
    if (!_panning) return;
    _panning = false;
    canvas.classList.remove('pp-cmap-panning');
  });

  // Touch pan + pinch [1]
  let _tpanning = false, _tpSX=0, _tpSY=0, _tpBX=0, _tpBY=0;
  let _pinchD = null;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length === 1 && !ev.target.closest('.pp-mm-card')) {
      _tpanning=true; _tpSX=ev.touches[1].clientX; _tpSY=ev.touches[1].clientY; _tpBX=_panX; _tpBY=_panY;
    } else if (ev.touches.length === 2) {
      const dx = ev.touches[1].clientX - ev.touches[2].clientX;
      const dy = ev.touches[1].clientY - ev.touches[2].clientY;
      _pinchD = Math.hypot(dx, dy);
    }
  }, { passive:true });
  canvas.addEventListener('touchmove', ev => {
    if (_tpanning && ev.touches.length === 1) {
      _panX = _tpBX + (ev.touches[1].clientX - _tpSX);
      _panY = _tpBY + (ev.touches[1].clientY - _tpSY);
      applyTransform(); ev.preventDefault();
    } else if (ev.touches.length === 2 && _pinchD) {
      const dx = ev.touches[1].clientX - ev.touches[2].clientX;
      const dy = ev.touches[1].clientY - ev.touches[2].clientY;
      const d = Math.hypot(dx, dy);
      _zoom = Math.max(0.15, Math.min(4, _zoom * d / _pinchD));
      _pinchD = d; applyTransform(); ev.preventDefault();
    }
  }, { passive:false });
  canvas.addEventListener('touchend', () => { _tpanning = false; _pinchD = null; });

  // Wheel zoom [1]
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const dz = ev.deltaY < 0 ? 1.1 : 0.9;
    const nz = Math.max(0.15, Math.min(4, _zoom * dz));
    _panX = mx - (mx - _panX) * nz / _zoom;
    _panY = my - (my - _panY) * nz / _zoom;
    _zoom = nz;
    applyTransform();
  }, { passive: false });

  // Status [1]
  function setStatus(state, text) {
    statusEl.className = 'cmap-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // Sliders + rebuild [1]
  depthSlider.addEventListener('input', () => {
    _depth = +depthSlider.value;
    depthValEl.textContent = _depth;
    scheduleRebuild(true);
  });
  rebuildBtn.addEventListener('click', () => {
    clearTimeout(_rebuildTimer);
    _posCache.clear();
    _preservePan = false;
    _rendered = false;
    tryRender();
  });
  function scheduleRebuild(depthOnly) {
    clearTimeout(_rebuildTimer);
    if (depthOnly && _rendered) {
      _posCache = new Map();
      _liveRects.forEach((rect, cid) => {
        const node = _liveCidToNode.get(cid);
        if (node) _posCache.set(nodeStableKey(node), { x: rect.x, y: rect.y });
      });
      _preservePan = true;
    } else {
      _posCache.clear();
      _preservePan = false;
    }
    rebuildBtn.classList.add('pp-cmap-busy');
    rebuildBtn.textContent = '\u2026';
    _rebuildTimer = setTimeout(() => { _rendered = false; tryRender(); }, 420);
  }

  // Cosine similarity for embeddings (new helper for cell-level graph)
  function cosine(a, b) {
    let s = 0, na = 0, nb = 0;
    const L = Math.min(a.length, b.length);
    for (let i = 0; i < L; i++) { const x = a[i], y = b[i]; s += x * y; na += x * x; nb += y * y; }
    return s / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  // Build a cell-level hierarchy (new):
  // - Levels via BFS from central cells (by kNN sum)
  // - Parent→child edges from level d to d+1 along strongest neighbor links
  // - Merge nodes on the same level with identical children sets
  function buildCellHierarchy(items, maxDepth) {
    const n = items.length;
    const K = Math.max(CMAP_CHILD_K_MIN, Math.min(12, Math.round(Math.sqrt(n))));
    const kNN = Math.min(8, Math.max(3, Math.round(Math.sqrt(n))));

    // Build kNN lists and centrality
    const neigh = Array.from({ length: n }, () => []);
    const centrality = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const tmp = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const s = cosine(items[i].vec, items[j].vec);
        if (!isFinite(s)) continue;
        tmp.push({ j, s });
      }
      tmp.sort((a, b) => b.s - a.s);
      const top = tmp.slice(0, kNN);
      neigh[i] = top;
      centrality[i] = top.reduce((acc, e) => acc + e.s, 0);
    }

    // Choose roots by centrality
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => centrality[b] - centrality[a]);
    const roots = order.slice(0, Math.min(K, n));

    // Wrap cells as nodes for renderer
    const nodeByIdx = new Map();
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const nd = {
        _cid: null,
        rows: [{ tabIdx: it.tabIdx, rowIdx: it.rowIdx, row: { cells: [it.text], cats: [] } }],
        children: [],
        _level: null,
        _cidRaw: i
      };
      nodeByIdx.set(i, nd);
      nodes.push(nd);
    }

    // BFS: assign levels and wire edges
    const q = [];
    roots.forEach(i => { nodeByIdx.get(i)._level = 0; q.push(i); });
    while (q.length) {
      const u = q.shift();
      const lu = nodeByIdx.get(u)._level;
      if (lu >= maxDepth - 1) continue;
      for (const { j } of neigh[u]) {
        const v = j;
        const ndV = nodeByIdx.get(v);
        if (ndV._level != null) continue;
        ndV._level = lu + 1;
        nodeByIdx.get(u).children.push(ndV);
        q.push(v);
      }
    }
    // Any leftovers become extra roots
    nodes.forEach(nd => { if (nd._level == null) nd._level = 0; });

    // Merge equivalent nodes: same level + identical children set
    const sigMap = new Map();
    nodes.forEach(nd => {
      const sig = nd._level + '|' + nd.children.map(c => c._cidRaw).sort((a, b) => a - b).join(',');
      if (!sigMap.has(sig)) sigMap.set(sig, []);
      sigMap.get(sig).push(nd);
    });

    const alive = new Set(nodes);
    sigMap.forEach(group => {
      if (group.length <= 1) return;
      const head = group[1];
      for (let i = 1; i < group.length; i++) {
        const nd = group[i];
        head.rows = head.rows.concat(nd.rows);
        alive.delete(nd);
      }
    });

    // Rewire children to merged heads and dedupe
    const headOf = new Map();
    sigMap.forEach(group => {
      if (group.length <= 1) return;
      const head = group[1];
      group.forEach(nd => headOf.set(nd._cidRaw, head));
    });
    alive.forEach(nd => {
      nd.children = nd.children
        .map(c => headOf.get(c._cidRaw) || c)
        .filter((v, i, arr) => arr.indexOf(v) === i);
    });

    // Synthetic root for renderer: all level-0 nodes under one root
    const root = { _cid: null, rows: [], children: Array.from(alive).filter(nd => nd._level === 0) };
    return { root };
  }

  // Data / render pipeline — changed to embed INDIVIDUAL CELLS (not whole rows) [8]
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;

    if (_rows) { doRender(); return; }

    const rows = buildRowIndex();
    if (!rows.length) return;

    // Flatten to non-empty cells; categories/columns don't affect hierarchy
    const cells = [];
    rows.forEach(r => {
      const arr = (r.row?.cells || r.cells || []);
      arr.forEach((txt, colIdx) => {
        const text = (txt || '').trim();
        if (!text) return;
        cells.push({ tabIdx: r.tabIdx, rowIdx: r.rowIdx, colIdx, text });
      });
    });

    if (!cells.length) { setStatus('error', 'No usable cells'); return; }

    setStatus('loading', 'Building concept map for ' + cells.length + ' cells…');
    emptyEl.style.display = 'none';

    Promise.all(cells.map(c => {
      return window.EmbeddingUtils.getCachedEmbedding(c.text)
        .then(vec => ({ ok: true, vec }))
        .catch(() => ({ ok: false }));
    })).then(results => {
      const embedded = [];
      results.forEach((res, i) => {
        if (res.ok && res.vec) embedded.push(Object.assign({}, cells[i], { vec: res.vec }));
      });
      if (embedded.length < 3) { setStatus('error', 'Not enough data'); return; }
      _rows = embedded; // reuse _rows to carry per-cell entries
      requestAnimationFrame(doRender);
    });
  }

  function doRender() {
    rebuildBtn.classList.remove('pp-cmap-busy');
    rebuildBtn.textContent = 'Rebuild';
    setStatus('loading', 'Linking cells…');

    setTimeout(() => {
      try {
        const graph = buildCellHierarchy(_rows, _depth);
        renderConceptMap(graph.root);
        subtitleEl.textContent = _rows.length + ' cells · max depth ' + _depth;
        setStatus('ready', 'Done');
        _rendered = true;
      } catch (err) {
        console.error('[concept-map]', err);
        setStatus('error', 'Hierarchy build failed');
      }
    }, 20);
  }

  // Renderer: same visuals as before, but traverse node.children directly [6], [5], [4]
  function renderConceptMap(root) {
    world.innerHTML = '';
    emptyEl.style.display = 'none';
    _topZ = 10;
    if (!_preservePan) { _panX = 0; _panY = 0; _zoom = 1; }
    applyTransform();
    _preservePan = false;

    if (!root) { emptyEl.style.display = 'flex'; return; }

    const ns = 'http://www.w3.org/2000/svg';
    const svgLines = document.createElementNS(ns,'svg');
    svgLines.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1';
    world.appendChild(svgLines);
    const svgDots = document.createElementNS(ns,'svg');
    svgDots.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2';
    world.appendChild(svgDots);

    const cardEls = new Map();
    const rects = new Map();
    const colors = new Map();
    const arrows = [];
    let _nid = 0;

    _liveRects = rects;
    _liveCidToNode = new Map();

    function setId(node) {
      if (node._cid == null) node._cid = _nid++;
      _liveCidToNode.set(node._cid, node);
      if (node.children) node.children.forEach(setId);
    }
    setId(root);

    const toRender = [];
    const roots = root.children ? root.children.slice() : [];

    // Collect: push nodes up to _depth levels by following explicit children
    function collect(node, d, pid) {
      toRender.push({ node, d, pid });
      if (d < _depth - 1 && node.children && node.children.length) {
        node.children.forEach(c => collect(c, d + 1, node._cid));
      }
    }
    roots.forEach(r => collect(r, 0, null));

    // Arrows parent -> child
    toRender.forEach(({ node, d, pid }) => {
      if (pid == null) return;
      const t = tv(node.rows[1]?.tabIdx||0);
      arrows.push({ fromId: pid, toId: node._cid, color: t['--tab-active-bg'] || '#aaa', depth: d });
    });

    // Arrow pathing [5]
    function getR(id) {
      const r=rects.get(id);
      if(!r) return null;
      const el=cardEls.get(id);
      return {x:r.x, y:r.y, w:r.w, h: el ? (el.offsetHeight||r.h||80) : (r.h||80)};
    }
    function cpts(id) {
      const r=getR(id); if(!r) return [];
      const {x,y,w:W,h:H}=r;
      return [
        {x:x+W*.25,y}, {x:x+W*.5,y}, {x:x+W*.75,y},
        {x:x+W*.25,y:y+H}, {x:x+W*.5,y:y+H}, {x:x+W*.75,y:y+H},
        {x,y:y+H*.33}, {x,y:y+H*.67}, {x:x+W,y:y+H*.33}, {x:x+W,y:y+H*.67}
      ];
    }
    function closest(pA, pB) {
      let best=null, bd=Infinity;
      pA.forEach(a=>pB.forEach(b=>{
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<bd){bd=d;best={a,b};}
      }));
      return best;
    }
    function tanDir(pt, id) {
      const r=getR(id); if(!r) return{dx:0,dy:1};
      const t=3;
      if(Math.abs(pt.y-r.y)<t) return{dx:0,dy:-1};
      if(Math.abs(pt.y-(r.y+r.h))<t) return{dx:0,dy:1};
      if(Math.abs(pt.x-r.x)<t) return{dx:-1,dy:0};
      if(Math.abs(pt.x-(r.x+r.w))<t) return{dx:1,dy:0};
      return{dx:0,dy:1};
    }
    function redrawArrows() {
      svgLines.innerHTML=''; svgDots.innerHTML='';
      arrows.forEach(({fromId, toId, color, depth: d}) => {
        const pA=cpts(fromId), pB=cpts(toId);
        if(!pA.length||!pB.length) return;
        const pair=closest(pA,pB); if(!pair) return;
        const {a,b}=pair;
        const dist=Math.hypot(b.x-a.x,b.y-a.y), off=Math.min(dist*.45,90);
        const tA=tanDir(a,fromId), tB=tanDir(b,toId);
        const path=document.createElementNS(ns,'path');
        path.setAttribute('d',`M${a.x},${a.y} C${a.x+tA.dx*off},${a.y+tA.dy*off} ${b.x+tB.dx*off},${b.y+tB.dy*off} ${b.x},${b.y}`);
        path.setAttribute('fill','none');
        path.setAttribute('stroke',color);
        path.setAttribute('stroke-width', d===0?'2':d===1?'1.5':'1');
        path.setAttribute('stroke-opacity', d===0?'0.55':d===1?'0.4':'0.28');
        path.setAttribute('stroke-dasharray', d===0?'none':'4 3');
        svgLines.appendChild(path);
        const dot=document.createElementNS(ns,'circle');
        dot.setAttribute('cx',String(b.x));
        dot.setAttribute('cy',String(b.y));
        dot.setAttribute('r','3');
        dot.setAttribute('fill',color);
        dot.setAttribute('opacity', d===0?'0.7':'0.45');
        svgDots.appendChild(dot);
      });
    }

    // pushApart + drag [5]
    function pushApart(movedId) {
      const ra=rects.get(movedId); if(!ra) return;
      rects.forEach((rb,kb)=>{ if(kb===movedId) return;
        if(ra.x<rb.x+rb.w+MM_PAD&&ra.x+ra.w+MM_PAD>rb.x&&ra.y<rb.y+rb.h+MM_PAD&&ra.y+ra.h+MM_PAD>rb.y){
          const dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x;
          const dD=rb.y+rb.h+MM_PAD-ra.y, dU=ra.y+ra.h+MM_PAD-rb.y;
          if(Math.min(dR,dL)<=Math.min(dD,dU)) rb.x+=dR<dL?-dR:dL; else rb.y+=dD<dU?-dD:dU;
          const el=cardEls.get(kb); if(el){ el.style.left=rb.x+'px'; el.style.top=rb.y+'px'; }
        }
      });
    }
    function drag(el, id) {
      let on=false,ox=0,oy=0,sl=0,st=0;
      const start=(cx,cy)=>{ on=true; el._dragging=true; const r=rects.get(id)||{x:0,y:0}; sl=r.x; st=r.y; ox=cx; oy=cy; el.style.zIndex=String(++_topZ); el.style.transition='none'; };
      const move=(cx,cy)=>{ if(!on) return; const r=rects.get(id)||{w:CARD_W,h:80}; const nx=sl+(cx-ox)/_zoom; const ny=st+(cy-oy)/_zoom; el.style.left=nx+'px'; el.style.top=ny+'px'; rects.set(id,{x:nx,y:ny,w:r.w,h:r.h}); pushApart(id); redrawArrows(); };
      const end=()=>{ if(!on) return; on=false; el._dragging=false; redrawArrows(); };
      el.addEventListener('mousedown',e=>{ if(e.button!==0||e.target.closest('.pp-mm-lock,.pp-goto-btn'))return; start(e.clientX,e.clientY); e.preventDefault(); e.stopPropagation(); });
      document.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
      document.addEventListener('mouseup',end);
      el.addEventListener('touchstart',e=>{ if(e.touches.length!==1||e.target.closest('.pp-mm-lock,.pp-goto-btn'))return; const tx=e.touches[1].clientX, ty=e.touches[1].clientY; start(tx,ty); e.preventDefault(); },{passive:false});
      el.addEventListener('touchmove',e=>{ if(e.touches.length!==1)return; move(e.touches[1].clientX,e.touches[1].clientY); e.preventDefault(); },{passive:false});
      el.addEventListener('touchend',end);
    }

    // Colors + card maker [5], [2]
    function depthColor(depth) {
      if (typeof TAB_THEMES !== 'undefined' && typeof THEMES !== 'undefined') {
        const tname = TAB_THEMES[depth % TAB_THEMES.length] || 'default';
        const theme = THEMES[tname] || THEMES.default || {};
        return { accent: theme['--tab-active-bg'] || '#5b7fa6', lc: theme['--tab-active-color'] || '#fff', bg: theme['--bg-data'] || '#f8f8f8' };
      }
      const P = ['#5b7fa6','#7a6e9e','#5a9e7a','#9e7a5a','#9e5a7a','#7a9e5a'];
      return { accent: P[depth % P.length], lc: '#fff', bg: '#f8f8f8' };
    }
    function makeCard(node, depth) {
      const isLeaf = !node.children || node.children.length === 0 || depth >= _depth - 1;
      const id = node._cid;
      const { accent, lc, bg } = depthColor(depth);

      colors.set(id, { border: accent, bg });

      const card = document.createElement('div');
      card.className = 'pp-mm-card pp-cmap-card pp-cmap-d' + Math.min(depth, 4);
      card.style.cssText = `width:${CARD_W}px;position:absolute;z-index:${++_topZ}`;
      card.style.setProperty('--ppc-border', accent);
      card.style.setProperty('--ppc-bg', bg);

      if (!isLeaf) card.classList.add('pp-cmap-card-nonleaf');

      // Header
      const head = document.createElement('div');
      head.className = 'pp-mm-card-head';
      head.style.cssText = `background:${accent};color:${lc};padding:5px 9px`;
      head.innerHTML = '<span class="pp-mm-badge">' + esc(ordinal(depth + 1) + ' level concept') + '</span>';
      card.appendChild(head);

      // Body: only for leaves
      if (isLeaf) {
        const body = document.createElement('div');
        body.className = 'pp-mm-card-body';
        node.rows.slice(0, 5).forEach(r => {
          if (!r) return;
          const cells = r.row?.cells || r.cells || [];
          const cats = r.row?.cats ? r.row.cats.filter(c => c.trim()) : [];
          const best = cells.reduce((b, c) => c.length > b.length ? c : b, '');
          const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
          if (cats.length) {
            const ce = document.createElement('div');
            ce.className = 'pp-mm-cat';
            ce.textContent = cats.join(' · ');
            body.appendChild(ce);
          }
          const fe = document.createElement('div');
          fe.className = 'pp-mm-field';
          fe.textContent = parsed.body;
          body.appendChild(fe);
        });
        card.appendChild(body);
      }

      // Footer: entry count + sub-concept count (use actual children)
      const footer = document.createElement('div');
      footer.className = 'pp-cmap-footer';
      const entryStr = node.rows.length + ' entr' + (node.rows.length === 1 ? 'y' : 'ies');
      if (!isLeaf) {
        const subCount = (node.children || []).length;
        footer.textContent = entryStr + ' · ' + subCount + ' sub-concept' + (subCount === 1 ? '' : 's');
      } else {
        footer.textContent = entryStr;
      }
      card.appendChild(footer);

      // Go-to button for single-entry leaf cards
      if (isLeaf && node.rows.length === 1 && node.rows[1]) {
        const r = node.rows[1];
        const gb = document.createElement('button');
        gb.className = 'pp-goto-btn';
        gb.style.cssText = `border-color:${accent};color:${accent};opacity:0.6;pointer-events:auto`;
        gb.addEventListener('click', e => {
          e.stopPropagation();
          if (typeof panelGoTo === 'function') panelGoTo(r, 0);
        });
        gb.addEventListener('mousedown', e => e.stopPropagation());
        card.appendChild(gb);
      }

      world.appendChild(card);
      card._cid = id;
      drag(card, id);
      cardEls.set(id, card);
      if (window.ResizeObserver) new ResizeObserver(() => redrawArrows()).observe(card);
      return card;
    }

    // Create all cards
    toRender.forEach(({node,d}) => makeCard(node,d));

    // Layout engines (unchanged) [4], [8]
    requestAnimationFrame(()=>{
      const W = world.clientWidth || 400;
      const H = world.clientHeight || 500;

      const parentOf = new Map();
      const childrenOf = new Map();
      toRender.forEach(({node,pid}) => {
        parentOf.set(node._cid, pid);
        if(pid!=null){
          if(!childrenOf.has(pid)) childrenOf.set(pid,[]);
          childrenOf.get(pid).push(node._cid);
        }
        if(!childrenOf.has(node._cid)) childrenOf.set(node._cid,[]);
      });
      const roots = toRender.filter(({pid})=>pid==null).map(({node})=>node._cid);
      const GAP_X = MM_PAD + 8;
      const GAP_Y = MM_PAD + 14;

      const cH = id => { const el=cardEls.get(id); return el?(el.offsetHeight||80):80; };

      function applyPositions(posMap) {
        const SLIDE_MS = 420;
        const easing = 'cubic-bezier(0.25,1,0.5,1)';
        cardEls.forEach(el => {
          el.style.transition = `left ${SLIDE_MS}ms ${easing}, top ${SLIDE_MS}ms ${easing}`;
        });
        posMap.forEach((pos, id) => {
          const el = cardEls.get(id); if(!el) return;
          const h = cH(id);
          el.style.left = pos.x + 'px';
          el.style.top = pos.y + 'px';
          rects.set(id, {x:pos.x, y:pos.y, w:CARD_W, h});
        });
        setTimeout(() => {
          cardEls.forEach(el => { el.style.transition = ''; });
          for(let pass=0; pass<MM_ITERS; pass++){
            let moved=false;
            rects.forEach((ra,ka)=>{ rects.forEach((rb,kb)=>{ if(ka===kb) return;
              if(ra.x<rb.x+rb.w+MM_PAD&&ra.x+ra.w+MM_PAD>rb.x&&ra.y<rb.y+rb.h+MM_PAD&&ra.y+ra.h+MM_PAD>rb.y){
                const dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x;
                const dD=rb.y+rb.h+MM_PAD-ra.y, dU=ra.y+ra.h+MM_PAD-rb.y;
                if(Math.min(dR,dL)<=Math.min(dD,dU)) ra.x+=dR<dL?dR:-dL; else ra.y+=dD<dU?dD:-dU;
                const el=cardEls.get(ka); if(el){ el.style.left=ra.x+'px'; el.style.top=ra.y+'px'; }
                moved=true;
              }
            });});
            if(!moved) break;
          }
          redrawArrows();
        }, SLIDE_MS + 20);

        const start = performance.now();
        (function raf(now) {
          redrawArrows();
          if(now - start < SLIDE_MS + 20) requestAnimationFrame(raf);
        })(performance.now());
      }

      function restoreOrPlace(id, fallbackFn) {
        const node = _liveCidToNode.get(id);
        const sk = node ? nodeStableKey(node) : null;
        if(sk && _posCache.has(sk)) return _posCache.get(sk);
        return fallbackFn();
      }

      function layoutRadial() {
        const byD = new Map();
        toRender.forEach(({node,d})=>{if(!byD.has(d))byD.set(d,[]);byD.get(d).push(node._cid);});
        const maxD = Math.max(...byD.keys(), 0);
        const cx=W/2, cy=H/2;
        const pos = new Map();
        byD.forEach((ids,d)=>{
          ids.forEach((id,idx)=>{
            pos.set(id, restoreOrPlace(id, ()=>{
              const h=cH(id);
              if(d===0&&ids.length===1) return{x:cx-CARD_W/2,y:cy-h/2};
              const R=(maxD===0?.28:.13+.19*d)*Math.min(W,H);
              const a=(2*Math.PI*idx/ids.length)-Math.PI/2;
              return{x:cx+R*Math.cos(a)-CARD_W/2, y:cy+R*Math.sin(a)-h/2};
            }));
          });
        });
        applyPositions(pos);
      }

      function layoutTree(vertical) {
        function subtreeSize(id) {
          const kids = childrenOf.get(id)||[];
          if(!kids.length) return CARD_W;
          const childWidths = kids.map(subtreeSize);
          return childWidths.reduce((s,w)=>s+w,0) + GAP_X*(kids.length-1);
        }
        const pos = new Map();
        function place(id, left, depth) {
          const kids = childrenOf.get(id)||[];
          const h=cH(id);
          const myW = subtreeSize(id);
          const cx = left + myW/2;
          const rowY = depth*(80+GAP_Y*2);
          if(vertical){ pos.set(id,{x:cx-CARD_W/2, y:rowY}); }
          else { pos.set(id,{x:rowY, y:cx-h/2}); }
          let childLeft = left;
          kids.forEach(kid=>{
            const kw=subtreeSize(kid);
            place(kid, childLeft, depth+1);
            childLeft+=kw+GAP_X;
          });
        }
        let totalW = roots.map(subtreeSize).reduce((s,w)=>s+w,0)+GAP_X*(roots.length-1);
        let curX = -totalW/2 + W/2;
        roots.forEach(rid=>{
          const w=subtreeSize(rid);
          place(rid,curX,0);
          curX+=w+GAP_X;
        });
        applyPositions(pos);
      }

      function layoutFlow(vertical) {
        const byD = new Map();
        toRender.forEach(({node,d})=>{if(!byD.has(d))byD.set(d,[]);byD.get(d).push(node._cid);});
        const pos = new Map();
        byD.forEach((ids,d)=>{
          const layerH = Math.max(...ids.map(cH), 80);
          const totalW = ids.length*(CARD_W+GAP_X)-GAP_X;
          const startX = W/2 - totalW/2;
          const rowY = d*(layerH+GAP_Y*2);
          ids.forEach((id,i)=>{
            const h=cH(id);
            if(vertical) pos.set(id,{x:startX+i*(CARD_W+GAP_X), y:rowY+(layerH-h)/2});
            else pos.set(id,{x:rowY, y:startX+i*(CARD_W+GAP_X)});
          });
        });
        applyPositions(pos);
      }

      function layoutCircle() {
        const allIds = toRender.map(({node})=>node._cid);
        const n = allIds.length;
        const R = Math.max(160, (CARD_W+GAP_X)*n/(2*Math.PI));
        const cx=W/2, cy=H/2;
        const pos = new Map();
        allIds.forEach((id,i)=>{
          const h=cH(id);
          const a=(2*Math.PI*i/n)-Math.PI/2;
          pos.set(id,{x:cx+R*Math.cos(a)-CARD_W/2, y:cy+R*Math.sin(a)-h/2});
        });
        applyPositions(pos);
      }

      function layoutOrganic() {
        const allIds = toRender.map(({node})=>node._cid);
        const edges = arrows.map(a=>({u:a.fromId,v:a.toId}));
        const px={}, py={};
        allIds.forEach((id,i)=>{
          const ex=rects.get(id);
          if(ex){ px[id]=ex.x+CARD_W/2; py[id]=ex.y+cH(id)/2; return; }
          const a=(2*Math.PI*i/allIds.length)-Math.PI/2;
          const R=Math.min(W,H)*.35;
          px[id]=W/2+R*Math.cos(a);
          py[id]=H/2+R*Math.sin(a);
        });
        const AREA=W*H, k=Math.sqrt(AREA/Math.max(allIds.length,1))*0.9;
        let temp=Math.min(W,H)*0.25;
        const ITERS=80;
        for(let it=0; it<ITERS; it++){
          const dx={}, dy={}; allIds.forEach(id=>{dx[id]=0;dy[id]=0;});
          for(let i=0;i<allIds.length;i++) for(let j=i+1;j<allIds.length;j++){
            const u=allIds[i],v=allIds[j];
            let ddx=px[u]-px[v], ddy=py[u]-py[v];
            const d=Math.sqrt(ddx*ddx+ddy*ddy)||0.01;
            const f=k*k/d;
            ddx/=d; ddy/=d;
            dx[u]+=ddx*f; dy[u]+=ddy*f;
            dx[v]-=ddx*f; dy[v]-=ddy*f;
          }
          edges.forEach(({u,v})=>{
            if(!px.hasOwnProperty(u)||!px.hasOwnProperty(v)) return;
            let ddx=px[v]-px[u], ddy=py[v]-py[u];
            const d=Math.sqrt(ddx*ddx+ddy*ddy)||0.01;
            const f=d*d/k;
            ddx/=d; ddy/=d;
            dx[u]+=ddx*f; dy[u]+=ddy*f;
            dx[v]-=ddx*f; dy[v]-=ddy*f;
          });
          allIds.forEach(id=>{
            const d=Math.sqrt(dx[id]*dx[id]+dy[id]*dy[id])||0.01;
            const disp=Math.min(d,temp);
            px[id]+=dx[id]/d*disp;
            py[id]+=dy[id]/d*disp;
          });
          temp*=0.93;
        }
        const pos=new Map();
        allIds.forEach(id=>{const h=cH(id);pos.set(id,{x:px[id]-CARD_W/2,y:py[id]-h/2});});
        applyPositions(pos);
      }

      // Dispatch [4], [8]
      switch(_layout){
        case 'vtree': layoutTree(true); break;
        case 'htree': layoutTree(false); break;
        case 'vflow': layoutFlow(true); break;
        case 'hflow': layoutFlow(false); break;
        case 'circle': layoutCircle(); break;
        case 'organic': layoutOrganic(); break;
        default: layoutRadial(); break;
      }
      redrawArrows();
    });
  }

  // Kickoff and progress (same as before) [8]
  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 120));
  window.addEventListener('embedding-progress', ev => { if(!_rendered) setStatus('loading','Indexing… '+ev.detail.pct+'%'); });

  // Public API
  return {
    reset() {
      _rendered=false; _rows=null;
      _posCache.clear(); _preservePan=false;
      _liveRects=new Map(); _liveCidToNode=new Map();
      world.innerHTML=''; emptyEl.style.display='flex';
      _panX=0; _panY=0; _zoom=1; applyTransform();
    }
  };
}
