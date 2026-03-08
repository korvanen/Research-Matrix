// ════════════════════════════════════════════════════════════════
// utils-spreadsheet.js — spreadsheet viewer
// Depends on: utils-shared.js (TABS, parseCitation, processSheetData)
// ════════════════════════════════════════════════════════════════
console.log('[utils-spreadsheet.js v.5]');

// ── DOM refs ──────────────────────────────────────────────────
const elTopbarSheetName = document.getElementById('topbar-sheet-name');
const elCorner          = document.getElementById('corner');
const elHeaderScroll    = document.getElementById('header-scroll');
const elHeaderRow       = document.getElementById('header-row');
const elCatScroll       = document.getElementById('cat-scroll');
const elCatBody         = document.getElementById('cat-body');
const elDataScroll      = document.getElementById('data-scroll');
const elDataBody        = document.getElementById('data-body');
const elTabBar          = document.getElementById('tab-bar');
const elLoadingOverlay  = document.getElementById('loading-overlay');

// ── State ─────────────────────────────────────────────────────
let activeTab   = 0;
let numCatCols  = 1;
let selectedEls = [];

const CAT_COL_W      = 120;
const DATA_COL_MIN_W = 200;

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
// RENDER
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

  // Category column
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

  // Data
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
  numDataCols = numDataCols
    || elDataBody.querySelector('tr')?.querySelectorAll('td').length
    || 1;

  const totalCatW = numCatCols * CAT_COL_W;
  elCorner.style.width = totalCatW + 'px';
  document.getElementById('cat-table').style.width = totalCatW + 'px';
  elCatBody.querySelectorAll('td').forEach(td => {
    td.style.width = td.style.minWidth = CAT_COL_W + 'px';
  });

  const available  = elDataScroll.clientWidth || 800;
  const natural    = Math.floor(available / numDataCols);
  const colW       = Math.max(natural, DATA_COL_MIN_W);
  const usePercent = natural >= DATA_COL_MIN_W;
  const tableW     = colW * numDataCols;

  document.getElementById('header-table').style.width = usePercent ? '100%' : tableW + 'px';
  document.getElementById('data-table').style.width   = usePercent ? '100%' : tableW + 'px';
  elHeaderRow.querySelectorAll('th').forEach(th => { th.style.width = th.style.minWidth = colW + 'px'; });
  elDataBody.querySelectorAll('td').forEach(td => { td.style.width = td.style.minWidth = colW + 'px'; });

  requestAnimationFrame(() => {
    void elDataScroll.offsetHeight; // force reflow
    applyRotations();
    setTimeout(syncRowHeights, 0);
  });
}

// ── Category text rotation ────────────────────────────────────
const _rotatedMinH = new Map();

