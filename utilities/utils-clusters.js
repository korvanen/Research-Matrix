// utils-clusters.js — Clusters tool v38
// v37 → v38 changes:
//   • Fixed card width AND height — CARD_W × CARD_H constants, no auto-sizing
//   • Text color mixes now use `black` (not var(--ppc-bg)) — matches concept-map exactly
//   • Cluster drag activates on ANY card hover, not just the header strip
//   • Cluster cannot shrink below the minimum space needed to tile all its cards
//   • makeResizable receives per-nest minW/minH — enforced during resize drag
//   • Drag threshold (4 px) prevents accidental drags on short card clicks
// v38 → v38.1 changes:
//   • buildCard: --ppc-bg now = col.accent (vivid, same as concept-map)
//   • buildCard: --ppc-on now = contrastFor(col.accent) (white/#1a1a1a, same as concept-map)
//   • buildCard: removed manual border-left accent stripe (concept-map doesn't use it)
//   • CSS color-mix expressions in card text/cat/split now driven by --ppc-on/--ppc-bg
// v38.2 fix:
//   • maybySplitRow: removed early-exit guard on EmbeddingUtils so structural split
//     still fires on the fast-path (pre-veced rows from sessionStorage) before
//     EmbeddingUtils is ready. canEmbed flag now only gates per-sentence embedding attempt.
// v38.3 fix:
//   • _embedWithRetry: reduced retries from 10 to 3 (getCachedEmbedding only knows pre-loaded
//     row vectors, not arbitrary user-typed text — endless spinning is now impossible)
//   • _findVecByTextSearch: new fallback that keyword-matches loaded rows and averages their
//     vectors as a proxy, so defined cluster names resolve immediately without a live embedder
// v38.4 fix:
//   • DEF_THRESHOLD replaced by _defThreshold (default 0.40) — a live "Match" slider in the
//     Defined Clusters panel lets the user dial the minimum cosine similarity required for a
//     card to be pulled into a named cluster (0–100 %, shown as a percentage)
//   • Cards that fall below the threshold become orphans and flow into the auto-cluster pool
//     so they always appear in unnamed clusters rather than being forced into a poor fit
//   • Sub-cluster matching inside buildDefinedNest uses the same _defThreshold * 0.8 ratio
console.log('[utils-clusters.js vUNCERTAIN]');

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
  white-space: normal;
  word-break: break-word;
}

/* Status chip */
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

/* Re-cluster button */
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

/* ── Nests — invisible border until hover ──────────────── */
.pp-cl-nest {
  position: absolute;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  display: flex; flex-direction: column;
  overflow: visible;
  box-shadow: none;
  transition: border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base);
  pointer-events: all;
  cursor: grab;
}
.pp-cl-nest:active { cursor: grabbing; }

.pp-cl-nest:hover,
.pp-cl-nest.pp-cl-nest-reveal {
  border-color: var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  box-shadow: var(--md-elev-2);
}
.pp-cl-nest.pp-cl-nest-lifted { box-shadow: var(--md-elev-3); }

.pp-cl-nest-head {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  flex-shrink: 0; user-select: none;
  background: transparent;
  border-bottom: 1px solid transparent;
  opacity: 0;
  transition: opacity var(--transition-base), background var(--transition-base), border-color var(--transition-base);
  pointer-events: none;
}

.pp-cl-nest:hover .pp-cl-nest-head,
.pp-cl-nest.pp-cl-nest-reveal .pp-cl-nest-head {
  opacity: 1;
  background: var(--md-sys-color-surface-container);
  border-bottom-color: var(--md-sys-color-outline-variant);
}

.pp-cl-nest-label {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  min-width: 16px;
}
.pp-cl-nest-dot  { 
  width: 8px; height: 8px; 
  border-radius: 50%; 
  flex-shrink: 0; 
}
.pp-cl-nest-count {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
}

/* ── Nest body: JS masonry — absolute positioned cards ── */
.pp-cl-nest-body {
  position: relative;
  overflow: hidden;
  padding: var(--space-3);
  pointer-events: all;
}

.pp-cl-tile-row { display: contents; }

/* Resize handle */
.pp-cl-resize-handle {
  position: absolute; bottom: 0; right: 0;
  width: 16px; height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--md-sys-color-outline) 50%);
  border-radius: 0 0 var(--radius-sm) 0;
  z-index: 5; opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-cl-nest:hover .pp-cl-resize-handle { opacity: 0.6; }
.pp-cl-nest:hover .pp-cl-resize-handle:hover { opacity: 1; }

/* ── Cards ── */
.pp-cl-card {
  position: absolute;
  width: var(--pp-card-w, 180px);
  box-sizing: border-box;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--ppc-on, var(--md-sys-color-outline-variant)) 15%, var(--ppc-bg, transparent));
  background: var(--ppc-bg, var(--md-sys-color-surface));
  cursor: grab;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
  animation: pp-cl-card-in .22s var(--md-motion-easing-emphasized-decel) both;
}

.pp-cl-card::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--ppc-on, var(--md-sys-color-on-surface));
  opacity: 0;
  transition: opacity var(--transition-fast);
  border-radius: inherit;
  pointer-events: none;
}

.pp-cl-card:hover {
  box-shadow: var(--md-elev-3);
  z-index: 10;
}
.pp-cl-card:hover::before { opacity: var(--md-sys-state-hover-opacity); }

@keyframes pp-cl-card-in {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to   { opacity: 1; transform: none; }
}

.pp-cl-card .pp-cmap-card-cat-num {
  font-family: var(--font-family-serif) !important;
  font-size: 26px !important;
  line-height: 1 !important;
  font-weight: 400 !important;
  font-style: italic !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 92%, var(--ppc-bg, transparent)) !important;
  letter-spacing: -0.02em !important;
  flex: 1 !important;
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.pp-cl-card .pp-cmap-card-level-label {
  font-size: 8px !important;
  font-weight: var(--font-weight-medium) !important;
  letter-spacing: var(--letter-spacing-caps) !important;
  text-transform: uppercase !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 55%, var(--ppc-bg, transparent)) !important;
}
.pp-cl-card .pp-cmap-card-rule {
  height: 1px !important;
  background: color-mix(in srgb, var(--ppc-on, #fff) 22%, var(--ppc-bg, transparent)) !important;
  margin: 8px 14px 0 !important;
  flex-shrink: 0 !important;
  opacity: 1 !important;
}
.pp-cl-card .pp-cl-card-cat {
  font-size: 9px !important;
  font-weight: var(--font-weight-medium) !important;
  letter-spacing: var(--letter-spacing-caps) !important;
  text-transform: uppercase !important;
  margin-bottom: 2px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 60%, var(--ppc-bg, transparent)) !important;
  opacity: 1 !important;
}
.pp-cl-card .pp-cl-card-text {
  font-family: var(--font-family-serif) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  line-height: 1.35 !important;
  letter-spacing: -0.01em !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 92%, var(--ppc-bg, transparent)) !important;
  display: block !important;
  overflow-wrap: break-word !important;
  word-break: break-word !important;
}
.pp-cl-card .pp-cl-card-split {
  font-size: 8px !important;
  font-weight: var(--font-weight-medium) !important;
  letter-spacing: var(--letter-spacing-caps) !important;
  text-transform: uppercase !important;
  margin-top: 4px !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 50%, var(--ppc-bg, transparent)) !important;
  opacity: 1 !important;
}

.pp-cl-card-body {
  padding: 8px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Tooltip ─────────────────────────────────────────────── */
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

/* ── Cluster Spreadsheet Sheet Panel ────────────────────── */
#pp-cl-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface);
  transform: translateX(100%);
  transition: transform .26s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
#pp-cl-sheet.pp-cl-sheet--open {
  transform: translateX(0);
  pointer-events: all;
}

.pp-nav-rail-sheet-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-xs);
  border: none; background: none; cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  margin: 4px auto 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.pp-nav-rail-sheet-btn:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}
.pp-nav-rail-sheet-btn.pp-nav-rail-sheet-btn--active {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

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

/* ── Cluster table ─────────────────────────────────────── */
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
  border-right: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 40%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 60%, transparent);
}
.pp-cl-table th.pp-cl-th-corner {
  position: sticky; left: 0; z-index: 11;
  min-width: 28px; width: 28px;
  text-align: center;
  border-right: 2px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent);
}
.pp-cl-table td {
  padding: var(--space-2);
  vertical-align: top;
  border-right: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 30%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 30%, transparent);
  width: calc(var(--pp-card-w, 225px) + 16px);
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
  border-right: 2px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 50%, transparent);
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

.pp-cl-scard {
  background: var(--ppc-bg, #666) !important;
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.18);
  transition: box-shadow var(--transition-fast), filter var(--transition-fast);
  border: none !important;
  width: var(--pp-card-w, 225px);
  flex-shrink: 0;
}
.pp-cl-scard:last-child { margin-bottom: 0; }
.pp-cl-scard:hover { box-shadow: var(--md-elev-2); filter: brightness(1.07); }

.pp-cl-scard-group-label {
  font-size: 8px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
  padding: 8px 4px 3px;
  margin-top: 4px;
}
.pp-cl-scard-group-label:first-child { padding-top: 2px; margin-top: 0; }

.pp-cl-scard .pp-cl-card-cat {
  font-size: 9px !important; font-weight: 600 !important;
  letter-spacing: .06em !important; text-transform: uppercase !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 60%, var(--ppc-bg, transparent)) !important;
  padding: 7px 10px 0 !important;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pp-cl-scard .pp-cl-card-text {
  font-family: var(--font-family-serif) !important;
  font-size: 12px !important; font-weight: 400 !important; line-height: 1.35 !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 92%, var(--ppc-bg, transparent)) !important;
  padding: 5px 10px 8px !important;
  overflow-wrap: break-word; word-break: break-word;
}
.pp-cl-scard .pp-cl-card-split {
  font-size: 8px !important; font-weight: 700 !important;
  letter-spacing: .06em !important; text-transform: uppercase !important;
  color: color-mix(in srgb, var(--ppc-on, #fff) 50%, var(--ppc-bg, transparent)) !important;
  padding: 0 10px 6px !important;
}

/* ── MD3 Input Chips — confirmed defined clusters ─────────── */
.pp-cl-def-chip {
  display: flex; align-items: center; gap: 0;
  height: 32px; border-radius: 8px;
  border: 1px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container-low);
  margin-bottom: 4px; overflow: hidden;
  position: relative; cursor: default;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.pp-cl-def-chip::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
  pointer-events: none;
}
.pp-cl-def-chip:hover::before { opacity: .06; }
.pp-cl-def-chip-dot {
  width: 8px; height: 8px; border-radius: 50%;
  flex-shrink: 0; margin-left: 8px;
}
.pp-cl-def-chip-label {
  flex: 1; min-width: 0;
  padding: 0 4px 0 8px;
  font-size: var(--font-size-sm); line-height: 1;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pp-cl-def-chip-embedding {
  font-size: 9px; padding-right: 4px; opacity: .5;
  animation: pp-cl-pulse 1.2s ease-in-out infinite;
}
.pp-cl-def-chip-close {
  width: 32px; height: 32px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  border-radius: 0 8px 8px 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.pp-cl-def-chip-close:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
  color: var(--md-sys-color-error);
}
.pp-cl-def-chip-close svg { width: 14px; height: 14px; pointer-events: none; }

/* Sub-chips indent */
.pp-cl-def-sub-row { padding-left: 16px; }
.pp-cl-def-sub-row .pp-cl-def-chip { height: 28px; border-style: dashed; opacity: .85; }

/* Add sub-cluster text button inside chip row */
.pp-cl-def-chip-sub-btn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 24px; margin-left: 16px; margin-bottom: 4px;
  padding: 0 8px 0 4px; border-radius: 12px;
  border: none; background: none; cursor: pointer;
  font-size: 10.5px; font-weight: var(--font-weight-medium);
  letter-spacing: .03em;
  color: var(--md-sys-color-primary);
  transition: background var(--transition-fast);
}
.pp-cl-def-chip-sub-btn:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}
.pp-cl-def-chip-sub-btn svg { width: 12px; height: 12px; }

