// ════════════════════════════════════════════════════════════════
// utils-shared.js — shared data + theme utilities
// Loaded by: index.html, tools/spreadsheet.html, tools/*.html
// ════════════════════════════════════════════════════════════════
console.log('[utils-shared.js]');

const XLSX_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRKom5SD7yrnPoGV4pzsf4f20uv0nkrZXEDRA6_-g_ZTogUVBNPzeDAr4Przl7WA9Y07ev5XNuZbhTz/pub?output=xlsx';

// ── Color utilities ──────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }) {
  h /= 360;
  const hue = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue(p, q, h + 1/3) * 255),
    g: Math.round(hue(p, q, h)       * 255),
    b: Math.round(hue(p, q, h - 1/3) * 255),
  };
}
function modifyColor(hex, { lightness = 0, saturation = 0, hue = 0, alpha } = {}) {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = Math.max(0, Math.min(1, hsl.l + lightness));
  hsl.s = Math.max(0, Math.min(1, hsl.s + saturation));
  hsl.h = ((hsl.h + hue) % 360 + 360) % 360;
  const { r, g, b } = hslToRgb(hsl);
  if (alpha !== undefined) return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  return rgbToHex({ r, g, b });
}

function makeTheme(base) {
  const themeColor_1 = modifyColor(base, { lightness:  0.4  });
  const themeColor_2 = modifyColor(base, { lightness: -0.10, alpha: 0.15 });
  const themeColor_3 = modifyColor(base, { lightness:  0.9,  saturation: -0.55 });
  return {
    '--bg-topbar':               modifyColor(base, { lightness:  0.7,  saturation: -0.55 }),
    '--bg-bottombar':            modifyColor(base, { lightness:  0.7,  saturation: -0.55 }),
    '--bg-header':               themeColor_1,
    '--bg-cat':                  themeColor_1,
    '--bg-corner':               themeColor_1,
    '--bg-data':                 modifyColor(base, { lightness:  0.9,  saturation: -0.60 }),
    '--color-data':              modifyColor(base, { lightness: -0.30, saturation: -0.20, alpha: 0.80 }),
    '--color-cat':               modifyColor(base, { lightness: -0.25, saturation: -0.10, alpha: 0.55 }),
    '--color-header':            modifyColor(base, { lightness: -0.25, saturation: -0.10, alpha: 0.55 }),
    '--color-topbar-global':     modifyColor(base, { lightness: -0.20, saturation: -0.10, alpha: 0.40 }),
    '--color-topbar-sheet':      modifyColor(base, { lightness: -0.35, saturation:  0.00 }),
    '--border-main':             themeColor_2,
    '--border-group':            modifyColor(base, { lightness:  0.18, saturation: -0.25 }),
    '--border-strong':           themeColor_3,
    '--border-corner':           modifyColor(base, { lightness:  0.18, saturation: -0.25 }),
    '--border-sticky':           modifyColor(base, { lightness:  0.18, saturation: -0.25 }),
    '--highlight-cell':          modifyColor(base, { lightness:  0.2,  saturation:  0.00, alpha: 0.50 }),
    '--highlight-group':         modifyColor(base, { lightness:  0.32, saturation: -0.10, alpha: 0.35 }),
    '--selected-cell':           modifyColor(base, { lightness:  0.10, saturation:  0.05, alpha: 0.70 }),
    '--selected-group':          modifyColor(base, { lightness:  0.18, saturation:  0.00, alpha: 0.50 }),
    '--tab-bg':                  modifyColor(base, { lightness:  0.7,  saturation: -0.3  }),
    '--tab-border':              modifyColor(base, { lightness: -0.22, saturation: -0.35 }),
    '--tab-active-bg':           modifyColor(base, { lightness:  0.1,  saturation:  0    }),
    '--tab-color':               modifyColor(base, { lightness: -0.40, saturation: -0.10, alpha: 0.45 }),
    '--tab-active-color':        modifyColor(base, { lightness:  0.8,  saturation:  0.5  }),
    '--drag-handle':             modifyColor(base, { lightness: -0.05, alpha: 0.35 }),
    '--scrollbar-track':         modifyColor(base, { lightness:  0.36, saturation: -0.50, alpha: 0    }),
    '--scrollbar-thumb':         modifyColor(base, { lightness:  0.18, saturation: -0.20 }),
    '--scrollbar-thumb-hover':   modifyColor(base, { lightness:  0.08, saturation: -0.10 }),
    '--bg-sidebar':              modifyColor(base, { lightness:  0.9,  saturation: -0.55 }),
    '--sidebar-box-bg':          modifyColor(base, { lightness: -0.03, alpha: 0.06 }),
    '--sidebar-box-border':      themeColor_2,
    '--border-sidebar':          themeColor_3,
    '--tab-arrow-bg':            modifyColor(base, { lightness:  0.55, saturation: -0.20 }),
    '--tab-arrow-color':         modifyColor(base, { lightness: -0.30, saturation:  0.10 }),
    '--bg-content-surround':     themeColor_3,
    '--border-content-surround': themeColor_2,
  };
}

