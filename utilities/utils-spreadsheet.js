// ════════════════════════════════════════════════════════════════
// utils-spreadsheet.js — spreadsheet viewer logic
// Loaded only by: tools/spreadsheet.html
// Depends on: utils-shared.js being loaded first
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

// ── DOM refs ─────────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const dragHandle     = document.getElementById('drag-handle');
const corner         = document.getElementById('corner');
const headerScroll   = document.getElementById('header-scroll');
const catScroll      = document.getElementById('cat-scroll');
const dataScroll     = document.getElementById('data-scroll');
const headerTable    = document.getElementById('header-table');
const headerRow      = document.getElementById('header-row');
const catTable       = document.getElementById('cat-table');
const catBody        = document.getElementById('cat-body');
const dataTable      = document.getElementById('data-table');
const dataBody       = document.getElementById('data-body');
const tabBar         = document.getElementById('tab-bar');
const topbar         = document.getElementById('topbar');
const topbarGlobal   = document.getElementById('topbar-global');
const topbarSheet    = document.getElementById('topbar-sheet');
const bottombar      = document.querySelector('.bottombar');
const loadingOverlay = document.getElementById('loading-overlay');
const sidebarBox     = document.getElementById('sidebar-box');
const dragHandleFixed = document.getElementById('drag-handle-fixed');

let activeTab    = 0;
let NUM_CAT_COLS = 1;

// ── Build spans ───────────────────────────────────────────────────
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
      const parentSpans = allSpans[level - 1];
      parentSpans.forEach(({ start, count: parentCount }) => {
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

// ── Render ────────────────────────────────────────────────────────
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
      const _parsed = typeof parseCitation === 'function' ? parseCitation(val) : { body: val };
      td.textContent = _parsed.body;
      if (groupEndRows.has(ri)) td.classList.add('group-end');
      tr.appendChild(td);
    });
    dataBody.appendChild(tr);
  });

  updateLayout(data.headers.length);
}

