// ════════════════════════════════════════════════════════════════════════════
// keyword-utils.js — Keyword extraction, indexing and match-search algorithm
// ════════════════════════════════════════════════════════════════════════════

// Minimum shared keywords required for a row to count as a match.
const PANEL_MIN_SHARED = 2;

// Minimum word length for a token to be treated as a keyword.
const PANEL_KW_MIN_WORD_LEN = 4;

// ── Stop words ───────────────────────────────────────────────────────────────
const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── Keyword extraction ────────────────────────────────────────────────────────
function panelExtractKW(text) {
  return [...new Set(
    String(text).toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(w))
      .map(w => w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  )];
}

// ── Row index builder ─────────────────────────────────────────────────────────
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

// ── Match finder ──────────────────────────────────────────────────────────────
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