// ── Themes ───────────────────────────────────────────────────────
const THEMES = {
  default:        makeTheme('#a1a1a1'),
  visions:        makeTheme('#346754'),
  relational:     makeTheme('#535fc1'),
  organizational: makeTheme('#5a3f86'),
  physical:       makeTheme('#bb463c'),
  yellow:         makeTheme('#D4AF37'),
};

const TAB_THEMES = [
  'yellow',
  'visions',
  'relational',
  'organizational',
  'physical',
  'yellow',
];

window.PP_PALETTE = ['visions', 'relational', 'organizational', 'physical', 'yellow', 'default']
  .map(name => {
    const t = THEMES[name] || THEMES.default || {};
    return {
      accent: t['--tab-active-bg']    || '#4f7af7',
      bg:     t['--bg-data']          || '#f0f4ff',
      label:  t['--tab-active-color'] || '#ffffff',
    };
  });

// ── XLSX fetch & parse ────────────────────────────────────────────
async function fetchODS() {
  const res = await fetch(XLSX_URL);
  if (!res.ok) throw new Error(`Failed to fetch XLSX: ${res.status}`);
  const workbook = XLSX.read(await res.arrayBuffer(), {
    type: 'array', cellText: true, cellNF: false, cellHTML: false,
  });
  return workbook.SheetNames.map(name => ({
    name,
    grid: parseXLSXSheet(workbook.Sheets[name])
  }));
}

function parseXLSXSheet(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const rows = raw.map(row => {
    const r = Array.from(row).map(v => (v === null || v === undefined) ? '' : String(v));
    while (r.length && r[r.length - 1] === '') r.pop();
    return r;
  });
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  return rows;
}

function processSheetData(grid) {
  if (!grid.length) return null;
  const flagRow    = grid[0];
  const catIndices = flagRow.reduce((a, c, i) => { if (c.trim() === 'CATEGORY') a.push(i); return a; }, []);
  let headerRowIdx = -1;
  for (let r = 1; r < grid.length; r++) {
    if ((grid[r][0] || '').trim() === 'HEADER ROW') { headerRowIdx = r; break; }
  }
  if (headerRowIdx === -1) return null;
  const colIndices = flagRow.reduce((a, c, i) => {
    if (c.trim() === 'COLUMN' && !grid.some(r => (r[i] || '').trim() === 'HEADER ROW')) a.push(i);
    return a;
  }, []);
  const headers = colIndices.map(i => grid[headerRowIdx][i] || '');
  let title = '';
  for (let r = 0; r < grid.length; r++) {
    if ((grid[r][0] || '').trim() === 'TITLE') {
      title = grid[r].slice(1).filter(c => c.trim()).join(' ');
      break;
    }
  }
  const rows = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const g = grid[r] || [];
    if (g.every(c => !c.trim())) continue;
    const cats = catIndices.length ? catIndices.map(i => g[i] || '') : [g[0] || ''];
    if (!cats[0].trim()) continue;
    rows.push({ cats, cells: colIndices.map(i => g[i] || '') });
  }
  return { catIndices, headers, rows, title };
}

// ── Row index for tools ───────────────────────────────────────────
function buildRowIndex() {
  if (typeof TABS === 'undefined' || !TABS.length) return [];
  const rows = [];
  TABS.forEach((tab, tabIdx) => {
    const data = processSheetData(tab.grid);
    if (!data) return;
    data.rows.forEach((row, rowIdx) => {
      rows.push({
        tabIdx, rowIdx, row,
        headers: data.headers,
        title:   data.title || tab.name,
        kws:     new Set(typeof panelExtractKW === 'function' ? panelExtractKW(row.cells.join(' ')) : []),
      });
    });
  });
  return rows;
}

// ── Background data loader ────────────────────────────────────────
// Fetches the spreadsheet, populates window.TABS, then kicks off
// embeddings and the bridge. Safe to call on any page.
window.TABS = window.TABS || [];

(async () => {
  try {
    const all = await fetchODS();
    window.TABS = all.filter(s => s.name.includes('MX'));
    console.log('[utils-shared] Loaded', window.TABS.length, 'tabs');

    if (typeof EmbeddingBridge !== 'undefined') EmbeddingBridge.host();
    if (typeof initEmbeddings  === 'function')  initEmbeddings();
  } catch(e) {
    console.warn('[utils-shared] Data load failed:', e);
  }
})();
