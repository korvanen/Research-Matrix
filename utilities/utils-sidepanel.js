// ════════════════════════════════════════════════════════════════════════════
// utils-sidepanel.js — Shared utilities for panel.js
// Include BEFORE panel.js in index.html:
//   <script src="keyword-utils.js"></script>  ← owns: PANEL_STOP_WORDS, panelExtractKW, buildRowIndex, findMatches
//   <script src="panel-utils.js"></script>
//   <script src="panel.js"></script>
// ════════════════════════════════════════════════════════════════════════════

// ── HTML escaping ─────────────────────────────────────────────────────────────
function panelEscH(t) {
  return String(t == null ? '' : t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Keyword highlighting ──────────────────────────────────────────────────────
function panelHighlight(text, kwSet) {
  if (!kwSet || !kwSet.size) return panelEscH(text);
  const pat = new RegExp(
    '\\b(' + [...kwSet].map(k => k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\b', 'gi'
  );
  return panelEscH(text).replace(pat, m => '<mark class="pkw">' + m + '</mark>');
}

// ── Theme variable lookup ─────────────────────────────────────────────────────
function panelThemeVars(tabIdx) {
  const name = (typeof TAB_THEMES !== 'undefined' && TAB_THEMES[tabIdx]) || 'default';
  return (typeof THEMES !== 'undefined' && (THEMES[name] || THEMES.default)) || {};
}

// ── Pill toggle builder ───────────────────────────────────────────────────────
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
    Object.keys(btns).forEach(bv => btns[bv].classList.toggle('active', bv === v));
    const ab = btns[v];
    if (!ab) return;
    if (!animate) ind.style.transition = 'none';
    ind.style.left  = ab.offsetLeft + 'px';
    ind.style.width = ab.offsetWidth + 'px';
    if (!animate) requestAnimationFrame(() => { ind.style.transition = ''; });
  }
  setValue(options[0].value, false);
  if (window.ResizeObserver) new ResizeObserver(() => setValue(current, false)).observe(wrap);
  return { el: wrap, setValue };
}

// ── Citation extraction ───────────────────────────────────────────────────────
// Detects a trailing citation at the very end of cell text — the last (...)
// group only, so mid-sentence parens like "(between)" are never affected.
// Returns { body, citation } where citation is the inner text without parens
// (e.g. "Beck, 2019"), or { body: text, citation: null } if none found.
var _citationRe = /\s*\(([^)]+)\)\s*\.?\s*$/;
function parseCitation(text) {
  text = String(text == null ? '' : text);
  var m = _citationRe.exec(text);
  if (!m) return { body: text, citation: null };
  return {
    body:     text.slice(0, m.index).trimEnd(),
    citation: m[1],
  };
}

// ── Citation pill HTML builder ────────────────────────────────────────────────
function citationPillHtml(citation, accentColor, textColor) {
  if (!citation) return '';
  return '<span class="pp-cite-pill" style="background:' +
    panelEscH(accentColor) + ';color:' + panelEscH(textColor) + '">' +
    panelEscH(citation) + '</span>';
}

// ── Best column picker ────────────────────────────────────────────────────────
// Returns the index of the cell that contains the most shared-keyword hits.
// Falls back to the first non-empty column, then 0.
function _bestColForMatch(match) {
  if (!match || !match.row || !match.row.cells) return 0;
  var cells  = match.row.cells;
  var shared = match.shared; // Set

  var bestIdx   = -1;
  var bestScore = -1;

  cells.forEach(function(cell, ci) {
    if (!cell || !cell.trim()) return;
    var score = 0;
    if (shared && typeof shared.forEach === 'function') {
      var kws = (typeof panelExtractKW === 'function') ? panelExtractKW(cell) : [];
      shared.forEach(function(k) { if (kws.indexOf(k) !== -1) score++; });
    }
    // Higher keyword score wins; ties go to the first non-empty column
    if (score > bestScore || bestIdx === -1) {
      bestScore = score;
      bestIdx   = ci;
    }
  });

  return bestIdx >= 0 ? bestIdx : 0;
}

