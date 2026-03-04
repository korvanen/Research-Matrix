// sidepanel-concept-map.js — Concept Map v12
// Rewritten: individual spreadsheet cells → cards; hierarchy levels assigned
// purely by embedding-based generality score (not by spreadsheet structure).
// Categories / columns are ignored for hierarchy — only semantic content matters.
// Cards are connected by semantic parent-child relationships.
// Merge rule: two cells at the SAME level with the EXACT SAME set of children
// are collapsed into one combined card.
console.log('[sidepanel-concept-map.js v12]');

// ════════════════════════════════════════════════════════════════════════════
// ── Tuning constants ─────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

// Minimum cosine similarity (0–1) required to link a cell to a parent.
// Raise for a sparser, cleaner tree; lower to connect more cells.
// This value is also exposed as a slider in the UI.
const CMAP_PARENT_CHILD_THRESHOLD = 0.50;

// ════════════════════════════════════════════════════════════════════════════
// ── Styles ───────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

(function injectCmapStyles() {
  if (document.getElementById('pp-cmap-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cmap-styles';
  s.textContent = `
#pp-cmap-head {
  flex-shrink:0; padding:10px 12px 8px;
  border-bottom:1px solid var(--sidebar-box-border,rgba(0,0,0,.1));
  display:flex; flex-direction:column; gap:5px;
}
#pp-cmap-subtitle {
  font-size:11px; font-weight:500; color:rgba(0,0,0,.45);
  letter-spacing:.04em; line-height:1.3; min-height:14px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#pp-cmap-status {
  display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:6px;
  font-size:9px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
  transition:opacity .6s ease, background .4s ease;
}
#pp-cmap-status.cmap-loading { background:rgba(0,0,0,.06);      color:rgba(0,0,0,.4); }
#pp-cmap-status.cmap-ready   { background:rgba(60,180,100,.12); color:rgba(30,130,60,.9); }
#pp-cmap-status.cmap-error   { background:rgba(200,60,60,.10);  color:rgba(180,40,40,.85); }
.pp-cmap-dot {
  width:6px; height:6px; border-radius:50%; flex-shrink:0; transition:background .4s;
}
#pp-cmap-status.cmap-loading .pp-cmap-dot {
  background:rgba(0,0,0,.25); animation:pp-cmap-pulse 1.2s ease-in-out infinite;
}
#pp-cmap-status.cmap-ready .pp-cmap-dot   { background:rgba(40,160,80,.9); }
#pp-cmap-status.cmap-error .pp-cmap-dot   { background:rgba(180,40,40,.85); }
@keyframes pp-cmap-pulse {
  0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);}
}

/* ── Controls row ── */
#pp-cmap-controls {
  display:grid; grid-template-columns:1fr 1fr auto auto; gap:6px; align-items:end;
}
.pp-cmap-ctrl-col { display:flex; flex-direction:column; gap:2px; }
.pp-cmap-group-label {
  font-size:7px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
  color:rgba(0,0,0,.28); line-height:1; margin-bottom:1px;
}
.pp-cmap-range-row { display:flex; align-items:center; gap:3px; }
.pp-cmap-range-label {
  font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(0,0,0,.35); flex-shrink:0; width:18px;
}
.pp-cmap-range-val {
  font-size:9px; font-weight:700; color:rgba(0,0,0,.55);
  flex-shrink:0; width:22px; text-align:right;
}
.pp-cmap-range {
  -webkit-appearance:none; appearance:none; flex:1; height:3px; border-radius:2px;
  background:rgba(0,0,0,.12); outline:none; cursor:pointer; min-width:0;
}
.pp-cmap-range::-webkit-slider-thumb {
  -webkit-appearance:none; appearance:none; width:11px; height:11px; border-radius:50%;
  background:var(--color-topbar-sheet,#111); box-shadow:0 1px 3px rgba(0,0,0,.22);
  cursor:pointer; transition:transform .12s;
}
.pp-cmap-range::-webkit-slider-thumb:hover { transform:scale(1.2); }
.pp-cmap-range::-moz-range-thumb {
  width:11px; height:11px; border-radius:50%; border:none;
  background:var(--color-topbar-sheet,#111); box-shadow:0 1px 3px rgba(0,0,0,.22);
}
#pp-cmap-rebuild {
  border:none; border-radius:5px; padding:4px 8px; align-self:stretch;
  font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  background:rgba(0,0,0,.07); color:rgba(0,0,0,.45); cursor:pointer;
  transition:background .15s,color .15s; white-space:nowrap;
}
#pp-cmap-rebuild:hover { background:rgba(0,0,0,.13); color:rgba(0,0,0,.75); }
#pp-cmap-rebuild.pp-cmap-busy { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }

/* Layout dropdown */
#pp-cmap-layout-wrap { position:relative; align-self:stretch; }
#pp-cmap-layout-btn {
  height:100%; border:none; border-radius:5px; padding:4px 7px;
  font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  background:rgba(0,0,0,.07); color:rgba(0,0,0,.45); cursor:pointer;
  transition:background .15s,color .15s; white-space:nowrap;
  display:flex; align-items:center; gap:3px;
}
#pp-cmap-layout-btn:hover,
#pp-cmap-layout-btn.open { background:rgba(0,0,0,.13); color:rgba(0,0,0,.75); }
#pp-cmap-layout-menu {
  position:absolute; top:calc(100% + 5px); right:0; z-index:300;
  background:#fff; border:1px solid rgba(0,0,0,.13); border-radius:9px;
  box-shadow:0 6px 22px rgba(0,0,0,.18); padding:5px; min-width:148px;
  display:none; flex-direction:column; gap:1px;
  animation:pp-cmap-menu-in .15s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes pp-cmap-menu-in {
  from { opacity:0; transform:scale(.92) translateY(-6px); }
  to   { opacity:1; transform:scale(1)   translateY(0); }
}
#pp-cmap-layout-menu.open { display:flex; }
.pp-cmap-layout-opt {
  display:flex; align-items:center; gap:6px;
  width:100%; border:none; background:transparent;
  text-align:left; padding:5px 9px; border-radius:6px; cursor:pointer;
  font-size:9px; font-weight:600; letter-spacing:.03em; color:rgba(0,0,0,.6);
  transition:background .12s;
}
.pp-cmap-layout-opt:hover { background:rgba(0,0,0,.06); color:rgba(0,0,0,.85); }
.pp-cmap-layout-opt.active { color:var(--color-topbar-sheet,#111); background:rgba(0,0,0,.07); }
.pp-cmap-layout-sep { height:1px; background:rgba(0,0,0,.07); margin:3px 4px; }
.pp-cmap-layout-group {
  font-size:7px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  color:rgba(0,0,0,.28); padding:4px 9px 2px;
}

/* ── Canvas ── */
#pp-cmap-canvas {
  flex:1; min-height:0; position:relative; overflow:hidden;
  cursor:default; user-select:none;
}
#pp-cmap-canvas.pp-cmap-panning { cursor:grabbing !important; }
#pp-cmap-world {
  position:absolute; top:0; left:0; width:100%; height:100%;
  transform-origin:0 0;
}
#pp-cmap-empty {
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:8px;
  font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(0,0,0,.25); text-align:center; padding:24px; pointer-events:none;
}
#pp-cmap-zoom-hint {
  position:absolute; bottom:7px; right:9px; font-size:9px; font-weight:600;
  letter-spacing:.05em; color:rgba(0,0,0,.22); pointer-events:none; z-index:20;
}
#pp-cmap-fit {
  position:absolute; bottom:28px; right:9px; z-index:25;
  width:24px; height:24px; border:none; border-radius:5px; padding:0;
  background:rgba(0,0,0,.07); color:rgba(0,0,0,.4); cursor:pointer;
  display:grid; place-items:center; transition:background .15s, color .15s;
}
#pp-cmap-fit:hover { background:rgba(0,0,0,.14); color:rgba(0,0,0,.75); }

/* ── Concept-map cards ── */
.pp-cmap-card {
  position:absolute; border-radius:9px;
  border:1.5px solid var(--ppc-border,#aaa);
  background:var(--ppc-bg,#fff);
  box-shadow:0 2px 10px rgba(0,0,0,.10);
  cursor:grab; user-select:none; overflow:hidden;
  transition:box-shadow .15s;
}
.pp-cmap-card:active { cursor:grabbing; }
.pp-cmap-card:hover  { box-shadow:0 4px 18px rgba(0,0,0,.16); }
.pp-cmap-card-head {
  padding:5px 9px 4px;
  display:flex; align-items:center; gap:5px;
}
.pp-cmap-level-badge {
  font-size:8px; font-weight:800; letter-spacing:.10em; text-transform:uppercase;
  opacity:.9; flex-shrink:0;
}
.pp-cmap-card-body {
  padding:6px 9px 4px; display:flex; flex-direction:column; gap:4px;
}
.pp-cmap-cell-cat {
  font-size:8px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(0,0,0,.35); margin-bottom:1px;
}
.pp-cmap-cell-text {
  font-size:10px; line-height:1.38; color:rgba(0,0,0,.76);
  word-break:break-word; overflow-wrap:break-word;
}
.pp-cmap-merge-sep {
  border-top:1px solid rgba(0,0,0,.07); margin:3px 0;
}
/* Footer: similarity % */
.pp-cmap-card-footer {
  padding:4px 9px 7px;
  border-top:1px solid rgba(0,0,0,.06); margin-top:2px;
  display:flex; align-items:center; gap:5px;
}
.pp-cmap-sim-bar {
  flex:1; height:3px; border-radius:2px; background:rgba(0,0,0,.08); overflow:hidden;
}
.pp-cmap-sim-fill { height:100%; border-radius:2px; transition:width .3s ease; }
.pp-cmap-sim-label {
  font-size:9px; font-weight:700; letter-spacing:.04em; flex-shrink:0;
  color:rgba(0,0,0,.45);
}
/* Leaf */
.pp-cmap-leaf-badge {
  font-size:8px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:rgba(0,0,0,.28); padding:4px 9px 7px; display:block;
}
/* Merged-cell count badge */
.pp-cmap-merged-count {
  font-size:8px; font-weight:700; letter-spacing:.07em;
  padding:1px 6px; border-radius:10px; margin-left:auto; opacity:.7;
}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initConceptMapTool(paneEl, sidebarEl) {

  // ── HTML ─────────────────────────────────────────────────────────────────
  paneEl.innerHTML =
    '<div id="pp-cmap-head">' +
      '<div id="pp-cmap-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cmap-status" class="cmap-loading">' +
        '<div class="pp-cmap-dot"></div><span id="pp-cmap-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cmap-controls">' +
        // Col 1: depth
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-cmap-group-label">Max Depth</div>' +
          '<div class="pp-cmap-range-row">' +
            '<span class="pp-cmap-range-label">Lvl</span>' +
            '<input class="pp-cmap-range" id="pp-cmap-depth" type="range" min="1" max="8" value="5" step="1">' +
            '<span class="pp-cmap-range-val" id="pp-cmap-depth-val">5</span>' +
          '</div>' +
        '</div>' +
        // Col 2: link threshold
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-cmap-group-label">Link Threshold</div>' +
          '<div class="pp-cmap-range-row">' +
            '<span class="pp-cmap-range-label">Min</span>' +
            '<input class="pp-cmap-range" id="pp-cmap-thresh" type="range" min="20" max="90" value="50" step="5">' +
            '<span class="pp-cmap-range-val" id="pp-cmap-thresh-val">50%</span>' +
          '</div>' +
        '</div>' +
        // Col 3: layout button
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
        // Col 4: rebuild
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
      '<div id="pp-cmap-zoom-hint">scroll / pinch to zoom</div>' +
    '</div>';

  // ── Refs ─────────────────────────────────────────────────────────────────
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

  const CARD_W      = 170;
  const MM_PAD      = 16;

  let _depth     = 5;
  let _threshold = CMAP_PARENT_CHILD_THRESHOLD;  // 0–1 float
  let _layout    = 'radial';
  let _rows      = null;
  let _rendered  = false;
  let _rebuildTimer = null;
  let _topZ      = 10;
  let _panX = 0, _panY = 0, _zoom = 1;
  let _liveRects = new Map(); // cardId -> {x,y,w,h}

  function applyTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }

  // ── Status ────────────────────────────────────────────────────────────────
  function setStatus(state, text) {
    statusEl.className = 'cmap-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders ───────────────────────────────────────────────────────────────
  depthSlider.addEventListener('input', () => {
    _depth = +depthSlider.value;
    depthValEl.textContent = _depth;
    scheduleRebuild();
  });
  threshSlider.addEventListener('input', () => {
    _threshold = +threshSlider.value / 100;
    threshValEl.textContent = threshSlider.value + '%';
    scheduleRebuild();
  });
  rebuildBtn.addEventListener('click', () => {
    clearTimeout(_rebuildTimer);
    _rendered = false; tryRender();
  });
  function scheduleRebuild() {
    clearTimeout(_rebuildTimer);
    rebuildBtn.classList.add('pp-cmap-busy');
    rebuildBtn.textContent = '\u2026';
    _rebuildTimer = setTimeout(() => { _rendered = false; tryRender(); }, 480);
  }

  // ── Layout dropdown ───────────────────────────────────────────────────────
  const LAYOUT_LABELS = { radial:'Radial', vtree:'Vertical Tree', htree:'Horizontal Tree',
                          vflow:'Vertical Flow', organic:'Organic' };
  layoutBtn.addEventListener('click', e => {
    e.stopPropagation();
    layoutMenu.classList.toggle('open');
    layoutBtn.classList.toggle('open', layoutMenu.classList.contains('open'));
  });
  document.addEventListener('click', () => {
    layoutMenu.classList.remove('open'); layoutBtn.classList.remove('open');
  });
  layoutMenu.addEventListener('click', e => e.stopPropagation());
  layoutOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const l = opt.dataset.layout; if (!l) return;
      _layout = l;
      layoutLabel.textContent = LAYOUT_LABELS[l] || l;
      layoutOpts.forEach(o => o.classList.toggle('active', o.dataset.layout === l));
      layoutMenu.classList.remove('open'); layoutBtn.classList.remove('open');
      if (_rendered) { _rendered = false; tryRender(); }
    });
  });

  // ── Fit all ───────────────────────────────────────────────────────────────
  function fitAll() {
    if (!_liveRects.size) return;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    _liveRects.forEach(r => {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + (r.w || CARD_W));
      maxY = Math.max(maxY, r.y + (r.h || 80));
    });
    if (!isFinite(minX)) return;
    const W = canvas.clientWidth || 400, H = canvas.clientHeight || 400, pad = 32;
    const scaleX = (W - pad*2) / Math.max(maxX - minX, 1);
    const scaleY = (H - pad*2) / Math.max(maxY - minY, 1);
    _zoom = Math.min(scaleX, scaleY, 2.5);
    _panX = pad - minX*_zoom + (W - pad*2 - (maxX-minX)*_zoom) / 2;
    _panY = pad - minY*_zoom + (H - pad*2 - (maxY-minY)*_zoom) / 2;
    applyTransform();
  }
  fitBtn.addEventListener('click', fitAll);

  // ── Pan ───────────────────────────────────────────────────────────────────
  let _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('.pp-cmap-card')) return;
    _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY;
    canvas.classList.add('pp-cmap-panning');
  });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return;
    _panX=_panBX+(ev.clientX-_panSX); _panY=_panBY+(ev.clientY-_panSY); applyTransform();
  });
  document.addEventListener('mouseup', () => {
    if (_panning) { _panning=false; canvas.classList.remove('pp-cmap-panning'); }
  });

  // ── Zoom ──────────────────────────────────────────────────────────────────
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const dz = ev.deltaY < 0 ? 1.1 : 0.9;
    const nz = Math.max(0.15, Math.min(4, _zoom*dz));
    _panX = mx - (mx-_panX)*nz/_zoom; _panY = my - (my-_panY)*nz/_zoom;
    _zoom = nz; applyTransform();
  }, { passive:false });
  let _pinchD=null;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length===2) _pinchD=Math.hypot(
      ev.touches[0].clientX-ev.touches[1].clientX,
      ev.touches[0].clientY-ev.touches[1].clientY);
  }, {passive:true});
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length!==2||!_pinchD) return;
    const d=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,
                       ev.touches[0].clientY-ev.touches[1].clientY);
    _zoom=Math.max(.15,Math.min(4,_zoom*d/_pinchD)); _pinchD=d; applyTransform(); ev.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', ()=>{ _pinchD=null; });

  // ── Card drag ─────────────────────────────────────────────────────────────
  function makeDraggable(el, cid) {
    let on=false, ox=0, oy=0, sx=0, sy=0;
    el.addEventListener('mousedown', e => {
      if (e.button!==0) return;
      on=true; ox=e.clientX; oy=e.clientY;
      const r=_liveRects.get(cid)||{x:0,y:0}; sx=r.x; sy=r.y;
      el.style.zIndex=String(++_topZ); e.stopPropagation(); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!on) return;
      const r=_liveRects.get(cid)||{w:CARD_W,h:80};
      const nx=sx+(e.clientX-ox)/_zoom, ny=sy+(e.clientY-oy)/_zoom;
      el.style.left=nx+'px'; el.style.top=ny+'px';
      _liveRects.set(cid,{x:nx,y:ny,w:r.w,h:r.h});
      redrawConnectors();
    });
    document.addEventListener('mouseup', () => { on=false; });
  }

  // ════════════════════════════════════════════════════════════════════════
  // ── Core cosine similarity ──────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  function cosineSim(a, b) {
    if (!a||!b||a.length!==b.length) return 0;
    let dot=0, na=0, nb=0;
    for (let i=0;i<a.length;i++) { dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return (na&&nb) ? Math.max(0, Math.min(1, dot/(Math.sqrt(na)*Math.sqrt(nb)))) : 0;
  }

  // ════════════════════════════════════════════════════════════════════════
  // ── Hierarchy builder ───────────────────────────────────────────────────
  //
  // Algorithm:
  //  1. Generality score = average cosine similarity to all other cells.
  //     Cells that are semantically central (high avg sim) are "general"
  //     concepts → assigned to level 1 (root).
  //     Cells that are peripheral (low avg sim) are "specific" → deep levels.
  //  2. Levels 1..depth are assigned by ranking cells on generality score
  //     and splitting into equal-sized buckets.
  //  3. Each non-root cell's parent = the highest-similarity cell exactly
  //     one level above it, provided that similarity ≥ _threshold.
  //  4. Orphans (no parent above threshold) are attached to the nearest
  //     ancestor at any higher level (relaxed threshold), or promoted to 1.
  //  5. Merge rule: cells at the same level with the identical set of
  //     direct children are combined into one card.
  //  6. simToChildren = avg cosine sim between a cell and its direct
  //     children → displayed as a % on each card.
  // ════════════════════════════════════════════════════════════════════════

  function buildHierarchy(rows) {
    const n = rows.length;
    if (n < 2) return null;

    // ── 1. Generality scores ────────────────────────────────────────────
    const scores = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) sum += cosineSim(rows[i].vec, rows[j].vec);
      }
      scores[i] = sum / (n - 1);
    }

    // ── 2. Level assignment (most general = level 1) ─────────────────────
    const rankOrder = Array.from({length:n}, (_,i)=>i)
      .sort((a,b) => scores[b] - scores[a]); // descending generality
    const levels = new Int32Array(n);
    rankOrder.forEach((rowIdx, rank) => {
      levels[rowIdx] = Math.max(1, Math.min(_depth, Math.floor(rank * _depth / n) + 1));
    });

    // ── 3. Parent assignment (nearest level-1-above, above threshold) ────
    const parents    = new Int32Array(n).fill(-1);
    const parentSims = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      if (levels[i] === 1) continue;
      let bestJ = -1, bestSim = _threshold;
      for (let j = 0; j < n; j++) {
        if (j === i || levels[j] !== levels[i] - 1) continue;
        const s = cosineSim(rows[i].vec, rows[j].vec);
        if (s > bestSim) { bestSim = s; bestJ = j; }
      }
      if (bestJ !== -1) { parents[i] = bestJ; parentSims[i] = bestSim; }
    }

    // ── 4. Orphan recovery (any higher level, relaxed threshold 0.7×) ───
    const relaxed = _threshold * 0.70;
    for (let i = 0; i < n; i++) {
      if (levels[i] <= 1 || parents[i] !== -1) continue;
      let bestJ = -1, bestSim = relaxed;
      for (let j = 0; j < n; j++) {
        if (j === i || levels[j] >= levels[i]) continue;
        const s = cosineSim(rows[i].vec, rows[j].vec);
        if (s > bestSim) { bestSim = s; bestJ = j; }
      }
      if (bestJ !== -1) {
        // Re-assign level to be exactly one below its new parent
        levels[i] = levels[bestJ] + 1;
        parents[i] = bestJ;
        parentSims[i] = bestSim;
      } else {
        levels[i] = 1; // promote to root
      }
    }

    // ── 5. Build children lists ──────────────────────────────────────────
    const children = Array.from({length:n}, ()=>[]);
    for (let i = 0; i < n; i++) {
      if (parents[i] !== -1) children[parents[i]].push(i);
    }

    // ── 6. Compute avg similarity to children ────────────────────────────
    const simToChildren = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!children[i].length) { simToChildren[i] = 0; continue; }
      let sum = 0;
      children[i].forEach(c => { sum += cosineSim(rows[i].vec, rows[c].vec); });
      simToChildren[i] = sum / children[i].length;
    }

    // ── 7. Merge: same level + identical children set → one card ─────────
    // Build merge groups keyed by "level:sortedChildIndices"
    const absorbedInto = new Int32Array(n).fill(-1); // -1 = not absorbed
    const mergeExtras  = new Map();                  // primary idx → extra row indices

    const mkKey = i => levels[i] + ':' + children[i].slice().sort((a,b)=>a-b).join(',');
    const seenKeys = new Map(); // key → first (primary) index

    for (let i = 0; i < n; i++) {
      if (children[i].length === 0) continue; // leaf → don't merge
      const k = mkKey(i);
      if (seenKeys.has(k)) {
        const primary = seenKeys.get(k);
        absorbedInto[i] = primary;
        if (!mergeExtras.has(primary)) mergeExtras.set(primary, []);
        mergeExtras.get(primary).push(i);
      } else {
        seenKeys.set(k, i);
      }
    }

    return {
      rows, n, levels, parents, parentSims, children,
      simToChildren, absorbedInto, mergeExtras
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // ── Render ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  function depthColor(level) {
    if (typeof TAB_THEMES !== 'undefined' && typeof THEMES !== 'undefined') {
      const tname = TAB_THEMES[(level - 1) % TAB_THEMES.length] || 'default';
      const theme = THEMES[tname] || THEMES.default || {};
      return {
        accent: theme['--tab-active-bg']    || '#5b7fa6',
        label:  theme['--tab-active-color'] || '#fff',
        bg:     theme['--bg-data']          || '#f8f8f8',
      };
    }
    const P = ['#5b7fa6','#7a6e9e','#5a9e7a','#9e7a5a','#9e5a7a'];
    return { accent: P[(level-1) % P.length], label:'#fff', bg:'#f8f8f8' };
  }

  let _connSvg = null;

  function redrawConnectors() {
    if (!_connSvg) return;
    const ns = 'http://www.w3.org/2000/svg';
    _connSvg.innerHTML = '';
    _connEdges.forEach(({fromId, toId, color, depth}) => {
      const ra = _liveRects.get(fromId), rb = _liveRects.get(toId);
      if (!ra || !rb) return;

      // 10-point anchors
      function pts(r) {
        const {x,y,w,h} = r;
        return [
          {x:x+w*.25,y},{x:x+w*.5,y},{x:x+w*.75,y},
          {x:x+w*.25,y:y+h},{x:x+w*.5,y:y+h},{x:x+w*.75,y:y+h},
          {x,y:y+h*.33},{x,y:y+h*.67},{x:x+w,y:y+h*.33},{x:x+w,y:y+h*.67}
        ];
      }
      const pA=pts(ra), pB=pts(rb);
      let best=null, bd=Infinity;
      pA.forEach(a=>pB.forEach(b=>{const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<bd){bd=d;best={a,b};}}));
      if (!best) return;

      const {a,b}=best;
      const dist=Math.hypot(b.x-a.x,b.y-a.y), off=Math.min(dist*.4,80);
      function tang(pt, r) {
        const t=3;
        if (Math.abs(pt.y-r.y)<t)       return{dx:0,dy:-1};
        if (Math.abs(pt.y-(r.y+r.h))<t) return{dx:0,dy:1};
        if (Math.abs(pt.x-r.x)<t)       return{dx:-1,dy:0};
        if (Math.abs(pt.x-(r.x+r.w))<t) return{dx:1,dy:0};
        return{dx:0,dy:1};
      }
      const tA=tang(a,ra), tB=tang(b,rb);
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d', `M${a.x},${a.y} C${a.x+tA.dx*off},${a.y+tA.dy*off} ${b.x+tB.dx*off},${b.y+tB.dy*off} ${b.x},${b.y}`);
      path.setAttribute('fill','none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', depth===0?'2':'1.5');
      path.setAttribute('stroke-opacity', depth===0?'0.55':'0.38');
      path.setAttribute('stroke-dasharray', depth===0?'none':'5 3');
      _connSvg.appendChild(path);

      const dot=document.createElementNS(ns,'circle');
      dot.setAttribute('cx',String(b.x)); dot.setAttribute('cy',String(b.y)); dot.setAttribute('r','3.5');
      dot.setAttribute('fill',color); dot.setAttribute('opacity','0.6');
      _connSvg.appendChild(dot);
    });
  }

  let _connEdges = [];

  function renderConceptMap(hier) {
    world.innerHTML = '';
    emptyEl.style.display = 'none';
    _liveRects.clear();
    _connEdges = [];
    _topZ = 10;
    _panX = 0; _panY = 0; _zoom = 1; applyTransform();

    if (!hier) { emptyEl.style.display = 'flex'; return; }

    const ns = 'http://www.w3.org/2000/svg';
    _connSvg = document.createElementNS(ns,'svg');
    _connSvg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1';
    world.appendChild(_connSvg);

    const { rows, n, levels, parents, simToChildren, absorbedInto, mergeExtras } = hier;
    const cardEls = new Map(); // rowIdx → card element (only primary/non-absorbed)

    // ── Build cards (skip absorbed cells) ──────────────────────────────────
    for (let i = 0; i < n; i++) {
      if (absorbedInto[i] !== -1) continue; // absorbed into another card

      const level   = levels[i];
      const { accent, label: lc, bg } = depthColor(level);
      const extras  = mergeExtras.get(i) || []; // extra rows merged into this card
      const allRows = [i, ...extras];

      const card = document.createElement('div');
      card.className = 'pp-cmap-card';
      card.style.cssText = `width:${CARD_W}px; position:absolute; z-index:${++_topZ}`;
      card.style.setProperty('--ppc-border', accent);
      card.style.setProperty('--ppc-bg', bg);

      // ── Header ─────────────────────────────────────────────────────────
      const head = document.createElement('div');
      head.className = 'pp-cmap-card-head';
      head.style.background = accent;
      head.style.color = lc;

      const badge = document.createElement('span');
      badge.className = 'pp-cmap-level-badge';
      badge.textContent = 'Level ' + level;
      head.appendChild(badge);

      if (extras.length > 0) {
        const mc = document.createElement('span');
        mc.className = 'pp-cmap-merged-count';
        mc.style.cssText = `background:${lc}33; color:${lc}`;
        mc.textContent = '\u00d7' + allRows.length;
        head.appendChild(mc);
      }
      card.appendChild(head);

      // ── Body: one cell-block per row in the merge group ─────────────────
      const body = document.createElement('div');
      body.className = 'pp-cmap-card-body';

      allRows.forEach((ri, idx) => {
        if (idx > 0) {
          const sep = document.createElement('div');
          sep.className = 'pp-cmap-merge-sep';
          body.appendChild(sep);
        }
        const r = rows[ri];
        const cells = r.row?.cells || r.cells || [];
        const cats  = r.row?.cats  ? r.row.cats.filter(c => c.trim()) : [];

        // Pick the longest non-empty cell text to show as the concept
        const best = cells.reduce((b, c) => c.trim().length > b.length ? c.trim() : b, '');
        const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };

        if (cats.length) {
          const ce = document.createElement('div');
          ce.className = 'pp-cmap-cell-cat';
          ce.textContent = cats.join(' · ');
          body.appendChild(ce);
        }
        const te = document.createElement('div');
        te.className = 'pp-cmap-cell-text';
        te.textContent = parsed.body;
        body.appendChild(te);
      });
      card.appendChild(body);

      // ── Footer: similarity % or leaf badge ──────────────────────────────
      const hasChildren = hier.children[i].length > 0;
      if (hasChildren) {
        const sim = simToChildren[i];
        const pct = Math.round(sim * 100);
        const footer = document.createElement('div');
        footer.className = 'pp-cmap-card-footer';
        const bar = document.createElement('div'); bar.className = 'pp-cmap-sim-bar';
        const fill = document.createElement('div'); fill.className = 'pp-cmap-sim-fill';
        fill.style.width = pct + '%'; fill.style.background = accent + 'cc';
        bar.appendChild(fill); footer.appendChild(bar);
        const lbl = document.createElement('span'); lbl.className = 'pp-cmap-sim-label';
        lbl.textContent = pct + '% match';
        footer.appendChild(lbl);
        card.appendChild(footer);
      } else {
        const leaf = document.createElement('span');
        leaf.className = 'pp-cmap-leaf-badge';
        leaf.textContent = 'Terminal concept';
        card.appendChild(leaf);
      }

      world.appendChild(card);
      cardEls.set(i, card);
      _liveRects.set(i, { x: 0, y: 0, w: CARD_W, h: 80 });
      makeDraggable(card, i);

      if (window.ResizeObserver) {
        new ResizeObserver(() => {
          const r = _liveRects.get(i);
          if (r) { r.h = card.offsetHeight; redrawConnectors(); }
        }).observe(card);
      }
    }

    // ── Build connector edges ────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      if (absorbedInto[i] !== -1) continue;
      const par = parents[i];
      if (par === -1) continue;
      // Parent might be absorbed — resolve to its primary
      const parPrimary = absorbedInto[par] !== -1 ? absorbedInto[par] : par;
      if (!cardEls.has(i) || !cardEls.has(parPrimary)) continue;
      const { accent } = depthColor(levels[parPrimary]);
      _connEdges.push({ fromId: parPrimary, toId: i, color: accent, depth: levels[parPrimary]-1 });
    }

    // ── Layout ────────────────────────────────────────────────────────────
    requestAnimationFrame(() => {
      const W = canvas.clientWidth || 500, H = canvas.clientHeight || 500;

      // Collect card ids and their levels for layout
      const nodeIds = [];
      cardEls.forEach((_, id) => nodeIds.push(id));

      const byLevel = new Map();
      nodeIds.forEach(id => {
        const lv = levels[id];
        if (!byLevel.has(lv)) byLevel.set(lv, []);
        byLevel.get(lv).push(id);
      });
      const maxLevel = Math.max(...byLevel.keys(), 1);

      // Build parent map for tree layouts
      const parentOf = new Map();
      const childrenOf = new Map();
      nodeIds.forEach(id => { childrenOf.set(id, []); });
      _connEdges.forEach(({fromId, toId}) => {
        parentOf.set(toId, fromId);
        if (childrenOf.has(fromId)) childrenOf.get(fromId).push(toId);
      });
      const roots = nodeIds.filter(id => !parentOf.has(id));

      const cH = id => { const el = cardEls.get(id); return el ? (el.offsetHeight || 80) : 80; };
      const GAP_X = MM_PAD + 10, GAP_Y = MM_PAD + 20;

      function applyPositions(posMap) {
        posMap.forEach((pos, id) => {
          const el = cardEls.get(id); if (!el) return;
          el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
          const h = cH(id);
          _liveRects.set(id, { x: pos.x, y: pos.y, w: CARD_W, h });
        });
        // Overlap resolution
        for (let pass = 0; pass < 30; pass++) {
          let moved = false;
          _liveRects.forEach((ra, ka) => {
            _liveRects.forEach((rb, kb) => {
              if (ka === kb) return;
              if (ra.x < rb.x+rb.w+MM_PAD && ra.x+ra.w+MM_PAD > rb.x &&
                  ra.y < rb.y+rb.h+MM_PAD && ra.y+ra.h+MM_PAD > rb.y) {
                const dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x;
                const dD=rb.y+rb.h+MM_PAD-ra.y, dU=ra.y+ra.h+MM_PAD-rb.y;
                if (Math.min(dR,dL)<=Math.min(dD,dU)) ra.x += dR<dL?dR:-dL;
                else ra.y += dD<dU?dD:-dU;
                const el=cardEls.get(ka); if(el){el.style.left=ra.x+'px'; el.style.top=ra.y+'px';}
                moved=true;
              }
            });
          });
          if (!moved) break;
        }
        redrawConnectors();
      }

      // ── 1. Radial ──────────────────────────────────────────────────────
      function layoutRadial() {
        const pos = new Map();
        const cx = W/2, cy = H/2;
        byLevel.forEach((ids, lv) => {
          const R = maxLevel === 1 ? 0 : (0.12 + 0.20 * (lv-1)) * Math.min(W, H);
          ids.forEach((id, idx) => {
            const h = cH(id);
            if (lv === 1 && ids.length === 1) {
              pos.set(id, { x: cx - CARD_W/2, y: cy - h/2 });
              return;
            }
            const a = (2*Math.PI*idx/ids.length) - Math.PI/2;
            pos.set(id, { x: cx + R*Math.cos(a) - CARD_W/2, y: cy + R*Math.sin(a) - h/2 });
          });
        });
        applyPositions(pos);
      }

      // ── 2. Vertical tree ───────────────────────────────────────────────
      function subtreeW(id) {
        const kids = childrenOf.get(id) || [];
        if (!kids.length) return CARD_W;
        return kids.reduce((s,k)=>s+subtreeW(k),0) + GAP_X*(kids.length-1);
      }
      function layoutTree(vertical) {
        const pos = new Map();
        function place(id, left, depth) {
          const kids = childrenOf.get(id) || [];
          const myW = subtreeW(id);
          const cx = left + myW/2;
          const h = cH(id);
          const rowY = depth * (90 + GAP_Y);
          if (vertical) pos.set(id, { x: cx - CARD_W/2, y: rowY });
          else          pos.set(id, { x: rowY, y: cx - h/2 });
          let childLeft = left;
          kids.forEach(kid => { place(kid, childLeft, depth+1); childLeft += subtreeW(kid) + GAP_X; });
        }
        const totalW = roots.reduce((s,r)=>s+subtreeW(r),0) + GAP_X*(roots.length-1);
        let curX = W/2 - totalW/2;
        roots.forEach(r => { place(r, curX, 0); curX += subtreeW(r) + GAP_X; });
        applyPositions(pos);
      }

      // ── 3. Vertical flow (by level, rows of cards) ─────────────────────
      function layoutFlow(vertical) {
        const pos = new Map();
        byLevel.forEach((ids, lv) => {
          const layerH = Math.max(...ids.map(cH), 80);
          const totalW = ids.length * (CARD_W + GAP_X) - GAP_X;
          const startX = W/2 - totalW/2;
          const rowY   = (lv-1) * (layerH + GAP_Y*2);
          ids.forEach((id, idx) => {
            const h = cH(id);
            if (vertical) pos.set(id, { x: startX + idx*(CARD_W+GAP_X), y: rowY+(layerH-h)/2 });
            else          pos.set(id, { x: rowY, y: startX + idx*(CARD_W+GAP_X) });
          });
        });
        applyPositions(pos);
      }

      // ── 4. Organic (Fruchterman-Reingold) ─────────────────────────────
      function layoutOrganic() {
        const px = {}, py = {};
        nodeIds.forEach((id, i) => {
          const a = (2*Math.PI*i/nodeIds.length) - Math.PI/2;
          const R = Math.min(W,H)*.35;
          px[id] = W/2 + R*Math.cos(a);
          py[id] = H/2 + R*Math.sin(a);
        });
        const AREA = W*H, k = Math.sqrt(AREA/Math.max(nodeIds.length,1)) * 0.9;
        let temp = Math.min(W,H)*.25;
        for (let it = 0; it < 80; it++) {
          const dx = {}, dy = {};
          nodeIds.forEach(id=>{dx[id]=0;dy[id]=0;});
          for (let i=0;i<nodeIds.length;i++) for (let j=i+1;j<nodeIds.length;j++) {
            const u=nodeIds[i],v=nodeIds[j];
            let ddx=px[u]-px[v], ddy=py[u]-py[v];
            const d=Math.sqrt(ddx*ddx+ddy*ddy)||.01;
            const f=k*k/d; ddx/=d; ddy/=d;
            dx[u]+=ddx*f; dy[u]+=ddy*f; dx[v]-=ddx*f; dy[v]-=ddy*f;
          }
          _connEdges.forEach(({fromId:u,toId:v})=>{
            if(!px.hasOwnProperty(u)||!px.hasOwnProperty(v)) return;
            let ddx=px[v]-px[u], ddy=py[v]-py[u];
            const d=Math.sqrt(ddx*ddx+ddy*ddy)||.01;
            const f=d*d/k; ddx/=d; ddy/=d;
            dx[u]+=ddx*f; dy[u]+=ddy*f; dx[v]-=ddx*f; dy[v]-=ddy*f;
          });
          nodeIds.forEach(id=>{
            const d=Math.sqrt(dx[id]*dx[id]+dy[id]*dy[id])||.01;
            const disp=Math.min(d,temp);
            px[id]+=dx[id]/d*disp; py[id]+=dy[id]/d*disp;
          });
          temp*=0.93;
        }
        const pos=new Map();
        nodeIds.forEach(id=>{const h=cH(id);pos.set(id,{x:px[id]-CARD_W/2,y:py[id]-h/2});});
        applyPositions(pos);
      }

      // ── Dispatch ────────────────────────────────────────────────────────
      switch (_layout) {
        case 'vtree':   layoutTree(true);   break;
        case 'htree':   layoutTree(false);  break;
        case 'vflow':   layoutFlow(true);   break;
        case 'hflow':   layoutFlow(false);  break;
        case 'organic': layoutOrganic();    break;
        default:        layoutRadial();     break;
      }

      setTimeout(fitAll, 80);
    });
  }

  // ── Data / render pipeline ───────────────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;
    if (_rows) { doRender(); return; }

    const rawRows = buildRowIndex();
    if (!rawRows.length) return;
    setStatus('loading', 'Building hierarchy for ' + rawRows.length + ' cells\u2026');
    emptyEl.style.display = 'none';

    Promise.all(rawRows.map(r => {
      const text = (r.row?.cells || r.cells || []).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx + ':' + r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map();
      results.forEach(res => { if (res?.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) { setStatus('error', 'No vectors available'); return; }
      const embedded = rawRows.filter(r => vectors.has(r.tabIdx + ':' + r.rowIdx));
      if (embedded.length < 3) { setStatus('error', 'Not enough data (need ≥ 3 cells)'); return; }
      embedded.forEach(r => { r.vec = vectors.get(r.tabIdx + ':' + r.rowIdx); });
      _rows = embedded;
      requestAnimationFrame(doRender);
    });
  }

  function doRender() {
    rebuildBtn.classList.remove('pp-cmap-busy');
    rebuildBtn.textContent = 'Rebuild';
    setStatus('loading', 'Mapping ' + _rows.length + ' cells\u2026');
    setTimeout(() => {
      try {
        const hier = buildHierarchy(_rows);
        if (!hier) { setStatus('error', 'Not enough data'); return; }

        // Count visible (non-absorbed) nodes per level
        let visibleCount = 0;
        const levelCounts = new Map();
        for (let i = 0; i < hier.n; i++) {
          if (hier.absorbedInto[i] !== -1) continue;
          visibleCount++;
          const lv = hier.levels[i];
          levelCounts.set(lv, (levelCounts.get(lv) || 0) + 1);
        }
        const levelStr = [...levelCounts.keys()].sort((a,b)=>a-b)
          .map(l => 'L' + l + ': ' + levelCounts.get(l)).join(' · ');

        renderConceptMap(hier);
        subtitleEl.textContent = visibleCount + ' cards · ' + levelStr;
        setStatus('ready', 'Done');
        _rendered = true;
      } catch (err) {
        console.error('[concept-map v12]', err);
        setStatus('error', 'Failed: ' + err.message);
      }
    }, 20);
  }

  // ── Event hooks ──────────────────────────────────────────────────────────
  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 120));
  window.addEventListener('embedding-progress', ev => {
    if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%');
  });
  window.addEventListener('embedder-ready', () => setTimeout(tryRender, 120));

  return {
    reset() {
      _rendered = false; _rows = null;
      _liveRects.clear(); _connEdges = []; _connSvg = null;
      world.innerHTML = '';
      emptyEl.style.display = 'flex';
      _panX = 0; _panY = 0; _zoom = 1; applyTransform();
    }
  };
}
