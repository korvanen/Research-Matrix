// embedding-bridge.js — BroadcastChannel bridge for sharing embeddings
// between index.html (host) and tool pages (clusters.html, concept-map.html).
//
// ── USAGE ──────────────────────────────────────────────────────────────────
//
//  HOST (index.html) — call once embeddings are ready:
//    EmbeddingBridge.host();
//
//  GUEST (clusters.html / concept-map.html) — call on page load:
//    EmbeddingBridge.guest(function(rows) {
//      // rows: array of { tabIdx, rowIdx, row, vec } — same shape as buildRowIndex()
//      // but with .vec already attached. Start rendering here.
//    });
//
// ── MESSAGE PROTOCOL ───────────────────────────────────────────────────────
//  guest → host :  { type: 'pp-request-embeddings' }
//  host  → guest:  { type: 'pp-embeddings', rows: [...] }
//  host  → guest:  { type: 'pp-embeddings-progress', pct: 0-100 }
//  host  → all  :  { type: 'pp-embeddings-updated', rows: [...] }  (on re-index)
// ──────────────────────────────────────────────────────────────────────────

window.EmbeddingBridge = (function() {
  const CHANNEL = 'pp-embeddings';

  // ── Serialise / deserialise Float32Array vecs through structured clone ───
  // BroadcastChannel supports structured clone so Float32Array transfers fine.

  function serializeRows(rows) {
    return rows.map(function(r) {
      return {
        tabIdx: r.tabIdx,
        rowIdx: r.rowIdx,
        row:    r.row,
        headers: r.headers || [],
        title:   r.title   || '',
        vec: r.vec ? Array.from(r.vec) : null,
      };
    });
  }

  function deserializeRows(rows) {
    return rows.map(function(r) {
      return Object.assign({}, r, {
        vec: r.vec ? new Float32Array(r.vec) : null,
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // HOST — run on index.html
  // ════════════════════════════════════════════════════════════════════════
  function host() {
    var ch = new BroadcastChannel(CHANNEL);
    var _cachedRows = null;

    function buildAndCache() {
      if (!window.EmbeddingUtils || !window.EmbeddingUtils.isReady()) return null;
      if (typeof buildRowIndex !== 'function') return null;
      var rows = buildRowIndex();
      var embedded = [];
      rows.forEach(function(r) {
        var key = r.tabIdx + ':' + r.rowIdx;
        var vec = window.EmbeddingUtils.getVectorSync && window.EmbeddingUtils.getVectorSync(key);
        if (vec) embedded.push(Object.assign({}, r, { vec: vec }));
      });
      if (!embedded.length) return null;
      _cachedRows = embedded;
      return embedded;
    }

    function broadcast(rows) {
      try {
        ch.postMessage({ type: 'pp-embeddings', rows: serializeRows(rows) });
      } catch(e) {
        console.warn('[EmbeddingBridge] broadcast failed:', e);
      }
    }

    // Respond to requests from guest pages
    ch.onmessage = function(ev) {
      if (ev.data && ev.data.type === 'pp-request-embeddings') {
        var rows = _cachedRows || buildAndCache();
        if (rows) broadcast(rows);
      }
    };

    // Forward progress events to guests
    window.addEventListener('embedding-progress', function(ev) {
      try { ch.postMessage({ type: 'pp-embeddings-progress', pct: ev.detail && ev.detail.pct }); } catch(e) {}
    });

    // When embeddings finish, build cache and push to any open guest pages
    window.addEventListener('embedding-complete', function(ev) {
      var rows = buildAndCache();
      if (rows) {
        broadcast(rows);
        // Also fire updated event for guests that were already showing data
        try { ch.postMessage({ type: 'pp-embeddings-updated', rows: serializeRows(rows) }); } catch(e) {}
      }
    });

    // Also hook embedder-ready in case embedding-complete already fired
    window.addEventListener('embedder-ready', function() {
      setTimeout(function() {
        var rows = buildAndCache();
        if (rows) broadcast(rows);
      }, 200);
    });

    console.log('[EmbeddingBridge] host started');
  }

  // ════════════════════════════════════════════════════════════════════════
  // GUEST — run on clusters.html / concept-map.html
  // ════════════════════════════════════════════════════════════════════════
  function guest(onRows) {
    var ch = new BroadcastChannel(CHANNEL);
    var _received = false;

    ch.onmessage = function(ev) {
      var msg = ev.data;
      if (!msg) return;

      if (msg.type === 'pp-embeddings' || msg.type === 'pp-embeddings-updated') {
        var rows = deserializeRows(msg.rows || []);
        if (!rows.length) return;
        _received = true;
        onRows(rows);
      }

      if (msg.type === 'pp-embeddings-progress') {
        // Fire a synthetic event so existing progress UI works unchanged
        window.dispatchEvent(new CustomEvent('embedding-progress', { detail: { pct: msg.pct } }));
      }
    };

    // Ask the host for current data immediately
    function request() {
      try { ch.postMessage({ type: 'pp-request-embeddings' }); } catch(e) {}
    }

    request();

    // Re-request a few times in case the host tab isn't ready yet
    var attempts = 0;
    var retry = setInterval(function() {
      if (_received || attempts >= 6) { clearInterval(retry); return; }
      attempts++;
      request();
    }, 800);

    // Surface a readable status if the main page isn't open
    setTimeout(function() {
      if (!_received) {
        window.dispatchEvent(new CustomEvent('bridge-no-host'));
      }
    }, 6000);

    console.log('[EmbeddingBridge] guest started, requesting data...');
  }

  return { host: host, guest: guest };
})();