/* ── MD3 Outlined Text Field — new cluster input ────────────── */
.pp-cl-field-wrap {
  position: relative; margin: 4px 0 6px;
}
.pp-cl-field-outline {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px; height: 40px; border-radius: 4px;
  border: 1px solid var(--md-sys-color-outline);
  background: transparent;
  transition: border-color var(--transition-fast), border-width .1s;
}
.pp-cl-field-wrap:focus-within .pp-cl-field-outline {
  border: 2px solid var(--md-sys-color-primary);
}
.pp-cl-field-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--md-sys-color-outline); flex-shrink: 0;
}
.pp-cl-field-wrap:focus-within .pp-cl-field-dot { background: var(--md-sys-color-primary); }
.pp-cl-field-ta {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font-family); font-size: var(--font-size-sm); line-height: 1.4;
  color: var(--md-sys-color-on-surface);
  resize: none; overflow: hidden; min-height: 20px;
  padding: 10px 0;
}
.pp-cl-field-ta::placeholder { color: var(--md-sys-color-outline); }
.pp-cl-field-label {
  position: absolute; top: 50%; left: 12px; transform: translateY(-50%);
  font-size: var(--font-size-sm); color: var(--md-sys-color-outline);
  pointer-events: none; transition: all .15s;
  background: var(--md-sys-color-surface-container);
  padding: 0 4px; margin-left: -4px; line-height: 1;
}
.pp-cl-field-wrap:focus-within .pp-cl-field-label,
.pp-cl-field-wrap.pp-cl-field-has-val .pp-cl-field-label {
  top: 0; font-size: 10px; color: var(--md-sys-color-primary);
}
.pp-cl-field-hint {
  font-size: 10px; color: var(--md-sys-color-outline);
  padding: 2px 12px 0; letter-spacing: .01em;
}

/* ── MD3 Text Button — "Add defined cluster" ────────────────── */
.pp-cl-add-text-btn {
  display: flex; align-items: center; gap: 6px;
  height: 40px; padding: 0 12px 0 8px;
  border: none; background: none; cursor: pointer;
  border-radius: var(--radius-full);
  color: var(--md-sys-color-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: .01em;
  position: relative; overflow: hidden;
  transition: box-shadow var(--transition-fast);
}
.pp-cl-add-text-btn::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-primary); opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-cl-add-text-btn:hover::before { opacity: .08; }
.pp-cl-add-text-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

/* Defined nest badge */
.pp-cl-nest-defined-badge {
  font-size: 7.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  border-radius: 3px; padding: 1px 4px; margin-left: 2px;
}

