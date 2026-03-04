// sidepanel-mindmap.js — Concept Map tool v6
// Changes vs v5:
//   • 10-point dynamic anchor system for arrows (closest pair, tangent-aware bezier, endpoint dots)
//   • Dynamic children per node: uses getTopClusters on each subtree (sqrt-based K)
//     instead of always showing 2 binary Ward children
console.log('[sidepanel-mindmap.js boogyman]');

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
.pp-cmap-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .4s; }
#pp-cmap-status.cmap-loading .pp-cmap-dot { background:rgba(0,0,0,.25);animation:pp-cmap-pulse 1.2s ease-in-out infinite; }
#pp-cmap-status.cmap-ready   .pp-cmap-dot { background:rgba(40,160,80,.9); }
#pp-cmap-status.cmap-error   .pp-cmap-dot { background:rgba(180,40,40,.85); }
@keyframes pp-cmap-pulse { 0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);} }
#pp-cmap-controls {
  display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:end;
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
.pp-cmap-range-val { font-size:9px; font-weight:700; color:rgba(0,0,0,.55); flex-shrink:0; width:12px; text-align:right; }
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
  background:var(--color-topbar-sheet,#111); box-shadow:0 1px 3px rgba(0,0,0,.22); cursor:pointer;
}
#pp-cmap-rebuild {
  border:none; border-radius:5px; padding:4px 8px;
  font-size:8px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  background:rgba(0,0,0,.07); color:rgba(0,0,0,.45); cursor:pointer;
  transition:background .15s,color .15s; white-space:nowrap; align-self:stretch;
}
#pp-cmap-rebuild:hover { background:rgba(0,0,0,.13); color:rgba(0,0,0,.75); }
#pp-cmap-rebuild.pp-cmap-busy { background:rgba(0,0,0,.04);color:rgba(0,0,0,.25);cursor:default; }
/* Canvas: clips overflow, world inside is transformed for pan+zoom */
#pp-cmap-canvas {
  flex:1; min-height:0; position:relative; overflow:hidden;
  cursor:default; user-select:none;
}
#pp-cmap-canvas.pp-cmap-panning { cursor:grabbing !important; }
/* World: all cards + SVGs live here; gets translate+scale */
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
/* Fit-all button */
#pp-cmap-fit {
  position:absolute; bottom:28px; right:9px; z-index:25;
  width:24px; height:24px; border:none; border-radius:5px; padding:0;
  background:rgba(0,0,0,.07); color:rgba(0,0,0,.4); cursor:pointer;
  display:grid; place-items:center;
  transition:background .15s, color .15s;
}
#pp-cmap-fit:hover { background:rgba(0,0,0,.14); color:rgba(0,0,0,.75); }
.pp-cmap-d0 { opacity:1; }
.pp-cmap-d1 { opacity:0.82; }
.pp-cmap-d2 { opacity:0.65; }
.pp-cmap-d3 { opacity:0.48; }
.pp-cmap-d4 { opacity:0.34; }
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initConceptMapTool(paneEl, sidebarEl) {

  paneEl.innerHTML =
    '<div id="pp-cmap-head">' +
      '<div id="pp-cmap-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cmap-status" class="cmap-loading">' +
        '<div class="pp-cmap-dot"></div><span id="pp-cmap-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cmap-controls">' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-cmap-group-label">Depth</div>' +
          '<div class="pp-cmap-range-row">' +
            '<span class="pp-cmap-range-label">Lvl</span>' +
            '<input class="pp-cmap-range" id="pp-cmap-depth" type="range" min="1" max="5" value="3" step="1">' +
            '<span class="pp-cmap-range-val" id="pp-cmap-depth-val">3</span>' +
          '</div>' +
        '</div>' +
        '<div class="pp-cmap-ctrl-col">' +
          '<div class="pp-cmap-group-label">Top Concepts</div>' +
          '<div class="pp-cmap-range-row">' +
            '<span class="pp-cmap-range-label">K</span>' +
            '<input class="pp-cmap-range" id="pp-cmap-k" type="range" min="2" max="12" value="5" step="1">' +
            '<span class="pp-cmap-range-val" id="pp-cmap-k-val">5</span>' +
          '</div>' +
        '</div>' +
        '<button id="pp-cmap-rebuild">Rebuild</button>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cmap-canvas">' +
      '<div id="pp-cmap-world"></div>' +
      '<div id="pp-cmap-empty">Concept map will appear<br>once embeddings finish</div>' +
      '<button id="pp-cmap-fit" title="Fit all cards into view">' +
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3"/>' +
          '<rect x="4" y="4" width="8" height="8" rx="1" opacity=".4"/>' +
        '</svg>' +
      '</button>' +
      '<div id="pp-cmap-zoom-hint">scroll / pinch to zoom</div>' +
    '</div>';

  const subtitleEl  = paneEl.querySelector('#pp-cmap-subtitle');
  const statusEl    = paneEl.querySelector('#pp-cmap-status');
  const labelEl     = paneEl.querySelector('#pp-cmap-label');
  const canvas      = paneEl.querySelector('#pp-cmap-canvas');
  const world       = paneEl.querySelector('#pp-cmap-world');
  const emptyEl     = paneEl.querySelector('#pp-cmap-empty');
  const rebuildBtn  = paneEl.querySelector('#pp-cmap-rebuild');
  const fitBtn      = paneEl.querySelector('#pp-cmap-fit');
  const depthSlider = paneEl.querySelector('#pp-cmap-depth');
  const depthValEl  = paneEl.querySelector('#pp-cmap-depth-val');
  const kSlider     = paneEl.querySelector('#pp-cmap-k');
  const kValEl      = paneEl.querySelector('#pp-cmap-k-val');

  const CARD_W   = 160;
  const MM_PAD   = 12;
  const MM_ITERS = 25;
  const HOVER_MS = 200;
  const EXP_MS   = 260;

  let _depth = 3, _topK = 5;
  let _vectors = null, _rows = null, _rendered = false;
  let _rebuildTimer = null, _topZ = 10;
  let _panX = 0, _panY = 0, _zoom = 1;

  // ── Position cache: preserves card positions when depth slider changes ───
  let _posCache = new Map();    // stableKey -> {x,y}
  let _preservePan = false;     // if true, keep current pan/zoom on re-render
  // Live state exposed so fitAll & scheduleRebuild can read them:
  let _liveRects     = new Map(); // cid -> {x,y,w,h}
  let _liveCidToNode = new Map(); // cid -> node

  function nodeStableKey(node) {
    return node.rows.map(r => (r.tabIdx||0)+':'+(r.rowIdx||0)).sort().join(',');
  }

  const esc = t => typeof panelEscH === 'function' ? panelEscH(t) : String(t);
  const tv  = i => typeof panelThemeVars === 'function' ? panelThemeVars(i) : {};

  function ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  }

  function applyTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }

  // ── Fit all ──────────────────────────────────────────────────────────────
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

  // ── Pan: drag on empty canvas ────────────────────────────────────────────
  let _panning = false, _panSX = 0, _panSY = 0, _panBX = 0, _panBY = 0;
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('.pp-mm-card')) return;
    _panning = true; _panSX = ev.clientX; _panSY = ev.clientY;
    _panBX = _panX; _panBY = _panY;
    canvas.classList.add('pp-cmap-panning'); ev.preventDefault();
  });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return;
    _panX = _panBX + ev.clientX - _panSX;
    _panY = _panBY + ev.clientY - _panSY;
    applyTransform();
  });
  document.addEventListener('mouseup', () => { _panning = false; canvas.classList.remove('pp-cmap-panning'); });
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1 || ev.target.closest('.pp-mm-card')) return;
    _panning = true; _panSX = ev.touches[0].clientX; _panSY = ev.touches[0].clientY;
    _panBX = _panX; _panBY = _panY;
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (!_panning || ev.touches.length !== 1) return;
    _panX = _panBX + ev.touches[0].clientX - _panSX;
    _panY = _panBY + ev.touches[0].clientY - _panSY;
    applyTransform(); ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { _panning = false; });

  // ── Zoom: wheel + pinch ──────────────────────────────────────────────────
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const dz = ev.deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.max(0.15, Math.min(4, _zoom * dz));
    _panX = mx - (mx - _panX) * nz / _zoom;
    _panY = my - (my - _panY) * nz / _zoom;
    _zoom = nz; applyTransform();
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
    _pinchD = d; applyTransform(); ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchD = null; });

  // ── Status ───────────────────────────────────────────────────────────────
  function setStatus(state, text) {
    statusEl.className = 'cmap-' + state; labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  // ── Sliders ──────────────────────────────────────────────────────────────
  depthSlider.addEventListener('input', () => {
    _depth = +depthSlider.value; depthValEl.textContent = _depth;
    scheduleRebuild(true); // depth-only: preserve positions
  });
  kSlider.addEventListener('input', () => {
    _topK = +kSlider.value; kValEl.textContent = _topK;
    scheduleRebuild(false); // K change: full reset
  });
  rebuildBtn.addEventListener('click', () => {
    clearTimeout(_rebuildTimer);
    _posCache.clear(); _preservePan = false;
    _rendered = false; tryRender();
  });

  function scheduleRebuild(depthOnly) {
    clearTimeout(_rebuildTimer);
    if (depthOnly && _rendered) {
      // Save current positions keyed by stable node identity
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
    rebuildBtn.classList.add('pp-cmap-busy'); rebuildBtn.textContent = '\u2026';
    _rebuildTimer = setTimeout(() => { _rendered = false; tryRender(); }, 420);
  }

  // ── Ward clustering ──────────────────────────────────────────────────────
  function meanVec(rows) {
    if (!rows.length) return new Float32Array(0);
    const dim = rows[0].vec ? rows[0].vec.length : 0;
    const out = new Float32Array(dim);
    rows.forEach(r => { if (r.vec) r.vec.forEach((v, i) => { out[i] += v; }); });
    for (let i = 0; i < dim; i++) out[i] /= rows.length;
    return out;
  }
  function wardD(ca, na, cb, nb) {
    let d = 0; const m = na + nb;
    for (let i = 0; i < ca.length; i++) { const v = ca[i]-cb[i]; d += v*v; }
    return (na*nb/m)*d;
  }
  function buildDendrogram(rows) {
    const n = rows.length;
    const cls = rows.map(r => ({ rows:[r], cent: r.vec ? Float32Array.from(r.vec) : new Float32Array(0), n:1, node:{rows:[r],children:[],mergeD:0} }));
    const dc = new Map();
    const dk = (i,j) => i<j ? i+','+j : j+','+i;
    const gd = (i,j) => { const k=dk(i,j); if(!dc.has(k)) dc.set(k, wardD(cls[i].cent,cls[i].n,cls[j].cent,cls[j].n)); return dc.get(k); };
    let active = Array.from({length:n},(_,i)=>i);
    while (active.length > 1) {
      let bi=-1,bj=-1,bd=Infinity;
      for (let ai=0;ai<active.length;ai++) for (let aj=ai+1;aj<active.length;aj++) { const d=gd(active[ai],active[aj]); if(d<bd){bd=d;bi=active[ai];bj=active[aj];} }
      if (bi<0) break;
      const ci=cls[bi],cj=cls[bj], merged={rows:[...ci.rows,...cj.rows]};
      merged.cent=meanVec(merged.rows); merged.n=ci.n+cj.n;
      merged.node={rows:merged.rows,children:[ci.node,cj.node],mergeD:bd};
      const ni=cls.length; cls.push(merged);
      for (const k of active) {
        if(k===bi||k===bj) continue;
        const ck=cls[k];
        dc.set(dk(ni,k), ((ci.n+ck.n)/(merged.n+ck.n))*gd(bi,k) + ((cj.n+ck.n)/(merged.n+ck.n))*gd(bj,k));
      }
      active = active.filter(x=>x!==bi&&x!==bj); active.push(ni);
    }
    return cls[cls.length-1].node;
  }
  function getTopClusters(root, k) {
    if (!root) return [];
    let f=[root];
    while (f.length<k) {
      const sp=f.filter(x=>x.children.length).sort((a,b)=>b.rows.length-a.rows.length);
      if(!sp.length) break;
      const t=sp[0]; f=f.filter(x=>x!==t); t.children.forEach(c=>f.push(c));
    }
    return f;
  }

  function lockSVG(locked) {
    return locked
      ? `<svg viewBox="0 0 12 14" fill="none" width="10" height="10"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.9"/><path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="6" cy="9.5" r="1" fill="white" opacity="0.8"/></svg>`
      : `<svg viewBox="0 0 12 14" fill="none" width="10" height="10"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.35"/><path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.45"/><circle cx="6" cy="9.5" r="1" fill="white" opacity="0.35"/></svg>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  function renderConceptMap(root) {
    world.innerHTML = '';
    emptyEl.style.display = 'none';
    _topZ = 10;
    // Only reset pan/zoom on a full rebuild; depth-only changes preserve view
    if (!_preservePan) { _panX = 0; _panY = 0; _zoom = 1; }
    applyTransform();
    _preservePan = false; // consumed
    if (!root) { emptyEl.style.display = 'flex'; return; }

    // ── SVGs first inside world ──────────────────────────────────────────────
    const ns = 'http://www.w3.org/2000/svg';
    const svgLines = document.createElementNS(ns,'svg');
    svgLines.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1';
    world.appendChild(svgLines);
    const svgDots = document.createElementNS(ns,'svg');
    svgDots.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2';
    world.appendChild(svgDots);

    const cardEls = new Map();
    const rects   = new Map();
    const colors  = new Map();
    const collH   = new Map();
    const locked  = new Set();
    const arrows  = [];
    let _nid = 0;

    // Keep live refs accessible from outer scope (for fitAll + position saving)
    _liveRects     = rects;
    _liveCidToNode = new Map();

    function setId(node) {
      if (node._cid == null) node._cid = _nid++;
      _liveCidToNode.set(node._cid, node);
      if (node.children) node.children.forEach(setId);
    }
    setId(root);

    const toRender = [];
    const topRoots = getTopClusters(root, _topK);

    // Dynamic children: instead of walking the binary dendrogram directly
    // (which always gives exactly 2 children), we re-split each node's subtree
    // into a natural number of sub-clusters proportional to sqrt(entries).
    function collect(node, d, pid) {
      toRender.push({node, d, pid});
      if (d < _depth - 1 && node.rows.length > 1 && node.children.length) {
        const childK = Math.max(2, Math.min(7, Math.round(Math.sqrt(node.rows.length))));
        const subs   = getTopClusters(node, childK);
        // getTopClusters returns [node] if it can't split — guard against self-loops
        subs.filter(s => s !== node).forEach(c => collect(c, d + 1, node._cid));
      }
    }
    topRoots.forEach(r => collect(r, 0, null));

    toRender.forEach(({node,d,pid}) => {
      if (pid==null) return;
      const t = tv(node.rows[0]?.tabIdx||0);
      arrows.push({fromId:pid, toId:node._cid, color:t['--tab-active-bg']||'#aaa', depth:d});
    });

    // ── Arrow drawing — 10-point anchor system, picks closest pair ──────────
    function getR(id) {
      const r=rects.get(id); if(!r) return null;
      const el=cardEls.get(id);
      return {x:r.x, y:r.y, w:r.w, h: el ? (el.offsetHeight||r.h||80) : (r.h||80)};
    }
    // 10 connection anchors per card: 3 top, 3 bottom, 2 left side, 2 right side
    function cpts(id) {
      const r=getR(id); if(!r) return [];
      const {x,y,w:W,h:H}=r;
      return [
        {x:x+W*.25,y},     {x:x+W*.5,y},     {x:x+W*.75,y},
        {x:x+W*.25,y:y+H}, {x:x+W*.5,y:y+H}, {x:x+W*.75,y:y+H},
        {x,y:y+H*.33},     {x,y:y+H*.67},
        {x:x+W,y:y+H*.33}, {x:x+W,y:y+H*.67}
      ];
    }
    function closest(pA, pB) {
      let best=null, bd=Infinity;
      pA.forEach(a=>pB.forEach(b=>{const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<bd){bd=d;best={a,b};}}));
      return best;
    }
    // Outgoing tangent at an anchor point — perpendicular to whichever edge it's on
    function tanDir(pt, id) {
      const r=getR(id); if(!r) return{dx:0,dy:1}; const t=3;
      if(Math.abs(pt.y-r.y)<t)         return{dx:0,dy:-1};
      if(Math.abs(pt.y-(r.y+r.h))<t)   return{dx:0,dy:1};
      if(Math.abs(pt.x-r.x)<t)         return{dx:-1,dy:0};
      if(Math.abs(pt.x-(r.x+r.w))<t)   return{dx:1,dy:0};
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
        path.setAttribute('stroke-opacity', String(d===0?.55:d===1?.38:.22));
        if(d>1) path.setAttribute('stroke-dasharray','5,4');
        svgLines.appendChild(path);

        // Draw a filled dot ringed with the card's own border/bg colour at each endpoint
        [[a,fromId],[b,toId]].forEach(([pt,cid])=>{
          const cc=colors.get(cid)||{border:color,bg:'#fff'};
          const circ=document.createElementNS(ns,'circle');
          circ.setAttribute('cx',String(pt.x)); circ.setAttribute('cy',String(pt.y)); circ.setAttribute('r','4');
          circ.setAttribute('fill',cc.bg);
          circ.setAttribute('stroke',cc.border);
          circ.setAttribute('stroke-width','1.5');
          circ.setAttribute('opacity', String(d===0?.9:.7));
          svgDots.appendChild(circ);
        });
      });
    }

    // ── Card expand / collapse ────────────────────────────────────────────────
    function expand(card, on, id) {
      card.classList.toggle('pp-mm-expanded', on);
      requestAnimationFrame(() => {
        const h = card.offsetHeight || 80;
        if (on) collH.set(id, h); else collH.delete(id);
        redrawArrows();
      });
    }

    // ── Collision push-apart — NO position clamping (infinite canvas) ────────
    function pushApart(movedId) {
      for(let pass=0;pass<MM_ITERS;pass++){
        let moved=false;
        rects.forEach((ra,ka)=>{
          if(ka===movedId) return;
          rects.forEach((rb,kb)=>{
            if(ka===kb) return;
            const raH=collH.get(ka)||ra.h||80;
            const rbH=collH.get(kb)||rb.h||80;
            if(ra.x<rb.x+rb.w+MM_PAD && ra.x+ra.w+MM_PAD>rb.x &&
               ra.y<rb.y+rbH+MM_PAD  && ra.y+raH+MM_PAD>rb.y) {
              const dR=rb.x+rb.w+MM_PAD-ra.x, dL=ra.x+ra.w+MM_PAD-rb.x;
              const dD=rb.y+rbH+MM_PAD-ra.y,  dU=ra.y+raH+MM_PAD-rb.y;
              if(Math.min(dR,dL)<=Math.min(dD,dU)) ra.x+=dR<dL?dR:-dL;
              else ra.y+=dD<dU?dD:-dU;
              // No clamping — infinite canvas
              const el=cardEls.get(ka); if(el){el.style.left=ra.x+'px';el.style.top=ra.y+'px';}
              moved=true;
            }
          });
        });
        if(!moved) break;
      }
    }

    // ── Drag — world-space, no clamping ──────────────────────────────────────
    function drag(el, id) {
      let on=false,ox=0,oy=0,sl=0,st=0;
      const start=(cx,cy)=>{
        on=true; el._dragging=true;
        const r=rects.get(id)||{x:0,y:0}; sl=r.x; st=r.y; ox=cx; oy=cy;
        el.style.zIndex=String(++_topZ); el.style.transition='none';
      };
      const move=(cx,cy)=>{
        if(!on) return;
        const r=rects.get(id)||{w:CARD_W,h:80};
        // Infinite canvas: no clamping
        const nx=sl+(cx-ox)/_zoom;
        const ny=st+(cy-oy)/_zoom;
        el.style.left=nx+'px'; el.style.top=ny+'px';
        rects.set(id,{x:nx,y:ny,w:r.w,h:r.h});
        pushApart(id); redrawArrows();
      };
      const end=()=>{ if(!on)return; on=false; el._dragging=false; redrawArrows(); };
      el.addEventListener('mousedown',e=>{
        if(e.button!==0||e.target.closest('.pp-mm-lock,.pp-goto-btn'))return;
        start(e.clientX,e.clientY); e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
      document.addEventListener('mouseup',end);
      let _tx=0,_ty=0;
      el.addEventListener('touchstart',e=>{
        if(e.touches.length!==1||e.target.closest('.pp-mm-lock,.pp-goto-btn'))return;
        _tx=e.touches[0].clientX;_ty=e.touches[0].clientY;
        start(_tx,_ty); e.preventDefault();
      },{passive:false});
      el.addEventListener('touchmove',e=>{
        if(e.touches.length!==1)return;
        move(e.touches[0].clientX,e.touches[0].clientY); e.preventDefault();
      },{passive:false});
      el.addEventListener('touchend',end);
    }

    // ── makeCard ──────────────────────────────────────────────────────────────
    function makeCard(node, depth) {
      const isLeaf = node.children.length===0 || depth>=_depth-1;
      const tabIdx = node.rows[0]?.tabIdx||0;
      const t      = tv(tabIdx);
      const accent = t['--tab-active-bg']    || '#888';
      const lc     = t['--tab-active-color'] || '#fff';
      const bg     = t['--bg-data']          || '#fff';
      const id     = node._cid;
      colors.set(id,{border:accent,bg});

      const card=document.createElement('div');
      card.className='pp-mm-card pp-cmap-d'+Math.min(depth,4);
      card.style.cssText=`width:${CARD_W}px;position:absolute;z-index:${++_topZ}`;
      card.style.setProperty('--ppc-border',accent);
      card.style.setProperty('--ppc-bg',bg);

      const head=document.createElement('div');
      head.className='pp-mm-card-head';
      head.style.background=accent; head.style.color=lc;
      const levelLabel = ordinal(depth+1)+' level concept';
      head.innerHTML=
        '<span class="pp-mm-badge">'+esc(levelLabel)+'</span>'+
        '<span class="pp-mm-head-label">'+esc(node.rows.length+' entr'+(node.rows.length===1?'y':'ies'))+'</span>';

      const lockBtn=document.createElement('button');
      lockBtn.className='pp-mm-lock'; lockBtn.innerHTML=lockSVG(false); lockBtn.style.color=lc;
      lockBtn.addEventListener('click',e=>{
        e.stopPropagation();
        const nl=!locked.has(id); nl?locked.add(id):locked.delete(id);
        card.classList.toggle('pp-mm-card-locked',nl); lockBtn.innerHTML=lockSVG(nl);
        if(nl) expand(card,true,id); else if(!card.matches(':hover')) expand(card,false,id);
      });
      head.appendChild(lockBtn);
      card.appendChild(head);

      const body=document.createElement('div');
      body.className='pp-mm-card-body';
      (isLeaf?node.rows.slice(0,3):[node.rows[0]]).forEach(r=>{
        if(!r) return;
        const cells=r.row?.cells||r.cells||[];
        const cats =r.row?.cats ?r.row.cats.filter(c=>c.trim()):[];
        const best =cells.reduce((b,c)=>c.length>b.length?c:b,'');
        const parsed=typeof parseCitation==='function'?parseCitation(best):{body:best};
        if(cats.length){const ce=document.createElement('div');ce.className='pp-mm-cat';ce.textContent=cats.join(' \u00b7 ');body.appendChild(ce);}
        const fe=document.createElement('div'); fe.className='pp-mm-field';
        const lim=isLeaf?120:80;
        fe.textContent=parsed.body.slice(0,lim)+(parsed.body.length>lim?'\u2026':'');
        body.appendChild(fe);
      });
      if(!isLeaf){const se=document.createElement('div');se.className='pp-mm-cat';se.style.marginTop='3px';se.textContent=node.rows.length+' entries \u00b7 '+node.children.length+' sub-groups';body.appendChild(se);}
      card.appendChild(body);

      if(isLeaf&&node.rows.length===1&&node.rows[0]){
        const r=node.rows[0];
        const gb=document.createElement('button');gb.className='pp-goto-btn';
        gb.style.borderColor=accent;gb.style.color=accent;
        gb.addEventListener('click',e=>{e.stopPropagation();if(typeof panelGoTo==='function')panelGoTo(r,0);});
        gb.addEventListener('mousedown',e=>e.stopPropagation());
        card.appendChild(gb);
      }

      let _hvt=null;
      card.addEventListener('mouseenter',()=>{if(card._dragging)return;clearTimeout(_hvt);_hvt=setTimeout(()=>expand(card,true,id),HOVER_MS);});
      card.addEventListener('mouseleave',()=>{clearTimeout(_hvt);if(locked.has(id))return;expand(card,false,id);});

      world.appendChild(card);
      card._cid=id;
      drag(card,id);
      cardEls.set(id,card);
      if(window.ResizeObserver) new ResizeObserver(()=>redrawArrows()).observe(card);
      return card;
    }

    toRender.forEach(({node,d})=>makeCard(node,d));

    // ── Layout: radial, with position cache restore for existing nodes ────────
    requestAnimationFrame(()=>{
      const W=world.clientWidth||400, H=world.clientHeight||500;
      const cx=W/2, cy=H/2;
      const byD=new Map();
      toRender.forEach(({node,d})=>{if(!byD.has(d))byD.set(d,[]);byD.get(d).push(node._cid);});
      const maxD=Math.max(...byD.keys(),0);

      byD.forEach((ids,d)=>{
        ids.forEach((id,idx)=>{
          const el=cardEls.get(id); if(!el) return;
          const cH=el.offsetHeight||80;

          // Check if we have a saved position from before the depth slider moved
          const node = _liveCidToNode.get(id);
          const sk = node ? nodeStableKey(node) : null;
          let x, y;

          if (sk && _posCache.has(sk)) {
            // Restore previous position — card stays where it was
            const saved = _posCache.get(sk);
            x = saved.x; y = saved.y;
          } else {
            // New card: place via radial layout (no clamping — infinite canvas)
            if(d===0&&ids.length===1){x=cx-CARD_W/2;y=cy-cH/2;}
            else{
              const R=(maxD===0?.28:.13+.19*d)*Math.min(W,H);
              const a=(2*Math.PI*idx/ids.length)-Math.PI/2;
              x=cx+R*Math.cos(a)-CARD_W/2;
              y=cy+R*Math.sin(a)-cH/2;
            }
            // No Math.max/min clamping — allow infinite canvas
          }

          el.style.left=x+'px'; el.style.top=y+'px';
          rects.set(id,{x,y,w:CARD_W,h:cH});
        });
      });

      // Initial collision nudge only for newly placed cards (not restored ones)
      for(let pass=0;pass<MM_ITERS;pass++){
        let moved=false;
        rects.forEach((ra,ka)=>{rects.forEach((rb,kb)=>{
          if(ka===kb)return;
          if(ra.x<rb.x+rb.w+MM_PAD&&ra.x+ra.w+MM_PAD>rb.x&&ra.y<rb.y+rb.h+MM_PAD&&ra.y+ra.h+MM_PAD>rb.y){
            const dR=rb.x+rb.w+MM_PAD-ra.x,dL=ra.x+ra.w+MM_PAD-rb.x;
            const dD=rb.y+rb.h+MM_PAD-ra.y,dU=ra.y+ra.h+MM_PAD-rb.y;
            if(Math.min(dR,dL)<=Math.min(dD,dU))ra.x+=dR<dL?dR:-dL;else ra.y+=dD<dU?dD:-dU;
            // No clamping
            const el=cardEls.get(ka);if(el){el.style.left=ra.x+'px';el.style.top=ra.y+'px';}
            moved=true;
          }
        });});
        if(!moved)break;
      }
      redrawArrows();
    });
  }

  // ── Data / render pipeline ───────────────────────────────────────────────
  function tryRender() {
    if(_rendered) return;
    if(!window.EmbeddingUtils||!window.EmbeddingUtils.isReady()) return;
    if(typeof buildRowIndex!=='function') return;
    if(_vectors&&_rows){doRender();return;}
    const rows=buildRowIndex();
    if(!rows.length) return;
    setStatus('loading','Building concept map for '+rows.length+' entries\u2026');
    emptyEl.style.display='none';
    Promise.all(rows.map(r=>{
      const text=(r.row?.cells||r.cells||[]).join(' ').trim();
      if(!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text).then(vec=>({key:r.tabIdx+':'+r.rowIdx,vec})).catch(()=>null);
    })).then(results=>{
      const vectors=new Map();
      results.forEach(res=>{if(res?.vec)vectors.set(res.key,res.vec);});
      if(!vectors.size){setStatus('error','No vectors available');return;}
      const embedded=rows.filter(r=>vectors.has(r.tabIdx+':'+r.rowIdx));
      if(embedded.length<3){setStatus('error','Not enough data');return;}
      embedded.forEach(r=>{r.vec=vectors.get(r.tabIdx+':'+r.rowIdx);});
      _vectors=vectors;_rows=embedded;
      requestAnimationFrame(doRender);
    });
  }
  function doRender() {
    rebuildBtn.classList.remove('pp-cmap-busy'); rebuildBtn.textContent='Rebuild';
    setStatus('loading','Clustering\u2026');
    setTimeout(()=>{
      try{
        const dendro=buildDendrogram(_rows);
        renderConceptMap(dendro);
        subtitleEl.textContent=_topK+' concept'+(_topK===1?'':'s')+' \u00b7 '+_rows.length+' entries \u00b7 depth '+_depth;
        setStatus('ready','Done'); _rendered=true;
      }catch(err){console.error('[concept-map]',err);setStatus('error','Clustering failed');}
    },20);
  }

  if(window.EmbeddingUtils&&window.EmbeddingUtils.isReady()) setTimeout(tryRender,120);
  document.addEventListener('embeddings-ready',()=>setTimeout(tryRender,120));
  window.addEventListener('embedding-progress',ev=>{if(!_rendered)setStatus('loading','Indexing\u2026 '+ev.detail.pct+'%');});

  return {
    reset(){
      _rendered=false;_vectors=null;_rows=null;
      _posCache.clear(); _preservePan=false;
      _liveRects=new Map(); _liveCidToNode=new Map();
      world.innerHTML='';
      emptyEl.style.display='flex';
      _panX=0;_panY=0;_zoom=1;applyTransform();
    }
  };
}
