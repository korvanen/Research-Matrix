// ════════════════════════════════════════════════════════════════════════════
// keyword-utils.js — Multi-word (phrase) keyword extraction with n-grams
// ════════════════════════════════════════════════════════════════════════════

// Minimum per-token length inside a phrase
const PANEL_KW_MIN_WORD_LEN = 4;

// Minimum number of words in a keyword phrase (set to 2 or 3 as you need)
const PANEL_KW_MIN_PHRASE_WORDS = 1; // or 3

// Which n-gram sizes to build. If you want only 2- or 3-word phrases:
const PANEL_KW_NGRAM_SIZES = [1,2]; // do NOT include 1

// ── Stop words ───────────────────────────────────────────────────────────────
const PANEL_STOP_WORDS = new Set([
  // Common words unrelated to the topic
  'with', 'high', 
  // Academic & Logic Fluff
  'study', 'research', 'analysis', 'paper', 'article', 'theory', 'concept', 'model',
  'system', 'process', 'result', 'data', 'using', 'based', 'approach', 'within',
  'among', 'between', 'also', 'often', 'likely', 'potential', 'impact', 'development',
  // Over-used Domain Fluff (High-frequency, low-meaning in this context)
  'cohousing', 'housing', 'living', 'social', 'community', 'urban', 'people', 'resident'
]);

// Optional: stop-phrases (exact multi-word sequences to ignore)
const PANEL_STOP_PHRASES = new Set([
  // e.g., 'in conclusion', 'as well as'
]);

// ── Normalization helpers ────────────────────────────────────────────────────
function normalizeToken(w) {
  // Lowercase, strip non-letters
  let t = String(w).toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return '';

  // Very-light stemming (order matters)
  t = t
    .replace(/ies$/, 'y')   // communities -> community
    .replace(/ing$/, '')    // planning -> plan
    .replace(/ed$/, '')     // used -> us
    .replace(/s$/, '');     // residents -> resident (after other rules)
  return t;
}

function extractTokens(text) {
  const raw = String(text)
    // Preserve quoted phrases by temporarily marking them (we’ll re-add them later)
    .replace(/“|”/g, '"')
    .replace(/[^a-zA-Z0-9"’‘\s]/g, ' ');
  
  // Capture quoted multi-word phrases before tokenization
  const quoted = [];
  raw.replace(/"([^"]+)"/g, (_, phrase) => {
    quoted.push(phrase.trim());
    return '';
  });

  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(t => t && t.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(t));

  return { tokens, quoted };
}

function makeNgrams(tokens, sizes) {
  const phrases = [];
  for (const n of sizes) {
    if (n < PANEL_KW_MIN_PHRASE_WORDS) continue;
    for (let i = 0; i <= tokens.length - n; i++) {
      const slice = tokens.slice(i, i + n);
      // Enforce per-token length and stop-word exclusion
      if (slice.some(t => t.length < PANEL_KW_MIN_WORD_LEN || PANEL_STOP_WORDS.has(t))) {
        continue;
      }
      const phrase = slice.join(' ');
      if (!PANEL_STOP_PHRASES.has(phrase)) {
        phrases.push(phrase);
      }
    }
  }
  return phrases;
}

// ── Keyword extraction (phrases only) ────────────────────────────────────────
function panelExtractKW(text) {
  const { tokens, quoted } = extractTokens(text);

  // Normalize quoted phrases into token sequences and filter
  const normalizedQuoted = quoted
    .map(q => q.split(/\s+/).map(normalizeToken).filter(Boolean))
    .filter(arr => arr.length >= PANEL_KW_MIN_PHRASE_WORDS)
    .map(arr => arr.filter(t => t.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(t)))
    .filter(arr => arr.length >= PANEL_KW_MIN_PHRASE_WORDS)
    .map(arr => arr.join(' '))
    .filter(p => !PANEL_STOP_PHRASES.has(p));

  // Build n-gram phrases (2-grams, 3-grams, etc.)
  const ngramPhrases = makeNgrams(tokens, PANEL_KW_NGRAM_SIZES);

  // Return unique set of phrases
  return [...new Set([...normalizedQuoted, ...ngramPhrases])];
}

// ── Row index builder ─────────────────────────────────────────────────────────
function buildRowIndex() {
  if (typeof TABS === 'undefined' || !TABS.length) return [];
  const rows = [];
  TABS.forEach((tab, tabIdx) => {
    const data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data) return;
    data.rows.forEach((row, rowIdx) => {
      const text = row.cells.join(' ');
      rows.push({
        tabIdx,
        rowIdx,
        row,
        headers: data.headers,
        title: data.title || tab.name,
        // NOTE: kws now contains multi-word phrases only
        kws: new Set(panelExtractKW(text))
      });
    });
  });
  return rows;
}

// ── Match finder (unchanged, works with phrase keys) ─────────────────────────
function findMatches(seedKws, seedTabIdx, seedRowIdx) {
  const allRows = buildRowIndex();

  // 1. Global frequency of phrases
  const globalFreq = {};
  allRows.forEach(row => {
    row.kws.forEach(kw => {
      globalFreq[kw] = (globalFreq[kw] || 0) + 1;
    });
  });

  const matches = [];
  allRows.forEach(entry => {
    if (entry.tabIdx === seedTabIdx && entry.rowIdx === seedRowIdx) return;

    // 2. Shared phrases
    const shared = [...seedKws].filter(k => entry.kws.has(k));

    // 3. Score by rarity (phrases in fewer rows are more informative)
    let score = 0;
    shared.forEach(kw => {
      score += (1 / (globalFreq[kw] || 1));
    });

    if (shared.length >= PANEL_MIN_SHARED) {
      matches.push({ ...entry, shared, score });
    }
  });

  return matches.sort((a, b) => b.score - a.score);
}
