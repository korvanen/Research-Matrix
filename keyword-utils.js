// ════════════════════════════════════════════════════════════════════════════
// keyword-utils.js — Keyword extraction + hybrid semantic match finder
// ════════════════════════════════════════════════════════════════════════════
console.log("utils are updated")
const PANEL_KW_MIN_WORD_LEN    = 2;
const PANEL_KW_MIN_PHRASE_WORDS = 2;
const PANEL_KW_NGRAM_SIZES     = [2];

// ── Scoring weights ───────────────────────────────────────────────────────────
const _DEFAULT_KEYWORD_WEIGHT   = 0.35;
const _DEFAULT_EMBEDDING_WEIGHT = 0.65;

let _activeKeywordWeight   = _DEFAULT_KEYWORD_WEIGHT;
let _activeEmbeddingWeight = _DEFAULT_EMBEDDING_WEIGHT;

function setMatchWeights(kw, emb) {
  _activeKeywordWeight   = kw;
  _activeEmbeddingWeight = emb;
}

const EMBEDDING_SIMILARITY_THRESHOLD = 0.45;

// ── Stop words ────────────────────────────────────────────────────────────────
const PANEL_STOP_WORDS = new Set([
  'with', 'high',
  'study', 'research', 'analysis', 'paper', 'article', 'theory', 'concept', 'model',
  'system', 'process', 'result', 'data', 'using', 'based', 'approach', 'within',
  'among', 'between', 'also', 'often', 'likely', 'potential', 'impact', 'development',
  'cohousing', 'housing', 'living', 'social', 'community', 'urban', 'people', 'resident'
]);

const PANEL_STOP_PHRASES = new Set([]);

// ── Normalisation helpers ─────────────────────────────────────────────────────
function normalizeToken(w) {
  let t = String(w).toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return '';
  t = t
    .replace(/ies$/, 'y')
    .replace(/ing$/, '')
    .replace(/ed$/,  '')
    .replace(/s$/,   '');
  return t;
}

function extractTokens(text) {
  const raw = String(text)
    .replace(/"|"/g, '"')
    .replace(/[^a-zA-Z0-9"''\s]/g, ' ');

  const quoted = [];
  raw.replace(/"([^"]+)"/g, (_, phrase) => { quoted.push(phrase.trim()); return ''; });

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
      if (slice.some(t => t.length < PANEL_KW_MIN_WORD_LEN || PANEL_STOP_WORDS.has(t))) continue;
      const phrase = slice.join(' ');
      if (!PANEL_STOP_PHRASES.has(phrase)) phrases.push(phrase);
    }
  }
  return phrases;
}

function panelExtractKW(text) {
  const { tokens, quoted } = extractTokens(text);

  const normalizedQuoted = quoted
    .map(q => q.split(/\s+/).map(normalizeToken).filter(Boolean))
    .filter(arr => arr.length >= PANEL_KW_MIN_PHRASE_WORDS)
    .map(arr => arr.filter(t => t.length >= PANEL_KW_MIN_WORD_LEN && !PANEL_STOP_WORDS.has(t)))
    .filter(arr => arr.length >= PANEL_KW_MIN_PHRASE_WORDS)
    .map(arr => arr.join(' '))
    .filter(p => !PANEL_STOP_PHRASES.has(p));

  const ngramPhrases = makeNgrams(tokens, PANEL_KW_NGRAM_SIZES);
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
        tabIdx, rowIdx, row,
        headers: data.headers,
        title:   data.title || tab.name,
        kws:     new Set(panelExtractKW(text)),
      });
    });
  });
  return rows;
}

// ── Embedding vector store ────────────────────────────────────────────────────
let _embeddingVectors = new Map();
let _embeddingsReady  = false;

async function initEmbeddings() {
  if (!window.EmbeddingUtils) {
    console.warn('[keyword-utils] EmbeddingUtils not available — keyword-only mode');
    return;
  }

  const rows = buildRowIndex();
  if (!rows.length) {
    console.warn('[keyword-utils] No rows to embed — TABS may not be loaded yet');
    return;
  }

  console.log(`[keyword-utils] Embedding ${rows.length} rows in background…`);
  _embeddingVectors = await window.EmbeddingUtils.embedAllRows(rows);
  _embeddingsReady  = true;
  console.log(`[keyword-utils] Embeddings ready (${_embeddingVectors.size} rows)`);

  // ── KEY FIX: tell the sidebar to re-render the current selection now
  // that real embScore values are available. Without this, cards rendered
  // before embeddings finished always show "model not ready".
  document.dispatchEvent(new CustomEvent('embeddings-ready', { bubbles: true }));
}

// ── Hybrid match finder ───────────────────────────────────────────────────────
function findMatches(seedKws, seedTabIdx, seedRowIdx, excludeSet) {
  const allRows = buildRowIndex();
  const seedKey = seedTabIdx + ':' + seedRowIdx;
  const seedVec = _embeddingsReady ? _embeddingVectors.get(seedKey) : null;

  const excluded = new Set(excludeSet || []);
  excluded.add(seedKey);

  const globalFreq = {};
  allRows.forEach(row => {
    row.kws.forEach(kw => { globalFreq[kw] = (globalFreq[kw] || 0) + 1; });
  });

  const candidates = [];

  allRows.forEach(entry => {
    if (excluded.has(entry.tabIdx + ':' + entry.rowIdx)) return;

    const shared = [...seedKws].filter(k => entry.kws.has(k));
    let kwScore = 0;
    shared.forEach(kw => { kwScore += 1 / (globalFreq[kw] || 1); });
    const hasKeywordMatch = shared.length >= PANEL_MIN_SHARED;

    let embScore = 0;
    if (seedVec) {
      const entryVec = _embeddingVectors.get(entry.tabIdx + ':' + entry.rowIdx);
      if (entryVec) {
        embScore = window.EmbeddingUtils.cosineSimilarity(seedVec, entryVec);
      }
    }
    const hasEmbeddingMatch = embScore >= EMBEDDING_SIMILARITY_THRESHOLD;

    if (!hasKeywordMatch && !hasEmbeddingMatch) return;

    candidates.push({ ...entry, shared, kwScore, embScore });
  });

  if (!candidates.length) return [];

  const maxKw = Math.max(...candidates.map(c => c.kwScore), 1e-9);
  candidates.forEach(c => {
    const normKw   = c.kwScore / maxKw;
    const kwContrib  = normKw   * _activeKeywordWeight;
    const embContrib = c.embScore * _activeEmbeddingWeight;
    c.normKwScore = normKw;
    c.kwContrib   = kwContrib;
    c.embContrib  = embContrib;
    c.score = kwContrib + embContrib;
  });

  return candidates.sort((a, b) => b.score - a.score);
}
