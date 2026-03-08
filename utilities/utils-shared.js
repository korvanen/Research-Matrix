// ════════════════════════════════════════════════════════════════
// utils-shared.js — shared data, theme, and UI utilities
// Loaded by: index.html, tools/spreadsheet.html, tools/*.html
// ════════════════════════════════════════════════════════════════
console.log('[utils-shared.js v.11]');

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

  // Wire up the button. setTimeout(0) guarantees the DOM is ready regardless
  // of whether DOMContentLoaded has fired yet — works whether the script loads
  // synchronously mid-body or is deferred.
  setTimeout(init, 0);
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
// THEME DEFINITIONS — single source of truth
// To add a theme: add one entry here. Everything else is computed.
// To edit a theme: change the hex here. No other files need editing.
//
// Fields:
//   base      — the primary brand colour (mid tone)
//   tabIndex  — which spreadsheet tab slot uses this theme (0-based)
//               can be omitted if the theme isn't tied to a tab
// ════════════════════════════════════════════════════════════════

const THEME_DEFS = [
  { name: 'Dark Purple',      base: '#3A1C36', tabIndex: 0 },
  { name: 'Dark Berry',     base: '#6E1E3A', tabIndex: 1 },
  { name: 'Carrot',         base: '#076A40', tabIndex: 2 },
  { name: 'Lemon Curd', base: '#FADD8B', tabIndex: 3 },
  { name: 'Baby Blue',       base: '#A4BDE0', tabIndex: 4 },
  { name: 'Sailor Blue',       base: '#274FBB', tabIndex: 5 },
  { name: 'Forest',       base: '#25533F', tabIndex: 6 },
  { name: 'Limeade',       base: '#C90763', tabIndex: 7 },
  { name: 'default',        base: '#a1a1a1'               },
];

// ── Derived values ─────────────────────────────────────────────
// Compute all tokens from each theme's base colour.
// These functions mirror what makeTheme() used to do, but now drive
// both the CSS variables (injected below) and the JS palette arrays.

function _themeAccent(base)      { return modifyColor(base, { lightness:  0.05, saturation:  0.05 }); }
function _themeMid(base)         { return modifyColor(base, { lightness:  0.08 }); }
function _themeDark(base)        { return modifyColor(base, { lightness: -0.15, saturation: -0.05 }); }
function _themeLight(base)       { return modifyColor(base, { lightness:  0.28, saturation: -0.15 }); }
// Light bg: push to near-white by targeting high absolute lightness
function _themeBgLight(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.45), l: 0.96 }));
}
// Dark bg: push to near-black by targeting low absolute lightness
function _themeBgDark(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.20), l: 0.10 }));
}
// Dark accent: brighten significantly for readability on dark bg
function _themeAccentDark(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  const targetL = Math.min(0.72, Math.max(0.62, hsl.l + 0.28));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.05), l: targetL }));
}

// Build the CSS custom-property block for one theme
function _themeTokens(name, base) {
  return [
    `--raw-${name}-dark:  ${_themeDark(base)}`,
    `--raw-${name}:       ${base}`,
    `--raw-${name}-mid:   ${_themeMid(base)}`,
    `--raw-${name}-light: ${_themeLight(base)}`,
    `--raw-${name}-bg:    ${_themeBgLight(base)}`,
  ].join(';\n  ');
}

function _themeTokensDark(name, base) {
  return `--raw-${name}-bg: ${_themeBgDark(base)}`;
}

// Inject all theme raw tokens + palette tokens into a <style> tag so
// design-system.css doesn't need to know about individual themes at all.
(function injectThemeTokens() {
  const lightVars = THEME_DEFS
    .map(t => _themeTokens(t.name, t.base))
    .join(';\n  ');

  // palette-N tokens: ordered by tabIndex (tabs in index order), then default last
  const tabThemes = THEME_DEFS.filter(t => t.tabIndex !== undefined)
    .sort((a, b) => a.tabIndex - b.tabIndex);
  const paletteLight = tabThemes
    .map((t, i) => `--palette-${i}-accent: var(--raw-${t.name}-mid);\n  --palette-${i}-bg: var(--raw-${t.name}-bg)`)
    .join(';\n  ');

  const darkVars = THEME_DEFS
    .map(t => _themeTokensDark(t.name, t.base))
    .join(';\n  ');

  const css = `
:root {
  ${lightVars};
  ${paletteLight};
}
@media (prefers-color-scheme: dark) {
  :root { ${darkVars}; }
}
html.dark  { ${darkVars}; }
html.light { ${THEME_DEFS.map(t => `--raw-${t.name}-bg: ${_themeBgLight(t.base)}`).join(';\n  ')}; }
`;

  const el = document.createElement('style');
  el.id = 'df-theme-tokens';
  document.head.appendChild(el);
  el.textContent = css;
})();

// ── Palette arrays for JS card rendering ──────────────────────
// getPalette() returns the right set for the current light/dark mode.

const _tabThemesSorted = THEME_DEFS
  .filter(t => t.tabIndex !== undefined)
  .sort((a, b) => a.tabIndex - b.tabIndex);

