// ════════════════════════════════════════════════════════════════
// utils-spreadsheet.js — spreadsheet viewer logic
// Loaded only by: tools/spreadsheet.html
// Depends on: utils-shared.js loaded first
// ════════════════════════════════════════════════════════════════
console.log('[utils-spreadsheet.js]');

const APP_TITLE  = 'Dimensional Framework';
const isPortrait = () => window.innerHeight > window.innerWidth;

const PORTRAIT = {
  topbar:                     0.10,
  bottombar:                  0.07,
  catWidth:                   0.18,
  dataColMin:                 0.35,
  sidebarDefault:             0.00,
  sidebarMin:                 0.00,
  sidebarMax:                 1.00,
  sidebarBoxMargin:           0.02,
  sidebarOverlapThreshold:    0.00,
  sidebarFullscreenThreshold: 1.00,
  sidebarSnapClose:           0.05,
  sidebarTwoPosition:         true,
  arrowSize:                  36,
  arrowOffset:                16,
  tabBarPadding:              0.01,
  tabBarInset:                0.03,
};

const LANDSCAPE = {
  topbar:                     0.15,
  bottombar:                  0.085,
  catWidth:                   0.05,
  dataColMin:                 0.15,
  sidebarBoxMargin:           0.012,
  sidebarMin:                 0.00,
  sidebarMax:                 1.00,
  sidebarDefault:             0.60,
  sidebarSnapClose:           0.30,
  sidebarOverlapThreshold:    0.50,
  sidebarFullscreenThreshold: 0.70,
  sidebarTwoPosition:         false,
  arrowSize:                  28,
  arrowOffset:                12,
  tabBarPadding:              0.05,
  tabBarInset:                0.05,
};

const R = () => isPortrait() ? PORTRAIT : LANDSCAPE;

const TOPBAR_HEIGHT                = () => Math.round(window.innerHeight * R().topbar);
const BOTTOMBAR_HEIGHT             = () => Math.round(window.innerHeight * R().bottombar);
const CAT_WIDTH                    = () => Math.round(window.innerWidth  * R().catWidth);
const DATA_COL_MIN                 = () => Math.round(window.innerWidth  * R().dataColMin);
const SIDEBAR_DEFAULT              = () => Math.round(window.innerWidth  * R().sidebarDefault);
const SIDEBAR_MIN                  = () => Math.round(window.innerWidth  * R().sidebarMin);
const SIDEBAR_MAX                  = () => Math.round(window.innerWidth  * R().sidebarMax);
const SIDEBAR_BOX_MARGIN           = () => Math.round(window.innerWidth  * R().sidebarBoxMargin);
const DRAG_HANDLE_WIDTH            = () => Math.round(SIDEBAR_BOX_MARGIN() / 1.5);
const SIDEBAR_OVERLAP_THRESHOLD    = () => Math.round(window.innerWidth  * (3 * R().dataColMin));
const SIDEBAR_FULLSCREEN_THRESHOLD = () => Math.round(window.innerWidth  * R().sidebarFullscreenThreshold);
const SIDEBAR_SNAP_CLOSE           = () => Math.round(window.innerWidth  * R().sidebarSnapClose);
const SIDEBAR_TWO_POSITION         = () => !!R().sidebarTwoPosition;
const ARROW_SIZE                   = () => R().arrowSize;
const ARROW_OFFSET                 = () => R().arrowOffset;
const TAB_BAR_PADDING              = () => Math.round(window.innerHeight * R().tabBarPadding);
const TAB_BAR_INSET                = () => Math.round(window.innerHeight * R().tabBarInset);
const PANEL_GOTO_DELAY             = 320; // ms before "Go to ↗" button appears on hover

