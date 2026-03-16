// ════════════════════════════════════════════════════════════════════════════
// utils-embedding.js — Local semantic embeddings via Transformers.js
// Loaded as <scriptlll type="module">; exposes window.EmbeddingUtils globally.
// ════════════════════════════════════════════════════════════════════════════

import { pipeline, env }
  from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;

const EMBEDDING_MODEL = 'Xenova/specter2';
const CACHE_PREFIX = 'pp_emb_v2_';

// ── Model loader ──────────────────────────────────────────────────────────────
let _embedder    = null;
let _loadPromise = null;

async function _loadEmbedder() {
  if (_embedder) return _embedder;
  if (_loadPromise) return _loadPromise;

  _loadPromise = pipeline('feature-extraction', EMBEDDING_MODEL, { quantized: true })
    .then(model => {
      _embedder = model;
      window.dispatchEvent(new CustomEvent('embedder-ready'));
      console.log('[embedding-utils] Model ready');

      // Call initEmbeddings now that both the model and app data are available.
      // The module loads after regular scripts, so EmbeddingUtils wasn't on
      // window when script.js tried to call initEmbeddings() at startup.
      if (typeof initEmbeddings === 'function') {
        console.log('[embedding-utils] Calling initEmbeddings()');
        initEmbeddings();
      }

      return model;
    })
    .catch(err => {
      _loadPromise = null;
      console.warn('[embedding-utils] Model load failed:', err);
      throw err;
    });

  return _loadPromise;
}

// ── Embedding (the only function to swap when changing providers) ─────────────
async function getEmbedding(text) {
  const embedder = await _loadEmbedder();
  // pipeline() returns a Tensor-like object; .data is the flat Float32Array
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  if (!output || !output.data) {
    throw new Error('[embedding-utils] getEmbedding: unexpected output shape — ' + JSON.stringify(output));
  }
  return Array.from(output.data);
}

// ── Stable hash for cache keys ────────────────────────────────────────────────
function _hashText(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ── localStorage cache ────────────────────────────────────────────────────────
function _cacheGet(text) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + _hashText(text));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate: must be a non-empty array of numbers
    if (!Array.isArray(parsed) || !parsed.length || typeof parsed[0] !== 'number') {
      console.warn('[embedding-utils] Cache entry corrupt, ignoring');
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[embedding-utils] _cacheGet error:', e);
    return null;
  }
}

function _cacheSet(text, vector) {
  try {
    localStorage.setItem(CACHE_PREFIX + _hashText(text), JSON.stringify(vector));
  } catch {
    _cacheClear();
    try { localStorage.setItem(CACHE_PREFIX + _hashText(text), JSON.stringify(vector)); } catch {}
  }
}

function _cacheClear() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX))
    .forEach(k => localStorage.removeItem(k));
  console.log('[embedding-utils] Cache cleared');
}

// ── Public: get embedding with caching ───────────────────────────────────────
async function getCachedEmbedding(text) {
  const cached = _cacheGet(text);
  if (cached) return cached;
  const vector = await getEmbedding(text); // throws on failure — caller handles
  _cacheSet(text, vector);
  return vector;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

// ── Embed all rows incrementally ──────────────────────────────────────────────
async function embedAllRows(rows) {
  const vectors = new Map();
  const total   = rows.length;
  let failures  = 0;

  for (let i = 0; i < total; i++) {
    const row  = rows[i];
    // buildRowIndex() nests the sheet row under .row — cells live at row.row.cells
    const cells = (row.row && row.row.cells) ? row.row.cells : (row.cells || []);
    const text = cells.join(' ').trim();
    if (!text) continue;

    try {
      const vector = await getCachedEmbedding(text);
      if (!vector || !vector.length) {
        console.warn(`[embedding-utils] Row ${i} returned empty vector, skipping`);
        failures++;
        continue;
      }
      vectors.set(row.tabIdx + ':' + row.rowIdx, vector);
    } catch (err) {
      failures++;
      // Log first 3 failures in full; after that just count them
      if (failures <= 3) {
        console.error(`[embedding-utils] Failed to embed row ${row.tabIdx}:${row.rowIdx}:`, err);
        console.error('  text sample:', JSON.stringify(text.slice(0, 80)));
      }
    }

    window.dispatchEvent(new CustomEvent('embedding-progress', {
      detail: { done: i + 1, total, pct: Math.round((i + 1) / total * 100) }
    }));
  }

  if (failures > 0) {
    console.warn(`[embedding-utils] embedAllRows: ${failures}/${total} rows failed`);
  }

  window.dispatchEvent(new CustomEvent('embedding-complete', { detail: { total: vectors.size } }));
  return vectors;
}

// ── Expose to global scope ────────────────────────────────────────────────────
window.EmbeddingUtils = {
  getEmbedding,
  getCachedEmbedding,
  cosineSimilarity,
  embedAllRows,
  isReady: () => !!_embedder,
  clearCache: _cacheClear,
};

// Start downloading the model in the background immediately.
_loadEmbedder().catch(() => {/* already warned above */});
