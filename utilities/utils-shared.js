// ════════════════════════════════════════════════════════════════
// utils-shared.js — shared data, theme, and UI utilities
// Loaded by: index.html, tools/spreadsheet.html, tools/*.html
// ════════════════════════════════════════════════════════════════
console.log('[utils-shared.js v.10]');

// ════════════════════════════════════════════════════════════════
// DARK / LIGHT MODE
// Toggles html.dark / html.light on <html>.
// design-system.css has matching html.dark :root and html.light :root
// rules that override the @media (prefers-color-scheme) blocks,
// so the whole page re-themes instantly with no JS token injection.
// The toggle button needs id="theme-toggle" and a label span with
// id="theme-toggle-label". Changes broadcast to all tabs via localStorage.
// ════════════════════════════════════════════════════════════════

;(function () {
  var STORAGE_KEY = 'df-theme';
  var html        = document.documentElement;

  // Inject a <style> we fully control (beats the @media query when needed)
  var styleEl    = document.createElement('style');
  styleEl.id     = 'df-theme-override';
  document.head.appendChild(styleEl);

  function applyTheme(dark) {
    html.classList.toggle('dark',  dark);
    html.classList.toggle('light', !dark);
    // design-system.css has html.dark :root and html.light :root rules
    // that override every @media (prefers-color-scheme) block — no JS injection needed.
    styleEl.textContent = '';
  }

  // Apply immediately — this runs before the stylesheet is parsed
  var saved       = localStorage.getItem(STORAGE_KEY);
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark      = saved !== null ? saved === 'dark' : prefersDark;
  applyTheme(isDark);

  // Wire up the toggle button once DOM is ready
  function init() {
    var btn = document.getElementById('theme-toggle');
    var lbl = document.getElementById('theme-toggle-label');
    if (!btn) return; // page has no toggle — fine, theme still applies

    function syncLabel() {
      if (lbl) lbl.textContent = isDark ? 'Light mode' : 'Dark mode';
    }
    syncLabel();

    btn.addEventListener('click', function () {
      isDark = !isDark;
      applyTheme(isDark);
      syncLabel();
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
      window.dispatchEvent(new CustomEvent('df-theme-change', { detail: { dark: isDark } }));
    });

    // Follow OS if user has no explicit saved preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        isDark = e.matches;
        applyTheme(isDark);
        syncLabel();
      }
    });
  }

  // Live-sync all other open tabs when another tab toggles
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    isDark = e.newValue === 'dark';
    applyTheme(isDark);
    var lbl = document.getElementById('theme-toggle-label');
    if (lbl) lbl.textContent = isDark ? 'Light mode' : 'Dark mode';
    window.dispatchEvent(new CustomEvent('df-theme-change', { detail: { dark: isDark } }));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Script loaded after DOM is ready (bottom of body) — call directly
    init();
  }
})();

// ════════════════════════════════════════════════════════════════
// SHEET URL HANDLING
// ════════════════════════════════════════════════════════════════

var DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iX0AbN6fy3Sc0sb2arMDSu9NE7fV00Uqg82yRgzs1QI/edit?usp=sharing';