// ── DOM refs ─────────────────────────────────────────────────────
const sidebar         = document.getElementById('sidebar');
const dragHandle      = document.getElementById('drag-handle');
const corner          = document.getElementById('corner');
const headerScroll    = document.getElementById('header-scroll');
const catScroll       = document.getElementById('cat-scroll');
const dataScroll      = document.getElementById('data-scroll');
const headerTable     = document.getElementById('header-table');
const headerRow       = document.getElementById('header-row');
const catTable        = document.getElementById('cat-table');
const catBody         = document.getElementById('cat-body');
const dataTable       = document.getElementById('data-table');
const dataBody        = document.getElementById('data-body');
const tabBar          = document.getElementById('tab-bar');
const topbar          = document.getElementById('topbar');
const topbarGlobal    = document.getElementById('topbar-global');
const topbarSheet     = document.getElementById('topbar-sheet');
const bottombar       = document.querySelector('.bottombar');
const loadingOverlay  = document.getElementById('loading-overlay');
const sidebarBox      = document.getElementById('sidebar-box');
const dragHandleFixed = document.getElementById('drag-handle-fixed');

let activeTab    = 0;
let NUM_CAT_COLS = 1;

// ════════════════════════════════════════════════════════════════
// GOTO NAVIGATION
// (moved from utils-sidepanel.js — needs live spreadsheet DOM)
// ════════════════════════════════════════════════════════════════

// Returns the data-column index with the most shared-keyword hits.
// Falls back to the first non-empty column, then 0.
function _bestColForMatch(match) {
  if (!match || !match.row || !match.row.cells) return 0;
  var cells  = match.row.cells;
  var shared = match.shared;
  var bestIdx = -1, bestScore = -1;
  cells.forEach(function(cell, ci) {
    if (!cell || !cell.trim()) return;
    var score = 0;
    if (shared && typeof shared.forEach === 'function') {
      var kws = typeof panelExtractKW === 'function' ? panelExtractKW(cell) : [];
      shared.forEach(function(k) { if (kws.indexOf(k) !== -1) score++; });
    }
    if (score > bestScore || bestIdx === -1) { bestScore = score; bestIdx = ci; }
  });
  return bestIdx >= 0 ? bestIdx : 0;
}

