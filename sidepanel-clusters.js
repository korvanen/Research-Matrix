// ════════════════════════════════════════════════════════════════════════════
// sidepanel-clusters.js — "Clusters" tool
//
// Replaces the Keywords tool. Automatically runs when embeddings finish.
// Groups all rows across all tabs by top-5 dimension fingerprint using
// agglomerative clustering on dimension overlap, then renders a spatial
// mindmap where proximity = same reason for similarity.
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-clusters.js v1]');

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
  display: flex;
  flex-direction: column;
  gap: 6px;
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
#pp-cl-canvas svg.cl-svg-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible; z-index: 0;
}
#pp-cl-canvas svg.cl-svg-top {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible; z-index: 9999;
}

/* ── Cluster label bubble ── */
.pp-cl-label {
  position: absolute;
  z-index: 2;
  font-size: 8px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 20px;
  pointer-events: none;
  white-space: nowrap;
  opacity: 0.7;
  transform: translate(-50%, -50%);
}

/* ── Mini cards ── */
.pp-cl-card {
  position: absolute;
  z-index: 3;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 6px;
  background: var(--ppc-bg, #f8f8f8);
  box-shadow: 0 1px 5px rgba(0,0,0,.10);
  cursor: grab;
  user-select: none;
  overflow: hidden;
  transition: box-shadow .15s ease, opacity .18s ease;
  animation: pp-cl-fade-in .28s ease both;
}
@keyframes pp-cl-fade-in {
  from { opacity:0; transform: scale(0.85); }
  to   { opacity:1; transform: scale(1); }
}
.pp-cl-card:active { cursor: grabbing; }
.pp-cl-card:hover  { box-shadow: 0 3px 12px rgba(0,0,0,.18); z-index: 50; }

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
.pp-cl-card-body {
  padding: 2px 5px 4px;
}
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
  position: fixed;
  z-index: 9000;
  max-width: 220px;
  background: white;
  border: 1.5px solid var(--border-strong, #d0d0d0);
  border-radius: 8px;
  padding: 7px 10px;
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
  border: 1px solid rgba(0,0,0,.15);
  transition: background .12s;
}
.pp-cl-tooltip-goto:hover { background: rgba(0,0,0,.06); }

/* ── Empty / waiting state ── */
#pp-cl-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px;
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
    '</div>' +
    '<div id="pp-cl-canvas">' +
      '<div id="pp-cl-empty">Clusters will appear<br>once embeddings finish</div>' +
    '</div>' +
    '<div class="pp-cl-tooltip" id="pp-cl-tooltip">' +
      '<div class="pp-cl-tooltip-head">Entry</div>' +
      '<div class="pp-cl-tooltip-cluster" id="pp-cl-tt-cluster"></div>' +
      '<div class="pp-cl-tooltip-text"  id="pp-cl-tt-text"></div>' +
      '<div class="pp-cl-tooltip-goto"  id="pp-cl-tt-goto">Go to ↗</div>' +
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

  let _rendered = false;
  let _tooltipMatch = null;

  // ── Status helpers ────────────────────────────────────────────────────────
  function setStatus(state, text) {
    statusEl.className = 'cl-' + state;
    labelEl.textContent = text;
    if (state === 'ready') setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
    else statusEl.style.opacity = '1';
  }

  // ── Dimension fingerprint ─────────────────────────────────────────────────
  // Returns the indices of the top-N dimensions by absolute contribution.
  function topDims(vec, n) {
    n = n || 5;
    return vec
      .map((v, i) => ({ i, v: Math.abs(v) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .map(d => d.i);
  }

  // Jaccard similarity between two sets of dimension indices
  function dimJaccard(dimsA, dimsB) {
    const setA = new Set(dimsA);
    let inter = 0;
    dimsB.forEach(d => { if (setA.has(d)) inter++; });
    const union = new Set([...dimsA, ...dimsB]).size;
    return union === 0 ? 0 : inter / union;
  }

  // ── Auto-detect k via elbow on intra-cluster variance ────────────────────
  // Uses simple k-means on fingerprint Jaccard distance matrix.
  // Returns array of cluster assignments (index = row index).
  function autoCluster(rows, vectors) {
    const n = rows.length;
    if (n === 0) return [];

    // Precompute fingerprints
    const fingerprints = rows.map(r => {
      const vec = vectors.get(r.tabIdx + ':' + r.rowIdx);
      return vec ? topDims(vec, 5) : [];
    });

    // Build distance matrix (1 - jaccard)
    const dist = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        i === j ? 0 : 1 - dimJaccard(fingerprints[i], fingerprints[j])
      )
    );

    // Try k from 2 to min(12, sqrt(n)) and pick elbow
    const maxK = Math.min(12, Math.max(2, Math.round(Math.sqrt(n))));

    function kMedoids(k) {
      // Initialise medoids with k-means++ style selection
      const medoids = [Math.floor(Math.random() * n)];
      while (medoids.length < k) {
        const minDists = Array.from({ length: n }, (_, i) =>
          Math.min(...medoids.map(m => dist[i][m]))
        );
        const total = minDists.reduce((a, b) => a + b, 0);
        let r = Math.random() * total, cum = 0;
        for (let i = 0; i < n; i++) {
          cum += minDists[i];
          if (cum >= r) { medoids.push(i); break; }
        }
        if (medoids.length < k) medoids.push(Math.floor(Math.random() * n));
      }

      let assignments = new Array(n).fill(0);
      for (let iter = 0; iter < 30; iter++) {
        // Assign
        let changed = false;
        for (let i = 0; i < n; i++) {
          let best = 0, bestD = Infinity;
          medoids.forEach((m, ci) => { if (dist[i][m] < bestD) { bestD = dist[i][m]; best = ci; } });
          if (assignments[i] !== best) { assignments[i] = best; changed = true; }
        }
        if (!changed) break;
        // Update medoids
        for (let ci = 0; ci < k; ci++) {
          const members = assignments.map((a, i) => a === ci ? i : -1).filter(i => i >= 0);
          if (!members.length) continue;
          let bestMedoid = members[0], bestSum = Infinity;
          members.forEach(m => {
            const sum = members.reduce((a, other) => a + dist[m][other], 0);
            if (sum < bestSum) { bestSum = sum; bestMedoid = m; }
          });
          medoids[ci] = bestMedoid;
        }
      }

      // Intra-cluster variance
      let variance = 0;
      for (let ci = 0; ci < k; ci++) {
        const members = assignments.map((a, i) => a === ci ? i : -1).filter(i => i >= 0);
        if (members.length < 2) continue;
        members.forEach(m => members.forEach(o => { variance += dist[m][o]; }));
      }
      return { assignments, variance: variance / (n * n) };
    }

    // Run multiple times per k, pick best; find elbow
    const results = [];
    for (let k = 2; k <= maxK; k++) {
      let best = null;
      for (let trial = 0; trial < 4; trial++) {
        const r = kMedoids(k);
        if (!best || r.variance < best.variance) best = r;
      }
      results.push({ k, ...best });
    }

    // Elbow: find k where the marginal gain drops below 15% of total range
    const variances  = results.map(r => r.variance);
    const maxVar     = variances[0];
    const minVar     = variances[variances.length - 1];
    const range      = maxVar - minVar || 1;
    let chosenIdx    = 0;
    for (let i = 1; i < results.length; i++) {
      const gain = variances[i - 1] - variances[i];
      if (gain / range < 0.10) { chosenIdx = i - 1; break; }
      chosenIdx = i;
    }

    return results[chosenIdx].assignments;
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────
  function cW() { return canvas.clientWidth  || 300; }
  function cH() { return canvas.clientHeight || 400; }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(rows, vectors, assignments) {
    // Clear canvas
    canvas.querySelectorAll('.pp-cl-card, .pp-cl-label, svg').forEach(el => el.remove());
    emptyEl.style.display = 'none';

    const numClusters = Math.max(...assignments) + 1;
    const W = cW(), H = cH();

    // Cluster label letters
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Assign a colour per cluster using tab theme colours as palette
    const clusterColors = [];
    for (let ci = 0; ci < numClusters; ci++) {
      const themeIdx = ci % (typeof TAB_THEMES !== 'undefined' ? TAB_THEMES.length : 4);
      const theme    = typeof THEMES !== 'undefined'
        ? (THEMES[(typeof TAB_THEMES !== 'undefined' ? TAB_THEMES[themeIdx] : 'default')] || THEMES.default)
        : {};
      clusterColors.push({
        accent: theme['--tab-active-bg']    || '#888',
        label:  theme['--tab-active-color'] || '#fff',
        bg:     theme['--bg-data']          || '#f8f8f8',
        border: theme['--tab-active-bg']    || '#aaa',
      });
    }

    // Group rows by cluster
    const clusters = Array.from({ length: numClusters }, () => []);
    rows.forEach((r, i) => clusters[assignments[i]].push({ row: r, idx: i }));

    // Position clusters in a ring, cards within each cluster in a sub-ring
    const CARD_W = 80, CARD_H = 60;
    const PAD    = 8;

    const cardEls  = new Map(); // 'tabIdx:rowIdx' -> {el, x, y}
    const clCentres = [];

    // SVG layers
    const svgBg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgBg.className.baseVal = 'cl-svg-bg';
    const svgTop = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgTop.className.baseVal = 'cl-svg-top';
    canvas.appendChild(svgBg);

    clusters.forEach((members, ci) => {
      const clAngle   = (2 * Math.PI * ci / numClusters) - Math.PI / 2;
      const clRing    = numClusters === 1 ? 0 : Math.min(W, H) * 0.28;
      const clCx      = W / 2 + clRing * Math.cos(clAngle);
      const clCy      = H / 2 + clRing * Math.sin(clAngle);
      clCentres.push({ x: clCx, y: clCy });

      const colors = clusterColors[ci];

      // Cluster label
      const labelEl2 = document.createElement('div');
      labelEl2.className = 'pp-cl-label';
      labelEl2.textContent = 'Cluster ' + (LETTERS[ci] || ci);
      labelEl2.style.left       = clCx + 'px';
      labelEl2.style.top        = (clCy - 18) + 'px';
      labelEl2.style.background = colors.accent + '22';
      labelEl2.style.color      = colors.accent;
      labelEl2.style.border     = '1px solid ' + colors.accent + '44';
      canvas.appendChild(labelEl2);

      // Cards in sub-ring
      const subR = Math.min(60, 18 * Math.sqrt(members.length));
      members.forEach(({ row: r }, mi) => {
        const subAngle = (2 * Math.PI * mi / Math.max(members.length, 1)) - Math.PI / 2;
        let x = clCx + (members.length === 1 ? 0 : subR * Math.cos(subAngle)) - CARD_W / 2;
        let y = clCy + (members.length === 1 ? 0 : subR * Math.sin(subAngle)) - CARD_H / 2;
        x = Math.max(PAD, Math.min(W - CARD_W - PAD, x));
        y = Math.max(PAD, Math.min(H - CARD_H - PAD, y));

        const card = document.createElement('div');
        card.className = 'pp-cl-card';
        card.style.left   = x + 'px';
        card.style.top    = y + 'px';
        card.style.width  = CARD_W + 'px';
        card.style.setProperty('--ppc-border', colors.border);
        card.style.setProperty('--ppc-bg',     colors.bg);
        card.style.animationDelay = (mi * 20 + ci * 40) + 'ms';

        // Get tab name
        const tabObj  = typeof TABS !== 'undefined' ? TABS[r.tabIdx] : null;
        const tabData = tabObj && typeof processSheetData === 'function' ? processSheetData(tabObj.grid) : null;
        const tabName = (tabData && tabData.title) ? tabData.title : (tabObj ? tabObj.name : '');

        // Best cell text (longest non-empty cell)
        const cells  = r.row && r.row.cells ? r.row.cells : [];
        const cats   = r.row && r.row.cats  ? r.row.cats.filter(c => c.trim()) : [];
        const bestCell = cells.reduce((best, c) => c.length > best.length ? c : best, '');
        const _parsed  = typeof parseCitation === 'function' ? parseCitation(bestCell) : { body: bestCell };

        card.innerHTML =
          '<div class="pp-cl-card-head">' +
            '<span class="pp-cl-card-badge" style="background:' + colors.accent + ';color:' + colors.label + '">' +
              (LETTERS[ci] || ci) +
            '</span>' +
            '<span class="pp-cl-card-tab">' + (typeof panelEscH === 'function' ? panelEscH(tabName) : tabName) + '</span>' +
          '</div>' +
          '<div class="pp-cl-card-body">' +
            (cats.length ? '<div class="pp-cl-card-cat">' + cats.map(c => typeof panelEscH === 'function' ? panelEscH(c) : c).join(' · ') + '</div>' : '') +
            '<div class="pp-cl-card-text">' + (typeof panelEscH === 'function' ? panelEscH(_parsed.body) : _parsed.body) + '</div>' +
          '</div>';

        // Drag
        makeDraggable(card, r.tabIdx + ':' + r.rowIdx);

        // Hover → tooltip
        card.addEventListener('mouseenter', ev => showTooltip(ev, r, ci, colors, _parsed.body, cats, tabName));
        card.addEventListener('mousemove',  ev => moveTooltip(ev));
        card.addEventListener('mouseleave', ()  => hideTooltip());

        canvas.appendChild(card);
        cardEls.set(r.tabIdx + ':' + r.rowIdx, { el: card, x, y });
      });
    });

    canvas.appendChild(svgTop);

    // Draw subtle convex-hull blobs per cluster using SVG ellipses
    clusters.forEach((members, ci) => {
      if (members.length < 2) return;
      const colors = clusterColors[ci];
      const cx = clCentres[ci].x, cy = clCentres[ci].y;
      const subR = Math.min(60, 18 * Math.sqrt(members.length)) + CARD_W * 0.6;
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellipse.setAttribute('cx', cx);
      ellipse.setAttribute('cy', cy);
      ellipse.setAttribute('rx', subR + 10);
      ellipse.setAttribute('ry', subR + 10);
      ellipse.setAttribute('fill', colors.accent + '0d');
      ellipse.setAttribute('stroke', colors.accent + '33');
      ellipse.setAttribute('stroke-width', '1');
      svgBg.appendChild(ellipse);
    });

    subtitle.textContent = numClusters + ' clusters · ' + rows.length + ' entries across ' +
      (typeof TABS !== 'undefined' ? TABS.length : '?') + ' tabs';
    _rendered = true;
  }

  // ── Draggable cards ───────────────────────────────────────────────────────
  function makeDraggable(el, key) {
    let dragging = false, ox = 0, oy = 0, sl = 0, st = 0;
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true;
      ox = e.clientX; oy = e.clientY;
      sl = parseFloat(el.style.left) || 0;
      st = parseFloat(el.style.top)  || 0;
      el.style.zIndex = '100';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const W = cW(), H = cH();
      el.style.left = Math.max(0, Math.min(W - el.offsetWidth,  sl + e.clientX - ox)) + 'px';
      el.style.top  = Math.max(0, Math.min(H - el.offsetHeight, st + e.clientY - oy)) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = '3';
    });
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  let _ttRow = null;
  function showTooltip(e, r, ci, colors, text, cats, tabName) {
    _ttRow = r;
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ttCluster.textContent = 'Cluster ' + (LETTERS[ci] || ci);
    ttCluster.style.color = colors.accent;
    ttText.textContent    = text.slice(0, 160) + (text.length > 160 ? '…' : '');
    ttGoto.style.color    = colors.accent;
    moveTooltip(e);
    tooltip.classList.add('visible');
  }
  function moveTooltip(e) {
    const pad = 12;
    const tw = tooltip.offsetWidth || 220, th = tooltip.offsetHeight || 80;
    let lx = e.clientX + pad, ly = e.clientY + pad;
    if (lx + tw > window.innerWidth)  lx = e.clientX - tw - pad;
    if (ly + th > window.innerHeight) ly = e.clientY - th - pad;
    tooltip.style.left = lx + 'px';
    tooltip.style.top  = ly + 'px';
  }
  function hideTooltip() {
    tooltip.classList.remove('visible');
    _ttRow = null;
  }

  ttGoto.addEventListener('click', () => {
    if (!_ttRow) return;
    hideTooltip();
    if (typeof panelGoTo === 'function') {
      panelGoTo({ tabIdx: _ttRow.tabIdx, rowIdx: _ttRow.rowIdx, row: _ttRow.row, shared: new Set() }, 0);
    }
  });

  // ── Listen for embeddings-ready ───────────────────────────────────────────
  function tryRender() {
    if (_rendered) return;
    if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;

    // Access the internal vector store via keyword-utils globals
    // _embeddingVectors and _embeddingsReady are module-level in keyword-utils.js
    // We trigger via the public findMatches path to get vectors indirectly.
    // Instead, keyword-utils exposes them via embeddings-ready event timing —
    // we call buildRowIndex() and getVectors() if available.
    if (typeof buildRowIndex !== 'function') return;

    const rows = buildRowIndex();
    if (!rows.length) return;

    // Collect vectors — we need to reach into the keyword-utils store.
    // Since keyword-utils doesn't export _embeddingVectors directly, we
    // reconstruct via EmbeddingUtils cache (all rows were cached during initEmbeddings).
    setStatus('loading', 'Clustering ' + rows.length + ' entries\u2026');
    emptyEl.style.display = 'none';

    // Gather cached vectors synchronously (they're all in localStorage by now)
    const vectors = new Map();
    rows.forEach(r => {
      const cells = (r.row && r.row.cells) ? r.row.cells : (r.cells || []);
      const text  = cells.join(' ').trim();
      if (!text) return;
      // getCachedEmbedding is async, but _cacheGet is sync — access via public API
      // We'll use a small async gather then render
    });

    // Async gather all cached embeddings
    Promise.all(rows.map(r => {
      const cells = (r.row && r.row.cells) ? r.row.cells : (r.cells || []);
      const text  = cells.join(' ').trim();
      if (!text) return Promise.resolve(null);
      return window.EmbeddingUtils.getCachedEmbedding(text)
        .then(vec => ({ key: r.tabIdx + ':' + r.rowIdx, vec }))
        .catch(() => null);
    })).then(results => {
      results.forEach(res => { if (res && res.vec) vectors.set(res.key, res.vec); });

      if (!vectors.size) {
        setStatus('error', 'No vectors available');
        emptyEl.textContent = 'No embeddings found';
        emptyEl.style.display = 'flex';
        return;
      }

      // Filter rows that have vectors
      const embeddedRows = rows.filter(r => vectors.has(r.tabIdx + ':' + r.rowIdx));
      if (embeddedRows.length < 3) {
        setStatus('error', 'Not enough data to cluster');
        return;
      }

      // Run clustering (may take a moment for large datasets)
      requestAnimationFrame(() => {
        try {
          const assignments = autoCluster(embeddedRows, vectors);
          render(embeddedRows, vectors, assignments);
          setStatus('ready', 'Clustered · ' + (Math.max(...assignments) + 1) + ' groups');
        } catch (err) {
          console.error('[clusters] clustering failed:', err);
          setStatus('error', 'Clustering failed');
        }
      });
    });
  }

  // If embeddings already ready when this tool initialises
  if (window.EmbeddingUtils && window.EmbeddingUtils.isReady()) {
    setTimeout(tryRender, 100);
  }

  document.addEventListener('embeddings-ready', () => {
    setTimeout(tryRender, 100);
  });

  window.addEventListener('embedding-progress', e => {
    if (_rendered) return;
    setStatus('loading', 'Indexing\u2026 ' + e.detail.pct + '%');
  });

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    // Clusters are global / tab-independent — no reset needed on tool switch
  }

  return { reset };
}
