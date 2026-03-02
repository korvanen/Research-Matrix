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

// ── PASTE panelExtractKW HERE ────────────────────────────────────────────────
//
// function panelExtractKW(text) { ... }
//
// Takes a raw cell string, returns an array of normalised keyword tokens.
// This is the primary function you will iterate on.
//
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
