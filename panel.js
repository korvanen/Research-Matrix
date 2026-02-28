// ════════════════════════════════════════════════════════════════════════════
// panel.js — Results panel for sidebar-box
//
// REQUIRES (load before this file):
//   panel-utils.js   — panelEscH, panelExtractKW, panelHighlight, panelThemeVars,
//                      buildRowIndex, findMatches, buildPill, panelGoTo, attachGoTo
//   script.js        — TABS, activeTab, processSheetData, THEMES, TAB_THEMES,
//                      clearSelection, applySelection, getHighlightTargets,
//                      showTab, buildTabBar
// ════════════════════════════════════════════════════════════════════════════

// ── SETTINGS ─────────────────────────────────────────────────────────────────
const PANEL_KW_MIN_WORD_LEN = 4;   // minimum characters for a word to be a keyword
const PANEL_MIN_SHARED      = 2;   // minimum shared keywords to count as a match
const PANEL_MM_PAD          = 10;  // mindmap collision padding (px)
const PANEL_MM_ITERS        = 20;  // mindmap collision resolution iterations
const PANEL_CARD_W          = 160; // mindmap card width (px)

// Tile card fixed width — cards always render at this width and wrap to the
// next row when there isn't horizontal room for another column. No stretching.
const PANEL_TILE_CARD_W     = 160; // px — fixed width for every tile card

const PANEL_GOTO_DELAY      = 900; // ms hover before "Go to" button appears

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    const box = document.getElementById('sidebar-box');
    if (!box) return;
    clearInterval(wait);
    initPanel(box);
  }, 50);
});

