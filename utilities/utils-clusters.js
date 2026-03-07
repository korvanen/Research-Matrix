// utils-clusters.js — Clusters tool v35
// v34 → v35 changes:
//   • All inline CSS replaced with MD3 design-system.css tokens (--md-sys-color-*, --md-elev-*, --radius-*, etc.)
//   • Sheet overlay panel replaced with createSidePanel() from utils-panel.js
//     – correct drag direction (right edge drag expands leftward)
//     – open/close arrow buttons wired to visible state via ds-panel-arrow--open / --close
//   • Nest cards, tooltips, table cells, status badge all use semantic DS tokens
//   • Dark-mode inherits automatically via CSS custom properties
console.log('[utils-clusters.js V10]');

var CL_MIN_SPLIT_LENGTH = 60;

(function injectClusterStyles() {
  if (document.getElementById('pp-cluster-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cluster-styles';
  s.textContent = `
/* ── Head / controls ───────────────────────────────────── */
#pp-cl-head {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--md-sys-color-surface-container);
}

#pp-cl-subtitle {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--md-sys-color-on-surface-variant);
  letter-spacing: var(--letter-spacing-wide);
  line-height: 1.3;
  min-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Status chip — MD3 Assist Chip style */
#pp-cl-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--md-sys-color-outline-variant);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  transition: opacity .6s ease, background .4s ease;
  width: fit-content;
}
#pp-cl-status.cl-loading {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
  color: var(--md-sys-color-on-surface-variant);
  border-color: var(--md-sys-color-outline-variant);
}
#pp-cl-status.cl-ready {
  background: color-mix(in srgb, var(--md-sys-color-secondary) 12%, transparent);
  color: var(--md-sys-color-secondary);
  border-color: color-mix(in srgb, var(--md-sys-color-secondary) 30%, transparent);
}
#pp-cl-status.cl-error {
  background: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
  color: var(--md-sys-color-error);
  border-color: color-mix(in srgb, var(--md-sys-color-error) 30%, transparent);
}
.pp-cl-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background .4s;
}
#pp-cl-status.cl-loading .pp-cl-dot {
  background: var(--md-sys-color-outline);
  animation: pp-cl-pulse 1.2s ease-in-out infinite;
}
#pp-cl-status.cl-ready .pp-cl-dot  { background: var(--md-sys-color-secondary); }
#pp-cl-status.cl-error .pp-cl-dot  { background: var(--md-sys-color-error); }

@keyframes pp-cl-pulse {
  0%, 100% { opacity: .3; transform: scale(.85); }
  50%       { opacity: 1; transform: scale(1.1); }
}

/* Controls grid */
#pp-cl-controls { display: flex; flex-direction: column; gap: var(--space-1); }
#pp-cl-sliders  {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 100px;
  gap: var(--space-2);
  align-items: center;
}
.pp-cl-slider-col { display: flex; flex-direction: column; gap: 2px; }
.pp-cl-btn-col    { display: flex; align-items: stretch; justify-content: stretch; align-self: stretch; height: 100%; }

/* Re-cluster button — MD3 Tonal Button */
#pp-cl-recluster {
  flex: 1;
  border: none;
  border-radius: var(--radius-full);
  padding: 0 var(--space-3);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  cursor: pointer;
  transition: box-shadow var(--transition-fast), background var(--transition-fast);
  display: flex; align-items: center; justify-content: center;
  text-align: center; line-height: 1.3; white-space: nowrap;
  position: relative; overflow: hidden;
}
#pp-cl-recluster::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--md-sys-color-on-secondary-container);
  opacity: 0;
  border-radius: inherit;
  transition: opacity var(--transition-fast);
}
#pp-cl-recluster:hover::before { opacity: var(--md-sys-state-hover-opacity); }
#pp-cl-recluster:hover         { box-shadow: var(--md-elev-1); }
#pp-cl-recluster.pp-cl-reclustering {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
  color: color-mix(in srgb, var(--md-sys-color-on-surface) 38%, transparent);
  cursor: default;
}

/* ── Canvas ─────────────────────────────────────────────── */
#pp-cl-canvas {
  flex: 1; min-height: 0;
  overflow: hidden;
  position: relative;
  cursor: default;
  user-select: none;
  background: var(--md-sys-color-background);
}
#pp-cl-canvas.pp-cl-panning { cursor: grabbing !important; }
#pp-cl-canvas-world {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  transform-origin: 0 0;
  will-change: transform;
}
#pp-cl-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-outline);
  text-align: center; padding: var(--space-6);
  pointer-events: none;
}
#pp-cl-zoom-hint {
  position: absolute; bottom: var(--space-2); right: var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: .05em;
  color: var(--md-sys-color-outline);
  pointer-events: none; z-index: 20;
}

/* ── Nests — MD3 Elevated Card ──────────────────────────── */
.pp-cl-nest {
  position: absolute;
  border-radius: var(--radius-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: var(--md-elev-1);
  transition: box-shadow var(--transition-fast);
}
.pp-cl-nest.pp-cl-nest-lifted { box-shadow: var(--md-elev-3); }

.pp-cl-nest-head {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: grab; flex-shrink: 0; user-select: none;
}
.pp-cl-nest-head:active { cursor: grabbing; }

.pp-cl-nest-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: .04em;
  flex-shrink: 0;
  opacity: .85;
  min-width: 16px;
}
.pp-cl-nest-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.pp-cl-nest-count {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
}

.pp-cl-nest-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: var(--space-2);
  display: flex; flex-direction: column; gap: var(--space-1);
  scrollbar-width: thin;
  scrollbar-color: var(--md-sys-color-outline-variant) transparent;
}
.pp-cl-nest-body::-webkit-scrollbar       { width: 4px; }
.pp-cl-nest-body::-webkit-scrollbar-thumb {
  background: var(--md-sys-color-outline-variant);
  border-radius: var(--radius-full);
}
.pp-cl-nest-body::-webkit-scrollbar-track { background: transparent; }

.pp-cl-tile-row {
  display: flex; flex-wrap: wrap;
  align-items: flex-start; align-content: flex-start;
  gap: var(--space-1); width: 100%;
}

.pp-cl-resize-handle {
  position: absolute; bottom: 0; right: 0;
  width: 14px; height: 14px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--md-sys-color-outline-variant) 50%);
  border-radius: 0 0 var(--radius-sm) 0;
  z-index: 5;
  opacity: .5;
  transition: opacity var(--transition-fast);
}
.pp-cl-nest:hover .pp-cl-resize-handle { opacity: 1; }

/* ── Cards ──────────────────────────────────────────────── */
.pp-cl-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--ppc-bg, var(--md-sys-color-surface));
  cursor: pointer;
  flex: 1 1 100px; min-width: 100px;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  animation: pp-cl-card-in .22s var(--md-motion-easing-emphasized-decel) both;
  box-sizing: border-box;
  position: relative; overflow: hidden;
}
.pp-cl-card::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-cl-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--md-elev-2);
}
.pp-cl-card:hover::before { opacity: var(--md-sys-state-hover-opacity); }

@keyframes pp-cl-card-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}

/* ── Solid-colour card: text driven by --ppc-on (set from palette label in JS) ── */
.pp-cl-card .pp-cmap-card-cat-num     { color: color-mix(in srgb, var(--ppc-on,#fff) 92%, transparent); }
.pp-cl-card .pp-cmap-card-level-label { color: color-mix(in srgb, var(--ppc-on,#fff) 55%, transparent); }
.pp-cl-card .pp-cmap-card-rule        { background: color-mix(in srgb, var(--ppc-on,#fff) 22%, transparent); opacity: 1; }
.pp-cl-card .pp-cl-card-cat           { color: color-mix(in srgb, var(--ppc-on,#fff) 60%, transparent); }
.pp-cl-card .pp-cl-card-text          { color: color-mix(in srgb, var(--ppc-on,#fff) 92%, transparent); }
.pp-cl-card .pp-cl-card-split         { color: color-mix(in srgb, var(--ppc-on,#fff) 50%, transparent); }

.pp-cl-card-body        { padding: var(--space-1) var(--space-2) var(--space-2); }
.pp-cl-card-cat {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 2px;
}
.pp-cl-card-text {
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--md-sys-color-on-surface);
}
.pp-cl-card-split {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-outline);
  margin-top: 2px;
}

/* Sub-cluster strip */
.pp-cl-sub-strip {
  width: 100%; display: flex; align-items: center;
  gap: var(--space-1); padding: 3px var(--space-2);
  border-radius: var(--radius-xs);
  box-sizing: border-box;
}

/* ── Tooltip — MD3 Plain Tooltip ────────────────────────── */
#pp-cl-tooltip {
  position: fixed; z-index: 9999; pointer-events: none;
  background: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  border-radius: var(--radius-xs);
  padding: var(--space-2) var(--space-3);
  max-width: 240px;
  box-shadow: var(--md-elev-2);
  opacity: 0;
  transition: opacity .14s var(--md-motion-easing-standard);
  display: flex; flex-direction: column; gap: var(--space-1);
  line-height: 1.4;
}
#pp-cl-tooltip.pp-cl-tt-visible { opacity: 1; pointer-events: auto; }

.pp-cl-tooltip-cluster {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}
.pp-cl-tooltip-text {
  font-size: var(--font-size-sm);
  color: var(--md-sys-color-inverse-on-surface);
}
.pp-cl-tooltip-goto {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  cursor: pointer;
  align-self: flex-end;
  margin-top: var(--space-1);
  opacity: .8;
  transition: opacity var(--transition-fast);
}
.pp-cl-tooltip-goto:hover { opacity: 1; }

/* ── Cluster Spreadsheet Side Panel ─────────────────────── */
#pp-cl-sheet-host {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  z-index: 60;
  pointer-events: none;
}
#pp-cl-sheet-host > .ds-panel {
  pointer-events: all;
  height: 100%;
}

/* Panel header */
#pp-cl-sheet-phead {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  display: flex; align-items: center; gap: var(--space-2);
  background: var(--md-sys-color-surface-container);
}
#pp-cl-sheet-ptitle {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
  flex: 1;
}
#pp-cl-sheet-desc {
  font-size: var(--font-size-xs);
  color: var(--md-sys-color-outline);
  font-weight: var(--font-weight-medium);
  letter-spacing: .03em;
  white-space: nowrap;
}
#pp-cl-sheet-body {
  flex: 1; min-height: 0;
  overflow: auto;
  background: var(--md-sys-color-surface);
  scrollbar-width: thin;
  scrollbar-color: var(--md-sys-color-outline-variant) transparent;
}
#pp-cl-sheet-body::-webkit-scrollbar       { width: 4px; height: 4px; }
#pp-cl-sheet-body::-webkit-scrollbar-thumb {
  background: var(--md-sys-color-outline-variant);
  border-radius: var(--radius-full);
}
#pp-cl-sheet-body::-webkit-scrollbar-track { background: transparent; }

.pp-cl-panel-empty {
  padding: var(--space-6) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--md-sys-color-outline);
  letter-spacing: .05em;
}

/* ── Cluster table — MD3 Data Table ─────────────────────── */
.pp-cl-table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--font-size-sm);
}
.pp-cl-table thead tr { position: sticky; top: 0; z-index: 10; }
.pp-cl-table th {
  background: var(--md-sys-color-surface-container);
  padding: var(--space-3) var(--space-4) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  text-align: left;
  white-space: nowrap;
  color: var(--md-sys-color-on-surface-variant);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  border-bottom: 2px solid var(--md-sys-color-outline-variant);
}
.pp-cl-table th.pp-cl-th-corner {
  position: sticky; left: 0; z-index: 11;
  min-width: 28px; width: 28px;
  text-align: center;
  border-right: 2px solid var(--md-sys-color-outline-variant);
}
.pp-cl-table td {
  padding: var(--space-1);
  vertical-align: top;
  border-right: 1px solid var(--md-sys-color-outline-variant);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  min-width: 130px;
}
.pp-cl-table td.pp-cl-td-rowlabel {
  position: sticky; left: 0; z-index: 5;
  background: var(--md-sys-color-surface-container-low);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-caps);
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
  padding: var(--space-1) var(--space-2);
  white-space: nowrap;
  min-width: 28px; width: 28px;
  border-right: 2px solid var(--md-sys-color-outline-variant);
}
.pp-cl-table td.pp-cl-td-empty {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 3%, transparent);
  color: var(--md-sys-color-outline);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--space-2) var(--space-1);
}
.pp-cl-table tbody tr:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
}

/* Mini cards inside table cells */
.pp-cl-scard {
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--radius-xs);
  border-left: 3px solid transparent;
  padding: var(--space-1) var(--space-2) var(--space-1);
  margin-bottom: var(--space-1);
  cursor: pointer;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--md-sys-color-on-surface);
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}
.pp-cl-scard:last-child { margin-bottom: 0; }
.pp-cl-scard:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
  box-shadow: var(--md-elev-1);
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
        '<div class="pp-cl-slider-col"><div class="pp-group-label">Outer</div>' +
          '<div class="pp-range-row"><span class="pp-range-label">Min</span><input class="pp-range" id="pp-cl-omin" type="range" min="2" max="20" value="2" step="1"><span class="pp-range-val" id="pp-cl-omin-val">2</span></div>' +
          '<div class="pp-range-row"><span class="pp-range-label">Max</span><input class="pp-range" id="pp-cl-omax" type="range" min="2" max="20" value="12" step="1"><span class="pp-range-val" id="pp-cl-omax-val">12</span></div>' +
        '</div>' +
        '<div class="pp-cl-slider-col"><div class="pp-group-label">Inner</div>' +
          '<div class="pp-range-row"><span class="pp-range-label">Min</span><input class="pp-range pp-range--muted" id="pp-cl-imin" type="range" min="2" max="12" value="2" step="1"><span class="pp-range-val" id="pp-cl-imin-val">2</span></div>' +
          '<div class="pp-range-row"><span class="pp-range-label">Max</span><input class="pp-range pp-range--muted" id="pp-cl-imax" type="range" min="2" max="12" value="4" step="1"><span class="pp-range-val" id="pp-cl-imax-val">4</span></div>' +
        '</div>' +
        '<div class="pp-cl-slider-col"><div class="pp-group-label">Depth</div>' +
          '<div class="pp-range-row"><span class="pp-range-label">Lvl</span><input class="pp-range pp-range--accent" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1"><span class="pp-range-val" id="pp-cl-depth-val">2</span></div>' +
        '</div>' +
        '<div class="pp-cl-btn-col"><button id="pp-cl-recluster">Re-cluster</button></div>' +
      '</div></div>' +
    '</div>' +
    '<div id="pp-cl-canvas">' +
      '<div id="pp-cl-canvas-world"></div>' +
      '<div id="pp-cl-empty">Clusters will appear<br>once embeddings finish</div>' +
      '<div id="pp-cl-zoom-hint">scroll\u2009=\u2009zoom \u00b7 RMB drag\u2009=\u2009pan \u00b7 pinch/2-finger\u2009=\u2009touch</div>' +
    '</div>' +
    '<div id="pp-cl-tooltip">' +
      '<div class="pp-cl-tooltip-cluster" id="pp-cl-tt-cluster"></div>' +
      '<div class="pp-cl-tooltip-text" id="pp-cl-tt-text"></div>' +
      '<div class="pp-cl-tooltip-goto" id="pp-cl-tt-goto">Go to \u2197</div>' +
    '</div>';

  if (typeof upgradeSlider === 'function') {
    paneEl.querySelectorAll('.pp-range').forEach(upgradeSlider);
  }

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

  const CARD_W       = 200;
  const RESIZE_MIN_W = 200;
  const RESIZE_MIN_H = 60;
  const NEST_GAP     = 20;
  const DRAG_DELAY   = 600;

  let _outerMin=2, _outerMax=12, _innerMin=2, _innerMax=4, _depth=2;
  let _rendered=false, _ttRow=null;
  let _cachedEmbedded=null, _cachedVectors=null;
  let _reclusterTimer=null;
  let _panX=0, _panY=0, _zoom=1;
  let _topZ=10;
  let _clusterState=null;

  function outerLabel(i) {
    let label = '', n = i;
    do { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return label;
  }
  function innerLabel(outerLbl, subIdx) { return outerLbl + (subIdx + 1); }

  function applyWorldTransform() {
    world.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }
  function setStatus(state, text) {
    statusEl.className = 'cl-' + state; labelEl.textContent = text; statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3200);
  }

  function syncSliders() {
    if (+oMinSlider.value > +oMaxSlider.value) oMaxSlider.value = oMinSlider.value;
    if (+iMinSlider.value > +iMaxSlider.value) iMaxSlider.value = iMinSlider.value;
    _outerMin = +oMinSlider.value; _outerMax = +oMaxSlider.value;
    _innerMin = +iMinSlider.value; _innerMax = +iMaxSlider.value;
    _depth    = +depthSlider.value;
    smoothSliderVal(oMinSlider, oMinVal, _outerMin);
    smoothSliderVal(oMaxSlider, oMaxVal, _outerMax);
    smoothSliderVal(iMinSlider, iMinVal, _innerMin);
    smoothSliderVal(iMaxSlider, iMaxVal, _innerMax);
    smoothSliderVal(depthSlider, depthVal, _depth);
  }

  const _sliderTargets = new Map();
  function smoothSliderVal(slider, valEl, intVal) {
    let state = _sliderTargets.get(slider);
    if (!state) { state = { current: intVal, raf: null }; _sliderTargets.set(slider, state); }
    state.target = intVal;
    if (state.raf) return;
    function step() {
      state.current += (state.target - state.current) * 0.28;
      if (Math.abs(state.target - state.current) < 0.05) {
        state.current = state.target; valEl.textContent = state.target; state.raf = null; return;
      }
      valEl.textContent = Math.round(state.current); state.raf = requestAnimationFrame(step);
    }
    state.raf = requestAnimationFrame(step);
  }

  [oMinSlider, oMaxSlider, iMinSlider, iMaxSlider, depthSlider].forEach(s => {
    s.addEventListener('input', () => {
      syncSliders();
      if (!_cachedEmbedded) return;
      clearTimeout(_reclusterTimer);
      reclusterBtn.classList.add('pp-cl-reclustering'); reclusterBtn.textContent = '\u2026';
      _reclusterTimer = setTimeout(() => { _rendered = false; tryRender(); }, DRAG_DELAY);
    });
    s.addEventListener('change', () => {
      syncSliders();
      if (!_cachedEmbedded) return;
      clearTimeout(_reclusterTimer); _rendered = false; tryRender();
    });
  });

  reclusterBtn.addEventListener('click', () => { clearTimeout(_reclusterTimer); _rendered = false; tryRender(); });

  const sheetHost = document.createElement('div');
  sheetHost.id = 'pp-cl-sheet-host';
  canvas.appendChild(sheetHost);

  const sheetPanelContent = document.createElement('div');
  sheetPanelContent.style.cssText = 'display:flex;flex-direction:column;height:100%;';

  const sheetPHead = document.createElement('div');
  sheetPHead.id = 'pp-cl-sheet-phead';
  const sheetTitle = document.createElement('div');
  sheetTitle.id = 'pp-cl-sheet-ptitle';
  sheetTitle.textContent = 'Cluster Table';
  const sheetDesc = document.createElement('div');
  sheetDesc.id = 'pp-cl-sheet-desc';
  sheetPHead.appendChild(sheetTitle);
  sheetPHead.appendChild(sheetDesc);

  const sheetBody = document.createElement('div');
  sheetBody.id = 'pp-cl-sheet-body';
  sheetBody.innerHTML = '<div class="pp-cl-panel-empty">Clusters will appear here once embeddings finish.</div>';

  sheetPanelContent.appendChild(sheetPHead);
  sheetPanelContent.appendChild(sheetBody);

  sheetBody.addEventListener('wheel', ev => ev.stopPropagation(), { passive: true });

  const sheetPanel = createSidePanel(sheetHost, {
    side:               'right',
    defaultFraction:    0.40,
    minFraction:        0,
    maxFraction:        0.88,
    snapCloseFraction:  0.10,
    overlapFraction:    0,
    fullscreenFraction: 0.88,
    twoPosition:        false,
    animDuration:       260,
    onResize: () => {},
    onOpen:   () => {},
    onClose:  () => {},
  });

  sheetPanel.setContent(sheetPanelContent);

  function updateSheetPanel() {
    if (!_clusterState) return;
    const { nonEmpty, alignedAsgns } = _clusterState;
    if (!nonEmpty || !nonEmpty.length) {
      sheetBody.innerHTML = '<div class="pp-cl-panel-empty">No clusters yet.</div>';
      return;
    }

    const cols = nonEmpty.map((members, ci) => {
      const subAsgn = alignedAsgns ? alignedAsgns[ci] : null;
      const numSub  = subAsgn ? Math.max(...subAsgn, 0) + 1 : 1;
      const groups  = Array.from({ length: numSub }, () => []);
      if (subAsgn) members.forEach((r, i) => groups[subAsgn[i]].push(r));
      else groups[0] = members.slice();
      return { label: outerLabel(ci), col: colForIndex(ci), groups };
    });

    const maxRows = Math.max(...cols.map(c => c.groups.length));
    sheetDesc.textContent = cols.length + ' col \u00b7 ' + maxRows + ' row' + (maxRows === 1 ? '' : 's');

    const table = document.createElement('table');
    table.className = 'pp-cl-table';

    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');
    const thC   = document.createElement('th');
    thC.className = 'pp-cl-th-corner'; thC.textContent = '#';
    hrow.appendChild(thC);
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.label + ' cluster';
      th.style.color      = c.col.accent;
      th.style.borderTop  = '3px solid ' + c.col.accent;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let ri = 0; ri < maxRows; ri++) {
      const tr = document.createElement('tr');
      const tdLbl = document.createElement('td');
      tdLbl.className   = 'pp-cl-td-rowlabel';
      tdLbl.textContent = ri + 1;
      tr.appendChild(tdLbl);
      cols.forEach(c => {
        const td      = document.createElement('td');
        const members = c.groups[ri] || [];
        if (!members.length) {
          td.className = 'pp-cl-td-empty'; td.textContent = '\u2014';
        } else {
          members.forEach(r => {
            const cells  = r.row && r.row.cells ? r.row.cells : (r.cells || []);
            const best   = cells.reduce((b, x) => x.length > b.length ? x : b, '');
            const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
            const scard  = document.createElement('div');
            scard.className          = 'pp-cl-scard';
            scard.style.borderLeftColor = c.col.accent;
            const txt = parsed.body || best;
            scard.textContent = txt.length > 130 ? txt.slice(0, 130) + '\u2026' : txt;
            scard.title = txt;
            scard.addEventListener('click', () => { if (typeof panelGoTo === 'function') panelGoTo(r, 0); });
            td.appendChild(scard);
          });
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    sheetBody.innerHTML = '';
    sheetBody.appendChild(table);
  }

  let _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;

  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 2) return;
    _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY;
    canvas.classList.add('pp-cl-panning'); ev.preventDefault();
  });
  document.addEventListener('mousemove', ev => {
    if (!_panning) return;
    _panX=_panBX+ev.clientX-_panSX; _panY=_panBY+ev.clientY-_panSY; applyWorldTransform();
  });
  document.addEventListener('mouseup', ev => {
    if (ev.button !== 2 || !_panning) return;
    _panning=false; canvas.classList.remove('pp-cl-panning');
  });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    if (ev.ctrlKey || (Math.abs(ev.deltaY) >= 50 && Math.abs(ev.deltaX) < 50)) {
      const dz = ev.deltaY > 0 ? 0.94 : 1 / 0.94;
      const nz = Math.max(0.15, Math.min(4, _zoom * dz));
      _panX = mx - (mx - _panX) * nz / _zoom;
      _panY = my - (my - _panY) * nz / _zoom;
      _zoom = nz;
    } else {
      _panX -= ev.deltaX; _panY -= ev.deltaY;
    }
    applyWorldTransform();
  }, { passive: false });

  let _pinchD=null, _touchMidX=0, _touchMidY=0;
  canvas.addEventListener('touchstart', ev => {
    if (ev.touches.length === 2) {
      _pinchD    = Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX, ev.touches[0].clientY-ev.touches[1].clientY);
      _touchMidX = (ev.touches[0].clientX+ev.touches[1].clientX)/2;
      _touchMidY = (ev.touches[0].clientY+ev.touches[1].clientY)/2;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 2 || !_pinchD) return;
    ev.preventDefault();
    const mx = (ev.touches[0].clientX+ev.touches[1].clientX)/2;
    const my = (ev.touches[0].clientY+ev.touches[1].clientY)/2;
    const d  = Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX, ev.touches[0].clientY-ev.touches[1].clientY);
    const rect = canvas.getBoundingClientRect();
    const cmx = mx-rect.left, cmy = my-rect.top;
    const nz = Math.max(0.15, Math.min(4, _zoom * d / _pinchD));
    _panX = cmx-(cmx-_panX)*nz/_zoom; _panY = cmy-(cmy-_panY)*nz/_zoom;
    _zoom = nz; _pinchD = d;
    _panX += mx-_touchMidX; _panY += my-_touchMidY;
    _touchMidX = mx; _touchMidY = my;
    applyWorldTransform();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchD = null; });

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
  document.addEventListener('mouseup', () => {
    if (!_nestDrag) return;
    _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null;
  });
  document.addEventListener('touchmove', ev => {
    if (!_nestDrag || ev.touches.length !== 1) return;
    _nestDrag.el.style.left = (_nestDrag.sx + (ev.touches[0].clientX - _nestDrag.cx) / _zoom) + 'px';
    _nestDrag.el.style.top  = (_nestDrag.sy + (ev.touches[0].clientY - _nestDrag.cy) / _zoom) + 'px';
    ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!_nestDrag) return; _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null;
  });

  function makeResizable(nestEl) {
    const handle = document.createElement('div');
    handle.className = 'pp-cl-resize-handle';
    nestEl.appendChild(handle);
    let resizing=false, sw=0, sh=0, sx=0, sy=0;
    handle.addEventListener('mousedown', ev => {
      resizing=true; sw=nestEl.offsetWidth; sh=nestEl.offsetHeight; sx=ev.clientX; sy=ev.clientY;
      ev.stopPropagation(); ev.preventDefault();
    });
    document.addEventListener('mousemove', ev => {
      if (!resizing) return;
      nestEl.style.width  = Math.max(RESIZE_MIN_W, sw+(ev.clientX-sx)/_zoom)+'px';
      nestEl.style.height = Math.max(RESIZE_MIN_H, sh+(ev.clientY-sy)/_zoom)+'px';
    });
    document.addEventListener('mouseup', () => { resizing = false; });
  }

  function showTooltip(ev, r, text, accentColor, clusterLabel) {
    _ttRow = r;
    ttCluster.textContent = clusterLabel || '';
    ttCluster.style.color = accentColor;
    ttText.textContent    = text.slice(0, 160) + (text.length > 160 ? '\u2026' : '');
    ttGoto.style.color    = accentColor;
    tooltip.classList.add('pp-cl-tt-visible');
    moveTooltip(ev);
  }
  function moveTooltip(ev) {
    const pad=12, tw=tooltip.offsetWidth||200, th=tooltip.offsetHeight||80;
    let tx=ev.clientX+pad, ty=ev.clientY+pad;
    if (tx+tw > window.innerWidth-6)  tx = ev.clientX-tw-pad;
    if (ty+th > window.innerHeight-6) ty = ev.clientY-th-pad;
    tooltip.style.left = tx+'px'; tooltip.style.top = ty+'px';
  }
  function hideTooltip() { tooltip.classList.remove('pp-cl-tt-visible'); _ttRow = null; }
  ttGoto.addEventListener('click', () => {
    if (_ttRow && typeof panelGoTo === 'function') panelGoTo(_ttRow, 0);
    hideTooltip();
  });

  function sentenceSplit(text) {
    return text
      .replace(/([.!?;])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length >= CL_MIN_SPLIT_LENGTH);
  }

  function avgVec(vecs) {
    const valid = vecs.filter(Boolean); if (!valid.length) return null;
    const dim = valid[0].length, sum = new Float32Array(dim);
    valid.forEach(v => v.forEach((x, i) => { sum[i] += x; }));
    return Array.from(sum).map(x => x / valid.length);
  }

  async function maybySplitRow(row) {
    if (!window.EmbeddingUtils || typeof window.EmbeddingUtils.getCachedEmbedding !== 'function') return [row];
    const cells = row.row && row.row.cells ? row.row.cells : (row.cells || []);
    const cats  = row.row && row.row.cats  ? row.row.cats.filter(c => c.trim()) : [];
    let bestText = '', bestIdx = 0;
    cells.forEach((c, i) => { if (c.trim().length > bestText.length) { bestText = c.trim(); bestIdx = i; } });
    if (bestText.length < CL_MIN_SPLIT_LENGTH * 2) return [row];
    const segments = sentenceSplit(bestText);
    if (segments.length <= 1) return [row];
    let segVecs;
    try { segVecs = await Promise.all(segments.map(s => window.EmbeddingUtils.getCachedEmbedding(s))); }
    catch(e) { return [row]; }
    const valid = segments
      .map((s, i) => ({ text: s, vec: segVecs[i] }))
      .filter(x => x.vec && x.vec.length);
    if (valid.length <= 1) return [row];
    const n = valid.length, threshold = 0.55;
    const sim = Array.from({length: n}, (_, i) =>
      Array.from({length: n}, (_, j) => i === j ? 1 : cosineSim(valid[i].vec, valid[j].vec))
    );
    const groupOf = new Array(n).fill(-1); let numGroups = 0;
    for (let i = 0; i < n; i++) {
      if (groupOf[i] !== -1) continue; const g = numGroups++; groupOf[i] = g;
      for (let j = i+1; j < n; j++) {
        if (groupOf[j] !== -1) continue;
        let linked = false;
        for (let k = 0; k < j; k++) { if (groupOf[k] === g && sim[k][j] >= threshold) { linked=true; break; } }
        if (linked) groupOf[j] = g;
      }
    }
    if (numGroups <= 1) return [row];
    const groups = Array.from({length: numGroups}, () => []);
    valid.forEach((seg, i) => groups[groupOf[i]].push(seg));
    return groups.map((segs, ni) => ({
      tabIdx: row.tabIdx, rowIdx: row.rowIdx,
      headers: row.headers || [], title: row.title || '',
      kws: row.kws || new Set(),
      _splitN: ni + 1, _splitT: numGroups,
      vec: avgVec(segs.map(s => s.vec)),
      row: { cells: cells.map((c, ci) => ci === bestIdx ? segs.map(s => s.text).join(' ') : c), cats }
    }));
  }

  async function splitAllRows(rows) {
    const result = [];
    for (const row of rows) {
      const parts = await maybySplitRow(row);
      parts.forEach(r => result.push(r));
    }
    return result;
  }

  function resolveCollisions(rects, gap, maxPasses) {
    gap = gap || 0; maxPasses = maxPasses || 160;
    for (let pass = 0; pass < maxPasses; pass++) {
      let moved = false;
      for (let a = 0; a < rects.length; a++) {
        for (let b = a + 1; b < rects.length; b++) {
          const ra = rects[a], rb = rects[b];
          const overlapX  = (ra.x + ra.w + gap) - rb.x;
          const overlapY  = (ra.y + ra.h + gap) - rb.y;
          const overlapX2 = (rb.x + rb.w + gap) - ra.x;
          const overlapY2 = (rb.y + rb.h + gap) - ra.y;
          if (overlapX <= 0 || overlapX2 <= 0 || overlapY <= 0 || overlapY2 <= 0) continue;
          const pushX = Math.min(overlapX, overlapX2), pushY = Math.min(overlapY, overlapY2);
          if (pushX <= pushY) {
            const half = pushX / 2;
            if (overlapX < overlapX2) { ra.x -= half; rb.x += half; }
            else                      { ra.x += half; rb.x -= half; }
          } else {
            const half = pushY / 2;
            if (overlapY < overlapY2) { ra.y -= half; rb.y += half; }
            else                      { ra.y += half; rb.y -= half; }
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function cosineSim(a, b) {
    let d=0, na=0, nb=0;
    for (let i=0; i<a.length; i++) { d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }
  function centroid(rows) {
    if (!rows.length) return null;
    const dim = rows[0].vec.length, sum = new Float32Array(dim);
    rows.forEach(r => r.vec.forEach((x, i) => { sum[i] += x; }));
    return Array.from(sum).map(x => x / rows.length);
  }
  function kMeansCosine(rows, k, iters) {
    iters = iters || 25;
    const n = rows.length;
    if (n <= k) return rows.map((_, i) => i % k);
    const centers = [rows[Math.floor(Math.random() * n)].vec.slice()];
    while (centers.length < k) {
      const dists = rows.map(r => Math.min(...centers.map(c => 1 - cosineSim(r.vec, c))));
      const sum = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum; let picked = false;
      for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { centers.push(rows[i].vec.slice()); picked=true; break; } }
      if (!picked) centers.push(rows[Math.floor(Math.random() * n)].vec.slice());
    }
    let asgn = new Array(n).fill(0);
    for (let iter = 0; iter < iters; iter++) {
      const na = rows.map(r => { let best=0, bs=-Infinity; centers.forEach((c, ci) => { const s=cosineSim(r.vec, c); if (s > bs) { bs=s; best=ci; } }); return best; });
      centers.forEach((_, ci) => { const members = rows.filter((_, i) => na[i] === ci); if (!members.length) return; const c = centroid(members); if (c) centers[ci] = c; });
      if (na.every((a, i) => a === asgn[i])) break;
      asgn = na;
    }
    return asgn;
  }
  function bestKMeans(rows, k, trials) {
    trials = trials || 3; let bestAsgn = null, bestInertia = Infinity;
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

  function alignedSubCluster(topGroups, minK, maxK) {
    const numGroups = topGroups.length;
    if (numGroups < 2) return numGroups === 0 ? [] : [autoCluster(topGroups[0], minK, maxK)];
    const perGroupK = topGroups.map(members => {
      if (members.length < 2) return 1;
      const asgn = autoCluster(members, minK, maxK);
      return Math.max(...asgn) + 1;
    });
    const kCounts = {}; perGroupK.forEach(k => { kCounts[k] = (kCounts[k] || 0) + 1; });
    const canonicalK = parseInt(Object.entries(kCounts).sort((a, b) => b[1] - a[1])[0][0]);
    if (canonicalK < 2) return topGroups.map(g => new Array(g.length).fill(0));
    const allRows = topGroups.flat();
    const globalAsgn = bestKMeans(allRows, canonicalK, 5).asgn;
    const globalBuckets = Array.from({ length: canonicalK }, () => []);
    allRows.forEach((r, i) => globalBuckets[globalAsgn[i]].push(r));
    const globalCentroids = globalBuckets.map(b => b.length ? centroid(b) : null);
    return topGroups.map(members => {
      if (members.length < 2) return new Array(members.length).fill(0);
      const localAsgn = members.length < canonicalK ? members.map((_, i) => i % canonicalK) : bestKMeans(members, canonicalK, 3).asgn;
      const localBuckets = Array.from({ length: canonicalK }, () => []);
      members.forEach((r, i) => localBuckets[localAsgn[i]].push(r));
      const localCentroids = localBuckets.map(b => b.length ? centroid(b) : null);
      const sim = Array.from({ length: canonicalK }, (_, ci) =>
        Array.from({ length: canonicalK }, (_, gi) =>
          (localCentroids[ci] && globalCentroids[gi]) ? cosineSim(localCentroids[ci], globalCentroids[gi]) : 0));
      const usedGlobal = new Set(), mapping = new Array(canonicalK).fill(-1);
      const pairs = [];
      for (let ci = 0; ci < canonicalK; ci++)
        for (let gi = 0; gi < canonicalK; gi++)
          pairs.push({ ci, gi, s: sim[ci][gi] });
      pairs.sort((a, b) => b.s - a.s);
      for (const { ci, gi } of pairs) {
        if (mapping[ci] !== -1 || usedGlobal.has(gi)) continue;
        mapping[ci] = gi; usedGlobal.add(gi);
        if (usedGlobal.size === canonicalK) break;
      }
      for (let ci = 0; ci < canonicalK; ci++) {
        if (mapping[ci] !== -1) continue;
        for (let gi = 0; gi < canonicalK; gi++) {
          if (!usedGlobal.has(gi)) { mapping[ci] = gi; usedGlobal.add(gi); break; }
        }
        if (mapping[ci] === -1) mapping[ci] = ci;
      }
      return localAsgn.map(ci => mapping[ci]);
    });
  }

  const FALLBACK_PALETTE = [
    { accent: '#2e7d5e', bg: '#f4faf7', label: '#fff' },
    { accent: '#4a56c8', bg: '#f4f5fd', label: '#fff' },
    { accent: '#5e3d9e', bg: '#f6f3fb', label: '#fff' },
    { accent: '#c44035', bg: '#fdf5f4', label: '#fff' },
    { accent: '#c8991a', bg: '#fffdf5', label: '#fff' },
    { accent: '#888888', bg: '#f7f7f8', label: '#fff' },
  ];
  // Returns '#fff' or '#000' based on luminance of a hex accent colour
  function contrastFor(hex) {
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? '#000' : '#fff';
  }

  function colForIndex(i) {
    const pal = (typeof getPalette === 'function' ? getPalette() : null) || window.PP_PALETTE || FALLBACK_PALETTE;
    return pal[i % pal.length];
  }

  function buildCard(r, col, delay, clusterLabel) {
    const cells = r.row && r.row.cells ? r.row.cells : (r.cells || []);
    const cats  = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const best  = cells.reduce((b, c) => c.length > b.length ? c : b, '');
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
    const card = document.createElement('div');
    card.className = 'pp-cl-card';
    card.style.setProperty('--ppc-bg',     col.accent);
    card.style.setProperty('--ppc-border', col.accent);
    card.style.setProperty('--ppc-on',     contrastFor(col.accent));
    if (delay) card.style.animationDelay = delay + 'ms';

    const topRow = document.createElement('div');
    topRow.className = 'pp-cmap-card-top';
    const catNumEl = document.createElement('div');
    catNumEl.className = 'pp-cmap-card-cat-num';
    catNumEl.textContent = cats.length ? cats[0] : (clusterLabel ? clusterLabel.slice(0, 6) : '\u00b7');
    const levelBlock = document.createElement('div');
    levelBlock.className = 'pp-cmap-card-level-block';
    const levelLbl = document.createElement('div');
    levelLbl.className = 'pp-cmap-card-level-label';
    levelLbl.textContent = clusterLabel || 'Cluster';
    levelBlock.appendChild(levelLbl);
    topRow.appendChild(catNumEl);
    topRow.appendChild(levelBlock);
    card.appendChild(topRow);

    const rule = document.createElement('div');
    rule.className = 'pp-cmap-card-rule';
    card.appendChild(rule);

    const body = document.createElement('div'); body.className = 'pp-cl-card-body';
    if (cats.length) {
      const ce = document.createElement('div'); ce.className = 'pp-cl-card-cat'; ce.textContent = cats.join(' \u00b7 '); body.appendChild(ce);
    }
    const te = document.createElement('div'); te.className = 'pp-cl-card-text'; te.textContent = parsed.body; body.appendChild(te);
    if (r._splitN && r._splitT && r._splitT > 1) {
      const sp = document.createElement('div'); sp.className = 'pp-cl-card-split';
      sp.textContent = 'Segment ' + r._splitN + '\u2009/\u2009' + r._splitT;
      body.appendChild(sp);
    }
    card.appendChild(body);
    card.addEventListener('mouseenter', ev => showTooltip(ev, r, parsed.body, col.accent, clusterLabel || ''));
    card.addEventListener('mousemove',  ev => moveTooltip(ev));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    return card;
  }

  function buildInnerTiles(rows, subAsgn, col, outerLbl) {
    const frag = document.createDocumentFragment();
    if (!subAsgn || _depth <= 1) {
      const tileRow = document.createElement('div'); tileRow.className = 'pp-cl-tile-row';
      rows.forEach((r, ri) => tileRow.appendChild(buildCard(r, col, ri * 10, outerLbl)));
      frag.appendChild(tileRow);
      return frag;
    }
    const numSub = Math.max(...subAsgn, 0) + 1;
    const groups = Array.from({ length: numSub }, () => []);
    rows.forEach((r, i) => groups[subAsgn[i]].push(r));
    groups.forEach((members, si) => {
      if (!members.length) return;
      const subCol = colForIndex(si);
      const subLbl = innerLabel(outerLbl, si);
      const strip  = document.createElement('div');
      strip.className = 'pp-cl-sub-strip';
      strip.style.background   = subCol.accent + '18';
      strip.style.marginTop    = si === 0 ? '0' : 'var(--space-1)';
      const dot = document.createElement('span');
      dot.style.cssText = 'width:5px;height:5px;border-radius:50%;background:' + subCol.accent + ';flex-shrink:0;display:inline-block;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:var(--font-size-xs);font-weight:var(--font-weight-bold);letter-spacing:var(--letter-spacing-caps);color:' + subCol.accent + ';margin-right:var(--space-1);flex-shrink:0;';
      lbl.textContent = subLbl;
      const cnt = document.createElement('span');
      cnt.style.cssText = 'font-size:var(--font-size-xs);font-weight:var(--font-weight-medium);color:' + subCol.accent + ';opacity:.7;';
      cnt.textContent = members.length + ' entr' + (members.length === 1 ? 'y' : 'ies');
      strip.appendChild(dot); strip.appendChild(lbl); strip.appendChild(cnt);
      frag.appendChild(strip);
      const tileWrap = document.createElement('div'); tileWrap.className = 'pp-cl-tile-row';
      members.forEach((r, ri) => tileWrap.appendChild(buildCard(r, subCol, ri * 10, subLbl)));
      frag.appendChild(tileWrap);
    });
    return frag;
  }

  function buildOuterNest(members, outerIdx, subAsgn) {
    const col = colForIndex(outerIdx);
    const lbl = outerLabel(outerIdx);
    const nest = document.createElement('div');
    nest.className = 'pp-cl-nest';
    nest.style.borderTopColor  = col.accent;
    nest.style.borderTopWidth  = '3px';

    const subCount = subAsgn ? (Math.max(...subAsgn, 0) + 1) : 0;
    const subLabel = subAsgn && _depth > 1 ? ' \u00b7 ' + subCount + ' group' + (subCount === 1 ? '' : 's') : '';

    const head = document.createElement('div'); head.className = 'pp-cl-nest-head';
    head.style.background = col.accent + '18';

    const nestLblEl = document.createElement('span'); nestLblEl.className = 'pp-cl-nest-label';
    nestLblEl.textContent = lbl; nestLblEl.style.color = col.accent;
    const dot = document.createElement('span'); dot.className = 'pp-cl-nest-dot'; dot.style.background = col.accent;
    const cnt = document.createElement('span'); cnt.className = 'pp-cl-nest-count';
    cnt.textContent = members.length + ' entr' + (members.length === 1 ? 'y' : 'ies') + subLabel;
    head.appendChild(nestLblEl); head.appendChild(dot); head.appendChild(cnt);
    nest.appendChild(head);

    const body = document.createElement('div'); body.className = 'pp-cl-nest-body';
    nest.appendChild(body);
    body.appendChild(buildInnerTiles(members, subAsgn, col, lbl));

    const CARD_H_EST = 52, CARD_COLS = 3;
    const numRows = Math.ceil(members.length / CARD_COLS);
    const bodyH   = Math.max(80, numRows * (CARD_H_EST + 5) + 14 + (subAsgn && _depth > 1 ? subCount * 18 : 0));
    const nestW   = Math.max(RESIZE_MIN_W, CARD_W * CARD_COLS + 5 * (CARD_COLS - 1) + 14);
    const nestH   = Math.max(RESIZE_MIN_H, 28 + bodyH);
    nest.style.width  = nestW + 'px';
    nest.style.height = nestH + 'px';
    body.style.height = bodyH + 'px';
    nest._estW = nestW; nest._estH = nestH;

    makeNestDraggable(nest);
    makeResizable(nest);
    return nest;
  }

  function render(rows) {
    Array.from(world.children).forEach(c => c.remove());
    emptyEl.style.display = 'none';
    _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform(); _topZ = 10;

    const topAsgn   = autoCluster(rows, _outerMin, _outerMax);
    const numTop    = Math.max(...topAsgn, 0) + 1;
    const topGroups = Array.from({ length: numTop }, () => []);
    rows.forEach((r, i) => topGroups[topAsgn[i]].push(r));

    let alignedAsgns = null;
    const nonEmpty = topGroups.filter(g => g.length > 0);
    if (_depth > 1 && nonEmpty.length > 1) {
      alignedAsgns = alignedSubCluster(nonEmpty, _innerMin, _innerMax);
    }

    const nestEls = [];
    let alignIdx = 0;
    topGroups.forEach((members, oi) => {
      if (!members.length) return;
      const subAsgn = (alignedAsgns && _depth > 1) ? alignedAsgns[alignIdx++] : null;
      const nest = buildOuterNest(members, oi, subAsgn);
      nest.style.animationDelay = (oi * 55) + 'ms';
      world.appendChild(nest); nestEls.push(nest);
    });

    const cols = Math.max(1, Math.ceil(Math.sqrt(nestEls.length)));
    const topRects = nestEls.map((n, i) => ({
      x: NEST_GAP + (i % cols) * ((n._estW || 200) + NEST_GAP * 2),
      y: NEST_GAP + Math.floor(i / cols) * ((n._estH || 200) + NEST_GAP * 2),
      w: n._estW || 200, h: n._estH || 200, el: n
    }));

    resolveCollisions(topRects, NEST_GAP, 160);

    const minX = Math.min(...topRects.map(r => r.x));
    const minY = Math.min(...topRects.map(r => r.y));
    const offX = minX < NEST_GAP ? NEST_GAP - minX : 0;
    const offY = minY < NEST_GAP ? NEST_GAP - minY : 0;
    topRects.forEach(r => {
      r.el.style.left = (r.x + offX) + 'px';
      r.el.style.top  = (r.y + offY) + 'px';
    });

    const splitCount  = rows.filter(r => r._splitN && r._splitN > 1).length;
    const clusterNames = nestEls.map((_, i) => outerLabel(i)).join(', ');
    subtitle.textContent =
      numTop + ' cluster' + (numTop === 1 ? '' : 's') +
      ' (' + clusterNames + ') \u00b7 ' + rows.length + ' entries' +
      (splitCount > 0 ? ' \u00b7 ' + splitCount + ' split' : '');

    _clusterState = { nonEmpty, alignedAsgns: (_depth > 1 ? alignedAsgns : null) };
    updateSheetPanel();
  }

  function tryRender() {
    if (_rendered) return;
    if (typeof buildRowIndex !== 'function') return;
    if (_cachedEmbedded && _cachedVectors) { doRender(); return; }
    const rows = buildRowIndex(); if (!rows.length) return;

    const preVeced = rows.filter(r => r.vec && r.vec.length);
    if (preVeced.length >= 2) {
      const vectors = new Map();
      preVeced.forEach(r => vectors.set(r.tabIdx+':'+r.rowIdx, r.vec));
      _cachedEmbedded = preVeced; _cachedVectors = vectors;
      requestAnimationFrame(doRender); return;
    }

    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026'); emptyEl.style.display = 'none';
    Promise.all(rows.map(r => {
      const text = (r.row?.cells || r.cells || []).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx+':'+r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map(); results.forEach(res => { if (res?.vec) vectors.set(res.key, res.vec); });
      if (!vectors.size) { setStatus('error', 'No vectors available'); return; }
      const embedded = rows.filter(r => vectors.has(r.tabIdx+':'+r.rowIdx));
      if (embedded.length < 2) { setStatus('error', 'Not enough data'); return; }
      embedded.forEach(r => { r.vec = vectors.get(r.tabIdx+':'+r.rowIdx); });
      _cachedEmbedded = embedded; _cachedVectors = vectors;
      requestAnimationFrame(doRender);
    });
  }

  async function doRender() {
    reclusterBtn.classList.remove('pp-cl-reclustering'); reclusterBtn.textContent = 'Re-cluster';
    setStatus('loading', 'Splitting cells\u2026');
    let workRows = _cachedEmbedded;
    try {
      const split = await splitAllRows(_cachedEmbedded);
      if (split.length > _cachedEmbedded.length) {
        workRows = split;
        setStatus('loading', 'Clustering ' + workRows.length + ' concepts\u2026');
      }
    } catch(e) { console.warn('[clusters] split error:', e); }

    setTimeout(() => {
      try { render(workRows); setStatus('ready', 'Done'); _rendered = true; }
      catch (err) { console.error('[clusters]', err); setStatus('error', 'Clustering failed'); }
    }, 20);
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  window.addEventListener('embedder-ready',    () => setTimeout(tryRender, 120));
  window.addEventListener('embedding-progress', ev => { if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%'); });
  window.addEventListener('embedding-complete', ev => {
    if (!_rendered) { subtitle.textContent = 'Indexed ' + ev.detail.total + ' entries \u2014 building clusters\u2026'; tryRender(); }
  });

  window.addEventListener('df-theme-change', () => { _rendered = false; tryRender(); });

  return {
    reset() {
      _rendered = false; _cachedEmbedded = null; _cachedVectors = null; _clusterState = null;
      Array.from(world.children).forEach(c => c.remove());
      emptyEl.style.display = 'flex';
      _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform();
      hideTooltip();
      sheetBody.innerHTML = '<div class="pp-cl-panel-empty">Clusters will appear here once embeddings finish.</div>';
    }
  };
}
