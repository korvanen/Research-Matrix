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
const PANEL_CARD_W          = 160; // mindmap card width px
const PANEL_TILE_MIN_W      = 180; // tiles: minimum card width px
const PANEL_TILE_MAX_W      = 340; // tiles: maximum card width px

const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    const box = document.getElementById('sidebar-box');
    if (!box) return;
    clearInterval(wait);
    initPanel(box);
  }, 50);
});

// ── HELPERS ───────────────────────────────────────────────────────────────────
function panelEscH(t) {
  return String(t == null ? '' : t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    '\\b(' + [...kwSet].map(k => k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\b', 'gi'
  );
  return panelEscH(text).replace(pat, m => '<mark class="pkw">' + m + '</mark>');
}

function panelThemeVars(tabIdx) {
  const name = (typeof TAB_THEMES !== 'undefined' && TAB_THEMES[tabIdx]) || 'default';
  return (typeof THEMES !== 'undefined' && (THEMES[name] || THEMES.default)) || {};
}

// ── SEARCH ENGINE ─────────────────────────────────────────────────────────────
function buildRowIndex() {
  if (typeof TABS === 'undefined' || !TABS.length) return [];
  const rows = [];
  TABS.forEach((tab, tabIdx) => {
    const data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data) return;
    data.rows.forEach((row, rowIdx) => {
      rows.push({
        tabIdx, rowIdx, row,
        headers: data.headers,
        title: data.title || tab.name,
        kws: new Set(panelExtractKW(row.cells.join(' ')))
      });
    });
  });
  return rows;
}

function findMatches(seedKws, seedTabIdx, seedRowIdx) {
  const matches = [];
  buildRowIndex().forEach(entry => {
    if (entry.tabIdx === seedTabIdx && entry.rowIdx === seedRowIdx) return;
    const shared = new Set([...seedKws].filter(k => entry.kws.has(k)));
    if (shared.size < PANEL_MIN_SHARED) return;
    matches.push({ ...entry, shared });
  });
  matches.sort((a, b) => b.shared.size - a.shared.size);
  return matches;
}

