// ════════════════════════════════════════════════════════════════
// utils-spreadsheet.js — spreadsheet viewer (clean rewrite)
// Depends on: utils-shared.js (TABS, parseCitation, getPalette)
// ════════════════════════════════════════════════════════════════
console.log('[utils-spreadsheet.js v. 2]');

// ── DOM refs ──────────────────────────────────────────────────
const elTopbarGlobal  = document.getElementById('topbar-global');
const elTopbarSheet   = document.getElementById('topbar-sheet');
const elCorner        = document.getElementById('corner');
const elHeaderScroll  = document.getElementById('header-scroll');
const elHeaderRow     = document.getElementById('header-row');
const elCatScroll     = document.getElementById('cat-scroll');
const elCatBody       = document.getElementById('cat-body');
const elDataScroll    = document.getElementById('data-scroll');
const elDataBody      = document.getElementById('data-body');
const elTabBar        = document.getElementById('tab-bar');
const elSidebar       = document.getElementById('sidebar');
const elSidebarBox    = document.getElementById('sidebar-box');
const elDragHandle    = document.getElementById('drag-handle');
const elLoadingOverlay = document.getElementById('loading-overlay');

// ── State ─────────────────────────────────────────────────────
let activeTab      = 0;
let numCatCols     = 1;
let selectedEls    = [];
const SIDEBAR_DEFAULT_W = 420;
const SIDEBAR_MIN_W     = 0;
const SIDEBAR_MAX_W     = () => window.innerWidth * 0.88;
const CAT_COL_W         = 120;
const DATA_COL_MIN_W    = 180;

// ── App title ─────────────────────────────────────────────────
elTopbarGlobal.textContent = 'Dimensional Framework';

// ════════════════════════════════════════════════════════════════
// SIDEBAR DRAG RESIZE
// ════════════════════════════════════════════════════════════════

let _sidebarW = SIDEBAR_DEFAULT_W;

function setSidebarWidth(w) {
  _sidebarW = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W(), w));
  elSidebar.style.width = _sidebarW + 'px';
  updateLayout();
}

// Drag handle
{
  let dragging = false, startX = 0, startW = 0;

  elDragHandle.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX; startW = _sidebarW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    setSidebarWidth(startW + (startX - e.clientX));
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Snap closed if dragged narrow
    if (_sidebarW < 80) setSidebarWidth(0);
  });
}

// Arrow buttons
document.getElementById('handle-arrow-open')?.addEventListener('click',  () => setSidebarWidth(SIDEBAR_DEFAULT_W));
document.getElementById('handle-arrow-close')?.addEventListener('click', () => setSidebarWidth(0));
document.getElementById('handle-arrow-open-fixed')?.addEventListener('click',  () => setSidebarWidth(SIDEBAR_DEFAULT_W));
document.getElementById('handle-arrow-close-fixed')?.addEventListener('click', () => setSidebarWidth(0));

// Init sidebar width
setSidebarWidth(SIDEBAR_DEFAULT_W);

// Expose for utils-panel.js / sidepanel tools
window.sidebarEl    = elSidebarBox;
window.sidebarBoxEl = elSidebarBox;

// ════════════════════════════════════════════════════════════════
// CATEGORY SPANNING
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

// ════════════════════════════════════════════════════════════════
// RENDER SHEET
// ════════════════════════════════════════════════════════════════

function renderSheet(data) {
  numCatCols = data.catIndices.length || 1;

  const spans    = buildSpans(data.rows, numCatCols);
  const catCells = data.rows.map(() => new Array(numCatCols).fill(null));
  spans.forEach((levelSpans, level) => {
    levelSpans.forEach(({ value, start, count }) => {
      catCells[start][level] = { value, rowspan: count };
    });
  });
  const groupEnds = new Set(spans[0]?.map(s => s.start + s.count - 1) || []);

  // Header
  elHeaderRow.innerHTML = '';
  data.headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    elHeaderRow.appendChild(th);
  });

  // Category rows
  elCatBody.innerHTML = '';
  data.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    for (let level = 0; level < numCatCols; level++) {
      const cell = catCells[ri][level];
      if (cell !== null) {
        const td = document.createElement('td');
        td.textContent = cell.value;
        td.rowSpan     = cell.rowspan;
        if (groupEnds.has(ri + cell.rowspan - 1)) td.classList.add('group-end');
        tr.appendChild(td);
      }
    }
    elCatBody.appendChild(tr);
  });

  // Data rows
  elDataBody.innerHTML = '';
  data.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    row.cells.forEach(val => {
      const td = document.createElement('td');
      const parsed = typeof parseCitation === 'function' ? parseCitation(val) : { body: val };
      td.textContent = parsed.body || val;
      if (groupEnds.has(ri)) td.classList.add('group-end');
      tr.appendChild(td);
    });
    elDataBody.appendChild(tr);
  });

  updateLayout(data.headers.length);
}