// ── MAIN ──────────────────────────────────────────────────────────────────────
function initPanel(sidebarBox) {

  sidebarBox.style.pointerEvents = 'auto';
  sidebarBox.style.overflow      = 'hidden';
  sidebarBox.style.display       = 'flex';
  sidebarBox.style.flexDirection = 'column';

  sidebarBox.innerHTML =
    '<div id="pp-head">' +
      '<div id="pp-subtitle">Click a cell to find matches</div>' +
      '<div id="pp-toolrow" style="display:none">' +
        '<div id="pp-hl-wrap"></div>' +
        '<div id="pp-view-wrap"></div>' +
      '</div>' +
    '</div>' +
    '<div id="pp-body-wrap">' +
      '<div id="pp-body"></div>' +
      '<div id="pp-mm-wrap"></div>' +
    '</div>';

  const ppSubtitle = document.getElementById('pp-subtitle');
  const ppToolrow  = document.getElementById('pp-toolrow');
  const ppHlWrap   = document.getElementById('pp-hl-wrap');
  const ppViewWrap = document.getElementById('pp-view-wrap');
  const ppBody     = document.getElementById('pp-body');
  const ppMmWrap   = document.getElementById('pp-mm-wrap');

  // Inject PANEL_TILE_CARD_W as a CSS variable.
  document.documentElement.style.setProperty('--pp-tile-card-w', PANEL_TILE_CARD_W + 'px');

  // The grid needs an explicit pixel width on #pp-body to count columns correctly —
  // CSS alone can't resolve it through the overflow:hidden flex ancestor.
  function updateBodyWidth() {
    ppBody.style.width = sidebarBox.clientWidth + 'px';
  }
  updateBodyWidth();
  if (window.ResizeObserver) {
    new ResizeObserver(updateBodyWidth).observe(sidebarBox);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var hlOn        = true;
  var viewMode    = 'tiles';
  var seedKws     = new Set();
  var seedTabIdx  = -1;
  var seedRowIdx  = -1;
  var seedCells   = [];
  var lastMatches = [];
  var _mmActive   = null;
  var _hasContent = false;

  // ── Keyword highlight toggle ───────────────────────────────────────────────
  function applyHlState() {
    [ppBody, ppMmWrap].forEach(function(c) {
      c.querySelectorAll('mark.pkw').forEach(function(m) {
        m.style.borderBottomColor = hlOn ? '' : 'transparent';
        m.style.fontWeight        = hlOn ? '' : 'inherit';
      });
    });
  }

  // ── Pills ──────────────────────────────────────────────────────────────────
  var hlPill = buildPill(
    [{ label: 'Show KW', value: 'show' }, { label: 'Hide KW', value: 'hide' }],
    v => { hlOn = v === 'show'; applyHlState(); }
  );
  ppHlWrap.appendChild(hlPill.el);

  var viewPill = buildPill(
    [{ label: 'Tiles', value: 'tiles' }, { label: 'Mindmap', value: 'mindmap' }],
    function(v) {
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

  // ── Empty state ────────────────────────────────────────────────────────────
  function showEmpty(msg) {
    msg = msg || 'Click a cell to find matches';
    ppSubtitle.textContent  = msg;
    ppBody.innerHTML        = '<div class="pp-empty">' + panelEscH(msg) + '</div>';
    ppBody.style.display    = 'block';
    ppMmWrap.style.display  = 'none';
    ppMmWrap.innerHTML      = '';
    ppToolrow.style.display = 'none';
    _mmActive   = null;
    _hasContent = false;
    viewMode    = 'tiles';
    viewPill.setValue('tiles', false);
  }
  showEmpty();

  // ── Build seed from current grid selection ─────────────────────────────────
  function buildSeedFromSelection() {
    var curTabIdx = typeof activeTab !== 'undefined' ? activeTab : 0;
    var tab  = typeof TABS !== 'undefined' ? TABS[curTabIdx] : null;
    var data = tab && typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data) return false;

    var allDataRows = Array.from(document.querySelectorAll('#data-body tr'));
    var selectedCols = new Map(); // rowIndex → Set of colIndices

    allDataRows.forEach(function(dtr, ri) {
      Array.from(dtr.querySelectorAll('td')).forEach(function(td, ci) {
        if (td.classList.contains('selected-cell') || td.classList.contains('selected-group')) {
          if (!selectedCols.has(ri)) selectedCols.set(ri, new Set());
          selectedCols.get(ri).add(ci);
        }
      });
    });

    if (!selectedCols.size) return false;

    var allText = [];
    var cellMap = new Map(); // header → Set of cell texts

    selectedCols.forEach(function(cols, ri) {
      var row = data.rows[ri];
      if (!row) return;
      cols.forEach(function(ci) {
        var txt = (row.cells[ci] || '').trim();
        if (!txt) return;
        var h = data.headers[ci] || '';
        if (!cellMap.has(h)) cellMap.set(h, new Set());
        cellMap.get(h).add(txt);
        allText.push(txt);
      });
    });

    if (!allText.length) return false;

    seedCells = [];
    cellMap.forEach(function(texts, header) {
      seedCells.push({ header: header, text: [...texts].join(' / ') });
    });

    var kws = new Set(panelExtractKW(allText.join(' ')));
    if (!kws.size) return false;

    seedKws    = kws;
    seedTabIdx = curTabIdx;
    seedRowIdx = [...selectedCols.keys()][0];
    return true;
  }

  // ── Refresh panel on selection change ─────────────────────────────────────
  function refreshFromSelection() {
    var curTabIdx = typeof activeTab !== 'undefined' ? activeTab : 0;
    var tab  = typeof TABS !== 'undefined' ? TABS[curTabIdx] : null;
    var data = tab && typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;

    var ok = buildSeedFromSelection();
    if (!ok) {
      if (_hasContent) showEmpty('Click a cell to find matches');
      return;
    }

    lastMatches = findMatches(seedKws, curTabIdx, seedRowIdx);
    _hasContent = true;

    if (viewMode === 'mindmap') {
      renderMindmap(lastMatches);
    } else {
      renderTiles(lastMatches, seedKws, curTabIdx, data);
    }
  }

  // ── MutationObserver — watches for selection class changes in data-body ────
  var _refreshTimer = null;

  function attachObserver() {
    var dataBodyEl = document.getElementById('data-body');
    if (!dataBodyEl) { setTimeout(attachObserver, 100); return; }
    new MutationObserver(function(mutations) {
      var relevant = mutations.some(function(m) {
        if (m.type !== 'attributes' || m.attributeName !== 'class' || m.target.tagName !== 'TD') return false;
        var prev = m.oldValue || '';
        var wasSelected = /\bselected-/.test(prev);
        var isSelected  = m.target.classList.contains('selected-cell') || m.target.classList.contains('selected-group');
        return wasSelected !== isSelected;
      });
      if (!relevant) return;
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(refreshFromSelection, 60);
    }).observe(dataBodyEl, {
      subtree: true, attributes: true,
      attributeFilter: ['class'], attributeOldValue: true
    });
  }
  attachObserver();

  // Cat-body click: slight delay so script.js finishes its DOM update first
  var catBodyEl2 = document.getElementById('cat-body');
  if (catBodyEl2) catBodyEl2.addEventListener('click', function(e) {
    if (!e.target.closest('td')) return;
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(refreshFromSelection, 80);
  });

  // ── TILES VIEW ────────────────────────────────────────────────────────────
  // Layout: CSS Grid with fixed-width columns (PANEL_TILE_CARD_W px each).
  // The browser auto-fills as many columns as the sidebar width allows — no JS needed.
  // The seed card spans all columns (grid-column: 1 / -1).
  // Tab-group dividers also span all columns.
  function renderTiles(matches, kws, srcTabIdx, srcData) {
    ppBody.innerHTML       = '';
    ppBody.style.display   = 'block';
    ppMmWrap.style.display = 'none';
    ppMmWrap.innerHTML     = '';
    _mmActive = null;

    if (viewMode === 'mindmap') { viewMode = 'tiles'; viewPill.setValue('tiles', false); }

    // Cards are fixed-width — width is set by --pp-tile-card-w via CSS variable

    var vars = panelThemeVars(srcTabIdx);

    // Seed card — fixed-width, same as match cards
    var seedCard = document.createElement('div');
    seedCard.className = 'pp-seed-card';
    seedCard.style.setProperty('--ppc-border', vars['--tab-active-bg'] || '#888');
    seedCard.style.setProperty('--ppc-bg',     vars['--bg-data']       || '#f8f8f8');

    var seedHead = document.createElement('div');
    seedHead.className = 'pp-card-head';
    var tabLabel = srcData.title || (typeof TABS !== 'undefined' ? TABS[srcTabIdx].name : '');
    seedHead.innerHTML =
      '<span class="pp-card-badge" style="background:' + (vars['--tab-active-bg']||'#888') +
      ';color:' + (vars['--tab-active-color']||'#fff') + '">Selected</span>' +
      '<span class="pp-card-dim">' + panelEscH(tabLabel) + '</span>';

    var seedBody = document.createElement('div');
    seedBody.className = 'pp-card-body';
    seedCells.forEach(function(c) {
      var f = document.createElement('div');
      f.className = 'pp-field';
      f.innerHTML = '<span class="pp-flabel">' + panelEscH(c.header) + '</span>' +
        panelHighlight(c.text, kws);
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

    ppSubtitle.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es') +
      ' · ' + [...kws].slice(0, 4).join(', ');
    ppToolrow.style.display = 'flex';
    hlOn = true;
    hlPill.setValue('show', false);

    // Group matches by tab, then render a divider + cards for each tab
    var byTab = new Map();
    matches.forEach(function(m) {
      if (!byTab.has(m.tabIdx)) byTab.set(m.tabIdx, []);
      byTab.get(m.tabIdx).push(m);
    });

    [...byTab.keys()].sort().forEach(function(tabIdx) {
      var tabMatches  = byTab.get(tabIdx);
      var tv          = panelThemeVars(tabIdx);
      var tabName     = tabMatches[0].title || (typeof TABS !== 'undefined' ? TABS[tabIdx].name : 'Tab ' + tabIdx);
      var accentColor = tv['--tab-active-bg'] || '#888';
      var bgColor     = tv['--bg-data']       || '#f8f8f8';

      // Divider spans all grid columns
      var divider = document.createElement('div');
      divider.className = 'pp-divider';
      divider.style.borderColor = accentColor;
      divider.innerHTML =
        '<span style="background:' + accentColor +
        ';color:' + (tv['--tab-active-color']||'#fff') + '">' +
        panelEscH(tabName) + '</span>';
      ppBody.appendChild(divider);

      tabMatches.forEach(function(m, mi) {
        var card = document.createElement('div');
        card.className = 'pp-match-card';
        card.style.setProperty('--ppc-border', accentColor);
        card.style.setProperty('--ppc-bg',     bgColor);
        card.style.animationDelay = (mi * 40) + 'ms';

        var head = document.createElement('div');
        head.className = 'pp-card-head';
        var cats = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];
        if (cats.length) {
          head.innerHTML = '<span class="pp-card-dim">' + cats.map(panelEscH).join(' · ') + '</span>';
        }

        var body = document.createElement('div');
        body.className = 'pp-card-body';
        m.row.cells.forEach(function(text, ci) {
          if (!text.trim()) return;
          var f = document.createElement('div');
          f.className = 'pp-field';
          var matchedKws = new Set([...m.shared].filter(k => panelExtractKW(text).includes(k)));
          if (matchedKws.size) f.classList.add('pp-field-matched');
          f.innerHTML = '<span class="pp-flabel">' + panelEscH(m.headers[ci] || '') + '</span>' +
            panelHighlight(text, matchedKws);
          body.appendChild(f);
        });

        var sharedPill = document.createElement('div');
        sharedPill.className = 'pp-shared-pill';
        sharedPill.textContent = m.shared.size + ' shared: ' + [...m.shared].slice(0, 3).join(', ');

        card.appendChild(head);
        card.appendChild(body);
        card.appendChild(sharedPill);
        ppBody.appendChild(card);

        attachGoTo(card, m, accentColor);
      });
    });

    applyHlState();
  }

  // ── MINDMAP VIEW ──────────────────────────────────────────────────────────
  function mmW() { return ppMmWrap.clientWidth  || 300; }
  function mmH() { return ppMmWrap.clientHeight || 400; }

  function clampToCanvas(x, y, w, h) {
    return [
      Math.max(0, Math.min(mmW() - w, x)),
      Math.max(0, Math.min(mmH() - h, y))
    ];
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

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0';
    ppMmWrap.appendChild(svg);

    var cardEls   = new Map();
    var rects     = new Map();
    var arrowDefs = [];

    function pushApart(skipKey) {
      for (var pass = 0; pass < PANEL_MM_ITERS; pass++) {
        var moved = false;
        for (var [ka, ra] of rects) {
          if (ka === skipKey) continue;
          for (var [kb, rb] of rects) {
            if (kb === ka) continue;
            var overX = ra.x < rb.x + rb.w + PANEL_MM_PAD && ra.x + ra.w + PANEL_MM_PAD > rb.x;
            var overY = ra.y < rb.y + rb.h + PANEL_MM_PAD && ra.y + ra.h + PANEL_MM_PAD > rb.y;
            if (!overX || !overY) continue;
            var dR = rb.x + rb.w + PANEL_MM_PAD - ra.x, dL = ra.x + ra.w + PANEL_MM_PAD - rb.x;
            var dD = rb.y + rb.h + PANEL_MM_PAD - ra.y, dU = ra.y + ra.h + PANEL_MM_PAD - rb.y;
            var mh = Math.min(dR, dL), mv = Math.min(dD, dU);
            if (mh <= mv) ra.x += dR < dL ? dR : -dL;
            else          ra.y += dD < dU ? dD : -dU;
            var c = clampToCanvas(ra.x, ra.y, ra.w, ra.h);
            ra.x = c[0]; ra.y = c[1];
            var el = cardEls.get(ka);
            if (el) { el.style.left = ra.x + 'px'; el.style.top = ra.y + 'px'; }
            moved = true;
          }
        }
        if (!moved) break;
      }
    }

    function redrawArrows() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      arrowDefs.forEach(function(def) {
        var a = rects.get(def.fromKey), b = rects.get(def.toKey);
        if (!a || !b) return;
        drawMmArrow(svg, a.x + a.w/2, a.y + a.h/2, b.x + b.w/2, b.y + b.h/2, def.color);
      });
    }

    function makeDraggable(el, key) {
      var isDragging = false, ox = 0, oy = 0, sl = 0, st = 0;

      function dragStart(clientX, clientY) {
        isDragging = true; ox = clientX; oy = clientY;
        sl = parseFloat(el.style.left) || 0;
        st = parseFloat(el.style.top)  || 0;
        el.style.zIndex = 99; el.style.transition = 'none';
      }
      function dragMove(clientX, clientY) {
        if (!isDragging) return;
        var r = rects.get(key) || { w: PANEL_CARD_W, h: 80 };
        var pos = clampToCanvas(sl + (clientX - ox), st + (clientY - oy), r.w, r.h);
        el.style.left = pos[0] + 'px'; el.style.top = pos[1] + 'px';
        rects.set(key, { x: pos[0], y: pos[1], w: r.w, h: r.h });
        pushApart(key);
        redrawArrows();
      }
      function dragEnd() {
        if (!isDragging) return;
        isDragging = false; el.style.zIndex = '';
        redrawArrows();
      }

      // Mouse
      el.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        dragStart(e.clientX, e.clientY);
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', function(e) { dragMove(e.clientX, e.clientY); });
      document.addEventListener('mouseup', dragEnd);

      // Touch
      el.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        dragStart(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault(); // prevent scroll while dragging card
      }, { passive: false });
      el.addEventListener('touchmove', function(e) {
        if (e.touches.length !== 1) return;
        dragMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', dragEnd);
      el.addEventListener('touchcancel', dragEnd);
    }

    function makeCard(text, header, tabIdx, key, isSeed, cats, kwsHL, matchObj) {
      var tv = panelThemeVars(tabIdx);
      var accentColor = tv['--tab-active-bg'] || '#888';
      var card = document.createElement('div');
      card.className = 'pp-mm-card' + (isSeed ? ' pp-mm-seed' : '');
      card.style.width = PANEL_CARD_W + 'px';
      card.style.setProperty('--ppc-border', accentColor);
      card.style.setProperty('--ppc-bg',     tv['--bg-data'] || '#fff');

      if (isSeed) {
        card.innerHTML =
          '<div class="pp-mm-card-head" style="background:' + accentColor + '">' +
            '<span style="color:' + (tv['--tab-active-color']||'#fff') +
            ';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Selected</span>' +
          '</div>' +
          '<div class="pp-mm-card-body">' +
            seedCells.map(c =>
              '<div class="pp-mm-field"><span class="pp-flabel">' +
              panelEscH(c.header) + '</span>' + panelHighlight(c.text, kwsHL) + '</div>'
            ).join('') +
          '</div>';
      } else {
        var catLine = cats && cats.length ? cats.map(panelEscH).join(' · ') : '';
        card.innerHTML =
          '<div class="pp-mm-card-head" style="background:' + accentColor + '"></div>' +
          '<div class="pp-mm-card-body">' +
            (catLine ? '<div class="pp-mm-cat">' + catLine + '</div>' : '') +
            '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(header) + '</span>' +
            panelHighlight(text, kwsHL) + '</div>' +
          '</div>';
        if (matchObj) attachGoTo(card, matchObj, accentColor);
      }

      ppMmWrap.appendChild(card);
      makeDraggable(card, key);
      cardEls.set(key, card);
      return card;
    }

    var seedKey = 'seed';
    makeCard('', '', seedTabIdx, seedKey, true, [], seedKws, null);

    matches.forEach(function(m) {
      var indices = Array.from({ length: m.row.cells.length }, (_, i) => i)
        .filter(ci => (m.row.cells[ci] || '').trim());
      if (!indices.length) return;

      indices.sort((a, b) => {
        var ka = panelExtractKW(m.row.cells[a]).filter(k => m.shared.has(k)).length;
        var kb = panelExtractKW(m.row.cells[b]).filter(k => m.shared.has(k)).length;
        return kb - ka;
      });

      var bestColIdx = indices[0];
      var text   = m.row.cells[bestColIdx] || '';
      var header = m.headers[bestColIdx]   || '';
      var key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
      var cats   = m.row.cats ? m.row.cats.filter(c => c.trim()) : [];
      var tv     = panelThemeVars(m.tabIdx);

      makeCard(text, header, m.tabIdx, key, false, cats, m.shared, m);
      arrowDefs.push({ fromKey: seedKey, toKey: key, color: tv['--tab-active-bg'] || '#aaa' });
    });

    requestAnimationFrame(function() {
      var W = mmW(), H = mmH(), cx = W / 2, cy = H / 2;

      var sCard = cardEls.get(seedKey);
      var sH    = sCard ? (sCard.offsetHeight || 80) : 80;
      var sPos  = clampToCanvas(cx - PANEL_CARD_W / 2, cy - sH / 2, PANEL_CARD_W, sH);
      if (sCard) { sCard.style.left = sPos[0] + 'px'; sCard.style.top = sPos[1] + 'px'; }
      rects.set(seedKey, { x: sPos[0], y: sPos[1], w: PANEL_CARD_W, h: sH });

      var ringR  = Math.min(W, H) * 0.33;
      var nCards = matches.length;

      matches.forEach(function(m, i) {
        var key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
        var cardEl = cardEls.get(key);
        if (!cardEl) return;

        var angle = (2 * Math.PI * i / nCards) - Math.PI / 2;
        var cH    = cardEl.offsetHeight || 80;
        var x     = cx + ringR * Math.cos(angle) - PANEL_CARD_W / 2;
        var y     = cy + ringR * Math.sin(angle) - cH / 2;

        for (var iter = 0; iter < PANEL_MM_ITERS; iter++) {
          var moved = false;
          for (var [, other] of rects) {
            if (!(x < other.x + other.w + PANEL_MM_PAD &&
                  x + PANEL_CARD_W + PANEL_MM_PAD > other.x &&
                  y < other.y + other.h + PANEL_MM_PAD &&
                  y + cH + PANEL_MM_PAD > other.y)) continue;
            var dR = other.x + other.w + PANEL_MM_PAD - x, dL = x + PANEL_CARD_W + PANEL_MM_PAD - other.x;
            var dD = other.y + other.h + PANEL_MM_PAD - y, dU = y + cH + PANEL_MM_PAD - other.y;
            var mh2 = Math.min(dR, dL), mv2 = Math.min(dD, dU);
            if (mh2 <= mv2) x += dR < dL ? dR : -dL;
            else            y += dD < dU ? dD : -dU;
            [x, y] = clampToCanvas(x, y, PANEL_CARD_W, cH);
            moved = true;
          }
          if (!moved) break;
        }

        var [fx, fy] = clampToCanvas(x, y, PANEL_CARD_W, cH);
        cardEl.style.left = fx + 'px';
        cardEl.style.top  = fy + 'px';
        rects.set(key, { x: fx, y: fy, w: PANEL_CARD_W, h: cH });
      });

      redrawArrows();
      _mmActive = { rects, cardEls, arrowDefs, redrawArrows };
      _mmLastW = mmW(); _mmLastH = mmH();
      requestAnimationFrame(() => applyHlState());
    });
  }

  var _mmLastW = 0, _mmLastH = 0, _mmResizeTimer = null;
  if (window.ResizeObserver) {
    new ResizeObserver(function() {
      if (viewMode !== 'mindmap' || !_mmActive) return;
      clearTimeout(_mmResizeTimer);
      _mmResizeTimer = setTimeout(function() {
        var newW = mmW(), newH = mmH();
        if (!_mmLastW || !_mmLastH || (newW === _mmLastW && newH === _mmLastH)) {
          _mmLastW = newW; _mmLastH = newH; return;
        }
        var sx = newW / _mmLastW, sy = newH / _mmLastH;
        _mmLastW = newW; _mmLastH = newH;
        _mmActive.rects.forEach(function(r, key) {
          var [nx, ny] = clampToCanvas(r.x * sx, r.y * sy, r.w, r.h);
          r.x = nx; r.y = ny;
          var el = _mmActive.cardEls.get(key);
          if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
        });
        _mmActive.redrawArrows();
      }, 16);
    }).observe(ppMmWrap);
  }

  function drawMmArrow(svg, x1, y1, x2, y2, color) {
    var ns   = 'http://www.w3.org/2000/svg';
    var mid  = 'arr' + color.replace(/[^a-z0-9]/gi, '_');
    var defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild); }
    if (!defs.querySelector('#' + mid)) {
      var marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', mid);
      marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '6');        marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      var poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', '0 0,7 3.5,0 7');
      poly.setAttribute('fill', color); poly.setAttribute('opacity', '0.5');
      marker.appendChild(poly); defs.appendChild(marker);
    }
    var mx = (x1+x2)/2, my = (y1+y2)/2, dx = x2-x1, dy = y2-y1;
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M'+x1+','+y1+' Q'+(mx-dy*0.15)+','+(my+dx*0.15)+' '+x2+','+y2);
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-opacity', '0.5');
    path.setAttribute('marker-end', 'url(#' + mid + ')');
    svg.appendChild(path);
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  if (!document.getElementById('pp-styles')) {
    var style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
#sidebar-box { box-sizing: border-box; }

#pp-head {
  flex-shrink: 0; padding: 10px 12px 8px;
  border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));
  display: flex; flex-direction: column; gap: 6px;
}
#pp-subtitle {
  font-size: 11px; font-weight: 500; color: rgba(0,0,0,.45);
  letter-spacing: .04em; line-height: 1.3; min-height: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#pp-toolrow { display: flex; flex-direction: row; gap: 5px; align-items: stretch; }
