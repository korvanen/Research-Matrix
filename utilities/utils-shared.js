// ════════════════════════════════════════════════════════════════
// utils-shared.js — shared data, theme, and UI utilities
// Loaded by: index.html, tools/spreadsheet.html, tools/*.html
// MD3 upgrade: Navigation Rail 80px, component classes injected globally
// ════════════════════════════════════════════════════════════════
console.log('[utils-shared.js v.12-md3]');

// ════════════════════════════════════════════════════════════════
// DARK / LIGHT MODE
// ════════════════════════════════════════════════════════════════

;(function () {
  var STORAGE_KEY = 'df-theme';
  var html        = document.documentElement;

  var styleEl    = document.createElement('style');
  styleEl.id     = 'df-theme-override';
  document.head.appendChild(styleEl);

  function applyTheme(dark) {
    html.classList.toggle('dark',  dark);
    html.classList.toggle('light', !dark);
    styleEl.textContent = '';
  }

  var saved       = localStorage.getItem(STORAGE_KEY);
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark      = saved !== null ? saved === 'dark' : prefersDark;
  applyTheme(isDark);

  function init() {
    var btn = document.getElementById('theme-toggle');
    var lbl = document.getElementById('theme-toggle-label');
    if (!btn) return;

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

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        isDark = e.matches;
        applyTheme(isDark);
        syncLabel();
      }
    });
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    isDark = e.newValue === 'dark';
    applyTheme(isDark);
    var lbl = document.getElementById('theme-toggle-label');
    if (lbl) lbl.textContent = isDark ? 'Light mode' : 'Dark mode';
    window.dispatchEvent(new CustomEvent('df-theme-change', { detail: { dark: isDark } }));
  });

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
// ════════════════════════════════════════════════════════════════

const THEME_DEFS = [
  { name: 'Dark Purple',  base: '#3A1C36', tabIndex: 0 },
  { name: 'Dark Berry',   base: '#6E1E3A', tabIndex: 1 },
  { name: 'Carrot',       base: '#076A40', tabIndex: 2 },
  { name: 'Lemon Curd',   base: '#FADD8B', tabIndex: 3 },
  { name: 'Baby Blue',    base: '#A4BDE0', tabIndex: 4 },
  { name: 'Sailor Blue',  base: '#274FBB', tabIndex: 5 },
  { name: 'Forest',       base: '#25533F', tabIndex: 6 },
  { name: 'Limeade',      base: '#C90763', tabIndex: 7 },
  { name: 'default',      base: '#a1a1a1'               },
];

function _themeAccent(base)      { return modifyColor(base, { lightness:  0.05, saturation:  0.05 }); }
function _themeMid(base)         { return modifyColor(base, { lightness:  0.08 }); }
function _themeDark(base)        { return modifyColor(base, { lightness: -0.15, saturation: -0.05 }); }
function _themeLight(base)       { return modifyColor(base, { lightness:  0.28, saturation: -0.15 }); }
function _themeBgLight(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.45), l: 0.96 }));
}
function _themeBgDark(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.20), l: 0.10 }));
}
function _themeAccentDark(base) {
  const hsl = rgbToHsl(hexToRgb(base));
  const targetL = Math.min(0.72, Math.max(0.62, hsl.l + 0.28));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.max(0, hsl.s - 0.05), l: targetL }));
}

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