// ════════════════════════════════════════════════════════════════
// LAYOUT + ROW HEIGHT SYNC
// ════════════════════════════════════════════════════════════════

function updateLayout(numDataCols) {
  numDataCols = numDataCols || elDataBody.querySelector('tr')?.querySelectorAll('td').length || 1;

  const totalCatW = numCatCols * CAT_COL_W;
  elCorner.style.width = totalCatW + 'px';
  document.getElementById('cat-table').style.width = totalCatW + 'px';
  elCatBody.querySelectorAll('td').forEach(td => {
    td.style.width = td.style.minWidth = CAT_COL_W + 'px';
  });

  const available  = elDataScroll.clientWidth || (window.innerWidth - _sidebarW - totalCatW - 20);
  const natural    = Math.floor(available / numDataCols);
  const colW       = Math.max(natural, DATA_COL_MIN_W);
  const tableW     = colW * numDataCols;
  const usePercent = natural >= DATA_COL_MIN_W;

  document.getElementById('header-table').style.width = usePercent ? '100%' : tableW + 'px';
  document.getElementById('data-table').style.width   = usePercent ? '100%' : tableW + 'px';
  elHeaderRow.querySelectorAll('th').forEach(th => { th.style.width = th.style.minWidth = colW + 'px'; });
  elDataBody.querySelectorAll('td').forEach(td => { td.style.width = td.style.minWidth = colW + 'px'; });

  requestAnimationFrame(() => requestAnimationFrame(syncRowHeights));
}

function syncRowHeights() {
  const dataRows = Array.from(elDataBody.querySelectorAll('tr'));
  const catRows  = Array.from(elCatBody.querySelectorAll('tr'));
  dataRows.forEach(tr => tr.style.height = '');
  catRows.forEach(tr  => tr.style.height = '');
  void elDataBody.offsetHeight;
  dataRows.forEach((dataRow, i) => {
    const catRow = catRows[i];
    if (!catRow) return;
    const h = Math.max(
      dataRow.getBoundingClientRect().height,
      catRow.getBoundingClientRect().height
    );
    dataRow.style.height = h + 'px';
    catRow.style.height  = h + 'px';
  });
  // Keep scrollbars aligned
  const scrollbarH = elDataScroll.offsetHeight - elDataScroll.clientHeight;
  const scrollbarW = elDataScroll.offsetWidth  - elDataScroll.clientWidth;
  elCatScroll.style.paddingBottom   = scrollbarH + 'px';
  elHeaderScroll.style.paddingRight = scrollbarW + 'px';
}

if (window.ResizeObserver) {
  new ResizeObserver(() => requestAnimationFrame(syncRowHeights)).observe(elDataScroll);
}

window.addEventListener('resize', () => {
  setSidebarWidth(_sidebarW);
  updateLayout();
});

// ════════════════════════════════════════════════════════════════
// SCROLL SYNC
// ════════════════════════════════════════════════════════════════

elDataScroll.addEventListener('scroll', () => {
  elHeaderScroll.scrollLeft = elDataScroll.scrollLeft;
  elCatScroll.scrollTop     = elDataScroll.scrollTop;
});

// ════════════════════════════════════════════════════════════════
// HIGHLIGHT & SELECTION
// ════════════════════════════════════════════════════════════════

function clearHighlights() {
  document.querySelectorAll('.highlight-cell, .highlight-group').forEach(el =>
    el.classList.remove('highlight-cell', 'highlight-group')
  );
}

function clearSelection() {
  selectedEls.forEach(el => el.classList.remove('selected-cell', 'selected-group'));
  selectedEls = [];
}

