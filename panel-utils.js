// ════════════════════════════════════════════════════════════════════════════
// panel-utils.js — Shared utilities for panel.js
// Include BEFORE panel.js in index.html:
//   <script src="panel-utils.js"></script>
//   <script src="panel.js"></script>
// ════════════════════════════════════════════════════════════════════════════

// ── Stop words for keyword extraction ────────────────────────────────────────
const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── Keyword extraction ────────────────────────────────────────────────────────
function panelExtractKW(text) {
  return [...new Set(
    String(text).toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(w))
      .map(w => w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  )];
}

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

// ── Row index builder ─────────────────────────────────────────────────────────
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

// ── Match finder ─────────────────────────────────────────────────────────────
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
// Returns an HTML string for a colored citation pill.
// accentColor: background + border color (matches card header).
// textColor:   font color (matches card header text).
function citationPillHtml(citation, accentColor, textColor) {
  if (!citation) return '';
  return '<span class="pp-cite-pill" style="background:' +
    panelEscH(accentColor) + ';color:' + panelEscH(textColor) + '">' +
    panelEscH(citation) + '</span>';
}

// ── Go-to navigation ──────────────────────────────────────────────────────────
function panelGoTo(match) {
  var tabIdx = match.tabIdx;
  var rowIdx = match.rowIdx;

  if (typeof activeTab !== 'undefined' && activeTab !== tabIdx) {
    activeTab = tabIdx;
    if (typeof buildTabBar === 'function') buildTabBar();
    if (typeof showTab === 'function') showTab(tabIdx);
  }

  requestAnimationFrame(function() {
    if (typeof clearSelection === 'function') clearSelection();

    var dataRows = Array.from(document.querySelectorAll('#data-body tr'));
    var tr = dataRows[rowIdx];
    if (!tr) return;

    var firstTd = tr.querySelector('td');
    if (!firstTd) return;

    if (typeof getHighlightTargets === 'function' && typeof applySelection === 'function') {
      var targets = getHighlightTargets(firstTd);
      if (targets) {
        applySelection(targets);
        firstTd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      firstTd.classList.add('selected-cell');
      firstTd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ── Attach "Go to" hover button ───────────────────────────────────────────────
function attachGoTo(card, match, accentColor) {
  var hoverTimer = null;
  var btn = null;

  function showBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.className = 'pp-goto-btn';
    btn.textContent = 'Go to ↗';
    btn.style.borderColor = accentColor || 'rgba(0,0,0,.2)';
    btn.style.color = accentColor || 'rgba(0,0,0,.6)';
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      panelGoTo(match);
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