(function injectThemeTokens() {
  const lightVars = THEME_DEFS
    .map(t => _themeTokens(t.name, t.base))
    .join(';\n  ');

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

window.PP_PALETTE = _PALETTE_LIGHT;
window.getPalette = getPalette;

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
// MD3 GLOBAL COMPONENT STYLES
// Injected once, available to every tool page
// Based on Material Design 3 specification
// ════════════════════════════════════════════════════════════════

(function injectMD3BaseStyles() {
  if (document.getElementById('md3-base-styles')) return;
  const s = document.createElement('style');
  s.id = 'md3-base-styles';
  s.textContent = `

/* ─────────────────────────────────────────────────────────────
   MD3 NAVIGATION RAIL
   Spec: 80px wide, icon (24px) + label (label-medium 12sp),
   active indicator pill 56×32px secondary-container
   ───────────────────────────────────────────────────────────── */

.pp-nav-rail {
  width: 80px !important;
  min-width: 80px !important;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 16px;
  background: var(--md-sys-color-surface-container);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  overflow: hidden;
  gap: 0;
  z-index: 20;
}

/* Toggle (hamburger) → MD3 Standard Icon Button */
.pp-nav-rail-toggle {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  transition: color var(--transition-fast);
  margin-bottom: 4px;
}
.pp-nav-rail-toggle::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-nav-rail-toggle:hover::before { opacity: .08; }
.pp-nav-rail-toggle:active::before { opacity: .12; }
.pp-nav-rail-toggle:focus-visible {
  outline: 3px solid var(--md-sys-color-secondary);
  outline-offset: 2px;
}

/* Rail extra action icon buttons (e.g. table, export in Clusters) */
.pp-nav-rail-sheet-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  transition: color var(--transition-fast);
}
.pp-nav-rail-sheet-btn::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-nav-rail-sheet-btn:hover::before  { opacity: .08; }
.pp-nav-rail-sheet-btn:active::before { opacity: .12; }

/* MD3 Navigation Item */
.pp-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 80px;
  padding: 12px 0;
  text-decoration: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: color var(--transition-fast);
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.pp-nav-item-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 32px;
  border-radius: 16px;
  background: transparent;
  transition: background var(--transition-fast);
  position: relative;
  overflow: hidden;
}
.pp-nav-item-indicator::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  border-radius: 16px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.pp-nav-item:hover .pp-nav-item-indicator::before { opacity: .08; }
.pp-nav-item:active .pp-nav-item-indicator::before { opacity: .12; }
.pp-nav-item.active .pp-nav-item-indicator {
  background: var(--md-sys-color-secondary-container);
}
.pp-nav-item.active {
  color: var(--md-sys-color-on-secondary-container);
}
.pp-nav-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  position: relative;
  z-index: 1;
}
.pp-nav-item-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.005em;
  line-height: 16px;
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ─────────────────────────────────────────────────────────────
   MD3 TOP APP BAR — Small
   Spec: 64px height, title-large (22sp), leading nav icon button
   ───────────────────────────────────────────────────────────── */

.md3-top-app-bar {
  height: 64px;
  min-height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px 0 4px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  position: relative;
}
.md3-top-app-bar--on-scroll {
  background: var(--md-sys-color-surface-container);
  box-shadow: var(--md-elev-2, 0 1px 2px rgba(0,0,0,0.3),0 2px 6px 2px rgba(0,0,0,0.15));
}
.md3-top-app-bar__nav-btn {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: 50%;
  cursor: pointer; color: var(--md-sys-color-on-surface);
  flex-shrink: 0; position: relative; overflow: hidden;
}
.md3-top-app-bar__nav-btn::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-top-app-bar__nav-btn:hover::before  { opacity: .08; }
.md3-top-app-bar__nav-btn:active::before { opacity: .12; }
.md3-top-app-bar__title {
  flex: 1; min-width: 0;
  font-size: 22px;
  font-weight: 400;
  line-height: 28px;
  letter-spacing: 0;
  color: var(--md-sys-color-on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 0 4px;
}
.md3-top-app-bar__actions {
  display: flex; align-items: center; gap: 0;
  padding-right: 4px;
}

/* ─────────────────────────────────────────────────────────────
   MD3 ICON BUTTON — all four variants
   Spec: 40px container, 24px icon
   ───────────────────────────────────────────────────────────── */

.md3-icon-btn {
  width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: 50%;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  position: relative; overflow: hidden;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}
.md3-icon-btn::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface-variant);
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-icon-btn:hover::before  { opacity: .08; }
.md3-icon-btn:active::before { opacity: .12; }
.md3-icon-btn:focus-visible { outline: 3px solid var(--md-sys-color-secondary); outline-offset: 2px; }

/* Filled Icon Button */
.md3-icon-btn--filled {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
.md3-icon-btn--filled::before { background: var(--md-sys-color-on-primary); }

/* Filled Tonal Icon Button */
.md3-icon-btn--tonal {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}
.md3-icon-btn--tonal::before { background: var(--md-sys-color-on-secondary-container); }

/* Outlined Icon Button */
.md3-icon-btn--outlined {
  border: 1px solid var(--md-sys-color-outline);
  color: var(--md-sys-color-on-surface-variant);
}

/* ─────────────────────────────────────────────────────────────
   MD3 BUTTONS — all five variants
   Spec: 40px height, 20px radius, 24px h-pad, label-large (14sp 500)
   ───────────────────────────────────────────────────────────── */

.md3-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 20px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.00625em;
  line-height: 20px;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.md3-btn::before {
  content: ''; position: absolute; inset: 0;
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-btn:disabled { opacity: .38; cursor: not-allowed; pointer-events: none; }
.md3-btn:focus-visible { outline: 3px solid var(--md-sys-color-secondary); outline-offset: 2px; }

/* Leading icon adjusts left padding */
.md3-btn--icon { padding-left: 16px; }

/* Filled */
.md3-btn--filled {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  box-shadow: var(--md-elev-0, none);
}
.md3-btn--filled::before { background: var(--md-sys-color-on-primary); }
.md3-btn--filled:hover { box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3)); }
.md3-btn--filled:hover::before  { opacity: .08; }
.md3-btn--filled:active::before { opacity: .12; }
.md3-btn--filled:active { box-shadow: none; }

/* Filled Tonal */
.md3-btn--tonal {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}
.md3-btn--tonal::before { background: var(--md-sys-color-on-secondary-container); }
.md3-btn--tonal:hover   { box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3)); }
.md3-btn--tonal:hover::before  { opacity: .08; }
.md3-btn--tonal:active::before { opacity: .12; }

/* Elevated */
.md3-btn--elevated {
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-primary);
  box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3));
}
.md3-btn--elevated::before { background: var(--md-sys-color-primary); }
.md3-btn--elevated:hover   { box-shadow: var(--md-elev-2, 0 1px 2px rgba(0,0,0,0.3),0 2px 6px 2px rgba(0,0,0,0.15)); }
.md3-btn--elevated:hover::before  { opacity: .08; }
.md3-btn--elevated:active::before { opacity: .12; }
.md3-btn--elevated:active { box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3)); }

/* Outlined */
.md3-btn--outlined {
  background: transparent;
  color: var(--md-sys-color-primary);
  border: 1px solid var(--md-sys-color-outline);
}
.md3-btn--outlined::before { background: var(--md-sys-color-primary); }
.md3-btn--outlined:hover::before  { opacity: .08; }
.md3-btn--outlined:active::before { opacity: .12; }
.md3-btn--outlined:focus-visible { border-color: var(--md-sys-color-primary); }

/* Text */
.md3-btn--text {
  background: transparent;
  color: var(--md-sys-color-primary);
  padding: 0 12px;
}
.md3-btn--text::before { background: var(--md-sys-color-primary); }
.md3-btn--text:hover::before  { opacity: .08; }
.md3-btn--text:active::before { opacity: .12; }

/* Error variant */
.md3-btn--error {
  background: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
}
.md3-btn--error::before { background: var(--md-sys-color-on-error); }

/* ─────────────────────────────────────────────────────────────
   MD3 CHIPS
   Spec: 32px height, full border-radius (16px)
   Assist: outlined or elevated  Filter: outlined→filled on select
   Input: outlined with trailing remove  Suggestion: outlined
   ───────────────────────────────────────────────────────────── */

.md3-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.00625em;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  text-decoration: none;
  border: none;
  -webkit-tap-highlight-color: transparent;
}
.md3-chip::before {
  content: ''; position: absolute; inset: 0;
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-chip:focus-visible { outline: 3px solid var(--md-sys-color-secondary); outline-offset: 2px; }

/* Assist chip — outlined */
.md3-chip--assist {
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
}
.md3-chip--assist::before { background: var(--md-sys-color-on-surface); }
.md3-chip--assist:hover::before  { opacity: .08; }
.md3-chip--assist:active::before { opacity: .12; }

/* Assist chip — elevated */
.md3-chip--assist-elevated {
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3));
}
.md3-chip--assist-elevated::before { background: var(--md-sys-color-on-surface); }
.md3-chip--assist-elevated:hover::before  { opacity: .08; }
.md3-chip--assist-elevated:active::before { opacity: .12; }

/* Filter chip — unselected */
.md3-chip--filter {
  background: transparent;
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
}
.md3-chip--filter::before { background: var(--md-sys-color-on-surface); }
.md3-chip--filter:hover::before  { opacity: .08; }
.md3-chip--filter:active::before { opacity: .12; }

/* Filter chip — selected */
.md3-chip--filter.md3-chip--selected {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border-color: transparent;
}
.md3-chip--filter.md3-chip--selected::before { background: var(--md-sys-color-on-secondary-container); }

/* Suggestion chip */
.md3-chip--suggestion {
  background: transparent;
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
  cursor: default;
}
.md3-chip--suggestion::before { background: var(--md-sys-color-on-surface); }

/* Input chip — with trailing close icon */
.md3-chip--input {
  height: 32px;
  padding: 0 4px 0 12px;
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
}
.md3-chip--input::before { background: var(--md-sys-color-on-surface); }
.md3-chip--input:hover::before  { opacity: .08; }
.md3-chip--input:active::before { opacity: .12; }
.md3-chip__close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; flex-shrink: 0;
  border-radius: 50%; cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  transition: background var(--transition-fast), color var(--transition-fast);
  position: relative; z-index: 1;
}
.md3-chip__close:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent); color: var(--md-sys-color-error); }
.md3-chip__icon { width: 18px; height: 18px; flex-shrink: 0; }

/* ─────────────────────────────────────────────────────────────
   MD3 OUTLINED TEXT FIELD
   Spec: 56px height, 4px radius (extra-small), 1px→2px border
   ───────────────────────────────────────────────────────────── */

.md3-field {
  position: relative;
  display: flex;
  align-items: center;
}
.md3-field__outline {
  position: absolute; inset: 0;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 4px;
  pointer-events: none;
  transition: border-color var(--transition-fast), border-width .1s;
}
.md3-field:focus-within .md3-field__outline {
  border: 2px solid var(--md-sys-color-primary);
}
.md3-field__label {
  position: absolute;
  left: 16px; top: 50%;
  transform: translateY(-50%);
  font-size: 16px; line-height: 24px;
  letter-spacing: 0.03125em;
  color: var(--md-sys-color-on-surface-variant);
  pointer-events: none;
  background: var(--md-sys-color-background, var(--md-sys-color-surface));
  padding: 0 4px;
  transition: top .15s, font-size .15s, color .15s;
}
.md3-field:focus-within .md3-field__label,
.md3-field.md3-field--populated .md3-field__label {
  top: 0; font-size: 12px; color: var(--md-sys-color-primary);
}
.md3-field__input,
.md3-field__textarea {
  flex: 1; min-width: 0;
  height: 56px;
  padding: 0 16px;
  background: transparent;
  border: none; outline: none;
  font-family: var(--font-family);
  font-size: 16px; line-height: 24px;
  letter-spacing: 0.03125em;
  color: var(--md-sys-color-on-surface);
  caret-color: var(--md-sys-color-primary);
}
.md3-field__input::placeholder,
.md3-field__textarea::placeholder { color: var(--md-sys-color-on-surface-variant); opacity: 1; }
.md3-field__textarea { height: auto; padding: 16px; resize: none; }
.md3-field__leading { padding-left: 12px; flex-shrink: 0; color: var(--md-sys-color-on-surface-variant); }
.md3-field__trailing { padding-right: 12px; flex-shrink: 0; color: var(--md-sys-color-on-surface-variant); }
.md3-field__input:has(+ .md3-field__leading) { padding-left: 0; }
.md3-field--with-leading .md3-field__label { left: 52px; }
.md3-field--with-leading .md3-field__input { padding-left: 0; }
.md3-field__support {
  font-size: 12px; line-height: 16px; letter-spacing: 0.025em;
  color: var(--md-sys-color-on-surface-variant);
  padding: 4px 16px 0;
}
.md3-field__support--error { color: var(--md-sys-color-error); }
.md3-field:focus-within .md3-field__support { color: var(--md-sys-color-primary); }

/* Filled Text Field variant */
.md3-field--filled .md3-field__outline { display: none; }
.md3-field--filled {
  background: var(--md-sys-color-surface-container-highest);
  border-radius: 4px 4px 0 0;
}
.md3-field--filled::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
  background: var(--md-sys-color-on-surface-variant);
  transition: height .1s, background var(--transition-fast);
}
.md3-field--filled:focus-within::after { height: 2px; background: var(--md-sys-color-primary); }
.md3-field--filled .md3-field__label { background: transparent; }

/* ─────────────────────────────────────────────────────────────
   MD3 CARDS — Elevated, Filled, Outlined
   Spec: 12px radius (medium shape)
   ───────────────────────────────────────────────────────────── */

.md3-card {
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: box-shadow var(--transition-fast);
}
.md3-card::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
  border-radius: inherit; pointer-events: none;
}
.md3-card:hover::before  { opacity: .08; }
.md3-card:active::before { opacity: .12; }
.md3-card:focus-visible { outline: 3px solid var(--md-sys-color-secondary); outline-offset: 2px; }

.md3-card--elevated {
  background: var(--md-sys-color-surface-container-low);
  box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3));
}
.md3-card--elevated:hover { box-shadow: var(--md-elev-2, 0 1px 2px rgba(0,0,0,0.3),0 2px 6px 2px rgba(0,0,0,0.15)); }

.md3-card--filled {
  background: var(--md-sys-color-surface-container-highest);
  box-shadow: none;
}

.md3-card--outlined {
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: none;
}
.md3-card--outlined:hover { box-shadow: var(--md-elev-1, 0 1px 2px rgba(0,0,0,0.3)); }

/* ─────────────────────────────────────────────────────────────
   MD3 LINEAR PROGRESS INDICATOR
   Spec: 4px height, primary active, secondary-container track
   ───────────────────────────────────────────────────────────── */

.md3-linear-progress {
  width: 100%; height: 4px; border-radius: 2px;
  background: var(--md-sys-color-secondary-container);
  overflow: hidden; position: relative;
}
.md3-linear-progress__bar {
  height: 100%;
  background: var(--md-sys-color-primary);
  border-radius: 2px;
  transition: width .3s cubic-bezier(.4,0,.2,1);
}
.md3-linear-progress--indeterminate .md3-linear-progress__bar {
  position: absolute;
  width: 40%;
  animation: md3-lin-progress 1.4s infinite cubic-bezier(.4,0,.2,1);
}
@keyframes md3-lin-progress {
  0%   { left: -40%; }
  60%  { left: 100%; }
  100% { left: 100%; }
}

/* ─────────────────────────────────────────────────────────────
   MD3 SECONDARY TABS
   Spec: 48px height, 2px active indicator, label-large (14sp 500)
   ───────────────────────────────────────────────────────────── */

.md3-tab-bar {
  display: flex; align-items: stretch;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none;
}
.md3-tab-bar::-webkit-scrollbar { display: none; }

.md3-tab {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  min-width: 90px;
  height: 48px;
  padding: 0 24px;
  border: none; background: transparent;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.00625em;
  line-height: 20px;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer; white-space: nowrap;
  position: relative;
  overflow: hidden;
  transition: color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.md3-tab::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-tab:hover::before  { opacity: .08; }
.md3-tab:active::before { opacity: .12; }
.md3-tab::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: transparent; border-radius: 2px 2px 0 0;
  transition: background var(--transition-fast);
}
.md3-tab.active {
  color: var(--md-sys-color-primary);
}
.md3-tab.active::after { background: var(--md-sys-color-primary); }

/* Primary tabs variant (with icon above label) */
.md3-tab--primary { min-height: 64px; flex-direction: column; padding: 0 16px; }

/* ─────────────────────────────────────────────────────────────
   MD3 BADGE — Large (with text) and Small (dot)
   ───────────────────────────────────────────────────────────── */

.md3-badge {
  display: inline-flex;
  align-items: center; justify-content: center;
  min-width: 16px; height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.018em;
  line-height: 1;
}
.md3-badge--small {
  width: 6px; height: 6px; min-width: 0;
  padding: 0; border-radius: 50%;
}
/* Semantic variants */
.md3-badge--surface {
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
}
.md3-badge--primary {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.md3-badge--secondary {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

/* ─────────────────────────────────────────────────────────────
   MD3 DIVIDER
   ───────────────────────────────────────────────────────────── */
.md3-divider { height: 1px; background: var(--md-sys-color-outline-variant); border: none; }
.md3-divider--inset { margin-left: 16px; }
.md3-divider--vertical { width: 1px; height: auto; align-self: stretch; }

/* ─────────────────────────────────────────────────────────────
   MD3 SEGMENTED BUTTON
   Spec: 40px height, full radius for group, segments share border
   ───────────────────────────────────────────────────────────── */

.md3-segmented {
  display: inline-flex; align-items: center;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 20px;
  overflow: hidden;
}
.md3-segmented__btn {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  height: 40px; padding: 0 24px;
  border: none; border-right: 1px solid var(--md-sys-color-outline);
  background: transparent;
  font-family: var(--font-family);
  font-size: 14px; font-weight: 500; letter-spacing: 0.00625em;
  color: var(--md-sys-color-on-surface);
  cursor: pointer; white-space: nowrap;
  position: relative; overflow: hidden;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.md3-segmented__btn:last-child { border-right: none; }
.md3-segmented__btn::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-segmented__btn:hover::before  { opacity: .08; }
.md3-segmented__btn:active::before { opacity: .12; }
.md3-segmented__btn.active {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}
.md3-segmented__btn.active::before { background: var(--md-sys-color-on-secondary-container); }

/* ─────────────────────────────────────────────────────────────
   MD3 SWITCH
   Spec: 52×32px track, 28px handle (unsel) → 24px selected
   ───────────────────────────────────────────────────────────── */

.md3-switch {
  display: inline-flex; align-items: center; gap: 12px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.md3-switch__track {
  width: 52px; height: 32px; border-radius: 16px;
  background: var(--md-sys-color-surface-container-highest);
  border: 2px solid var(--md-sys-color-outline);
  position: relative; flex-shrink: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.md3-switch__handle {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--md-sys-color-outline);
  position: absolute; top: 50%; left: 4px;
  transform: translateY(-50%);
  transition: left var(--transition-fast), width var(--transition-fast), height var(--transition-fast), background var(--transition-fast);
}
.md3-switch input[type=checkbox] { display: none; }
.md3-switch input:checked ~ .md3-switch__track {
  background: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}
.md3-switch input:checked ~ .md3-switch__track .md3-switch__handle {
  width: 24px; height: 24px;
  left: calc(100% - 28px);
  background: var(--md-sys-color-on-primary);
}
.md3-switch__label { font-size: 14px; font-weight: 500; color: var(--md-sys-color-on-surface); }

/* ─────────────────────────────────────────────────────────────
   MD3 LIST ITEM
   Spec: min 56px (one-line), 72px (two-line), 88px (three-line)
   ───────────────────────────────────────────────────────────── */

.md3-list-item {
  display: flex; align-items: center; gap: 16px;
  min-height: 56px; padding: 8px 24px 8px 16px;
  cursor: pointer; position: relative; overflow: hidden;
  text-decoration: none; color: var(--md-sys-color-on-surface);
  transition: color var(--transition-fast);
}
.md3-list-item::before {
  content: ''; position: absolute; inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0; transition: opacity var(--transition-fast);
}
.md3-list-item:hover::before  { opacity: .08; }
.md3-list-item:active::before { opacity: .12; }
.md3-list-item.active         { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.md3-list-item__leading { flex-shrink: 0; color: var(--md-sys-color-on-surface-variant); }
.md3-list-item__content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.md3-list-item__headline { font-size: 16px; font-weight: 400; line-height: 24px; letter-spacing: 0.031em; }
.md3-list-item__supporting { font-size: 14px; font-weight: 400; line-height: 20px; letter-spacing: 0.015em; color: var(--md-sys-color-on-surface-variant); }
.md3-list-item__trailing { flex-shrink: 0; color: var(--md-sys-color-on-surface-variant); }

/* ─────────────────────────────────────────────────────────────
   MD3 MENU / SELECT OVERRIDES
   Makes native <select> look like MD3 menu
   ───────────────────────────────────────────────────────────── */

.md3-select {
  appearance: none; -webkit-appearance: none;
  height: 40px; padding: 0 36px 0 16px;
  background: var(--md-sys-color-surface-container)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")
    no-repeat right 12px center;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 4px;
  font-family: var(--font-family);
  font-size: 14px; font-weight: 400; letter-spacing: 0.015em;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: border-color var(--transition-fast);
  outline: none;
}
.md3-select:hover  { border-color: var(--md-sys-color-on-surface); }
.md3-select:focus  { border: 2px solid var(--md-sys-color-primary); padding-left: 15px; }

/* ─────────────────────────────────────────────────────────────
   MD3 SLIDER — overrides the upgraded custom slider
   Spec: 44px touch target, 4px track, 20px thumb
   ───────────────────────────────────────────────────────────── */

.pp-range-wrap {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  flex: 1;
  cursor: pointer;
}
.pp-range-track {
  position: absolute;
  left: 0; right: 0;
  height: 4px;
  background: var(--md-sys-color-secondary-container);
  border-radius: 2px;
  overflow: visible;
  pointer-events: none;
}
.pp-range-fill {
  height: 100%;
  background: var(--md-sys-color-primary);
  border-radius: 2px;
  pointer-events: none;
  transition: width .1s;
}
.pp-range-thumb {
  position: absolute;
  top: 50%;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: left .1s, transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.pp-range-wrap:hover .pp-range-thumb,
.pp-range-dragging .pp-range-thumb { transform: translate(-50%, -50%) scale(1.1); }
input[type=range].pp-range {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  opacity: 0; cursor: pointer; margin: 0;
}

/* ─────────────────────────────────────────────────────────────
   MD3 SIDE PANEL (Settings / Navigation Drawer style)
   Used by PPNavRail
   ───────────────────────────────────────────────────────────── */

.pp-side-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface-container-low);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  overflow: hidden;
  transition: width .25s cubic-bezier(.4,0,.2,1), opacity .2s;
}
.pp-side-panel--collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
  border-right-width: 0;
}
.pp-side-panel-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}
.pp-side-panel-tool-name {
  font-size: 22px; font-weight: 400; line-height: 28px;
  letter-spacing: 0;
  color: var(--md-sys-color-on-surface);
}
.pp-side-panel-subtitle {
  font-size: 12px; font-weight: 500; line-height: 16px;
  letter-spacing: 0.05em;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pp-side-panel-status { margin-top: 8px; }
.pp-side-panel-body {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--md-sys-color-outline-variant) transparent;
}
.pp-side-panel-body::-webkit-scrollbar { width: 4px; }
.pp-side-panel-body::-webkit-scrollbar-track { background: transparent; }
.pp-side-panel-body::-webkit-scrollbar-thumb { background: var(--md-sys-color-outline-variant); border-radius: 2px; }
.pp-side-panel-section {
  padding: 8px 16px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.pp-side-panel-section:last-child { border-bottom: none; }
.pp-side-panel-section-label {
  padding: 10px 0 6px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
}

/* ─────────────────────────────────────────────────────────────
   MD3 MISC UTILITIES
   ───────────────────────────────────────────────────────────── */

/* State layer helper */
.md3-state-layer {
  position: relative; overflow: hidden;
}
.md3-state-layer::before {
  content: ''; position: absolute; inset: 0;
  opacity: 0; transition: opacity var(--transition-fast);
  pointer-events: none;
}

/* Elevation shadows */
.md3-elev-1 { box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15); }
.md3-elev-2 { box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15); }
.md3-elev-3 { box-shadow: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3); }

/* Typography scale helpers */
.md3-display-large  { font-size: 57px; font-weight: 400; line-height: 64px; letter-spacing: -.025em; }
.md3-display-medium { font-size: 45px; font-weight: 400; line-height: 52px; }
.md3-headline-large { font-size: 32px; font-weight: 400; line-height: 40px; }
.md3-headline-medium { font-size: 28px; font-weight: 400; line-height: 36px; }
.md3-headline-small { font-size: 24px; font-weight: 400; line-height: 32px; }
.md3-title-large    { font-size: 22px; font-weight: 400; line-height: 28px; }
.md3-title-medium   { font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: 0.009em; }
.md3-title-small    { font-size: 14px; font-weight: 500; line-height: 20px; letter-spacing: 0.006em; }
.md3-body-large     { font-size: 16px; font-weight: 400; line-height: 24px; letter-spacing: 0.031em; }
.md3-body-medium    { font-size: 14px; font-weight: 400; line-height: 20px; letter-spacing: 0.015em; }
.md3-body-small     { font-size: 12px; font-weight: 400; line-height: 16px; letter-spacing: 0.025em; }
.md3-label-large    { font-size: 14px; font-weight: 500; line-height: 20px; letter-spacing: 0.006em; }
.md3-label-medium   { font-size: 12px; font-weight: 500; line-height: 16px; letter-spacing: 0.031em; }
.md3-label-small    { font-size: 11px; font-weight: 500; line-height: 16px; letter-spacing: 0.045em; }

/* Connection status badge helpers */
.ds-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.ds-badge--waiting      { background: color-mix(in srgb, var(--md-sys-color-outline) 15%, transparent); color: var(--md-sys-color-on-surface-variant); }
.ds-badge--connected    { background: color-mix(in srgb, var(--md-sys-color-secondary) 15%, transparent); color: var(--md-sys-color-secondary); }
.ds-badge--disconnected { background: color-mix(in srgb, var(--md-sys-color-error) 15%, transparent); color: var(--md-sys-color-error); }
.ds-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: md3-badge-pulse 2s ease-in-out infinite; }
.ds-badge--connected .ds-badge-dot { animation: none; }
@keyframes md3-badge-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }

`;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════════════════════

function buildPill(options, onSwitch) {
  const wrap = document.createElement('div');
  wrap.className = 'md3-segmented';
  const btns = {};
  options.forEach(function(opt) {
    const b = document.createElement('button');
    b.className = 'md3-segmented__btn';
    b.textContent = opt.label;
    b.addEventListener('click', function() { setValue(opt.value); onSwitch(opt.value); });
    wrap.appendChild(b);
    btns[opt.value] = b;
  });
  let current = options[0].value;
  function setValue(v, animate) {
    current = v;
    Object.keys(btns).forEach(bv => btns[bv].classList.toggle('active', bv === v));
  }
  setValue(options[0].value, false);
  // expose legacy API
  return {
    el: wrap,
    setValue,
    // legacy support for old pp-ind indicator code
    indEl: null,
  };
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
  const catHeaders = catIndices.map(i => grid[headerRowIdx][i] || '');
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
  return { catIndices, catHeaders, headers, rows, title };
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
    window.TABS = all.filter(s => s.name.includes('TAB'));
    console.log('[utils-shared] Loaded', window.TABS.length, 'tabs');
    if (typeof EmbeddingBridge !== 'undefined') EmbeddingBridge.host();
    if (typeof initEmbeddings  === 'function')  initEmbeddings();
    window.dispatchEvent(new CustomEvent('sheet-loaded', { detail: { tabCount: window.TABS.length } }));
  } catch(e) {
    console.warn('[utils-shared] Data load failed:', e);
    window.dispatchEvent(new CustomEvent('sheet-load-error', { detail: { error: e } }));
  }
})();

// ════════════════════════════════════════════════════════════════
// PP-NAV-RAIL — MD3 Navigation Rail + Side Panel
// ════════════════════════════════════════════════════════════════
window.PPNavRail = (function () {

  var ICON_MENU =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="3" y1="6" x2="21" y2="6"/>' +
    '<line x1="3" y1="12" x2="21" y2="12"/>' +
    '<line x1="3" y1="18" x2="21" y2="18"/>' +
    '</svg>';

  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  function create(paneEl, opts) {
    var toolName      = opts.toolName      || 'Tool';
    var panelSections = opts.panelSections || [];
    var defaultOpen   = opts.defaultOpen !== false;
    var railExtra     = opts.railExtra     || '';

    var sectionsHTML = '';
    panelSections.forEach(function(sec) {
      sectionsHTML +=
        '<div class="pp-side-panel-section">' +
          '<div class="pp-side-panel-section-label">' + sec.label + '</div>' +
          sec.html +
        '</div>';
    });

    paneEl.style.cssText += ';display:flex;flex-direction:row;overflow:hidden;';

    paneEl.innerHTML =
      '<div class="pp-nav-rail">' +
        '<button class="pp-nav-rail-toggle" title="Toggle controls" aria-label="Toggle panel">' +
          (defaultOpen ? ICON_CLOSE : ICON_MENU) +
        '</button>' +
        railExtra +
      '</div>' +
      '<div class="pp-side-panel' + (defaultOpen ? '' : ' pp-side-panel--collapsed') + '">' +
        '<div class="pp-side-panel-header">' +
          '<div class="pp-side-panel-tool-name">' + toolName + '</div>' +
          '<div class="pp-side-panel-subtitle">Loading\u2026</div>' +
          '<div class="pp-side-panel-status"></div>' +
        '</div>' +
        '<div class="pp-side-panel-body">' + sectionsHTML + '</div>' +
      '</div>' +
      '<div class="pp-tool-main"></div>';

    var railEl     = paneEl.querySelector('.pp-nav-rail');
    var toggleBtn  = paneEl.querySelector('.pp-nav-rail-toggle');
    var panel      = paneEl.querySelector('.pp-side-panel');
    var mainEl     = paneEl.querySelector('.pp-tool-main');
    var subtitleEl = panel.querySelector('.pp-side-panel-subtitle');
    var statusEl   = panel.querySelector('.pp-side-panel-status');

    var open = defaultOpen;
    toggleBtn.addEventListener('click', function() {
      open = !open;
      panel.classList.toggle('pp-side-panel--collapsed', !open);
      toggleBtn.innerHTML = open ? ICON_CLOSE : ICON_MENU;
    });

    return {
      railEl:     railEl,
      panelEl:    panel,
      mainEl:     mainEl,
      subtitleEl: subtitleEl,
      statusEl:   statusEl,
    };
  }

  return { create: create };
})();

// ── Tool nav injector ─────────────────────────────────────────
// Creates MD3 Navigation Rail items with icon + label
window.injectToolNav = function(currentTool) {
  var tools = [
    { href: 'spreadsheet.html',  label: 'Spreadsheet',
      d: '<rect x="1.5" y="1.5" width="15" height="15" rx="2"/><line x1="1.5" y1="6.5" x2="16.5" y2="6.5"/><line x1="1.5" y1="11.5" x2="16.5" y2="11.5"/><line x1="7" y1="6.5" x2="7" y2="16.5"/><line x1="12" y1="6.5" x2="12" y2="16.5"/>' },
    { href: 'find-matches.html', label: 'Find',
      d: '<circle cx="8" cy="8" r="5.5"/><line x1="12.5" y1="12.5" x2="16.5" y2="16.5"/>' },
    { href: 'concept-map.html',  label: 'Concept Map',
      d: '<circle cx="9" cy="4" r="2"/><circle cx="3.5" cy="14" r="2"/><circle cx="9" cy="14" r="2"/><circle cx="14.5" cy="14" r="2"/><line x1="9" y1="6" x2="3.5" y2="12"/><line x1="9" y1="6" x2="9" y2="12"/><line x1="9" y1="6" x2="14.5" y2="12"/>' },
    { href: 'clusters.html',     label: 'Clusters',
      d: '<circle cx="5" cy="5" r="3"/><circle cx="13" cy="5" r="3"/><circle cx="5" cy="13" r="3"/><circle cx="13" cy="13" r="3"/>' }
  ];
  var rail = document.querySelector('.pp-nav-rail');
  if (!rail) return;

  // Spacer pushes nav items to bottom
  var spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';
  rail.appendChild(spacer);

  tools.forEach(function(t) {
    var a = document.createElement('a');
    a.className = 'pp-nav-item' + (t.href === currentTool ? ' active' : '');
    a.href = t.href;
    a.title = t.label;

    // MD3 active indicator wraps the icon
    var indicator = document.createElement('div');
    indicator.className = 'pp-nav-item-indicator';

    var iconWrap = document.createElement('div');
    iconWrap.className = 'pp-nav-item-icon';
    iconWrap.innerHTML =
      '<svg viewBox="0 0 18 18" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + t.d + '</svg>';

    indicator.appendChild(iconWrap);

    var label = document.createElement('span');
    label.className = 'pp-nav-item-label';
    label.textContent = t.label;

    a.appendChild(indicator);
    a.appendChild(label);

    a.addEventListener('click', function(e) { e.stopPropagation(); });
    rail.appendChild(a);
  });
};