#pp-hl-wrap, #pp-view-wrap { flex: 1; min-width: 0; display: flex; }
#pp-hl-wrap .pp-pill, #pp-view-wrap .pp-pill { width: 100%; }

#pp-body-wrap { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; position: relative; }

/* CSS Grid — columns are PANEL_TILE_CARD_W px wide (set as --pp-tile-card-w via JS).
   #pp-body gets an explicit pixel width from JS (sidebarBox.clientWidth) so auto-fill
   can correctly count how many columns fit. */
#pp-body {
  padding: 10px 12px 18px; box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--pp-tile-card-w, 160px));
  justify-content: start;
  align-content: start;
  gap: 10px;
}
#pp-mm-wrap { position: absolute; inset: 0; display: none; overflow: hidden; }

/* Pill */
.pp-pill {
  position: relative; display: inline-flex; align-items: center;
  background: rgba(0,0,0,.07); border-radius: 20px; padding: 2px; box-sizing: border-box;
}
.pp-ind {
  position: absolute; top: 2px; bottom: 2px; background: white; border-radius: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.15); transition: left .18s ease, width .18s ease;
  pointer-events: none;
}
.pp-btn {
  flex: 1; position: relative; z-index: 1; border: none; background: transparent;
  border-radius: 16px; padding: 4px 5px; font-size: 9px; font-weight: 600;
  letter-spacing: .07em; text-transform: uppercase; color: rgba(0,0,0,.35);
  cursor: pointer; transition: color .15s; white-space: nowrap;
}
.pp-btn.active { color: rgba(0,0,0,.75); }

