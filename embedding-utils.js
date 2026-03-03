// ════════════════════════════════════════════════════════════════════════════
// embedding-utils.js — Local semantic embeddings via Transformers.js
//
// Loaded as <script type="module"> so it can use ES imports.
// Exposes window.EmbeddingUtils for the rest of the (non-module) app.
// ════════════════════════════════════════════════════════════════════════════

import { pipeline, env }
  from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const CACHE_PREFIX    = 'pp_emb_v1_';

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

      // ── KEY FIX ──────────────────────────────────────────────────────────
      // The module script runs after the regular scripts, so EmbeddingUtils
      // wasn't on window when script.js called initEmbeddings(). We call it
      // here now that both the model AND the app data are ready.
      if (typeof initEmbeddings === 'function') {
        console.log('[embedding-utils] Calling initEmbeddings() now model is ready');
        initEmbeddings();
      }

      return model;
    })
    .catch(err => {
      _loadPromise = null; // allow retry
      console.warn('[embedding-utils] Model load failed:', err);
      throw err;
    });

  return _loadPromise;
}

// ── The swappable embedding abstraction ───────────────────────────────────────
async function getEmbedding(text) {
  const embedder = await _loadEmbedder();
  const output   = await embedder(text, { pooling: 'mean', normalize: true });
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
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
  console.log('[embedding-utils] Cache cleared (storage full)');
}

// ── Public: get embedding with caching ───────────────────────────────────────
async function getCachedEmbedding(text) {
  const cached = _cacheGet(text);
  if (cached) return cached;
  const vector = await getEmbedding(text);
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

  for (let i = 0; i < total; i++) {
    const row  = rows[i];
    const text = (row.cells || []).join(' ').trim();
    if (!text) continue;

    try {
      const vector = await getCachedEmbedding(text);
      vectors.set(row.tabIdx + ':' + row.rowIdx, vector);
    } catch (err) {
      console.warn('[embedding-utils] Failed to embed row', row.tabIdx, row.rowIdx, err);
    }

    window.dispatchEvent(new CustomEvent('embedding-progress', {
      detail: { done: i + 1, total, pct: Math.round((i + 1) / total * 100) }
    }));
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

// Start downloading the model immediately in the background.
_loadEmbedder().catch(() => {/* already warned above */});