// ── Go-to navigation ──────────────────────────────────────────────────────────
// match  — match object with .tabIdx, .rowIdx, .row, .shared
// colIdx — explicit column to select (0-based). When omitted, the column with
//          the most shared-keyword hits is chosen automatically, so both tiles
//          and mindmap always land on the correct cell.
function panelGoTo(match, colIdx) {
  var tabIdx     = match.tabIdx;
  var rowIdx     = match.rowIdx;
  var targetCol  = (typeof colIdx === 'number' && colIdx >= 0)
    ? colIdx
    : _bestColForMatch(match);

  var needsTabSwitch = typeof activeTab !== 'undefined' && activeTab !== tabIdx;

  if (needsTabSwitch) {
    activeTab = tabIdx;
    if (typeof buildTabBar === 'function') buildTabBar();
    if (typeof showTab    === 'function') showTab(tabIdx);
  }

  function doSelect() {
    if (typeof clearSelection === 'function') clearSelection();

    var dataRows = Array.from(document.querySelectorAll('#data-body tr'));
    var tr = dataRows[rowIdx];
    if (!tr) return;

    var tds = Array.from(tr.querySelectorAll('td'));
    // targetCol is the data-column index — use it directly; fall back to td[0]
    var td = tds[targetCol] !== undefined ? tds[targetCol] : tds[0];
    if (!td) return;

    if (typeof getHighlightTargets === 'function' && typeof applySelection === 'function') {
      var targets = getHighlightTargets(td);
      if (targets) {
        applySelection(targets);
        td.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      td.classList.add('selected-cell');
      td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (needsTabSwitch) {
    // showTab → renderSheet → updateLayout uses two nested rAFs before the
    // layout is stable. setTimeout clears the async pipeline and guarantees
    // the new rows are in place before we query them.
    setTimeout(doSelect, 150);
  } else {
    requestAnimationFrame(doSelect);
  }
}

// ── Attach "Go to" hover button (tiles view) ──────────────────────────────────
// Computes the best column once at attach-time so every click on this card
// navigates to the most-relevant cell rather than always column 0.
function attachGoTo(card, match, accentColor) {
  // Compute once — reused on every hover/click for this card
  var bestCol    = _bestColForMatch(match);
  var hoverTimer = null;
  var btn        = null;

  function showBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.className = 'pp-goto-btn';
    btn.textContent = 'Go to ↗';
    btn.style.borderColor = accentColor || 'rgba(0,0,0,.2)';
    btn.style.color       = accentColor || 'rgba(0,0,0,.6)';
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      panelGoTo(match, bestCol);
    });
    btn.addEventListener('mouseenter', function() { clearTimeout(hoverTimer); });
    btn.addEventListener('mouseleave', function() { hideBtn(); });
    card.appendChild(btn);
    requestAnimationFrame(function() { btn && btn.classList.add('pp-goto-visible'); });
  }

  function hideBtn() {
    if (!btn) return;
    var b = btn;
    btn = null;
    b.classList.remove('pp-goto-visible');
    setTimeout(function() { if (b.parentNode) b.parentNode.removeChild(b); }, 180);
  }

  card.addEventListener('mouseenter', function() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(showBtn, PANEL_GOTO_DELAY);
  });
  card.addEventListener('mouseleave', function(e) {
    clearTimeout(hoverTimer);
    if (btn && btn.contains(e.relatedTarget)) return;
    hideBtn();
  });
}

// ── Bounce-animated range slider ──────────────────────────────────────────────
// Wraps a native <input type="range"> with a custom-drawn thumb that animates
// with a bounce/ease on each step. The native input stays in the DOM (hidden)
// so all existing event listeners, IDs, and accessibility work unchanged.
//
// Call upgradeSlider(inputEl) after the input is in the DOM.
function upgradeSlider(input) {
  var variant = input.classList.contains('pp-range--accent') ? 'accent'
              : input.classList.contains('pp-range--muted')  ? 'muted'
              : '';

  var wrap  = document.createElement('div');
  wrap.className = 'pp-range-wrap' + (variant ? ' pp-range-wrap--' + variant : '');

  var track = document.createElement('div');
  track.className = 'pp-range-track';

  var fill  = document.createElement('div');
  fill.className = 'pp-range-fill';

  var thumb = document.createElement('div');
  thumb.className = 'pp-range-thumb';

  track.appendChild(fill);
  wrap.appendChild(track);
  wrap.appendChild(thumb);

  // Insert wrap before input, then move input inside wrap
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  function update() {
    var min = +input.min || 0;
    var max = +input.max || 100;
    var val = +input.value;
    var pct = (val - min) / (max - min) * 100;
    thumb.style.left = pct + '%';
    fill.style.width = pct + '%';
  }

  // Initial position without animation
  thumb.style.transition = 'none';
  fill.style.transition  = 'none';
  update();
  requestAnimationFrame(function() {
    thumb.style.transition = '';
    fill.style.transition  = '';
  });

  input.addEventListener('input', update);

  // While dragging: disable bounce so thumb tracks finger exactly
  input.addEventListener('mousedown',  function() { wrap.classList.add('pp-range-dragging'); });
  input.addEventListener('touchstart', function() { wrap.classList.add('pp-range-dragging'); }, { passive: true });
  document.addEventListener('mouseup',   function() { wrap.classList.remove('pp-range-dragging'); });
  document.addEventListener('touchend',  function() { wrap.classList.remove('pp-range-dragging'); });
}