const _PALETTE_LIGHT = _tabThemesSorted.map(t => ({
  accent: _themeMid(t.base),
  bg:     _themeBgLight(t.base),
  label:  '#ffffff',
}));

const _PALETTE_DARK = _tabThemesSorted.map(t => ({
  accent: _themeAccentDark(t.base),
  bg:     _themeBgDark(t.base),
  label:  _themeBgDark(t.base),
}));

function getPalette() {
  return document.documentElement.classList.contains('dark')
    ? _PALETTE_DARK
    : _PALETTE_LIGHT;
}

window.PP_PALETTE = _PALETTE_LIGHT; // legacy static reference
window.getPalette = getPalette;

// ── Legacy THEMES / TAB_THEMES for any code that still reads them ─
const TAB_THEMES = _tabThemesSorted.map(t => t.name);

function makeTheme(base) {
  return {
    '--tab-active-bg':    _themeMid(base),
    '--tab-active-color': '#ffffff',
    '--bg-data':          _themeBgLight(base),
  };
}

const THEMES = Object.fromEntries(THEME_DEFS.map(t => [t.name, makeTheme(t.base)]));

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
// ══════════════════════════════════════════════════════════════════════════
// PP-NAV-RAIL  — global collapsible tool side panel
// Append this block to the end of utils-shared.js
//
// Usage in a tool init function:
//
//   const nav = PPNavRail.create(paneEl, {
//     toolName: 'Concept Map',
//     panelSections: [
//       { label: 'Parameters', html: '<div>...sliders html...</div>' },
//       { label: 'Layout',     html: '<div>...layout picker html...</div>' },
//     ],
//   });
//
//   // nav.mainEl   — append your canvas / world div here
//   // nav.subtitleEl, nav.statusEl — live elements to update text on
//   // All slider/button IDs inside panelSections html are queryable
//   // from nav.panelEl via nav.panelEl.querySelector('#my-id')
// ══════════════════════════════════════════════════════════════════════════
window.PPNavRail = (function () {

  // Menu hamburger SVG (3 lines)
  var ICON_OPEN =
    '<svg viewBox="0 0 18 14" width="16" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
    '<line x1="1" y1="2"  x2="17" y2="2"/>' +
    '<line x1="5" y1="7"  x2="17" y2="7"/>' +
    '<line x1="1" y1="12" x2="17" y2="12"/>' +
    '</svg>';

  // Chevron-left SVG (panel is closed, button hints "open")
  var ICON_CLOSED =
    '<svg viewBox="0 0 10 14" width="10" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="7,2 2,7 7,12"/>' +
    '</svg>';

  function create(paneEl, opts) {
    var toolName       = opts.toolName       || 'Tool';
    var panelSections  = opts.panelSections  || [];
    var defaultOpen    = opts.defaultOpen !== false;

    // Build sections HTML
    var sectionsHTML = '';
    panelSections.forEach(function (sec) {
      sectionsHTML +=
        '<div class="pp-side-panel-section">' +
          '<div class="pp-side-panel-section-label">' + sec.label + '</div>' +
          sec.html +
        '</div>';
    });

    // Restructure paneEl as flex row layout
    paneEl.style.cssText += ';display:flex;flex-direction:row;overflow:hidden;';

    paneEl.innerHTML =
      // ── Nav rail (always visible) ──
      '<div class="pp-nav-rail">' +
        '<button class="pp-nav-rail-toggle" title="Toggle controls">' +
          (defaultOpen ? ICON_OPEN : ICON_CLOSED) +
        '</button>' +
      '</div>' +

      // ── Collapsible side panel ──
      '<div class="pp-side-panel' + (defaultOpen ? '' : ' pp-side-panel--collapsed') + '">' +
        '<div class="pp-side-panel-header">' +
          '<div class="pp-side-panel-tool-name">' + toolName + '</div>' +
          '<div class="pp-side-panel-subtitle">Loading\u2026</div>' +
          '<div class="pp-side-panel-status"></div>' +
        '</div>' +
        '<div class="pp-side-panel-body">' +
          sectionsHTML +
        '</div>' +
      '</div>' +

      // ── Main area (tool appends canvas here) ──
      '<div class="pp-tool-main"></div>';

    var toggleBtn  = paneEl.querySelector('.pp-nav-rail-toggle');
    var panel      = paneEl.querySelector('.pp-side-panel');
    var mainEl     = paneEl.querySelector('.pp-tool-main');
    var subtitleEl = panel.querySelector('.pp-side-panel-subtitle');
    var statusEl   = panel.querySelector('.pp-side-panel-status');

    var open = defaultOpen;
    toggleBtn.addEventListener('click', function () {
      open = !open;
      panel.classList.toggle('pp-side-panel--collapsed', !open);
      toggleBtn.innerHTML = open ? ICON_OPEN : ICON_CLOSED;
    });

    return {
      panelEl:    panel,
      mainEl:     mainEl,
      subtitleEl: subtitleEl,
      statusEl:   statusEl,
    };
  }

  return { create: create };
})();

