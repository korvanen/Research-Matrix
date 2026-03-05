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