// ── PILL TOGGLE ───────────────────────────────────────────────────────────────
function buildPill(options, onSwitch) {
  const wrap = document.createElement('div');
  wrap.className = 'pp-pill';
  const ind = document.createElement('div');
  ind.className = 'pp-ind';
  wrap.appendChild(ind);
  const btns = {};
  options.forEach(function(opt) {
    const b = document.createElement('button');
    b.className = 'pp-btn';
    b.textContent = opt.label;
    b.addEventListener('click', function() { setValue(opt.value); onSwitch(opt.value); });
    wrap.appendChild(b);
    btns[opt.value] = b;
  });
  let current = options[0].value;
  function setValue(v, animate) {
    animate = animate !== false;
    current = v;
    Object.keys(btns).forEach(function(bv) { btns[bv].classList.toggle('active', bv === v); });
    const ab = btns[v];
    if (!ab) return;
    if (!animate) ind.style.transition = 'none';
    ind.style.left  = ab.offsetLeft + 'px';
    ind.style.width = ab.offsetWidth + 'px';
    if (!animate) requestAnimationFrame(function() { ind.style.transition = ''; });
  }
  setValue(options[0].value, false);
  if (window.ResizeObserver) {
    new ResizeObserver(function() { setValue(current, false); }).observe(wrap);
  }
  return { el: wrap, setValue: setValue };
}

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

  // ── State ────────────────────────────────────────────────────────────────
  var hlOn        = true;
  var viewMode    = 'tiles';
  var seedKws     = new Set();
  var seedTabIdx  = -1;
  var seedRowIdx  = -1;
  var seedCells   = [];
  var lastMatches = [];
  var _mmActive   = null;  // live mindmap state for resize reflow

  // ── Keyword highlight toggle — applies to BOTH tiles and mindmap ─────────
  function applyHlState() {
    [ppBody, ppMmWrap].forEach(function(container) {
      container.querySelectorAll('mark.pkw').forEach(function(m) {
        m.style.borderBottomColor = hlOn ? '' : 'transparent';
        m.style.fontWeight        = hlOn ? '' : 'inherit';
      });
    });
  }

  // ── Pills — always side-by-side in one row ───────────────────────────────
  var hlPill = buildPill(
    [{ label: 'Show KW', value: 'show' }, { label: 'Hide KW', value: 'hide' }],
    function(v) { hlOn = v === 'show'; applyHlState(); }
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

  function showEmpty(msg) {
    msg = msg || 'Click a cell to find matches';
    ppSubtitle.textContent  = msg;
    ppBody.innerHTML        = '<div class="pp-empty">' + panelEscH(msg) + '</div>';
    ppBody.style.display    = 'block';
    ppMmWrap.style.display  = 'none';
    ppMmWrap.innerHTML      = '';
    ppToolrow.style.display = 'none';
    _mmActive = null;
    viewMode  = 'tiles';
    viewPill.setValue('tiles', false);
  }
  showEmpty();

  // ── Cell click ────────────────────────────────────────────────────────────
  function onCellClick(e) {
    var td = e.target.closest('td, th');
    if (!td) return;
    var curTabIdx = typeof activeTab !== 'undefined' ? activeTab : 0;
    var tab  = typeof TABS !== 'undefined' ? TABS[curTabIdx] : null;
    var data = tab && typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data) return;
    var tr    = td.closest('tr');
    var tbody = tr && tr.closest('tbody');
    if (!tbody) return;
    var rowIdx = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    var row    = data.rows[rowIdx];
    if (!row) return;
    var kws = new Set(panelExtractKW(row.cells.join(' ')));
    if (!kws.size) { showEmpty('This cell has no searchable text'); return; }
    seedKws    = kws;
    seedTabIdx = curTabIdx;
    seedRowIdx = rowIdx;
    seedCells  = data.headers
      .map(function(h, i) { return { header: h, text: row.cells[i] || '' }; })
      .filter(function(c) { return c.text.trim(); });
    lastMatches = findMatches(kws, curTabIdx, rowIdx);
    renderTiles(lastMatches, kws, curTabIdx, data);
  }

  var dataBodyEl = document.getElementById('data-body');
  var catBodyEl  = document.getElementById('cat-body');
  if (dataBodyEl) dataBodyEl.addEventListener('click', onCellClick);
  if (catBodyEl)  catBodyEl.addEventListener('click', onCellClick);

  // ── TILES ─────────────────────────────────────────────────────────────────
  function renderTiles(matches, kws, srcTabIdx, srcData) {
    ppBody.innerHTML       = '';
    ppBody.style.display   = 'block';
    ppMmWrap.style.display = 'none';
    ppMmWrap.innerHTML     = '';
    _mmActive = null;
    viewMode  = 'tiles';
    viewPill.setValue('tiles', false);

    var vars = panelThemeVars(srcTabIdx);

    // Seed card — always full width
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
      f.innerHTML = '<span class="pp-flabel">' + panelEscH(c.header) + '</span>' + panelHighlight(c.text, kws);
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

    ppSubtitle.textContent  = matches.length + ' match' + (matches.length === 1 ? '' : 'es') +
      ' · ' + [...kws].slice(0, 4).join(', ');
    ppToolrow.style.display = 'flex';
    hlOn = true;
    hlPill.setValue('show', false);

    // Group by tab
    var byTab = new Map();
    matches.forEach(function(m) {
      if (!byTab.has(m.tabIdx)) byTab.set(m.tabIdx, []);
      byTab.get(m.tabIdx).push(m);
    });

    [...byTab.keys()].sort().forEach(function(tabIdx) {
      var tabMatches = byTab.get(tabIdx);
      var tv = panelThemeVars(tabIdx);
      var tabName = tabMatches[0].title || (typeof TABS !== 'undefined' ? TABS[tabIdx].name : 'Tab ' + tabIdx);

      // Divider — flex-basis:100% forces it to its own row
      var divider = document.createElement('div');
      divider.className = 'pp-divider';
      divider.style.borderColor = tv['--tab-active-bg'] || '#aaa';
      divider.innerHTML = '<span style="color:' + (tv['--tab-active-bg']||'#888') +
        ';background:' + (tv['--bg-data']||'#fff') + '">' + panelEscH(tabName) + '</span>';
      ppBody.appendChild(divider);

      tabMatches.forEach(function(m, mi) {
        var card = document.createElement('div');
        card.className = 'pp-match-card';
        card.style.setProperty('--ppc-border', tv['--tab-active-bg'] || '#888');
        card.style.setProperty('--ppc-bg',     tv['--bg-data']       || '#f8f8f8');
        card.style.animationDelay = (mi * 40) + 'ms';

        var head = document.createElement('div');
        head.className = 'pp-card-head';
        var cats = m.row.cats ? m.row.cats.filter(function(c) { return c.trim(); }) : [];
        if (cats.length) head.innerHTML = '<span class="pp-card-dim">' + cats.map(panelEscH).join(' · ') + '</span>';

        var body = document.createElement('div');
        body.className = 'pp-card-body';
        m.row.cells.forEach(function(text, ci) {
          if (!text.trim()) return;
          var f = document.createElement('div');
          f.className = 'pp-field';
          var matchedKws = new Set([...m.shared].filter(function(k) {
            return panelExtractKW(text).includes(k);
          }));
          if (matchedKws.size) f.classList.add('pp-field-matched');
          f.innerHTML = '<span class="pp-flabel">' + panelEscH(m.headers[ci] || '') + '</span>' +
            panelHighlight(text, matchedKws);
          body.appendChild(f);
        });

        var pill = document.createElement('div');
        pill.className = 'pp-shared-pill';
        pill.textContent = m.shared.size + ' shared: ' + [...m.shared].slice(0, 3).join(', ');

        card.appendChild(head);
        card.appendChild(body);
        card.appendChild(pill);
        ppBody.appendChild(card);
      });
    });

    applyHlState();
  }

  // ── MINDMAP ───────────────────────────────────────────────────────────────
  // Live canvas size — always read from DOM, never snapshotted in closure
  function mmW() { return ppMmWrap.clientWidth  || 300; }
  function mmH() { return ppMmWrap.clientHeight || 400; }

  function clampToCanvas(x, y, w, h) {
    return [
      Math.max(0, Math.min(mmW() - w, x)),
      Math.max(0, Math.min(mmH() - h, y))
    ];
  }

  function renderMindmap(matches) {
    ppMmWrap.innerHTML = '';
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
        for (var _a of rects) {
          var ka = _a[0], ra = _a[1];
          if (ka === skipKey) continue;
          for (var _b of rects) {
            var kb = _b[0], rb = _b[1];
            if (kb === ka) continue;
            var overX = ra.x < rb.x + rb.w + PANEL_MM_PAD && ra.x + ra.w + PANEL_MM_PAD > rb.x;
            var overY = ra.y < rb.y + rb.h + PANEL_MM_PAD && ra.y + ra.h + PANEL_MM_PAD > rb.y;
            if (!overX || !overY) continue;
            var dR = rb.x + rb.w + PANEL_MM_PAD - ra.x, dL = ra.x + ra.w + PANEL_MM_PAD - rb.x;
            var dD = rb.y + rb.h + PANEL_MM_PAD - ra.y, dU = ra.y + ra.h + PANEL_MM_PAD - rb.y;
            var mh = Math.min(dR, dL), mv = Math.min(dD, dU);
            var nx = ra.x, ny = ra.y;
            if (mh <= mv) nx += dR < dL ? dR : -dL;
            else          ny += dD < dU ? dD : -dU;
            var clamped = clampToCanvas(nx, ny, ra.w, ra.h);
            if (clamped[0] === ra.x && clamped[1] === ra.y) continue;
            ra.x = clamped[0]; ra.y = clamped[1];
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
      var dragging = false, ox = 0, oy = 0, sl = 0, st = 0;
      el.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        dragging = true; ox = e.clientX; oy = e.clientY;
        sl = parseFloat(el.style.left) || 0;
        st = parseFloat(el.style.top)  || 0;
        el.style.zIndex = 99; el.style.transition = 'none';
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var r = rects.get(key) || { w: PANEL_CARD_W, h: 80 };
        // clampToCanvas uses live mmW()/mmH() so drag respects current sidebar width
        var pos = clampToCanvas(sl + (e.clientX - ox), st + (e.clientY - oy), r.w, r.h);
        el.style.left = pos[0] + 'px'; el.style.top = pos[1] + 'px';
        rects.set(key, { x: pos[0], y: pos[1], w: r.w, h: r.h });
        pushApart(key);
        redrawArrows();
      });
      document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false; el.style.zIndex = '';
        redrawArrows();
      });
    }

    function makeCard(text, header, tabIdx, key, isSeed, cats, kwsHL) {
      var tv = panelThemeVars(tabIdx);
      var card = document.createElement('div');
      card.className = 'pp-mm-card' + (isSeed ? ' pp-mm-seed' : '');
      card.style.width = PANEL_CARD_W + 'px';
      card.style.setProperty('--ppc-border', tv['--tab-active-bg'] || '#888');
      card.style.setProperty('--ppc-bg',     tv['--bg-data']       || '#fff');
      if (isSeed) {
        card.innerHTML =
          '<div class="pp-mm-card-head" style="background:' + (tv['--tab-active-bg']||'#888') + '">' +
            '<span style="color:' + (tv['--tab-active-color']||'#fff') +
            ';font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Selected</span>' +
          '</div>' +
          '<div class="pp-mm-card-body">' +
            seedCells.map(function(c) {
              return '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(c.header) + '</span>' +
                panelHighlight(c.text, kwsHL) + '</div>';
            }).join('') +
          '</div>';
      } else {
        var catLine = cats && cats.length ? cats.map(panelEscH).join(' · ') : '';
        card.innerHTML =
          '<div class="pp-mm-card-head" style="background:' + (tv['--tab-active-bg']||'#888') + '"></div>' +
          '<div class="pp-mm-card-body">' +
            (catLine ? '<div class="pp-mm-cat">' + catLine + '</div>' : '') +
            '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(header) + '</span>' +
            panelHighlight(text, kwsHL) + '</div>' +
          '</div>';
      }
      ppMmWrap.appendChild(card);
      makeDraggable(card, key);
      cardEls.set(key, card);
      return card;
    }

    var seedKey = 'seed';
    makeCard('', '', seedTabIdx, seedKey, true, [], seedKws);

    requestAnimationFrame(function() {
      var W = mmW(), H = mmH(), cx = W/2, cy = H/2;
      var sCard = cardEls.get(seedKey);
      var sH    = sCard ? sCard.offsetHeight : 80;
      var sPos  = clampToCanvas(cx - PANEL_CARD_W/2, cy - sH/2, PANEL_CARD_W, sH);
      sCard.style.left = sPos[0] + 'px'; sCard.style.top = sPos[1] + 'px';
      rects.set(seedKey, { x: sPos[0], y: sPos[1], w: PANEL_CARD_W, h: sH });

      var ringR  = Math.min(W, H) * 0.33;
      var nCards = matches.length;

      matches.forEach(function(m, i) {
        var angle = (2 * Math.PI * i / nCards) - Math.PI / 2;
        var tv    = panelThemeVars(m.tabIdx);

        // Pick the column with the most shared keyword matches
        var bestColIdx = [].slice.call(m.row.cells.keys ? m.row.cells.keys() : Object.keys(m.row.cells))
          .filter(function(ci) { return (m.row.cells[ci] || '').trim(); })
          .sort(function(a, b) {
            var ka = panelExtractKW(m.row.cells[a]).filter(function(k) { return m.shared.has(k); }).length;
            var kb = panelExtractKW(m.row.cells[b]).filter(function(k) { return m.shared.has(k); }).length;
            return kb - ka;
          })[0];
        if (bestColIdx === undefined) return;

        var text   = m.row.cells[bestColIdx] || '';
        var header = m.headers[bestColIdx]   || '';
        var key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
        var cats   = m.row.cats ? m.row.cats.filter(function(c) { return c.trim(); }) : [];

        makeCard(text, header, m.tabIdx, key, false, cats, m.shared);
        arrowDefs.push({ fromKey: seedKey, toKey: key, color: tv['--tab-active-bg'] || '#aaa' });

        requestAnimationFrame(function() {
          var cardEl = cardEls.get(key);
          if (!cardEl) return;
          var cH = cardEl.offsetHeight || 80;
          var x  = cx + ringR * Math.cos(angle) - PANEL_CARD_W / 2;
          var y  = cy + ringR * Math.sin(angle) - cH / 2;

          for (var iter = 0; iter < PANEL_MM_ITERS; iter++) {
            var moved = false;
            for (var _r of rects) {
              var other = _r[1];
              if (!(x < other.x + other.w + PANEL_MM_PAD && x + PANEL_CARD_W + PANEL_MM_PAD > other.x &&
                    y < other.y + other.h + PANEL_MM_PAD && y + cH + PANEL_MM_PAD > other.y)) continue;
              var dR = other.x + other.w + PANEL_MM_PAD - x, dL = x + PANEL_CARD_W + PANEL_MM_PAD - other.x;
              var dD = other.y + other.h + PANEL_MM_PAD - y, dU = y + cH + PANEL_MM_PAD - other.y;
              var mh2 = Math.min(dR, dL), mv2 = Math.min(dD, dU);
              if (mh2 <= mv2) x += dR < dL ? dR : -dL;
              else            y += dD < dU ? dD : -dU;
              var c2 = clampToCanvas(x, y, PANEL_CARD_W, cH);
              x = c2[0]; y = c2[1];
              moved = true;
            }
            if (!moved) break;
          }
          var final = clampToCanvas(x, y, PANEL_CARD_W, cH);
          cardEl.style.left = final[0] + 'px'; cardEl.style.top = final[1] + 'px';
          rects.set(key, { x: final[0], y: final[1], w: PANEL_CARD_W, h: cH });
          redrawArrows();
        });
      });

      // Store live state for resize reflow + hl toggle
      _mmActive = { rects: rects, cardEls: cardEls, arrowDefs: arrowDefs, redrawArrows: redrawArrows };
      // Capture canvas size so ResizeObserver can scale proportionally
      _mmLastW = mmW(); _mmLastH = mmH();
      // Apply hl after two more rAFs — the child rAFs (match cards) are nested
      // one level deeper, so we need two frames to guarantee all marks exist
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { applyHlState(); });
      });
    });
  }

  // Re-scale mindmap cards proportionally when the sidebar canvas resizes
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
        var scaleX = newW / _mmLastW;
        var scaleY = newH / _mmLastH;
        _mmLastW = newW; _mmLastH = newH;
        _mmActive.rects.forEach(function(r, key) {
          var pos = clampToCanvas(r.x * scaleX, r.y * scaleY, r.w, r.h);
          r.x = pos[0]; r.y = pos[1];
          var el = _mmActive.cardEls.get(key);
          if (el) { el.style.left = pos[0] + 'px'; el.style.top = pos[1] + 'px'; }
        });
        _mmActive.redrawArrows();
      }, 16);
    }).observe(ppMmWrap);
  }

  function drawMmArrow(svg, x1, y1, x2, y2, color) {
    var ns  = 'http://www.w3.org/2000/svg';
    var mid = 'arr' + color.replace(/[^a-z0-9]/gi, '_');
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
    style.textContent = [
      '#sidebar-box { box-sizing: border-box; }',

      // Head
      '#pp-head {',
      '  flex-shrink: 0;',
      '  padding: 10px 12px 8px;',
      '  border-bottom: 1px solid var(--sidebar-box-border, rgba(0,0,0,.1));',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '}',
      '#pp-subtitle {',
      '  font-size: 11px; font-weight: 500; color: rgba(0,0,0,.45);',
      '  letter-spacing: .04em; line-height: 1.3; min-height: 14px;',
      '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
      '}',

      // Toolrow — always one row, pills side by side
      '#pp-toolrow {',
      '  display: flex;',
      '  flex-direction: row;',
      '  gap: 5px;',
      '  align-items: stretch;',
      '}',
      '#pp-hl-wrap, #pp-view-wrap {',
      '  flex: 1; min-width: 0; display: flex;',
      '}',
      '#pp-hl-wrap .pp-pill, #pp-view-wrap .pp-pill { width: 100%; }',

      // Body
      '#pp-body-wrap {',
      '  flex: 1; min-height: 0; position: relative; overflow: hidden;',
      '}',
      '#pp-body {',
      '  position: absolute; inset: 0; overflow-y: auto;',
      '  padding: 8px 10px 16px; box-sizing: border-box;',
      // Horizontal wrapping flow for tile cards
      '  display: flex; flex-direction: row; flex-wrap: wrap;',
      '  align-content: flex-start; gap: 6px;',
      '}',
      '#pp-mm-wrap {',
      '  position: absolute; inset: 0; display: none; overflow: hidden;',
      '}',

      // Pill toggle
      '.pp-pill {',
      '  position: relative; display: inline-flex; align-items: center;',
      '  background: rgba(0,0,0,.07); border-radius: 20px;',
      '  padding: 2px; box-sizing: border-box;',
      '}',
      '.pp-ind {',
      '  position: absolute; top: 2px; bottom: 2px;',
      '  background: white; border-radius: 16px;',
      '  box-shadow: 0 1px 4px rgba(0,0,0,.15);',
      '  transition: left .18s ease, width .18s ease;',
      '  pointer-events: none;',
      '}',
      '.pp-btn {',
      '  flex: 1; position: relative; z-index: 1; border: none;',
      '  background: transparent; border-radius: 16px; padding: 4px 5px;',
      '  font-size: 9px; font-weight: 600; letter-spacing: .07em;',
      '  text-transform: uppercase; color: rgba(0,0,0,.35);',
      '  cursor: pointer; transition: color .15s; white-space: nowrap;',
      '}',
      '.pp-btn.active { color: rgba(0,0,0,.75); }',

      // Empty state
      '.pp-empty {',
      '  width: 100%; flex-basis: 100%;',
      '  padding: 24px 8px; text-align: center;',
      '  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;',
      '  color: rgba(0,0,0,.25); line-height: 1.5;',
      '}',

      // Divider — flex-basis 100% keeps it on its own row
      '.pp-divider {',
      '  width: 100%; flex-basis: 100%;',
      '  display: flex; align-items: center; gap: 6px;',
      '  margin: 4px 0 2px; border-top: 1.5px solid; padding-top: 6px;',
      '  font-size: 0;',
      '}',
      '.pp-divider span {',
      '  font-size: 9px; font-weight: 700; letter-spacing: .14em;',
      '  text-transform: uppercase; padding: 2px 6px;',
      '  border-radius: 20px; white-space: nowrap; flex-shrink: 0;',
      '}',

      // Seed card — always full width
      '.pp-seed-card {',
      '  flex-basis: 100%; width: 100%; box-sizing: border-box;',
      '  border: 1.5px solid var(--ppc-border, #aaa);',
      '  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);',
      '  overflow: hidden; flex-shrink: 0;',
      '}',

      // Match cards — responsive columns
      // flex-grow:1 lets cards fill a row together, max-width caps them so a
      // lone card on a wide sidebar never balloons beyond PANEL_TILE_MAX_W
      '.pp-match-card {',
      '  flex: 1 1 ' + PANEL_TILE_MIN_W + 'px;',
      '  min-width: ' + PANEL_TILE_MIN_W + 'px;',
      '  max-width: ' + PANEL_TILE_MAX_W + 'px;',
      '  border: 1.5px solid var(--ppc-border, #aaa);',
      '  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);',
      '  overflow: hidden; box-sizing: border-box;',
      '  animation: pp-fade-in .25s ease both;',
      '}',
      '@keyframes pp-fade-in {',
      '  from { opacity: 0; transform: translateY(4px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',

      // Card internals
      '.pp-card-head {',
      '  padding: 5px 8px 4px; display: flex; align-items: center;',
      '  gap: 6px; flex-wrap: wrap;',
      '  border-bottom: 1px solid rgba(0,0,0,.07);',
      '}',
      '.pp-card-badge {',
      '  font-size: 9px; font-weight: 700; letter-spacing: .12em;',
      '  text-transform: uppercase; border-radius: 20px;',
      '  padding: 2px 7px; flex-shrink: 0;',
      '}',
      '.pp-card-dim {',
      '  font-size: 10px; font-weight: 600; letter-spacing: .06em;',
      '  text-transform: uppercase; color: rgba(0,0,0,.4);',
      '  flex: 1; min-width: 0; overflow: hidden;',
      '  text-overflow: ellipsis; white-space: nowrap;',
      '}',
      '.pp-card-body {',
      '  padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 5px;',
      '}',
      '.pp-field { font-size: 11px; line-height: 1.4; color: rgba(0,0,0,.65); }',
      '.pp-field-matched { color: rgba(0,0,0,.85); }',
      '.pp-flabel {',
      '  display: block; font-size: 9px; font-weight: 700;',
      '  letter-spacing: .1em; text-transform: uppercase;',
      '  color: rgba(0,0,0,.3); margin-bottom: 1px;',
      '}',
      '.pp-shared-pill {',
      '  margin: 0 8px 7px; padding: 2px 7px;',
      '  background: rgba(0,0,0,.06); border-radius: 20px;',
      '  font-size: 9px; font-weight: 600; letter-spacing: .06em;',
      '  color: rgba(0,0,0,.4); text-transform: uppercase;',
      '  display: inline-block; align-self: flex-start;',
      '}',

      // Keyword highlight
      'mark.pkw {',
      '  background: transparent; border-bottom: 2px solid currentColor;',
      '  font-weight: 700; padding: 0; color: inherit;',
      '  transition: border-bottom-color .15s, font-weight .15s;',
      '}',

      // Mindmap cards
      '.pp-mm-card {',
      '  position: absolute;',
      '  border: 1.5px solid var(--ppc-border, #aaa);',
      '  border-radius: 8px; background: var(--ppc-bg, #fff);',
      '  box-shadow: 0 2px 10px rgba(0,0,0,.12);',
      '  cursor: grab; user-select: none; z-index: 1; overflow: hidden;',
      '}',
      '.pp-mm-card:active { cursor: grabbing; }',
      '.pp-mm-card-head {',
      '  min-height: 6px; padding: 4px 8px;',
      '  display: flex; align-items: center; justify-content: center;',
      '}',
      '.pp-mm-seed .pp-mm-card-head { min-height: 22px; }',
      '.pp-mm-card-body {',
      '  padding: 5px 8px 7px; display: flex; flex-direction: column; gap: 3px;',
      '}',
      '.pp-mm-field {',
      '  font-size: 10px; line-height: 1.35; color: rgba(0,0,0,.7);',
      '  overflow: hidden; display: -webkit-box;',
      '  -webkit-line-clamp: 3; -webkit-box-orient: vertical;',
      '}',
      '.pp-mm-cat {',
      '  font-size: 9px; font-weight: 700; letter-spacing: .08em;',
      '  text-transform: uppercase; color: rgba(0,0,0,.35); margin-bottom: 2px;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }
}
