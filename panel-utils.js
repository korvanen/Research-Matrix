// ════════════════════════════════════════════════════════════════════════════
// panel-utils.js — Shared utilities for panel.js
// Include BEFORE panel.js in index.html:
//   <script src="panel-utils.js"></script>
//   <script src="panel.js"></script>
// ════════════════════════════════════════════════════════════════════════════

// ── Stop words for keyword extraction ────────────────────────────────────────
// Add/remove words here to tune what counts as a meaningful keyword
const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── Keyword extraction ────────────────────────────────────────────────────────
// Returns a deduplicated array of stemmed, filtered keywords from a text string.
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
// Wraps matched keywords in <mark class="pkw"> for CSS styling.
function panelHighlight(text, kwSet) {
  if (!kwSet || !kwSet.size) return panelEscH(text);
  const pat = new RegExp(
    '\\b(' + [...kwSet].map(k => k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\b', 'gi'
  );
  return panelEscH(text).replace(pat, m => '<mark class="pkw">' + m + '</mark>');
}

// ── Theme variable lookup ─────────────────────────────────────────────────────
// Returns the CSS variable map for a given tab index, falling back to 'default'.
// Depends on THEMES and TAB_THEMES from script.js.
function panelThemeVars(tabIdx) {
  const name = (typeof TAB_THEMES !== 'undefined' && TAB_THEMES[tabIdx]) || 'default';
  return (typeof THEMES !== 'undefined' && (THEMES[name] || THEMES.default)) || {};
}

// ── Row index builder ─────────────────────────────────────────────────────────
// Flattens all TABS into a searchable array of { tabIdx, rowIdx, row, headers, title, kws }.
// Depends on TABS and processSheetData from script.js.
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
// Finds rows across all tabs that share >= PANEL_MIN_SHARED keywords with seedKws,
// excluding the seed row itself.
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
// Creates a segmented pill control. Returns { el, setValue }.
// options: [{ label, value }, ...]
// onSwitch: called with the selected value when user clicks
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

// ── Go-to navigation ──────────────────────────────────────────────────────────
// Switches to the tab containing match, then selects the first cell of that row.
// Depends on activeTab, buildTabBar, showTab, clearSelection,
// getHighlightTargets, applySelection from script.js.
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
// Adds a delayed-reveal "Go to ↗" button to a card element on hover.
// accentColor: border/text color string for the button
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