// ── Category cell rotation ────────────────────────────────────────
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
  const catRows = Array.from(catBody.querySelectorAll('tr'));
  catRows.forEach((tr, rowIdx) => {
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

// ── Layout ────────────────────────────────────────────────────────
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
    const deficit = neededH - cumH;
    const newH = naturalH[startRow] + deficit;
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

// ── Highlight & Selection ─────────────────────────────────────────
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

// ── Tab bar ───────────────────────────────────────────────────────
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
  const sidebarW  = sidebar.offsetWidth;
  const available = Math.max(0, window.innerWidth - sidebarW);
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

// ── Sidebar overlap ───────────────────────────────────────────────
function updateSidebarOverlap(skipTabRebuild) {
  const sidebarW   = sidebar.offsetWidth;
  const threshold  = SIDEBAR_OVERLAP_THRESHOLD();
  const fullscreen = SIDEBAR_FULLSCREEN_THRESHOLD();
  if (sidebarW >= fullscreen) {
    document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
    sidebar.classList.add('is-overlapping', 'is-fullscreen');
  } else if (sidebarW >= threshold) {
    document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', (sidebarW - threshold) + 'px');
    sidebar.classList.add('is-overlapping');
    sidebar.classList.remove('is-fullscreen');
  } else {
    document.documentElement.style.setProperty('--sidebar-reserved-width', sidebarW + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
    sidebar.classList.remove('is-overlapping', 'is-fullscreen');
  }
  if (!skipTabRebuild) buildTabBar();
}

function applyBarSizes() {
  const th = TOPBAR_HEIGHT(), bh = BOTTOMBAR_HEIGHT();
  const supportsDvh = CSS.supports('height', '1dvh');
  if (supportsDvh) {
    document.documentElement.style.setProperty('--bottombar-dvh', (R().bottombar * 100).toFixed(3) + 'dvh');
    document.documentElement.style.setProperty('--topbar-dvh',    (R().topbar    * 100).toFixed(3) + 'dvh');
    if (bottombar) { bottombar.style.height = bottombar.style.minHeight = ''; }
    if (topbar)    { topbar.style.height    = topbar.style.minHeight    = ''; }
  } else {
    if (topbar)    { topbar.style.height    = topbar.style.minHeight    = th + 'px'; }
    if (bottombar) { bottombar.style.height = bottombar.style.minHeight = bh + 'px'; }
  }
  document.documentElement.style.setProperty('--tab-height',          Math.round(bh * 0.70) + 'px');
  document.documentElement.style.setProperty('--tab-gap',             Math.round(window.innerWidth * 0.008) + 'px');
  document.documentElement.style.setProperty('--sidebar-box-margin',  SIDEBAR_BOX_MARGIN() + 'px');
  document.documentElement.style.setProperty('--drag-handle-width',   DRAG_HANDLE_WIDTH() + 'px');
  document.documentElement.style.setProperty('--handle-arrow-size',   ARROW_SIZE() + 'px');
  document.documentElement.style.setProperty('--handle-arrow-offset', ARROW_OFFSET() + 'px');
  document.documentElement.style.setProperty('--tab-bar-padding',     TAB_BAR_PADDING() + 'px');
  document.documentElement.style.setProperty('--tab-bar-inset',       TAB_BAR_INSET()   + 'px');
  updateSidebarOverlap();
}

function applyBarSizes_noOverlap() {
  document.documentElement.style.setProperty('--sidebar-box-margin',  SIDEBAR_BOX_MARGIN() + 'px');
  document.documentElement.style.setProperty('--drag-handle-width',   DRAG_HANDLE_WIDTH() + 'px');
  document.documentElement.style.setProperty('--handle-arrow-size',   ARROW_SIZE() + 'px');
  document.documentElement.style.setProperty('--handle-arrow-offset', ARROW_OFFSET() + 'px');
  document.documentElement.style.setProperty('--tab-bar-padding',     TAB_BAR_PADDING() + 'px');
  document.documentElement.style.setProperty('--tab-bar-inset',       TAB_BAR_INSET()   + 'px');
}

// ── Handle arrows ─────────────────────────────────────────────────
function updateHandleArrows(forcedWidth) {
  const sidebarW     = forcedWidth !== undefined ? forcedWidth : sidebar.offsetWidth;
  const isClosed     = sidebarW <= SIDEBAR_MIN() + 4;
  const isFullscreen = sidebarW >= SIDEBAR_FULLSCREEN_THRESHOLD() - 4;
  [dragHandle, dragHandleFixed].forEach(handle => {
    handle.querySelector('[aria-label="Open sidebar"]')?.classList.toggle('visible', isClosed);
    handle.querySelector('[aria-label="Close sidebar"]')?.classList.toggle('visible', isFullscreen);
    handle.querySelector('.handle-arrows')?.classList.toggle('arrows-left', isClosed);
  });
}

function positionDragHandle() {
  const handleW     = DRAG_HANDLE_WIDTH();
  const sidebarRect = sidebar.getBoundingClientRect();
  const sidebarW    = Math.round(sidebarRect.width);
  dragHandleFixed.style.left   = sidebarRect.left + 'px';
  dragHandleFixed.style.width  = handleW + 'px';
  dragHandleFixed.style.height = sidebarRect.height + 'px';
  dragHandleFixed.style.top    = sidebarRect.top + 'px';
  const useFixed = sidebarW < handleW + 2;
  dragHandleFixed.classList.toggle('active', useFixed);
  dragHandle.style.opacity = useFixed ? '0' : '1';
}

// ── Sidebar animation ─────────────────────────────────────────────
let _mmSnapshot = null;

function saveMmSnapshot() {
  window.__mmSnapshotData = null;
  document.dispatchEvent(new CustomEvent('mm-snapshot-request', { bubbles: false }));
  if (window.__mmSnapshotData) { _mmSnapshot = window.__mmSnapshotData; window.__mmSnapshotData = null; }
}
function restoreMmSnapshot() {
  if (!_mmSnapshot) return;
  document.dispatchEvent(new CustomEvent('mm-snapshot-restore', { detail: _mmSnapshot, bubbles: false }));
}

function animateSidebarTo(targetW, { restoreMm = false } = {}) {
  if (animateSidebarTo._rafId) cancelAnimationFrame(animateSidebarTo._rafId);
  const startW     = parseFloat(sidebar.style.width) || sidebar.getBoundingClientRect().width;
  const distance   = targetW - startW;
  const duration   = 320;
  const startTime  = performance.now();
  const ease       = t => 1 - Math.pow(1 - t, 3.5);
  const threshold  = SIDEBAR_OVERLAP_THRESHOLD();
  const fullscreen = SIDEBAR_FULLSCREEN_THRESHOLD();
  const needsFixed = (startW >= threshold) || (targetW >= threshold);
  if (needsFixed) sidebar.classList.add('is-overlapping');
  updateHandleArrows(targetW);
  if (SIDEBAR_TWO_POSITION()) {
    sidebar.classList.add('is-overlapping');
    document.documentElement.style.setProperty('--sidebar-reserved-width', '0px');
    document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
    if (targetW >= fullscreen) sidebar.classList.add('is-fullscreen');
    else sidebar.classList.remove('is-fullscreen');
  }
  function rafLoop(now) {
    const t        = Math.min(1, (now - startTime) / duration);
    const currentW = Math.round(startW + distance * ease(t));
    sidebar.style.width = currentW + 'px';
    if (!SIDEBAR_TWO_POSITION()) {
      if (needsFixed) {
        if (currentW >= fullscreen) {
          document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
          document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
          sidebar.classList.add('is-fullscreen');
        } else if (currentW >= threshold) {
          document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
          document.documentElement.style.setProperty('--sidebar-intrusion', (currentW - threshold) + 'px');
          sidebar.classList.remove('is-fullscreen');
        } else {
          document.documentElement.style.setProperty('--sidebar-reserved-width', currentW + 'px');
          document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
          sidebar.classList.remove('is-fullscreen');
        }
      } else {
        document.documentElement.style.setProperty('--sidebar-reserved-width', currentW + 'px');
        document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
      }
    }
    positionDragHandle();
    applyBarSizes_noOverlap();
    if (t < 1) {
      animateSidebarTo._rafId = requestAnimationFrame(rafLoop);
    } else {
      sidebar.style.width = targetW + 'px';
      if (SIDEBAR_TWO_POSITION() && targetW <= SIDEBAR_MIN()) {
        sidebar.classList.remove('is-overlapping', 'is-fullscreen');
        document.documentElement.style.setProperty('--sidebar-reserved-width', '0px');
      }
      applySidebarWidth(targetW);
      updateSidebarOverlap();
      updateLayout();
      updateHandleArrows(targetW);
      positionDragHandle();
      if (restoreMm) requestAnimationFrame(() => requestAnimationFrame(restoreMmSnapshot));
    }
  }
  animateSidebarTo._rafId = requestAnimationFrame(rafLoop);
}
animateSidebarTo._rafId = null;

function applySidebarWidth(w) {
  const threshold = SIDEBAR_OVERLAP_THRESHOLD(), fullscreen = SIDEBAR_FULLSCREEN_THRESHOLD();
  if (w >= fullscreen) {
    document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
    sidebar.classList.add('is-overlapping', 'is-fullscreen');
  } else if (w >= threshold) {
    document.documentElement.style.setProperty('--sidebar-reserved-width', threshold + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', Math.max(0, w - threshold) + 'px');
    sidebar.classList.add('is-overlapping');
    sidebar.classList.remove('is-fullscreen');
  } else {
    document.documentElement.style.setProperty('--sidebar-reserved-width', w + 'px');
    document.documentElement.style.setProperty('--sidebar-intrusion', '0px');
    sidebar.classList.remove('is-overlapping', 'is-fullscreen');
  }
  positionDragHandle();
  applyBarSizes_noOverlap();
}

// ── Sidebar drag ──────────────────────────────────────────────────
let dragging = false, startX, startSidebarWidth, _snapSaved = false;

function startDrag(e) {
  if (e.target.closest('.handle-arrow')) return;
  if (SIDEBAR_TWO_POSITION()) return;
  dragging = true; _snapSaved = false;
  startX = e.clientX; startSidebarWidth = sidebar.offsetWidth;
  dragHandle.classList.add('dragging');
  dragHandleFixed.classList.add('dragging');
  document.body.style.cursor     = 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
}
dragHandle.addEventListener('mousedown', startDrag);
dragHandleFixed.addEventListener('mousedown', startDrag);

document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const newW = Math.min(SIDEBAR_MAX(), Math.max(SIDEBAR_MIN(), startSidebarWidth + (startX - e.clientX)));
  if (!_snapSaved && newW <= SIDEBAR_SNAP_CLOSE()) { saveMmSnapshot(); _snapSaved = true; }
  sidebar.style.width = newW + 'px';
  updateSidebarOverlap();
  updateLayout();
  positionDragHandle();
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  dragHandle.classList.remove('dragging');
  dragHandleFixed.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  const sidebarW = sidebar.offsetWidth;
  if (sidebarW >= SIDEBAR_FULLSCREEN_THRESHOLD()) animateSidebarTo(window.innerWidth);
  else if (sidebarW <= SIDEBAR_SNAP_CLOSE())      animateSidebarTo(SIDEBAR_MIN());
  else { updateHandleArrows(); positionDragHandle(); }
});

// ── Handle arrow clicks ───────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.handle-arrow');
  if (!btn) return;
  e.stopPropagation();
  const isOpen  = btn.getAttribute('aria-label') === 'Open sidebar';
  const isClose = btn.getAttribute('aria-label') === 'Close sidebar';
  if (SIDEBAR_TWO_POSITION()) {
    if (isOpen)  animateSidebarTo(window.innerWidth, { restoreMm: true });
    if (isClose) { saveMmSnapshot(); animateSidebarTo(SIDEBAR_MIN()); }
  } else {
    if (isOpen)  animateSidebarTo(SIDEBAR_DEFAULT(), { restoreMm: true });
    if (isClose) { saveMmSnapshot(); animateSidebarTo(SIDEBAR_DEFAULT()); }
  }
});

