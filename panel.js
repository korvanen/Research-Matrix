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
const PANEL_KW_MIN_WORD_LEN = 4;
const PANEL_MIN_SHARED      = 2;
const PANEL_MM_PAD          = 10;
const PANEL_MM_ITERS        = 20;
const PANEL_CARD_W          = 160;
const PANEL_CARD_MIN_W      = 140;
const PANEL_CARD_MAX_W      = 240;
const PANEL_GOTO_DELAY      = 400;

// ── INIT ──────────────────────────────────────────────────────────────────────
console.log('[panel.js_v_X]');
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
  const ppBodyWrap = document.getElementById('pp-body-wrap');
  const sidebarEl  = document.getElementById('sidebar');

  // ── Grid layout — single source of truth ────────────────────────────────
  var _lastCols = 0, _lastCardW = 0, _gridRafId = null;

  function scheduleUpdateGrid() {
    if (_gridRafId) return;
    _gridRafId = requestAnimationFrame(() => {
      _gridRafId = null;
      _doUpdateGrid();
    });
  }

  function _doUpdateGrid() {
    var pad = 24;
    var gap = 10;
    var sbMargin = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-box-margin')
    ) || 8;
    var w = (sidebarEl ? sidebarEl.offsetWidth : sidebarBox.offsetWidth) - sbMargin * 2 - pad;
    if (w <= 0) return;

    var maxGroupSize = 0;
    var currentGroupSize = 0;
    var children = Array.from(ppBody.children);
    for (var ci = 0; ci < children.length; ci++) {
      var ch = children[ci];
      if (ch.classList.contains('pp-divider')) {
        if (currentGroupSize > maxGroupSize) maxGroupSize = currentGroupSize;
        currentGroupSize = 0;
      } else if (ch.classList.contains('pp-match-card')) {
        currentGroupSize++;
      }
    }
    if (currentGroupSize > maxGroupSize) maxGroupSize = currentGroupSize;
    var maxUsefulCols = maxGroupSize > 0 ? maxGroupSize : Infinity;

    var cols  = Math.min(
      Math.max(1, Math.floor((w + gap) / (PANEL_CARD_MIN_W + gap))),
      maxUsefulCols
    );
    var cardW = Math.min(PANEL_CARD_MAX_W, Math.floor((w - gap * (cols - 1)) / cols));

    if (cols === _lastCols && cardW === _lastCardW) return;
    _lastCols = cols;
    _lastCardW = cardW;

    ppBody.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cardW + 'px)';
    ppBody.style.width = '';
  }

  scheduleUpdateGrid();

  if (window.ResizeObserver) {
    new ResizeObserver(scheduleUpdateGrid).observe(sidebarEl || sidebarBox);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var hlOn         = true;
  var viewMode     = 'tiles';
  var seedKws      = new Set();
  var seedTabIdx   = -1;
  var seedRowIdx   = -1;
  // seedCells: array of { cats: string[], header: string, text: string }
  var seedCells    = [];
  var lastMatches  = [];
  var _mmActive    = null;
  var _mmMatchKey  = '';
  var _mmModeSnapshot = null;
  var _hasContent  = false;

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
        var currentKey = lastMatches.map(function(m){ return m.tabIdx+':'+m.rowIdx; }).join('|');
        if (!_mmActive || _mmMatchKey !== currentKey) {
          renderMindmap(lastMatches);
          if (_mmModeSnapshot && _mmModeSnapshot.matchKey === currentKey) {
            requestAnimationFrame(function() {
              requestAnimationFrame(function() {
                document.dispatchEvent(new CustomEvent('mm-snapshot-restore',
                  { detail: _mmModeSnapshot, bubbles: false }));
              });
            });
          }
        }
      } else {
        if (_mmActive) {
          var positions = new Map();
          _mmActive.rects.forEach(function(r, key) { positions.set(key, { x: r.x, y: r.y }); });
          _mmModeSnapshot = { matchKey: _mmMatchKey, positions: positions };
        }
        ppMmWrap.style.display = 'none';
        if (_hasContent && lastMatches !== undefined) {
          var _td  = typeof TABS !== 'undefined' ? TABS[seedTabIdx] : null;
          var _tdd = _td && typeof processSheetData === 'function' ? processSheetData(_td.grid) : null;
          renderTiles(lastMatches, seedKws, seedTabIdx, _tdd);
        } else {
          ppBody.style.display = 'grid';
        }
      }
    }
  );
  ppViewWrap.appendChild(viewPill.el);

  // ── Empty state ────────────────────────────────────────────────────────────
  function showEmpty(msg) {
    msg = msg || 'Click a cell to find matches';
    ppSubtitle.textContent  = msg;
    ppBody.innerHTML        = '<div class="pp-empty">' + panelEscH(msg) + '</div>';
    ppBody.style.display    = 'grid';
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
    var selectedCols = new Map();

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
    var newSeedCells = [];
    var sortedRows = [...selectedCols.keys()].sort(function(a, b) { return a - b; });

    sortedRows.forEach(function(ri) {
      var row = data.rows[ri];
      if (!row) return;
      var cats = row.cats ? row.cats.filter(function(c) { return c.trim(); }) : [];
      var sortedCols = [...selectedCols.get(ri)].sort(function(a, b) { return a - b; });
      sortedCols.forEach(function(ci) {
        var txt = (row.cells[ci] || '').trim();
        if (!txt) return;
        var h = data.headers[ci] || '';
        newSeedCells.push({ cats: cats, header: h, text: txt });
        allText.push(txt);
      });
    });

    if (!allText.length) return false;

    seedCells = newSeedCells;

    var kws = new Set(panelExtractKW(allText.join(' ')));
    if (!kws.size) return false;

    seedKws    = kws;
    seedTabIdx = curTabIdx;
    seedRowIdx = sortedRows[0];
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
    _mmModeSnapshot = null;

    if (viewMode === 'mindmap') {
      var newKey = lastMatches.map(function(m){ return m.tabIdx+':'+m.rowIdx; }).join('|');
      if (!_mmActive || _mmMatchKey !== newKey) {
        renderMindmap(lastMatches);
      }
    } else {
      renderTiles(lastMatches, seedKws, curTabIdx, data);
    }
  }

  // ── MutationObserver ──────────────────────────────────────────────────────
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

  var catBodyEl2 = document.getElementById('cat-body');
  if (catBodyEl2) catBodyEl2.addEventListener('click', function(e) {
    if (!e.target.closest('td')) return;
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(refreshFromSelection, 80);
  });

  // ── TILES VIEW ────────────────────────────────────────────────────────────
  function renderTiles(matches, kws, srcTabIdx, srcData) {
    ppMmWrap.style.display = 'none';
    ppMmWrap.innerHTML     = '';
    _mmActive = null;

    if (viewMode === 'mindmap') { viewMode = 'tiles'; viewPill.setValue('tiles', false); }

    var frag = document.createDocumentFragment();

    var vars        = panelThemeVars(srcTabIdx);
    var accentSrc   = vars['--tab-active-bg']    || '#888';
    var labelSrc    = vars['--tab-active-color'] || '#fff';
    var bgSrc       = vars['--bg-data']          || '#f8f8f8';
    var tabLabel    = (srcData && srcData.title) ? srcData.title
                      : (typeof TABS !== 'undefined' ? TABS[srcTabIdx].name : '');

    function buildSeedCard() {
      var card = document.createElement('div');
      card.className = 'pp-match-card pp-seed-card';
      card.style.setProperty('--ppc-border', accentSrc);
      card.style.setProperty('--ppc-bg',     bgSrc);

      var head = document.createElement('div');
      head.className = 'pp-card-head';
      head.innerHTML =
        '<span class="pp-card-badge" style="background:' + accentSrc + ';color:' + labelSrc + '">Selected</span>';

      var body = document.createElement('div');
      body.className = 'pp-card-body';

      seedCells.forEach(function(c, idx) {
        if (idx > 0) {
          var sep = document.createElement('div');
          sep.className = 'pp-seed-sep';
          body.appendChild(sep);
        }
        if (c.cats && c.cats.length) {
          var catEl = document.createElement('div');
          catEl.className = 'pp-seed-cats';
          catEl.textContent = c.cats.join(' · ');
          body.appendChild(catEl);
        }
        var f = document.createElement('div');
        f.className = 'pp-field pp-field-matched';
        f.innerHTML = '<span class="pp-flabel">' + panelEscH(c.header) + '</span>' +
          panelHighlight(c.text, kws);
        body.appendChild(f);
      });

      card.appendChild(head);
      card.appendChild(body);
      return card;
    }

    if (!matches.length) {
      ppSubtitle.textContent  = 'No matches found';
      ppToolrow.style.display = 'none';
      var divNone = document.createElement('div');
      divNone.className = 'pp-divider';
      divNone.style.borderColor = accentSrc;
      divNone.innerHTML = '<span style="background:' + accentSrc + ';color:' + labelSrc + '">' + panelEscH(tabLabel) + '</span>';
      frag.appendChild(divNone);
      frag.appendChild(buildSeedCard());
      var emptyEl = document.createElement('div');
      emptyEl.className = 'pp-empty';
      emptyEl.textContent = 'No matching entries found';
      frag.appendChild(emptyEl);
      ppBody.innerHTML = '';
      ppBody.appendChild(frag);
      ppBody.style.display = 'grid';
      scheduleUpdateGrid();
      return;
    }

    ppSubtitle.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es') +
      ' · ' + [...kws].slice(0, 4).join(', ');
    ppToolrow.style.display = 'flex';
    hlOn = true;
    hlPill.setValue('show', false);

    var byTab = new Map();
    matches.forEach(function(m) {
      if (!byTab.has(m.tabIdx)) byTab.set(m.tabIdx, []);
      byTab.get(m.tabIdx).push(m);
    });
    if (!byTab.has(srcTabIdx)) byTab.set(srcTabIdx, []);

    var sortedTabKeys = [srcTabIdx].concat(
      [...byTab.keys()].filter(function(t){ return t !== srcTabIdx; }).sort()
    );

    sortedTabKeys.forEach(function(tabIdx) {
      var tabMatches  = byTab.get(tabIdx) || [];
      var tv          = panelThemeVars(tabIdx);
      var tabNameStr  = tabIdx === srcTabIdx ? tabLabel
        : ((tabMatches[0] && tabMatches[0].title) || (typeof TABS !== 'undefined' ? TABS[tabIdx].name : 'Tab ' + tabIdx));
      var accentColor = tv['--tab-active-bg'] || '#888';
      var bgColor     = tv['--bg-data']       || '#f8f8f8';

      var divider = document.createElement('div');
      divider.className = 'pp-divider';
      divider.style.borderColor = accentColor;
      divider.innerHTML =
        '<span style="background:' + accentColor +
        ';color:' + (tv['--tab-active-color'] || '#fff') + '">' +
        panelEscH(tabNameStr) + '</span>';
      frag.appendChild(divider);

      if (tabIdx === srcTabIdx) frag.appendChild(buildSeedCard());

      tabMatches.forEach(function(m) {
        var card = document.createElement('div');
        card.className = 'pp-match-card';
        card.style.setProperty('--ppc-border', accentColor);
        card.style.setProperty('--ppc-bg',     bgColor);

        var head = document.createElement('div');
        head.className = 'pp-card-head';
        var cats = m.row.cats ? m.row.cats.filter(function(c) { return c.trim(); }) : [];
        if (cats.length) {
          head.innerHTML = '<span class="pp-card-dim">' + cats.map(panelEscH).join(' · ') + '</span>';
        }

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

        var sharedPill = document.createElement('div');
        sharedPill.className = 'pp-shared-pill';
        sharedPill.textContent = m.shared.size + ' shared: ' + [...m.shared].slice(0, 3).join(', ');

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

    var matchCards = ppBody.querySelectorAll('.pp-match-card');
    matchCards.forEach(function(card, i) {
      card.style.animationDelay = (i * 30) + 'ms';
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

    var svgTop = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgTop.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:9999';
    ppMmWrap.appendChild(svgTop);

    var cardEls    = new Map();
    var rects      = new Map();
    var arrowDefs  = [];
    var cardColors      = new Map();
    var collapsedHeights = new Map();
    var _mmTouchExpanded = null;
    var _topZ      = 10;
    var cardBaseZ  = new Map();

    // ── Lock state ─────────────────────────────────────────────────────────
    // Set of card keys that are pinned in expanded state
    var _lockedCards = new Set();

    function isLocked(key) { return _lockedCards.has(key); }

    function setLocked(key, locked, cardEl) {
      if (locked) {
        _lockedCards.add(key);
      } else {
        _lockedCards.delete(key);
      }
      // Update card and lock icon visuals
      if (cardEl) cardEl.classList.toggle('pp-mm-card-locked', locked);
      var lockIcon = cardEl ? cardEl.querySelector('.pp-mm-lock') : null;
      if (lockIcon) {
        lockIcon.classList.toggle('pp-mm-lock-active', locked);
        lockIcon.setAttribute('aria-label', locked ? 'Unlock card' : 'Lock card expanded');
        lockIcon.title = locked ? 'Click to unlock' : 'Click to lock expanded';
      }
    }

    // ── SVG lock icon ──────────────────────────────────────────────────────
    // Returns an SVG string for the lock (closed or open)
    function lockIconSVG(locked) {
      if (locked) {
        // Closed lock
        return '<svg viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
          '<rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>' +
          '<path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
          '<circle cx="6" cy="9.5" r="1" fill="white" opacity="0.8"/>' +
          '</svg>';
      } else {
        // Open lock
        return '<svg viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
          '<rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.35"/>' +
          '<path d="M3.5 6V4.5a2.5 2.5 0 0 1 5 0V3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.45"/>' +
          '<circle cx="6" cy="9.5" r="1" fill="white" opacity="0.35"/>' +
          '</svg>';
      }
    }

    function getCardRect(key) {
      var el = cardEls.get(key);
      var r  = rects.get(key);
      if (!r) return null;
      if (!el) return { x: r.x, y: r.y, w: r.w, h: r.h };
      var wrap = ppMmWrap.getBoundingClientRect();
      var cr   = el.getBoundingClientRect();
      return { x: cr.left - wrap.left, y: cr.top - wrap.top, w: r.w, h: cr.height };
    }

    function getConnectionPoints(key) {
      var vr = getCardRect(key);
      if (!vr) return [];
      var x = vr.x, y = vr.y, W = vr.w, H = vr.h;
      return [
        { x: x + W * 0.25, y: y         },
        { x: x + W * 0.5,  y: y         },
        { x: x + W * 0.75, y: y         },
        { x: x + W * 0.25, y: y + H     },
        { x: x + W * 0.5,  y: y + H     },
        { x: x + W * 0.75, y: y + H     },
        { x: x,            y: y + H / 3 },
        { x: x,            y: y + H * 2/3 },
        { x: x + W,        y: y + H / 3 },
        { x: x + W,        y: y + H * 2/3 },
      ];
    }

    function closestPointPair(ptsA, ptsB) {
      var best = null, bestDist = Infinity;
      ptsA.forEach(function(a) {
        ptsB.forEach(function(b) {
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestDist) { bestDist = d; best = { a: a, b: b }; }
        });
      });
      return best;
    }

    function getEdgeTangent(pt, key) {
      var vr = getCardRect(key);
      if (!vr) return { dx: 0, dy: 1 };
      var tol = 3;
      if (Math.abs(pt.y - vr.y)           < tol) return { dx: 0, dy: -1 };
      if (Math.abs(pt.y - (vr.y + vr.h))  < tol) return { dx: 0, dy:  1 };
      if (Math.abs(pt.x - vr.x)           < tol) return { dx: -1, dy: 0 };
      if (Math.abs(pt.x - (vr.x + vr.w))  < tol) return { dx:  1, dy: 0 };
      return { dx: 0, dy: 1 };
    }

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
      while (svg.firstChild)    svg.removeChild(svg.firstChild);
      while (svgTop.firstChild) svgTop.removeChild(svgTop.firstChild);

      var ns = 'http://www.w3.org/2000/svg';
      arrowDefs.forEach(function(def) {
        var ptsA = getConnectionPoints(def.fromKey);
        var ptsB = getConnectionPoints(def.toKey);
        if (!ptsA.length || !ptsB.length) return;
        var pair = closestPointPair(ptsA, ptsB);
        if (!pair) return;

        var ax = pair.a.x, ay = pair.a.y, bx = pair.b.x, by = pair.b.y;
        var dist = Math.hypot(bx - ax, by - ay);
        var offset = Math.min(dist * 0.45, 90);
        var tanA = getEdgeTangent(pair.a, def.fromKey);
        var tanB = getEdgeTangent(pair.b, def.toKey);
        var cp1x = ax + tanA.dx * offset, cp1y = ay + tanA.dy * offset;
        var cp2x = bx + tanB.dx * offset, cp2y = by + tanB.dy * offset;
        var curve = document.createElementNS(ns, 'path');
        curve.setAttribute('d',
          'M' + ax + ',' + ay +
          ' C' + cp1x + ',' + cp1y +
          ' '  + cp2x + ',' + cp2y +
          ' '  + bx   + ',' + by);
        curve.setAttribute('fill',           'none');
        curve.setAttribute('stroke',         def.color);
        curve.setAttribute('stroke-width',   '1.5');
        curve.setAttribute('stroke-opacity', '0.45');
        svg.appendChild(curve);

        [[pair.a, def.fromKey], [pair.b, def.toKey]].forEach(function(item) {
          var pt = item[0], k = item[1];
          var colors = cardColors.get(k) || { border: def.color, bg: '#fff' };
          var circle = document.createElementNS(ns, 'circle');
          circle.setAttribute('cx',           pt.x);
          circle.setAttribute('cy',           pt.y);
          circle.setAttribute('r',            '4');
          circle.setAttribute('fill',         colors.bg);
          circle.setAttribute('stroke',       colors.border);
          circle.setAttribute('stroke-width', '1.5');
          svgTop.appendChild(circle);
        });
      });
    }

    var MM_EXPAND_MS    = 260;
    var MM_HOVER_DELAY  = 200;

    function _btnReset(btn) {
      if (!btn) return;
      btn.style.transition    = '';
      btn.style.opacity       = '';
      btn.style.pointerEvents = '';
      btn.classList.remove('pp-goto-visible');
    }

    var BTN_APPEAR_DELAY = Math.round(MM_EXPAND_MS * 0.60);
    var BTN_APPEAR_DUR   = Math.round(MM_EXPAND_MS * 0.55);

    function mmSetExpanded(cardEl, expanded, key) {
      var btn = cardEl.querySelector('.pp-goto-btn');
      clearTimeout(cardEl._expandTimer);
      clearTimeout(cardEl._btnTimer);

      if (expanded) {
        // Already fully expanded — don't re-animate (prevents flicker on locked cards)
        if (cardEl._mmExpandState === 'expanded') return;

        cardEl._mmExpandState = 'expanded';
        cardEl.style.zIndex = (_topZ + 1) + '';

        if (!collapsedHeights.has(key)) {
          collapsedHeights.set(key, cardEl.offsetHeight);
        }
        var collH = collapsedHeights.get(key);

        cardEl.classList.add('pp-mm-expanded');
        cardEl.style.transition = 'none';
        cardEl.style.height     = '';
        void cardEl.offsetHeight;

        var contentH = 0;
        Array.from(cardEl.children).forEach(function(child) {
          if (child.classList.contains('pp-goto-btn')) return;
          contentH += child.scrollHeight;
        });
        var cs = getComputedStyle(cardEl);
        contentH += parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.borderBottomWidth || 0);
        var fullH = contentH;

        cardEl.style.height = collH + 'px';
        void cardEl.offsetHeight;
        cardEl.style.transition = 'height ' + MM_EXPAND_MS + 'ms cubic-bezier(0.22,1,0.36,1)';
        cardEl.style.height     = fullH + 'px';

      } else {
        // Don't collapse if locked
        if (isLocked(key)) return;

        cardEl._mmExpandState = 'collapsed';

        void cardEl.offsetHeight;
        var curH  = cardEl.getBoundingClientRect().height;
        var collH = collapsedHeights.get(key) || curH;

        cardEl.style.transition = 'none';
        cardEl.style.height     = curH + 'px';
        void cardEl.offsetHeight;
        cardEl.classList.remove('pp-mm-expanded');
        cardEl.classList.remove('pp-mm-touch-expanded');

        cardEl.style.transition = 'height ' + MM_EXPAND_MS + 'ms cubic-bezier(0.22,1,0.36,1)';
        cardEl.style.height     = collH + 'px';

        cardEl._expandTimer = setTimeout(function() {
          if (cardEl._mmExpandState !== 'collapsed') return;
          cardEl.style.transition = '';
          cardEl.style.height     = '';
          cardEl.style.zIndex = (cardBaseZ.get(key) || 1) + '';
          if (btn) _btnReset(btn);
        }, MM_EXPAND_MS + 20);
      }
    }

    function makeDraggable(el, key) {
      var isDragging = false, wasDrag = false;
      var ox = 0, oy = 0, sl = 0, st = 0;
      var touchStartX = 0, touchStartY = 0;

      function dragStart(clientX, clientY) {
        isDragging = true; wasDrag = false; el._mmIsDragging = true;
        ox = clientX; oy = clientY;
        sl = parseFloat(el.style.left) || 0;
        st = parseFloat(el.style.top)  || 0;

        // If locked, keep expanded during drag (don't collapse)
        if (!isLocked(key)) {
          var btn = el.querySelector('.pp-goto-btn');
          if (btn) btn.classList.remove('pp-goto-visible');
          clearTimeout(el._expandTimer);
          clearTimeout(el._btnTimer);
          el._mmExpandState = 'collapsed';
          el.classList.remove('pp-mm-expanded');
          el.classList.remove('pp-mm-touch-expanded');
          el.style.transition = 'none';
          el.style.height     = '';
          collapsedHeights.delete(key);
          if (_mmTouchExpanded === el) _mmTouchExpanded = null;
        }

        el.style.zIndex = (_topZ + 2) + '';
      }

      function dragMove(clientX, clientY) {
        if (!isDragging) return;
        wasDrag = true;
        var r = rects.get(key) || { w: PANEL_CARD_W, h: 80 };
        var pos = clampToCanvas(sl + (clientX - ox), st + (clientY - oy), r.w, r.h);
        el.style.left = pos[0] + 'px'; el.style.top = pos[1] + 'px';
        rects.set(key, { x: pos[0], y: pos[1], w: r.w, h: r.h });
        pushApart(key);
        redrawArrows();
      }

      function dragEnd() {
        if (!isDragging) return;
        isDragging = false; el._mmIsDragging = false;
        _topZ++;
        cardBaseZ.set(key, _topZ);
        el.style.zIndex = _topZ + '';
        redrawArrows();

        // If locked, re-expand immediately after drag
        if (isLocked(key)) {
          mmSetExpanded(el, true, key);
          return;
        }

        // For unlocked cards: if the mouse is still physically over the card,
        // mouseenter won't re-fire. Re-trigger the hover expand manually.
        if (el.matches(':hover')) {
          clearTimeout(el._postDragExpandTimer);
          el._postDragExpandTimer = setTimeout(function() {
            if (!el._mmIsDragging) mmSetExpanded(el, true, key);
          }, MM_HOVER_DELAY);
        }
      }

      el.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        // Don't start drag on lock icon or goto button
        if (e.target.closest('.pp-mm-lock') || e.target.closest('.pp-goto-btn')) return;
        dragStart(e.clientX, e.clientY);
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', function(e) { dragMove(e.clientX, e.clientY); });
      document.addEventListener('mouseup', dragEnd);

      el.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        if (e.target.closest('.pp-mm-lock') || e.target.closest('.pp-goto-btn')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        dragStart(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchmove', function(e) {
        if (e.touches.length !== 1) return;
        dragMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', function(e) {
        var t = e.changedTouches[0];
        var dx = (t ? t.clientX : touchStartX) - touchStartX;
        var dy = (t ? t.clientY : touchStartY) - touchStartY;
        var moved = Math.hypot(dx, dy);
        dragEnd();
        if (moved < 8) {
          var wantsExpand = !el.classList.contains('pp-mm-touch-expanded');
          if (_mmTouchExpanded && _mmTouchExpanded !== el) {
            var prevKey = _mmTouchExpanded._mmKey;
            _mmTouchExpanded.classList.remove('pp-mm-touch-expanded');
            if (!isLocked(prevKey)) mmSetExpanded(_mmTouchExpanded, false, prevKey);
          }
          _mmTouchExpanded = wantsExpand ? el : null;
          if (wantsExpand) el.classList.add('pp-mm-touch-expanded');
          else             el.classList.remove('pp-mm-touch-expanded');
          mmSetExpanded(el, wantsExpand, key);
        }
      });
      el.addEventListener('touchcancel', dragEnd);
    }

    function makeCard(text, header, tabIdx, key, isSeed, cats, kwsHL, matchObj, tabName) {
      var tv = panelThemeVars(tabIdx);
      var accentColor  = tv['--tab-active-bg']    || '#888';
      var labelColor   = tv['--tab-active-color'] || '#fff';
      var bgColor      = tv['--bg-data']          || '#fff';
      cardColors.set(key, { border: accentColor, bg: bgColor });
      var card = document.createElement('div');
      card.className = 'pp-mm-card' + (isSeed ? ' pp-mm-seed' : '');
      card.style.width = PANEL_CARD_W + 'px';
      card.style.setProperty('--ppc-border', accentColor);
      card.style.setProperty('--ppc-bg',     bgColor);

      // ── Card head with lock icon ──────────────────────────────────────────
      var badgeHtml = isSeed
        ? '<span class="pp-mm-badge">Selected</span>'
        : '';

      // Lock icon button — faint until hovered/locked
      var lockBtn = document.createElement('button');
      lockBtn.className = 'pp-mm-lock';
      lockBtn.setAttribute('aria-label', 'Lock card expanded');
      lockBtn.title = 'Click to lock expanded';
      lockBtn.innerHTML = lockIconSVG(false);
      lockBtn.style.color = labelColor;

      var cardHead = document.createElement('div');
      cardHead.className = 'pp-mm-card-head';
      cardHead.style.background = accentColor;
      cardHead.style.color = labelColor;
      cardHead.innerHTML =
        badgeHtml +
        '<span class="pp-mm-head-label">' + panelEscH(tabName || '') + '</span>';
      cardHead.appendChild(lockBtn);

      // Lock button click handler
      lockBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var nowLocked = !isLocked(key);
        setLocked(key, nowLocked, card);
        lockBtn.innerHTML = lockIconSVG(nowLocked);
        if (nowLocked) {
          // Ensure card is expanded when locked
          mmSetExpanded(card, true, key);
        } else {
          // If mouse isn't over card, collapse
          if (!card.matches(':hover')) {
            mmSetExpanded(card, false, key);
          }
        }
      });

      // ── Card body ─────────────────────────────────────────────────────────
      var bodyHtml = '';
      if (isSeed) {
        var firstCell = seedCells[0];
        var firstCatHtml = (firstCell && firstCell.cats && firstCell.cats.length)
          ? '<div class="pp-mm-cat">' + firstCell.cats.map(panelEscH).join(' · ') + '</div>'
          : '';
        var firstFieldHtml = firstCell
          ? '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(firstCell.header) + '</span>' +
            panelHighlight(firstCell.text, kwsHL) + '</div>'
          : '';
        var extraHtml = '';
        if (seedCells.length > 1) {
          extraHtml = '<div class="pp-mm-seed-extra">' +
            seedCells.slice(1).map(function(c) {
              var catHtml = (c.cats && c.cats.length)
                ? '<div class="pp-mm-cat">' + c.cats.map(panelEscH).join(' · ') + '</div>'
                : '';
              return '<div class="pp-mm-seed-sep"></div>' + catHtml +
                '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(c.header) + '</span>' +
                panelHighlight(c.text, kwsHL) + '</div>';
            }).join('') +
          '</div>';
        }
        bodyHtml = firstCatHtml + firstFieldHtml + extraHtml;
      } else {
        var catLine = cats && cats.length ? cats.map(panelEscH).join(' · ') : '';
        bodyHtml =
          (catLine ? '<div class="pp-mm-cat">' + catLine + '</div>' : '') +
          '<div class="pp-mm-field"><span class="pp-flabel">' + panelEscH(header) + '</span>' +
          panelHighlight(text, kwsHL) + '</div>';
      }

      var cardBody = document.createElement('div');
      cardBody.className = 'pp-mm-card-body';
      cardBody.innerHTML = bodyHtml;

      card.appendChild(cardHead);
      card.appendChild(cardBody);

      if (!isSeed && matchObj) {
        attachGoTo(card, matchObj, accentColor);
      }

      ppMmWrap.appendChild(card);
      card._mmKey = key;
      makeDraggable(card, key);
      cardEls.set(key, card);

      var _hoverEnterTimer = null;
      card.addEventListener('mouseenter', function() {
        if (card._mmIsDragging) return;
        clearTimeout(_hoverEnterTimer);
        _hoverEnterTimer = setTimeout(function() {
          if (_mmTouchExpanded === card) {
            card.classList.remove('pp-mm-touch-expanded');
            _mmTouchExpanded = null;
          }
          mmSetExpanded(card, true, key);
        }, MM_HOVER_DELAY);
      });
      card.addEventListener('mouseleave', function() {
        clearTimeout(_hoverEnterTimer);
        clearTimeout(card._postDragExpandTimer);
        if (card.classList.contains('pp-mm-touch-expanded')) return;
        // Don't collapse if locked
        if (isLocked(key)) return;
        mmSetExpanded(card, false, key);
      });

      if (window.ResizeObserver) {
        new ResizeObserver(function() { redrawArrows(); }).observe(card);
      }
      return card;
    }

    var seedKey = 'seed';
    var _seedTab   = typeof TABS !== 'undefined' ? TABS[seedTabIdx] : null;
    var _seedData  = _seedTab && typeof processSheetData === 'function' ? processSheetData(_seedTab.grid) : null;
    var _seedCats  = _seedData && _seedData.rows[seedRowIdx] ? _seedData.rows[seedRowIdx].cats.filter(function(c){ return c.trim(); }) : [];
    var _seedTabName = (_seedData && _seedData.title) ? _seedData.title : (_seedTab ? _seedTab.name : '');
    makeCard('', '', seedTabIdx, seedKey, true, _seedCats, seedKws, null, _seedTabName);

    matches.forEach(function(m) {
      var indices = Array.from({ length: m.row.cells.length }, function(_, i) { return i; })
        .filter(function(ci) { return (m.row.cells[ci] || '').trim(); });
      if (!indices.length) return;

      indices.sort(function(a, b) {
        var ka = panelExtractKW(m.row.cells[a]).filter(function(k) { return m.shared.has(k); }).length;
        var kb = panelExtractKW(m.row.cells[b]).filter(function(k) { return m.shared.has(k); }).length;
        return kb - ka;
      });

      var bestColIdx = indices[0];
      var text   = m.row.cells[bestColIdx] || '';
      var header = m.headers[bestColIdx]   || '';
      var key    = 'm-' + m.tabIdx + '-' + m.rowIdx;
      var cats   = m.row.cats ? m.row.cats.filter(function(c) { return c.trim(); }) : [];
      var tv     = panelThemeVars(m.tabIdx);

      var _mTabD = (m.tabIdx === seedTabIdx && _seedData) ? _seedData :
        (typeof TABS !== 'undefined' && typeof processSheetData === 'function' ? processSheetData(TABS[m.tabIdx].grid) : null);
      var _mTabName = (_mTabD && _mTabD.title) ? _mTabD.title :
        (typeof TABS !== 'undefined' ? TABS[m.tabIdx].name : 'Tab ' + m.tabIdx);
      makeCard(text, header, m.tabIdx, key, false, cats, m.shared, m, _mTabName);
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
      _mmActive   = { rects, cardEls, arrowDefs, redrawArrows, pushApart };
      _mmMatchKey = lastMatches.map(function(m){ return m.tabIdx+':'+m.rowIdx; }).join('|');
      _mmLastW = mmW(); _mmLastH = mmH();
      requestAnimationFrame(function() { applyHlState(); });
    });
  }

  var _mmLastW = 0, _mmLastH = 0, _mmResizeRafId = null;
  if (window.ResizeObserver) {
    new ResizeObserver(function() {
      if (viewMode !== 'mindmap' || !_mmActive) return;
      if (_mmResizeRafId) return;
      _mmResizeRafId = requestAnimationFrame(function() {
        _mmResizeRafId = null;
        var newW = mmW(), newH = mmH();
        if (newW === _mmLastW && newH === _mmLastH) return;

        var walls = [];
        if (newW < _mmLastW) walls.push({ x: newW, y: 0, w: 1, h: newH });
        if (newH < _mmLastH) walls.push({ x: 0, y: newH, w: newW, h: 1 });

        _mmLastW = newW; _mmLastH = newH;

        if (!walls.length) {
          _mmActive.redrawArrows();
          return;
        }

        var dirty = false;
        _mmActive.rects.forEach(function(r, key) {
          var nx = Math.max(0, Math.min(newW - r.w, r.x));
          var ny = Math.max(0, Math.min(newH - r.h, r.y));
          if (nx !== r.x || ny !== r.y) {
            r.x = nx; r.y = ny;
            var el = _mmActive.cardEls.get(key);
            if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
            dirty = true;
          }
        });

        if (dirty) {
          _mmActive.pushApart(null);
          _mmActive.redrawArrows();
        } else {
          _mmActive.redrawArrows();
        }
      });
    }).observe(ppMmWrap);
  }

  // ── Mindmap snapshot events ─────────────────────────────────────────────────
  document.addEventListener('mm-snapshot-request', function() {
    if (!_mmActive) return;
    var positions = new Map();
    _mmActive.rects.forEach(function(r, key) {
      positions.set(key, { x: r.x, y: r.y });
    });
    window.__mmSnapshotData = { matchKey: _mmMatchKey, positions: positions };
  });

  document.addEventListener('mm-snapshot-restore', function(e) {
    var snap = e.detail;
    if (!snap || !_mmActive) return;
    if (snap.matchKey !== _mmMatchKey) return;

    requestAnimationFrame(function() {
      if (!_mmActive || snap.matchKey !== _mmMatchKey) return;

      var targets = new Map();
      snap.positions.forEach(function(pos, key) {
        var r = _mmActive.rects.get(key);
        if (!r) return;
        targets.set(key, {
          nx: Math.max(0, Math.min(mmW() - r.w, pos.x)),
          ny: Math.max(0, Math.min(mmH() - r.h, pos.y))
        });
      });

      _mmActive.cardEls.forEach(function(el) {
        el.style.transition = 'left 0.38s cubic-bezier(0.25,1,0.5,1), ' +
                              'top  0.38s cubic-bezier(0.25,1,0.5,1)';
      });

      requestAnimationFrame(function() {
        if (!_mmActive || snap.matchKey !== _mmMatchKey) return;

        targets.forEach(function(t, key) {
          var r  = _mmActive.rects.get(key);
          var el = _mmActive.cardEls.get(key);
          if (!r || !el) return;
          r.x = t.nx; r.y = t.ny;
          el.style.left = t.nx + 'px';
          el.style.top  = t.ny + 'px';
        });

        var start  = performance.now();
        var dur    = 480;
        function arrowRaf(now) {
          _mmActive.redrawArrows();
          if (now - start < dur) requestAnimationFrame(arrowRaf);
        }
        requestAnimationFrame(arrowRaf);

        setTimeout(function() {
          if (!_mmActive) return;
          _mmActive.cardEls.forEach(function(el) { el.style.transition = ''; });
        }, 420);
      });
    });
  });

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
  display: grid;
  gap: 10px;
  align-content: start;
  align-items: start;
  width: 100%;
  transition: grid-template-columns 0.18s ease;
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

/* Seed card — shares pp-match-card layout, slightly thicker border to distinguish */
.pp-seed-card.pp-match-card {
  border-width: 2px;
}

/* Match card */
.pp-match-card {
  min-width: 0;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px; background: var(--ppc-bg, #f8f8f8);
  overflow: visible; box-sizing: border-box;
  animation: pp-fade-in .22s ease both;
  position: relative;
}
@keyframes pp-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
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

/* Seed card multi-cell separators and category labels */
.pp-seed-cats {
  font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.35); margin-bottom: 1px;
}
.pp-seed-sep {
  border-top: 1px solid rgba(0,0,0,.08);
  margin: 4px 0;
}

/* "Go to" hover button — tiles view */
.pp-goto-btn {
  display: block; width: calc(100% - 16px);
  margin: 0 8px 0;
  margin-bottom: calc(-1 * (1em + 22px));
  padding: 5px 8px; border-radius: 6px; border: 1.5px solid;
  background: white; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; cursor: pointer; text-align: center;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity .22s ease, transform .22s ease, margin-bottom .22s ease;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
  pointer-events: none;
}
.pp-goto-btn.pp-goto-visible {
  opacity: 1;
  transform: translateY(0);
  margin-bottom: 8px;
  pointer-events: auto;
}
.pp-goto-btn:hover { filter: brightness(0.92); }

/* Keyword highlight */
mark.pkw {
  background: transparent; border-bottom: 2px solid currentColor;
  font-weight: 700; padding: 0; color: inherit;
  transition: border-bottom-color .15s, font-weight .15s;
}

/* ═══════════════════════════════════════════════════════
   MINDMAP CARDS
   ═══════════════════════════════════════════════════════ */

.pp-mm-card {
  position: absolute;
  border: 1.5px solid var(--ppc-border, #aaa);
  border-radius: 8px;
  background: var(--ppc-bg, #fff);
  box-shadow: 0 2px 10px rgba(0,0,0,.12);
  cursor: grab;
  user-select: none;
  z-index: 1;
  /* overflow:hidden clips the card head background to border-radius,
     but we switch to overflow:visible on expand so the goto button
     and any shadow aren't clipped. The head itself clips its background
     via its own border-radius. */
  overflow: hidden;
}
.pp-mm-card:active { cursor: grabbing; }
/* Expanded cards need overflow:visible so the abs-positioned goto button
   isn't clipped — driven by CSS so it applies in all states (hover, locked, etc.) */
.pp-mm-card.pp-mm-expanded { overflow: visible; }

/* Card head — border-radius on its own so background clips even
   when the parent card uses overflow:visible */
.pp-mm-card-head {
  border-radius: 6px 6px 0 0;
  min-height: 6px;
  padding: 0 6px 0 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
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
.pp-mm-card.pp-mm-expanded .pp-mm-head-label {
  max-height: 80px; opacity: 1; padding: 4px 0;
}

/* ── Lock icon button ───────────────────────────────── */
.pp-mm-lock {
  flex-shrink: 0;
  width: 18px; height: 18px;
  border: none; background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: grid; place-items: center;
  opacity: 0;
  transition: opacity .18s ease, background .12s ease;
  padding: 0;
  margin-left: auto;
  pointer-events: none;
}
/* Show lock icon when card is hovered or expanded */
.pp-mm-card:hover .pp-mm-lock,
.pp-mm-card.pp-mm-expanded .pp-mm-lock {
  opacity: 0.45;
  pointer-events: auto;
}
.pp-mm-lock:hover {
  opacity: 0.85 !important;
  background: rgba(255,255,255,0.20);
}
/* Active/locked state — always fully visible */
.pp-mm-lock.pp-mm-lock-active {
  opacity: 1 !important;
  pointer-events: auto;
  background: rgba(255,255,255,0.25);
}
.pp-mm-lock svg { display: block; pointer-events: none; }

/* ── Card body ──────────────────────────────────────── */
.pp-mm-card-body { padding: 5px 8px 7px; display: flex; flex-direction: column; gap: 3px; }
.pp-mm-field {
  font-size: 10px; line-height: 1.35; color: rgba(0,0,0,.7);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.pp-mm-card.pp-mm-expanded .pp-mm-field {
  display: block;
  -webkit-line-clamp: unset;
}
.pp-mm-cat {
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(0,0,0,.35); margin-bottom: 2px;
}
.pp-mm-seed-extra { display: none; }
.pp-mm-card.pp-mm-expanded .pp-mm-seed-extra { display: block; }
.pp-mm-seed-sep {
  border-top: 1px solid rgba(255,255,255,.25);
  margin: 4px 0;
}

/* ── Goto button — mindmap variant ─────────────────────
   Small icon pinned to the bottom-right corner of the card,
   mirroring the lock icon in the header. Visible only when
   expanded. Uses overflow:visible on the expanded card so
   it isn't clipped. */
.pp-mm-card .pp-goto-btn {
  position: absolute;
  bottom: 5px;
  right: 6px;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity .18s ease, background .12s ease;
  padding: 0;
  margin: 0;
  box-shadow: none;
  transform: none;
  color: var(--ppc-border, #888);
  /* Hide the text label — icon only */
  font-size: 0;
  letter-spacing: 0;
  text-transform: none;
}
.pp-mm-card.pp-mm-expanded .pp-goto-btn {
  opacity: 1;
  pointer-events: auto;
}
/* Locked cards: goto button always fully visible (no hover required) */
.pp-mm-card.pp-mm-card-locked .pp-goto-btn {
  opacity: 1;
  pointer-events: auto;
}
.pp-mm-card .pp-goto-btn:hover {
  opacity: 1 !important;
  background: rgba(0,0,0,0.10);
  filter: none;
}
/* Arrow icon — same diagonal top-right arrow as tiles mode goto */
.pp-mm-card .pp-goto-btn::after {
  content: '';
  display: block;
  width:  6px;
  height: 6px;
  border-top:   2px solid currentColor;
  border-right: 2px solid currentColor;
  transform: rotate(45deg) translate(-1px, 1px);
  flex-shrink: 0;
}
/* Hide the text label span */
.pp-mm-card .pp-goto-btn .pp-goto-label { display: none; }
`;
    document.head.appendChild(style);
  }
}
