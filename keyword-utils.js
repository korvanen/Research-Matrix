// ════════════════════════════════════════════════════════════════════════════
// keyword-utils.js — Keyword extraction, indexing and match-search algorithm
// ════════════════════════════════════════════════════════════════════════════

// Minimum word length for a token to be treated as a keyword.
// Note: PANEL_MIN_SHARED is defined in panel-find-matches.js
const PANEL_KW_MIN_WORD_LEN = 4;

// ── Stop words ───────────────────────────────────────────────────────────────
const PANEL_STOP_WORDS = new Set([
  // Academic & Logic Fluff
'study', 'research', 'analysis', 'paper', 'article', 'theory', 'concept', 'model', 
'system', 'process', 'result', 'data', 'using', 'based', 'approach', 'within', 
'among', 'between', 'also', 'often', 'likely', 'potential', 'impact', 'development',
// Over-used Domain Fluff (High-frequency, low-meaning in this context)
'cohousing', 'housing', 'living', 'social', 'community', 'urban', 'people', 'resident'
]);

// ── Keyword extraction ────────────────────────────────────────────────────────
function panelExtractKW(text) {
  return [...new Set(
    String(text).toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= PANEL_KW_MIN_WORD_LEN)
    .map(w => {
      // Basic English Stemming (Suffix stripping)
      return w
        .replace(/ies$/, 'y')    // communities -> community
        .replace(/s$/, '')       // residents -> resident
        .replace(/ing$/, '')     // planning -> plan
        .replace(/ed$/, '');     // used -> us
    })
    .filter(w => !PANEL_STOP_WORDS.has(w))
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
  const allRows = buildRowIndex();
  
  // 1. Calculate "Global Frequency" of every word in your matrix
  const globalFreq = {};
  allRows.forEach(row => {
    row.kws.forEach(kw => {
      globalFreq[kw] = (globalFreq[kw] || 0) + 1;
    });
  });

  const matches = [];
  allRows.forEach(entry => {
    if (entry.tabIdx === seedTabIdx && entry.rowIdx === seedRowIdx) return;

    // 2. Find shared words
    const shared = [...seedKws].filter(k => entry.kws.has(k));
    
    // 3. Calculate a "Match Score" based on rarity
    // A word appearing in 2 rows is worth more than a word appearing in 50.
    let score = 0;
    shared.forEach(kw => {
      score += (1 / (globalFreq[kw] || 1)); 
    });

    if (shared.length >= PANEL_MIN_SHARED) {
      matches.push({ ...entry, shared, score });
    }
  });

  // Sort by weighted score, not just raw count
  return matches.sort((a, b) => b.score - a.score);
}