// ── Hover & selection ─────────────────────────────────────────────
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
            targets.group.forEach(el => { if (!el.classList.contains('selected-cell') && !el.classList.contains('selected-group')) { el.classList.add('selected-group'); selectedElements.push(el); } });
            targets.focal.forEach(el => { el.classList.remove('selected-group'); el.classList.add('selected-cell'); if (!selectedElements.includes(el)) selectedElements.push(el); });
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

// ── Show tab ──────────────────────────────────────────────────────
function showTab(idx) {
  const data = processSheetData(TABS[idx].grid);
  if (!data) { dataBody.innerHTML = '<tr><td>No data found</td></tr>'; return; }
  applyTheme(TAB_THEMES[idx] || 'default');
  topbarSheet.textContent  = data.title || TABS[idx].name;
  dataScroll.scrollTop     = 0;
  dataScroll.scrollLeft    = 0;
  renderSheet(data);
}

// ── Resize ────────────────────────────────────────────────────────
function fixBottombar() {
  if (!bottombar) return;
  const bh = BOTTOMBAR_HEIGHT();
  bottombar.style.height = bottombar.style.minHeight = '';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bottombar.style.height = bottombar.style.minHeight = bh + 'px';
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

// ── Init ──────────────────────────────────────────────────────────
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

// Wait for utils-shared.js to populate window.TABS then render
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
