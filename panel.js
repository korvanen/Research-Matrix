// ════════════════════════════════════════════════════════════════════════════
// panel.js — Results panel for sidebar-box
// Depends on: script.js globals (TABS, activeTab, processSheetData, THEMES,
//             TAB_THEMES, makeTheme, modifyColor)
// Link in HTML *after* script.js:
//   <script src="script.js"></script>
//   <script src="panel.js"></script>
// ════════════════════════════════════════════════════════════════════════════

// ── SETTINGS ────────────────────────────────────────────────────────────────
const PANEL_KW_MIN_WORD_LEN = 4;   // ignore words shorter than this
const PANEL_MIN_SHARED      = 2;   // minimum shared keywords to count as a match
const PANEL_MM_PAD          = 10;  // mindmap card collision padding px
const PANEL_MM_ITERS        = 20;  // collision resolution iterations
const PANEL_CARD_W          = 170; // mindmap card width px

const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── INIT: wait for DOM + script.js to finish ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Poll until script.js has initialised the sidebarBox element
  const wait = setInterval(() => {
    const box = document.getElementById('sidebar-box');
    if (!box) return;
    clearInterval(wait);
    initPanel(box);
  }, 50);
});

// ── HELPERS ──────────────────────────────────────────────────────────────────
function panelEscH(t) {
  return String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function panelExtractKW(text) {
  return [...new Set(
    String(text).toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(w))
      .map(w => w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  )];
}

function panelHighlight(text, kwSet) {
  if (!kwSet || !kwSet.size) return panelEscH(text);
  const pat = new RegExp(
    `\\b(${[...kwSet].map(k => k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`, 'gi'
  );
  return panelEscH(text).replace(pat, m => `<mark class="pkw">${m}</mark>`);
}

// Get theme colors for a given tab index
function panelThemeVars(tabIdx) {
  const name = (typeof TAB_THEMES !== 'undefined' && TAB_THEMES[tabIdx]) || 'default';
  return (typeof THEMES !== 'undefined' && (THEMES[name] || THEMES.default)) || {};
}

// ── KEYWORD SEARCH ENGINE ────────────────────────────────────────────────────
// Collects all rows across all tabs with their keyword sets
function buildRowIndex() {
  if (typeof TABS === 'undefined' || !TABS.length) return [];
  const rows = [];
  TABS.forEach((tab, tabIdx) => {
    const data = (typeof processSheetData === 'function') ? processSheetData(tab.grid) : null;
    if (!data) return;
    data.rows.forEach((row, rowIdx) => {
      const allText = row.cells.join(' ');
      const kws = new Set(panelExtractKW(allText));
      rows.push({ tabIdx, rowIdx, row, headers: data.headers, title: data.title || tab.name, kws });
    });
  });
  return rows;
}

// Find matches for a seed set of keywords
function findMatches(seedKws, seedTabIdx, seedRowIdx) {
  const index = buildRowIndex();
  const matches = [];
  index.forEach(entry => {
    // Skip the exact seed row
    if (entry.tabIdx === seedTabIdx && entry.rowIdx === seedRowIdx) return;
    const shared = new Set([...seedKws].filter(k => entry.kws.has(k)));
    if (shared.size < PANEL_MIN_SHARED) return;
    matches.push({ ...entry, shared });
  });
  // Sort by shared count desc
  matches.sort((a, b) => b.shared.size - a.shared.size);
  return matches;
}

// ── PILL TOGGLE BUILDER ──────────────────────────────────────────────────────
function buildPill(options, onSwitch) {
  // options: [{label, value}]
  // returns { el, setValue(v) }
  const wrap = document.createElement('div');
  wrap.className = 'pp-pill';
  const ind = document.createElement('div');
  ind.className = 'pp-ind';
  wrap.appendChild(ind);
  const btns = {};
  options.forEach(({ label, value }) => {
    const b = document.createElement('button');
    b.className = 'pp-btn';
    b.textContent = label;
    b.addEventListener('click', () => { setValue(value); onSwitch(value); });
    wrap.appendChild(b);
    btns[value] = b;
  });
  let current = options[0].value;
  function setValue(v, animate = true) {
    current = v;
    Object.entries(btns).forEach(([bv, b]) => b.classList.toggle('active', bv === v));
    const activeBtn = btns[v];
    if (!activeBtn) return;
    if (!animate) ind.style.transition = 'none';
    ind.style.left  = activeBtn.offsetLeft + 'px';
    ind.style.width = activeBtn.offsetWidth + 'px';
    if (!animate) requestAnimationFrame(() => { ind.style.transition = ''; });
  }
  setValue(options[0].value, false);
  if (window.ResizeObserver) {
    new ResizeObserver(() => setValue(current, false)).observe(wrap);
  }
  return { el: wrap, setValue };
}

// ── MAIN INIT ────────────────────────────────────────────────────────────────
function initPanel(sidebarBox) {

  // Make the sidebar-box interactive
  sidebarBox.style.pointerEvents = 'auto';
  sidebarBox.style.overflow      = 'hidden';
  sidebarBox.style.display       = 'flex';
  sidebarBox.style.flexDirection = 'column';

  // ── Build DOM structure ──────────────────────────────────────────────────
  sidebarBox.innerHTML = `
    <div id="pp-head">
      <div id="pp-subtitle">Click a cell to find matches</div>
      <div id="pp-toolrow" style="display:none">
        <div id="pp-hl-wrap"></div>
        <div id="pp-view-wrap"></div>
      </div>
    </div>
    <div id="pp-body-wrap">
      <div id="pp-body"></div>
      <div id="pp-mm-wrap"></div>
    </div>
  `;

  const ppHead     = document.getElementById('pp-head');
  const ppSubtitle = document.getElementById('pp-subtitle');
  const ppToolrow  = document.getElementById('pp-toolrow');
  const ppHlWrap   = document.getElementById('pp-hl-wrap');
  const ppViewWrap = document.getElementById('pp-view-wrap');
  const ppBodyWrap = document.getElementById('pp-body-wrap');
  const ppBody     = document.getElementById('pp-body');
  const ppMmWrap   = document.getElementById('pp-mm-wrap');

  // ── State ────────────────────────────────────────────────────────────────
  let hlOn       = true;
  let viewMode   = 'tiles'; // 'tiles' | 'mindmap'
  let seedKws    = new Set();
  let seedTabIdx = -1;
  let seedRowIdx = -1;
  let seedCells  = [];      // [{header, text}]
  let lastMatches = [];

  // ── Pills ────────────────────────────────────────────────────────────────
  const hlPill = buildPill(
    [{ label: 'Show Keywords', value: 'show' }, { label: 'Hide Keywords', value: 'hide' }],
    v => { hlOn = v === 'show'; applyHlState(); }
  );
  ppHlWrap.appendChild(hlPill.el);

  const viewPill = buildPill(
    [{ label: 'Tiles', value: 'tiles' }, { label: 'Mindmap', value: 'mindmap' }],
    v => {
      viewMode = v;
      if (v === 'mindmap') {
        ppBody.style.display   = 'none';
        ppMmWrap.style.display = 'block';
        renderMindmap(lastMatches);
      } else {
        ppBody.style.display   = 'block';
        ppMmWrap.style.display = 'none';
      }
    }
  );
  ppViewWrap.appendChild(viewPill.el);

  function applyHlState() {
    ppBody.querySelectorAll('mark.pkw').forEach(m => {
      m.style.borderBottomColor = hlOn ? '' : 'transparent';
      m.style.fontWeight        = hlOn ? '' : 'inherit';
    });
  }

  function showEmpty(msg) {
    ppSubtitle.textContent      = msg || 'Click a cell to find matches';
    ppBody.innerHTML            = `<div class="pp-empty">${panelEscH(msg || 'Click a cell to find matches')}</div>`;
    ppBody.style.display        = 'block';
    ppMmWrap.style.display      = 'none';
    ppMmWrap.innerHTML          = '';
    ppToolrow.style.display     = 'none';
    viewMode = 'tiles';
    viewPill.setValue('tiles', false);
  }

  showEmpty();

  // ── Listen for cell clicks from the main table ───────────────────────────
  // We hook into dataBody / catBody clicks — script.js fires these too,
  // we just add our own listener after it.
  function onCellClick(e) {
    const td = e.target.closest('td, th');
    if (!td) return;

    // Find which tab and row this td belongs to
    const curTabIdx = (typeof activeTab !== 'undefined') ? activeTab : 0;
    const tab  = (typeof TABS !== 'undefined') ? TABS[curTabIdx] : null;
    const data = tab && (typeof processSheetData === 'function') ? processSheetData(tab.grid) : null;
    if (!data) return;

    // Work out row index from the tr
    const tr      = td.closest('tr');
    const tbody   = tr && tr.closest('tbody');
    if (!tbody) return;
    const rowIdx  = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    const row     = data.rows[rowIdx];
    if (!row) return;

    const allText = row.cells.join(' ');
    const kws     = new Set(panelExtractKW(allText));

    if (!kws.size) { showEmpty('This cell has no searchable text'); return; }

    seedKws    = kws;
    seedTabIdx = curTabIdx;
    seedRowIdx = rowIdx;
    seedCells  = data.headers.map((h, i) => ({ header: h, text: row.cells[i] || '' })).filter(c => c.text.trim());

    const matches = findMatches(kws, curTabIdx, rowIdx);
    lastMatches   = matches;

    renderResults(matches, kws, curTabIdx, rowIdx, data, row);
  }

  // Attach to both data and cat tables (they share row indices)
  const dataBodyEl = document.getElementById('data-body');
  const catBodyEl  = document.getElementById('cat-body');
  if (dataBodyEl) dataBodyEl.addEventListener('click', onCellClick);
  if (catBodyEl)  catBodyEl.addEventListener('click', onCellClick);

  // ── Render results (tiles) ───────────────────────────────────────────────
  function renderResults(matches, kws, srcTabIdx, srcRowIdx, srcData, srcRow) {
    ppBody.innerHTML = '';
    ppBody.style.display   = 'block';
    ppMmWrap.style.display = 'none';
    ppMmWrap.innerHTML     = '';
    viewMode = 'tiles';
    viewPill.setValue('tiles', false);

    const vars = panelThemeVars(srcTabIdx);

    // Seed card
    const seedCard = document.createElement('div');
    seedCard.className = 'pp-seed-card';
    seedCard.style.setProperty('--ppc-border', vars['--tab-active-bg'] || '#888');
    seedCard.style.setProperty('--ppc-bg',     vars['--bg-data']       || '#f8f8f8');

    const seedHead = document.createElement('div');
    seedHead.className = 'pp-card-head';
    seedHead.innerHTML = `
      <span class="pp-card-badge" style="background:${vars['--tab-active-bg']||'#888'};color:${vars['--tab-active-color']||'#fff'}">Selected</span>
      <span class="pp-card-dim">${panelEscH(srcData.title || TABS[srcTabIdx].name)}</span>
    `;
    const seedBody = document.createElement('div');
    seedBody.className = 'pp-card-body';
    seedCells.forEach(({ header, text }) => {
      const f = document.createElement('div');
      f.className = 'pp-field';
      f.innerHTML = `<span class="pp-flabel">${panelEscH(header)}</span>${panelHighlight(text, kws)}`;
      seedBody.appendChild(f);
    });
    seedCard.appendChild(seedHead);
    seedCard.appendChild(seedBody);
    ppBody.appendChild(seedCard);

    if (!matches.length) {
      ppSubtitle.textContent  = 'No matches found';
      ppToolrow.style.display = 'none';
      ppBody.insertAdjacentHTML('beforeend', '<div class="pp-empty">No matching entries found</div>');
      return;
    }

    ppSubtitle.textContent  = `${matches.length} match${matches.length === 1 ? '' : 'es'} · keywords: ${[...kws].slice(0, 4).join(', ')}`;
    ppToolrow.style.display = 'flex';
    hlOn = true;
    hlPill.setValue('show', false);

    // Group by tab
    const byTab = new Map();
    matches.forEach(m => {
      if (!byTab.has(m.tabIdx)) byTab.set(m.tabIdx, []);
      byTab.get(m.tabIdx).push(m);
    });

    [...byTab.keys()].sort().forEach(tabIdx => {
      const tabMatches = byTab.get(tabIdx);
      const tv = panelThemeVars(tabIdx);
      const tabName = (typeof TABS !== 'undefined') ? (tabMatches[0].title || TABS[tabIdx].name) : `Tab ${tabIdx}`;

      const divider = document.createElement('div');
      divider.className = 'pp-divider';
      divider.style.borderColor = tv['--tab-active-bg'] || '#aaa';
      divider.innerHTML = `<span style="color:${tv['--tab-active-bg']||'#888'};background:${tv['--bg-data']||'#fff'}">${panelEscH(tabName)}</span>`;
      ppBody.appendChild(divider);

      tabMatches.forEach((m, mi) => {
        const card = document.createElement('div');
        card.className = 'pp-match-card';
        card.style.setProperty('--ppc-border', tv['--tab-active-bg'] || '#888');
        card.style.setProperty('--ppc-bg',     tv['--bg-data']       || '#f8f8f8');
        card.style.animationDelay = (mi * 40) + 'ms';

        const head = document.createElement('div');
        head.className = 'pp-card-head';
        const cats = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];
        head.innerHTML = cats.length
          ? `<span class="pp-card-dim">${cats.map(panelEscH).join(' · ')}</span>`
          : '';

        const body = document.createElement('div');
        body.className = 'pp-card-body';
        m.row.cells.forEach((text, ci) => {
          if (!text.trim()) return;
          const f = document.createElement('div');
          f.className = 'pp-field';
          const matchedKws = new Set([...m.shared].filter(k => panelExtractKW(text).includes(k)));
          const isMatched  = matchedKws.size > 0;
          if (isMatched) f.classList.add('pp-field-matched');
          f.innerHTML = `<span class="pp-flabel">${panelEscH(m.headers[ci] || '')}</span>${panelHighlight(text, matchedKws)}`;
          body.appendChild(f);
        });

        const sharedPill = document.createElement('div');
        sharedPill.className = 'pp-shared-pill';
        sharedPill.textContent = `${m.shared.size} shared: ${[...m.shared].slice(0, 3).join(', ')}`;

        card.appendChild(head);
        card.appendChild(body);
        card.appendChild(sharedPill);
        ppBody.appendChild(card);
      });
    });

    applyHlState();
  }

  // ── MINDMAP ──────────────────────────────────────────────────────────────
  let _mmDragState = null;
  const _mmPositions = new Map(); // cardKey → {x, y, w, h}

  function renderMindmap(matches) {
    ppMmWrap.innerHTML = '';
    if (!matches || !matches.length) {
      ppMmWrap.innerHTML = '<div class="pp-empty">No matches to map</div>';
      return;
    }

    const W = ppMmWrap.clientWidth  || 300;
    const H = ppMmWrap.clientHeight || 400;
    const cx = W / 2, cy = H / 2;

    // SVG for arrows
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0';
    ppMmWrap.appendChild(svg);

    const cardEls   = new Map(); // key → element
    const rects     = new Map(); // key → {x,y,w,h}
    const arrowDefs = [];        // {fromKey, toKey, color}

    function clamp(x, y, w, h) {
      return [
        Math.max(0, Math.min(W - w, x)),
        Math.max(0, Math.min(H - h, y)),
      ];
    }

    function pushApart(skipKey) {
      for (let pass = 0; pass < PANEL_MM_ITERS; pass++) {
        let moved = false;
        for (const [ka, ra] of rects) {
          if (ka === skipKey) continue;
          for (const [kb, rb] of rects) {
            if (kb === ka) continue;
            const overX = ra.x < rb.x + rb.w + PANEL_MM_PAD && ra.x + ra.w + PANEL_MM_PAD > rb.x;
            const overY = ra.y < rb.y + rb.h + PANEL_MM_PAD && ra.y + ra.h + PANEL_MM_PAD > rb.y;
            if (!overX || !overY) continue;
            const dR = rb.x + rb.w + PANEL_MM_PAD - ra.x;
            const dL = ra.x + ra.w + PANEL_MM_PAD - rb.x;
            const dD = rb.y + rb.h + PANEL_MM_PAD - ra.y;
            const dU = ra.y + ra.h + PANEL_MM_PAD - rb.y;
            const mh = Math.min(dR, dL), mv = Math.min(dD, dU);
            let nx = ra.x, ny = ra.y;
            if (mh <= mv) nx += dR < dL ? dR : -dL;
            else          ny += dD < dU ? dD : -dU;
            const [cx2, cy2] = clamp(nx, ny, ra.w, ra.h);
            if (cx2 === ra.x && cy2 === ra.y) continue;
            ra.x = cx2; ra.y = cy2;
            const el = cardEls.get(ka);
            if (el) { el.style.left = cx2 + 'px'; el.style.top = cy2 + 'px'; }
            moved = true;
          }
        }
        if (!moved) break;
      }
    }

    function redrawArrows() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      arrowDefs.forEach(({ fromKey, toKey, color }) => {
        const a = rects.get(fromKey), b = rects.get(toKey);
        if (!a || !b) return;
        drawMmArrow(svg, a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, color);
      });
    }

    function makeDraggable(el, key) {
      let dragging = false, ox = 0, oy = 0, sl = 0, st = 0;
      el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        dragging = true; ox = e.clientX; oy = e.clientY;
        sl = parseFloat(el.style.left) || 0; st = parseFloat(el.style.top) || 0;
        el.style.zIndex = 99; el.style.transition = 'none';
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const r = rects.get(key) || { w: PANEL_CARD_W, h: 80 };
        const [nx, ny] = clamp(sl + (e.clientX - ox), st + (e.clientY - oy), r.w, r.h);
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        rects.set(key, { ...r, x: nx, y: ny });
        pushApart(key);
        redrawArrows();
      });
      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false; el.style.zIndex = '';
        redrawArrows();
      });
    }

    function makeCard(text, header, tabIdx, key, isSeed, cats) {
      const tv = panelThemeVars(tabIdx);
      const card = document.createElement('div');
      card.className = 'pp-mm-card' + (isSeed ? ' pp-mm-seed' : '');
      card.style.width = PANEL_CARD_W + 'px';
      card.style.setProperty('--ppc-border', tv['--tab-active-bg'] || '#888');
      card.style.setProperty('--ppc-bg',     tv['--bg-data']       || '#fff');
      if (isSeed) {
        card.innerHTML = `
          <div class="pp-mm-card-head" style="background:${tv['--tab-active-bg']||'#888'}">
            <span style="color:${tv['--tab-active-color']||'#fff'};font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Selected</span>
          </div>
          <div class="pp-mm-card-body">
            ${seedCells.map(c => `<div class="pp-mm-field"><span class="pp-flabel">${panelEscH(c.header)}</span>${panelEscH(c.text)}</div>`).join('')}
          </div>`;
      } else {
        const catLine = cats && cats.length ? cats.map(panelEscH).join(' · ') : '';
        card.innerHTML = `
          <div class="pp-mm-card-head" style="background:${tv['--tab-active-bg']||'#888'}"></div>
          <div class="pp-mm-card-body">
            ${catLine ? `<div class="pp-mm-cat">${catLine}</div>` : ''}
            <div class="pp-mm-field"><span class="pp-flabel">${panelEscH(header)}</span>${panelEscH(text)}</div>
          </div>`;
      }
      ppMmWrap.appendChild(card);
      makeDraggable(card, key);
      cardEls.set(key, card);
      return card;
    }

    // Seed card — place at center
    const seedKey  = 'seed';
    const seedVars = panelThemeVars(seedTabIdx);
    makeCard('', '', seedTabIdx, seedKey, true, []);

    requestAnimationFrame(() => {
      const sCard = cardEls.get(seedKey);
      const sH    = sCard ? sCard.offsetHeight : 80;
      const sx    = Math.max(0, Math.min(W - PANEL_CARD_W, cx - PANEL_CARD_W / 2));
      const sy    = Math.max(0, Math.min(H - sH, cy - sH / 2));
      sCard.style.left = sx + 'px';
      sCard.style.top  = sy + 'px';
      rects.set(seedKey, { x: sx, y: sy, w: PANEL_CARD_W, h: sH });

      const ringR  = Math.min(W, H) * 0.33;
      const nCards = matches.length;

      matches.forEach((m, i) => {
        const angle    = (2 * Math.PI * i / nCards) - Math.PI / 2;
        const tv       = panelThemeVars(m.tabIdx);
        // Only show the best-matching column
        const bestColIdx = [...m.row.cells.keys()]
          .filter(ci => m.row.cells[ci].trim())
          .sort((a, b) => {
            const ka = panelExtractKW(m.row.cells[a]).filter(k => m.shared.has(k)).length;
            const kb = panelExtractKW(m.row.cells[b]).filter(k => m.shared.has(k)).length;
            return kb - ka;
          })[0];
        if (bestColIdx === undefined) return;

        const text   = m.row.cells[bestColIdx] || '';
        const header = m.headers[bestColIdx]   || '';
        const key    = `m-${m.tabIdx}-${m.rowIdx}`;
        const cats   = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];

        makeCard(text, header, m.tabIdx, key, false, cats);
        arrowDefs.push({ fromKey: seedKey, toKey: key, color: tv['--tab-active-bg'] || '#aaa' });

        requestAnimationFrame(() => {
          const cardEl = cardEls.get(key);
          const cH     = cardEl ? cardEl.offsetHeight : 80;
          let x  = cx + ringR * Math.cos(angle) - PANEL_CARD_W / 2;
          let y  = cy + ringR * Math.sin(angle) - cH / 2;

          // Simple collision pass against already-placed cards
          for (let iter = 0; iter < PANEL_MM_ITERS; iter++) {
            let moved = false;
            for (const [, other] of rects) {
              if (!(x < other.x + other.w + PANEL_MM_PAD && x + PANEL_CARD_W + PANEL_MM_PAD > other.x &&
                    y < other.y + other.h + PANEL_MM_PAD && y + cH + PANEL_MM_PAD > other.y)) continue;
              const dR = other.x + other.w + PANEL_MM_PAD - x;
              const dL = x + PANEL_CARD_W + PANEL_MM_PAD - other.x;
              const dD = other.y + other.h + PANEL_MM_PAD - y;
              const dU = y + cH + PANEL_MM_PAD - other.y;
              const mh = Math.min(dR, dL), mv = Math.min(dD, dU);
              if (mh <= mv) x += dR < dL ? dR : -dL;
              else          y += dD < dU ? dD : -dU;
              const [cx2, cy2] = clamp(x, y, PANEL_CARD_W, cH);
              x = cx2; y = cy2;
              moved = true;
            }
            if (!moved) break;
          }
          const [fx, fy] = clamp(x, y, PANEL_CARD_W, cH);
          cardEl.style.left = fx + 'px';
          cardEl.style.top  = fy + 'px';
          rects.set(key, { x: fx, y: fy, w: PANEL_CARD_W, h: cH });
          redrawArrows();
        });
      });
    });
  }

  function drawMmArrow(svg, x1, y1, x2, y2, color) {
    const ns  = 'http://www.w3.org/2000/svg';
    const mid = `arr${color.replace(/[^a-z0-9]/gi,'_')}`;
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild); }
    if (!defs.querySelector(`#${mid}`)) {
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', mid);
      marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '6');        marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', '0 0,7 3.5,0 7');
      poly.setAttribute('fill', color); poly.setAttribute('opacity', '0.5');
      marker.appendChild(poly); defs.appendChild(marker);
    }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x1},${y1} Q${mx - dy * 0.15},${my + dx * 0.15} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-opacity', '0.5');
    path.setAttribute('marker-end', `url(#${mid})`);
    svg.appendChild(path);
  }

  // ── Inject styles ────────────────────────────────────────────────────────
  if (!document.getElementById('pp-styles')) {
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
      #sidebar-box { box-sizing: border-box; }

      /* ── Head ── */
      #pp-head {
        flex-shrink: 0;
        padding: 10px 12px 8px;
        border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #pp-subtitle {
        font-size: 11px;
        font-weight: 500;
        color: rgba(0,0,0,.45);
        letter-spacing: .04em;
        line-height: 1.3;
        min-height: 14px;
      }
      #pp-toolrow {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      /* ── Body ── */
      #pp-body-wrap {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
      }
      #pp-body {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        padding: 8px 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-sizing: border-box;
      }
      #pp-mm-wrap {
        position: absolute;
        inset: 0;
        display: none;
        overflow: hidden;
      }

      /* ── Pills ── */
      .pp-pill {
        position: relative;
        display: inline-flex;
        align-items: center;
        background: rgba(0,0,0,.07);
        border-radius: 20px;
        padding: 2px;
        gap: 0;
        width: 100%;
        box-sizing: border-box;
      }
      .pp-ind {
        position: absolute;
        top: 2px; bottom: 2px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 1px 4px rgba(0,0,0,.15);
        transition: left .18s ease, width .18s ease;
        pointer-events: none;
      }
      .pp-btn {
        flex: 1;
        position: relative;
        z-index: 1;
        border: none;
        background: transparent;
        border-radius: 16px;
        padding: 4px 6px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: rgba(0,0,0,.35);
        cursor: pointer;
        transition: color .15s;
        white-space: nowrap;
      }
      .pp-btn.active { color: rgba(0,0,0,.75); }

      /* ── Empty ── */
      .pp-empty {
        padding: 24px 8px;
        text-align: center;
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: rgba(0,0,0,.25);
        line-height: 1.5;
      }

      /* ── Divider ── */
      .pp-divider {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0 2px;
        border-top: 1.5px solid;
        padding-top: 6px;
        font-size: 0;
      }
      .pp-divider span {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .14em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 20px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Cards (shared) ── */
      .pp-seed-card,
      .pp-match-card {
        border: 1.5px solid var(--ppc-border, #aaa);
        border-radius: 8px;
        background: var(--ppc-bg, #f8f8f8);
        overflow: hidden;
        flex-shrink: 0;
      }
      .pp-match-card {
        animation: pp-fade-in .25s ease both;
      }
      @keyframes pp-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .pp-card-head {
        padding: 5px 8px 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        border-bottom: 1px solid rgba(0,0,0,.07);
      }
      .pp-card-badge {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase;
        border-radius: 20px;
        padding: 2px 7px;
        flex-shrink: 0;
      }
      .pp-card-dim {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: rgba(0,0,0,.4);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pp-card-body {
        padding: 6px 8px 8px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .pp-field {
        font-size: 11px;
        line-height: 1.4;
        color: rgba(0,0,0,.65);
      }
      .pp-field-matched {
        color: rgba(0,0,0,.85);
      }
      .pp-flabel {
        display: block;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .1em;
        text-transform: uppercase;
        color: rgba(0,0,0,.3);
        margin-bottom: 1px;
      }
      .pp-shared-pill {
        margin: 0 8px 7px;
        padding: 2px 7px;
        background: rgba(0,0,0,.06);
        border-radius: 20px;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: .06em;
        color: rgba(0,0,0,.4);
        text-transform: uppercase;
        display: inline-block;
        align-self: flex-start;
      }

      /* ── Keyword highlight ── */
      mark.pkw {
        background: transparent;
        border-bottom: 2px solid currentColor;
        font-weight: 700;
        padding: 0;
        color: inherit;
        transition: border-bottom-color .15s, font-weight .15s;
      }

      /* ── Mindmap cards ── */
      .pp-mm-card {
        position: absolute;
        border: 1.5px solid var(--ppc-border, #aaa);
        border-radius: 8px;
        background: var(--ppc-bg, #fff);
        box-shadow: 0 2px 10px rgba(0,0,0,.12);
        cursor: grab;
        user-select: none;
        z-index: 1;
        overflow: hidden;
      }
      .pp-mm-card:active { cursor: grabbing; }
      .pp-mm-card-head {
        min-height: 6px;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pp-mm-seed .pp-mm-card-head { min-height: 22px; }
      .pp-mm-card-body {
        padding: 5px 8px 7px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .pp-mm-field {
        font-size: 10px;
        line-height: 1.35;
        color: rgba(0,0,0,.7);
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      .pp-mm-cat {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: rgba(0,0,0,.35);
        margin-bottom: 2px;
      }
    `;
    document.head.appendChild(style);
  }
}