function sheetIdFromUrl(url) {
  var m = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function sheetExportUrl(url) {
  var id = sheetIdFromUrl(url);
  if (!id) return null;
  return 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
}

function isSheetUrl(url) {
  return /docs\.google\.com\/spreadsheets/.test(String(url || ''));
}

function getSavedSheetUrl() {
  try { return localStorage.getItem('df_sheet_url') || DEFAULT_SHEET_URL; }
  catch(e) { return DEFAULT_SHEET_URL; }
}

function saveSheetUrl(url) {
  try { localStorage.setItem('df_sheet_url', url); } catch(e) {}
}

function clearSavedSheetUrl() {
  try { localStorage.removeItem('df_sheet_url'); } catch(e) {}
}

function isUsingDefaultSheet() {
  try { return !localStorage.getItem('df_sheet_url'); }
  catch(e) { return true; }
}

// ════════════════════════════════════════════════════════════════
// HTML / TEXT UTILITIES
// ════════════════════════════════════════════════════════════════

function panelEscH(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function panelHighlight(text, kwSet) {
  if (!kwSet || !kwSet.size) return panelEscH(text);
  const pat = new RegExp(
    '\\b(' + [...kwSet].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi'
  );
  return panelEscH(text).replace(pat, m => '<mark class="pkw">' + m + '</mark>');
}

// ════════════════════════════════════════════════════════════════
// CITATION PARSING
// ════════════════════════════════════════════════════════════════

var _citationRe = /\s*\(([^)]+)\)\s*\.?\s*$/;

function parseCitation(text) {
  text = String(text == null ? '' : text);
  var m = _citationRe.exec(text);
  if (!m) return { body: text, citation: null };
  return { body: text.slice(0, m.index).trimEnd(), citation: m[1] };
}

function citationPillHtml(citation, accentColor, textColor) {
  if (!citation) return '';
  return '<span class="pp-cite-pill" style="background:' +
    panelEscH(accentColor) + ';color:' + panelEscH(textColor) + '">' +
    panelEscH(citation) + '</span>';
}

// ════════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ════════════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('');
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

// ════════════════════════════════════════════════════════════════
// THEMES
// ════════════════════════════════════════════════════════════════

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

const THEMES = {
  default:        makeTheme('#a1a1a1'),
  visions:        makeTheme('#346754'),
  relational:     makeTheme('#535fc1'),
  organizational: makeTheme('#5a3f86'),
  physical:       makeTheme('#bb463c'),
  yellow:         makeTheme('#D4AF37'),
};

const TAB_THEMES = ['yellow', 'visions', 'relational', 'organizational', 'physical', 'yellow'];

// Light-mode palette (bg = very pale tint, accent = saturated mid)
const _PALETTE_LIGHT = [
  { accent: '#2e7d5e', bg: '#eef5f1', label: '#ffffff' }, // visions
  { accent: '#4a56c8', bg: '#eef0fb', label: '#ffffff' }, // relational
  { accent: '#5e3d9e', bg: '#f2eef9', label: '#ffffff' }, // org
  { accent: '#bb463c', bg: '#faf0ef', label: '#ffffff' }, // physical
  { accent: '#c8991a', bg: '#fdfaee', label: '#ffffff' }, // yellow
  { accent: '#787680', bg: '#f4f4f6', label: '#ffffff' }, // default
];

// Dark-mode palette (bg = very dark tint, accent = lighter/more luminous)
const _PALETTE_DARK = [
  { accent: '#7ecfb0', bg: '#0e1f18', label: '#0e1f18' }, // visions
  { accent: '#9ba4f0', bg: '#0d0f26', label: '#0d0f26' }, // relational
  { accent: '#c0a8f0', bg: '#130b22', label: '#130b22' }, // org
  { accent: '#f09090', bg: '#220c0b', label: '#220c0b' }, // physical
  { accent: '#f0cc60', bg: '#1e1800', label: '#1e1800' }, // yellow
  { accent: '#aaaabc', bg: '#1a1a1f', label: '#1a1a1f' }, // default
];

// Returns the right palette for the current theme mode
function getPalette() {
  return document.documentElement.classList.contains('dark')
    ? _PALETTE_DARK
    : _PALETTE_LIGHT;
}

// Legacy: static reference kept for any code that reads window.PP_PALETTE at load time
window.PP_PALETTE = _PALETTE_LIGHT;
// Dynamic accessor — tools should use this
window.getPalette = getPalette;

function panelThemeVars(tabIdx) {
  const name = TAB_THEMES[tabIdx] || 'default';
  return THEMES[name] || THEMES.default;
}

// ════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════════════════════

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

function upgradeSlider(input) {
  const variant = input.classList.contains('pp-range--accent') ? 'accent'
                : input.classList.contains('pp-range--muted')  ? 'muted' : '';
  const wrap  = document.createElement('div');
  wrap.className = 'pp-range-wrap' + (variant ? ' pp-range-wrap--' + variant : '');
  const track = document.createElement('div'); track.className = 'pp-range-track';
  const fill  = document.createElement('div'); fill.className  = 'pp-range-fill';
  const thumb = document.createElement('div'); thumb.className = 'pp-range-thumb';
  track.appendChild(fill); wrap.appendChild(track); wrap.appendChild(thumb);
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  function update() {
    const pct = ((+input.value - (+input.min || 0)) / ((+input.max || 100) - (+input.min || 0))) * 100;
    thumb.style.left = pct + '%'; fill.style.width = pct + '%';
  }
  thumb.style.transition = fill.style.transition = 'none';
  update();
  requestAnimationFrame(() => { thumb.style.transition = fill.style.transition = ''; });
  input.addEventListener('input', update);
  input.addEventListener('mousedown',  () => wrap.classList.add('pp-range-dragging'));
  input.addEventListener('touchstart', () => wrap.classList.add('pp-range-dragging'), { passive: true });
  document.addEventListener('mouseup',  () => wrap.classList.remove('pp-range-dragging'));
  document.addEventListener('touchend', () => wrap.classList.remove('pp-range-dragging'));
}

// ════════════════════════════════════════════════════════════════
// XLSX FETCH & PARSE
// ════════════════════════════════════════════════════════════════

async function fetchODS(sheetUrl) {
  var raw = sheetUrl || getSavedSheetUrl();
  var url = isSheetUrl(raw) ? sheetExportUrl(raw) : raw;
  if (!url) throw new Error('No valid sheet URL');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sheet: ' + res.status);
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
      title = grid[r].slice(1).filter(c => c.trim()).join(' '); break;
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
        kws: new Set(typeof panelExtractKW === 'function' ? panelExtractKW(row.cells.join(' ')) : []),
      });
    });
  });
  return rows;
}

// ════════════════════════════════════════════════════════════════
// BACKGROUND DATA LOADER
// ════════════════════════════════════════════════════════════════

window.TABS = window.TABS || [];

(async () => {
  if (window.__BRIDGE_GUEST) return;
  try {
    const urlToLoad = getSavedSheetUrl();
    console.log('[utils-shared] Loading sheet:', urlToLoad);
    const all = await fetchODS(urlToLoad);
    window.TABS = all.filter(s => s.name.includes('MX'));
    console.log('[utils-shared] Loaded', window.TABS.length, 'tabs');
    if (typeof EmbeddingBridge !== 'undefined') EmbeddingBridge.host();
    if (typeof initEmbeddings  === 'function')  initEmbeddings();
    window.dispatchEvent(new CustomEvent('sheet-loaded', { detail: { tabCount: window.TABS.length } }));
  } catch(e) {
    console.warn('[utils-shared] Data load failed:', e);
    window.dispatchEvent(new CustomEvent('sheet-load-error', { detail: { error: e } }));
  }
})();