/* Empty state — spans all grid columns */
.pp-empty {
  grid-column: 1 / -1;
  padding: 24px 8px; text-align: center;
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.25); line-height: 1.5;
}

/* Seed card — same fixed width as match cards, just styled differently */
.pp-seed-card {
  width: var(--pp-tile-card-w, 160px);
  border: 2px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);
  overflow: hidden; box-sizing: border-box;
}

/* Match card — width set by CSS variable from PANEL_TILE_CARD_W. Never stretches. */
.pp-match-card {
  width: var(--pp-tile-card-w, 160px);
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);
  overflow: visible; box-sizing: border-box;
  animation: pp-fade-in .25s ease both;
  position: relative;
}
@keyframes pp-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Divider — spans all grid columns */
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

/* "Go to" hover button */
.pp-goto-btn {
  display: block; width: calc(100% - 16px); margin: 0 8px 8px;
  padding: 5px 8px; border-radius: 6px; border: 1.5px solid;
  background: white; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; cursor: pointer; text-align: center;
  opacity: 0; transform: translateY(6px);
  transition: opacity .35s ease, transform .35s ease;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
}
.pp-goto-btn.pp-goto-visible { opacity: 1; transform: translateY(0); }
.pp-goto-btn:hover { filter: brightness(0.92); }

/* Keyword highlight */
mark.pkw {
  background: transparent; border-bottom: 2px solid currentColor;
  font-weight: 700; padding: 0; color: inherit;
  transition: border-bottom-color .15s, font-weight .15s;
}

/* Mindmap cards */
.pp-mm-card {
  position: absolute; border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #fff);
  box-shadow: 0 2px 10px rgba(0,0,0,.12);
  cursor: grab; user-select: none; z-index: 1; overflow: visible;
}
.pp-mm-card:active { cursor: grabbing; }
.pp-mm-card-head {
  min-height: 6px; padding: 4px 8px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px 6px 0 0; overflow: hidden;
}
.pp-mm-seed .pp-mm-card-head { min-height: 22px; }
.pp-mm-card-body { padding: 5px 8px 7px; display: flex; flex-direction: column; gap: 3px; }
.pp-mm-field {
  font-size: 10px; line-height: 1.35; color: rgba(0,0,0,.7);
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 3; -webkit-box-orient: vertical;
}
.pp-mm-cat {
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(0,0,0,.35); margin-bottom: 2px;
}
`;
    document.head.appendChild(style);
  }
}