// Switches to the correct tab, then selects and scrolls to the target cell.
// colIdx — explicit column (0-based). Omit to auto-pick by keyword overlap.
function panelGoTo(match, colIdx) {
  var tabIdx    = match.tabIdx;
  var rowIdx    = match.rowIdx;
  var targetCol = (typeof colIdx === 'number' && colIdx >= 0)
    ? colIdx
    : _bestColForMatch(match);

  var needsTabSwitch = activeTab !== tabIdx;

  if (needsTabSwitch) {
    activeTab = tabIdx;
    buildTabBar();
    showTab(tabIdx);
  }

  function doSelect() {
    clearSelection();
    var dataRows = Array.from(dataBody.querySelectorAll('tr'));
    var tr = dataRows[rowIdx];
    if (!tr) return;
    var tds = Array.from(tr.querySelectorAll('td'));
    var td  = tds[targetCol] !== undefined ? tds[targetCol] : tds[0];
    if (!td) return;
    var targets = getHighlightTargets(td);
    if (targets) {
      applySelection(targets);
      td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      td.classList.add('selected-cell');
      td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // After a tab switch, showTab fires two nested rAFs before the layout
  // is stable — setTimeout pushes past both of them.
  needsTabSwitch ? setTimeout(doSelect, 150) : requestAnimationFrame(doSelect);
}

// Attaches a hover "Go to ↗" button to a result card.
// Best column is computed once at attach time so every click lands correctly.
function attachGoTo(card, match, accentColor) {
  var bestCol    = _bestColForMatch(match);
  var hoverTimer = null;
  var btn        = null;

  function showBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.className   = 'pp-goto-btn';
    btn.textContent = 'Go to ↗';
    btn.style.borderColor = accentColor || 'rgba(0,0,0,.2)';
    btn.style.color       = accentColor || 'rgba(0,0,0,.6)';
    btn.addEventListener('click', function(e) { e.stopPropagation(); panelGoTo(match, bestCol); });
    btn.addEventListener('mouseenter', function() { clearTimeout(hoverTimer); });
    btn.addEventListener('mouseleave', hideBtn);
    card.appendChild(btn);
    requestAnimationFrame(function() { btn && btn.classList.add('pp-goto-visible'); });
  }

  function hideBtn() {
    if (!btn) return;
    var b = btn; btn = null;
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

// ════════════════════════════════════════════════════════════════
// SPREADSHEET RENDERING
// ════════════════════════════════════════════════════════════════

function buildSpans(rows, numLevels) {
  const allSpans = [];
  for (let level = 0; level < numLevels; level++) {
    const levelSpans = [];
    if (level === 0) {
      let i = 0;
      while (i < rows.length) {
        const val = rows[i].cats[0] || '';
        let count = 1;
        while (i + count < rows.length && (rows[i + count].cats[0] || '') === val) count++;
        levelSpans.push({ value: val, start: i, count });
        i += count;
      }
    } else {
      allSpans[level - 1].forEach(({ start, count: parentCount }) => {
        let i = start;
        const end = start + parentCount;
        while (i < end) {
          const val = rows[i].cats[level] || '';
          let count = 1;
          while (i + count < end && (rows[i + count].cats[level] || '') === val) count++;
          levelSpans.push({ value: val, start: i, count });
          i += count;
        }
      });
    }
    allSpans.push(levelSpans);
  }
  return allSpans;
}

function renderSheet(data) {
  NUM_CAT_COLS = data.catIndices.length || 1;
  const spans    = buildSpans(data.rows, NUM_CAT_COLS);
  const catCells = data.rows.map(() => new Array(NUM_CAT_COLS).fill(null));
  spans.forEach((levelSpans, level) => {
    levelSpans.forEach(({ value, start, count }) => {
      catCells[start][level] = { value, rowspan: count };
    });
  });
  const groupEndRows = new Set(spans[0]?.map(s => s.start + s.count - 1) || []);

  headerRow.innerHTML = '';
  data.headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });

  catBody.innerHTML = '';
  data.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    for (let level = 0; level < NUM_CAT_COLS; level++) {
      const cell = catCells[ri][level];
      if (cell !== null) {
        const td = document.createElement('td');
        td.textContent = cell.value;
        td.rowSpan     = cell.rowspan;
        if (groupEndRows.has(ri + cell.rowspan - 1)) td.classList.add('group-end');
        tr.appendChild(td);
      }
    }
    catBody.appendChild(tr);
  });

  dataBody.innerHTML = '';
  data.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    row.cells.forEach(val => {
      const td = document.createElement('td');
      const _parsed = parseCitation(val); // from utils-shared.js
      td.textContent = _parsed.body;
      if (groupEndRows.has(ri)) td.classList.add('group-end');
      tr.appendChild(td);
    });
    dataBody.appendChild(tr);
  });

  updateLayout(data.headers.length);
}

// ════════════════════════════════════════════════════════════════
// CATEGORY COLUMN ROTATION
// ════════════════════════════════════════════════════════════════

const _rotatedMinH = new Map();

function _measureTextWidth(text, td) {
  const cs = getComputedStyle(td);
  const probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;' +
    'font-size:'      + cs.fontSize      + ';' +
    'font-weight:'    + cs.fontWeight    + ';' +
    'font-family:'    + cs.fontFamily    + ';' +
    'letter-spacing:' + cs.letterSpacing + ';' +
    'text-transform:' + cs.textTransform;
  probe.textContent = text;
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  document.body.removeChild(probe);
  return w;
}

