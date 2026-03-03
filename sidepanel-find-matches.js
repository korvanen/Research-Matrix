// ════════════════════════════════════════════════════════════════════════════
// panel-find-matches.js — "Find Matches" sidebar tool
// ════════════════════════════════════════════════════════════════════════════
console.log('[panel-find-matches.js is updated]');

const PANEL_MIN_SHARED   = 0;
const PANEL_MM_PAD       = 10;
const PANEL_MM_ITERS     = 20;
const PANEL_CARD_W       = 160;
const PANEL_CARD_MIN_W   = 140;
const PANEL_CARD_MAX_W   = 240;
const PANEL_GOTO_DELAY   = 400;

// Opacity per relation layer (index 0 = layer 1, index 1 = layer 2, …)
const LAYER_OPACITY = [1, 0.58, 0.38, 0.24, 0.14];

// ── Inject tool-specific styles ──────────────────────────────────────────────
(function injectFindMatchesStyles() {
  if (document.getElementById('pp-find-matches-styles')) return;
  const style = document.createElement('style');
  style.id = 'pp-find-matches-styles';
  style.textContent = `
/* ── Find Matches pane layout ── */
#pp-head {
  flex-shrink: 0;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));
  display: flex;
  flex-direction: column;
  gap: 6px;
}
#pp-subtitle {
  font-size: 11px; font-weight: 500; color: rgba(0,0,0,.45);
  letter-spacing: .04em; line-height: 1.3; min-height: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#pp-toolrow {
  display: flex; flex-direction: row; gap: 5px; align-items: center;
}
#pp-hl-wrap    { flex: 0 0 auto; display: flex; align-items: center; }
#pp-layers-wrap { flex: 1; min-width: 0; display: flex; }
#pp-view-wrap  { flex: 1; min-width: 0; display: flex; }
#pp-layers-wrap .pp-pill,
#pp-view-wrap   .pp-pill { width: 100%; }

/* KW toggle button */
.pp-kw-toggle {
  border: none;
  border-radius: 20px;
  padding: 6px 11px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background .15s, color .15s, box-shadow .15s;
  white-space: nowrap;
  background: rgba(0,0,0,.07);
  color: rgba(0,0,0,.32);
  line-height: 1;
}
.pp-kw-toggle.pp-kw-on {
  background: rgba(0,0,0,.74);
  color: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.18);
}

#pp-body-wrap {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  position: relative;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
}
#pp-body-wrap::-webkit-scrollbar { width: 8px; height: 8px; }
#pp-body-wrap::-webkit-scrollbar-track { background: var(--scrollbar-track); }
#pp-body-wrap::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
#pp-body-wrap::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
#pp-body-wrap::-webkit-scrollbar-corner { background: var(--scrollbar-track); }

#pp-body {
  padding: 10px 12px 18px; box-sizing: border-box;
  display: grid; gap: 10px;
  align-content: start; align-items: start;
  width: 100%;
  transition: grid-template-columns 0.18s ease;
}
#pp-mm-wrap { position: absolute; inset: 0; display: none; overflow: hidden; }

/* ── Cards ── */
.pp-seed-card.pp-match-card { border-width: 2px; }
.pp-match-card {
  min-width: 0;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);
  overflow: visible; box-sizing: border-box;
  animation: pp-fade-in .22s ease both;
  position: relative;
  transition: opacity .18s ease;
}

/* FIX: animation ends at --ppc-opacity (default 1) so layer-opacity inline
   style is not clobbered by animation fill-mode:both. */
@keyframes pp-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: var(--ppc-opacity, 1); transform: none; }
}

/* Divider */
.pp-divider {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 6px;
  margin: 4px 0 0; border-top: 1.5px solid rgba(0,0,0,.08); padding-top: 6px;
}
.pp-divider span {
  font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;
}

/* Card internals */
.pp-card-head {
  padding: 5px 8px 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  border-bottom: 1px solid rgba(0,0,0,.07);
}
.pp-card-badge {
  font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  border-radius: 20px; padding: 2px 7px; flex-shrink: 0;
}
.pp-card-dim {
  font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: rgba(0,0,0,.4); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pp-card-body { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 5px; }
.pp-field { font-size: 11px; line-height: 1.4; color: rgba(0,0,0,.65); }
.pp-field-matched { color: rgba(0,0,0,.85); }
.pp-flabel {
  display: block; font-size: 9px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(0,0,0,.3); margin-bottom: 1px;
}
.pp-shared-pill {
  margin: 0 8px 7px; padding: 2px 7px; background: rgba(0,0,0,.06); border-radius: 20px;
  font-size: 9px; font-weight: 600; letter-spacing: .06em; color: rgba(0,0,0,.4);
  text-transform: uppercase; display: inline-block; align-self: flex-start;
}
.pp-seed-cats {
  font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.35); margin-bottom: 1px;
}
.pp-seed-sep { border-top: 1px solid rgba(0,0,0,.08); margin: 4px 0; }

/* Go-to button — tiles */
.pp-goto-btn {
  display: block; width: calc(100% - 16px);
  margin: 0 8px 0;
  margin-bottom: calc(-1 * (1em + 22px));
  padding: 5px 8px; border-radius: 6px; border: 1.5px solid;
  background: white; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; cursor: pointer; text-align: center;
  opacity: 0; transform: translateY(4px);
  transition: opacity .22s ease, transform .22s ease, margin-bottom .22s ease;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
  pointer-events: none;
}
.pp-goto-btn.pp-goto-visible {
  opacity: 1; transform: translateY(0); margin-bottom: 8px; pointer-events: auto;
}
.pp-goto-btn:hover { filter: brightness(0.92); }

/* ══ MINDMAP CARDS ══ */
.pp-mm-card {
  position: absolute;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #fff);
  box-shadow: 0 2px 10px rgba(0,0,0,.12);
  cursor: grab; user-select: none; z-index: 1;
  overflow: hidden;
  transition: opacity .18s ease;
}
.pp-mm-card:active { cursor: grabbing; }
.pp-mm-card.pp-mm-expanded { overflow: visible; }

.pp-mm-card-head {
  border-radius: 6px 6px 0 0;
  min-height: 6px; padding: 0 6px 0 8px;
  display: flex; align-items: center; gap: 4px; overflow: hidden;
}
.pp-mm-badge {
  font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  flex-shrink: 0; opacity: 0.9;
}
.pp-mm-head-label {
  font-size: 9px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
  white-space: normal; word-break: break-word;
  flex: 1; min-width: 0;
  max-height: 0; opacity: 0;
  transition: max-height 0.18s ease, opacity 0.18s ease, padding 0.18s ease;
  padding: 0;
}
.pp-mm-card.pp-mm-expanded .pp-mm-head-label { max-height: 80px; opacity: 1; padding: 4px 0; }

.pp-mm-card .pp-goto-btn {
  position: absolute; bottom: 5px; right: 6px;
  width: 18px; height: 18px;
  border: none; background: transparent;
  border-radius: 4px; cursor: pointer;
  display: grid; place-items: center;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease, background .12s ease;
  padding: 0; margin: 0; box-shadow: none; transform: none;
  color: var(--ppc-border, #888);
  font-size: 0; letter-spacing: 0; text-transform: none;
}
.pp-mm-lock {
  flex-shrink: 0; width: 18px; height: 18px;
  border: none; background: transparent; border-radius: 4px;
  cursor: pointer; display: grid; place-items: center;
  opacity: 0; transition: opacity .18s ease, background .12s ease;
  padding: 0; margin-left: auto; pointer-events: none;
}
.pp-mm-card:hover .pp-mm-lock,
.pp-mm-card.pp-mm-expanded .pp-mm-lock,
.pp-mm-card:hover .pp-goto-btn,
.pp-mm-card.pp-mm-expanded .pp-goto-btn { opacity: 0.45; pointer-events: auto; }
.pp-mm-lock:hover { opacity: 0.85 !important; background: rgba(255,255,255,0.20); }
.pp-mm-card .pp-goto-btn:hover { opacity: 0.85 !important; background: rgba(0,0,0,0.08); }
.pp-mm-lock.pp-mm-lock-active { opacity: 1 !important; pointer-events: auto; background: rgba(255,255,255,0.25); }
.pp-mm-card.pp-mm-card-locked .pp-goto-btn { opacity: 1 !important; pointer-events: auto; }
.pp-mm-lock svg { display: block; pointer-events: none; }

.pp-mm-card-body { padding: 5px 8px 7px; display: flex; flex-direction: column; gap: 3px; }
.pp-mm-field {
  font-size: 10px; line-height: 1.35; color: rgba(0,0,0,.7);
  overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
}
.pp-mm-card.pp-mm-expanded .pp-mm-field { display: block; -webkit-line-clamp: unset; }
.pp-mm-cat {
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(0,0,0,.35); margin-bottom: 2px;
}
.pp-mm-seed-extra { display: none; }
.pp-mm-card.pp-mm-expanded .pp-mm-seed-extra { display: block; }
.pp-mm-seed-sep { border-top: 1px solid rgba(255,255,255,.25); margin: 4px 0; }

.pp-mm-card .pp-goto-btn::after {
  content: '';
  display: block; width: 6px; height: 6px;
  border-top: 2px solid currentColor; border-right: 2px solid currentColor;
  transform: rotate(45deg) translate(-1px, 1px); flex-shrink: 0;
}
.pp-mm-card .pp-goto-btn .pp-goto-label { display: none; }

/* ── Model status bar ── */
#pp-model-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .07em;
  text-transform: uppercase;
  transition: opacity .6s ease, background .4s ease;
}
#pp-model-status.pp-model-loading {
  background: rgba(0,0,0,.06);
  color: rgba(0,0,0,.4);
}
#pp-model-status.pp-model-ready {
  background: rgba(60,180,100,.12);
  color: rgba(30,130,60,.9);
}
#pp-model-status.pp-model-error {
  background: rgba(200,60,60,.10);
  color: rgba(180,40,40,.85);
}
.pp-model-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background .4s ease;
}
#pp-model-status.pp-model-loading .pp-model-dot {
  background: rgba(0,0,0,.25);
  animation: pp-dot-pulse 1.2s ease-in-out infinite;
}
#pp-model-status.pp-model-ready .pp-model-dot  { background: rgba(40,160,80,.9); }
#pp-model-status.pp-model-error .pp-model-dot  { background: rgba(180,40,40,.85); }
@keyframes pp-dot-pulse {
  0%, 100% { opacity: .25; transform: scale(0.85); }
  50%       { opacity: 1;   transform: scale(1.1); }
}
`;
  document.head.appendChild(style);
})();

