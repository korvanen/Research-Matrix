// embedding-bridge.js — sessionStorage bridge for sharing embeddings
// Reads vectors from the same localStorage cache that embedding-utils.js writes,
// then saves complete rows+vecs to sessionStorage for tool pages to consume.
// ─────────────────────────────────────────────────────────────────────────────

window.EmbeddingBridge = (function () {
  var STORAGE_KEY  = 'pp-embeddings';
  var CACHE_PREFIX = 'pp_emb_v1_';   // must match embedding-utils.js

  // ── Same hash function as embedding-utils.js ─────────────────────────────
  function hashText(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  // ── Look up a cached vector from localStorage by cell text ───────────────
  function getVecFromCache(text) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + hashText(text));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return null;
      return new Float32Array(parsed);
    } catch (e) {
      return null;
    }
  }

  // ── Serialise for sessionStorage ─────────────────────────────────────────
  function serialize(rows) {
    return rows.map(function (r) {
      return {
        tabIdx:  r.tabIdx,
        rowIdx:  r.rowIdx,
        row:     r.row,
        headers: r.headers || [],
        title:   r.title   || '',
        vec:     r.vec ? Array.from(r.vec) : null,
      };
    });
  }

  // ── Deserialise from sessionStorage ──────────────────────────────────────
  function deserialize(rows) {
    return rows.map(function (r) {
      return Object.assign({}, r, {
        vec: r.vec ? new Float32Array(r.vec) : null,
      });
    });
  }

  // ── Build embedded rows from buildRowIndex() + localStorage cache ─────────
  function buildEmbeddedRows() {
    if (typeof buildRowIndex !== 'function') return [];
    var rows = buildRowIndex();
    var embedded = [];
    rows.forEach(function (r) {
      var cells = (r.row && r.row.cells) ? r.row.cells : (r.cells || []);
      var text  = cells.join(' ').trim();
      if (!text) return;
      var vec = getVecFromCache(text);
      if (vec) embedded.push(Object.assign({}, r, { vec: vec }));
    });
    return embedded;
  }

  // ── Save to sessionStorage ────────────────────────────────────────────────
  function save(rows) {
    try {
      var json = JSON.stringify(serialize(rows));
      sessionStorage.setItem(STORAGE_KEY, json);
      console.log('[EmbeddingBridge] saved ' + rows.length + ' rows (' + (json.length / 1024).toFixed(1) + ' KB)');
    } catch (e) {
      // Quota exceeded — try saving without vectors
      console.warn('[EmbeddingBridge] quota exceeded, saving without vectors');
      try {
        var slim = serialize(rows).map(function (r) {
          return Object.assign({}, r, { vec: null });
        });
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      } catch (e2) {
        console.error('[EmbeddingBridge] sessionStorage full:', e2.message);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOST — call once on index.html
  // ══════════════════════════════════════════════════════════════════════════
  function host() {
    function buildAndSave() {
      var rows = buildEmbeddedRows();
      if (rows.length) save(rows);
    }

    // Save when embeddings finish
    window.addEventListener('embedding-complete', function () {
      setTimeout(buildAndSave, 150);
    });

    // Also save when the embedder becomes ready (handles page reloads where
    // all vectors were already cached in localStorage)
    window.addEventListener('embedder-ready', function () {
      setTimeout(buildAndSave, 300);
    });

    // Try immediately in case everything was already cached
    setTimeout(buildAndSave, 400);

    console.log('[EmbeddingBridge] host ready');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GUEST — call on clusters.html / concept-map.html
  // ══════════════════════════════════════════════════════════════════════════
  function guest(onRows) {
    function tryLoad() {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      try {
        var rows = deserialize(JSON.parse(raw));
        if (!rows.length) return false;
        console.log('[EmbeddingBridge] loaded ' + rows.length + ' rows from sessionStorage');
        onRows(rows);
        return true;
      } catch (e) {
        console.warn('[EmbeddingBridge] failed to parse sessionStorage data:', e);
        return false;
      }
    }

    if (tryLoad()) return;

    var attempts = 0;
    var retry = setInterval(function () {
      attempts++;
      if (tryLoad() || attempts >= 8) {
        clearInterval(retry);
        if (attempts >= 8) {
          console.warn('[EmbeddingBridge] no data found in sessionStorage');
          window.dispatchEvent(new CustomEvent('bridge-no-host'));
        }
      }
    }, 500);
  }

  return { host: host, guest: guest };
})();