function applyRotations() {
  _rotatedMinH.clear();
  catBody.querySelectorAll('td.cat-rotated').forEach(td => {
    const inner = td.querySelector('.cat-inner');
    if (inner) td.textContent = inner.textContent;
    td.classList.remove('cat-rotated');
    td.style.height = '';
  });
  Array.from(catBody.querySelectorAll('tr')).forEach((tr, rowIdx) => {
    Array.from(tr.querySelectorAll('td')).forEach(td => {
      const text = td.textContent.trim();
      if (!text) return;
      const catW  = td.getBoundingClientRect().width;
      const textW = _measureTextWidth(text, td);
      if (textW <= catW - 28) return;
      td.classList.add('cat-rotated');
      const inner = document.createElement('span');
      inner.className   = 'cat-inner';
      inner.textContent = text;
      td.textContent    = '';
      td.appendChild(inner);
      const neededH = Math.ceil(textW) + 12;
      inner.style.width = neededH + 'px';
      _rotatedMinH.set(rowIdx, { neededH, rowspan: td.rowSpan || 1 });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// LAYOUT
// ════════════════════════════════════════════════════════════════

function updateLayout(numDataCols) {
  numDataCols = numDataCols ?? dataTable.querySelectorAll('tbody tr:first-child td').length;
  if (!numDataCols) return;
  const totalCatW = NUM_CAT_COLS * CAT_WIDTH();
  catTable.style.width = totalCatW + 'px';
  catTable.querySelectorAll('td').forEach(td => { td.style.width = td.style.minWidth = CAT_WIDTH() + 'px'; });
  corner.style.width = totalCatW + 'px';
  const available  = dataScroll.clientWidth;
  const naturalCol = Math.floor(available / numDataCols);
  const colW       = Math.max(naturalCol, DATA_COL_MIN());
  const tableW     = colW * numDataCols;
  headerTable.style.width = naturalCol >= DATA_COL_MIN() ? '100%' : tableW + 'px';
  dataTable.style.width   = naturalCol >= DATA_COL_MIN() ? '100%' : tableW + 'px';
  headerRow.querySelectorAll('th').forEach(th => { th.style.width = th.style.minWidth = colW + 'px'; });
  dataBody.querySelectorAll('td').forEach(td => { td.style.width = td.style.minWidth = colW + 'px'; });
  void dataScroll.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => { applyRotations(); syncRowHeights(); }));
}

let _syncTimer = null;
function syncRowHeights() {
  if (_syncTimer) return;
  _syncTimer = requestAnimationFrame(() => { _syncTimer = null; _doSyncRowHeights(); });
}
function _doSyncRowHeights() {
  const dataRows = Array.from(dataBody.querySelectorAll('tr'));
  const catRows  = Array.from(catBody.querySelectorAll('tr'));
  dataRows.forEach(tr => tr.style.height = '');
  catRows.forEach(tr  => tr.style.height = '');
  void dataBody.offsetHeight;
  const naturalH = dataRows.map(tr => tr.getBoundingClientRect().height);
  _rotatedMinH.forEach(({ neededH, rowspan }, startRow) => {
    const cumH = naturalH.slice(startRow, startRow + rowspan).reduce((a, b) => a + b, 0);
    if (cumH >= neededH) return;
    const newH = naturalH[startRow] + (neededH - cumH);
    dataRows[startRow].style.height = newH + 'px';
    catRows[startRow].style.height  = newH + 'px';
    naturalH[startRow] = newH;
  });
  dataRows.forEach((dataRow, i) => {
    const catRow = catRows[i];
    if (!catRow) return;
    const h = Math.max(dataRow.getBoundingClientRect().height, catRow.getBoundingClientRect().height);
    dataRow.style.height = h + 'px';
    catRow.style.height  = h + 'px';
  });
  const scrollbarH = dataScroll.offsetHeight - dataScroll.clientHeight;
  const scrollbarW = dataScroll.offsetWidth  - dataScroll.clientWidth;
  catScroll.style.paddingBottom   = scrollbarH + 'px';
  headerScroll.style.paddingRight = scrollbarW + 'px';
}

if (window.ResizeObserver) {
  let _resizeSyncTimer = null;
  new ResizeObserver(() => {
    clearTimeout(_resizeSyncTimer);
    _resizeSyncTimer = setTimeout(_doSyncRowHeights, 16);
  }).observe(dataScroll);
}

// ════════════════════════════════════════════════════════════════
// HIGHLIGHT & SELECTION
// ════════════════════════════════════════════════════════════════

let selectedElements = [];

function clearHighlights() {
  document.querySelectorAll('.highlight-cell, .highlight-group').forEach(el => {
    el.classList.remove('highlight-cell', 'highlight-group');
  });
}
function clearSelection() {
  selectedElements.forEach(el => el.classList.remove('selected-cell', 'selected-group'));
  selectedElements = [];
}
function getHighlightTargets(el) {
  const focal = [], group = [];
  if (el.closest('#data-body')) {
    const td = el.closest('td');
    if (!td) return null;
    focal.push(td);
    return { focal, group };
  }
  if (el.closest('#cat-body')) {
    const td            = el.closest('td');
    if (!td) return null;
    const tr            = td.closest('tr');
    const catRows       = Array.from(catBody.querySelectorAll('tr'));
    const rowIndex      = catRows.indexOf(tr);
    const span          = td.rowSpan || 1;
    const hoveredColIdx = Array.from(tr.children).indexOf(td);
    Array.from(dataBody.querySelectorAll('tr'))
      .slice(rowIndex, rowIndex + span)
      .forEach(dataRow => dataRow.querySelectorAll('td').forEach(c => group.push(c)));
    catBody.querySelectorAll('td').forEach(catTd => {
      const catTr     = catTd.closest('tr');
      const catRowIdx = catRows.indexOf(catTr);
      const catColIdx = Array.from(catTr.children).indexOf(catTd);
      if (catRowIdx >= rowIndex && catRowIdx < rowIndex + span && catColIdx >= hoveredColIdx) group.push(catTd);
    });
    focal.push(td);
    return { focal, group };
  }
  if (el.closest('#header-row')) {
    const th = el.closest('th');
    if (!th) return null;
    const colIdx = Array.from(headerRow.querySelectorAll('th')).indexOf(th);
    dataBody.querySelectorAll('tr').forEach(tr => {
      const td = tr.querySelectorAll('td')[colIdx];
      if (td) group.push(td);
    });
    focal.push(th);
    return { focal, group };
  }
  return null;
}
function applyHighlight(targets) {
  if (!targets) return;
  targets.group.forEach(el => el.classList.add('highlight-group'));
  targets.focal.forEach(el => { el.classList.remove('highlight-group'); el.classList.add('highlight-cell'); });
}
function applySelection(targets) {
  if (!targets) return;
  clearSelection();
  targets.group.forEach(el => { el.classList.add('selected-group'); selectedElements.push(el); });
  targets.focal.forEach(el => {
    el.classList.remove('selected-group');
    el.classList.add('selected-cell');
    selectedElements.push(el);
  });
}
function applyTheme(themeName) {
  const vars = THEMES[themeName] || THEMES.default;
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

// ════════════════════════════════════════════════════════════════
// TAB BAR
// ════════════════════════════════════════════════════════════════

let tabBarMode = 'full';

function getTabBarMode() {
  if (isPortrait()) return 'compact';
  if (sidebar.offsetWidth >= SIDEBAR_OVERLAP_THRESHOLD()) return 'compact';
  return 'full';
}
function tabsOverflow() {
  const tabs = tabBar.querySelectorAll('.tab:not(.tab-compact-label)');
  if (!tabs.length) return false;
  let totalW = 0;
  tabs.forEach(t => totalW += t.offsetWidth);
  return (totalW + 8 * (tabs.length - 1)) > tabBar.clientWidth + 2;
}
function buildTabBar() {
  tabBar.innerHTML = '';
  const mode = getTabBarMode();
  tabBarMode = mode;
  bottombar.classList.remove('tabs-hidden');
  if (mode === 'full') {
    tabBar.style.width = tabBar.style.maxWidth = tabBar.style.padding = '';
    bottombar.classList.remove('tabs-compact');
    TABS.forEach((tab, i) => {
      const data  = processSheetData(tab.grid);
      const label = (data && data.title) ? data.title : tab.name;
      const vars  = THEMES[TAB_THEMES[i] || 'default'] || THEMES.default;
      const el    = document.createElement('div');
      el.className   = 'tab' + (i === activeTab ? ' active' : '');
      el.textContent = label;
      el.style.background  = i === activeTab ? vars['--tab-active-bg']    : vars['--tab-bg'];
      el.style.color       = i === activeTab ? vars['--tab-active-color'] : vars['--tab-color'];
      el.style.borderColor = vars['--tab-border'];
      el.addEventListener('click', () => { if (i === activeTab) return; activeTab = i; buildTabBar(); showTab(i); });
      tabBar.appendChild(el);
    });
    requestAnimationFrame(() => { if (tabsOverflow()) { tabBarMode = 'compact'; buildTabBarCompact(); } });
    return;
  }
  buildTabBarCompact();
}
function buildTabBarCompact() {
  tabBar.innerHTML = '';
  bottombar.classList.add('tabs-compact');
  const available = Math.max(0, window.innerWidth - sidebar.offsetWidth);
  tabBar.style.width = available + 'px';
  if (!TABS.length) return;
  const tabData = processSheetData(TABS[activeTab].grid);
  const label   = (tabData && tabData.title) ? tabData.title : TABS[activeTab].name;
  const vars    = THEMES[TAB_THEMES[activeTab] || 'default'] || THEMES.default;
  function makeTabArrow(dir) {
    const btn = document.createElement('button');
    btn.className = `tab-arrow tab-arrow-${dir}`;
    btn.setAttribute('aria-label', dir === 'prev' ? 'Previous tab' : 'Next tab');
    const pts = dir === 'prev' ? '7,2 2,8 7,14' : '3,2 8,8 3,14';
    btn.innerHTML = `<svg viewBox="0 0 10 16" fill="none"><polyline points="${pts}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    btn.style.background = vars['--tab-arrow-bg']    || '#c8c8c8';
    btn.style.color      = vars['--tab-arrow-color'] || '#333333';
    return btn;
  }
  const prevBtn = makeTabArrow('prev');
  prevBtn.disabled = activeTab === 0;
  prevBtn.addEventListener('click', () => { if (activeTab > 0) { activeTab--; buildTabBar(); showTab(activeTab); } });
  const nextBtn = makeTabArrow('next');
  nextBtn.disabled = activeTab === TABS.length - 1;
  nextBtn.addEventListener('click', () => { if (activeTab < TABS.length - 1) { activeTab++; buildTabBar(); showTab(activeTab); } });
  const activeEl = document.createElement('div');
  activeEl.className = 'tab active tab-compact-label';
  activeEl.style.background  = vars['--tab-active-bg'];
  activeEl.style.color       = vars['--tab-active-color'];
  activeEl.style.borderColor = vars['--tab-border'];
  const labelSpan = document.createElement('span');
  labelSpan.className   = 'tab-compact-text';
  labelSpan.textContent = label;
  const counter = document.createElement('span');
  counter.className   = 'tab-counter';
  counter.textContent = `${activeTab + 1} / ${TABS.length}`;
  activeEl.appendChild(labelSpan);
  activeEl.appendChild(counter);
  tabBar.appendChild(prevBtn);
  tabBar.appendChild(activeEl);
  tabBar.appendChild(nextBtn);
}

// ── Sidebar (via utils-panel.js) ──────────────────────────────────

const sidePanel = createSidePanel(document.querySelector('.main'), {
  side:               'right',
  defaultFraction:    isPortrait() ? 0 : 0.60,
  minFraction:        0,
  maxFraction:        1,
  snapCloseFraction:  isPortrait() ? 0.05 : 0.30,
  overlapFraction:    isPortrait() ? 0    : 0.50,
  fullscreenFraction: isPortrait() ? 1    : 0.70,
  twoPosition:        isPortrait(),
  onResize: () => { buildTabBar(); updateLayout(); },
  onOpen:   () => { buildTabBar(); updateLayout(); },
  onClose:  () => { buildTabBar(); updateLayout(); },
});

// ════════════════════════════════════════════════════════════════
// HOVER & SELECTION EVENTS
// ════════════════════════════════════════════════════════════════

function setupHover() {
  [dataBody, catBody, headerRow].forEach(container => {
    container.addEventListener('mouseover',  e => { clearHighlights(); applyHighlight(getHighlightTargets(e.target)); });
    container.addEventListener('mouseleave', clearHighlights);
  });
  [dataBody, catBody, headerRow].forEach(container => {
    container.addEventListener('click', e => {
      const targets = getHighlightTargets(e.target);
      if (!targets) return;
      const allTargetEls = [...targets.focal, ...targets.group];
      const isSelected   = targets.focal.length > 0 && targets.focal[0].classList.contains('selected-cell');
      if (e.ctrlKey || e.metaKey) {
        if (isSelected) {
          allTargetEls.forEach(el => { el.classList.remove('selected-cell', 'selected-group'); selectedElements = selectedElements.filter(s => s !== el); });
        } else {
          const anyIntersects = allTargetEls.some(el => el.classList.contains('selected-cell') || el.classList.contains('selected-group'));
          if (anyIntersects) {
            allTargetEls.forEach(el => { el.classList.remove('selected-cell', 'selected-group'); selectedElements = selectedElements.filter(s => s !== el); });
          } else {
            targets.group.forEach(el => {
              if (!el.classList.contains('selected-cell') && !el.classList.contains('selected-group')) {
                el.classList.add('selected-group'); selectedElements.push(el);
              }
            });
            targets.focal.forEach(el => {
              el.classList.remove('selected-group'); el.classList.add('selected-cell');
              if (!selectedElements.includes(el)) selectedElements.push(el);
            });
          }
        }
      } else {
        if (isSelected) clearSelection();
        else applySelection(targets);
      }
      e.stopPropagation();
    });
  });
  document.addEventListener('click', e => {
    if (e.target.closest('.handle-arrow')) return;
    if (!e.target.closest('#sidebar')) clearSelection();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') clearSelection(); });
}

dataScroll.addEventListener('scroll', () => {
  headerScroll.scrollLeft = dataScroll.scrollLeft;
  catScroll.scrollTop     = dataScroll.scrollTop;
});

// ════════════════════════════════════════════════════════════════
// SHOW TAB
// ════════════════════════════════════════════════════════════════

function showTab(idx) {
  const data = processSheetData(TABS[idx].grid);
  if (!data) { dataBody.innerHTML = '<tr><td>No data found</td></tr>'; return; }
  applyTheme(TAB_THEMES[idx] || 'default');
  topbarSheet.textContent = data.title || TABS[idx].name;
  dataScroll.scrollTop    = 0;
  dataScroll.scrollLeft   = 0;
  renderSheet(data);
}

// ════════════════════════════════════════════════════════════════
// RESIZE
// ════════════════════════════════════════════════════════════════

function fixBottombar() {
  if (!bottombar) return;
  bottombar.style.height = bottombar.style.minHeight = '';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bottombar.style.height = bottombar.style.minHeight = BOTTOMBAR_HEIGHT() + 'px';
  }));
}

window.addEventListener('resize', () => {
  applyBarSizes();
  fixBottombar();
  if (SIDEBAR_TWO_POSITION()) {
    const wasOpen = sidebar.offsetWidth >= SIDEBAR_FULLSCREEN_THRESHOLD() - 4;
    sidebar.style.width = wasOpen ? window.innerWidth + 'px' : SIDEBAR_MIN() + 'px';
  } else {
    sidebar.style.width = Math.min(SIDEBAR_MAX(), Math.max(SIDEBAR_MIN(), parseFloat(sidebar.style.width) || SIDEBAR_DEFAULT())) + 'px';
  }
  applySidebarWidth(parseFloat(sidebar.style.width));
  updateSidebarOverlap();
  updateLayout();
  positionDragHandle();
  updateHandleArrows();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fixBottombar);
}

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════

window.onerror = (msg, src, line, col, err) => {
  loadingOverlay.style.cssText = 'display:flex;color:red;font-size:13px;padding:20px;text-align:center';
  loadingOverlay.textContent   = `JS Error: ${msg} (line ${line})`;
};

const initSidebarW = SIDEBAR_TWO_POSITION() ? SIDEBAR_MIN() : Math.max(SIDEBAR_MIN(), SIDEBAR_DEFAULT());
sidebar.style.width      = initSidebarW + 'px';
topbarGlobal.textContent = APP_TITLE;
applyTheme('default');
applyBarSizes();
setupHover();
updateHandleArrows();
positionDragHandle();
tabBar.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:12px">Loading…</div>';

function _waitForTabs() {
  if (window.TABS && window.TABS.length) {
    buildTabBar();
    showTab(0);
    loadingOverlay.style.display = 'none';
  } else {
    loadingOverlay.textContent = 'Fetching data…';
    setTimeout(_waitForTabs, 200);
  }
}
_waitForTabs();
