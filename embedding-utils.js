// ════════════════════════════════════════════════════════════════════════════
// embedding-utils.js — Local semantic embeddings via Transformers.js
//
// Loaded as <script type="module"> so it can use ES imports.
// Exposes window.EmbeddingUtils for the rest of the (non-module) app.
//
// TO SWITCH TO AN API LATER: replace only getEmbedding() below.
// Everything else — caching, scoring, match logic — stays identical.
// ════════════════════════════════════════════════════════════════════════════

import { pipeline, env }
  from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Use CDN-hosted model weights, not local files
env.allowLocalModels = false;

const EMBEDDING_MODEL    = 'Xenova/all-MiniLM-L6-v2'; // ~23 MB, downloads once
const CACHE_PREFIX       = 'pp_emb_v1_';               // bump suffix to bust cache
const EMBEDDING_DIM      = 384;                        // all-MiniLM-L6-v2 output size

// ── Model loader ──────────────────────────────────────────────────────────────
let _embedder     = null;
let _loadPromise  = null;

async function _loadEmbedder() {
  if (_embedder) return _embedder;
  if (_loadPromise) return _loadPromise;

  _loadPromise = pipeline('feature-extraction', EMBEDDING_MODEL, { quantized: true })
    .then(model => {
      _embedder = model;
      window.dispatchEvent(new CustomEvent('embedder-ready'));
      console.log('[embedding-utils] Model ready');
      return model;
    })
    .catch(err => {
      _loadPromise = null; // allow retry
      console.warn('[embedding-utils] Model load failed:', err);
      throw err;
    });

  return _loadPromise;
}

// ════════════════════════════════════════════════════════════════════════════
// ── THE SWAPPABLE ABSTRACTION ─────────────────────────────────────────────
// This is the ONLY function you replace when switching to a paid API.
// It receives a plain text string and must return a Float32Array or Array
// of numbers (the embedding vector), normalised to unit length.
//
// Future OpenAI swap example:
//   async function getEmbedding(text) {
//     const res = await fetch('https://api.openai.com/v1/embeddings', {
//       method: 'POST',
//       headers: { 'Authorization': 'Bearer YOUR_KEY', 'Content-Type': 'application/json' },
//       body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
//     });
//     const data = await res.json();
//     return data.data[0].embedding;
//   }
// ════════════════════════════════════════════════════════════════════════════
async function getEmbedding(text) {
  const embedder = await _loadEmbedder();
  const output   = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ── Simple stable hash for cache keys ────────────────────────────────────────
function _hashText(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ── localStorage cache ────────────────────────────────────────────────────────
// Key: hash of the text content — stable regardless of row position.
// If the text of a cell changes, it gets a new hash and re-embeds automatically.
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
    // localStorage full — evict all embedding entries and retry once
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
// Both vectors must be unit-normalised (which all-MiniLM-L6-v2 + normalize:true gives us).
// Result is in [-1, 1]; in practice for sentence similarity it's always [0, 1].
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot)); // clamp for float precision
}

// ── Embed all rows incrementally ──────────────────────────────────────────────
// Processes rows one-by-one so cached rows are instant and only new/changed
// rows hit the model. Fires 'embedding-progress' events for UI feedback.
// Returns a Map of 'tabIdx:rowIdx' -> vector.
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
  getEmbedding,         // raw (no cache) — use for single ad-hoc calls
  getCachedEmbedding,   // cached — use for bulk/repeated calls
  cosineSimilarity,
  embedAllRows,
  isReady: () => !!_embedder,
  clearCache: _cacheClear,
};

// Kick off model download immediately in the background so it's ready
// by the time the user clicks their first cell.
_loadEmbedder().catch(() => {/* already warned above */});
