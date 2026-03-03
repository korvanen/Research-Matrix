// ════════════════════════════════════════════════════════════════════════════
// sidepanel-clusters.js — "Clusters" tool  v3
//
// Each cluster is a draggable NEST div. Cards live inside the nest and
// are positioned relative to it — they cannot be dragged out.
// Nests use the same push-apart collision logic as mindmap cards.
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-clusters.js v3]');

(function injectClusterStyles() {
  if (document.getElementById('pp-cluster-styles')) return;
  const s = document.createElement('style');
  s.id = 'pp-cluster-styles';
  s.textContent = `
/* ── Cluster pane layout ── */
#pp-cl-head {
  flex-shrink: 0;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));
  display: flex; flex-direction: column; gap: 6px;
}
#pp-cl-subtitle {
  font-size: 11px; font-weight: 500; color: rgba(0,0,0,.45);
  letter-spacing: .04em; line-height: 1.3; min-height: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#pp-cl-status {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  transition: opacity .6s ease, background .4s ease;
}
#pp-cl-status.cl-loading { background: rgba(0,0,0,.06); color: rgba(0,0,0,.4); }
#pp-cl-status.cl-ready   { background: rgba(60,180,100,.12); color: rgba(30,130,60,.9); }
#pp-cl-status.cl-error   { background: rgba(200,60,60,.10); color: rgba(180,40,40,.85); }
.pp-cl-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  transition: background .4s ease;
}
#pp-cl-status.cl-loading .pp-cl-dot {
  background: rgba(0,0,0,.25);
  animation: pp-cl-pulse 1.2s ease-in-out infinite;
}
#pp-cl-status.cl-ready .pp-cl-dot { background: rgba(40,160,80,.9); }
#pp-cl-status.cl-error .pp-cl-dot { background: rgba(180,40,40,.85); }
@keyframes pp-cl-pulse {
  0%,100% { opacity:.25; transform:scale(0.85); }
  50%      { opacity:1;   transform:scale(1.1); }
}

/* ── Canvas ── */
#pp-cl-canvas {
  flex: 1; min-height: 0;
  position: relative;
  overflow: hidden;
}

/* ── Nest (draggable cluster container) ── */
.pp-cl-nest {
  position: absolute;
  border-radius: 14px;
  border: 1.5px solid var(--nest-border, rgba(0,0,0,.12));
  background: var(--nest-bg, rgba(0,0,0,.03));
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
  cursor: grab;
  user-select: none;
  z-index: 1;
  box-sizing: border-box;
  animation: pp-cl-nest-in .32s cubic-bezier(0.22,1,0.36,1) both;
  transition: box-shadow .18s ease;
}
.pp-cl-nest:active { cursor: grabbing; }
.pp-cl-nest.pp-cl-nest-dragging {
  box-shadow: 0 8px 28px rgba(0,0,0,.18);
  z-index: 100;
  cursor: grabbing;
}
@keyframes pp-cl-nest-in {
  from { opacity:0; transform: scale(0.88); }
  to   { opacity:1; transform: scale(1); }
}

/* ── Nest header bar ── */
.pp-cl-nest-head {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 8px 4px;
  border-bottom: 1px solid var(--nest-border, rgba(0,0,0,.10));
  border-radius: 12px 12px 0 0;
}
.pp-cl-nest-badge {
  font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  border-radius: 20px; padding: 1px 6px; flex-shrink: 0;
}
.pp-cl-nest-count {
  font-size: 8px; font-weight: 500; letter-spacing: .04em;
  color: rgba(0,0,0,.35); flex: 1;
}

/* ── Body that holds the absolute-positioned cards ── */
.pp-cl-nest-body {
  position: relative;
}

/* ── Mini cards inside a nest ── */
.pp-cl-card {
  position: absolute;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 6px;
  background: var(--ppc-bg, #f8f8f8);
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  user-select: none;
  overflow: hidden;
  box-sizing: border-box;
  animation: pp-cl-card-in .22s ease both;
  transition: box-shadow .14s ease;
  cursor: default;
}
.pp-cl-card:hover {
  box-shadow: 0 2px 10px rgba(0,0,0,.16);
  z-index: 10;
}
@keyframes pp-cl-card-in {
  from { opacity:0; transform:scale(0.82); }
  to   { opacity:1; transform:scale(1); }
}
.pp-cl-card-head {
  padding: 2px 5px;
  display: flex; align-items: center; gap: 3px;
}
.pp-cl-card-badge {
  font-size: 7px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
  border-radius: 20px; padding: 1px 5px; flex-shrink: 0; opacity: .85;
}
.pp-cl-card-tab {
  font-size: 7px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: rgba(0,0,0,.35); flex:1; min-width:0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pp-cl-card-body { padding: 2px 5px 4px; }
.pp-cl-card-cat {
  font-size: 7px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: rgba(0,0,0,.30); margin-bottom: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pp-cl-card-text {
  font-size: 9px; line-height: 1.3; color: rgba(0,0,0,.70);
  overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* ── Hover tooltip ── */
.pp-cl-tooltip {
  position: fixed; z-index: 9000;
  max-width: 220px;
  background: white;
  border: 1.5px solid var(--border-strong, #d0d0d0);
  border-radius: 8px; padding: 7px 10px;
  box-shadow: 0 4px 18px rgba(0,0,0,.15);
  pointer-events: none;
  font-size: 10px; line-height: 1.45; color: rgba(0,0,0,.75);
  display: none;
}
.pp-cl-tooltip.visible { display: block; }
.pp-cl-tooltip-head {
  font-size: 8px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase;
  color: rgba(0,0,0,.35); margin-bottom: 4px;
}
.pp-cl-tooltip-cluster {
  font-size: 8px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase;
  margin-bottom: 3px;
}
.pp-cl-tooltip-text { margin-bottom: 2px; }
.pp-cl-tooltip-goto {
  margin-top: 5px;
  font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.4); cursor: pointer; pointer-events: auto;
  display: inline-block; padding: 2px 6px; border-radius: 4px;
  border: 1px solid rgba(0,0,0,.15); transition: background .12s;
}
.pp-cl-tooltip-goto:hover { background: rgba(0,0,0,.06); }

/* ── Cluster range controls ── */
#pp-cl-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0 2px;
}
.pp-cl-range-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pp-cl-range-label {
  font-size: 8px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
  color: rgba(0,0,0,.35); flex-shrink: 0; width: 26px;
}
.pp-cl-range-val {
  font-size: 9px; font-weight: 700; letter-spacing: .04em;
  color: rgba(0,0,0,.55); flex-shrink: 0; width: 14px; text-align: right;
}
.pp-cl-range {
  -webkit-appearance: none; appearance: none;
  flex: 1; height: 3px; border-radius: 2px;
  background: rgba(0,0,0,.12); outline: none; cursor: pointer;
}
.pp-cl-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--color-topbar-sheet, #111);
  box-shadow: 0 1px 4px rgba(0,0,0,.20);
  cursor: pointer; transition: transform .12s ease;
}
.pp-cl-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
.pp-cl-range::-moz-range-thumb {
  width: 12px; height: 12px; border-radius: 50%; border: none;
  background: var(--color-topbar-sheet, #111);
  box-shadow: 0 1px 4px rgba(0,0,0,.20); cursor: pointer;
}
#pp-cl-recluster {
  margin-top: 2px;
  align-self: flex-start;
  border: none; border-radius: 5px;
  padding: 3px 9px;
  font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  background: rgba(0,0,0,.07); color: rgba(0,0,0,.45);
  cursor: pointer; transition: background .12s, color .12s;
}
#pp-cl-recluster:hover { background: rgba(0,0,0,.13); color: rgba(0,0,0,.75); }
#pp-cl-recluster:disabled { opacity: .35; cursor: default; }

/* ── Empty state ── */
#pp-cl-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.25); text-align: center; padding: 24px;
  pointer-events: none;
}
`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════════════════
function initClustersTool(paneEl, sidebarEl) {

  paneEl.innerHTML =
    '<div id="pp-cl-head">' +
      '<div id="pp-cl-subtitle">Waiting for embeddings\u2026</div>' +
      '<div id="pp-cl-status" class="cl-loading">' +
        '<div class="pp-cl-dot"></div>' +
        '<span id="pp-cl-label">Embeddings loading\u2026</span>' +
      '</div>' +
      '<div id="pp-cl-controls">' +
        '<div class="pp-cl-range-row">' +
          '<span class="pp-cl-range-label">Min</span>' +
          '<input class="pp-cl-range" id="pp-cl-min" type="range" min="2" max="16" value="2" step="1">' +
          '<span class="pp-cl-range-val" id="pp-cl-min-val">2</span>' +
        '</div>' +
        '<div class="pp-cl-range-row">' +
          '<span class="pp-cl-range-label">Max</span>' +
          '<input class="pp-cl-range" id="pp-cl-max" type="range" min="2" max="16" value="12" step="1">' +
          '<span class="pp-cl-range-val" id="pp-cl-max-val">12</span>' +
        '</div>' +
        '<button id="pp-cl-recluster" disabled>Re-cluster</button>' +
      '</div>' +
    '</div>' +
    '<div id="pp-cl-canvas">' +
      '<div id="pp-cl-empty">Clusters will appear<br>once embeddings finish</div>' +
    '</div>' +
    '<div class="pp-cl-tooltip" id="pp-cl-tooltip">' +
      '<div class="pp-cl-tooltip-head">Entry</div>' +
      '<div class="pp-cl-tooltip-cluster" id="pp-cl-tt-cluster"></div>' +
      '<div class="pp-cl-tooltip-text"   id="pp-cl-tt-text"></div>' +
      '<div class="pp-cl-tooltip-goto"   id="pp-cl-tt-goto">Go to \u2197</div>' +
    '</div>';

  const subtitle  = paneEl.querySelector('#pp-cl-subtitle');
  const statusEl  = paneEl.querySelector('#pp-cl-status');
  const labelEl   = paneEl.querySelector('#pp-cl-label');
  const canvas    = paneEl.querySelector('#pp-cl-canvas');
  const emptyEl   = paneEl.querySelector('#pp-cl-empty');
  const tooltip   = document.getElementById('pp-cl-tooltip');
  const ttCluster = document.getElementById('pp-cl-tt-cluster');
  const ttText    = document.getElementById('pp-cl-tt-text');
  const ttGoto    = document.getElementById('pp-cl-tt-goto');

  const minSlider  = paneEl.querySelector('#pp-cl-min');
  const maxSlider  = paneEl.querySelector('#pp-cl-max');
  const minVal     = paneEl.querySelector('#pp-cl-min-val');
  const maxVal     = paneEl.querySelector('#pp-cl-max-val');
  const reclusterBtn = paneEl.querySelector('#pp-cl-recluster');

  // ── Range control state ───────────────────────────────────────────────────
  let _clusterMin = 2;
  let _clusterMax = 12;

  function syncSliders() {
    // Enforce min <= max
    if (+minSlider.value > +maxSlider.value) maxSlider.value = minSlider.value;
    if (+maxSlider.value < +minSlider.value) minSlider.value = maxSlider.value;
    _clusterMin = +minSlider.value;
    _clusterMax = +maxSlider.value;
    minVal.textContent = _clusterMin;
    maxVal.textContent = _clusterMax;
  }

  minSlider.addEventListener('input', () => { syncSliders(); if (_rendered) reclusterBtn.disabled = false; });
  maxSlider.addEventListener('input', () => { syncSliders(); if (_rendered) reclusterBtn.disabled = false; });

  reclusterBtn.addEventListener('click', () => {
    reclusterBtn.disabled = true;
    _rendered = false;
    tryRender();
  });

  const LETTERS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CARD_W   = 80;
  const CARD_H   = 60;
  const NEST_PAD = 8;
  const NEST_GAP = 6;
  const MM_PAD   = 14;  // collision buffer between nests
  const MM_ITERS = 30;

  let _rendered = false;
  let _ttRow    = null;
  let _cachedEmbedded = null;  // saved after first fetch so Re-cluster is instant
  let _cachedVectors  = null;

  // ── Canvas size ───────────────────────────────────────────────────────────
  function cW() { return canvas.clientWidth  || 320; }
  function cH() { return canvas.clientHeight || 440; }

  // ── Status bar ────────────────────────────────────────────────────────────
  function setStatus(state, text) {
    statusEl.className = 'cl-' + state;
    labelEl.textContent = text;
    statusEl.style.opacity = '1';
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
  }

  // ── Dimension fingerprint helpers ─────────────────────────────────────────
  function topDims(vec, n) {
    return vec
      .map((v, i) => ({ i, v: Math.abs(v) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, n || 5)
      .map(d => d.i);
  }

  function dimJaccard(a, b) {
    const sa = new Set(a); let inter = 0;
    b.forEach(d => { if (sa.has(d)) inter++; });
    return new Set([...a, ...b]).size === 0 ? 0 : inter / new Set([...a, ...b]).size;
  }

  // ── k-Medoids with elbow auto-select ─────────────────────────────────────
  function autoCluster(rows, vectors, clMin, clMax) {
    const n = rows.length;
    if (n === 0) return [];

    const fps = rows.map(r => {
      const vec = vectors.get(r.tabIdx + ':' + r.rowIdx);
      return vec ? topDims(vec, 5) : [];
    });

    const dist = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        i === j ? 0 : 1 - dimJaccard(fps[i], fps[j])
      )
    );

    // Respect user-supplied min/max, still cap at √n as a sanity ceiling
    const sqrtN = Math.max(2, Math.round(Math.sqrt(n)));
    const minK  = Math.max(2, clMin || 2);
    const maxK  = Math.min(clMax || 12, sqrtN * 2); // allow up to 2×√n so user can push higher

    function kMedoids(k) {
      // k-means++ seed
      const meds = [Math.floor(Math.random() * n)];
      while (meds.length < k) {
        const md = Array.from({ length: n }, (_, i) => Math.min(...meds.map(m => dist[i][m])));
        const tot = md.reduce((a, b) => a + b, 0);
        let r = Math.random() * tot, cum = 0;
        let added = false;
        for (let i = 0; i < n; i++) { cum += md[i]; if (cum >= r) { meds.push(i); added = true; break; } }
        if (!added) meds.push(Math.floor(Math.random() * n));
      }
      let asgn = new Array(n).fill(0);
      for (let iter = 0; iter < 30; iter++) {
        let changed = false;
        for (let i = 0; i < n; i++) {
          let best = 0, bd = Infinity;
          meds.forEach((m, ci) => { if (dist[i][m] < bd) { bd = dist[i][m]; best = ci; } });
          if (asgn[i] !== best) { asgn[i] = best; changed = true; }
        }
        if (!changed) break;
        for (let ci = 0; ci < k; ci++) {
          const mb = asgn.map((a, i) => a === ci ? i : -1).filter(x => x >= 0);
          if (!mb.length) continue;
          let bm = mb[0], bs = Infinity;
          mb.forEach(m => { const s = mb.reduce((a, o) => a + dist[m][o], 0); if (s < bs) { bs = s; bm = m; } });
          meds[ci] = bm;
        }
      }
      let variance = 0;
      for (let ci = 0; ci < k; ci++) {
        const mb = asgn.map((a, i) => a === ci ? i : -1).filter(x => x >= 0);
        if (mb.length < 2) continue;
        mb.forEach(m => mb.forEach(o => { variance += dist[m][o]; }));
      }
      return { asgn, variance: variance / (n * n) };
    }

    const results = [];
    for (let k = minK; k <= maxK; k++) {
      let best = null;
      for (let t = 0; t < 4; t++) { const r = kMedoids(k); if (!best || r.variance < best.variance) best = r; }
      results.push({ k, ...best });
    }
    const vars  = results.map(r => r.variance);
    const range = (vars[0] - vars[vars.length - 1]) || 1;
    let ci = 0;
    for (let i = 1; i < results.length; i++) {
      if ((vars[i - 1] - vars[i]) / range < 0.10) { ci = i - 1; break; }
      ci = i;
    }
    // Never go below the user's minimum
    ci = Math.max(ci, 0); // ci is index into results which starts at minK
    return results[ci].asgn;
  }

  // ── Push-apart collision (mirrors mindmap logic exactly) ──────────────────
  function pushApart(nestRects, skipId) {
    for (let pass = 0; pass < MM_ITERS; pass++) {
      let moved = false;
      for (const [idA, rA] of nestRects) {
        if (idA === skipId) continue;
        for (const [idB, rB] of nestRects) {
          if (idB === idA) continue;
          if (!(rA.x < rB.x + rB.w + MM_PAD && rA.x + rA.w + MM_PAD > rB.x &&
                rA.y < rB.y + rB.h + MM_PAD && rA.y + rA.h + MM_PAD > rB.y)) continue;
          const dR = rB.x + rB.w + MM_PAD - rA.x, dL = rA.x + rA.w + MM_PAD - rB.x;
          const dD = rB.y + rB.h + MM_PAD - rA.y, dU = rA.y + rA.h + MM_PAD - rB.y;
          if (Math.min(dR, dL) <= Math.min(dD, dU)) rA.x += dR < dL ? dR : -dL;
          else                                        rA.y += dD < dU ? dD : -dU;
          rA.x = Math.max(0, Math.min(cW() - rA.w, rA.x));
          rA.y = Math.max(0, Math.min(cH() - rA.h, rA.y));
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function applyPositions(nestEls, nestRects) {
    nestEls.forEach((el, id) => {
      const r = nestRects.get(id);
      if (r) { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; }
    });
  }

  // ── Layout cards in a grid inside the nest body ───────────────────────────
  function layoutCards(cardEls, bodyEl) {
    const count = cardEls.length;
    const cols  = Math.ceil(Math.sqrt(count));
    const cw    = CARD_W + NEST_GAP;
    const ch    = CARD_H + NEST_GAP;
    const rows  = Math.ceil(count / cols);
    const totalW = cols * cw - NEST_GAP + NEST_PAD * 2;
    const totalH = rows * ch - NEST_GAP + NEST_PAD * 2;

    cardEls.forEach((el, i) => {
      el.style.left  = (NEST_PAD + (i % cols) * cw) + 'px';
      el.style.top   = (NEST_PAD + Math.floor(i / cols) * ch) + 'px';
      el.style.width = CARD_W + 'px';
      el.style.animationDelay = (i * 18) + 'ms';
    });

    bodyEl.style.width  = totalW + 'px';
    bodyEl.style.height = totalH + 'px';
    return { w: totalW, h: totalH };
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function render(rows, vectors, assignments) {
    Array.from(canvas.children).forEach(c => { if (c !== emptyEl) c.remove(); });
    emptyEl.style.display = 'none';

    const numClusters = Math.max(...assignments) + 1;
    const W = cW(), H = cH();

    // Build colour palette from tab themes
    const palette = [];
    for (let ci = 0; ci < numClusters; ci++) {
      const tname = (typeof TAB_THEMES !== 'undefined' ? TAB_THEMES[ci % TAB_THEMES.length] : 'default') || 'default';
      const theme = (typeof THEMES !== 'undefined' ? (THEMES[tname] || THEMES.default) : {}) || {};
      palette.push({
        accent: theme['--tab-active-bg']    || '#888',
        label:  theme['--tab-active-color'] || '#fff',
        bg:     theme['--bg-data']          || '#f8f8f8',
      });
    }

    // Group rows per cluster
    const groups = Array.from({ length: numClusters }, () => []);
    rows.forEach((r, i) => groups[assignments[i]].push(r));

    const nestEls   = new Map();
    const nestRects = new Map();
    const esc = typeof panelEscH === 'function' ? panelEscH : t => String(t);

    groups.forEach((members, ci) => {
      const col    = palette[ci];
      const nestId = 'nest-' + ci;

      // ── Build nest shell ─────────────────────────────────────────────────
      const nest = document.createElement('div');
      nest.className = 'pp-cl-nest';
      nest.style.setProperty('--nest-border', col.accent + '55');
      nest.style.setProperty('--nest-bg',     col.accent + '0c');
      nest.style.animationDelay = (ci * 50) + 'ms';

      const head = document.createElement('div');
      head.className  = 'pp-cl-nest-head';
      head.style.background = col.accent + '1a';
      head.innerHTML =
        '<span class="pp-cl-nest-badge" style="background:' + col.accent + ';color:' + col.label + '">' +
          'Cluster ' + (LETTERS[ci] || ci) +
        '</span>' +
        '<span class="pp-cl-nest-count">' + members.length + ' entr' + (members.length === 1 ? 'y' : 'ies') + '</span>';
      nest.appendChild(head);

      const body = document.createElement('div');
      body.className = 'pp-cl-nest-body';
      nest.appendChild(body);

      // ── Build cards inside body ──────────────────────────────────────────
      const cardElList = members.map(r => {
        const tabObj  = typeof TABS !== 'undefined' ? TABS[r.tabIdx] : null;
        const tabData = tabObj && typeof processSheetData === 'function' ? processSheetData(tabObj.grid) : null;
        const tabName = (tabData && tabData.title) ? tabData.title : (tabObj ? tabObj.name : '');
        const cells   = r.row && r.row.cells ? r.row.cells : [];
        const cats    = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
        const best    = cells.reduce((b, c) => c.length > b.length ? c : b, '');
        const parsed  = typeof parseCitation === 'function' ? parseCitation(best) : { body: best };

        const card = document.createElement('div');
        card.className = 'pp-cl-card';
        card.style.setProperty('--ppc-border', col.accent + '88');
        card.style.setProperty('--ppc-bg',     col.bg);
        card.innerHTML =
          '<div class="pp-cl-card-head">' +
            '<span class="pp-cl-card-badge" style="background:' + col.accent + ';color:' + col.label + '">' +
              (LETTERS[ci] || ci) +
            '</span>' +
            '<span class="pp-cl-card-tab">' + esc(tabName) + '</span>' +
          '</div>' +
          '<div class="pp-cl-card-body">' +
            (cats.length ? '<div class="pp-cl-card-cat">' + cats.map(esc).join(' \u00b7 ') + '</div>' : '') +
            '<div class="pp-cl-card-text">' + esc(parsed.body) + '</div>' +
          '</div>';

        card.addEventListener('mouseenter', ev => showTooltip(ev, r, ci, col, parsed.body, cats, tabName));
        card.addEventListener('mousemove',  ev => moveTooltip(ev));
        card.addEventListener('mouseleave', ()  => hideTooltip());

        body.appendChild(card);
        return card;
      });

      // Layout cards, get nest dimensions
      const { w: bodyW, h: bodyH } = layoutCards(cardElList, body);
      const headH = 28;
      const nestW = bodyW;
      const nestH = headH + bodyH;
      nest.style.width = nestW + 'px';

      // Initial ring position
      const angle = (2 * Math.PI * ci / numClusters) - Math.PI / 2;
      const ringR = numClusters === 1 ? 0 : Math.min(W, H) * 0.28;
      let nx = Math.max(0, Math.min(W - nestW, W / 2 + ringR * Math.cos(angle) - nestW / 2));
      let ny = Math.max(0, Math.min(H - nestH, H / 2 + ringR * Math.sin(angle) - nestH / 2));

      nest.style.left = nx + 'px';
      nest.style.top  = ny + 'px';

      canvas.appendChild(nest);
      nestEls.set(nestId, nest);
      nestRects.set(nestId, { x: nx, y: ny, w: nestW, h: nestH });

      // Wire up dragging for this nest
      makeNestDraggable(nest, nestId, nestEls, nestRects);
    });

    // After first paint, re-measure actual heights and run collision pass
    requestAnimationFrame(() => {
      nestEls.forEach((el, id) => {
        const r = nestRects.get(id);
        const measured = el.getBoundingClientRect().height;
        if (measured > 0) r.h = measured;
      });
      pushApart(nestRects, null);
      applyPositions(nestEls, nestRects);
    });

    subtitle.textContent =
      numClusters + ' cluster' + (numClusters === 1 ? '' : 's') +
      ' \u00b7 ' + rows.length + ' entries \u00b7 ' +
      (typeof TABS !== 'undefined' ? TABS.length : '?') + ' tab' +
      (typeof TABS !== 'undefined' && TABS.length !== 1 ? 's' : '');
    _rendered = true;
  }

  // ── Nest dragging with live collision push ────────────────────────────────
  function makeNestDraggable(nestEl, nestId, nestEls, nestRects) {
    let dragging = false, ox = 0, oy = 0, sl = 0, st = 0;

    function start(clientX, clientY, target) {
      if (target && target.closest('.pp-cl-card')) return false; // cards are not draggable
      dragging = true;
      ox = clientX; oy = clientY;
      const r = nestRects.get(nestId);
      sl = r ? r.x : parseFloat(nestEl.style.left) || 0;
      st = r ? r.y : parseFloat(nestEl.style.top)  || 0;
      nestEl.classList.add('pp-cl-nest-dragging');
      return true;
    }
    function move(clientX, clientY) {
      if (!dragging) return;
      const r = nestRects.get(nestId);
      if (!r) return;
      const nx = Math.max(0, Math.min(cW() - r.w, sl + clientX - ox));
      const ny = Math.max(0, Math.min(cH() - r.h, st + clientY - oy));
      r.x = nx; r.y = ny;
      nestEl.style.left = nx + 'px';
      nestEl.style.top  = ny + 'px';
      pushApart(nestRects, nestId);
      applyPositions(nestEls, nestRects);
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      nestEl.classList.remove('pp-cl-nest-dragging');
      pushApart(nestRects, null);
      applyPositions(nestEls, nestRects);
    }

    nestEl.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (start(e.clientX, e.clientY, e.target)) e.preventDefault();
    });
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('mouseup',   end);

    nestEl.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      if (start(e.touches[0].clientX, e.touches[0].clientY, e.target)) e.preventDefault();
    }, { passive: false });
    nestEl.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      move(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });
    nestEl.addEventListener('touchend', end);
    nestEl.addEventListener('touchcancel', end);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  function showTooltip(e, r, ci, col, text, cats, tabName) {
    _ttRow = r;
    ttCluster.textContent = 'Cluster ' + (LETTERS[ci] || ci);
    ttCluster.style.color = col.accent;
    ttText.textContent    = text.slice(0, 160) + (text.length > 160 ? '\u2026' : '');
    ttGoto.style.color    = col.accent;
    moveTooltip(e);
    tooltip.classList.add('visible');
  }
  function moveTooltip(e) {
    const pad = 12, tw = tooltip.offsetWidth || 220, th = tooltip.offsetHeight || 80;
    let lx = e.clientX + pad, ly = e.clientY + pad;
    if (lx + tw > window.innerWidth)  lx = e.clientX - tw - pad;
    if (ly + th > window.innerHeight) ly = e.clientY - th - pad;
    tooltip.style.left = lx + 'px'; tooltip.style.top = ly + 'px';
  }
  function hideTooltip() { tooltip.classList.remove('visible'); _ttRow = null; }

  ttGoto.addEventListener('click', () => {
    if (!_ttRow) return;
    hideTooltip();
    if (typeof panelGoTo === 'function')
      panelGoTo({ tabIdx: _ttRow.tabIdx, rowIdx: _ttRow.rowIdx, row: _ttRow.row, shared: new Set() }, 0);
  });

  // ── Wait for embeddings then cluster ─────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
    if (typeof buildRowIndex !== 'function') return;

    // If we already have cached data (re-cluster triggered by slider), skip fetch
    if (_cachedEmbedded && _cachedVectors) {
      requestAnimationFrame(() => {
        try {
          const asgn = autoCluster(_cachedEmbedded, _cachedVectors, _clusterMin, _clusterMax);
          render(_cachedEmbedded, _cachedVectors, asgn);
          setStatus('ready', 'Clustered \u00b7 ' + (Math.max(...asgn) + 1) + ' groups');
          reclusterBtn.disabled = false;
        } catch (err) {
          console.error('[clusters] re-cluster failed:', err);
          setStatus('error', 'Clustering failed');
        }
      });
      return;
    }

    const rows = buildRowIndex();
    if (!rows.length) return;

    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026');
    emptyEl.style.display = 'none';

    Promise.all(rows.map(r => {
      const text = ((r.row && r.row.cells) ? r.row.cells : (r.cells || [])).join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx + ':' + r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      const vectors = new Map();
      results.forEach(res => { if (res && res.vec) vectors.set(res.key, res.vec); });

      if (!vectors.size) {
        setStatus('error', 'No vectors available');
        emptyEl.textContent = 'No embeddings found';
        emptyEl.style.display = 'flex';
        return;
      }

      const embedded = rows.filter(r => vectors.has(r.tabIdx + ':' + r.rowIdx));
      if (embedded.length < 3) { setStatus('error', 'Not enough data to cluster'); return; }

      // Cache for instant re-clustering
      _cachedEmbedded = embedded;
      _cachedVectors  = vectors;

      requestAnimationFrame(() => {
        try {
          const asgn = autoCluster(embedded, vectors, _clusterMin, _clusterMax);
          render(embedded, vectors, asgn);
          setStatus('ready', 'Clustered \u00b7 ' + (Math.max(...asgn) + 1) + ' groups');
          reclusterBtn.disabled = false;
        } catch (err) {
          console.error('[clusters] failed:', err);
          setStatus('error', 'Clustering failed');
        }
      });
    });
  }

  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) setTimeout(tryRender, 100);
  document.addEventListener('embeddings-ready', () => setTimeout(tryRender, 100));
  window.addEventListener('embedding-progress', e => {
    if (!_rendered) setStatus('loading', 'Indexing\u2026 ' + e.detail.pct + '%');
  });

  return { reset() {} };
}