// ── Main init ─────────────────────────────────────────────────────────────────
function initFindMatchesTool(paneEl, sidebarEl) {

  paneEl.innerHTML =
    '<div id="pp-head">' +
      '<div id="pp-subtitle">Click a cell to find matches</div>' +
      '<div id="pp-model-status" class="pp-model-loading">' +
        '<div class="pp-model-dot"></div>' +
        '<span id="pp-model-label">Model loading\u2026</span>' +
      '</div>' +
      '<div id="pp-toolrow" style="display:none">' +
        '<div id="pp-hl-wrap"></div>' +
        '<div id="pp-layers-wrap"></div>' +
        '<div id="pp-view-wrap"></div>' +
      '</div>' +
    '</div>' +
    '<div id="pp-body-wrap">' +
      '<div id="pp-body"></div>' +
      '<div id="pp-mm-wrap"></div>' +
    '</div>';

  const ppSubtitle   = paneEl.querySelector('#pp-subtitle');
  const ppToolrow    = paneEl.querySelector('#pp-toolrow');
  const ppHlWrap     = paneEl.querySelector('#pp-hl-wrap');
  const ppLayersWrap = paneEl.querySelector('#pp-layers-wrap');
  const ppViewWrap   = paneEl.querySelector('#pp-view-wrap');
  const ppBody       = paneEl.querySelector('#pp-body');
  const ppMmWrap     = paneEl.querySelector('#pp-mm-wrap');

  // ── Grid layout ─────────────────────────────────────────────────────────────
  let _lastCols = 0, _lastCardW = 0, _gridRafId = null;

  function scheduleUpdateGrid() {
    if (_gridRafId) return;
    _gridRafId = requestAnimationFrame(() => { _gridRafId = null; _doUpdateGrid(); });
  }

  function _doUpdateGrid() {
    const pad = 24, gap = 10;
    const sbMargin = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-box-margin')
    ) || 8;
    const w = (sidebarEl ? sidebarEl.offsetWidth : paneEl.offsetWidth) - sbMargin * 2 - pad;
    if (w <= 0) return;

    let maxGroupSize = 0, currentGroupSize = 0;
    for (const ch of ppBody.children) {
      if (ch.classList.contains('pp-divider')) { maxGroupSize = Math.max(maxGroupSize, currentGroupSize); currentGroupSize = 0; }
      else if (ch.classList.contains('pp-match-card')) currentGroupSize++;
    }
    maxGroupSize = Math.max(maxGroupSize, currentGroupSize);
    const maxUsefulCols = maxGroupSize > 0 ? maxGroupSize : Infinity;

    const cols  = Math.min(Math.max(1, Math.floor((w + gap) / (PANEL_CARD_MIN_W + gap))), maxUsefulCols);
    const cardW = Math.min(PANEL_CARD_MAX_W, Math.floor((w - gap * (cols - 1)) / cols));
    if (cols === _lastCols && cardW === _lastCardW) return;
    _lastCols = cols; _lastCardW = cardW;
    ppBody.style.gridTemplateColumns = `repeat(${cols}, ${cardW}px)`;
    ppBody.style.width = '';
  }

  scheduleUpdateGrid();
  if (window.ResizeObserver) new ResizeObserver(scheduleUpdateGrid).observe(sidebarEl || paneEl);

  // ── State ────────────────────────────────────────────────────────────────────
  let hlOn        = true;
  let viewMode    = 'tiles';
  let _numLayers  = 1;
  let seedKws     = new Set();
  let seedTabIdx  = -1;
  let seedRowIdx  = -1;
  let seedCells   = [];
  let lastMatches = [];
  let _mmActive   = null;
  let _mmMatchKey = '';
  let _mmModeSnapshot = null;
  let _hasContent = false;

  function applyHlState() {
    [ppBody, ppMmWrap].forEach(c =>
      c.querySelectorAll('mark.pkw').forEach(m => {
        m.style.borderBottomColor = hlOn ? '' : 'transparent';
        m.style.fontWeight        = hlOn ? '' : 'inherit';
      })
    );
  }

  // ── Model status indicator ────────────────────────────────────────────────────
  const ppModelStatus = paneEl.querySelector('#pp-model-status');
  const ppModelLabel  = paneEl.querySelector('#pp-model-label');
  let _statusFadeTimer = null;

  function setModelStatus(state, text) {
    clearTimeout(_statusFadeTimer);
    ppModelStatus.className = 'pp-model-' + state;
    ppModelStatus.style.opacity = '1';
    ppModelLabel.textContent = text;
    if (state === 'ready') {
      // Fade out after 3 s — bar stays in DOM but invisible so layout is stable
      _statusFadeTimer = setTimeout(() => { ppModelStatus.style.opacity = '0'; }, 3000);
    }
  }

  // If the model loaded before this pane was initialised (e.g. fast cache hit)
  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) {
    setModelStatus('ready', 'Semantic model ready');
  }

  window.addEventListener('embedder-ready', () => {
    setModelStatus('ready', 'Semantic model ready');
  });

  window.addEventListener('embedding-progress', e => {
    const { pct } = e.detail;
    setModelStatus('loading', 'Indexing\u2026 ' + pct + '%');
  });

  window.addEventListener('embedding-complete', e => {
    setModelStatus('ready', 'Model ready \u00b7 ' + e.detail.total + ' rows');
  });

  window.addEventListener('error', e => {
    if (e.message && e.message.toLowerCase().includes('transformers')) {
      setModelStatus('error', 'Model unavailable \u2014 keyword mode');
    }
  });

  // ── KW toggle button ─────────────────────────────────────────────────────────
  const hlBtn = document.createElement('button');
  hlBtn.className = 'pp-kw-toggle pp-kw-on';
  hlBtn.textContent = 'KW';
  hlBtn.title = 'Toggle keyword highlights';
  ppHlWrap.appendChild(hlBtn);
  hlBtn.addEventListener('click', () => {
    hlOn = !hlOn;
    hlBtn.classList.toggle('pp-kw-on',  hlOn);
    hlBtn.classList.toggle('pp-kw-off', !hlOn);
    applyHlState();
  });

  // ── Layers pill (1–5) ─────────────────────────────────────────────────────────
  const layersPill = buildPill(
    [1, 2, 3, 4, 5].map(n => ({ label: String(n), value: n })),
    v => {
      _numLayers = v;
      if (_hasContent) refreshFromSelection();
    }
  );
  ppLayersWrap.appendChild(layersPill.el);

  // ── View pill ─────────────────────────────────────────────────────────────────
  const viewPill = buildPill(
    [{ label: 'Tiles', value: 'tiles' }, { label: 'Mindmap', value: 'mindmap' }],
    v => {
      viewMode = v;
      if (v === 'mindmap') {
        ppBody.style.display   = 'none';
        ppMmWrap.style.display = 'block';
        const currentKey = lastMatches.map(m => m.tabIdx + ':' + m.rowIdx).join('|');
        if (!_mmActive || _mmMatchKey !== currentKey) {
          renderMindmap(lastMatches);
          if (_mmModeSnapshot && _mmModeSnapshot.matchKey === currentKey) {
            requestAnimationFrame(() => requestAnimationFrame(() =>
              document.dispatchEvent(new CustomEvent('mm-snapshot-restore', { detail: _mmModeSnapshot, bubbles: false }))
            ));
          }
        }
      } else {
        if (_mmActive) {
          const positions = new Map();
          _mmActive.rects.forEach((r, key) => positions.set(key, { x: r.x, y: r.y }));
          _mmModeSnapshot = { matchKey: _mmMatchKey, positions };
        }
        ppMmWrap.style.display = 'none';
        if (_hasContent) {
          const _td  = typeof TABS !== 'undefined' ? TABS[seedTabIdx] : null;
          const _tdd = _td && typeof processSheetData === 'function' ? processSheetData(_td.grid) : null;
          renderTiles(lastMatches, seedKws, seedTabIdx, _tdd);
        } else {
          ppBody.style.display = 'grid';
        }
      }
    }
  );
  ppViewWrap.appendChild(viewPill.el);

  // ── Empty state ───────────────────────────────────────────────────────────────
  function showEmpty(msg) {
    msg = msg || 'Click a cell to find matches';
    ppSubtitle.textContent  = msg;
    ppBody.innerHTML        = `<div class="pp-empty">${panelEscH(msg)}</div>`;
    ppBody.style.display    = 'grid';
    ppMmWrap.style.display  = 'none';
    ppMmWrap.innerHTML      = '';
    ppToolrow.style.display = 'none';
    _mmActive   = null;
    _hasContent = false;
    viewMode    = 'tiles';
    viewPill.setValue('tiles', false);
    layersPill.setValue(1, false);
    _numLayers  = 1;
  }
  showEmpty();

  // ── Multi-layer match builder ─────────────────────────────────────────────────
  function buildLayeredMatches(skws, stIdx, srIdx, numLayers) {
    const seen = new Set();
    seen.add(stIdx + ':' + srIdx);
    const result = [];

    let currentSeeds = [{ kws: (skws && typeof skws.has === 'function') ? skws : new Set(skws || []), tabIdx: stIdx, rowIdx: srIdx, cardKey: 'seed' }];

    for (let layer = 1; layer <= numLayers; layer++) {
      const nextSeeds = [];
      currentSeeds.forEach(seed => {
        const matches = findMatches(seed.kws, seed.tabIdx, seed.rowIdx);
        matches.forEach(m => {
          const entryKey = m.tabIdx + ':' + m.rowIdx;
          if (seen.has(entryKey)) return;
          seen.add(entryKey);

          const cardKey   = 'm-' + m.tabIdx + '-' + m.rowIdx;
          const sharedSet = (m.shared && typeof m.shared.has === 'function') ? m.shared : new Set(m.shared || []);
          const kwsSet    = (m.kws    && typeof m.kws.has    === 'function') ? m.kws    : new Set(m.kws    || []);

          result.push(Object.assign({}, m, {
            layer,
            parentKey: seed.cardKey,
            shared: sharedSet,
            kws: kwsSet,
          }));

          nextSeeds.push({ kws: kwsSet, tabIdx: m.tabIdx, rowIdx: m.rowIdx, cardKey });
        });
      });
      currentSeeds = nextSeeds;
      if (!currentSeeds.length) break;
    }
    return result;
  }

  // ── Build seed from grid selection ───────────────────────────────────────────
  function buildSeedFromSelection() {
    const curTabIdx = typeof activeTab !== 'undefined' ? activeTab : 0;
    const tab  = typeof TABS !== 'undefined' ? TABS[curTabIdx] : null;
    const data = tab && typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data) return false;

    const allDataRows  = Array.from(document.querySelectorAll('#data-body tr'));
    const selectedCols = new Map();

    allDataRows.forEach((dtr, ri) => {
      Array.from(dtr.querySelectorAll('td')).forEach((td, ci) => {
        if (td.classList.contains('selected-cell') || td.classList.contains('selected-group')) {
          if (!selectedCols.has(ri)) selectedCols.set(ri, new Set());
          selectedCols.get(ri).add(ci);
        }
      });
    });

    if (!selectedCols.size) return false;

    const allText = [], newSeedCells = [];
    const sortedRows = [...selectedCols.keys()].sort((a, b) => a - b);

    sortedRows.forEach(ri => {
      const row = data.rows[ri];
      if (!row) return;
      const cats = row.cats ? row.cats.filter(c => c.trim()) : [];
      [...selectedCols.get(ri)].sort((a, b) => a - b).forEach(ci => {
        const txt = (row.cells[ci] || '').trim();
        if (!txt) return;
        newSeedCells.push({ cats, header: data.headers[ci] || '', text: txt });
        allText.push(txt);
      });
    });

    if (!allText.length) return false;
    seedCells = newSeedCells;

    const kws = new Set(panelExtractKW(allText.join(' ')));
    if (!kws.size) return false;

    seedKws    = kws;
    seedTabIdx = curTabIdx;
    seedRowIdx = sortedRows[0];
    return true;
  }

  // ── Refresh on selection change ───────────────────────────────────────────────
  function refreshFromSelection() {
    const curTabIdx = typeof activeTab !== 'undefined' ? activeTab : 0;
    const tab  = typeof TABS !== 'undefined' ? TABS[curTabIdx] : null;
    const data = tab && typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;

    if (!buildSeedFromSelection()) {
      if (_hasContent) showEmpty('Click a cell to find matches');
      return;
    }

    lastMatches = buildLayeredMatches(seedKws, curTabIdx, seedRowIdx, _numLayers);
    _hasContent = true;
    _mmModeSnapshot = null;

    if (viewMode === 'mindmap') {
      const newKey = lastMatches.map(m => m.tabIdx + ':' + m.rowIdx).join('|');
      if (!_mmActive || _mmMatchKey !== newKey) renderMindmap(lastMatches);
    } else {
      renderTiles(lastMatches, seedKws, curTabIdx, data);
    }
  }

  // ── MutationObserver on data-body ────────────────────────────────────────────
  let _refreshTimer = null;

  function attachObserver() {
    const dataBodyEl = document.getElementById('data-body');
    if (!dataBodyEl) { setTimeout(attachObserver, 100); return; }
    new MutationObserver(mutations => {
      const relevant = mutations.some(m => {
        if (m.type !== 'attributes' || m.attributeName !== 'class' || m.target.tagName !== 'TD') return false;
        const prev = m.oldValue || '';
        return /\bselected-/.test(prev) !== (m.target.classList.contains('selected-cell') || m.target.classList.contains('selected-group'));
      });
      if (!relevant) return;
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(refreshFromSelection, 60);
    }).observe(dataBodyEl, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }
  attachObserver();

  const catBodyEl = document.getElementById('cat-body');
  if (catBodyEl) catBodyEl.addEventListener('click', e => {
    if (!e.target.closest('td')) return;
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(refreshFromSelection, 80);
  });

  // ── TILES VIEW ────────────────────────────────────────────────────────────────
  function renderTiles(matches, kws, srcTabIdx, srcData) {
    ppMmWrap.style.display = 'none';
    ppMmWrap.innerHTML     = '';
    _mmActive = null;
    if (viewMode === 'mindmap') { viewMode = 'tiles'; viewPill.setValue('tiles', false); }

    const frag       = document.createDocumentFragment();
    const vars       = panelThemeVars(srcTabIdx);
    const accentSrc  = vars['--tab-active-bg']    || '#888';
    const labelSrc   = vars['--tab-active-color'] || '#fff';
    const bgSrc      = vars['--bg-data']          || '#f8f8f8';
    const tabLabel   = (srcData && srcData.title) ? srcData.title
                       : (typeof TABS !== 'undefined' ? TABS[srcTabIdx].name : '');

    function buildSeedCard() {
      const card = document.createElement('div');
      card.className = 'pp-match-card pp-seed-card';
      card.style.setProperty('--ppc-border', accentSrc);
      card.style.setProperty('--ppc-bg',     bgSrc);
      const head = document.createElement('div');
      head.className = 'pp-card-head';
      head.innerHTML = `<span class="pp-card-badge" style="background:${accentSrc};color:${labelSrc}">Selected</span>`;
      const body = document.createElement('div');
      body.className = 'pp-card-body';
      seedCells.forEach((c, idx) => {
        if (idx > 0) { const sep = document.createElement('div'); sep.className = 'pp-seed-sep'; body.appendChild(sep); }
        if (c.cats && c.cats.length) {
          const catEl = document.createElement('div');
          catEl.className = 'pp-seed-cats';
          catEl.textContent = c.cats.join(' \u00b7 ');
          body.appendChild(catEl);
        }
        const _sc = parseCitation(c.text);
        const f   = document.createElement('div');
        f.className = 'pp-field pp-field-matched';
        f.innerHTML = `<span class="pp-flabel">${panelEscH(c.header)}</span>${panelHighlight(_sc.body, kws)}${citationPillHtml(_sc.citation, accentSrc, labelSrc)}`;
        body.appendChild(f);
      });
      card.appendChild(head);
      card.appendChild(body);
      return card;
    }

    if (!matches.length) {
      ppSubtitle.textContent  = 'No matches found';
      ppToolrow.style.display = 'flex';
      const divNone = document.createElement('div');
      divNone.className = 'pp-divider';
      divNone.style.borderColor = accentSrc;
      divNone.innerHTML = `<span style="background:${accentSrc};color:${labelSrc}">${panelEscH(tabLabel)}</span>`;
      frag.appendChild(divNone);
      frag.appendChild(buildSeedCard());
      const emptyEl = document.createElement('div');
      emptyEl.className = 'pp-empty';
      emptyEl.textContent = 'No matching entries found';
      frag.appendChild(emptyEl);
      ppBody.innerHTML = '';
      ppBody.appendChild(frag);
      ppBody.style.display = 'grid';
      scheduleUpdateGrid();
      return;
    }

    const layerStr = _numLayers > 1 ? ` \u00b7 ${_numLayers} layers` : '';
    ppSubtitle.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}${layerStr} \u00b7 ${[...kws].slice(0, 4).join(', ')}`;
    ppToolrow.style.display = 'flex';
    hlOn = true;
    hlBtn.classList.add('pp-kw-on'); hlBtn.classList.remove('pp-kw-off');

    const byTab = new Map();
    matches.forEach(m => {
      if (!byTab.has(m.tabIdx)) byTab.set(m.tabIdx, []);
      byTab.get(m.tabIdx).push(m);
    });
    if (!byTab.has(srcTabIdx)) byTab.set(srcTabIdx, []);

    byTab.forEach((arr) => {
      arr.sort((a, b) => a.layer - b.layer || b.shared.size - a.shared.size);
    });

    const sortedTabKeys = [srcTabIdx, ...[...byTab.keys()].filter(t => t !== srcTabIdx).sort()];

    sortedTabKeys.forEach(tabIdx => {
      const tabMatches  = byTab.get(tabIdx) || [];
      const tv          = panelThemeVars(tabIdx);
      const tabNameStr  = tabIdx === srcTabIdx ? tabLabel
        : ((tabMatches[0] && tabMatches[0].title) || (typeof TABS !== 'undefined' ? TABS[tabIdx].name : 'Tab ' + tabIdx));
      const accentColor = tv['--tab-active-bg'] || '#888';
      const bgColor     = tv['--bg-data']       || '#f8f8f8';

      const divider = document.createElement('div');
      divider.className = 'pp-divider';
      divider.style.borderColor = accentColor;
      divider.innerHTML = `<span style="background:${accentColor};color:${tv['--tab-active-color'] || '#fff'}">${panelEscH(tabNameStr)}</span>`;
      frag.appendChild(divider);

      if (tabIdx === srcTabIdx) frag.appendChild(buildSeedCard());

      tabMatches.forEach(m => {
        const layerOpacity = LAYER_OPACITY[m.layer - 1] !== undefined ? LAYER_OPACITY[m.layer - 1] : 0.14;

        const card = document.createElement('div');
        card.className = 'pp-match-card';
        card.style.setProperty('--ppc-border', accentColor);
        card.style.setProperty('--ppc-bg',     bgColor);
        if (m.layer > 1) card.style.setProperty('--ppc-opacity', layerOpacity);

        const head = document.createElement('div');
        head.className = 'pp-card-head';
        const cats = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];
        if (cats.length) head.innerHTML = `<span class="pp-card-dim">${cats.map(panelEscH).join(' \u00b7 ')}</span>`;

        const body = document.createElement('div');
        body.className = 'pp-card-body';
        m.row.cells.forEach((text, ci) => {
          if (!text.trim()) return;
          const _mc = parseCitation(text);
          const f   = document.createElement('div');
          f.className = 'pp-field';
          const matchedKws = new Set([...m.shared].filter(k => panelExtractKW(_mc.body).includes(k)));
          if (matchedKws.size) f.classList.add('pp-field-matched');
          f.innerHTML = `<span class="pp-flabel">${panelEscH(m.headers[ci] || '')}</span>${panelHighlight(_mc.body, matchedKws)}${citationPillHtml(_mc.citation, accentColor, tv['--tab-active-color'] || '#fff')}`;
          body.appendChild(f);
        });

        const sharedPill = document.createElement('div');
        sharedPill.className = 'pp-shared-pill';
        sharedPill.textContent = `${m.shared.size} shared: ${[...m.shared].slice(0, 3).join(', ')}`;

        card.appendChild(head);
        card.appendChild(body);
        card.appendChild(sharedPill);
        frag.appendChild(card);
        attachGoTo(card, m, accentColor);
      });
    });

    ppBody.innerHTML = '';
    ppBody.appendChild(frag);
    ppBody.style.display = 'grid';
    scheduleUpdateGrid();
    ppBody.querySelectorAll('.pp-match-card').forEach((card, i) => { card.style.animationDelay = (i * 30) + 'ms'; });
    applyHlState();
  }

  // ── MINDMAP VIEW ──────────────────────────────────────────────────────────────
  function mmW() { return ppMmWrap.clientWidth  || 300; }
  function mmH() { return ppMmWrap.clientHeight || 400; }

  function clampToCanvas(x, y, w, h) {
    return [Math.max(0, Math.min(mmW() - w, x)), Math.max(0, Math.min(mmH() - h, y))];
  }

  function renderMindmap(matches) {
    ppMmWrap.style.display = 'block';
    ppBody.style.display   = 'none';
    ppMmWrap.innerHTML     = '';
    _mmActive = null;

    if (!matches || !matches.length) {
      ppMmWrap.innerHTML = '<div class="pp-empty">No matches to map</div>';
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0';
    ppMmWrap.appendChild(svg);
    const svgTop = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgTop.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:9999';
    ppMmWrap.appendChild(svgTop);

    const cardEls = new Map(), rects = new Map(), arrowDefs = [];
    const cardColors = new Map(), collapsedHeights = new Map();
    let _mmTouchExpanded = null, _topZ = 10;
    const cardBaseZ = new Map();
    const _lockedCards = new Set();

    function isLocked(key) { return _lockedCards.has(key); }
    function setLocked(key, locked, cardEl) {
      locked ? _lockedCards.add(key) : _lockedCards.delete(key);
      if (cardEl) cardEl.classList.toggle('pp-mm-card-locked', locked);
      const lockIcon = cardEl ? cardEl.querySelector('.pp-mm-lock') : null;
      if (lockIcon) {
        lockIcon.classList.toggle('pp-mm-lock-active', locked);
        lockIcon.setAttribute('aria-label', locked ? 'Unlock card' : 'Lock card expanded');
        lockIcon.title = locked ? 'Click to unlock' : 'Click to lock expanded';
      }
    }
    function lockIconSVG(locked) {
      return locked
        ? `<svg viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.9"/><path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="6" cy="9.5" r="1" fill="white" opacity="0.8"/></svg>`
        : `<svg viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.35"/><path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.45"/><circle cx="6" cy="9.5" r="1" fill="white" opacity="0.35"/></svg>`;
    }

    function getCardRect(key) {
      const el = cardEls.get(key), r = rects.get(key);
      if (!r) return null;
      if (!el) return { x: r.x, y: r.y, w: r.w, h: r.h };
      const wrap = ppMmWrap.getBoundingClientRect(), cr = el.getBoundingClientRect();
      return { x: cr.left - wrap.left, y: cr.top - wrap.top, w: r.w, h: cr.height };
    }
    function getConnectionPoints(key) {
      const vr = getCardRect(key);
      if (!vr) return [];
      const { x, y, w: W, h: H } = vr;
      return [
        { x: x + W * 0.25, y }, { x: x + W * 0.5, y }, { x: x + W * 0.75, y },
        { x: x + W * 0.25, y: y + H }, { x: x + W * 0.5, y: y + H }, { x: x + W * 0.75, y: y + H },
        { x, y: y + H / 3 }, { x, y: y + H * 2 / 3 },
        { x: x + W, y: y + H / 3 }, { x: x + W, y: y + H * 2 / 3 },
      ];
    }
    function closestPointPair(ptsA, ptsB) {
      let best = null, bestDist = Infinity;
      ptsA.forEach(a => ptsB.forEach(b => { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bestDist) { bestDist = d; best = { a, b }; } }));
      return best;
    }
    function getEdgeTangent(pt, key) {
      const vr = getCardRect(key);
      if (!vr) return { dx: 0, dy: 1 };
      const tol = 3;
      if (Math.abs(pt.y - vr.y)          < tol) return { dx: 0, dy: -1 };
      if (Math.abs(pt.y - (vr.y + vr.h)) < tol) return { dx: 0, dy:  1 };
      if (Math.abs(pt.x - vr.x)          < tol) return { dx: -1, dy: 0 };
      if (Math.abs(pt.x - (vr.x + vr.w)) < tol) return { dx:  1, dy: 0 };
      return { dx: 0, dy: 1 };
    }
    function pushApart(skipKey) {
      for (let pass = 0; pass < PANEL_MM_ITERS; pass++) {
        let moved = false;
        for (const [ka, ra] of rects) {
          if (ka === skipKey) continue;
          for (const [kb, rb] of rects) {
            if (kb === ka) continue;
            if (!(ra.x < rb.x + rb.w + PANEL_MM_PAD && ra.x + ra.w + PANEL_MM_PAD > rb.x &&
                  ra.y < rb.y + rb.h + PANEL_MM_PAD && ra.y + ra.h + PANEL_MM_PAD > rb.y)) continue;
            const dR = rb.x + rb.w + PANEL_MM_PAD - ra.x, dL = ra.x + ra.w + PANEL_MM_PAD - rb.x;
            const dD = rb.y + rb.h + PANEL_MM_PAD - ra.y, dU = ra.y + ra.h + PANEL_MM_PAD - rb.y;
            if (Math.min(dR, dL) <= Math.min(dD, dU)) ra.x += dR < dL ? dR : -dL;
            else                                        ra.y += dD < dU ? dD : -dU;
            [ra.x, ra.y] = clampToCanvas(ra.x, ra.y, ra.w, ra.h);
            const el = cardEls.get(ka);
            if (el) { el.style.left = ra.x + 'px'; el.style.top = ra.y + 'px'; }
            moved = true;
          }
        }
        if (!moved) break;
      }
    }
    function redrawArrows() {
      while (svg.firstChild)    svg.removeChild(svg.firstChild);
      while (svgTop.firstChild) svgTop.removeChild(svgTop.firstChild);
      const ns = 'http://www.w3.org/2000/svg';
      arrowDefs.forEach(def => {
        const ptsA = getConnectionPoints(def.fromKey), ptsB = getConnectionPoints(def.toKey);
        if (!ptsA.length || !ptsB.length) return;
        const pair = closestPointPair(ptsA, ptsB);
        if (!pair) return;
        const { a, b } = pair;
        const dist = Math.hypot(b.x - a.x, b.y - a.y), offset = Math.min(dist * 0.45, 90);
        const tanA = getEdgeTangent(a, def.fromKey), tanB = getEdgeTangent(b, def.toKey);
        const layerOpacity = LAYER_OPACITY[def.layer - 1] !== undefined ? LAYER_OPACITY[def.layer - 1] : 0.14;
        const curve = document.createElementNS(ns, 'path');
        curve.setAttribute('d', `M${a.x},${a.y} C${a.x + tanA.dx * offset},${a.y + tanA.dy * offset} ${b.x + tanB.dx * offset},${b.y + tanB.dy * offset} ${b.x},${b.y}`);
        curve.setAttribute('fill', 'none');
        curve.setAttribute('stroke', def.color);
        curve.setAttribute('stroke-width', def.layer > 1 ? '1' : '1.5');
        curve.setAttribute('stroke-opacity', String(0.45 * layerOpacity));
        if (def.layer > 1) curve.setAttribute('stroke-dasharray', '5,4');
        svg.appendChild(curve);
        [[a, def.fromKey], [b, def.toKey]].forEach(([pt, k]) => {
          const colors = cardColors.get(k) || { border: def.color, bg: '#fff' };
          const circle = document.createElementNS(ns, 'circle');
          circle.setAttribute('cx', pt.x); circle.setAttribute('cy', pt.y); circle.setAttribute('r', '4');
          circle.setAttribute('fill', colors.bg); circle.setAttribute('stroke', colors.border); circle.setAttribute('stroke-width', '1.5');
          circle.setAttribute('opacity', String(layerOpacity));
          svgTop.appendChild(circle);
        });
      });
    }

    const MM_EXPAND_MS = 260, MM_HOVER_DELAY = 200;

    function mmSetExpanded(cardEl, expanded, key) {
      const btn = cardEl.querySelector('.pp-goto-btn');
      clearTimeout(cardEl._expandTimer);
      clearTimeout(cardEl._btnTimer);
      if (expanded) {
        if (cardEl._mmExpandState === 'expanded') return;
        cardEl._mmExpandState = 'expanded';
        cardEl.style.zIndex = (_topZ + 1) + '';
        if (!collapsedHeights.has(key)) collapsedHeights.set(key, cardEl.offsetHeight);
        const collH = collapsedHeights.get(key);
        cardEl.classList.add('pp-mm-expanded');
        cardEl.style.transition = 'none';
        cardEl.style.height = '';
        void cardEl.offsetHeight;
        let contentH = 0;
        Array.from(cardEl.children).forEach(child => { if (!child.classList.contains('pp-goto-btn')) contentH += child.scrollHeight; });
        const cs = getComputedStyle(cardEl);
        contentH += parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.borderBottomWidth || 0);
        cardEl.style.height = collH + 'px';
        void cardEl.offsetHeight;
        cardEl.style.transition = `height ${MM_EXPAND_MS}ms cubic-bezier(0.22,1,0.36,1)`;
        cardEl.style.height = contentH + 'px';
      } else {
        if (isLocked(key)) return;
        cardEl._mmExpandState = 'collapsed';
        void cardEl.offsetHeight;
        const curH = cardEl.getBoundingClientRect().height;
        const collH = collapsedHeights.get(key) || curH;
        cardEl.style.transition = 'none';
        cardEl.style.height = curH + 'px';
        void cardEl.offsetHeight;
        cardEl.classList.remove('pp-mm-expanded', 'pp-mm-touch-expanded');
        cardEl.style.transition = `height ${MM_EXPAND_MS}ms cubic-bezier(0.22,1,0.36,1)`;
        cardEl.style.height = collH + 'px';
        cardEl._expandTimer = setTimeout(() => {
          if (cardEl._mmExpandState !== 'collapsed') return;
          cardEl.style.transition = '';
          cardEl.style.height = '';
          cardEl.style.zIndex = (cardBaseZ.get(key) || 1) + '';
          if (btn) { btn.style.transition = btn.style.opacity = btn.style.pointerEvents = ''; btn.classList.remove('pp-goto-visible'); }
        }, MM_EXPAND_MS + 20);
      }
    }

    function makeDraggable(el, key) {
      let isDragging = false, ox = 0, oy = 0, sl = 0, st = 0, touchStartX = 0, touchStartY = 0;

      function dragStart(clientX, clientY) {
        isDragging = true; el._mmIsDragging = true;
        ox = clientX; oy = clientY;
        sl = parseFloat(el.style.left) || 0; st = parseFloat(el.style.top) || 0;
        if (!isLocked(key)) {
          const btn = el.querySelector('.pp-goto-btn');
          if (btn) btn.classList.remove('pp-goto-visible');
          clearTimeout(el._expandTimer); clearTimeout(el._btnTimer);
          el._mmExpandState = 'collapsed';
          el.classList.remove('pp-mm-expanded', 'pp-mm-touch-expanded');
          el.style.transition = 'none'; el.style.height = '';
          collapsedHeights.delete(key);
          if (_mmTouchExpanded === el) _mmTouchExpanded = null;
        }
        el.style.zIndex = (_topZ + 2) + '';
      }
      function dragMove(clientX, clientY) {
        if (!isDragging) return;
        const r = rects.get(key) || { w: PANEL_CARD_W, h: 80 };
        const [px, py] = clampToCanvas(sl + (clientX - ox), st + (clientY - oy), r.w, r.h);
        el.style.left = px + 'px'; el.style.top = py + 'px';
        rects.set(key, { x: px, y: py, w: r.w, h: r.h });
        pushApart(key); redrawArrows();
      }
      function dragEnd() {
        if (!isDragging) return;
        isDragging = false; el._mmIsDragging = false;
        _topZ++; cardBaseZ.set(key, _topZ); el.style.zIndex = _topZ + '';
        redrawArrows();
        if (isLocked(key)) { mmSetExpanded(el, true, key); return; }
        if (el.matches(':hover')) {
          clearTimeout(el._postDragExpandTimer);
          el._postDragExpandTimer = setTimeout(() => { if (!el._mmIsDragging) mmSetExpanded(el, true, key); }, MM_HOVER_DELAY);
        }
      }

      el.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.closest('.pp-mm-lock') || e.target.closest('.pp-goto-btn')) return;
        dragStart(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', e => dragMove(e.clientX, e.clientY));
      document.addEventListener('mouseup', dragEnd);

      el.addEventListener('touchstart', e => {
        if (e.touches.length !== 1 || e.target.closest('.pp-mm-lock') || e.target.closest('.pp-goto-btn')) return;
        touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
        dragStart(touchStartX, touchStartY); e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchmove', e => { if (e.touches.length !== 1) return; dragMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        const moved = Math.hypot((t ? t.clientX : touchStartX) - touchStartX, (t ? t.clientY : touchStartY) - touchStartY);
        dragEnd();
        if (moved < 8) {
          const wantsExpand = !el.classList.contains('pp-mm-touch-expanded');
          if (_mmTouchExpanded && _mmTouchExpanded !== el) {
            const prevKey = _mmTouchExpanded._mmKey;
            _mmTouchExpanded.classList.remove('pp-mm-touch-expanded');
            if (!isLocked(prevKey)) mmSetExpanded(_mmTouchExpanded, false, prevKey);
          }
          _mmTouchExpanded = wantsExpand ? el : null;
          el.classList.toggle('pp-mm-touch-expanded', wantsExpand);
          mmSetExpanded(el, wantsExpand, key);
        }
      });
      el.addEventListener('touchcancel', dragEnd);
    }

    function makeCard(text, header, tabIdx, key, isSeed, cats, kwsHL, matchObj, tabName, layer, gotoColIdx) {
      const tv = panelThemeVars(tabIdx);
      const accentColor = tv['--tab-active-bg']    || '#888';
      const labelColor  = tv['--tab-active-color'] || '#fff';
      const bgColor     = tv['--bg-data']          || '#fff';
      cardColors.set(key, { border: accentColor, bg: bgColor });

      const card = document.createElement('div');
      card.className = `pp-mm-card${isSeed ? ' pp-mm-seed' : ''}`;
      card.style.width = PANEL_CARD_W + 'px';
      card.style.setProperty('--ppc-border', accentColor);
      card.style.setProperty('--ppc-bg',     bgColor);
      if (!isSeed && layer > 1) {
        const lo = LAYER_OPACITY[layer - 1] !== undefined ? LAYER_OPACITY[layer - 1] : 0.14;
        card.style.opacity = lo;
      }

      const lockBtn = document.createElement('button');
      lockBtn.className = 'pp-mm-lock';
      lockBtn.setAttribute('aria-label', 'Lock card expanded');
      lockBtn.title = 'Click to lock expanded';
      lockBtn.innerHTML = lockIconSVG(false);
      lockBtn.style.color = labelColor;
      lockBtn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const nowLocked = !isLocked(key);
        setLocked(key, nowLocked, card);
        lockBtn.innerHTML = lockIconSVG(nowLocked);
        if (nowLocked) mmSetExpanded(card, true, key);
        else if (!card.matches(':hover')) mmSetExpanded(card, false, key);
      });

      const cardHead = document.createElement('div');
      cardHead.className = 'pp-mm-card-head';
      cardHead.style.background = accentColor;
      cardHead.style.color = labelColor;
      cardHead.innerHTML = (isSeed ? '<span class="pp-mm-badge">Selected</span>' : '') +
        `<span class="pp-mm-head-label">${panelEscH(tabName || '')}</span>`;
      cardHead.appendChild(lockBtn);

      let bodyHtml = '';
      if (isSeed) {
        const fc = seedCells[0];
        const _sfc = parseCitation(fc ? fc.text : '');
        bodyHtml =
          (fc && fc.cats && fc.cats.length ? `<div class="pp-mm-cat">${fc.cats.map(panelEscH).join(' \u00b7 ')}</div>` : '') +
          (fc ? `<div class="pp-mm-field"><span class="pp-flabel">${panelEscH(fc.header)}</span>${panelHighlight(_sfc.body, kwsHL)}${citationPillHtml(_sfc.citation, accentColor, labelColor)}</div>` : '') +
          (seedCells.length > 1 ? '<div class="pp-mm-seed-extra">' + seedCells.slice(1).map(c => {
            const _ec = parseCitation(c.text);
            return '<div class="pp-mm-seed-sep"></div>' +
              (c.cats && c.cats.length ? `<div class="pp-mm-cat">${c.cats.map(panelEscH).join(' \u00b7 ')}</div>` : '') +
              `<div class="pp-mm-field"><span class="pp-flabel">${panelEscH(c.header)}</span>${panelHighlight(_ec.body, kwsHL)}${citationPillHtml(_ec.citation, accentColor, labelColor)}</div>`;
          }).join('') + '</div>' : '');
      } else {
        const _mcc = parseCitation(text);
        bodyHtml =
          (cats && cats.length ? `<div class="pp-mm-cat">${cats.map(panelEscH).join(' \u00b7 ')}</div>` : '') +
          `<div class="pp-mm-field"><span class="pp-flabel">${panelEscH(header)}</span>${panelHighlight(_mcc.body, kwsHL)}${citationPillHtml(_mcc.citation, accentColor, labelColor)}</div>`;
      }

      const cardBody = document.createElement('div');
      cardBody.className = 'pp-mm-card-body';
      cardBody.innerHTML = bodyHtml;
      card.appendChild(cardHead);
      card.appendChild(cardBody);

      if (!isSeed && matchObj) {
        const gotoBtn = document.createElement('button');
        gotoBtn.className = 'pp-goto-btn';
        gotoBtn.title = 'Go to';
        gotoBtn.style.borderColor = accentColor;
        gotoBtn.style.color = accentColor;
        gotoBtn.addEventListener('click', e => { e.stopPropagation(); panelGoTo(matchObj, gotoColIdx); });
        gotoBtn.addEventListener('mousedown', e => e.stopPropagation());
        card.appendChild(gotoBtn);
      }

      ppMmWrap.appendChild(card);
      card._mmKey = key;
      makeDraggable(card, key);
      cardEls.set(key, card);

      let _hoverEnterTimer = null;
      card.addEventListener('mouseenter', () => {
        if (card._mmIsDragging) return;
        clearTimeout(_hoverEnterTimer);
        _hoverEnterTimer = setTimeout(() => {
          if (_mmTouchExpanded === card) { card.classList.remove('pp-mm-touch-expanded'); _mmTouchExpanded = null; }
          mmSetExpanded(card, true, key);
        }, MM_HOVER_DELAY);
      });
      card.addEventListener('mouseleave', () => {
        clearTimeout(_hoverEnterTimer);
        clearTimeout(card._postDragExpandTimer);
        if (card.classList.contains('pp-mm-touch-expanded') || isLocked(key)) return;
        mmSetExpanded(card, false, key);
      });
      if (window.ResizeObserver) new ResizeObserver(() => redrawArrows()).observe(card);
      return card;
    }

    // ── Seed card ──────────────────────────────────────────────────────────────
    const seedKey      = 'seed';
    const _seedTab     = typeof TABS !== 'undefined' ? TABS[seedTabIdx] : null;
    const _seedData    = _seedTab && typeof processSheetData === 'function' ? processSheetData(_seedTab.grid) : null;
    const _seedCats    = _seedData && _seedData.rows[seedRowIdx] ? _seedData.rows[seedRowIdx].cats.filter(c => c.trim()) : [];
    const _seedTabName = (_seedData && _seedData.title) ? _seedData.title : (_seedTab ? _seedTab.name : '');
    makeCard('', '', seedTabIdx, seedKey, true, _seedCats, seedKws, null, _seedTabName, 0);

    // ── Match cards ────────────────────────────────────────────────────────────
    matches.forEach(m => {
      const indices = Array.from({ length: m.row.cells.length }, (_, i) => i)
        .filter(ci => (m.row.cells[ci] || '').trim())
        .sort((a, b) =>
          panelExtractKW(m.row.cells[b]).filter(k => m.shared.has(k)).length -
          panelExtractKW(m.row.cells[a]).filter(k => m.shared.has(k)).length
        );
      if (!indices.length) return;

      const bestColIdx = indices[0];
      const key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
      const cats   = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];
      const tv     = panelThemeVars(m.tabIdx);
      const _mTabD = (m.tabIdx === seedTabIdx && _seedData) ? _seedData
        : (typeof TABS !== 'undefined' && typeof processSheetData === 'function' ? processSheetData(TABS[m.tabIdx].grid) : null);
      const _mTabName = (_mTabD && _mTabD.title) ? _mTabD.title
        : (typeof TABS !== 'undefined' ? TABS[m.tabIdx].name : 'Tab ' + m.tabIdx);

      makeCard(m.row.cells[bestColIdx] || '', m.headers[bestColIdx] || '', m.tabIdx, key, false, cats, m.shared, m, _mTabName, m.layer, bestColIdx);
      arrowDefs.push({ fromKey: m.parentKey, toKey: key, color: tv['--tab-active-bg'] || '#aaa', layer: m.layer });
    });

    // ── Layout cards ───────────────────────────────────────────────────────────
    requestAnimationFrame(() => {
      const W = mmW(), H = mmH(), cx = W / 2, cy = H / 2;
      const sCard = cardEls.get(seedKey);
      const sH    = sCard ? (sCard.offsetHeight || 80) : 80;
      const [sx, sy] = clampToCanvas(cx - PANEL_CARD_W / 2, cy - sH / 2, PANEL_CARD_W, sH);
      if (sCard) { sCard.style.left = sx + 'px'; sCard.style.top = sy + 'px'; }
      rects.set(seedKey, { x: sx, y: sy, w: PANEL_CARD_W, h: sH });

      const byLayer = new Map();
      matches.forEach(m => {
        if (!byLayer.has(m.layer)) byLayer.set(m.layer, []);
        byLayer.get(m.layer).push(m);
      });
      const maxLayer = matches.length ? Math.max(...matches.map(m => m.layer)) : 1;

      matches.forEach((m) => {
        const key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
        const cardEl = cardEls.get(key);
        if (!cardEl) return;

        const layerMatches = byLayer.get(m.layer) || [];
        const idxInLayer   = layerMatches.indexOf(m);
        const ringFraction = maxLayer > 1 ? 0.22 + 0.18 * m.layer : 0.33;
        const ringR        = Math.min(W, H) * ringFraction;
        const angle        = (2 * Math.PI * idxInLayer / layerMatches.length) - Math.PI / 2;
        const cH           = cardEl.offsetHeight || 80;
        let x = cx + ringR * Math.cos(angle) - PANEL_CARD_W / 2;
        let y = cy + ringR * Math.sin(angle) - cH / 2;

        for (let iter = 0; iter < PANEL_MM_ITERS; iter++) {
          let moved = false;
          for (const [, other] of rects) {
            if (!(x < other.x + other.w + PANEL_MM_PAD && x + PANEL_CARD_W + PANEL_MM_PAD > other.x &&
                  y < other.y + other.h + PANEL_MM_PAD && y + cH + PANEL_MM_PAD > other.y)) continue;
            const dR = other.x + other.w + PANEL_MM_PAD - x, dL = x + PANEL_CARD_W + PANEL_MM_PAD - other.x;
            const dD = other.y + other.h + PANEL_MM_PAD - y, dU = y + cH + PANEL_MM_PAD - other.y;
            if (Math.min(dR, dL) <= Math.min(dD, dU)) x += dR < dL ? dR : -dL;
            else                                        y += dD < dU ? dD : -dU;
            [x, y] = clampToCanvas(x, y, PANEL_CARD_W, cH);
            moved = true;
          }
          if (!moved) break;
        }
        const [fx, fy] = clampToCanvas(x, y, PANEL_CARD_W, cH);
        cardEl.style.left = fx + 'px'; cardEl.style.top = fy + 'px';
        rects.set(key, { x: fx, y: fy, w: PANEL_CARD_W, h: cH });
      });

      redrawArrows();
      _mmActive   = { rects, cardEls, arrowDefs, redrawArrows, pushApart };
      _mmMatchKey = lastMatches.map(m => m.tabIdx + ':' + m.rowIdx).join('|');
      _mmLastW = mmW(); _mmLastH = mmH();
      requestAnimationFrame(() => applyHlState());
    });
  }

  // ── Mindmap resize ────────────────────────────────────────────────────────────
  let _mmLastW = 0, _mmLastH = 0, _mmResizeRafId = null;
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (viewMode !== 'mindmap' || !_mmActive) return;
      if (_mmResizeRafId) return;
      _mmResizeRafId = requestAnimationFrame(() => {
        _mmResizeRafId = null;
        const newW = mmW(), newH = mmH();
        if (newW === _mmLastW && newH === _mmLastH) return;
        const shrinkX = newW < _mmLastW, shrinkY = newH < _mmLastH;
        _mmLastW = newW; _mmLastH = newH;
        if (!shrinkX && !shrinkY) { _mmActive.redrawArrows(); return; }
        let dirty = false;
        _mmActive.rects.forEach((r, key) => {
          const nx = Math.max(0, Math.min(newW - r.w, r.x)), ny = Math.max(0, Math.min(newH - r.h, r.y));
          if (nx !== r.x || ny !== r.y) {
            r.x = nx; r.y = ny;
            const el = _mmActive.cardEls.get(key);
            if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
            dirty = true;
          }
        });
        if (dirty) { _mmActive.pushApart(null); }
        _mmActive.redrawArrows();
      });
    }).observe(ppMmWrap);
  }

  // ── Mindmap snapshot events ───────────────────────────────────────────────────
  document.addEventListener('mm-snapshot-request', () => {
    if (!_mmActive) return;
    const positions = new Map();
    _mmActive.rects.forEach((r, key) => positions.set(key, { x: r.x, y: r.y }));
    window.__mmSnapshotData = { matchKey: _mmMatchKey, positions };
  });

  document.addEventListener('mm-snapshot-restore', e => {
    const snap = e.detail;
    if (!snap || !_mmActive || snap.matchKey !== _mmMatchKey) return;
    requestAnimationFrame(() => {
      if (!_mmActive || snap.matchKey !== _mmMatchKey) return;
      const targets = new Map();
      snap.positions.forEach((pos, key) => {
        const r = _mmActive.rects.get(key);
        if (!r) return;
        targets.set(key, { nx: Math.max(0, Math.min(mmW() - r.w, pos.x)), ny: Math.max(0, Math.min(mmH() - r.h, pos.y)) });
      });
      _mmActive.cardEls.forEach(el => { el.style.transition = 'left 0.38s cubic-bezier(0.25,1,0.5,1), top 0.38s cubic-bezier(0.25,1,0.5,1)'; });
      requestAnimationFrame(() => {
        if (!_mmActive || snap.matchKey !== _mmMatchKey) return;
        targets.forEach((t, key) => {
          const r = _mmActive.rects.get(key), el = _mmActive.cardEls.get(key);
          if (!r || !el) return;
          r.x = t.nx; r.y = t.ny; el.style.left = t.nx + 'px'; el.style.top = t.ny + 'px';
        });
        const start = performance.now();
        (function arrowRaf(now) { _mmActive.redrawArrows(); if (now - start < 480) requestAnimationFrame(arrowRaf); })(performance.now());
        setTimeout(() => { if (_mmActive) _mmActive.cardEls.forEach(el => { el.style.transition = ''; }); }, 420);
      });
    });
  });

  // ── Return API ────────────────────────────────────────────────────────────────
  return { reset: showEmpty };
}
