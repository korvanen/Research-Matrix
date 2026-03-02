// ════════════════════════════════════════════════════════════════════════════
// keyword-utils.js — Keyword extraction, indexing and match-search algorithm
//
// ── HOW TO COMPLETE THIS FILE ────────────────────────────────────────────────
// Cut the following three functions out of panel-utils.js and paste them here:
//
//   • panelExtractKW(text)          — tokenises text → array of keyword strings
//   • buildRowIndex(tabIdx, data)   — builds a Map of keyword → Set<rowIdx>
//   • findMatches(seedKws, srcTabIdx, srcRowIdx) → array of match objects
//
// Once moved, remove them from panel-utils.js and update its header comment.
//
// ── DEPENDENCIES ─────────────────────────────────────────────────────────────
// This file is intentionally dependency-free. It should only use:
//   • TABS / processSheetData  (from script.js, loaded before this)
//   • PANEL_MIN_SHARED         (constant defined below — was previously in panel.js)
//
// ── LOAD ORDER ───────────────────────────────────────────────────────────────
//   1. script.js         (provides TABS, processSheetData)
//   2. keyword-utils.js  ← this file
//   3. panel-utils.js
//   4. panel-find-matches.js
//   5. panel-keywords.js
//   6. panel.js
// ════════════════════════════════════════════════════════════════════════════

// Minimum shared keywords required for a row to count as a match.
// Centralised here so both find-matches and future keyword tools share it.
const KW_MIN_SHARED = 2;

// Minimum word length for a token to be treated as a keyword.
const KW_MIN_WORD_LEN = 4;

// ── Stop words ───────────────────────────────────────────────────────────────
// Words excluded from keyword extraction regardless of length.
// Extend this list freely — it is the primary tuning lever for match quality.
const PANEL_STOP_WORDS = new Set([
  'that','this','with','from','have','they','will','been','were','their',
  'when','also','into','more','than','then','some','what','there','which',
  'about','these','other','would','could','should','through','where','those',
  'building','built','environment','architecture','architectural','planning',
  'residential','area','part','time','work','using','used','only','within',
  'between','among','example','context','claim','housing','where','rarely',
]);

// ── Keyword extraction ────────────────────────────────────────────────────────
// Takes a raw cell string, returns a deduplicated array of normalised tokens.
// This is the primary function to iterate on when improving match quality:
//   • adjust KW_MIN_WORD_LEN
//   • expand / shrink PANEL_STOP_WORDS
//   • swap the naive suffix-strip for a proper stemmer
//   • add phrase detection, domain-specific synonyms, etc.
function panelExtractKW(text) {
  return [...new Set(
    String(text).toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(w))
      // Naive plural normalisation: strip trailing -s unless the word ends in -ss
      .map(w => w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  )];
}

// ── PASTE buildRowIndex HERE ─────────────────────────────────────────────────
//
// function buildRowIndex(tabIdx, data) { ... }
//
// Builds an inverted index: Map<keyword, Set<rowIdx>> for one sheet's data.
// Cache the result per-tab if performance matters for large sheets.
//
// ── PASTE findMatches HERE ───────────────────────────────────────────────────
//
// function findMatches(seedKws, srcTabIdx, srcRowIdx) { ... }
//
// Given a seed keyword Set, searches all tabs and returns match objects:
//   { tabIdx, rowIdx, row, headers, shared: Set<keyword>, title }
// Excludes the source row itself. Requires at least KW_MIN_SHARED keywords
// in common to count as a match.