function applyRotations() {
  _rotatedMinH.clear();
  elCatBody.querySelectorAll('td.cat-rotated').forEach(td => {
    const inner = td.querySelector('.cat-inner');
    if (inner) td.textContent = inner.textContent;
    td.classList.remove('cat-rotated');
    td.style.height = '';
  });
  Array.from(elCatBody.querySelectorAll('tr')).forEach((tr, rowIdx) => {
    Array.from(tr.querySelectorAll('td')).forEach(td => {
      const text = td.textContent.trim();
      if (!text) return;
      const catW  = td.getBoundingClientRect().width;
      const probe = Object.assign(document.createElement('span'), {
        style: `position:absolute;visibility:hidden;white-space:nowrap;font-size:${getComputedStyle(td).fontSize};font-family:${getComputedStyle(td).fontFamily};font-weight:${getComputedStyle(td).fontWeight};letter-spacing:${getComputedStyle(td).letterSpacing};text-transform:${getComputedStyle(td).textTransform}`
      });
      probe.textContent = text;
      document.body.appendChild(probe);
      const textW = probe.getBoundingClientRect().width;
      document.body.removeChild(probe);
      if (textW <= catW - 24) return;
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

function syncRowHeights() {
  const dataRows = Array.from(elDataBody.querySelectorAll('tr'));
  const catRows  = Array.from(elCatBody.querySelectorAll('tr'));
  dataRows.forEach(tr => tr.style.height = '');
  catRows.forEach(tr  => tr.style.height = '');
  void elDataBody.offsetHeight;

  // Apply rotation min heights
  const naturalH = dataRows.map(tr => tr.getBoundingClientRect().height);
  _rotatedMinH.forEach(({ neededH, rowspan }, startRow) => {
    const cumH = naturalH.slice(startRow, startRow + rowspan).reduce((a, b) => a + b, 0);
    if (cumH >= neededH) return;
    const newH = naturalH[startRow] + (neededH - cumH);
    dataRows[startRow].style.height = newH + 'px';
    catRows[startRow].style.height  = newH + 'px';
    naturalH[startRow] = newH;
  });

  // Sync cat and data row heights
  dataRows.forEach((dataRow, i) => {
    const catRow = catRows[i];
    if (!catRow) return;
    const h = Math.max(dataRow.getBoundingClientRect().height, catRow.getBoundingClientRect().height);
    dataRow.style.height = h + 'px';
    catRow.style.height  = h + 'px';
  });

  // Keep scrollbar gutters aligned
  elCatScroll.style.paddingBottom   = (elDataScroll.offsetHeight - elDataScroll.clientHeight) + 'px';
  elHeaderScroll.style.paddingRight = (elDataScroll.offsetWidth  - elDataScroll.clientWidth)  + 'px';
}

if (window.ResizeObserver) {
  new ResizeObserver(() => setTimeout(syncRowHeights, 50)).observe(elDataScroll);
}

window.addEventListener('resize', () => { updateLayout(); });

// ── Scroll sync — cat-scroll is overflow:hidden, driven entirely by JS ───
elDataScroll.addEventListener('scroll', () => {
  elHeaderScroll.scrollLeft = elDataScroll.scrollLeft;
  elCatScroll.scrollTop     = elDataScroll.scrollTop;
});

// ════════════════════════════════════════════════════════════════
// HIGHLIGHT & SELECTION
// ════════════════════════════════════════════════════════════════

function clearHighlights() {
  document.querySelectorAll('.highlight-cell, .highlight-group')
    .forEach(el => el.classList.remove('highlight-cell', 'highlight-group'));
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
    const rowIdx   = catRows.indexOf(tr);
    const span     = catTd.rowSpan || 1;
    const colIdx   = Array.from(tr.children).indexOf(catTd);
    Array.from(elDataBody.querySelectorAll('tr'))
      .slice(rowIdx, rowIdx + span)
      .forEach(r => r.querySelectorAll('td').forEach(c => group.push(c)));
    elCatBody.querySelectorAll('td').forEach(td => {
      const ttr = td.closest('tr');
      const ri  = catRows.indexOf(ttr);
      const ci  = Array.from(ttr.children).indexOf(td);
      if (ri >= rowIdx && ri < rowIdx + span && ci >= colIdx) group.push(td);
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

function applyHighlight({ focal, group }) {
  group.forEach(el => el.classList.add('highlight-group'));
  focal.forEach(el => { el.classList.remove('highlight-group'); el.classList.add('highlight-cell'); });
}

function applySelection({ focal, group }) {
  clearSelection();
  group.forEach(el => { el.classList.add('selected-group'); selectedEls.push(el); });
  focal.forEach(el => {
    el.classList.remove('selected-group'); el.classList.add('selected-cell');
    if (!selectedEls.includes(el)) selectedEls.push(el);
  });
}

[elDataBody, elCatBody, elHeaderRow].forEach(container => {
  container.addEventListener('mouseover',  e => { clearHighlights(); const t = getTargets(e.target); if (t) applyHighlight(t); });
  container.addEventListener('mouseleave', clearHighlights);
  container.addEventListener('click', e => {
    const t = getTargets(e.target);
    if (!t) return;
    if (t.focal[0]?.classList.contains('selected-cell')) clearSelection();
    else applySelection(t);
    e.stopPropagation();
  });
});

document.addEventListener('click',   e => { if (!e.target.closest('.sheet-area')) clearSelection(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') clearSelection(); });

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
      activeTab = i; buildTabBar(); showTab(i);
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
  elTopbarSheetName.textContent = data.title || TABS[idx].name || '';
  elDataScroll.scrollTop  = 0;
  elDataScroll.scrollLeft = 0;
  clearSelection();
  renderSheet(data);
}

// ════════════════════════════════════════════════════════════════
// INIT
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