/* ── Similarity badge on cards ──────────────────────────────── */
.pp-cl-sim-row {
  display: flex; align-items: center; gap: 4px; margin-top: 7px;
  font-size: 9px; font-weight: 600; letter-spacing: .04em;
  color: color-mix(in srgb, var(--ppc-on, #fff) 55%, var(--ppc-bg, transparent));
}
.pp-cl-sim-arrow { flex-shrink: 0; }
.pp-cl-sim-pct { color: color-mix(in srgb, var(--ppc-on, #fff) 92%, var(--ppc-bg, transparent)); font-weight: 700; font-size: 10px; }
.pp-cl-sim-bar { flex: 1; height: 2px; background: color-mix(in srgb, var(--ppc-on, #fff) 18%, var(--ppc-bg, transparent)); border-radius: 2px; overflow: hidden; min-width: 20px; }
.pp-cl-sim-fill { height: 100%; background: color-mix(in srgb, var(--ppc-on, #fff) 65%, var(--ppc-bg, transparent)); border-radius: 2px; transition: width .4s ease; }
.pp-cl-sim-label { white-space: nowrap; }

/* ── Cluster coherence meter (in nest header) ─────────────── */
.pp-cl-coherence {
  margin-left: auto;
  display: flex; align-items: center; gap: 5px;
  font-size: 9px; font-weight: 700; letter-spacing: .04em;
  opacity: 0.85; flex-shrink: 0;
  cursor: default;
}
.pp-cl-coherence-bar {
  width: 36px; height: 3px; border-radius: 2px;
  background: var(--md-sys-color-outline-variant); overflow: hidden;
}
.pp-cl-coherence-fill {
  height: 100%; border-radius: 2px;
  transition: width .4s ease, background .4s ease;
}
.pp-cl-coherence--tight  .pp-cl-coherence-fill { background: #2e7d5e; }
.pp-cl-coherence--medium .pp-cl-coherence-fill { background: #c8991a; }
.pp-cl-coherence--loose  .pp-cl-coherence-fill { background: #c44035; }
.pp-cl-coherence--tight  .pp-cl-coherence-pct  { color: #2e7d5e; }
.pp-cl-coherence--medium .pp-cl-coherence-pct  { color: #c8991a; }
.pp-cl-coherence--loose  .pp-cl-coherence-pct  { color: #c44035; }
.pp-cl-coherence-pct { font-variant-numeric: tabular-nums; }

/* ── Card uncertainty badges ──────────────────────────────── */
.pp-cl-card-badges {
  display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;
}
.pp-cl-badge {
  font-size: 8px; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; border-radius: 3px;
  padding: 2px 5px; opacity: 0.9; flex-shrink: 0;
}
.pp-cl-badge--boundary {
  background: color-mix(in srgb, #c8991a 18%, transparent);
  color: color-mix(in srgb, #c8991a 90%, var(--ppc-on, #fff));
  border: 1px solid color-mix(in srgb, #c8991a 35%, transparent);
}
.pp-cl-badge--outlier {
  background: color-mix(in srgb, #c44035 15%, transparent);
  color: color-mix(in srgb, #c44035 90%, var(--ppc-on, #fff));
  border: 1px solid color-mix(in srgb, #c44035 30%, transparent);
}

/* ══════════════════════════════════════════════════════════
   Clusters layout — nav rail scrollable on short viewports
   ══════════════════════════════════════════════════════════ */

/* Allow rail to scroll on very short viewports without showing scrollbar */
.pp-nav-rail {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.pp-nav-rail::-webkit-scrollbar { display: none; }

/* Range rows — tighten vertical spacing inside cluster panel */
.pp-range-row {
  min-height: 24px;
  padding-top: 2px;
  padding-bottom: 2px;
}

/* Re-cluster button — full width within padded section */
#pp-cl-recluster {
  margin-top: 4px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

/* Add defined cluster button — flush with section padding */
.pp-cl-add-text-btn {
  height: 32px !important;
  padding-left: 0 !important;
}

/* Defined cluster chips and sub items */
.pp-cl-def-chip        { height: 28px !important; margin-bottom: 3px !important; }
.pp-cl-def-sub-row .pp-cl-def-chip { height: 24px !important; }
.pp-cl-def-chip-sub-btn { height: 20px !important; }

/* Field wrap (new cluster input) — no extra horizontal margin */
.pp-cl-field-wrap { margin-left: 0 !important; margin-right: 0 !important; }
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initClustersTool(paneEl, sidebarEl) {

  const ICON_TABLE =
    '<svg viewBox="0 0 18 16" width="16" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="1" y="1" width="16" height="14" rx="2"/>' +
    '<line x1="1" y1="5" x2="17" y2="5"/>' +
    '<line x1="7" y1="5" x2="7" y2="15"/>' +
    '</svg>';

  const ICON_EXPORT =
    '<svg viewBox="0 0 16 18" width="14" height="16" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M8 1v10M4 7l4 4 4-4"/>' +
    '<path d="M2 13v3h12v-3"/>' +
    '</svg>';

  const nav = window.PPNavRail.create(paneEl, {
    toolName: 'Clusters',
    railExtra:
      '<button class="pp-nav-rail-sheet-btn" id="pp-cl-sheet-btn" title="Toggle cluster table">' +
        ICON_TABLE +
      '</button>' +
      '<button class="pp-nav-rail-sheet-btn" id="pp-cl-export-btn" title="Export to spreadsheet">' +
        ICON_EXPORT +
      '</button>',
    panelSections: [
      {
        label: 'Defined Clusters',
        html:
          '<div id="pp-cl-defs-list"></div>' +
          '<div id="pp-cl-def-field-wrap" class="pp-cl-field-wrap" style="display:none;">' +
            '<div class="pp-cl-field-outline">' +
              '<div class="pp-cl-field-dot" id="pp-cl-field-dot"></div>' +
              '<textarea class="pp-cl-field-ta" id="pp-cl-def-ta" rows="1" ' +
                'placeholder="e.g. Community & governance"></textarea>' +
            '</div>' +
            '<div class="pp-cl-field-hint">Enter \u2192 confirm \u00b7 Esc \u2192 cancel</div>' +
          '</div>' +
          '<button id="pp-cl-def-add-btn" class="pp-cl-add-text-btn">' +
            '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
              '<line x1="9" y1="3" x2="9" y2="15"/><line x1="3" y1="9" x2="15" y2="9"/>' +
            '</svg>' +
            'Add defined cluster' +
          '</button>' +
          '<div class="pp-range-row" title="Minimum cosine similarity for a card to be pulled into a named cluster. Cards below this threshold become orphans and fall through to auto-clusters.">' +
            '<span class="pp-range-label">Match</span>' +
            '<input class="pp-range pp-range--accent" id="pp-cl-defthresh" type="range" min="5" max="95" value="40" step="1">' +
            '<span class="pp-range-val" id="pp-cl-defthresh-val">40%</span>' +
          '</div>',
      },
      {
        label: 'Outer Clusters',
        html:
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Min</span>' +
            '<input class="pp-range" id="pp-cl-omin" type="range" min="2" max="20" value="2" step="1">' +
            '<span class="pp-range-val" id="pp-cl-omin-val">2</span>' +
          '</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Max</span>' +
            '<input class="pp-range" id="pp-cl-omax" type="range" min="2" max="20" value="12" step="1">' +
            '<span class="pp-range-val" id="pp-cl-omax-val">12</span>' +
          '</div>',
      },
      {
        label: 'Inner Clusters',
        html:
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Min</span>' +
            '<input class="pp-range pp-range--muted" id="pp-cl-imin" type="range" min="2" max="12" value="2" step="1">' +
            '<span class="pp-range-val" id="pp-cl-imin-val">2</span>' +
          '</div>' +
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Max</span>' +
            '<input class="pp-range pp-range--muted" id="pp-cl-imax" type="range" min="2" max="12" value="4" step="1">' +
            '<span class="pp-range-val" id="pp-cl-imax-val">4</span>' +
          '</div>',
      },
      {
        label: 'Depth',
        html:
          '<div class="pp-range-row">' +
            '<span class="pp-range-label">Lvl</span>' +
            '<input class="pp-range pp-range--accent" id="pp-cl-depth" type="range" min="1" max="4" value="2" step="1">' +
            '<span class="pp-range-val" id="pp-cl-depth-val">2</span>' +
          '</div>' +
          '<div class="pp-range-row" title="Hard-split cards longer than this. Slide to max to disable.">'+
            '<span class="pp-range-label">Max</span>'+
            '<input class="pp-range pp-range--muted" id="pp-cl-maxlen" type="range" min="100" max="2000" value="2000" step="50">'+
            '<span class="pp-range-val" id="pp-cl-maxlen-val">Off</span>'+
          '</div>' +
          '<button id="pp-cl-recluster" style="margin-top:4px">Re-cluster</button>',
      },
    ],
  });

  nav.mainEl.innerHTML =
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

  nav.statusEl.innerHTML =
    '<div id="pp-cl-status" class="cl-loading">' +
      '<div class="pp-cl-dot"></div><span id="pp-cl-label">Embeddings loading\u2026</span>' +
    '</div>';

  const subtitle     = nav.subtitleEl;
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
  const maxLenSlider = paneEl.querySelector('#pp-cl-maxlen'), maxLenVal = paneEl.querySelector('#pp-cl-maxlen-val');

  const CARD_W         = 225;
  const CARD_GAP       = 8;
  const BODY_PAD       = 12;
  const HEAD_H         = 40;
  const NEST_GAP       = 20;
  const DRAG_DELAY     = 600;
  const DRAG_THRESHOLD = 4;

  let _outerMin=2, _outerMax=12, _innerMin=2, _innerMax=4, _depth=2, _maxCardLen=0; // 0 = disabled
  let _rendered=false, _ttRow=null;
  let _cachedEmbedded=null, _cachedVectors=null;
  let _reclusterTimer=null;
  let _panX=0, _panY=0, _zoom=1;
  let _topZ=10;
  let _clusterState=null;

  // ── Defined clusters ──────────────────────────────────────
  let _definedClusters = []; // [{id, desc, vec, color, subClusters:[{id,desc,vec}]}]
  let _defNextId = 0;
  let _defThreshold = 0.40; // adjustable via Match slider; cards below this sim → orphan auto-clusters
  const DEF_COLORS = ['#2e7d5e','#4a56c8','#5e3d9e','#c44035','#c8991a','#3d7a6b','#7d5a1e','#4a8aa8'];

  const defsList    = paneEl.querySelector('#pp-cl-defs-list');
  const defAddBtn   = paneEl.querySelector('#pp-cl-def-add-btn');
  const defFieldWrap = paneEl.querySelector('#pp-cl-def-field-wrap');
  const defTa       = paneEl.querySelector('#pp-cl-def-ta');
  const defThreshSlider = paneEl.querySelector('#pp-cl-defthresh');
  const defThreshVal    = paneEl.querySelector('#pp-cl-defthresh-val');

  if (typeof upgradeSlider === 'function' && defThreshSlider) upgradeSlider(defThreshSlider);

  function syncDefThreshold() {
    _defThreshold = +defThreshSlider.value / 100;
    defThreshVal.textContent = defThreshSlider.value + '%';
  }
  defThreshSlider.addEventListener('input', () => {
    syncDefThreshold();
    if (!_cachedEmbedded) return;
    clearTimeout(_reclusterTimer);
    _reclusterTimer = setTimeout(() => { _rendered = false; tryRender(); }, DRAG_DELAY);
  });
  defThreshSlider.addEventListener('change', () => {
    syncDefThreshold();
    if (!_cachedEmbedded) return;
    clearTimeout(_reclusterTimer); _rendered = false; tryRender();
  });

  function defColorFor(idx) { return DEF_COLORS[idx % DEF_COLORS.length]; }
  function defAutoResize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function escDefHtml(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── MD3 Input Chip rendering ──────────────────────────────
  function makeChip(label, dotColor, isEmbedding, onClose) {
    const chip = document.createElement('div');
    chip.className = 'pp-cl-def-chip';
    const dot = document.createElement('div');
    dot.className = 'pp-cl-def-chip-dot';
    dot.style.background = dotColor;
    const lbl = document.createElement('span');
    lbl.className = 'pp-cl-def-chip-label';
    lbl.textContent = label;
    chip.appendChild(dot);
    chip.appendChild(lbl);
    if (isEmbedding) {
      const spin = document.createElement('span');
      spin.className = 'pp-cl-def-chip-embedding';
      spin.title = 'Computing embedding\u2026';
      spin.textContent = '\u23f3';
      chip.appendChild(spin);
    }
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pp-cl-def-chip-close';
    closeBtn.title = 'Remove';
    closeBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>';
    closeBtn.addEventListener('click', onClose);
    chip.appendChild(closeBtn);
    return chip;
  }

  function renderDefPanel() {
    defsList.innerHTML = '';
    _definedClusters.forEach((def, di) => {
      const item = document.createElement('div');

      // Parent chip
      const chip = makeChip(
        def.desc,
        def.color,
        !def.vec,
        (e) => { e.stopPropagation(); _definedClusters = _definedClusters.filter(d => d.id !== def.id); renderDefPanel(); scheduleRerender(); }
      );
      item.appendChild(chip);

      // Sub-clusters
      if (def.subClusters && def.subClusters.length) {
        def.subClusters.forEach((sub, si) => {
          const subWrap = document.createElement('div');
          subWrap.className = 'pp-cl-def-sub-row';
          const subChip = makeChip(
            sub.desc,
            def.color,
            !sub.vec,
            (e) => { e.stopPropagation(); def.subClusters = def.subClusters.filter(s => s.id !== sub.id); renderDefPanel(); scheduleRerender(); }
          );
          subWrap.appendChild(subChip);
          item.appendChild(subWrap);
        });
      }

      // Add sub-cluster text button (small, below chips)
      const subBtn = document.createElement('button');
      subBtn.className = 'pp-cl-def-chip-sub-btn';
      subBtn.innerHTML =
        '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>' +
        'Add sub-cluster';
      subBtn.addEventListener('click', () => startAddSub(def.id));
      item.appendChild(subBtn);

      defsList.appendChild(item);
    });
  }

  // ── Inline sub-cluster input (reuses the same field) ─────
  let _activeSub = null; // {defId}

  function startAddDef() {
    _activeSub = null;
    defFieldWrap.style.display = 'block';
    defAddBtn.style.display = 'none';
    defTa.value = '';
    defTa.style.height = '';
    // Update dot color to next def color
    const dot = defFieldWrap.querySelector('.pp-cl-field-dot');
    if (dot) dot.style.background = defColorFor(_definedClusters.length);
    setTimeout(() => defTa.focus(), 0);
  }

  function startAddSub(defId) {
    _activeSub = { defId };
    defFieldWrap.style.display = 'block';
    defAddBtn.style.display = 'none';
    defTa.value = '';
    defTa.style.height = '';
    const def = _definedClusters.find(d => d.id === defId);
    const dot = defFieldWrap.querySelector('.pp-cl-field-dot');
    if (dot && def) dot.style.background = def.color;
    setTimeout(() => defTa.focus(), 0);
  }

  function cancelAddField() {
    defFieldWrap.style.display = 'none';
    defAddBtn.style.display = '';
    _activeSub = null;
  }

  function commitField() {
    const desc = defTa.value.trim();
    cancelAddField();
    if (!desc) return;
    if (_activeSub) {
      const def = _definedClusters.find(d => d.id === _activeSub.defId);
      if (!def) return;
      const sub = { id: _defNextId++, desc, vec: null };
      def.subClusters.push(sub);
      renderDefPanel();
      _embedWithRetry(sub);
    } else {
      const color = defColorFor(_definedClusters.length);
      const def = { id: _defNextId++, desc, vec: null, color, subClusters: [] };
      _definedClusters.push(def);
      renderDefPanel();
      _embedWithRetry(def);
    }
  }

  // ── Robust embedding with retries ─────────────────────────
  async function _tryEmbed(text) {
    if (!window.EmbeddingUtils) return null;
    if (typeof window.EmbeddingUtils.getCachedEmbedding === 'function') {
      try {
        const v = await window.EmbeddingUtils.getCachedEmbedding(text);
        if (v && v.length) return v;
      } catch(e) { /* fall through */ }
    }
    for (const m of ['embed', 'getEmbedding', 'computeEmbedding', 'embedText']) {
      if (typeof window.EmbeddingUtils[m] === 'function') {
        try {
          const v = await window.EmbeddingUtils[m](text);
          if (v && v.length) return v;
        } catch(e) { /* fall through */ }
      }
    }
    return null;
  }

  // ── v38.3: keyword-based vector fallback ──────────────────
  // When getCachedEmbedding can't produce a vector for user-typed text
  // (it only knows pre-loaded row vectors), find the closest rows by
  // keyword overlap and average their vectors as a semantic proxy.
  function _findVecByTextSearch(text) {
    const rows = (typeof buildRowIndex === 'function') ? buildRowIndex() : [];
    const veced = rows.filter(r => r.vec && r.vec.length);
    if (!veced.length) return null;

    const keywords = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (!keywords.length) return avgVec(veced.slice(0, 20).map(r => r.vec));

    const scored = veced.map(r => {
      const cells = r.row && r.row.cells ? r.row.cells : (r.cells || []);
      const rowText = cells.join(' ').toLowerCase();
      const score = keywords.reduce((s, kw) => s + (rowText.includes(kw) ? 1 : 0), 0);
      return { r, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // If nothing matches by keyword, fall back to global centroid
    const pool = scored.length ? scored.map(x => x.r) : veced.slice(0, 20);
    return avgVec(pool.map(r => r.vec));
  }

  // ── v38.3: max 3 retries then keyword fallback ────────────
  function _embedWithRetry(target, attempt) {
    attempt = attempt || 0;
    if (target.vec) return;

    _tryEmbed(target.desc).then(vec => {
      if (vec) {
        target.vec = vec;
        console.log('[clusters] embedded "' + target.desc.slice(0, 40) + '" via embedder on attempt ' + attempt);
        renderDefPanel();
        scheduleRerender();
      } else if (attempt < 3) {
        // Only retry a few times — getCachedEmbedding only knows pre-loaded row vectors
        const delay = 400 + attempt * 400;
        setTimeout(() => _embedWithRetry(target, attempt + 1), delay);
      } else {
        // Fallback: approximate via keyword-matching rows in the loaded data
        const fallbackVec = _findVecByTextSearch(target.desc);
        if (fallbackVec) {
          target.vec = fallbackVec;
          target._vecApproximate = true;
          console.log('[clusters] using text-search fallback vec for "' + target.desc.slice(0, 40) + '"');
          renderDefPanel();
          scheduleRerender();
        } else {
          console.warn('[clusters] no vector found for defined cluster: ' + target.desc);
        }
      }
    });
  }

  function scheduleRerender() {
    _rendered = false;
    clearTimeout(_reclusterTimer);
    _reclusterTimer = setTimeout(() => { _rendered = false; tryRender(); }, 300);
  }

  // Wire up text field events
  defAddBtn.addEventListener('click', startAddDef);
  defTa.addEventListener('input', () => {
    defAutoResize(defTa);
    const wrap = defFieldWrap;
    if (wrap) wrap.classList.toggle('pp-cl-field-has-val', defTa.value.trim().length > 0);
  });
  defTa.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitField(); }
    if (e.key === 'Escape') { cancelAddField(); }
  });
  document.addEventListener('click', (e) => {
    if (defFieldWrap.style.display === 'none') return;
    if (defFieldWrap.contains(e.target) || defAddBtn.contains(e.target)) return;
    setTimeout(commitField, 0);
  });

  (function setCSSCardDims() {
    document.documentElement.style.setProperty('--pp-card-w', CARD_W + 'px');
  })();

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
    _maxCardLen = +maxLenSlider.value >= 2000 ? 0 : +maxLenSlider.value;
    maxLenVal.textContent = _maxCardLen === 0 ? 'Off' : _maxCardLen;
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

  [oMinSlider, oMaxSlider, iMinSlider, iMaxSlider, depthSlider, maxLenSlider].forEach(s => {
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

  // ── Sheet panel ───────────────────────────────────────────
  const sheetEl = document.createElement('div');
  sheetEl.id = 'pp-cl-sheet';
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
  sheetBody.addEventListener('wheel', ev => ev.stopPropagation(), { passive: true });
  sheetEl.appendChild(sheetPHead);
  sheetEl.appendChild(sheetBody);
  nav.mainEl.appendChild(sheetEl);

  const sheetBtn = paneEl.querySelector('#pp-cl-sheet-btn');
  let _sheetOpen = false;
  function setSheetOpen(open) {
    _sheetOpen = open;
    sheetEl.classList.toggle('pp-cl-sheet--open', open);
    sheetBtn.classList.toggle('pp-nav-rail-sheet-btn--active', open);
  }
  sheetBtn.addEventListener('click', () => setSheetOpen(!_sheetOpen));

  // ── Export ────────────────────────────────────────────────
  const exportBtn = paneEl.querySelector('#pp-cl-export-btn');

  function exportToXlsx() {
    if (!_clusterState || !_clusterState.nonEmpty || !_clusterState.nonEmpty.length) return;
    const { nonEmpty } = _clusterState;
    const entries = [];
    function collectEntries(rows, prefixLbl, remainingDepth) {
      if (remainingDepth <= 0 || rows.length < 2) {
        rows.forEach(r => {
          const cells  = r.row && r.row.cells ? r.row.cells : (r.cells || []);
          const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
          const best   = cells.reduce((b, c) => c.length > b.length ? c : b, '');
          const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
          entries.push({ outerLbl: prefixLbl.replace(/[0-9.]+$/, '') || prefixLbl, subLbl: prefixLbl, text: (parsed.body || best).trim(), cats: cats.join(', ') });
        });
        return;
      }
      const asgn = autoCluster(rows, _innerMin, _innerMax);
      const numGroups = Math.max(...asgn, 0) + 1;
      if (numGroups <= 1) { collectEntries(rows, prefixLbl, 0); return; }
      const groups = Array.from({ length: numGroups }, () => []);
      rows.forEach((r, i) => groups[asgn[i]].push(r));
      groups.forEach((grp, si) => { if (grp.length) collectEntries(grp, subLabel(prefixLbl, si), remainingDepth - 1); });
    }
    nonEmpty.forEach((members, ci) => collectEntries(members, outerLabel(ci), _depth - 1));
    entries.sort((a, b) => a.subLbl < b.subLbl ? -1 : a.subLbl > b.subLbl ? 1 : 0);
    const hasCats = entries.some(e => e.cats);
    const headers = ['#', 'Cluster', 'Sub-cluster', 'Text', ...(hasCats ? ['Categories'] : [])];
    const aoa = [headers, ...entries.map((e, i) => [i + 1, e.outerLbl, e.subLbl, e.text, ...(hasCats ? [e.cats] : [])])];
    if (window.XLSX) {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 14 }, { wch: 72 }, ...(hasCats ? [{ wch: 28 }] : [])];
      window.XLSX.utils.book_append_sheet(wb, ws, 'Clusters');
      window.XLSX.writeFile(wb, 'clusters.xlsx');
    } else {
      const csv = aoa.map(row => row.map(cell => { const s = String(cell ?? '').replace(/"/g, '""'); return /[,"\n]/.test(s) ? '"' + s + '"' : s; }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clusters.csv'; a.click(); URL.revokeObjectURL(a.href);
    }
  }
  exportBtn.addEventListener('click', () => {
    if (!_clusterState) return;
    exportBtn.style.opacity = '0.4';
    setTimeout(() => { exportBtn.style.opacity = ''; }, 400);
    exportToXlsx();
  });

  function buildSheetCard(r, col) {
    const cells  = r.row && r.row.cells ? r.row.cells : (r.cells || []);
    const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const best   = cells.reduce((b, c) => c.length > b.length ? c : b, '');
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
    const on     = contrastFor(col.accent);
    const card = document.createElement('div');
    card.className = 'pp-cl-scard';
    card.style.setProperty('--ppc-bg', col.accent);
    card.style.setProperty('--ppc-on', on);
    card.style.background = col.accent;
    if (cats.length) { const ce = document.createElement('div'); ce.className = 'pp-cl-card-cat'; ce.textContent = cats.join(' · '); card.appendChild(ce); }
    const te = document.createElement('div'); te.className = 'pp-cl-card-text'; te.textContent = parsed.body || best; card.appendChild(te);
    if (r._splitFrom) { const sp = document.createElement('div'); sp.className = 'pp-cl-card-split'; sp.textContent = r._splitN + '/' + r._splitT + ' Split'; card.appendChild(sp); }
    card.addEventListener('click', () => { if (typeof panelGoTo === 'function') panelGoTo(r, 0); });
    return card;
  }

  function renderSheetGroup(container, rows, prefixLbl, remainingDepth, col) {
    if (remainingDepth <= 0 || rows.length < 2) { rows.forEach(r => container.appendChild(buildSheetCard(r, col))); return; }
    const asgn = autoCluster(rows, _innerMin, _innerMax);
    const numGroups = Math.max(...asgn, 0) + 1;
    if (numGroups <= 1) { rows.forEach(r => container.appendChild(buildSheetCard(r, col))); return; }
    const groups = Array.from({ length: numGroups }, () => []);
    rows.forEach((r, i) => groups[asgn[i]].push(r));
    groups.forEach((members, si) => {
      if (!members.length) return;
      const lbl = subLabel(prefixLbl, si); const subCol = colForIndex(si);
      const hdr = document.createElement('div'); hdr.className = 'pp-cl-scard-group-label'; hdr.textContent = lbl; hdr.style.color = subCol.accent; container.appendChild(hdr);
      renderSheetGroup(container, members, lbl, remainingDepth - 1, subCol);
    });
  }

  function updateSheetPanel() {
    if (!_clusterState) return;
    const { nonEmpty, alignedAsgns, definedGroups } = _clusterState;

    const cols = [];

    (definedGroups || []).forEach(({ def, members }) => {
      if (!members.length) return;
      const col = { accent: def.color, bg: def.color + '18', label: contrastFor(def.color) };
      let groups;
      if (_depth >= 2 && members.length >= 2) {
        const asgn = autoCluster(members, _innerMin, _innerMax);
        const numSub = Math.max(...asgn, 0) + 1;
        groups = Array.from({ length: numSub }, () => []);
        members.forEach((r, i) => groups[asgn[i]].push(r));
      } else {
        groups = [members.slice()];
      }
      cols.push({ outerLbl: def.desc, col, groups, isDefined: true });
    });

    (nonEmpty || []).forEach((members, ci) => {
      const outerLbl = outerLabel(ci);
      const col = colForIndex(ci);
      let groups;
      if (_depth >= 2 && members.length >= 2) {
        const asgn = autoCluster(members, _innerMin, _innerMax);
        const numSub = Math.max(...asgn, 0) + 1;
        groups = Array.from({ length: numSub }, () => []);
        members.forEach((r, i) => groups[asgn[i]].push(r));
      } else {
        groups = [members.slice()];
      }
      cols.push({ outerLbl, col, groups, isDefined: false });
    });

    if (!cols.length) { sheetBody.innerHTML = '<div class="pp-cl-panel-empty">No clusters yet.</div>'; return; }

    const maxRows = Math.max(...cols.map(c => c.groups.length));
    sheetDesc.textContent = cols.length + ' col · ' + maxRows + ' row' + (maxRows === 1 ? '' : 's');
    const table = document.createElement('table'); table.className = 'pp-cl-table';
    const thead = document.createElement('thead'); const hrow = document.createElement('tr');
    const thC = document.createElement('th'); thC.className = 'pp-cl-th-corner'; thC.textContent = '#'; hrow.appendChild(thC);
    cols.forEach(c => {
      const th = document.createElement('th');
      th.style.color = c.col.accent;
      th.style.borderTop = '3px solid ' + c.col.accent;
      if (c.isDefined) {
        th.innerHTML =
          '<span style="font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
            'background:' + c.col.accent + '22;color:' + c.col.accent + ';border-radius:3px;padding:1px 4px;margin-right:4px;">' +
            'defined</span>' + escDefHtml(c.outerLbl);
      } else {
        th.textContent = c.outerLbl + ' cluster';
      }
      hrow.appendChild(th);
    });
    thead.appendChild(hrow); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (let ri = 0; ri < maxRows; ri++) {
      const tr = document.createElement('tr');
      const tdLbl = document.createElement('td'); tdLbl.className = 'pp-cl-td-rowlabel'; tdLbl.textContent = ri + 1; tr.appendChild(tdLbl);
      cols.forEach(c => {
        const td = document.createElement('td'); const members = c.groups[ri] || [];
        if (!members.length) { td.className = 'pp-cl-td-empty'; td.textContent = '—'; }
        else { const rowLbl = c.isDefined ? c.outerLbl : subLabel(c.outerLbl, ri); renderSheetGroup(td, members, rowLbl, _depth - 2, c.col); }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody); sheetBody.innerHTML = ''; sheetBody.appendChild(table);
  }

  // ── Canvas pan ────────────────────────────────────────────
  let _panning=false, _panSX=0, _panSY=0, _panBX=0, _panBY=0;
  canvas.addEventListener('mousedown', ev => { if (ev.button !== 2) return; _panning=true; _panSX=ev.clientX; _panSY=ev.clientY; _panBX=_panX; _panBY=_panY; canvas.classList.add('pp-cl-panning'); ev.preventDefault(); });
  document.addEventListener('mousemove', ev => { if (!_panning) return; _panX=_panBX+ev.clientX-_panSX; _panY=_panBY+ev.clientY-_panSY; applyWorldTransform(); });
  document.addEventListener('mouseup', ev => { if (ev.button !== 2 || !_panning) return; _panning=false; canvas.classList.remove('pp-cl-panning'); });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    if (ev.ctrlKey || (Math.abs(ev.deltaY) >= 50 && Math.abs(ev.deltaX) < 50)) {
      const dz = ev.deltaY > 0 ? 0.94 : 1 / 0.94; const nz = Math.max(0.15, Math.min(4, _zoom * dz));
      _panX = mx - (mx - _panX) * nz / _zoom; _panY = my - (my - _panY) * nz / _zoom; _zoom = nz;
    } else { _panX -= ev.deltaX; _panY -= ev.deltaY; }
    applyWorldTransform();
  }, { passive: false });

  let _pinchD=null, _touchMidX=0, _touchMidY=0;
  canvas.addEventListener('touchstart', ev => { if (ev.touches.length === 2) { _pinchD = Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX, ev.touches[0].clientY-ev.touches[1].clientY); _touchMidX = (ev.touches[0].clientX+ev.touches[1].clientX)/2; _touchMidY = (ev.touches[0].clientY+ev.touches[1].clientY)/2; } }, { passive: true });
  canvas.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 2 || !_pinchD) return; ev.preventDefault();
    const mx = (ev.touches[0].clientX+ev.touches[1].clientX)/2; const my = (ev.touches[0].clientY+ev.touches[1].clientY)/2;
    const d = Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX, ev.touches[0].clientY-ev.touches[1].clientY);
    const rect = canvas.getBoundingClientRect(); const cmx = mx-rect.left, cmy = my-rect.top;
    const nz = Math.max(0.15, Math.min(4, _zoom * d / _pinchD));
    _panX = cmx-(cmx-_panX)*nz/_zoom; _panY = cmy-(cmy-_panY)*nz/_zoom; _zoom = nz; _pinchD = d;
    _panX += mx-_touchMidX; _panY += my-_touchMidY; _touchMidX = mx; _touchMidY = my;
    applyWorldTransform();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { _pinchD = null; });

  // ── Nest dragging ─────────────────────────────────────────
  let _nestDrag = null;
  function makeNestDraggable(nestEl) {
    nestEl.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.pp-cl-resize-handle')) return;
      const sx = parseInt(nestEl.style.left) || 0; const sy = parseInt(nestEl.style.top) || 0;
      _nestDrag = { el: nestEl, sx, sy, cx: ev.clientX, cy: ev.clientY, moved: false };
    });
    const head = nestEl.querySelector(':scope > .pp-cl-nest-head');
    if (head) {
      head.addEventListener('touchstart', ev => {
        if (ev.touches.length !== 1 || ev.target.closest('.pp-cl-resize-handle')) return;
        ev.stopPropagation();
        const sx = parseInt(nestEl.style.left) || 0; const sy = parseInt(nestEl.style.top) || 0;
        _nestDrag = { el: nestEl, sx, sy, cx: ev.touches[0].clientX, cy: ev.touches[0].clientY, moved: false };
        nestEl.style.zIndex = String(++_topZ); nestEl.classList.add('pp-cl-nest-lifted'); hideTooltip();
      }, { passive: false });
    }
  }
  document.addEventListener('mousemove', ev => {
    if (!_nestDrag) return;
    const dx = ev.clientX - _nestDrag.cx; const dy = ev.clientY - _nestDrag.cy;
    if (!_nestDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!_nestDrag.moved) { _nestDrag.moved = true; _nestDrag.el.style.zIndex = String(++_topZ); _nestDrag.el.classList.add('pp-cl-nest-lifted'); hideTooltip(); }
    _nestDrag.el.style.left = (_nestDrag.sx + dx / _zoom) + 'px';
    _nestDrag.el.style.top  = (_nestDrag.sy + dy / _zoom) + 'px';
  });
  document.addEventListener('mouseup', () => { if (!_nestDrag) return; _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null; });
  document.addEventListener('touchmove', ev => {
    if (!_nestDrag || ev.touches.length !== 1) return;
    const dx = ev.touches[0].clientX - _nestDrag.cx; const dy = ev.touches[0].clientY - _nestDrag.cy;
    _nestDrag.el.style.left = (_nestDrag.sx + dx / _zoom) + 'px'; _nestDrag.el.style.top = (_nestDrag.sy + dy / _zoom) + 'px';
    ev.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => { if (!_nestDrag) return; _nestDrag.el.classList.remove('pp-cl-nest-lifted'); _nestDrag = null; });

  // ── Resize handle ─────────────────────────────────────────
  function makeResizable(nestEl, cardCount) {
    const handle = document.createElement('div'); handle.className = 'pp-cl-resize-handle'; nestEl.appendChild(handle);
    const minW = CARD_W + BODY_PAD * 2; let minH = 0;
    let resizing = false, sw = 0, sh = 0, sx = 0, sy = 0, lastCols = -1;
    nestEl._setMasonryMinH = function(h) { minH = HEAD_H + h + BODY_PAD * 2; };
    handle.addEventListener('mousedown', ev => { resizing = true; sw = nestEl.offsetWidth; sh = nestEl.offsetHeight; sx = ev.clientX; sy = ev.clientY; lastCols = colsFromWidth(nestEl); nestEl.style.height = sh + 'px'; ev.stopPropagation(); ev.preventDefault(); });
    document.addEventListener('mousemove', ev => {
      if (!resizing) return;
      const newW = Math.max(minW, sw + (ev.clientX - sx) / _zoom); const newH = Math.max(minH || sh, sh + (ev.clientY - sy) / _zoom);
      const newCols = Math.max(1, Math.min(Math.floor((newW - BODY_PAD * 2 + CARD_GAP) / (CARD_W + CARD_GAP)), cardCount));
      nestEl.style.width = newW + 'px'; nestEl.style.height = newH + 'px';
      if (newCols !== lastCols) { const { contentH } = doMasonry(nestEl, true); nestEl._setMasonryMinH(contentH); lastCols = newCols; }
    });
    document.addEventListener('mouseup', () => { resizing = false; lastCols = -1; });
  }

  // ── Tooltip ───────────────────────────────────────────────
  function showTooltip(ev, r, accentColor, clusterLabel) {
    _ttRow = r; ttCluster.textContent = clusterLabel || ''; ttCluster.style.color = accentColor;
    ttText.style.display = 'none'; ttGoto.style.color = accentColor;
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

  // ── Utilities ─────────────────────────────────────────────

  // Abbreviations that end with "." but are NOT sentence boundaries
  const _ABBREV = new Set([
    'mr','mrs','ms','dr','prof','sr','jr','vs','etc','approx','est','dept',
    'fig','no','vol','pp','ed','eds','ibid','op','cf','al','et','e.g','i.e',
    'jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec',
    'st','ave','blvd','co','corp','inc','ltd','govt','univ','assoc',
  ]);

  function sentenceSplit(text) {
    // Scan character-by-character for real sentence endings.
    // A period/!/? is a sentence boundary only when:
    //   1. Followed by whitespace then an uppercase letter
    //   2. Not preceded by a known abbreviation
    //   3. Not preceded by a single capital letter (initials: "J. Smith")
    //   4. Not preceded by a digit (decimals / numbered lists: "3. The")
    const sentences = [];
    let start = 0;
    const t = text.replace(/\r\n|\r/g, '\n');

    for (let i = 0; i < t.length; i++) {
      const ch = t[i];

      // Blank line = definite paragraph break
      if (ch === '\n' && t[i + 1] === '\n') {
        const seg = t.slice(start, i).trim();
        if (seg.length >= 60) sentences.push(seg);
        while (i + 1 < t.length && t[i + 1] === '\n') i++;
        start = i + 1;
        continue;
      }

      if (ch !== '.' && ch !== '!' && ch !== '?') continue;

      // Must be followed by whitespace then an uppercase letter
      const after = t.slice(i + 1).match(/^(\s+)([A-Z])/);
      if (!after) continue;

      // Word before the punctuation
      const wordBefore = t.slice(0, i).match(/(\b\w+)$/);
      if (wordBefore) {
        const w = wordBefore[1];
        if (_ABBREV.has(w.toLowerCase())) continue;
        if (w.length === 1 && w === w.toUpperCase()) continue;
      }

      // Skip digit before period (decimals, numbered items)
      if (/\d$/.test(t.slice(0, i))) continue;

      const seg = t.slice(start, i + 1).trim();
      if (seg.length >= 60) sentences.push(seg);
      start = i + 1 + after[1].length;
    }

    const last = t.slice(start).trim();
    if (last.length >= 60) sentences.push(last);

    return sentences;
  }

    function avgVec(vecs) {
    const valid = vecs.filter(Boolean); if (!valid.length) return null;
    const dim = valid[0].length, sum = new Float32Array(dim);
    valid.forEach(v => v.forEach((x, i) => { sum[i] += x; }));
    return Array.from(sum).map(x => x / valid.length);
  }

  async function maybySplitRow(row) {
    // Without embeddings we cannot judge semantic distance — never split blindly
    if (!window.EmbeddingUtils || typeof window.EmbeddingUtils.getCachedEmbedding !== 'function') return [row];

    const cells = row.row && row.row.cells ? row.row.cells : (row.cells || []);
    const cats  = row.row && row.row.cats  ? row.row.cats.filter(c => c.trim()) : [];
    let bestText = '', bestIdx = 0;
    cells.forEach((c, i) => { if (c.trim().length > bestText.length) { bestText = c.trim(); bestIdx = i; } });
    if (bestText.length < 150) return [row];

    const segments = sentenceSplit(bestText);
    // Require at least 3 distinct sentences — two sentences in a cell almost
    // always share a topic and should stay together
    if (segments.length < 3) return [row];

    const catStr = cats.join(' · ') || 'Cell';

    let segVecs;
    try { segVecs = await Promise.all(segments.map(s => window.EmbeddingUtils.getCachedEmbedding(s))); }
    catch(e) { return [row]; }

    const valid = segments
      .map((s, i) => ({ text: s, vec: segVecs[i] }))
      .filter(x => x.vec && x.vec.length);

    // Still need at least 3 embedded segments
    if (valid.length < 3) return [row];

    // Group sentences by semantic proximity.
    // SPLIT_THRESHOLD 0.45: segments in the same group must have cos-sim >= 0.45.
    // Lower = harder to split (more gets merged into one group).
    const SPLIT_THRESHOLD = 0.45;
    const n = valid.length;
    const sim = Array.from({length: n}, (_, i) =>
      Array.from({length: n}, (_, j) => i === j ? 1 : cosineSim(valid[i].vec, valid[j].vec)));

    const groupOf = new Array(n).fill(-1); let numGroups = 0;
    for (let i = 0; i < n; i++) {
      if (groupOf[i] !== -1) continue;
      const g = numGroups++; groupOf[i] = g;
      for (let j = i + 1; j < n; j++) {
        if (groupOf[j] !== -1) continue;
        const membersOfG = valid.map((_, k) => k).filter(k => groupOf[k] === g);
        if (membersOfG.every(k => sim[k][j] >= SPLIT_THRESHOLD)) groupOf[j] = g;
      }
    }
    if (numGroups <= 1) return [row];

    const groups = Array.from({length: numGroups}, () => []);
    valid.forEach((seg, i) => groups[groupOf[i]].push(seg)); // pushed exactly once

    // Abort split if any group would be too thin to be meaningful
    if (groups.some(g => g.reduce((sum, s) => sum + s.text.length, 0) < 60)) return [row];

    return groups.map((segs, ni) => ({
      tabIdx: row.tabIdx, rowIdx: row.rowIdx,
      headers: row.headers || [], title: row.title || '',
      kws: row.kws || new Set(),
      _splitFrom: catStr, _splitN: ni + 1, _splitT: numGroups,
      vec: avgVec(segs.map(s => s.vec)),
      row: { cells: cells.map((c, ci) => ci === bestIdx ? segs.map(s => s.text).join(' ') : c), cats }
    }));
  }

  async function splitAllRows(rows) {
    const result = [];
    for (const row of rows) { const parts = await maybySplitRow(row); parts.forEach(r => result.push(r)); }
    return result;
  }

  // Semantic length-cap split: if a card exceeds _maxCardLen, split it using
  // proper sentence boundaries + embeddings. Sentences are grouped greedily by
  // cosine similarity; any group that still exceeds the cap is further divided
  // at sentence boundaries (never mid-sentence, never mid-word).
  async function hardSplitByLength(rows) {
    if (!_maxCardLen) return rows; // slider at max = disabled

    const canEmbed = window.EmbeddingUtils &&
      typeof window.EmbeddingUtils.getCachedEmbedding === 'function';

    const result = [];
    for (const row of rows) {
      const cells = row.row && row.row.cells ? row.row.cells : (row.cells || []);
      const cats  = row.row && row.row.cats  ? row.row.cats  : [];
      let bestIdx = 0;
      cells.forEach((c, i) => {
        if (c.trim().length > cells[bestIdx].trim().length) bestIdx = i;
      });
      const text = cells[bestIdx].trim();

      if (text.length <= _maxCardLen) { result.push(row); continue; }

      // Split into proper sentences
      const sentences = sentenceSplit(text);

      // If sentenceSplit produced nothing useful (e.g. one giant run-on),
      // fall back to word-boundary chunks as a last resort
      if (sentences.length <= 1) {
        const chunks = wordBoundaryChunk(text, _maxCardLen);
        if (chunks.length <= 1) { result.push(row); continue; }
        const catStr = cats.filter(c => c.trim()).join(' · ') || 'Cell';
        chunks.forEach((chunk, ni) => {
          result.push(makeRow(row, cells, cats, bestIdx, chunk, catStr, ni, chunks.length, row.vec));
        });
        continue;
      }

      // Embed each sentence if possible
      let segs;
      if (canEmbed) {
        try {
          const vecs = await Promise.all(
            sentences.map(s => window.EmbeddingUtils.getCachedEmbedding(s))
          );
          segs = sentences.map((s, i) => ({ text: s, vec: vecs[i] }));
        } catch(e) { segs = sentences.map(s => ({ text: s, vec: null })); }
      } else {
        segs = sentences.map(s => ({ text: s, vec: null }));
      }

      // Greedy grouping: merge adjacent sentences that are semantically close
      // AND where adding the next sentence keeps the group under the cap.
      const SIM_MERGE = 0.50; // similarity above which we prefer to merge
      const groups = []; // each group = array of segs
      let current = [segs[0]];

      for (let i = 1; i < segs.length; i++) {
        const next = segs[i];
        const currentText = current.map(s => s.text).join(' ');
        const wouldFit = (currentText.length + 1 + next.text.length) <= _maxCardLen;

        // Compute average similarity of next to all sentences in current group
        let sim = 0;
        if (next.vec) {
          const sims = current.filter(s => s.vec).map(s => cosineSim(s.vec, next.vec));
          sim = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
        }

        if (wouldFit && (sim >= SIM_MERGE || !next.vec)) {
          // Semantically close and still fits — merge into current group
          current.push(next);
        } else if (!wouldFit && current.length === 0) {
          // Single sentence already exceeds cap — emit it alone
          groups.push([next]);
        } else {
          // Start a new group
          groups.push(current);
          current = [next];
        }
      }
      if (current.length) groups.push(current);

      // Safety pass: any group that still exceeds the cap gets word-boundary split
      const finalChunks = [];
      for (const grp of groups) {
        const joined = grp.map(s => s.text).join(' ');
        if (joined.length <= _maxCardLen) {
          finalChunks.push({ text: joined, vec: avgVec(grp.map(s => s.vec)) });
        } else {
          // Rare: a single sentence > cap, or tight merge — word-boundary split
          const sub = wordBoundaryChunk(joined, _maxCardLen);
          sub.forEach(t => finalChunks.push({ text: t, vec: grp[0].vec || row.vec }));
        }
      }

      if (finalChunks.length <= 1) { result.push(row); continue; }

      const catStr = cats.filter(c => c.trim()).join(' · ') || 'Cell';
      finalChunks.forEach((chunk, ni) => {
        result.push(makeRow(row, cells, cats, bestIdx, chunk.text, catStr, ni, finalChunks.length, chunk.vec || row.vec));
      });
    }
    return result;
  }

  // Splits text at word boundaries, each chunk <= maxLen chars
  function wordBoundaryChunk(text, maxLen) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLen) {
      const win = remaining.slice(0, maxLen);
      const cut = Math.max(win.lastIndexOf(' '), win.lastIndexOf('\n'));
      const at = cut > maxLen * 0.3 ? cut : maxLen;
      chunks.push(remaining.slice(0, at).trim());
      remaining = remaining.slice(at).trim();
    }
    if (remaining.length) chunks.push(remaining);
    return chunks.filter(c => c.length > 0);
  }

  function makeRow(row, cells, cats, bestIdx, text, catStr, ni, total, vec) {
    return {
      tabIdx: row.tabIdx, rowIdx: row.rowIdx,
      headers: row.headers || [], title: row.title || '',
      kws: row.kws || new Set(),
      _splitFrom: catStr, _splitN: ni + 1, _splitT: total,
      vec: vec || row.vec,
      row: { cells: cells.map((c, ci) => ci === bestIdx ? text : c), cats }
    };
  }

  function resolveCollisions(rects, gap, maxPasses) {
    gap = gap || 0; maxPasses = maxPasses || 160;
    for (let pass = 0; pass < maxPasses; pass++) {
      let moved = false;
      for (let a = 0; a < rects.length; a++) {
        for (let b = a + 1; b < rects.length; b++) {
          const ra = rects[a], rb = rects[b];
          const overlapX  = (ra.x + ra.w + gap) - rb.x; const overlapY  = (ra.y + ra.h + gap) - rb.y;
          const overlapX2 = (rb.x + rb.w + gap) - ra.x; const overlapY2 = (rb.y + rb.h + gap) - ra.y;
          if (overlapX <= 0 || overlapX2 <= 0 || overlapY <= 0 || overlapY2 <= 0) continue;
          const pushX = Math.min(overlapX, overlapX2), pushY = Math.min(overlapY, overlapY2);
          if (pushX <= pushY) { const half = pushX / 2; if (overlapX < overlapX2) { ra.x -= half; rb.x += half; } else { ra.x += half; rb.x -= half; } }
          else { const half = pushY / 2; if (overlapY < overlapY2) { ra.y -= half; rb.y += half; } else { ra.y += half; rb.y -= half; } }
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
    iters = iters || 25; const n = rows.length;
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
      const groups = Array.from({ length: k }, () => []); rows.forEach((r, i) => groups[asgn[i]].push(r));
      const cents = groups.map(g => g.length ? centroid(g) : null);
      const inertia = rows.reduce((s, r, i) => s + (cents[asgn[i]] ? 1 - cosineSim(r.vec, cents[asgn[i]]) : 0), 0);
      if (inertia < bestInertia) { bestInertia = inertia; bestAsgn = asgn; }
    }
    return { asgn: bestAsgn, inertia: bestInertia };
  }
  function autoCluster(rows, minK, maxK) {
    const n = rows.length; if (n === 0) return []; if (n <= 2) return rows.map((_, i) => i);
    const hardMin = Math.max(2, minK);
    const hardMax = Math.min(maxK, Math.floor(Math.sqrt(n) * 2), n - 1);
    if (hardMax < hardMin) return new Array(n).fill(0);
    if (hardMin === hardMax) return bestKMeans(rows, hardMin).asgn;
    const results = [];
    for (let k = hardMin; k <= hardMax; k++) results.push({ k, ...bestKMeans(rows, k) });
    const inertias = results.map(r => r.inertia); const totalDrop = (inertias[0] - inertias[inertias.length - 1]) || 1;
    // Elbow: find where marginal gain drops below 10% of total
    let chosenK = results[0].k;
    for (let i = 1; i < results.length; i++) { if ((inertias[i-1] - inertias[i]) / totalDrop < 0.10) { chosenK = results[i-1].k; break; } chosenK = results[i].k; }
    // Clamp: elbow can never go below hardMin (respects the user's Min slider)
    chosenK = Math.max(hardMin, Math.min(hardMax, chosenK));
    return (results.find(r => r.k === chosenK) || results[results.length-1]).asgn;
  }

  function alignedSubCluster(topGroups, minK, maxK) {
    const numGroups = topGroups.length;
    if (numGroups < 2) return numGroups === 0 ? [] : [autoCluster(topGroups[0], minK, maxK)];
    const perGroupK = topGroups.map(members => { if (members.length < 2) return 1; const asgn = autoCluster(members, minK, maxK); return Math.max(...asgn) + 1; });
    const kCounts = {}; perGroupK.forEach(k => { kCounts[k] = (kCounts[k] || 0) + 1; });
    let canonicalK = parseInt(Object.entries(kCounts).sort((a, b) => b[1] - a[1])[0][0]);
    // Respect slider bounds: canonicalK must be within [minK, maxK]
    canonicalK = Math.max(minK, Math.min(maxK, canonicalK));
    if (canonicalK < 2) return topGroups.map(g => new Array(g.length).fill(0));
    const allRows = topGroups.flat(); const globalAsgn = bestKMeans(allRows, canonicalK, 5).asgn;
    const globalBuckets = Array.from({ length: canonicalK }, () => []); allRows.forEach((r, i) => globalBuckets[globalAsgn[i]].push(r));
    const globalCentroids = globalBuckets.map(b => b.length ? centroid(b) : null);
    return topGroups.map(members => {
      if (members.length < 2) return new Array(members.length).fill(0);
      const localAsgn = members.length < canonicalK ? members.map((_, i) => i % canonicalK) : bestKMeans(members, canonicalK, 3).asgn;
      const localBuckets = Array.from({ length: canonicalK }, () => []); members.forEach((r, i) => localBuckets[localAsgn[i]].push(r));
      const localCentroids = localBuckets.map(b => b.length ? centroid(b) : null);
      const sim = Array.from({ length: canonicalK }, (_, ci) => Array.from({ length: canonicalK }, (_, gi) => (localCentroids[ci] && globalCentroids[gi]) ? cosineSim(localCentroids[ci], globalCentroids[gi]) : 0));
      const usedGlobal = new Set(), mapping = new Array(canonicalK).fill(-1);
      const pairs = []; for (let ci = 0; ci < canonicalK; ci++) for (let gi = 0; gi < canonicalK; gi++) pairs.push({ ci, gi, s: sim[ci][gi] });
      pairs.sort((a, b) => b.s - a.s);
      for (const { ci, gi } of pairs) { if (mapping[ci] !== -1 || usedGlobal.has(gi)) continue; mapping[ci] = gi; usedGlobal.add(gi); if (usedGlobal.size === canonicalK) break; }
      for (let ci = 0; ci < canonicalK; ci++) { if (mapping[ci] !== -1) continue; for (let gi = 0; gi < canonicalK; gi++) { if (!usedGlobal.has(gi)) { mapping[ci] = gi; usedGlobal.add(gi); break; } } if (mapping[ci] === -1) mapping[ci] = ci; }
      return localAsgn.map(ci => mapping[ci]);
    });
  }

  // ── Transparency utilities ───────────────────────────────

  // Average pairwise cosine similarity of all rows that have vectors.
  // Returns 0..1. Used to score cluster coherence.
  function clusterCoherence(members) {
    const vecs = members.map(r => r.vec).filter(Boolean);
    if (vecs.length < 2) return null;
    let sum = 0, count = 0;
    for (let i = 0; i < vecs.length; i++)
      for (let j = i + 1; j < vecs.length; j++) { sum += cosineSim(vecs[i], vecs[j]); count++; }
    return sum / count;
  }

  // Run k-means TRIALS more times and measure how consistently each card
  // stays with its original cluster-mates. Returns a stability score per
  // card: 1.0 = always in the same group, 0.0 = completely random.
  function computeCardStability(rows, originalAsgn, k, trials) {
    trials = trials || 6;
    const n = rows.length;
    if (n < 3 || k < 2) return new Array(n).fill(1);
    // Build original groups (index sets)
    const origGroups = Array.from({ length: k }, () => []);
    rows.forEach((r, i) => origGroups[originalAsgn[i]].push(i));
    const stableCount = new Array(n).fill(0);
    for (let t = 0; t < trials; t++) {
      const trialAsgn = kMeansCosine(rows, k);
      rows.forEach((r, i) => {
        const groupMembers = origGroups[originalAsgn[i]];
        if (groupMembers.length <= 1) { stableCount[i]++; return; }
        // Count how many original group-mates ended up in the same trial cluster
        const together = groupMembers.filter(j => j !== i && trialAsgn[j] === trialAsgn[i]).length;
        if (together >= (groupMembers.length - 1) * 0.5) stableCount[i]++;
      });
    }
    return stableCount.map(s => s / trials);
  }

  // Mark the outlier card(s) in a group: those whose avg sim to all others
  // is more than 1.5 std-devs below the group mean. At most 1 card flagged.
  function markGroupOutliers(members) {
    const vecs = members.map(r => r.vec);
    if (members.length < 4) return; // too few to be meaningful
    const avgSims = members.map((r, i) => {
      if (!r.vec) return null;
      let s = 0, cnt = 0;
      members.forEach((r2, j) => { if (i !== j && r2.vec) { s += cosineSim(r.vec, r2.vec); cnt++; } });
      return cnt ? s / cnt : null;
    });
    const valid = avgSims.filter(s => s !== null);
    if (valid.length < 3) return;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const std  = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length);
    if (std < 0.01) return; // no meaningful spread
    members.forEach((r, i) => {
      if (avgSims[i] !== null && avgSims[i] < mean - 1.5 * std) r._outlier = true;
      else delete r._outlier;
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

  function contrastFor(hex) {
    let c = String(hex).trim().replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    if (c.length === 8) c = c.slice(0, 6);
    if (c.length !== 6) return '#ffffff';
    const r = parseInt(c.slice(0,2),16)/255, g = parseInt(c.slice(2,4),16)/255, b = parseInt(c.slice(4,6),16)/255;
    const toLinear = v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    const L = 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
    return L > 0.5 ? '#1a1a1a' : '#ffffff';
  }

  function colForIndex(i) {
    const pal = (typeof getPalette === 'function' ? getPalette() : null) || window.PP_PALETTE || FALLBACK_PALETTE;
    return pal[i % pal.length];
  }

  // Build the coherence pill DOM element for a cluster header.
  function buildCoherencePill(members) {
    const score = clusterCoherence(members);
    if (score === null) return null;
    const pct = Math.round(score * 100);
    const tier = score >= 0.65 ? 'tight' : score >= 0.45 ? 'medium' : 'loose';
    const label = tier === 'tight' ? 'tight' : tier === 'medium' ? 'moderate' : 'loose';
    const tooltip = tier === 'tight'
      ? 'Cards are highly similar — this cluster is semantically coherent (' + pct + '%)'
      : tier === 'medium'
      ? 'Cards share moderate similarity — some thematic spread (' + pct + '%)'
      : 'Cards are weakly similar — this grouping has low confidence (' + pct + '%). Consider re-clustering or splitting manually.';
    const pill = document.createElement('div');
    pill.className = 'pp-cl-coherence pp-cl-coherence--' + tier;
    pill.title = tooltip;
    pill.innerHTML =
      '<div class="pp-cl-coherence-bar"><div class="pp-cl-coherence-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="pp-cl-coherence-pct">' + pct + '%</span>';
    return pill;
  }

  function buildCard(r, col, delay, clusterLabel, similarity) {
    const cells  = r.row && r.row.cells ? r.row.cells : (r.cells || []);
    const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
    const headers = r.headers || [];
    // Find which cell is being displayed (longest cell)
    let bestIdx = 0, bestLen = 0;
    cells.forEach((c, i) => { if (c.length > bestLen) { bestLen = c.length; bestIdx = i; } });
    const best   = cells[bestIdx] || '';
    const colHeader = headers[bestIdx] || '';
    const parsed = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };
    const card = document.createElement('div'); card.className = 'pp-cl-card';
    card.style.setProperty('--ppc-bg', col.accent);
    card.style.setProperty('--ppc-on', contrastFor(col.accent));
    if (delay) card.style.animationDelay = delay + 'ms';
    const topRow = document.createElement('div'); topRow.className = 'pp-cmap-card-top';
    const catNumEl = document.createElement('div'); catNumEl.className = 'pp-cmap-card-cat-num'; catNumEl.textContent = cats.length ? cats.join(' · ') : (clusterLabel ? clusterLabel.slice(0, 6) : '\u00b7');
    const levelBlock = document.createElement('div'); levelBlock.className = 'pp-cmap-card-level-block';
    const levelLbl = document.createElement('div'); levelLbl.className = 'pp-cmap-card-level-label'; levelLbl.textContent = clusterLabel || 'Cluster';
    levelBlock.appendChild(levelLbl); topRow.appendChild(catNumEl); topRow.appendChild(levelBlock); card.appendChild(topRow);
    const rule = document.createElement('div'); rule.className = 'pp-cmap-card-rule'; card.appendChild(rule);
    const body = document.createElement('div'); body.className = 'pp-cl-card-body';
    if (colHeader) { const ce = document.createElement('div'); ce.className = 'pp-cl-card-cat'; ce.textContent = colHeader; body.appendChild(ce); }
    const te = document.createElement('div'); te.className = 'pp-cl-card-text'; te.textContent = parsed.body; body.appendChild(te);
    if (r._splitN && r._splitT && r._splitT > 1) { const sp = document.createElement('div'); sp.className = 'pp-cl-card-split'; sp.textContent = r._splitN + '/' + r._splitT + ' Split'; body.appendChild(sp); }
    if (r._borderline || r._outlier) {
      const badges = document.createElement('div'); badges.className = 'pp-cl-card-badges';
      if (r._borderline) {
        const b = document.createElement('span'); b.className = 'pp-cl-badge pp-cl-badge--boundary';
        b.textContent = '~ boundary';
        b.title = 'This card\u2019s cluster assignment is unstable \u2014 it could plausibly belong to another group. Treat its placement with lower confidence.';
        badges.appendChild(b);
      }
      if (r._outlier) {
        const o = document.createElement('span'); o.className = 'pp-cl-badge pp-cl-badge--outlier';
        o.textContent = '\u2197 outlier';
        o.title = 'This card is the least similar to the other cards in its cluster. It may belong elsewhere or represent an under-explored theme.';
        badges.appendChild(o);
      }
      body.appendChild(badges);
    }
    if (typeof similarity === 'number') {
      const pct = Math.round(similarity * 100);
      const sim = document.createElement('div'); sim.className = 'pp-cl-sim-row';
      sim.innerHTML =
        '<svg class="pp-cl-sim-arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="9" height="9">' +
          '<polyline points="1,8 4,4 6.5,6.5 9,2"/>' +
        '</svg>' +
        '<span class="pp-cl-sim-pct">' + pct + '%</span>' +
        '<div class="pp-cl-sim-bar"><div class="pp-cl-sim-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="pp-cl-sim-label">to cluster</span>';
      body.appendChild(sim);
    }

    card.appendChild(body);
    card.addEventListener('mouseenter', ev => { if (_nestDrag && _nestDrag.moved) return; showTooltip(ev, r, col.accent, clusterLabel || ''); });
    card.addEventListener('mousemove',  ev => { if (_nestDrag && _nestDrag.moved) { hideTooltip(); return; } moveTooltip(ev); });
    card.addEventListener('mouseleave', () => hideTooltip());
    return card;
  }

  function subLabel(prefix, idx) { const sep = /[A-Z]$/i.test(prefix) ? '' : '.'; return prefix + sep + (idx + 1); }

  function buildTilesRecursive(rows, prefixLbl, remainingDepth, col, frag, delayOffset, simMap) {
    if (remainingDepth <= 0 || rows.length < 2) { rows.forEach((r, ri) => frag.appendChild(buildCard(r, col, (delayOffset + ri) * 10, prefixLbl, simMap && simMap.get(r)))); return; }
    const asgn = autoCluster(rows, _innerMin, _innerMax); const numGroups = Math.max(...asgn, 0) + 1;
    if (numGroups <= 1) { rows.forEach((r, ri) => frag.appendChild(buildCard(r, col, (delayOffset + ri) * 10, prefixLbl, simMap && simMap.get(r)))); return; }
    const groups = Array.from({ length: numGroups }, () => []); rows.forEach((r, i) => groups[asgn[i]].push(r));
    let delay = delayOffset;
    groups.forEach((members, si) => { if (!members.length) return; const lbl = subLabel(prefixLbl, si); const subCol = colForIndex(si); buildTilesRecursive(members, lbl, remainingDepth - 1, subCol, frag, delay, simMap); delay += members.length; });
  }

  function buildInnerTiles(rows, subAsgn, col, outerLbl, simMap) {
    const frag = document.createDocumentFragment();
    if (_depth <= 1) { rows.forEach((r, ri) => frag.appendChild(buildCard(r, col, ri * 10, outerLbl, simMap && simMap.get(r)))); return frag; }
    if (_depth === 2 && subAsgn) {
      const numSub = Math.max(...subAsgn, 0) + 1; const groups = Array.from({ length: numSub }, () => []); rows.forEach((r, i) => groups[subAsgn[i]].push(r));
      let delay = 0;
      groups.forEach((members, si) => { if (!members.length) return; const lbl = subLabel(outerLbl, si); const subCol = colForIndex(si); members.forEach((r, ri) => frag.appendChild(buildCard(r, subCol, (delay + ri) * 10, lbl, simMap && simMap.get(r)))); delay += members.length; });
    } else { buildTilesRecursive(rows, outerLbl, _depth - 1, col, frag, 0, simMap); }
    return frag;
  }

  // ── Masonry ───────────────────────────────────────────────
  function doMasonry(nestEl, animate) {
    const body = nestEl.querySelector('.pp-cl-nest-body'); const cols = colsFromWidth(nestEl);
    const cards = Array.from(body.querySelectorAll('.pp-cl-card'));
    if (!cards.length) return { contentH: 0, cols };
    let before = null;
    if (animate) { before = cards.map(el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top }; }); }
    const colHeights = new Array(cols).fill(0);
    cards.forEach(card => { const minH = Math.min(...colHeights); const col = colHeights.indexOf(minH); card.style.left = (col * (CARD_W + CARD_GAP)) + 'px'; card.style.top = colHeights[col] + 'px'; colHeights[col] += card.offsetHeight + CARD_GAP; });
    const contentH = Math.max(...colHeights) - CARD_GAP; body.style.height = contentH + 'px';
    if (animate && before) {
      requestAnimationFrame(() => {
        cards.forEach((el, i) => {
          const after = el.getBoundingClientRect(); const dx = before[i].x - after.left; const dy = before[i].y - after.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          el.animate([{ transform: `translate(${dx}px,${dy}px)`, easing: 'cubic-bezier(0.4,0,0.2,1)' }, { transform: 'translate(0,0)' }], { duration: 280, fill: 'none' });
        });
      });
    }
    return { contentH, cols };
  }

  function colsFromWidth(nestEl) {
    const innerW = nestEl.offsetWidth - BODY_PAD * 2;
    return Math.max(1, Math.floor((innerW + CARD_GAP) / (CARD_W + CARD_GAP)));
  }
  function calcNestDims(cardCount) {
    const idealCols = Math.min(Math.max(2, Math.ceil(Math.sqrt(cardCount * 1.5))), 6);
    const nestW = idealCols * CARD_W + (idealCols - 1) * CARD_GAP + BODY_PAD * 2;
    const AVG_H = 120; const rows = Math.ceil(cardCount / idealCols);
    const estH = HEAD_H + rows * AVG_H + (rows - 1) * CARD_GAP + BODY_PAD * 2;
    return { nestW, estH };
  }

  function buildOuterNest(members, outerIdx, subAsgn, simMap) {
    const col = colForIndex(outerIdx); const lbl = outerLabel(outerIdx);
    const nest = document.createElement('div'); nest.className = 'pp-cl-nest';
    const subCount = subAsgn ? (Math.max(...subAsgn, 0) + 1) : 0;
    const subLabelStr = subAsgn && _depth > 1 ? ' \u00b7 ' + subCount + ' group' + (subCount === 1 ? '' : 's') : '';
    const head = document.createElement('div'); head.className = 'pp-cl-nest-head'; head.style.background = col.accent + '18';
    const nestLblEl = document.createElement('span'); nestLblEl.className = 'pp-cl-nest-label'; nestLblEl.textContent = lbl; nestLblEl.style.color = col.accent;
    const dot = document.createElement('span'); dot.className = 'pp-cl-nest-dot'; dot.style.background = col.accent;
    const cnt = document.createElement('span'); cnt.className = 'pp-cl-nest-count'; cnt.textContent = members.length + ' entr' + (members.length === 1 ? 'y' : 'ies') + subLabelStr;
    head.appendChild(nestLblEl); head.appendChild(dot); head.appendChild(cnt);
    const pill = buildCoherencePill(members);
    if (pill) head.appendChild(pill);
    nest.appendChild(head);
    // Mark outliers within this cluster before building cards
    markGroupOutliers(members);
    const body = document.createElement('div'); body.className = 'pp-cl-nest-body'; nest.appendChild(body);
    body.appendChild(buildInnerTiles(members, subAsgn, col, lbl, simMap));
    const { nestW, estH } = calcNestDims(members.length);
    nest.style.width = nestW + 'px'; nest._estW = nestW; nest._estH = estH;
    makeNestDraggable(nest); makeResizable(nest, members.length);
    return nest;
  }

  function buildDefinedNest(def, members, defIdx, simMap) {
    const color = def.color;
    const col = { accent: color, bg: color + '18', label: contrastFor(color) };
    const shortDesc = def.desc.length > 22 ? def.desc.slice(0, 20) + '\u2026' : def.desc;
    const lbl = shortDesc;
    const nestNum = '\u2605' + (defIdx + 1);
    const nest = document.createElement('div'); nest.className = 'pp-cl-nest';
    const head = document.createElement('div'); head.className = 'pp-cl-nest-head'; head.style.background = color + '18';
    const nestLblEl = document.createElement('span'); nestLblEl.className = 'pp-cl-nest-label'; nestLblEl.textContent = nestNum; nestLblEl.style.color = color;
    const dot = document.createElement('span'); dot.className = 'pp-cl-nest-dot'; dot.style.background = color;
    const badge = document.createElement('span'); badge.className = 'pp-cl-nest-defined-badge'; badge.textContent = 'defined';
    const cnt = document.createElement('span'); cnt.className = 'pp-cl-nest-count'; cnt.textContent = members.length + ' entr' + (members.length === 1 ? 'y' : 'ies');
    const descEl = document.createElement('span');
    descEl.style.cssText = 'font-size:9px;color:var(--md-sys-color-on-surface-variant);font-style:italic;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:4px;';
    descEl.textContent = def.desc;
    head.appendChild(nestLblEl); head.appendChild(dot); head.appendChild(badge); head.appendChild(cnt); head.appendChild(descEl);
    const defPill = buildCoherencePill(members);
    if (defPill) head.appendChild(defPill);
    nest.appendChild(head);
    const body = document.createElement('div'); body.className = 'pp-cl-nest-body'; nest.appendChild(body);

    let innerFrag;
    if (def.subClusters && def.subClusters.length && members.some(r => r.vec)) {
      const readySubs = def.subClusters.filter(s => s.vec);
      if (readySubs.length >= 2) {
        const subGroups = Array.from({ length: readySubs.length + 1 }, () => []);
        members.forEach(r => {
          if (!r.vec) { subGroups[readySubs.length].push(r); return; }
          let bestSim = _defThreshold * 0.8, bestIdx = readySubs.length;
          readySubs.forEach((sub, si) => { const s = cosineSim(r.vec, sub.vec); if (s > bestSim) { bestSim = s; bestIdx = si; } });
          subGroups[bestIdx].push(r);
        });
        innerFrag = document.createDocumentFragment();
        readySubs.forEach((sub, si) => {
          if (!subGroups[si].length) return;
          const subLbl = shortDesc + ' \u00b7 ' + (sub.desc.length > 14 ? sub.desc.slice(0,12)+'\u2026' : sub.desc);
          const subCol = { accent: color, bg: color + '18', label: contrastFor(color) };
          subGroups[si].forEach((r, ri) => innerFrag.appendChild(buildCard(r, subCol, ri * 10, subLbl, simMap && simMap.get(r))));
        });
        if (subGroups[readySubs.length].length) {
          subGroups[readySubs.length].forEach((r, ri) => innerFrag.appendChild(buildCard(r, col, ri * 10, lbl, simMap && simMap.get(r))));
        }
      } else {
        innerFrag = buildInnerTiles(members, null, col, lbl, simMap);
      }
    } else {
      innerFrag = buildInnerTiles(members, null, col, lbl, simMap);
    }

    body.appendChild(innerFrag);
    const { nestW, estH } = calcNestDims(members.length);
    nest.style.width = nestW + 'px'; nest._estW = nestW; nest._estH = estH;
    makeNestDraggable(nest); makeResizable(nest, members.length);
    return nest;
  }

  // ── Main render ───────────────────────────────────────────
  function render(rows) {
    Array.from(world.children).forEach(c => c.remove());
    emptyEl.style.display = 'none';
    _panX = 0; _panY = 0; _zoom = 1; applyWorldTransform(); _topZ = 10;

    const readyDefs = _definedClusters.filter(d => d.vec);
    const defGroups = readyDefs.map(() => []);
    const defSimMaps = readyDefs.map(() => new Map());
    let autoRows = rows;

    if (readyDefs.length) {
      autoRows = [];
      rows.forEach(r => {
        if (!r.vec) { autoRows.push(r); return; }
        let bestSim = _defThreshold, bestIdx = -1;
        readyDefs.forEach((def, di) => {
          const s = cosineSim(r.vec, def.vec);
          if (s > bestSim) { bestSim = s; bestIdx = di; }
        });
        if (bestIdx >= 0) {
          defGroups[bestIdx].push(r);
          defSimMaps[bestIdx].set(r, bestSim);
        } else {
          autoRows.push(r);
        }
      });
    }

    const nestEls = [];

    readyDefs.forEach((def, di) => {
      if (!defGroups[di].length) return;
      const nest = buildDefinedNest(def, defGroups[di], di, defSimMaps[di]);
      nest.style.animationDelay = (di * 55) + 'ms';
      world.appendChild(nest); nestEls.push(nest);
    });

    const definedOffset = nestEls.length;
    let autoNonEmpty = [];
    let autoAlignedAsgns = null;
    if (autoRows.length >= 2) {
      const topAsgn = autoCluster(autoRows, _outerMin, _outerMax);
      const numTop = Math.max(...topAsgn, 0) + 1;
      const topGroups = Array.from({ length: numTop }, () => []); autoRows.forEach((r, i) => topGroups[topAsgn[i]].push(r));
      // Compute card stability: run k-means 6 more times and check consistency
      const stability = computeCardStability(autoRows, topAsgn, numTop);
      autoRows.forEach((r, i) => {
        r._borderline = stability[i] < 0.5;
        if (!r._borderline) delete r._borderline;
      });
      autoNonEmpty = topGroups.filter(g => g.length > 0);
      if (_depth > 1 && autoNonEmpty.length > 1) autoAlignedAsgns = alignedSubCluster(autoNonEmpty, _innerMin, _innerMax);
      let alignIdx = 0;
      topGroups.forEach((members, oi) => {
        if (!members.length) return;
        const subAsgn = (autoAlignedAsgns && _depth > 1) ? autoAlignedAsgns[alignIdx++] : null;
        const nest = buildOuterNest(members, oi, subAsgn, null);
        nest.style.animationDelay = ((definedOffset + oi) * 55) + 'ms';
        world.appendChild(nest); nestEls.push(nest);
      });
    } else if (autoRows.length === 1) {
      const nest = buildOuterNest(autoRows, 0, null, null);
      world.appendChild(nest); nestEls.push(nest);
      autoNonEmpty = [autoRows];
    }

    _clusterState = {
      nonEmpty: autoNonEmpty,
      alignedAsgns: (_depth > 1 ? autoAlignedAsgns : null),
      definedGroups: readyDefs.map((def, di) => ({ def, members: defGroups[di] })).filter(g => g.members.length),
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nestEls.forEach(nest => { const { contentH } = doMasonry(nest, false); if (nest._setMasonryMinH) nest._setMasonryMinH(contentH); const realH = HEAD_H + contentH + BODY_PAD * 2; nest.style.height = realH + 'px'; nest._estH = realH; });
        const cols = Math.max(1, Math.ceil(Math.sqrt(nestEls.length)));
        const topRects = nestEls.map((n, i) => ({ x: NEST_GAP + (i % cols) * ((n._estW || 200) + NEST_GAP * 2), y: NEST_GAP + Math.floor(i / cols) * ((n._estH || 200) + NEST_GAP * 2), w: n._estW || 200, h: n._estH || 200, el: n }));
        resolveCollisions(topRects, NEST_GAP, 160);
        const minX = Math.min(...topRects.map(r => r.x)); const minY = Math.min(...topRects.map(r => r.y));
        const offX = minX < NEST_GAP ? NEST_GAP - minX : 0; const offY = minY < NEST_GAP ? NEST_GAP - minY : 0;
        topRects.forEach(r => { r.el.style.left = (r.x + offX) + 'px'; r.el.style.top = (r.y + offY) + 'px'; });
      });
    });

    const splitCount  = rows.filter(r => r._splitFrom).length;
    const defCount    = readyDefs.length ? readyDefs.length + ' defined \u00b7 ' : '';
    const autoNests   = nestEls.length - readyDefs.filter((_, di) => defGroups[di].length).length;
    const autoNames   = Array.from({ length: autoNests }, (_, i) => outerLabel(i)).join(', ');
    const autoStr     = autoNests > 0 ? autoNests + ' auto (' + autoNames + ')' : '';
    const orphanCount = readyDefs.length ? autoRows.length : 0;
    const orphanStr   = orphanCount > 0 ? ' \u00b7 ' + orphanCount + ' orphan' + (orphanCount === 1 ? '' : 's') : '';
    subtitle.textContent =
      defCount + autoStr +
      (defCount || autoStr ? ' \u00b7 ' : '') +
      rows.length + ' entries' +
      orphanStr +
      (splitCount > 0 ? ' \u00b7 ' + splitCount + ' split' : '');

    updateSheetPanel();
  }

  function tryRender() {
    if (_rendered) return;
    if (typeof buildRowIndex !== 'function') return;
    if (_cachedEmbedded && _cachedVectors) { doRender(); return; }
    const rows = buildRowIndex(); if (!rows.length) return;
    const preVeced = rows.filter(r => r.vec && r.vec.length);
    if (preVeced.length >= 2) {
      const vectors = new Map(); preVeced.forEach(r => vectors.set(r.tabIdx+':'+r.rowIdx, r.vec));
      _cachedEmbedded = preVeced; _cachedVectors = vectors;
      requestAnimationFrame(doRender); return;
    }
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026');
    emptyEl.style.display = 'none';
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
      _cachedEmbedded = embedded; _cachedVectors = vectors;
      requestAnimationFrame(doRender);
    });
  }

  async function doRender() {
    reclusterBtn.classList.remove('pp-cl-reclustering');
    reclusterBtn.textContent = 'Re-cluster';
    setStatus('loading', 'Splitting cells\u2026');
    let workRows = _cachedEmbedded;
    try {
      const split = await splitAllRows(_cachedEmbedded);
      console.log('[clusters] split check: before=' + _cachedEmbedded.length + ' after=' + split.length + ' splits=' + (split.length - _cachedEmbedded.length));
      split.filter(r => r._splitFrom).forEach(r => console.log('  split:', r._splitFrom, r._splitN + '/' + r._splitT, (r.row.cells.find(c => c.trim().length > 0) || '').slice(0, 60)));
      if (split.length > _cachedEmbedded.length) {
        workRows = split;
        setStatus('loading', 'Clustering ' + workRows.length + ' concepts\u2026');
      }
    } catch(e) { console.warn('[clusters] split error:', e); }

    // Second pass: hard-split by max card length (if enabled)
    if (_maxCardLen) {
      const hardSplit = await hardSplitByLength(workRows);
      if (hardSplit.length > workRows.length) {
        console.log('[clusters] hard-split by length: before=' + workRows.length + ' after=' + hardSplit.length);
        workRows = hardSplit;
        setStatus('loading', 'Clustering ' + workRows.length + ' concepts\u2026');
      }
    }

    setTimeout(() => {
      try {
        render(workRows);
        setStatus('ready', 'Done');
        _rendered = true;
      } catch (err) {
        console.error('[clusters]', err);
        setStatus('error', 'Clustering failed');
      }
    }, 20);
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 120);
  window.addEventListener('embedding-progress', ev => { if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + ev.detail.pct + '%'); });
  window.addEventListener('embedding-complete', ev => { if (!_rendered) { subtitle.textContent = 'Indexed ' + ev.detail.total + ' entries \u2014 building clusters\u2026'; tryRender(); } });
  window.addEventListener('df-theme-change', () => { _rendered = false; tryRender(); });

  window.addEventListener('embedder-ready', () => {
    _definedClusters.forEach(def => {
      if (!def.vec) _embedWithRetry(def);
      def.subClusters.forEach(sub => { if (!sub.vec) _embedWithRetry(sub); });
    });
    setTimeout(tryRender, 120);
  });

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
