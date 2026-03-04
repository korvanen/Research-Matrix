// embedding-bridge.js — sessionStorage bridge for sharing embeddings
// between index.html (host) and tool pages (clusters.html, concept-map.html).
//
// Works with same-tab navigation: index.html saves embeddings to
// sessionStorage before the user navigates away. The tool page reads
// them directly on load — no host tab needed.
//
// ── USAGE ──────────────────────────────────────────────────────────────────
//
//  HOST (index.html):
//    EmbeddingBridge.host();
//    // Call once after scripts load. Listens for embeddings to finish
//    // and saves them to sessionStorage automatically.
//
//  GUEST (clusters.html / concept-map.html):
//    EmbeddingBridge.guest(function(rows) {
//      // rows: array of { tabIdx, rowIdx, row, vec: Float32Array }
//    });
//
// ── STORAGE KEY ────────────────────────────────────────────────────────────
//   pp-embeddings  →  JSON array of serialized rows
// ──────────────────────────────────────────────────────────────────────────

window.EmbeddingBridge = (function () {
  var STORAGE_KEY = 'pp-embeddings';

  // ── Serialise rows → plain JSON (Float32Array → regular array) ──────────
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

  // ── Deserialise plain JSON → rows with Float32Array vecs ────────────────
  function deserialize(rows) {
    return rows.map(function (r) {
      return Object.assign({}, r, {
        vec: r.vec ? new Float32Array(r.vec) : null,
      });
    });
  }

  // ── Save to sessionStorage (gracefully handle quota errors) ─────────────
  function save(rows) {
    try {
      var json = JSON.stringify(serialize(rows));
      sessionStorage.setItem(STORAGE_KEY, json);
      console.log('[EmbeddingBridge] saved ' + rows.length + ' rows (' + (json.length / 1024).toFixed(1) + ' KB)');
    } catch (e) {
      // QuotaExceededError — dataset too large. Save without vectors so at
      // least row text is available (tool pages will show an error about vecs).
      console.warn('[EmbeddingBridge] quota exceeded, saving without vectors:', e.message);
      try {
        var slim = serialize(rows).map(function (r) {
          return Object.assign({}, r, { vec: null });
        });
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      } catch (e2) {
        console.error('[EmbeddingBridge] sessionStorage completely full:', e2.message);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // HOST — call once on index.html after scripts load
  // ════════════════════════════════════════════════════════════════════════
  function host() {
    function buildAndSave() {
      if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return;
      if (typeof buildRowIndex !== 'function') return;

      var rows = buildRowIndex();
      var embedded = [];
      rows.forEach(function (r) {
        var key = r.tabIdx + ':' + r.rowIdx;
        var vec = window.EmbeddingUtils.getVectorSync
          ? window.EmbeddingUtils.getVectorSync(key)
          : null;
        if (vec) embedded.push(Object.assign({}, r, { vec: vec }));
      });

      if (embedded.length) save(embedded);
    }

    window.addEventListener('embedding-complete', function () { setTimeout(buildAndSave, 100); });
    window.addEventListener('embedder-ready',     function () { setTimeout(buildAndSave, 200); });
    // Also try immediately in case embeddings were already ready before this ran
    setTimeout(buildAndSave, 300);

    console.log('[EmbeddingBridge] host ready');
  }

  // ════════════════════════════════════════════════════════════════════════
  // GUEST — call on clusters.html / concept-map.html
  // ════════════════════════════════════════════════════════════════════════
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

    // Retry briefly — same-tab nav is instant but just in case
    var attempts = 0;
    var retry = setInterval(function () {
      attempts++;
      if (tryLoad() || attempts >= 8) {
        clearInterval(retry);
        if (attempts >= 8) {
          console.warn('[EmbeddingBridge] no embedding data found in sessionStorage');
          window.dispatchEvent(new CustomEvent('bridge-no-host'));
        }
      }
    }, 500);
  }

  return { host: host, guest: guest };
})();