function getTargets(el) {
  const focal = [], group = [];

  const dataTd = el.closest('#data-body td');
  if (dataTd) { focal.push(dataTd); return { focal, group }; }

  const catTd = el.closest('#cat-body td');
  if (catTd) {
    const catRows  = Array.from(elCatBody.querySelectorAll('tr'));
    const tr       = catTd.closest('tr');
    const rowIndex = catRows.indexOf(tr);
    const span     = catTd.rowSpan || 1;
    const colIdx   = Array.from(tr.children).indexOf(catTd);
    Array.from(elDataBody.querySelectorAll('tr'))
      .slice(rowIndex, rowIndex + span)
      .forEach(r => r.querySelectorAll('td').forEach(c => group.push(c)));
    elCatBody.querySelectorAll('td').forEach(td => {
      const ttr = td.closest('tr');
      const ri  = catRows.indexOf(ttr);
      const ci  = Array.from(ttr.children).indexOf(td);
      if (ri >= rowIndex && ri < rowIndex + span && ci >= colIdx) group.push(td);
    });
    focal.push(catTd);
    return { focal, group };
  }

  const th = el.closest('#header-row th');
  if (th) {
    const colIdx = Array.from(elHeaderRow.querySelectorAll('th')).indexOf(th);
    elDataBody.querySelectorAll('tr').forEach(tr => {
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
  targets.group.forEach(el => { el.classList.add('selected-group'); selectedEls.push(el); });
  targets.focal.forEach(el => {
    el.classList.remove('selected-group'); el.classList.add('selected-cell');
    if (!selectedEls.includes(el)) selectedEls.push(el);
  });
}

[elDataBody, elCatBody, elHeaderRow].forEach(container => {
  container.addEventListener('mouseover',  e => { clearHighlights(); applyHighlight(getTargets(e.target)); });
  container.addEventListener('mouseleave', clearHighlights);
  container.addEventListener('click', e => {
    const targets = getTargets(e.target);
    if (!targets) return;
    const isSelected = targets.focal[0]?.classList.contains('selected-cell');
    if (isSelected) clearSelection();
    else applySelection(targets);
    e.stopPropagation();
  });
});
document.addEventListener('click',   e => { if (!e.target.closest('#sidebar')) clearSelection(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') clearSelection(); });

// ════════════════════════════════════════════════════════════════
// GOTO NAVIGATION  (used by sidebar panels)
// ════════════════════════════════════════════════════════════════

function _bestCol(match) {
  if (!match?.row?.cells) return 0;
  const cells = match.row.cells;
  let best = 0, bestScore = -1;
  cells.forEach((cell, ci) => {
    if (!cell?.trim()) return;
    let score = 0;
    if (match.shared && typeof match.shared.forEach === 'function') {
      const kws = typeof panelExtractKW === 'function' ? panelExtractKW(cell) : [];
      match.shared.forEach(k => { if (kws.includes(k)) score++; });
    }
    if (score > bestScore || best === 0) { bestScore = score; best = ci; }
  });
  return best;
}

function panelGoTo(match, colIdx) {
  const tabIdx    = match.tabIdx;
  const rowIdx    = match.rowIdx;
  const targetCol = typeof colIdx === 'number' ? colIdx : _bestCol(match);
  const needSwitch = activeTab !== tabIdx;

  if (needSwitch) { activeTab = tabIdx; buildTabBar(); showTab(tabIdx); }

  function doSelect() {
    clearSelection();
    const rows = Array.from(elDataBody.querySelectorAll('tr'));
    const tr   = rows[rowIdx];
    if (!tr) return;
    const tds = tr.querySelectorAll('td');
    const td  = tds[targetCol] || tds[0];
    if (!td) return;
    const targets = getTargets(td);
    if (targets) applySelection(targets);
    else td.classList.add('selected-cell');
    td.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  needSwitch ? setTimeout(doSelect, 150) : requestAnimationFrame(doSelect);
}

// Expose globally for sidepanel tools
window.panelGoTo = panelGoTo;

// ════════════════════════════════════════════════════════════════
// TAB BAR
// ════════════════════════════════════════════════════════════════

function buildTabBar() {
  elTabBar.innerHTML = '';
  if (!window.TABS?.length) return;
  TABS.forEach((tab, i) => {
    const data  = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    const label = data?.title || tab.name || ('Tab ' + (i + 1));
    const el    = document.createElement('div');
    el.className   = 'tab' + (i === activeTab ? ' active' : '');
    el.textContent = label;
    el.addEventListener('click', () => {
      if (i === activeTab) return;
      activeTab = i;
      buildTabBar();
      showTab(i);
    });
    elTabBar.appendChild(el);
  });
}

// ════════════════════════════════════════════════════════════════
// SHOW TAB
// ════════════════════════════════════════════════════════════════

function showTab(idx) {
  if (!window.TABS?.[idx]) return;
  const data = typeof processSheetData === 'function' ? processSheetData(TABS[idx].grid) : null;
  if (!data) { elDataBody.innerHTML = '<tr><td>No data</td></tr>'; return; }
  elTopbarSheet.textContent = data.title || TABS[idx].name || '';
  elDataScroll.scrollTop    = 0;
  elDataScroll.scrollLeft   = 0;
  renderSheet(data);
}

// ════════════════════════════════════════════════════════════════
// INIT — wait for TABS to be populated by utils-shared.js
// ════════════════════════════════════════════════════════════════

function _waitForTabs() {
  if (window.TABS?.length) {
    buildTabBar();
    showTab(0);
    elLoadingOverlay.style.display = 'none';
  } else {
    elLoadingOverlay.textContent = 'Fetching data…';
    setTimeout(_waitForTabs, 200);
  }
}
_waitForTabs();
