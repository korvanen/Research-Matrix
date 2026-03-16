// ════════════════════════════════════════════════════════════════════════════
// utils-synthesis.js  v3.0
// Unified data layer for Entries, Clusters, Framework, Concept Map tools.
// Adds: global settings (threshold, maxWords), split cell support,
//       SPLITS metadata persistence.
// ════════════════════════════════════════════════════════════════════════════
console.log('[utils-synthesis.js v3.0]');

window.SynthesisData = (function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  var AUTO_THRESHOLD    = 0.72;
  var SUGGEST_THRESHOLD = 0.50;
  var FRAMEWORK_PREFIX  = 'FRAMEWORK';
  var META_START        = '##META_START##';
  var META_END          = '##META_END##';
  var SPLIT_SEP         = '::split::';

  var COLORS = ['#9b2335','#7b3f9e','#1a6b8a','#2e6b3e','#b5451b','#4a5568','#1a5276','#6b4226'];

  // ── Storage keys ──────────────────────────────────────────────────────────
  var SK = {
    PRINCIPLES:  'sy2_principles',
    ASSIGNMENTS: 'sy2_assignments',
    SPLITS:      'sy2_splits',      // { parentKey: string[] of fragments }
    SETTINGS:    'sy2_settings',    // { threshold, maxWords }
    REGISTERS:   'sy2_registers',   // [{key,label}]
    DIMENSIONS:  'sy2_dimensions',  // string[]
    SCHEMA_DESC: 'sy2_schema_desc', // {registers:{key:desc}, dimensions:{name:desc}}
    SCRIPT_URL:  'sy2_script_url',
    LAST_SYNC:   'sy2_last_sync',
  };

  var DEFAULT_REGISTERS = [
    { key:'what', label:'WHAT?' },
    { key:'why',  label:'WHY?'  },
    { key:'who',  label:'WHO?'  },
    { key:'how',  label:'HOW?'  },
  ];
  var DEFAULT_DIMENSIONS = ['Physical','Social','Organisational','Temporal','Economic'];

  // ── Persistence ───────────────────────────────────────────────────────────
  function _load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch(e) { return def; }
  }
  function _save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('[synthesis] storage full:', e.message); }
  }
  function _id(pfx) {
    return (pfx||'x') + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }

  // ── Registers (WHAT/WHY/WHO/HOW) ─────────────────────────────────────────
  function getRegisters() {
    var stored = _load(SK.REGISTERS, null);
    return stored && stored.length ? stored : DEFAULT_REGISTERS.slice();
  }
  function setRegisters(regs) { _save(SK.REGISTERS, regs); }

  // Rename a register key's label. If newKey differs from oldKey, reassign entries.
  function updateRegister(oldKey, newKey, newLabel) {
    var regs = getRegisters().map(function(r){
      return r.key === oldKey ? { key: newKey, label: newLabel } : r;
    });
    setRegisters(regs);
    if (oldKey !== newKey) {
      _saveAssignments(getAssignments().map(function(a){
        return a.register === oldKey ? Object.assign({}, a, { register: newKey }) : a;
      }));
    }
  }

  // Delete a register — unassigns all entries that had that register
  function deleteRegister(key) {
    setRegisters(getRegisters().filter(function(r){ return r.key !== key; }));
    _saveAssignments(getAssignments().filter(function(a){ return a.register !== key; }));
  }

  function addRegister(key, label) {
    var regs = getRegisters();
    if (regs.find(function(r){ return r.key === key; })) return;
    regs.push({ key: key, label: label });
    setRegisters(regs);
  }

  // ── Schema descriptions (for registers, dimensions) ────────────────────
  function getSchemaDescriptions() {
    return _load(SK.SCHEMA_DESC, { registers:{}, dimensions:{} });
  }
  function setSchemaDescription(type, key, desc) {
    var sd = getSchemaDescriptions();
    if (!sd[type]) sd[type] = {};
    sd[type][key] = desc || '';
    _save(SK.SCHEMA_DESC, sd);
  }
  function getSchemaDescription(type, key) {
    var sd = getSchemaDescriptions();
    return (sd[type] && sd[type][key]) || '';
  }

  // ── Dimensions ────────────────────────────────────────────────────────────
  function getDimensions() {
    var stored = _load(SK.DIMENSIONS, null);
    return stored && stored.length ? stored : DEFAULT_DIMENSIONS.slice();
  }
  function setDimensions(dims) { _save(SK.DIMENSIONS, dims); }

  // Rename a dimension — updates all principles using the old name
  function updateDimension(oldName, newName) {
    setDimensions(getDimensions().map(function(d){ return d === oldName ? newName : d; }));
    _save(SK.PRINCIPLES, getPrinciples().map(function(p){
      return p.dimensionHint === oldName ? Object.assign({}, p, { dimensionHint: newName }) : p;
    }));
  }

  // Delete a dimension — unassigns all entries whose principle is in that dimension
  function deleteDimension(name) {
    setDimensions(getDimensions().filter(function(d){ return d !== name; }));
    var affectedIds = new Set(getPrinciples()
      .filter(function(p){ return p.dimensionHint === name; })
      .map(function(p){ return p.id; }));
    if (affectedIds.size) {
      _save(SK.PRINCIPLES, getPrinciples().map(function(p){
        return affectedIds.has(p.id) ? Object.assign({}, p, { dimensionHint: '' }) : p;
      }));
      _saveAssignments(getAssignments().filter(function(a){
        return !affectedIds.has(a.principleId);
      }));
    }
  }

  function addDimension(name) {
    var dims = getDimensions();
    if (!dims.includes(name)) { dims.push(name); setDimensions(dims); }
  }

  // ── Schema descriptions ─────────────────────────────────────────────────
  // Stored as { registers: {key: desc}, dimensions: {name: desc}, columns: {idx: desc} }
  function _getSchemaDesc() { return _load(SK.SCHEMA_DESC, { registers:{}, dimensions:{}, columns:{} }); }
  function _setSchemaDesc(d) { _save(SK.SCHEMA_DESC, d); }

  function getSchemaDescription(type, key) {
    var d = _getSchemaDesc();
    return (d[type] && d[type][key]) || '';
  }
  function setSchemaDescription(type, key, desc) {
    var d = _getSchemaDesc();
    if (!d[type]) d[type] = {};
    if (desc && desc.trim()) d[type][key] = desc.trim();
    else delete d[type][key];
    _setSchemaDesc(d);
  }
  // Get all descriptions as a flat array of {type, key, label, description} for embedding
  function getAllSchemaDescriptions() {
    var result = [];
    var d = _getSchemaDesc();
    var regs = getRegisters();
    regs.forEach(function(r) {
      var desc = (d.registers && d.registers[r.key]) || '';
      result.push({ type:'register', key:r.key, label:r.label, description:desc });
    });
    getDimensions().forEach(function(dim) {
      var desc = (d.dimensions && d.dimensions[dim]) || '';
      result.push({ type:'dimension', key:dim, label:dim, description:desc });
    });
    // Column titles
    var colKeys = ['0','1','2'];
    colKeys.forEach(function(k) {
      var desc = (d.columns && d.columns[k]) || '';
      if (desc) result.push({ type:'column', key:k, label:'Column '+(parseInt(k)+1), description:desc });
    });
    return result;
  }

  // ── Global settings ───────────────────────────────────────────────────────
  var _DEFAULT_SETTINGS = { threshold: 0.42, maxWords: 80 };

  function getSettings() {
    return Object.assign({}, _DEFAULT_SETTINGS, _load(SK.SETTINGS, {}));
  }
  function updateSettings(patch) {
    var s = getSettings();
    Object.assign(s, patch);
    _save(SK.SETTINGS, s);
    window.dispatchEvent(new CustomEvent('sy-settings-changed', { detail: s }));
    return s;
  }

  // ── ID generation ─────────────────────────────────────────────────────────
  function hashText(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (Math.imul(31,h) + str.charCodeAt(i))|0;
    return (h>>>0).toString(36);
  }

  function _sheetId() {
    var used = new Set(getPrinciples().map(function(p){ return p.sheetId; }).filter(Boolean));
    var id, attempts = 0;
    do {
      id = String(Math.floor(Math.random() * 9000 + 1000));
      if (++attempts > 900) throw new Error('Could not generate unique sheet ID.');
    } while (used.has(id));
    return id;
  }

  // ── Cell reference helpers ────────────────────────────────────────────────
  function colLetter(idx) {
    var s = '', n = idx + 1;
    while (n > 0) { n--; s = String.fromCharCode(65 + n%26) + s; n = Math.floor(n/26); }
    return s;
  }
  function cellRef(tabName, gridRow, gridCol) {
    return "='" + tabName.replace(/'/g,"''") + "'!" + colLetter(gridCol) + (gridRow + 1);
  }

  // ── Note keys ─────────────────────────────────────────────────────────────
  // Base:  "tabName::dataRowIdx::cellIdx"
  // Split: "tabName::dataRowIdx::cellIdx::split::N"  (N = 0-based fragment index)

  function makeNoteKey(tabName, dataRowIdx, cellIdx) {
    return tabName + '::' + dataRowIdx + '::' + cellIdx;
  }
  function makeSplitKey(parentKey, fragmentIdx) {
    return parentKey + SPLIT_SEP + fragmentIdx;
  }
  function isSplitKey(key) {
    return key && key.indexOf(SPLIT_SEP) !== -1;
  }
  function splitKeyParts(key) {
    var idx = key.indexOf(SPLIT_SEP);
    return { parentKey: key.slice(0, idx), fragmentIdx: parseInt(key.slice(idx + SPLIT_SEP.length)) };
  }
  function parseNoteKey(key) {
    if (!key || typeof key !== 'string') return { tabName:'', dataRowIdx:0, cellIdx:0 };
    var base = isSplitKey(key) ? splitKeyParts(key).parentKey : key;
    var parts = base.split('::');
    return { tabName: parts[0], dataRowIdx: parseInt(parts[1]), cellIdx: parseInt(parts[2]) };
  }

  // ── Splits storage ────────────────────────────────────────────────────────
  // Map of parentKey → string[] of fragments (stored in localStorage)

  function getSplits() { return _load(SK.SPLITS, {}); }

  function getFragments(parentKey) {
    return getSplits()[parentKey] || null;
  }

  function storeSplit(parentKey, fragments) {
    var splits = getSplits();
    splits[parentKey] = fragments;
    _save(SK.SPLITS, splits);
  }

  function removeSplit(parentKey) {
    var splits = getSplits();
    delete splits[parentKey];
    _save(SK.SPLITS, splits);
    // Also remove any child assignments
    var as = getAssignments().filter(function(a){
      return !isSplitKey(a.noteKey) || splitKeyParts(a.noteKey).parentKey !== parentKey;
    });
    _saveAssignments(as);
  }

  // Split a note into fragments using simple sentence boundary detection.
  // Only applies to unassigned notes. Returns the fragment noteKeys.
  // ── Proper sentence boundary detector (matches utils-concept-map.js) ─────
  var _ABBREV = new Set([
    'mr','mrs','ms','dr','prof','sr','jr','vs','etc','approx','est','dept',
    'fig','no','vol','pp','ed','eds','ibid','op','cf','al','et',
    'jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec',
    'st','ave','blvd','co','corp','inc','ltd','govt','univ','assoc',
  ]);

  function _sentenceSplit(text) {
    var sentences = [], start = 0;
    var t = text.replace(/\r\n|\r/g, '\n');
    var parenDepth = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      // Track parenthesis nesting — never split inside parens
      if (ch === '(') { parenDepth++; continue; }
      if (ch === ')') { if (parenDepth > 0) parenDepth--; continue; }
      if (parenDepth > 0) continue;
      // Double-newline paragraph break
      if (ch === '\n' && t[i+1] === '\n') {
        var seg = t.slice(start, i).trim();
        if (seg.length >= 20) sentences.push(seg);
        while (i+1 < t.length && t[i+1] === '\n') i++;
        start = i + 1; continue;
      }
      if (ch !== '.' && ch !== '!' && ch !== '?') continue;
      // Must be followed by whitespace + uppercase (next sentence)
      var after = t.slice(i+1).match(/^(\s+)([A-Z])/);
      if (!after) continue;
      // Avoid splitting on abbreviations (e.g., i.e., etc.)
      var wordBefore = t.slice(0, i).match(/(\b\w+)$/);
      if (wordBefore) {
        var w = wordBefore[1];
        if (_ABBREV.has(w.toLowerCase())) continue;
        if (w.length === 1 && w === w.toUpperCase()) continue;
      }
      // Avoid splitting after numbers (e.g. "p. 23. The...")
      if (/\d$/.test(t.slice(0, i))) continue;
      var seg2 = t.slice(start, i+1).trim();
      if (seg2.length >= 20) sentences.push(seg2);
      start = i + 1;
    }
    var last = t.slice(start).trim();
    if (last.length >= 20) sentences.push(last);
    // If we only got one segment or none, the text is effectively one sentence
    return sentences;
  }

  function splitNote(parentKey) {
    if (isSplitKey(parentKey)) return [];
    var existing = getAssignment(parentKey);
    if (existing && existing.status === 'confirmed') return []; // Option D: never split assigned
    var resolved = resolveNoteKey(parentKey);
    if (!resolved || !resolved.text.trim()) return [];

    var rawText  = resolved.text.trim();
    var settings = getSettings();
    var wordCount = rawText.split(/\s+/).length;
    if (wordCount <= settings.maxWords) return [];

    // Strip the trailing citation "(Author, Year)" before splitting.
    // The regex matches only the LAST parenthetical at end-of-string.
    var citation  = null;
    var bodyText  = rawText;
    var _cRe      = /\s*\(([^()]+)\)\s*\.?\s*$/;
    var _cMatch   = _cRe.exec(rawText);
    if (_cMatch) {
      bodyText = rawText.slice(0, _cMatch.index).trimEnd();
      citation = _cMatch[1];
    }

    // Get proper sentence-boundary segments
    var sentences = _sentenceSplit(bodyText);

    // Group consecutive sentences into chunks that stay ≤ maxWords.
    // Sentence-integrity rule: a single sentence that exceeds maxWords is kept
    // whole — we never break mid-sentence. Such a fragment may exceed maxWords.
    var chunks = [], current = [], currentLen = 0;
    sentences.forEach(function(s) {
      var wc = s.split(/\s+/).length;
      if (currentLen > 0 && currentLen + wc > settings.maxWords) {
        chunks.push(current.join(' '));
        current = [s]; currentLen = wc;
      } else {
        current.push(s); currentLen += wc;
      }
    });
    if (current.length) chunks.push(current.join(' '));

    // Fallback: if sentence detection couldn't find any boundaries (e.g. one
    // massive run-on), hard-split at maxWords word boundary
    if (chunks.length <= 1 && wordCount > settings.maxWords) {
      var words = bodyText.split(/\s+/);
      chunks = [];
      while (words.length) {
        chunks.push(words.splice(0, settings.maxWords).join(' '));
      }
    }

    if (chunks.length <= 1) return [];

    // Re-append the parent citation to each fragment that does not already
    // contain its own in-text citation. Uses extractAllCitations if available
    // for robust detection, otherwise falls back to a trailing-paren check.
    if (citation) {
      var _hasCitation = (typeof extractAllCitations === 'function')
        ? function(ch) { return extractAllCitations(ch).length > 0; }
        : function(ch) { return /\([^()]+\)\s*\.?\s*$/.test(ch); };
      chunks = chunks.map(function(ch) {
        return _hasCitation(ch) ? ch : ch + ' (' + citation + ')';
      });
    }

    storeSplit(parentKey, chunks);
    return chunks.map(function(_, i) { return makeSplitKey(parentKey, i); });
  }

  // Auto-split all unassigned notes that exceed maxWords. Called when settings change.
  function autoSplitAll() {
    var settings  = getSettings();
    var assigned  = new Set(getAssignments().map(function(a){ return a.noteKey; }));
    var existing  = getSplits();
    var changed   = false;

    getRowNoteKeys().forEach(function(key) {
      if (assigned.has(key)) return; // never split assigned parent

      // If this key has existing splits, check if any fragment is assigned
      if (existing[key]) {
        var anyFragAssigned = false;
        existing[key].forEach(function(_, i) {
          if (assigned.has(makeSplitKey(key, i))) anyFragAssigned = true;
        });
        if (anyFragAssigned) return; // preserve splits with assigned fragments
      }

      var r = resolveNoteKey(key); if (!r || !r.text.trim()) return;
      var wordCount = r.text.trim().split(/\s+/).length;

      if (wordCount > settings.maxWords) {
        splitNote(key);
        changed = true;
      } else if (existing[key]) {
        // Entry now fits under threshold and no fragments assigned — remove split
        removeSplit(key);
        changed = true;
      }
    });
    return changed;
  }

  // ── Note key resolution ───────────────────────────────────────────────────
  function resolveNoteKey(key) {
    if (!key || typeof key !== 'string' || key.indexOf('::') === -1) {
      console.error('[synthesis] resolveNoteKey: bad key:', key);
      return null;
    }

    // Handle split keys
    if (isSplitKey(key)) {
      var parts   = splitKeyParts(key);
      var frags   = getFragments(parts.parentKey);
      if (!frags || !frags[parts.fragmentIdx]) return null;
      var parent  = resolveNoteKey(parts.parentKey);
      if (!parent) return null;
      return Object.assign({}, parent, {
        text:    frags[parts.fragmentIdx],
        isSplit: true,
        splitIdx: parts.fragmentIdx,
        splitTotal: frags.length,
        parentKey: parts.parentKey,
        noteKey: key,
      });
    }

    // Base key
    var p   = parseNoteKey(key);
    var tab = (window.TABS||[]).find(function(t){ return t.name === p.tabName; });
    if (!tab) return null;
    var data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data || !data.rows[p.dataRowIdx]) return null;
    var row  = data.rows[p.dataRowIdx];
    var cell = row.cells[p.cellIdx] || '';
    var grid = tab.grid;

    // gridCol: count COLUMN entries in flag row
    var flagRow = grid[0] || [];
    var colCount = 0, gridCol = -1;
    for (var fi = 0; fi < flagRow.length; fi++) {
      if (String(flagRow[fi]||'').trim() === 'COLUMN') {
        if (colCount === p.cellIdx) { gridCol = fi; break; }
        colCount++;
      }
    }
    if (gridCol === -1) gridCol = (data.colIndices && data.colIndices[p.cellIdx] !== undefined) ? data.colIndices[p.cellIdx] : p.cellIdx;

    // catIndices from flag row
    var catIndices = [];
    for (var fi = 0; fi < flagRow.length; fi++) {
      if (String(flagRow[fi]||'').trim() === 'CATEGORY') catIndices.push(fi);
    }
    var catIdx0 = catIndices.length ? catIndices[0] : 0;

    // headerRowIdx: row where catIdx0 cell says 'HEADER ROW'
    var headerRowIdx = -1;
    for (var ri = 1; ri < grid.length; ri++) {
      if (String((grid[ri]||[])[0]||'').trim() === 'HEADER ROW') { headerRowIdx = ri; break; }
    }
    if (headerRowIdx === -1) headerRowIdx = 2;

    // gridRow: walk grid counting non-skipped rows
    var found = -1, count = 0;
    for (var r = headerRowIdx + 1; r < grid.length; r++) {
      var g = grid[r] || [];
      if (g.every(function(cv){ return !String(cv).trim(); })) continue;
      if (!String(g[catIdx0]||'').trim()) continue;
      if (count === p.dataRowIdx) { found = r; break; }
      count++;
    }
    var gridRow = found !== -1 ? found : (headerRowIdx + p.dataRowIdx + 1);

    return {
      noteKey:    key,
      text:       cell,
      cats:       row.cats,
      allCells:   row.cells,
      headers:    data.headers,
      tabName:    p.tabName,
      tabTitle:   data.title || p.tabName,
      dataRowIdx: p.dataRowIdx,
      cellIdx:    p.cellIdx,
      gridRow:    gridRow,
      gridCol:    gridCol,
      isSplit:    false,
    };
  }

  // ── All note keys (including split children for unassigned long notes) ─────
  function bestCellIdx(rowCells) {
    var best = 0, bestLen = 0;
    rowCells.forEach(function(c,i){ if(c&&c.trim().length>bestLen){bestLen=c.trim().length;best=i;} });
    return best;
  }

  function getRowNoteKeys() {
    var keys = [];
    (window.TABS||[]).forEach(function(tab) {
      var data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
      if (!data) return;
      data.rows.forEach(function(row, ri) {
        var ci = bestCellIdx(row.cells);
        if (row.cells[ci] && row.cells[ci].trim().length > 5)
          keys.push(makeNoteKey(tab.name, ri, ci));
      });
    });
    return keys;
  }

  // Returns effective keys for clustering/embedding:
  // - assigned notes: as-is (never split, Option D)
  // - unassigned notes with stored split: their split children
  // - unassigned notes without split: as-is
  function getEffectiveNoteKeys() {
    var assignments = getAssignments();
    var assigned    = new Set(assignments.map(function(a){ return a.noteKey; }));
    var splits      = getSplits();
    var keys        = [];
    getRowNoteKeys().forEach(function(key) {
      if (assigned.has(key)) {
        keys.push(key);
      } else if (splits[key]) {
        splits[key].forEach(function(_, i){ keys.push(makeSplitKey(key, i)); });
      } else {
        keys.push(key);
      }
    });
    return keys;
  }

  // ── Principles ────────────────────────────────────────────────────────────
  function getPrinciples() { return _load(SK.PRINCIPLES, []); }

  function addPrinciple(data) {
    var ps  = getPrinciples();
    var seq = ps.filter(function(p){ return !p.archived; }).length + 1;
    var rawName = String(data.name||'').trim();
    var pid = _id('p');
    if (!rawName) rawName = 'Principle – ' + pid.slice(1,7).toUpperCase();
    var p   = {
      id: pid, sheetId: _sheetId(),
      name: rawName, named: true,
      description: String(data.description||'').trim(),
      dimensionHint: String(data.dimensionHint||'').trim(),
      color: data.color || COLORS[(seq-1) % COLORS.length],
      move:'', metric:'',
      moveByReg:   {what:'',why:'',who:'',how:''},
      metricByReg: {what:'',why:'',who:'',how:''},
      archived:false, seq:seq, ts:Date.now(),
    };
    ps.push(p); _save(SK.PRINCIPLES, ps); return p;
  }

  function updatePrinciple(id, fields) {
    var ps = getPrinciples().map(function(p){ return p.id===id ? Object.assign({},p,fields) : p; });
    _save(SK.PRINCIPLES, ps);
    return ps.find(function(p){ return p.id===id; }) || null;
  }

  function deletePrinciple(id) {
    var as = getAssignments().map(function(a){
      return a.principleId===id ? Object.assign({},a,{principleId:null,status:'unassigned'}) : a;
    });
    _save(SK.ASSIGNMENTS, as);
    _save(SK.PRINCIPLES, getPrinciples().filter(function(p){ return p.id!==id; }));
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  function getAssignments() {
    var raw = _load(SK.ASSIGNMENTS, []);
    return raw.filter(function(a) {
      if (!a.noteKey || typeof a.noteKey !== 'string') return false;
      return true;
    });
  }
  function _saveAssignments(as) { _save(SK.ASSIGNMENTS, as); }

  function getAssignment(noteKey) {
    return getAssignments().find(function(a){ return a.noteKey===noteKey; }) || null;
  }

  function setAssignment(noteKey, principleId, register, status, similarity, column) {
    var as = getAssignments().filter(function(a){ return a.noteKey!==noteKey; });
    if (principleId) {
      var resolved = resolveNoteKey(noteKey);
      as.push({
        id: _id('a'), noteKey: noteKey, principleId: principleId,
        register: register||'what', column: (column != null) ? column : 0,
        status: status||'confirmed',
        similarity: similarity||null,
        contentHash: resolved ? hashText(resolved.text) : null,
        ts: Date.now(),
      });
    }
    _saveAssignments(as);
  }

  function confirmAssignment(noteKey) {
    _saveAssignments(getAssignments().map(function(a){
      return a.noteKey===noteKey ? Object.assign({},a,{status:'confirmed'}) : a;
    }));
  }
  function rejectAssignment(noteKey) {
    _saveAssignments(getAssignments().filter(function(a){ return a.noteKey!==noteKey; }));
  }
  function updateAssignmentRegister(noteKey, register) {
    _saveAssignments(getAssignments().map(function(a){
      return a.noteKey===noteKey ? Object.assign({},a,{register:register}) : a;
    }));
  }
  function updateAssignmentColumn(noteKey, column) {
    _saveAssignments(getAssignments().map(function(a){
      return a.noteKey===noteKey ? Object.assign({},a,{column:column}) : a;
    }));
  }

  // ── Change detection ──────────────────────────────────────────────────────
  function getChangedSources() {
    var changed = [];
    getAssignments().forEach(function(a) {
      if (a.status !== 'confirmed' || !a.contentHash) return;
      if (isSplitKey(a.noteKey)) return; // splits checked via parent
      var r = resolveNoteKey(a.noteKey);
      if (!r) { changed.push({ noteKey:a.noteKey, reason:'source tab missing', a:a }); return; }
      if (hashText(r.text) !== a.contentHash) changed.push({ noteKey:a.noteKey, reason:'content changed', newText:r.text, a:a });
    });
    return changed;
  }

  function acknowledgeChangedSource(noteKey) {
    var r = resolveNoteKey(noteKey);
    _saveAssignments(getAssignments().map(function(a){
      return a.noteKey===noteKey
        ? Object.assign({},a,{contentHash: r ? hashText(r.text) : a.contentHash, status:'confirmed'})
        : a;
    }));
  }

  // ── Register heuristic ────────────────────────────────────────────────────
  var _WHO = /\b(resident|inhabitant|architect|user|communit|people|person|occupant|famil|household|designer|dweller|neighbou?r|individual|collective|owner|stakeholder|tenant|citizen|client|organisation|organization)\w*\b/i;
  var _WHY = /\b(because|enabl|allow|encourage|support|leads?\s+to|foster|promot|facilitat|prevent|reduc|increas|improv|creat|generat)\w*\b/i;
  var _HOW = /\b(by\s|through\s|using\s|via\s|combin|integrat|apply|implement|designing|providing|placing|arrang|configur|layer|graduat|interlock)\w*\b/i;

  function suggestRegister(text) {
    if (!text) return 'what';
    if (_WHO.test(text)) return 'who';
    if (_WHY.test(text)) return 'why';
    if (_HOW.test(text)) return 'how';
    return 'what';
  }

  // Embedding-based register suggestion: compares entry vector against
  // register description embeddings stored as __rdesc__<key> in the map.
  // Falls back to keyword heuristic if no embeddings available.
  function suggestRegisterByVec(vec, embeddings) {
    if (!vec || !embeddings) return null;
    var regs = getRegisters();
    var best = null, bestSim = 0.30;
    regs.forEach(function(r) {
      var rv = embeddings.get('__rdesc__' + r.key);
      if (!rv) return;
      var sim = cosine(vec, rv);
      if (sim > bestSim) { bestSim = sim; best = r.key; }
    });
    return best;
  }

  // Embedding-based column suggestion: compares entry vector against
  // column title+description embeddings stored as __cdesc__0, __cdesc__1, __cdesc__2.
  function suggestColumnByVec(vec, embeddings) {
    if (!vec || !embeddings) return 0;
    var best = 0, bestSim = 0.30;
    for (var ci = 0; ci < 3; ci++) {
      var cv = embeddings.get('__cdesc__' + ci);
      if (!cv) continue;
      var sim = cosine(vec, cv);
      if (sim > bestSim) { bestSim = sim; best = ci; }
    }
    return best;
  }

  // Full semantic placement: suggests register + column.
  // Uses embeddings when available, falls back to keywords for register.
  function suggestPlacement(vec, text, embeddings) {
    var a = analyzePlacement(vec, text, embeddings);
    return { register: a.register.key, column: a.column.index };
  }

  // Comprehensive placement analysis: returns all similarity scores for
  // registers, columns, dimensions, and principles.
  // Used by UI to show semantic similarity breakdown.
  function analyzePlacement(vec, text, embeddings) {
    var result = {
      register:   { key: 'what', scores: [] },
      column:     { index: 0, scores: [] },
      dimension:  { name: null, scores: [] },
      principles: [],  // [{id, name, color, similarity}] sorted by similarity
    };

    var regs = getRegisters();
    var dims = getDimensions();

    // Register similarities
    if (vec && embeddings) {
      var bestReg = null, bestRegSim = 0;
      regs.forEach(function(r) {
        var rv = embeddings.get('__rdesc__' + r.key);
        var sim = rv ? cosine(vec, rv) : 0;
        result.register.scores.push({ key: r.key, label: r.label, sim: sim });
        if (sim > bestRegSim) { bestRegSim = sim; bestReg = r.key; }
      });
      result.register.scores.sort(function(a,b){ return b.sim - a.sim; });
      if (bestReg && bestRegSim > 0.30) result.register.key = bestReg;
    }
    // Fallback to keyword
    if (!result.register.scores.length || result.register.scores[0].sim < 0.30) {
      result.register.key = suggestRegister(text || '');
    }

    // Column similarities
    if (vec && embeddings) {
      var bestCol = 0, bestColSim = 0;
      for (var ci = 0; ci < 3; ci++) {
        var cv = embeddings.get('__cdesc__' + ci);
        var sim = cv ? cosine(vec, cv) : 0;
        result.column.scores.push({ index: ci, sim: sim });
        if (sim > bestColSim) { bestColSim = sim; bestCol = ci; }
      }
      result.column.scores.sort(function(a,b){ return b.sim - a.sim; });
      if (bestColSim > 0.30) result.column.index = bestCol;
    }

    // Dimension similarities
    if (vec && embeddings) {
      var bestDim = null, bestDimSim = 0;
      dims.forEach(function(d) {
        var dv = embeddings.get('__ddesc__' + d);
        var sim = dv ? cosine(vec, dv) : 0;
        result.dimension.scores.push({ name: d, sim: sim });
        if (sim > bestDimSim) { bestDimSim = sim; bestDim = d; }
      });
      result.dimension.scores.sort(function(a,b){ return b.sim - a.sim; });
      if (bestDim && bestDimSim > 0.30) result.dimension.name = bestDim;
    }

    // Principle similarities
    if (vec && embeddings) {
      var pvecs = buildPrincipleVectors(embeddings);
      pvecs.forEach(function(pv) {
        var sim = pv.centroid ? cosine(vec, pv.centroid) : 0;
        result.principles.push({
          id: pv.principle.id, name: pv.principle.name,
          color: pv.principle.color, dimensionHint: pv.principle.dimensionHint,
          similarity: sim,
        });
      });
      result.principles.sort(function(a,b){ return b.similarity - a.similarity; });
    }

    return result;
  }

  // ── Auto-label ────────────────────────────────────────────────────────────
  var STOP = new Set(['a','an','the','is','are','was','were','be','been','have','has','had',
    'and','but','or','for','in','on','at','to','of','as','by','from','with','into','through',
    'that','this','these','those','which','when','where','space','design','spatial','area',
    'zone','place','between','within','not','also','just','very','it','its','they','their']);

  function autoLabel(texts) {
    var freq = {};
    texts.forEach(function(t){
      (t||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w){
        if (w.length>3 && !STOP.has(w)) freq[w]=(freq[w]||0)+1;
      });
    });
    return Object.keys(freq).sort(function(a,b){return freq[b]-freq[a];}).slice(0,4).join(' / ') || 'unlabelled';
  }

  // ── Vector maths ──────────────────────────────────────────────────────────
  function cosine(a,b) {
    if(!a||!b||a.length!==b.length) return 0;
    var dot=0,na=0,nb=0;
    for(var i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
    var d=Math.sqrt(na)*Math.sqrt(nb); return d<1e-10?0:dot/d;
  }
  function centroid(vecs) {
    if(!vecs.length) return null;
    var len=vecs[0].length, sum=new Float32Array(len);
    vecs.forEach(function(v){for(var i=0;i<len;i++)sum[i]+=v[i];});
    var norm=0; for(var i=0;i<len;i++) norm+=sum[i]*sum[i]; norm=Math.sqrt(norm);
    if(norm>1e-10) for(var i=0;i<len;i++) sum[i]/=norm;
    return sum;
  }

  // ── Agglomerative clustering ──────────────────────────────────────────────
  function cluster(items, threshold) {
    threshold = threshold !== undefined ? threshold : getSettings().threshold;
    if (!items.length) return [];
    var cs = items.map(function(it){ return { ids:[it.id], vecs:[it.vec] }; });
    var changed=true, limit=items.length*items.length+10, iter=0;
    while (changed && iter++<limit) {
      changed=false; var bi=-1,bj=-1,bs=threshold;
      for(var i=0;i<cs.length;i++)
        for(var j=i+1;j<cs.length;j++){
          var tot=0,cnt=0;
          for(var ii=0;ii<cs[i].vecs.length;ii++)
            for(var jj=0;jj<cs[j].vecs.length;jj++){tot+=cosine(cs[i].vecs[ii],cs[j].vecs[jj]);cnt++;}
          var avg=cnt>0?tot/cnt:0; if(avg>bs){bs=avg;bi=i;bj=j;}
        }
      if(bi!==-1){cs.splice(bi,1,{ids:cs[bi].ids.concat(cs[bj].ids),vecs:cs[bi].vecs.concat(cs[bj].vecs)});cs.splice(bj,1);changed=true;}
    }
    return cs.map(function(c){return{noteKeys:c.ids,centroid:centroid(c.vecs)};});
  }

  // ── Auto-assignment tiers ─────────────────────────────────────────────────
  // Returns text that should be embedded for a principle (name + description)
  function getPrincipleEmbedText(p) {
    var text = p.name || '';
    if (p.description) text += '. ' + p.description;
    return text.trim();
  }

  function buildPrincipleVectors(embeddings) {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    return principles.map(function(p){
      var vecs = assignments.filter(function(a){return a.principleId===p.id;})
        .map(function(a){return embeddings.get(a.noteKey);}).filter(Boolean);
      // Include principle description embedding
      var descVec = embeddings.get('__pdesc__' + p.id);
      if (descVec) vecs.push(descVec);
      // Include dimension description embedding
      if (p.dimensionHint) {
        var dimVec = embeddings.get('__ddesc__' + p.dimensionHint);
        if (dimVec) vecs.push(dimVec);
      }
      return { principle:p, centroid: vecs.length ? centroid(vecs) : null };
    }).filter(function(pv){return pv.centroid!==null;});
  }

  function computeAssignmentTiers(items, principleVectors) {
    var result = { auto:[], suggested:[], conflicts:[], unassigned:[] };
    items.forEach(function(item){
      var scores = principleVectors
        .map(function(pv){ return {principle:pv.principle, sim:pv.centroid?cosine(item.vec,pv.centroid):0}; })
        .filter(function(s){return s.sim>=SUGGEST_THRESHOLD;})
        .sort(function(a,b){return b.sim-a.sim;});
      if (!scores.length) { result.unassigned.push(item); }
      else if (scores.length>=2 && scores[1].sim>=SUGGEST_THRESHOLD) { result.conflicts.push(Object.assign({},item,{matches:scores.slice(0,3)})); }
      else if (scores[0].sim>=AUTO_THRESHOLD) { result.auto.push(Object.assign({},item,{match:scores[0]})); }
      else { result.suggested.push(Object.assign({},item,{match:scores[0]})); }
    });
    return result;
  }

  // ── FRAMEWORK tab: parse ──────────────────────────────────────────────────
  function parseFrameworkTab(grid) {
    if (!grid||!grid.length) return null;
    var metaStart=-1, metaEnd=-1;
    for(var r=0;r<grid.length;r++){
      var c=String(grid[r][0]||'').trim();
      if(c===META_START) metaStart=r;
      if(c===META_END)   metaEnd=r;
    }
    if(metaStart===-1||metaEnd===-1||metaEnd<=metaStart) return null;
    var principles=[], assignments=[], splits={}, settings=null, registers=null, dimensions=null, schemaDesc=null, colTitles=null, references=null, refOverrides=null;
    for(var r=metaStart+1;r<metaEnd;r++){
      var key=String(grid[r][0]||'').trim(), val=String(grid[r][1]||'').trim();
      if(!val) continue;
      try {
        if(key==='PRINCIPLES')  principles  = JSON.parse(val);
        if(key==='ASSIGNMENTS') assignments = JSON.parse(val);
        if(key==='SPLITS')      splits      = JSON.parse(val);
        if(key==='SETTINGS')    settings    = JSON.parse(val);
        if(key==='REGISTERS')   registers   = JSON.parse(val);
        if(key==='DIMENSIONS')  dimensions  = JSON.parse(val);
        if(key==='SCHEMA_DESC') schemaDesc  = JSON.parse(val);
        if(key==='COL_TITLES')  colTitles   = JSON.parse(val);
        if(key==='REFERENCES')  references  = JSON.parse(val);
        if(key==='REF_OVERRIDES') refOverrides = JSON.parse(val);
      } catch(e){}
    }
    return { principles, assignments, splits, settings, registers, dimensions, schemaDesc, colTitles, references, refOverrides };
  }

  function loadFromFrameworkTab(grid) {
    var parsed = parseFrameworkTab(grid);
    if (!parsed) return false;

    // Merge principles (sheet wins for named/move/metric, local wins for unsaved work)
    var existing = getPrinciples();
    var merged = parsed.principles.map(function(sp){
      var lp = existing.find(function(p){return p.id===sp.id;});
      return Object.assign({}, sp, lp ? {move:lp.move||sp.move, metric:lp.metric||sp.metric,
        moveByReg:lp.moveByReg||sp.moveByReg, metricByReg:lp.metricByReg||sp.metricByReg} : {});
    });
    existing.forEach(function(p){ if(!merged.find(function(m){return m.id===p.id;})) merged.push(p); });
    _save(SK.PRINCIPLES, merged);

    // Merge assignments
    var localAs = getAssignments();
    var mergedAs = parsed.assignments.slice();
    localAs.forEach(function(a){ if(!mergedAs.find(function(m){return m.noteKey===a.noteKey;})) mergedAs.push(a); });
    _saveAssignments(mergedAs);

    // Restore splits
    if (parsed.splits && Object.keys(parsed.splits).length) {
      var localSplits = getSplits();
      Object.keys(parsed.splits).forEach(function(k){
        if (!localSplits[k]) localSplits[k] = parsed.splits[k];
      });
      _save(SK.SPLITS, localSplits);
    }

    // Restore settings only if localStorage has no user-set values yet.
    if (parsed.settings) {
      var localRaw = _load(SK.SETTINGS, null);
      if (!localRaw) {
        updateSettings(parsed.settings);
      }
    }

    // Restore registers, dimensions, schema descriptions (sheet seeds, local wins)
    if (parsed.registers && parsed.registers.length) {
      var localRegs = _load(SK.REGISTERS, null);
      if (!localRegs) setRegisters(parsed.registers);
    }
    if (parsed.dimensions && parsed.dimensions.length) {
      var localDims = _load(SK.DIMENSIONS, null);
      if (!localDims) setDimensions(parsed.dimensions);
    }
    if (parsed.schemaDesc) {
      var localSD = _load(SK.SCHEMA_DESC, null);
      if (!localSD) _save(SK.SCHEMA_DESC, parsed.schemaDesc);
    }
    if (parsed.colTitles && Array.isArray(parsed.colTitles)) {
      try { if (!localStorage.getItem('df_fw_col_titles')) localStorage.setItem('df_fw_col_titles', JSON.stringify(parsed.colTitles)); } catch(e){}
    }

    // Restore references and overrides (seed from sheet, local wins)
    var AC = window.AcademicUtils;
    if (AC && parsed.references && parsed.references.length) {
      var localRefs = typeof AC.getReferences === 'function' ? AC.getReferences() : [];
      if (!localRefs.length) {
        if (typeof AC.setReferences === 'function') AC.setReferences(parsed.references);
      }
    }
    if (AC && parsed.refOverrides && Object.keys(parsed.refOverrides).length) {
      var localOv = typeof AC.getRefOverrides === 'function' ? AC.getRefOverrides() : {};
      if (!Object.keys(localOv).length) {
        if (typeof AC.setRefOverrides === 'function') AC.setRefOverrides(parsed.refOverrides);
      }
    }

    return true;
  }

  // ── FRAMEWORK tab: build ──────────────────────────────────────────────────
  function buildFrameworkGrid() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var splits      = getSplits();
    var settings    = getSettings();
    var regs        = getRegisters();
    var dims        = getDimensions();
    var schemaDesc  = getSchemaDescriptions();
    var REGS        = regs.map(function(r){ return r.key; });
    var REG_LABEL   = {};
    regs.forEach(function(r){ REG_LABEL[r.key] = r.label; });

    // Column titles from localStorage (framework.html stores these)
    var colTitles;
    try { colTitles = JSON.parse(localStorage.getItem('df_fw_col_titles')); } catch(e){}
    if (!Array.isArray(colTitles) || colTitles.length !== 3) colTitles = ['Rule / Constraint','Move / Intervention','Metric / Proof'];

    var byDim={}, dimOrder=[];
    principles.forEach(function(p){
      var d=p.dimensionHint||'Undimensioned';
      if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}
      byDim[d].push(p);
    });

    var rows = [['FRAMEWORK — Dimensional Framework','','Generated: '+new Date().toISOString(),'','']];

    dimOrder.forEach(function(dim){
      rows.push(['']);
      rows.push(['The '+dim+' Dimension','','','','']);
      rows.push(['ID','Category',colTitles[0],colTitles[1],colTitles[2]]);
      byDim[dim].forEach(function(p){
        var pId = p.sheetId || ('P-'+String(p.seq).padStart(2,'0'));
        var pAs = assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={};
        REGS.forEach(function(k){ byReg[k]=[]; });
        pAs.forEach(function(a){if(byReg[a.register]) byReg[a.register].push(a);});
        rows.push([pId, p.name + (p.description ? ' — ' + p.description : ''), '', '', '']);
        var mbr = p.moveByReg   || {};
        var tbr = p.metricByReg || {};
        REGS.forEach(function(reg){
          var regAs=byReg[reg];
          var mv=mbr[reg]||'N/A', mt=tbr[reg]||'N/A';
          if (!regAs.length) {
            rows.push(['', REG_LABEL[reg]||reg.toUpperCase()+'?', '', mv, mt]);
          } else {
            regAs.forEach(function(a, ai){
              var resolved = resolveNoteKey(a.noteKey);
              var ruleCell = resolved ? cellRef(resolved.tabName,resolved.gridRow,resolved.gridCol) : '[source missing]';
              rows.push(['', ai===0?(REG_LABEL[reg]||reg.toUpperCase()+'?'):'', ruleCell, ai===0?mv:'', ai===0?mt:'']);
            });
          }
        });
      });
    });

    rows.push(['']); rows.push(['']); rows.push(['']);
    rows.push([META_START]);
    rows.push(['PRINCIPLES',  JSON.stringify(principles)]);
    rows.push(['ASSIGNMENTS', JSON.stringify(assignments)]);
    rows.push(['SPLITS',      JSON.stringify(splits)]);
    rows.push(['SETTINGS',    JSON.stringify(settings)]);
    rows.push(['REGISTERS',   JSON.stringify(regs)]);
    rows.push(['DIMENSIONS',  JSON.stringify(dims)]);
    rows.push(['SCHEMA_DESC', JSON.stringify(schemaDesc)]);
    rows.push(['COL_TITLES',  JSON.stringify(colTitles)]);
    // References (from AcademicUtils if available)
    var AC = window.AcademicUtils;
    if (AC) {
      var refs = typeof AC.getReferences === 'function' ? AC.getReferences() : [];
      var refOv = typeof AC.getRefOverrides === 'function' ? AC.getRefOverrides() : {};
      if (refs.length) rows.push(['REFERENCES', JSON.stringify(refs)]);
      if (Object.keys(refOv).length) rows.push(['REF_OVERRIDES', JSON.stringify(refOv)]);
    }
    rows.push([META_END]);
    return rows;
  }

  // ── Diff ──────────────────────────────────────────────────────────────────
  function diffFramework(existingGrid, proposedGrid) {
    var diff = {added:[],changed:[],removed:[],unchanged:0};
    function normalise(row) {
      return (row||[]).map(function(v){
        v = String(v==null?'':v).trim();
        v = v.replace(/Generated: \d{4}-\d{2}-\d{2}T[\d:.]+Z/,'Generated:');
        if (v.charAt(0)==='=') v = '=REF';
        return v;
      }).filter(Boolean).join('||');
    }
    function isMeta(row) {
      var first = String((row||[])[0]||'').trim();
      return first===META_START||first===META_END||
             first==='PRINCIPLES'||first==='ASSIGNMENTS'||
             first==='SPLITS'||first==='SETTINGS'||
             first==='REGISTERS'||first==='DIMENSIONS'||
             first==='SCHEMA_DESC'||first==='COL_TITLES'||
             first==='REFERENCES'||first==='REF_OVERRIDES';
    }
    var existSet = new Set((existingGrid||[]).filter(function(r){return !isMeta(r);}).map(normalise).filter(Boolean));
    var propSet  = new Set(proposedGrid.filter(function(r){return !isMeta(r);}).map(normalise).filter(Boolean));
    proposedGrid.forEach(function(row){
      if(isMeta(row)) return;
      var k=normalise(row); if(!k) return;
      if(existSet.has(k)) diff.unchanged++;
      else diff.added.push((row||[]).filter(Boolean).slice(0,3).join(' | '));
    });
    (existingGrid||[]).forEach(function(row){
      if(isMeta(row)) return;
      var k=normalise(row);
      if(k&&!propSet.has(k)) diff.removed.push((row||[]).filter(Boolean).slice(0,3).join(' | '));
    });
    return diff;
  }

  // ── Apps Script ───────────────────────────────────────────────────────────
  function getScriptUrl()    { return _load(SK.SCRIPT_URL,'') || ''; }
  function setScriptUrl(url) { _save(SK.SCRIPT_URL, url.trim()); }
  function getLastSync()     { return _load(SK.LAST_SYNC, null); }
  function setLastSync()     { _save(SK.LAST_SYNC, Date.now()); }

  async function readFramework(scriptUrl, sheetUrl) {
    var res = await fetch(scriptUrl, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({action:'readFramework', sheetUrl:sheetUrl}),
    });
    if (!res.ok) throw new Error('Script returned '+res.status);
    var json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.tabs || [];
  }

  async function writeFramework(scriptUrl, sheetUrl, tabName, rows) {
    var res = await fetch(scriptUrl, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({action:'writeFramework', sheetUrl:sheetUrl, tabName:tabName, rows:rows}),
    });
    if (!res.ok) throw new Error('Script returned '+res.status);
    var json = await res.json();
    if (json.error) throw new Error(json.error);
    setLastSync(); return json;
  }

  function getFrameworkTabs()     { return window._SY_FW_TABS || []; }
  function setFrameworkTabs(tabs) { window._SY_FW_TABS = tabs; }

  // ── Export ────────────────────────────────────────────────────────────────
  function _esc(v){
    v=String(v==null?'':v);
    if(v.indexOf(',')!==-1||v.indexOf('"')!==-1||v.indexOf('\n')!==-1) return '"'+v.replace(/"/g,'""')+'"';
    return v;
  }

  function exportCSV() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var regs = getRegisters();
    var REGS = regs.map(function(r){ return r.key; });
    var REG_LABEL = {}; regs.forEach(function(r){ REG_LABEL[r.key]=r.label; });
    var colTitles;
    try { colTitles = JSON.parse(localStorage.getItem('df_fw_col_titles')); } catch(e){}
    if (!Array.isArray(colTitles) || colTitles.length !== 3) colTitles = ['Rule / Constraint','Move / Intervention','Metric / Proof'];
    var byDim={},dimOrder=[];
    principles.forEach(function(p){var d=p.dimensionHint||'Undimensioned';if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}byDim[d].push(p);});
    var lines=[['Dimension','ID','Category','Description',colTitles[0],colTitles[1],colTitles[2]].map(_esc).join(',')];
    dimOrder.forEach(function(dim){
      var dimDesc = getSchemaDescription('dimensions', dim);
      byDim[dim].forEach(function(p){
        var pId=p.sheetId||('P-'+String(p.seq).padStart(2,'0'));
        var pAs=assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={}; REGS.forEach(function(k){ byReg[k]=[]; });
        pAs.forEach(function(a){if(byReg[a.register])byReg[a.register].push(a);});
        REGS.forEach(function(reg,ri){
          var rAs=byReg[reg]||[];
          var mv=(p.moveByReg||{})[reg]||'N/A', mt=(p.metricByReg||{})[reg]||'N/A';
          if(!rAs.length){lines.push([ri===0?dim+(dimDesc?' ('+dimDesc+')':''):'',pId,REG_LABEL[reg]||reg.toUpperCase()+'?',ri===0?(p.description||''):'','',mv,mt].map(_esc).join(','));}
          else rAs.forEach(function(a,ai){
            var r=resolveNoteKey(a.noteKey);
            lines.push([ri===0&&ai===0?dim+(dimDesc?' ('+dimDesc+')':''):'',ai===0?pId:'',ai===0?(REG_LABEL[reg]||reg.toUpperCase()+'?'):'',ri===0&&ai===0?(p.description||''):'',(r?r.text:a.noteKey),ai===0?mv:'',ai===0?mt:''].map(_esc).join(','));
          });
        });
      });
    });
    return lines.join('\n');
  }

  function exportMarkdown() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var regs = getRegisters();
    var REGS = regs.map(function(r){ return r.key; });
    var REG_LABEL = {}; regs.forEach(function(r){ REG_LABEL[r.key]=r.label; });
    var byDim={},dimOrder=[];
    principles.forEach(function(p){var d=p.dimensionHint||'Undimensioned';if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}byDim[d].push(p);});
    var lines=['# Design Framework\n'];
    dimOrder.forEach(function(dim){
      var dimDesc = getSchemaDescription('dimensions', dim);
      lines.push('\n## The '+dim+' Dimension' + (dimDesc ? '\n_'+dimDesc+'_' : '') + '\n');
      byDim[dim].forEach(function(p){
        lines.push('\n### P-'+String(p.seq).padStart(2,'0')+': '+p.name);
        if (p.description) lines.push('_'+p.description+'_');
        lines.push('');
        var pAs=assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={}; REGS.forEach(function(k){ byReg[k]=[]; });
        pAs.forEach(function(a){if(byReg[a.register]) byReg[a.register].push(a);});
        REGS.forEach(function(reg){
          var regDesc = getSchemaDescription('registers', reg);
          lines.push('**'+(REG_LABEL[reg]||reg.toUpperCase()+'?')+'**' + (regDesc ? ' — _'+regDesc+'_' : ''));
          var rAs=byReg[reg]||[];
          rAs.forEach(function(a){var r=resolveNoteKey(a.noteKey);if(r) lines.push('- '+r.text+' _('+r.tabName+')_');});
          if(!rAs.length) lines.push('- _No note assigned_');
          lines.push('');
        });
        var mbr=p.moveByReg||{};var tbr=p.metricByReg||{};
        lines.push('**Move / Intervention:** '+(Object.values(mbr).filter(Boolean).join('; ')||'_To be defined_'));
        lines.push('**Metric / Proof:** '+(Object.values(tbr).filter(Boolean).join('; ')||'_To be defined_')+'\n');
      });
    });
    return lines.join('\n');
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // Constants
    AUTO_THRESHOLD, SUGGEST_THRESHOLD, FRAMEWORK_PREFIX, COLORS,
    // Settings
    getSettings, updateSettings,
    // Registers & dimensions
    getRegisters, setRegisters, updateRegister, deleteRegister, addRegister,
    getDimensions, setDimensions, updateDimension, deleteDimension, addDimension,
    getSchemaDescriptions, getSchemaDescription, setSchemaDescription,
    DEFAULT_REGISTERS, DEFAULT_DIMENSIONS,
    // Schema descriptions
    getSchemaDescription, setSchemaDescription, getAllSchemaDescriptions,
    // Helpers
    makeNoteKey, makeSplitKey, isSplitKey, splitKeyParts,
    parseNoteKey, resolveNoteKey,
    getRowNoteKeys, getEffectiveNoteKeys,
    bestCellIdx, hashText, colLetter, cellRef,
    // Splits
    getSplits, getFragments, storeSplit, removeSplit, splitNote, autoSplitAll,
    // Principles
    getPrinciples, addPrinciple, updatePrinciple, deletePrinciple, getPrincipleEmbedText,
    // Assignments
    getAssignments, getAssignment, setAssignment, confirmAssignment,
    rejectAssignment, updateAssignmentRegister, updateAssignmentColumn,
    getChangedSources, acknowledgeChangedSource,
    // Analysis
    suggestRegister, suggestRegisterByVec, suggestColumnByVec, suggestPlacement, analyzePlacement, autoLabel, cosine, centroid, cluster,
    buildPrincipleVectors, computeAssignmentTiers,
    // Sheet I/O
    parseFrameworkTab, loadFromFrameworkTab, buildFrameworkGrid, diffFramework,
    getScriptUrl, setScriptUrl, getLastSync, setLastSync,
    readFramework, writeFramework, getFrameworkTabs, setFrameworkTabs,
    // Export
    exportCSV, exportMarkdown,
  };

})();
