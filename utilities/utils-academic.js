// ════════════════════════════════════════════════════════════════════════════
// utils-academic.js  —  Academic enhancements for Dimensional Framework
// Adds: DOI resolution · BibTeX/CSV import · Schema validation · Screening
//       Annotations · Saved searches · Silhouette scores · Export · Methods blurb
// Load order: after utils-shared.js, before page-specific scripts
// ════════════════════════════════════════════════════════════════════════════
console.log('[utils-academic.js v1.0]');

window.AcademicUtils = (function () {
  'use strict';

  // ── Storage key namespacing ───────────────────────────────────────────────
  var SK = {
    SCREENING:      'df_screening_',
    ANNOTATION:     'df_annotation_',
    SAVED_SEARCHES: 'df_saved_searches',
    IMPORTED_DATA:  'df_imported_tabs',
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1.  DOI RESOLUTION  (Crossref public API, no key required)
  // ══════════════════════════════════════════════════════════════════════════

  function normaliseDOI(raw) {
    if (!raw) return null;
    raw = String(raw).trim();
    var m = raw.match(/10\.\d{4,}\/\S+/);
    return m ? m[0].replace(/[.,;)\]]+$/, '') : null;
  }

  function resolveDOI(doi) {
    doi = normaliseDOI(doi);
    if (!doi) return Promise.reject(new Error('Invalid DOI'));
    var url = 'https://api.crossref.org/works/' + encodeURIComponent(doi);
    return fetch(url, { headers: { 'User-Agent': 'DimensionalFramework/1.0 (research tool)' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Crossref ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var w = data.message || {};
        var authors = (w.author || []).map(function (a) {
          return [a.given, a.family].filter(Boolean).join(' ');
        });
        var container = (w['container-title'] || [])[0] || '';
        var year = (w.published && (w.published['date-parts'] || [[]])[0][0]) ||
                   (w.issued   && (w.issued['date-parts']    || [[]])[0][0]) || '';
        return {
          doi:       doi,
          title:     (w.title || [])[0] || '',
          authors:   authors.join('; '),
          year:      String(year),
          journal:   container,
          volume:    w.volume || '',
          issue:     w.issue  || '',
          pages:     w.page   || '',
          publisher: w.publisher || '',
          abstract:  (w.abstract || '').replace(/<\/?[^>]+>/g, '').trim(),
          url:       w.URL || ('https://doi.org/' + doi),
          type:      w.type || 'journal-article',
        };
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2.  BibTeX PARSER
  // ══════════════════════════════════════════════════════════════════════════

  function parseBibTeX(text) {
    var entries = [];
    // Strip comments
    text = text.replace(/%[^\n]*/g, '');

    var entryRe = /@(\w+)\s*\{([^,]+),([^@]*)/g;
    var m;
    while ((m = entryRe.exec(text)) !== null) {
      var type   = m[1].toLowerCase();
      var citeKey= m[2].trim();
      var body   = m[3];

      if (type === 'string' || type === 'preamble' || type === 'comment') continue;

      var fields = {};
      // Match field = {value} or field = "value" or field = number
      var fieldRe = /(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g;
      var fm;
      while ((fm = fieldRe.exec(body)) !== null) {
        var key = fm[1].toLowerCase();
        var val = (fm[2] !== undefined ? fm[2] : (fm[3] !== undefined ? fm[3] : fm[4])) || '';
        // Collapse whitespace and strip LaTeX braces
        val = val.replace(/\s+/g, ' ').replace(/[{}]/g, '').trim();
        fields[key] = val;
      }

      var authors = (fields.author || '').split(/\s+and\s+/i).map(function (a) {
        a = a.trim();
        // "Last, First" → "First Last"
        if (a.indexOf(',') !== -1) {
          var parts = a.split(',');
          return (parts[1] || '').trim() + ' ' + parts[0].trim();
        }
        return a;
      }).filter(Boolean).join('; ');

      entries.push({
        type:      type,
        citeKey:   citeKey,
        title:     fields.title    || '',
        authors:   authors,
        year:      fields.year     || '',
        journal:   fields.journal  || fields.booktitle || fields.publisher || '',
        volume:    fields.volume   || '',
        issue:     fields.number   || fields.issue || '',
        pages:     fields.pages    || '',
        doi:       normaliseDOI(fields.doi || '') || '',
        url:       fields.url      || (fields.doi ? 'https://doi.org/' + fields.doi : ''),
        abstract:  fields.abstract || '',
        publisher: fields.publisher|| '',
        keywords:  fields.keywords || '',
      });
    }
    return entries;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3.  CSV CITATION PARSER  (detects header row, maps common column names)
  // ══════════════════════════════════════════════════════════════════════════

  function parseCSVText(text) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    function parseLine(line) {
      var fields = [], cur = '', inQ = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) {
          fields.push(cur); cur = '';
        } else {
          cur += c;
        }
      }
      fields.push(cur);
      return fields.map(function (f) { return f.trim(); });
    }
    var rows = lines.filter(function (l) { return l.trim(); }).map(parseLine);
    if (rows.length < 2) return [];

    var headers = rows[0].map(function (h) { return h.toLowerCase().replace(/[^a-z0-9]/g, ''); });

    // Column aliases → canonical field names
    var aliases = {
      title:     ['title', 'articlename', 'papertitle', 'arttitle'],
      authors:   ['author', 'authors', 'authorname'],
      year:      ['year', 'pubyear', 'publicationyear', 'date'],
      journal:   ['journal', 'source', 'publication', 'booktitle', 'venue', 'container'],
      doi:       ['doi', 'digitalobjectidentifier'],
      abstract:  ['abstract', 'summary', 'description'],
      volume:    ['volume', 'vol'],
      issue:     ['issue', 'number', 'no'],
      pages:     ['pages', 'page'],
      publisher: ['publisher'],
      keywords:  ['keywords', 'tags', 'keyword'],
      url:       ['url', 'link', 'uri'],
    };

    var colMap = {};
    headers.forEach(function (h, i) {
      Object.keys(aliases).forEach(function (field) {
        if (aliases[field].indexOf(h) !== -1 && colMap[field] === undefined) colMap[field] = i;
      });
    });

    return rows.slice(1).map(function (row) {
      var get = function (field) { return colMap[field] !== undefined ? (row[colMap[field]] || '') : ''; };
      return {
        title:     get('title'),
        authors:   get('authors'),
        year:      get('year'),
        journal:   get('journal'),
        doi:       normaliseDOI(get('doi')) || '',
        abstract:  get('abstract'),
        volume:    get('volume'),
        issue:     get('issue'),
        pages:     get('pages'),
        publisher: get('publisher'),
        keywords:  get('keywords'),
        url:       get('url') || (get('doi') ? 'https://doi.org/' + normaliseDOI(get('doi')) : ''),
        type:      'journal-article',
      };
    }).filter(function (e) { return e.title || e.doi; });
  }

  // ── Convert parsed citations to the app's grid format ────────────────────
  function citationsToGrid(entries, sourceName) {
    var cols = ['title', 'authors', 'year', 'journal', 'doi', 'abstract', 'keywords', 'status'];
    var headers = ['Title', 'Authors', 'Year', 'Journal / Source', 'DOI', 'Abstract', 'Keywords', 'Status'];

    // Row 0: flags
    var flagRow = ['CATEGORY'].concat(cols.map(function () { return 'COLUMN'; }));

    // Row 1: TITLE row
    var titleRow = ['TITLE', sourceName || 'Imported Data'].concat(new Array(cols.length - 1).fill(''));

    // Row 2: HEADER ROW
    var headerRow = ['HEADER ROW', ''].concat(headers);

    // Data rows
    var dataRows = entries.map(function (e, i) {
      return [
        'Entry ' + (i + 1),  // category (col 0, CATEGORY)
        '',                   // spacer (col 1, aligns with COLUMN start)
        e.title    || '',
        e.authors  || '',
        e.year     || '',
        e.journal  || '',
        e.doi      || '',
        e.abstract || '',
        e.keywords || '',
        'unscreened',
      ].slice(0, flagRow.length);
    });

    // Rebuild correctly: flagRow tells the parser which columns to use
    // flagRow[0] = 'CATEGORY' → col 0 is the category col
    // flagRow[1..] = 'COLUMN' for each data column
    var grid = [flagRow, titleRow, headerRow].concat(dataRows);
    return grid;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4.  SCHEMA VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  var RECOMMENDED_COLUMNS = ['title', 'authors', 'year', 'doi'];
  var OPTIONAL_COLUMNS    = ['abstract', 'journal', 'keywords', 'url', 'status', 'notes'];

  function validateSchema(headers) {
    if (!headers || !headers.length) return { valid: false, missing: RECOMMENDED_COLUMNS, suggestions: [] };

    var lower = headers.map(function (h) { return String(h).toLowerCase().trim(); });
    var missing = RECOMMENDED_COLUMNS.filter(function (col) {
      return !lower.some(function (h) { return h.includes(col); });
    });
    var suggestions = [];
    if (missing.indexOf('doi') !== -1 && lower.some(function (h) { return h.includes('url') || h.includes('link'); })) {
      suggestions.push('Rename your URL column to "DOI" for auto-resolution features.');
    }
    if (missing.indexOf('authors') !== -1 && lower.some(function (h) { return h.includes('author'); })) {
      suggestions.push('Rename your author column to "Authors".');
    }
    return {
      valid:       missing.length === 0,
      missing:     missing,
      present:     RECOMMENDED_COLUMNS.filter(function (col) { return !missing.includes(col); }),
      optional:    OPTIONAL_COLUMNS.filter(function (col) { return lower.some(function (h) { return h.includes(col); }); }),
      suggestions: suggestions,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5.  SCREENING STATUS  (localStorage)
  // ══════════════════════════════════════════════════════════════════════════

  function _screeningKey(tabIdx, rowIdx) { return SK.SCREENING + tabIdx + '_' + rowIdx; }

  function getScreeningStatus(tabIdx, rowIdx) {
    try { return localStorage.getItem(_screeningKey(tabIdx, rowIdx)) || 'unscreened'; }
    catch (e) { return 'unscreened'; }
  }

  function setScreeningStatus(tabIdx, rowIdx, status, reason) {
    try {
      var payload = JSON.stringify({ status: status, reason: reason || '', ts: Date.now() });
      localStorage.setItem(_screeningKey(tabIdx, rowIdx), payload);
    } catch (e) { console.warn('[academic] screening save failed:', e); }
  }

  function parseScreeningValue(raw) {
    if (!raw) return { status: 'unscreened', reason: '' };
    try {
      var p = JSON.parse(raw);
      return { status: p.status || 'unscreened', reason: p.reason || '' };
    } catch (e) { return { status: raw, reason: '' }; }
  }

  function getScreeningProgress() {
    if (typeof window.TABS === 'undefined' || !window.TABS.length) return null;
    var counts = { included: 0, excluded: 0, unscreened: 0, total: 0 };
    window.TABS.forEach(function (tab, tabIdx) {
      var data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
      if (!data) return;
      data.rows.forEach(function (row, rowIdx) {
        counts.total++;
        var raw = localStorage.getItem(_screeningKey(tabIdx, rowIdx));
        var s   = parseScreeningValue(raw).status;
        if (counts[s] !== undefined) counts[s]++;
        else counts.unscreened++;
      });
    });
    return counts;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6.  ANNOTATIONS  (localStorage)
  // ══════════════════════════════════════════════════════════════════════════

  function _annotKey(tabIdx, rowIdx) { return SK.ANNOTATION + tabIdx + '_' + rowIdx; }

  function getAnnotation(tabIdx, rowIdx) {
    try { return localStorage.getItem(_annotKey(tabIdx, rowIdx)) || ''; }
    catch (e) { return ''; }
  }

  function setAnnotation(tabIdx, rowIdx, text) {
    try {
      if (text.trim()) localStorage.setItem(_annotKey(tabIdx, rowIdx), text);
      else             localStorage.removeItem(_annotKey(tabIdx, rowIdx));
    } catch (e) { console.warn('[academic] annotation save failed:', e); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7.  SAVED SEARCHES
  // ══════════════════════════════════════════════════════════════════════════

  function getSavedSearches() {
    try { return JSON.parse(localStorage.getItem(SK.SAVED_SEARCHES) || '[]'); }
    catch (e) { return []; }
  }

  function saveSearch(query, results, label) {
    var searches = getSavedSearches();
    var entry = {
      id:      Date.now(),
      label:   label || query,
      query:   query,
      date:    new Date().toISOString().split('T')[0],
      count:   results.length,
      results: results.map(function (r) {
        return {
          tabIdx: r.row.tabIdx,
          rowIdx: r.row.rowIdx,
          score:  r.score,
          title:  (r.row && r.row.row && r.row.row.cells) ? r.row.row.cells[0] : '',
        };
      }),
    };
    searches.unshift(entry);
    if (searches.length > 50) searches = searches.slice(0, 50); // keep last 50
    try { localStorage.setItem(SK.SAVED_SEARCHES, JSON.stringify(searches)); }
    catch (e) { console.warn('[academic] save search failed:', e); }
    return entry;
  }

  function deleteSavedSearch(id) {
    var searches = getSavedSearches().filter(function (s) { return s.id !== id; });
    try { localStorage.setItem(SK.SAVED_SEARCHES, JSON.stringify(searches)); }
    catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8.  SILHOUETTE SCORE
  // ══════════════════════════════════════════════════════════════════════════

  function cosineDist(a, b) {
    if (!a || !b || a.length !== b.length) return 1;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    var d = Math.sqrt(na) * Math.sqrt(nb);
    return d < 1e-10 ? 1 : 1 - dot / d;
  }

  // clusters: Array<{ label: string, items: Array<{ vec: Float32Array }> }>
  // Returns mean silhouette score [−1, 1], or null if < 2 clusters
  function computeSilhouette(clusters) {
    var allClusters = clusters.filter(function (c) { return c.items && c.items.length; });
    if (allClusters.length < 2) return null;

    var scores = [];
    allClusters.forEach(function (cluster, ci) {
      cluster.items.forEach(function (item) {
        if (!item.vec) return;
        // a(i): mean distance to other items in same cluster
        var sameItems = cluster.items.filter(function (x) { return x !== item && x.vec; });
        var a = sameItems.length ? sameItems.reduce(function (s, x) { return s + cosineDist(item.vec, x.vec); }, 0) / sameItems.length : 0;

        // b(i): mean distance to nearest other cluster
        var b = Infinity;
        allClusters.forEach(function (other, oi) {
          if (oi === ci || !other.items.length) return;
          var otherItems = other.items.filter(function (x) { return x.vec; });
          if (!otherItems.length) return;
          var meanDist = otherItems.reduce(function (s, x) { return s + cosineDist(item.vec, x.vec); }, 0) / otherItems.length;
          if (meanDist < b) b = meanDist;
        });
        if (b === Infinity) return;
        scores.push((b - a) / Math.max(a, b));
      });
    });
    if (!scores.length) return null;
    return scores.reduce(function (s, x) { return s + x; }, 0) / scores.length;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9.  EXPORT UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  function downloadBlob(content, filename, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function escCSV(v) {
    v = String(v == null ? '' : v);
    if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  function rowsToCSV(headers, rows) {
    return [headers.map(escCSV).join(',')]
      .concat(rows.map(function (row) { return row.map(escCSV).join(','); }))
      .join('\n');
  }

  // Export search results as CSV
  function exportResultsCSV(results, query) {
    var headers = ['rank', 'score', 'category', 'title', 'tab'];
    var rows = results.map(function (r, i) {
      var cats  = (r.row && r.row.row && r.row.row.cats)  ? r.row.row.cats.join(' > ')  : '';
      var cells = (r.row && r.row.row && r.row.row.cells) ? r.row.row.cells[0] : '';
      var tab   = (r.row && r.row.title) ? r.row.title : '';
      return [i + 1, r.score.toFixed(4), cats, cells, tab];
    });
    var csv = '# Search query: ' + query + '\n# Exported: ' + new Date().toISOString() + '\n' +
              rowsToCSV(headers, rows);
    downloadBlob(csv, 'search-results-' + Date.now() + '.csv', 'text/csv');
  }

  // Export clusters as CSV (scrapes from DOM or uses passed data)
  function exportClustersFromDOM() {
    var nests   = document.querySelectorAll('.pp-cl-nest, [data-cluster-name]');
    var headers = ['cluster', 'sub_cluster', 'category', 'content', 'tab'];
    var rows    = [];

    if (!nests.length) {
      // Fallback: scrape all visible cards
      document.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function (card) {
        var text  = (card.querySelector('.pp-cl-card-body, [class*="card-body"]') || card).textContent.trim();
        var cat   = (card.querySelector('.pp-cl-card-cat, [class*="card-cat"]')  || {}).textContent || '';
        rows.push(['', '', cat.trim(), text.slice(0, 300), '']);
      });
    } else {
      nests.forEach(function (nest) {
        var clusterName = (nest.querySelector('.pp-cl-nest-header, [class*="nest-header"]') || {}).textContent || nest.dataset.clusterName || '(unnamed)';
        clusterName = clusterName.trim();
        var subNests = nest.querySelectorAll('.pp-cl-subnest, [data-sub-cluster]');
        if (subNests.length) {
          subNests.forEach(function (sub) {
            var subName = (sub.querySelector('.pp-cl-subnest-header, [class*="subnest-header"]') || {}).textContent || '(unnamed)';
            subName = subName.trim();
            sub.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function (card) {
              var text = (card.querySelector('.pp-cl-card-body, [class*="card-body"]') || card).textContent.trim();
              var cat  = (card.querySelector('.pp-cl-card-cat, [class*="card-cat"]') || {}).textContent || '';
              rows.push([clusterName, subName, cat.trim(), text.slice(0, 300), '']);
            });
          });
        } else {
          nest.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function (card) {
            var text = (card.querySelector('.pp-cl-card-body, [class*="card-body"]') || card).textContent.trim();
            var cat  = (card.querySelector('.pp-cl-card-cat, [class*="card-cat"]') || {}).textContent || '';
            rows.push([clusterName, '', cat.trim(), text.slice(0, 300), '']);
          });
        }
      });
    }

    if (!rows.length) {
      alert('No cluster data found yet — run clustering first, then export.');
      return;
    }
    var csv = '# Clusters export\n# Exported: ' + new Date().toISOString() + '\n' +
              rowsToCSV(headers, rows);
    downloadBlob(csv, 'clusters-' + Date.now() + '.csv', 'text/csv');
  }

  // Export spreadsheet (current tab) as CSV
  function exportSpreadsheetCSV() {
    var headerRow = document.getElementById('header-row');
    var dataBody  = document.getElementById('data-body');
    var catBody   = document.getElementById('cat-body');
    if (!headerRow || !dataBody) { alert('Spreadsheet not loaded yet.'); return; }

    var headers = ['Category'].concat(
      Array.from(headerRow.querySelectorAll('th')).map(function (th) { return th.textContent.trim(); })
    ).concat(['Screening', 'Annotation']);

    var catRows  = Array.from(catBody ? catBody.querySelectorAll('tr') : []);
    var dataRows = Array.from(dataBody.querySelectorAll('tr'));

    var rows = dataRows.map(function (tr, i) {
      var catRow = catRows[i];
      var cat = catRow ? Array.from(catRow.querySelectorAll('td')).map(function (td) {
        return td.textContent.trim();
      }).join(' > ') : '';

      var cells = Array.from(tr.querySelectorAll('td')).map(function (td) {
        return td.textContent.trim();
      });

      // screening + annotation
      var key = tr.dataset.tabIdx + '_' + tr.dataset.rowIdx;
      var sc  = tr.dataset.tabIdx !== undefined
        ? parseScreeningValue(localStorage.getItem(_screeningKey(tr.dataset.tabIdx, tr.dataset.rowIdx))).status
        : '';
      var an  = tr.dataset.tabIdx !== undefined ? getAnnotation(tr.dataset.tabIdx, tr.dataset.rowIdx) : '';
      return [cat].concat(cells).concat([sc, an]);
    });

    var csv = rowsToCSV(headers, rows);
    downloadBlob(csv, 'spreadsheet-export-' + Date.now() + '.csv', 'text/csv');
  }

  // Export concept map canvas as PNG using html2canvas or manual canvas
  function exportConceptMapPNG() {
    var world  = document.getElementById('pp-cmap-world');
    var canvas = document.getElementById('pp-cmap-canvas');
    if (!world || !canvas) { alert('Concept map not rendered yet.'); return; }

    // Use html2canvas if available (loaded dynamically)
    function doExport() {
      window.html2canvas(canvas, { backgroundColor: getComputedStyle(document.body).backgroundColor || '#fff', scale: 2 })
        .then(function (c) {
          c.toBlob(function (blob) {
            var url = URL.createObjectURL(blob);
            var a   = document.createElement('a');
            a.href = url; a.download = 'concept-map-' + Date.now() + '.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
          });
        }).catch(function (e) { alert('Export failed: ' + e.message); });
    }

    if (window.html2canvas) { doExport(); return; }

    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload  = doExport;
    script.onerror = function () { alert('html2canvas could not be loaded. Try exporting via browser print (Ctrl+P → Save as PDF).'); };
    document.head.appendChild(script);
  }

  // Export concept map as SVG (structural / text-only, no style fidelity)
  function exportConceptMapSVG() {
    var world = document.getElementById('pp-cmap-world');
    if (!world) { alert('Concept map not rendered yet.'); return; }
    var serializer = new XMLSerializer();
    // Clone world, inline critical styles
    var clone = world.cloneNode(true);
    var ns = 'http://www.w3.org/2000/svg';
    var svgWrap = document.createElementNS(ns, 'svg');
    var rect    = world.getBoundingClientRect();
    svgWrap.setAttribute('xmlns',   ns);
    svgWrap.setAttribute('width',   rect.width  || 1200);
    svgWrap.setAttribute('height',  rect.height || 800);
    svgWrap.setAttribute('viewBox', '0 0 ' + (rect.width || 1200) + ' ' + (rect.height || 800));
    var fo = document.createElementNS(ns, 'foreignObject');
    fo.setAttribute('x', 0); fo.setAttribute('y', 0);
    fo.setAttribute('width', '100%'); fo.setAttribute('height', '100%');
    fo.appendChild(clone);
    svgWrap.appendChild(fo);
    var svgStr = serializer.serializeToString(svgWrap);
    downloadBlob(svgStr, 'concept-map-' + Date.now() + '.svg', 'image/svg+xml');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10.  METHODS BLURB GENERATOR
  // ══════════════════════════════════════════════════════════════════════════

  function generateMethodsBlurb(opts) {
    opts = opts || {};
    var today     = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    var model     = opts.model     || 'all-MiniLM-L6-v2 (Sentence Transformers)';
    var threshold = opts.threshold !== undefined ? opts.threshold : 0.40;
    var progress  = getScreeningProgress();
    var entryCount= progress ? progress.total : (opts.entryCount || 0);
    var included  = progress ? progress.included : (opts.included || 0);
    var tabs      = typeof window.TABS !== 'undefined' ? window.TABS.length : 0;
    var tool      = opts.toolName || 'Dimensional Framework';

    var blurb = 'Literature was managed and analysed using ' + tool + ', a browser-based semantic research tool. ';

    if (entryCount) {
      blurb += 'A dataset of ' + entryCount + ' entr' + (entryCount === 1 ? 'y' : 'ies');
      if (tabs > 1) blurb += ' across ' + tabs + ' dimensional tab' + (tabs === 1 ? '' : 's');
      blurb += ' was compiled. ';
    }

    blurb += 'Semantic similarity was computed using the ' + model + ' embedding model, which maps text passages to a 384-dimensional vector space. ';
    blurb += 'Matches were identified using cosine similarity with a minimum threshold of ' + threshold.toFixed(2) + '. ';

    if (progress && progress.included + progress.excluded > 0) {
      var screened = progress.included + progress.excluded;
      blurb += screened + ' entries were screened for relevance; ' + progress.included + ' were included and ' + progress.excluded + ' were excluded. ';
    }

    blurb += 'Thematic clustering was performed by computing pairwise cosine distances between embedding vectors and applying agglomerative grouping. ';
    blurb += 'The concept map hierarchy was inferred from semantic distance with a parent-child threshold of 0.50. ';
    blurb += 'Analysis was conducted on ' + today + '.';

    return blurb;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11.  IMPORTED DATA (BibTeX/CSV → TABS integration)
  // ══════════════════════════════════════════════════════════════════════════

  function saveImportedTabs(tabs) {
    try { localStorage.setItem(SK.IMPORTED_DATA, JSON.stringify(tabs)); }
    catch (e) { console.warn('[academic] imported tabs save failed:', e); }
  }

  function loadImportedTabs() {
    try { return JSON.parse(localStorage.getItem(SK.IMPORTED_DATA) || '[]'); }
    catch (e) { return []; }
  }

  function clearImportedTabs() {
    try { localStorage.removeItem(SK.IMPORTED_DATA); }
    catch (e) {}
  }

  function mergeImportedIntoTABS() {
    var imported = loadImportedTabs();
    if (!imported.length) return;
    if (typeof window.TABS === 'undefined') window.TABS = [];
    imported.forEach(function (tab) {
      // Avoid duplicates
      if (!window.TABS.some(function (t) { return t.name === tab.name; })) {
        window.TABS.push(tab);
      }
    });
    console.log('[academic] merged', imported.length, 'imported tabs into TABS');
    window.dispatchEvent(new CustomEvent('sheet-loaded', { detail: { tabCount: window.TABS.length } }));
  }

  // Wire up after sheet is loaded
  window.addEventListener('sheet-loaded', function () {
    mergeImportedIntoTABS();
  });

  // Also try on DOMContentLoaded if TABS is somehow already set
  document.addEventListener('DOMContentLoaded', function () {
    if (window.TABS && window.TABS.length) mergeImportedIntoTABS();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 12.  PAGE-SPECIFIC UI INJECTORS
  // ══════════════════════════════════════════════════════════════════════════

  function _css(id, rules) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id;
    s.textContent = rules;
    document.head.appendChild(s);
  }

  // ── A)  INDEX PAGE — import panel, schema badge, methods blurb ─────────
  function injectIndexFeatures() {
    if (!document.getElementById('sheet-load-btn')) return;

    _css('acad-index-styles', `
      .acad-import-section {
        margin-top: 20px;
        border-top: 1px dashed var(--md-sys-color-outline-variant, rgba(0,0,0,.18));
        padding-top: 16px;
      }
      .acad-import-label {
        font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant, #555); margin-bottom: 8px;
      }
      .acad-import-drop {
        border: 2px dashed var(--md-sys-color-outline-variant, rgba(0,0,0,.25));
        border-radius: 8px; padding: 16px; text-align: center; cursor: pointer;
        transition: border-color .2s, background .2s;
        font-size: 13px; color: var(--md-sys-color-on-surface-variant, #666);
      }
      .acad-import-drop:hover, .acad-import-drop.drag-over {
        border-color: var(--md-sys-color-primary, #6750a4);
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 5%, transparent);
      }
      .acad-import-drop b { color: var(--md-sys-color-primary, #6750a4); }
      .acad-import-status { font-size: 12px; margin-top: 6px; min-height: 16px;
        color: var(--md-sys-color-on-surface-variant, #666); }
      .acad-import-status.success { color: #2e7d32; }
      .acad-import-status.error   { color: var(--md-sys-color-error, #b3261e); }
      .acad-schema-badge {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 500; letter-spacing: .04em;
        padding: 3px 10px; border-radius: 20px; margin-top: 8px;
      }
      .acad-schema-badge.ok  { background: #e8f5e9; color: #2e7d32; }
      .acad-schema-badge.warn{ background: #fff3e0; color: #e65100; }
      .acad-schema-badge.missing { background: #fce4ec; color: #b71c1c; }
      .acad-blurb-row { margin-top: 14px; display: flex; gap: 8px; align-items: flex-start; }
      .acad-blurb-textarea {
        flex: 1; min-height: 80px; resize: vertical; font-size: 12px; line-height: 1.5;
        border: 1px solid var(--md-sys-color-outline, rgba(0,0,0,.3)); border-radius: 6px;
        padding: 8px 10px; background: transparent; color: inherit; font-family: inherit;
        display: none;
      }
      .acad-blurb-btn {
        height: 36px; padding: 0 16px; border-radius: 18px; border: none;
        background: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
        font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        transition: box-shadow .15s;
      }
      .acad-blurb-btn:hover { box-shadow: 0 1px 4px rgba(0,0,0,.2); }
      .acad-clear-import {
        font-size: 11px; color: var(--md-sys-color-error, #b3261e);
        background: none; border: none; cursor: pointer; padding: 2px 0;
        text-decoration: underline; display: none;
      }
    `);

    var loaderEl = document.querySelector('.sheet-loader');
    if (!loaderEl) return;

    var importSection = document.createElement('div');
    importSection.className = 'acad-import-section';
    importSection.innerHTML =
      '<div class="acad-import-label">Import from file</div>' +
      '<div class="acad-import-drop" id="acad-drop">Drop a <b>.bib</b> or <b>.csv</b> file here, or <b>click to browse</b></div>' +
      '<input type="file" id="acad-file-input" accept=".bib,.csv,.txt" style="display:none">' +
      '<div class="acad-import-status" id="acad-import-status"></div>' +
      '<button class="acad-clear-import" id="acad-clear-import">✕ Clear imported data</button>' +
      '<div id="acad-schema-wrap"></div>' +
      '<div class="acad-blurb-row">' +
        '<button class="acad-blurb-btn" id="acad-blurb-btn">📋 Generate methods blurb</button>' +
        '<textarea class="acad-blurb-textarea" id="acad-blurb-area" readonly placeholder="Methods text will appear here…"></textarea>' +
      '</div>';

    loaderEl.appendChild(importSection);

    var dropEl    = document.getElementById('acad-drop');
    var fileInput = document.getElementById('acad-file-input');
    var statusEl  = document.getElementById('acad-import-status');
    var clearBtn  = document.getElementById('acad-clear-import');
    var blurbBtn  = document.getElementById('acad-blurb-btn');
    var blurbArea = document.getElementById('acad-blurb-area');
    var schemaWrap= document.getElementById('acad-schema-wrap');

    // Show clear button if imported data exists
    if (loadImportedTabs().length) {
      clearBtn.style.display = 'block';
      statusEl.textContent   = loadImportedTabs().length + ' imported tab(s) active';
      statusEl.className     = 'acad-import-status success';
    }

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var text   = e.target.result;
        var name   = file.name;
        var entries = [];
        try {
          if (name.toLowerCase().endsWith('.bib')) entries = parseBibTeX(text);
          else                                      entries = parseCSVText(text);
        } catch (err) {
          statusEl.textContent = 'Parse error: ' + err.message;
          statusEl.className   = 'acad-import-status error';
          return;
        }
        if (!entries.length) {
          statusEl.textContent = 'No entries found in file.';
          statusEl.className   = 'acad-import-status error';
          return;
        }
        var grid = citationsToGrid(entries, name.replace(/\.[^.]+$/, ''));
        var tab  = { name: 'MX-Imported-' + name.replace(/[^a-zA-Z0-9]/g, ''), grid: grid };
        saveImportedTabs([tab]);
        statusEl.textContent = '✓ ' + entries.length + ' entries imported from ' + name + '. Reloading…';
        statusEl.className   = 'acad-import-status success';
        clearBtn.style.display = 'block';
        setTimeout(function () { location.reload(); }, 900);
      };
      reader.readAsText(file);
    }

    dropEl.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { handleFile(fileInput.files[0]); });
    dropEl.addEventListener('dragover',  function (e) { e.preventDefault(); dropEl.classList.add('drag-over'); });
    dropEl.addEventListener('dragleave', function ()  { dropEl.classList.remove('drag-over'); });
    dropEl.addEventListener('drop', function (e) {
      e.preventDefault(); dropEl.classList.remove('drag-over');
      handleFile(e.dataTransfer.files[0]);
    });

    clearBtn.addEventListener('click', function () {
      clearImportedTabs();
      statusEl.textContent = 'Imported data cleared. Reloading…';
      statusEl.className   = 'acad-import-status';
      clearBtn.style.display = 'none';
      setTimeout(function () { location.reload(); }, 700);
    });

    blurbBtn.addEventListener('click', function () {
      var blurb = generateMethodsBlurb();
      blurbArea.style.display = 'block';
      blurbArea.value = blurb;
      blurbArea.select();
    });

    // Schema validation: show badge after sheet loads
    window.addEventListener('sheet-loaded', function () {
      if (!window.TABS || !window.TABS.length) return;
      var allHeaders = [];
      window.TABS.forEach(function (tab) {
        var data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
        if (data) allHeaders = allHeaders.concat(data.headers);
      });
      if (!allHeaders.length) return;
      var v = validateSchema(allHeaders);
      var cls  = v.valid ? 'ok' : (v.missing.length <= 2 ? 'warn' : 'missing');
      var icon = v.valid ? '✓' : '⚠';
      var msg  = v.valid
        ? 'Schema valid — all recommended columns present'
        : 'Missing recommended columns: ' + v.missing.join(', ');
      schemaWrap.innerHTML = '<span class="acad-schema-badge ' + cls + '">' + icon + ' ' + msg + '</span>';
      if (v.suggestions.length) {
        schemaWrap.innerHTML += v.suggestions.map(function (s) {
          return '<div style="font-size:11px;color:var(--md-sys-color-on-surface-variant);margin-top:4px;">💡 ' + s + '</div>';
        }).join('');
      }
    });
  }

  // ── B)  FIND MATCHES PAGE — saved searches panel + score styling ─────────
  function injectFindMatchesFeatures() {
    var searchBtn = document.getElementById('fm-search-btn');
    var inputEl   = document.getElementById('fm-input');
    if (!searchBtn || !inputEl) return;

    _css('acad-fm-styles', `
      .acad-save-btn {
        flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 18px;
        border: 1px solid var(--md-sys-color-outline, rgba(0,0,0,.3));
        background: transparent; color: var(--md-sys-color-primary, #6750a4);
        font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        transition: background .15s;
      }
      .acad-save-btn:hover { background: color-mix(in srgb, var(--md-sys-color-primary,#6750a4) 8%, transparent); }
      .acad-save-btn:disabled { opacity: .38; cursor: not-allowed; }
      .acad-export-btn {
        flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 18px;
        border: 1px solid var(--md-sys-color-outline, rgba(0,0,0,.3));
        background: transparent; color: var(--md-sys-color-on-surface-variant, #555);
        font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        transition: background .15s;
      }
      .acad-export-btn:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface,#000) 6%, transparent); }
      .acad-export-btn:disabled { opacity: .38; cursor: not-allowed; }
      .acad-sessions-section { padding: 8px 12px 0; }
      .acad-sessions-label { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); padding: 6px 0 4px; }
      .acad-session-item {
        display: flex; align-items: center; gap: 6px; padding: 5px 6px; border-radius: 6px;
        cursor: pointer; transition: background .12s; border: none; background: none;
        width: 100%; text-align: left;
      }
      .acad-session-item:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface,#000) 6%, transparent); }
      .acad-session-query { flex: 1; font-size: 12px; font-weight: 500; color: var(--md-sys-color-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .acad-session-meta  { font-size: 10px; color: var(--md-sys-color-on-surface-variant); white-space: nowrap; }
      .acad-session-del   { width: 20px; height: 20px; border-radius: 50%; border: none; background: none; cursor: pointer; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .acad-session-del:hover { color: var(--md-sys-color-error, #b3261e); background: color-mix(in srgb, var(--md-sys-color-error,#b3261e) 10%, transparent); }
      .acad-no-sessions { font-size: 11px; color: var(--md-sys-color-on-surface-variant); padding: 4px 6px; font-style: italic; }
      .fm-score-label { font-size: 11px !important; font-variant-numeric: tabular-nums; }
      .fm-score-label.score-high  { color: #2e7d32 !important; }
      .fm-score-label.score-med   { color: var(--md-sys-color-primary, #6750a4) !important; }
      .fm-score-label.score-low   { color: var(--md-sys-color-on-surface-variant) !important; }
      .acad-score-pct { font-size: 9px; font-weight: 600; letter-spacing: .04em;
        color: var(--md-sys-color-on-surface-variant); margin-left: 2px; }
    `);

    // Add Save + Export buttons to the search bar
    var searchBar = document.querySelector('.fm-search-bar');
    if (searchBar) {
      var saveBtn   = document.createElement('button');
      saveBtn.className = 'acad-save-btn';
      saveBtn.id        = 'acad-save-search';
      saveBtn.textContent = '💾 Save';
      saveBtn.disabled  = true;
      var exportBtn = document.createElement('button');
      exportBtn.className   = 'acad-export-btn';
      exportBtn.id          = 'acad-export-search';
      exportBtn.textContent = '↓ CSV';
      exportBtn.disabled    = true;
      searchBar.appendChild(saveBtn);
      searchBar.appendChild(exportBtn);

      var lastResults = [], lastQuery = '';

      // Intercept search results by wrapping renderResults (already in page)
      // We patch via MutationObserver on the results container
      var resultsEl = document.getElementById('fm-results');
      if (resultsEl) {
        var mo = new MutationObserver(function () {
          // After results render, colour-code score labels
          resultsEl.querySelectorAll('.fm-score-label').forEach(function (el) {
            var v = parseFloat(el.textContent);
            el.classList.remove('score-high', 'score-med', 'score-low');
            if (v >= 0.75) el.classList.add('score-high');
            else if (v >= 0.50) el.classList.add('score-med');
            else el.classList.add('score-low');
          });
        });
        mo.observe(resultsEl, { childList: true, subtree: true });
      }

      // Hook into the search button click to capture results
      searchBtn.addEventListener('click', function () {
        saveBtn.disabled = exportBtn.disabled = true;
        // Wait for results to appear, then enable
        setTimeout(function () {
          var cards = resultsEl ? resultsEl.querySelectorAll('.fm-card') : [];
          if (cards.length) {
            lastQuery = inputEl.value.trim();
            saveBtn.disabled = exportBtn.disabled = false;
          }
        }, 3000);
      }, true);

      saveBtn.addEventListener('click', function () {
        var query   = inputEl.value.trim();
        var cards   = resultsEl ? Array.from(resultsEl.querySelectorAll('.fm-card')) : [];
        var results = cards.map(function (card, i) {
          var rankEl  = card.querySelector('.fm-rank');
          var scoreEl = card.querySelector('.fm-score-label');
          var catEl   = card.querySelector('.fm-cat-tag');
          var valEl   = card.querySelector('.fm-cell-value');
          return {
            row:   { tabIdx: 0, rowIdx: i, title: catEl ? catEl.textContent : '', row: { cats: [], cells: [valEl ? valEl.textContent : ''] } },
            score: scoreEl ? parseFloat(scoreEl.textContent) || 0 : 0,
          };
        });
        var entry = saveSearch(query, results);
        renderSessions();
        saveBtn.textContent = '✓ Saved';
        setTimeout(function () { saveBtn.textContent = '💾 Save'; }, 1500);
      });

      exportBtn.addEventListener('click', function () {
        var query   = inputEl.value.trim();
        var cards   = resultsEl ? Array.from(resultsEl.querySelectorAll('.fm-card')) : [];
        var headers = ['rank', 'score', 'category', 'content'];
        var rows    = cards.map(function (card, i) {
          var scoreEl = card.querySelector('.fm-score-label');
          var catEl   = card.querySelector('.fm-cat-tag');
          var valEl   = card.querySelector('.fm-cell-value');
          return [i + 1, scoreEl ? scoreEl.textContent : '', catEl ? catEl.textContent : '', valEl ? valEl.textContent : ''];
        });
        var csv = '# Query: ' + query + '\n# Date: ' + new Date().toISOString() + '\n' +
                  rowsToCSV(headers, rows);
        downloadBlob(csv, 'search-' + query.slice(0, 30).replace(/\W+/g, '_') + '-' + Date.now() + '.csv', 'text/csv');
      });
    }

    // Inject saved sessions into the side panel
    var panelBody = document.querySelector('.pp-side-panel-body');
    if (panelBody) {
      var sessSection = document.createElement('div');
      sessSection.className = 'acad-sessions-section pp-side-panel-section';
      sessSection.id = 'acad-sessions-container';
      panelBody.appendChild(sessSection);
      renderSessions();
    }

    function renderSessions() {
      var container = document.getElementById('acad-sessions-container');
      if (!container) return;
      var searches = getSavedSearches();
      container.innerHTML = '<div class="acad-sessions-label pp-side-panel-section-label">Saved searches</div>';
      if (!searches.length) {
        container.innerHTML += '<div class="acad-no-sessions">No saved searches yet</div>';
        return;
      }
      searches.forEach(function (s) {
        var row = document.createElement('div');
        row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '4px';
        var btn = document.createElement('button');
        btn.className = 'acad-session-item';
        btn.innerHTML =
          '<span class="acad-session-query">' + (s.label || s.query) + '</span>' +
          '<span class="acad-session-meta">' + s.count + ' · ' + s.date + '</span>';
        btn.addEventListener('click', function () {
          if (inputEl) { inputEl.value = s.query; }
        });
        var delBtn = document.createElement('button');
        delBtn.className   = 'acad-session-del';
        delBtn.title       = 'Delete';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteSavedSearch(s.id);
          renderSessions();
        });
        row.appendChild(btn); row.appendChild(delBtn);
        container.appendChild(row);
      });
    }
  }

  // ── C)  SPREADSHEET PAGE — screening badges + DOI links + annotation ─────
  function injectSpreadsheetFeatures() {
    var dataBody = document.getElementById('data-body');
    if (!dataBody) return;

    _css('acad-ss-styles', `
      .acad-screen-badge {
        display: inline-flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
        font-size: 10px; cursor: pointer; border: none; transition: transform .12s;
        position: relative; z-index: 1;
      }
      .acad-screen-badge:hover { transform: scale(1.2); }
      .acad-screen-badge.included  { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
      .acad-screen-badge.excluded  { background: #fce4ec; color: #b71c1c; border: 1px solid #f48fb1; }
      .acad-screen-badge.unscreened{ background: var(--md-sys-color-surface-container-highest,#e6e0e9); color: var(--md-sys-color-on-surface-variant,#555); border: 1px solid transparent; }
      .acad-screen-col td { text-align: center !important; padding: 4px 6px !important; }
      .acad-screen-popover {
        position: fixed; z-index: 9999; background: var(--md-sys-color-surface-container,#f7f2fa);
        border: 1px solid var(--md-sys-color-outline-variant,rgba(0,0,0,.18)); border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,.18); padding: 12px; min-width: 200px;
        display: none;
      }
      .acad-screen-popover.open { display: block; }
      .acad-screen-pop-title { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px; }
      .acad-screen-btns { display: flex; gap: 6px; flex-wrap: wrap; }
      .acad-screen-pop-btn {
        flex: 1; min-width: 60px; height: 32px; border-radius: 16px; border: 1px solid transparent;
        font-size: 12px; font-weight: 500; cursor: pointer; transition: box-shadow .12s;
      }
      .acad-screen-pop-btn.include { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
      .acad-screen-pop-btn.exclude { background: #fce4ec; color: #b71c1c; border-color: #f48fb1; }
      .acad-screen-pop-btn.unscreen{ background: var(--md-sys-color-surface-container-highest,#e6e0e9); color: var(--md-sys-color-on-surface-variant,#555); }
      .acad-screen-pop-btn:hover { box-shadow: 0 1px 4px rgba(0,0,0,.18); }
      .acad-annot-area {
        width: 100%; margin-top: 8px; min-height: 50px; resize: vertical;
        border: 1px solid var(--md-sys-color-outline-variant,rgba(0,0,0,.18)); border-radius: 6px;
        padding: 6px 8px; font-size: 12px; background: transparent; color: inherit;
        font-family: inherit;
      }
      .acad-annot-area:focus { outline: none; border-color: var(--md-sys-color-primary,#6750a4); }
      .acad-doi-link { color: var(--md-sys-color-primary,#6750a4); text-decoration: none; font-weight: 500; }
      .acad-doi-link:hover { text-decoration: underline; }
      .acad-fetch-btn {
        font-size: 10px; color: var(--md-sys-color-secondary,#625b71);
        background: none; border: none; cursor: pointer; padding: 1px 4px;
        border-radius: 4px; text-decoration: underline;
      }
      .acad-progress-bar {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
        height: 28px; background: var(--md-sys-color-surface-container,#f7f2fa);
        border-top: 1px solid var(--md-sys-color-outline-variant,rgba(0,0,0,.12));
        display: flex; align-items: center; padding: 0 16px; gap: 12px; font-size: 11px;
      }
      .acad-progress-track { flex: 1; height: 6px; border-radius: 3px; background: var(--md-sys-color-secondary-container,#e8def8); overflow: hidden; }
      .acad-progress-fill-inc { height: 100%; background: #4caf50; float: left; transition: width .3s; }
      .acad-progress-fill-exc { height: 100%; background: #ef9a9a; float: left; transition: width .3s; }
      .acad-progress-label { white-space: nowrap; color: var(--md-sys-color-on-surface-variant,#555); }
      .acad-export-ss-btn {
        height: 24px; padding: 0 10px; border-radius: 12px;
        border: 1px solid var(--md-sys-color-outline-variant,rgba(0,0,0,.2));
        background: transparent; font-size: 11px; cursor: pointer; color: inherit;
      }
    `);

    // Progress bar at bottom
    var progressBar = document.createElement('div');
    progressBar.className = 'acad-progress-bar';
    progressBar.id = 'acad-progress-bar';
    progressBar.innerHTML =
      '<span class="acad-progress-label" id="acad-prog-label">Screening: –</span>' +
      '<div class="acad-progress-track"><div class="acad-progress-fill-inc" id="acad-prog-inc" style="width:0"></div><div class="acad-progress-fill-exc" id="acad-prog-exc" style="width:0"></div></div>' +
      '<span class="acad-progress-label" id="acad-prog-pct">0%</span>' +
      '<button class="acad-export-ss-btn" id="acad-export-ss-btn">↓ CSV</button>';
    document.body.appendChild(progressBar);

    document.getElementById('acad-export-ss-btn').addEventListener('click', exportSpreadsheetCSV);

    function updateProgressBar() {
      var p = getScreeningProgress();
      if (!p || !p.total) return;
      var screened = p.included + p.excluded;
      var pct = Math.round(screened / p.total * 100);
      document.getElementById('acad-prog-label').textContent =
        'Screening: ' + p.included + '✓  ' + p.excluded + '✗  ' + p.unscreened + '?';
      document.getElementById('acad-prog-inc').style.width = (p.included / p.total * 100) + '%';
      document.getElementById('acad-prog-exc').style.width = (p.excluded / p.total * 100) + '%';
      document.getElementById('acad-prog-pct').textContent = pct + '% screened';
    }

    // Popover for screening
    var popover = document.createElement('div');
    popover.className = 'acad-screen-popover';
    popover.id = 'acad-screen-popover';
    popover.innerHTML =
      '<div class="acad-screen-pop-title">Screening decision</div>' +
      '<div class="acad-screen-btns">' +
        '<button class="acad-screen-pop-btn include" data-status="included">✓ Include</button>' +
        '<button class="acad-screen-pop-btn exclude" data-status="excluded">✕ Exclude</button>' +
        '<button class="acad-screen-pop-btn unscreen" data-status="unscreened">? Unscreen</button>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:10px;color:var(--md-sys-color-on-surface-variant);font-weight:600;letter-spacing:.04em;text-transform:uppercase;">Reason / note</div>' +
      '<textarea class="acad-annot-area" id="acad-annot-ta" placeholder="Optional note…"></textarea>';
    document.body.appendChild(popover);

    var _activeTabIdx = null, _activeRowIdx = null;

    popover.querySelectorAll('.acad-screen-pop-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (_activeTabIdx === null) return;
        var reason = document.getElementById('acad-annot-ta').value;
        setAnnotation(_activeTabIdx, _activeRowIdx, reason);
        setScreeningStatus(_activeTabIdx, _activeRowIdx, btn.dataset.status, reason);
        updateBadge(_activeTabIdx, _activeRowIdx);
        updateProgressBar();
        closePopover();
      });
    });

    document.addEventListener('click', function (e) {
      if (!popover.contains(e.target) && !e.target.classList.contains('acad-screen-badge')) {
        closePopover();
      }
    });

    function closePopover() { popover.classList.remove('open'); _activeTabIdx = null; }

    function updateBadge(tabIdx, rowIdx) {
      var badge = document.querySelector('[data-tab-idx="' + tabIdx + '"][data-row-idx="' + rowIdx + '"]');
      if (!badge) return;
      var s = parseScreeningValue(localStorage.getItem(_screeningKey(tabIdx, rowIdx))).status;
      badge.className = 'acad-screen-badge ' + s;
      badge.title     = 'Status: ' + s + ' — click to change';
      badge.textContent = { included: '✓', excluded: '✕', unscreened: '○' }[s] || '○';
    }

    // DOI pattern
    var DOI_RE = /\b(10\.\d{4,}\/\S+)/g;

    // Watch for data-body changes (tab switches / initial render)
    var ssObs = new MutationObserver(function () {
      var rows = dataBody.querySelectorAll('tr');
      rows.forEach(function (tr, i) {
        if (tr.dataset.acadProcessed) return;
        tr.dataset.acadProcessed = '1';

        // Determine tabIdx/rowIdx from data attributes set by spreadsheet
        var tabIdx = parseInt(tr.dataset.tabIdx) || 0;
        var rowIdx = i;
        tr.dataset.tabIdx = tabIdx;
        tr.dataset.rowIdx = rowIdx;

        // Inject screening badge cell at start
        var badgeTd = document.createElement('td');
        badgeTd.style.cssText = 'text-align:center;padding:4px 6px;width:32px;min-width:32px;';
        var s = parseScreeningValue(localStorage.getItem(_screeningKey(tabIdx, rowIdx))).status;
        var badge = document.createElement('button');
        badge.className = 'acad-screen-badge ' + s;
        badge.setAttribute('data-tab-idx', tabIdx);
        badge.setAttribute('data-row-idx', rowIdx);
        badge.title       = 'Status: ' + s + ' — click to change';
        badge.textContent = { included: '✓', excluded: '✕', unscreened: '○' }[s] || '○';
        badge.addEventListener('click', function (e) {
          e.stopPropagation();
          _activeTabIdx = tabIdx; _activeRowIdx = rowIdx;
          document.getElementById('acad-annot-ta').value = getAnnotation(tabIdx, rowIdx);
          var r = badge.getBoundingClientRect();
          popover.style.left = Math.min(r.left, window.innerWidth - 230) + 'px';
          popover.style.top  = (r.bottom + 6) + 'px';
          popover.classList.add('open');
        });
        badgeTd.appendChild(badge);
        tr.insertBefore(badgeTd, tr.firstChild);

        // DOI-linkify all cells
        tr.querySelectorAll('td').forEach(function (td) {
          var text = td.textContent.trim();
          var doi  = normaliseDOI(text);
          if (doi) {
            var link = document.createElement('a');
            link.className  = 'acad-doi-link';
            link.href       = 'https://doi.org/' + doi;
            link.target     = '_blank';
            link.rel        = 'noopener';
            link.textContent = doi;
            // Also add a "Fetch metadata" button
            var fetchBtn = document.createElement('button');
            fetchBtn.className   = 'acad-fetch-btn';
            fetchBtn.textContent = 'fetch metadata';
            fetchBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              fetchBtn.textContent = 'fetching…';
              fetchBtn.disabled = true;
              resolveDOI(doi).then(function (meta) {
                fetchBtn.textContent = '✓ ' + meta.title.slice(0, 40);
                fetchBtn.title = JSON.stringify(meta, null, 2);
              }).catch(function (err) {
                fetchBtn.textContent = 'error';
                fetchBtn.title = err.message;
              });
            });
            td.textContent = '';
            td.appendChild(link);
            td.appendChild(document.createTextNode(' '));
            td.appendChild(fetchBtn);
          }
        });
      });

      // Add screening header column if missing
      var headerRow = document.getElementById('header-row');
      if (headerRow && !headerRow.querySelector('.acad-screen-th')) {
        var th = document.createElement('th');
        th.className   = 'acad-screen-th';
        th.textContent = '⚖';
        th.title       = 'Screening status';
        th.style.cssText = 'width:32px;min-width:32px;text-align:center;';
        headerRow.insertBefore(th, headerRow.firstChild);
      }

      updateProgressBar();
    });

    ssObs.observe(dataBody, { childList: true, subtree: false });
  }

  // ── D)  CLUSTERS PAGE — export button + silhouette score ────────────────
  function injectClusterFeatures() {
    var clPane = document.getElementById('cl-pane');
    if (!clPane) return;

    _css('acad-cl-styles', `
      .acad-cl-export-btn {
        width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
        border: none; background: transparent; border-radius: 50%; cursor: pointer;
        color: var(--md-sys-color-on-surface-variant); position: relative; overflow: hidden;
        transition: color .15s; flex-shrink: 0;
      }
      .acad-cl-export-btn::before {
        content: ''; position: absolute; inset: 0; border-radius: 50%;
        background: var(--md-sys-color-on-surface); opacity: 0; transition: opacity .15s;
      }
      .acad-cl-export-btn:hover::before { opacity: .08; }
      .acad-sil-badge {
        position: fixed; bottom: 12px; right: 12px; z-index: 100;
        background: var(--md-sys-color-surface-container, #f7f2fa);
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.18));
        border-radius: 20px; padding: 6px 14px;
        font-size: 11px; font-weight: 600; letter-spacing: .04em;
        color: var(--md-sys-color-on-surface-variant);
        display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 6px rgba(0,0,0,.12);
      }
      .acad-sil-score { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .acad-sil-score.good { color: #2e7d32; }
      .acad-sil-score.ok   { color: var(--md-sys-color-primary,#6750a4); }
      .acad-sil-score.poor { color: var(--md-sys-color-on-surface-variant,#666); }
    `);

    // Add export button to nav rail when it appears
    var railObs = new MutationObserver(function () {
      var rail = document.querySelector('.pp-nav-rail');
      if (!rail || rail.querySelector('.acad-cl-export-btn')) return;
      var exportBtn = document.createElement('button');
      exportBtn.className = 'acad-cl-export-btn pp-nav-rail-sheet-btn';
      exportBtn.title     = 'Export clusters as CSV';
      exportBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      exportBtn.addEventListener('click', exportClustersFromDOM);
      rail.insertBefore(exportBtn, rail.querySelector('div[style*="flex:1"]') || rail.lastChild);
    });
    railObs.observe(document.body, { childList: true, subtree: true });

    // Silhouette score badge: try to compute after embeddings are ready
    function trySilhouette() {
      var rows = typeof window._bridgeRows !== 'undefined' ? window._bridgeRows : null;
      if (!rows || !rows.length) return;

      // Group by cluster labels scraped from DOM
      var nests = document.querySelectorAll('.pp-cl-nest, [data-cluster-name]');
      if (!nests.length) return;

      var clusters = [];
      nests.forEach(function (nest) {
        var name  = (nest.querySelector('[class*="nest-header"]') || {}).textContent || '?';
        var items = [];
        nest.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function (card) {
          var text = card.textContent.trim().slice(0, 200);
          var row  = rows.find(function (r) {
            var cells = (r.row && r.row.cells) ? r.row.cells : (r.cells || []);
            return cells.some(function (c) { return c && text.includes(c.slice(0, 30)); });
          });
          if (row && row.vec) items.push({ vec: row.vec });
        });
        if (items.length >= 2) clusters.push({ label: name.trim(), items: items });
      });

      if (clusters.length < 2) return;
      var score = computeSilhouette(clusters);
      if (score === null) return;

      var badge = document.createElement('div');
      badge.className = 'acad-sil-badge';
      var cls  = score >= 0.5 ? 'good' : score >= 0.25 ? 'ok' : 'poor';
      var desc = score >= 0.5 ? 'Strong clusters' : score >= 0.25 ? 'Moderate clusters' : 'Weak clusters';
      badge.innerHTML =
        '<span>Silhouette</span>' +
        '<span class="acad-sil-score ' + cls + '">' + score.toFixed(3) + '</span>' +
        '<span>' + desc + '</span>';
      badge.title = 'Silhouette score measures how well-separated clusters are.\n1.0 = perfect, 0.0 = overlapping, −1.0 = wrong clusters';
      document.body.appendChild(badge);
    }

    window.addEventListener('embedding-complete', function () { setTimeout(trySilhouette, 2000); });
    document.addEventListener('embeddings-ready',  function () { setTimeout(trySilhouette, 2000); });
  }

  // ── E)  CONCEPT MAP PAGE — PNG/SVG export + node editing ────────────────
  function injectConceptMapFeatures() {
    var head = document.getElementById('pp-cmap-head');
    if (!head) return;

    _css('acad-cm-styles', `
      .acad-cm-export-row { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
      .acad-cm-btn {
        height: 28px; padding: 0 12px; border-radius: 14px;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.2));
        background: transparent; font-size: 11px; font-weight: 600; letter-spacing: .04em;
        color: var(--md-sys-color-on-surface-variant); cursor: pointer;
        transition: background .12s, color .12s;
      }
      .acad-cm-btn:hover {
        background: var(--md-sys-color-surface-container-high,#ece6f0);
        color: var(--md-sys-color-on-surface);
      }
    `);

    var exportRow = document.createElement('div');
    exportRow.className = 'acad-cm-export-row';

    var pngBtn = document.createElement('button');
    pngBtn.className   = 'acad-cm-btn';
    pngBtn.textContent = '↓ PNG snapshot';
    pngBtn.addEventListener('click', exportConceptMapPNG);

    var svgBtn = document.createElement('button');
    svgBtn.className   = 'acad-cm-btn';
    svgBtn.textContent = '↓ SVG (structure)';
    svgBtn.addEventListener('click', exportConceptMapSVG);

    exportRow.appendChild(pngBtn);
    exportRow.appendChild(svgBtn);
    head.appendChild(exportRow);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13.  AUTO-INIT — detect page and inject features
  // ══════════════════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function () {
    injectIndexFeatures();
    injectFindMatchesFeatures();
    injectSpreadsheetFeatures();
    injectClusterFeatures();
    injectConceptMapFeatures();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════
  return {
    resolveDOI:            resolveDOI,
    parseBibTeX:           parseBibTeX,
    parseCSVText:          parseCSVText,
    citationsToGrid:       citationsToGrid,
    validateSchema:        validateSchema,
    getScreeningStatus:    getScreeningStatus,
    setScreeningStatus:    setScreeningStatus,
    getScreeningProgress:  getScreeningProgress,
    getAnnotation:         getAnnotation,
    setAnnotation:         setAnnotation,
    getSavedSearches:      getSavedSearches,
    saveSearch:            saveSearch,
    deleteSavedSearch:     deleteSavedSearch,
    computeSilhouette:     computeSilhouette,
    exportClustersFromDOM: exportClustersFromDOM,
    exportSpreadsheetCSV:  exportSpreadsheetCSV,
    exportConceptMapPNG:   exportConceptMapPNG,
    exportConceptMapSVG:   exportConceptMapSVG,
    generateMethodsBlurb:  generateMethodsBlurb,
    downloadBlob:          downloadBlob,
    rowsToCSV:             rowsToCSV,
    loadImportedTabs:      loadImportedTabs,
    clearImportedTabs:     clearImportedTabs,
    normaliseDOI:          normaliseDOI,
  };
})();
