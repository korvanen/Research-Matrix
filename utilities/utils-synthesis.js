// ════════════════════════════════════════════════════════════════════════════
// utils-synthesis.js  v2.0
// Primary data: TAB tabs (window.TABS). Writes: FRAMEWORK tab via Apps Script.
// State: localStorage working copy; sheet is source of truth.
// ════════════════════════════════════════════════════════════════════════════
console.log('[utils-synthesis.js v2.0]');

window.SynthesisData = (function () {
  'use strict';

  var AUTO_THRESHOLD    = 0.72;
  var SUGGEST_THRESHOLD = 0.50;
  var FRAMEWORK_PREFIX  = 'FRAMEWORK';
  var META_START        = '##META_START##';
  var META_END          = '##META_END##';

  var COLORS = ['#9b2335','#7b3f9e','#1a6b8a','#2e6b3e','#b5451b','#4a5568','#1a5276','#6b4226'];

  var SK = {
    PRINCIPLES:  'sy2_principles',
    ASSIGNMENTS: 'sy2_assignments',
    SCRIPT_URL:  'sy2_script_url',
    LAST_SYNC:   'sy2_last_sync',
  };

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

  // ── Hash for change detection ─────────────────────────────────────────────

  function hashText(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (Math.imul(31,h) + str.charCodeAt(i))|0;
    return (h>>>0).toString(36);
  }

  // ── Sheet column letter ───────────────────────────────────────────────────

  function colLetter(idx) {
    var s = '', n = idx + 1;
    while (n > 0) { n--; s = String.fromCharCode(65 + n%26) + s; n = Math.floor(n/26); }
    return s;
  }

  function cellRef(tabName, gridRow, gridCol) {
    return "='" + tabName.replace(/'/g,"''") + "'!" + colLetter(gridCol) + (gridRow + 1);
  }

  // ── Note keys ─────────────────────────────────────────────────────────────
  // Format: "tabName::dataRowIdx::cellIdx"

  function makeNoteKey(tabName, dataRowIdx, cellIdx) {
    return tabName + '::' + dataRowIdx + '::' + cellIdx;
  }
  function parseNoteKey(key) {
    var parts = key.split('::');
    return { tabName: parts[0], dataRowIdx: parseInt(parts[1]), cellIdx: parseInt(parts[2]) };
  }

  function resolveNoteKey(key) {
    var p = parseNoteKey(key);
    var tab = (window.TABS||[]).find(function(t){ return t.name === p.tabName; });
    if (!tab) return null;
    var data = typeof processSheetData === 'function' ? processSheetData(tab.grid) : null;
    if (!data || !data.rows[p.dataRowIdx]) return null;
    var row = data.rows[p.dataRowIdx];
    var cell = row.cells[p.cellIdx] || '';
    return {
      text:       cell,
      cats:       row.cats,
      allCells:   row.cells,
      headers:    data.headers,
      tabName:    p.tabName,
      tabTitle:   data.title || p.tabName,
      dataRowIdx: p.dataRowIdx,
      cellIdx:    p.cellIdx,
      gridRow:    data.headerRowIdx + p.dataRowIdx + 1,
      gridCol:    data.colIndices[p.cellIdx],
    };
  }

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

  // ── Principles ────────────────────────────────────────────────────────────

  function getPrinciples() { return _load(SK.PRINCIPLES, []); }

  function addPrinciple(data) {
    var ps  = getPrinciples();
    var seq = ps.filter(function(p){ return !p.archived; }).length + 1;
    var p   = {
      id: _id('p'), name: String(data.name||'').trim(), named: !!(data.name&&data.name.trim()),
      dimensionHint: String(data.dimensionHint||'').trim(),
      color: data.color || COLORS[(seq-1) % COLORS.length],
      move:'', metric:'', archived:false, seq:seq, ts:Date.now(),
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
  // status: 'confirmed' | 'auto' | 'suggested' | 'unassigned'

  function getAssignments()      { return _load(SK.ASSIGNMENTS, []); }
  function _saveAssignments(as)  { _save(SK.ASSIGNMENTS, as); }

  function getAssignment(noteKey) {
    return getAssignments().find(function(a){ return a.noteKey===noteKey; }) || null;
  }

  function setAssignment(noteKey, principleId, register, status, similarity) {
    var as = getAssignments().filter(function(a){ return a.noteKey!==noteKey; });
    if (principleId) {
      var resolved = resolveNoteKey(noteKey);
      as.push({
        id: _id('a'), noteKey: noteKey, principleId: principleId,
        register: register||'what', status: status||'confirmed',
        similarity: similarity||null, contentHash: resolved ? hashText(resolved.text) : null,
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

  // ── Source change detection ───────────────────────────────────────────────

  function getChangedSources() {
    var changed = [];
    getAssignments().forEach(function(a) {
      if (a.status !== 'confirmed' || !a.contentHash) return;
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

  var _WHO = /\b(resident|inhabitant|architect|user|communit|people|person|occupant|famil|household|designer|dweller|neighbou?r|individual|collective)\b/i;
  var _WHY = /\b(because|enabl|allows?|encourages?|supports?|leads?\s+to|fosters?|promotes?|facilitate|prevent|reduces?|increases?|improves?|creates?|generates?)\b/i;
  var _HOW = /\b(by\s|through\s|using\s|via\s|combin|integrat|applying|implement|designing|providing|placing|arrang|configur|layer|graduat|interlock)\b/i;

  function suggestRegister(text) {
    if (!text) return 'what';
    if (_WHO.test(text)) return 'who';
    if (_WHY.test(text)) return 'why';
    if (_HOW.test(text)) return 'how';
    return 'what';
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

  function cluster(items, threshold) {
    threshold = threshold !== undefined ? threshold : 0.42;
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

  function buildPrincipleVectors(embeddings) {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    return principles.map(function(p){
      var vecs = assignments.filter(function(a){return a.principleId===p.id;})
        .map(function(a){return embeddings.get(a.noteKey);}).filter(Boolean);
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
    var principles=[], assignments=[];
    for(var r=metaStart+1;r<metaEnd;r++){
      var key=String(grid[r][0]||'').trim(), val=String(grid[r][1]||'').trim();
      if(!val) continue;
      try {
        if(key==='PRINCIPLES')  principles  = JSON.parse(val);
        if(key==='ASSIGNMENTS') assignments = JSON.parse(val);
      } catch(e){}
    }
    return { principles:principles, assignments:assignments };
  }

  function loadFromFrameworkTab(grid) {
    var parsed = parseFrameworkTab(grid);
    if (!parsed) return false;
    var existing = getPrinciples();
    var merged = parsed.principles.map(function(sp){
      var lp = existing.find(function(p){return p.id===sp.id;});
      return Object.assign({}, sp, lp ? {move:lp.move||sp.move, metric:lp.metric||sp.metric} : {});
    });
    existing.forEach(function(p){ if(!merged.find(function(m){return m.id===p.id;})) merged.push(p); });
    _save(SK.PRINCIPLES, merged);
    var localAs = getAssignments();
    var mergedAs = parsed.assignments.slice();
    localAs.forEach(function(a){ if(!mergedAs.find(function(m){return m.noteKey===a.noteKey;})) mergedAs.push(a); });
    _saveAssignments(mergedAs);
    return true;
  }

  // ── FRAMEWORK tab: build ──────────────────────────────────────────────────

  function buildFrameworkGrid() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var REGS      = ['what','why','who','how'];
    var REG_LABEL = {what:'WHAT?',why:'WHY?',who:'WHO?',how:'HOW?'};

    var byDim={}, dimOrder=[];
    principles.forEach(function(p){
      var d=p.dimensionHint||'Undimensioned';
      if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}
      byDim[d].push(p);
    });

    var rows = [
      ['FRAMEWORK — Dimensional Framework','','Generated: '+new Date().toISOString(),'',''],
    ];

    dimOrder.forEach(function(dim){
      rows.push(['']);
      rows.push(['The '+dim+' Dimension','','','','']);
      rows.push(['ID','Category','Rule / Constraint','Move / Intervention','Metric / Proof']);
      byDim[dim].forEach(function(p){
        var pId = 'P-'+String(p.seq).padStart(2,'0');
        var pAs = assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={what:[],why:[],who:[],how:[]};
        pAs.forEach(function(a){if(byReg[a.register]) byReg[a.register].push(a);});
        rows.push([pId, p.name, '', '', '']);
        REGS.forEach(function(reg,ri){
          var regAs=byReg[reg], ruleCell='';
          if(regAs.length){
            var resolved=resolveNoteKey(regAs[0].noteKey);
            ruleCell = resolved ? cellRef(resolved.tabName,resolved.gridRow,resolved.gridCol) : '[source missing]';
          }
          rows.push(['', REG_LABEL[reg], ruleCell, ri===0?(p.move||'N/A'):'', ri===0?(p.metric||'N/A'):'']);
        });
      });
    });

    rows.push(['']); rows.push(['']); rows.push(['']);
    rows.push([META_START]);
    rows.push(['PRINCIPLES',  JSON.stringify(principles)]);
    rows.push(['ASSIGNMENTS', JSON.stringify(assignments)]);
    rows.push([META_END]);
    return rows;
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  function diffFramework(existingGrid, proposedGrid) {
    var diff = {added:[],changed:[],removed:[],unchanged:0};
    var existSet = new Set((existingGrid||[]).map(function(r){return (r||[]).filter(Boolean).join('||');}));
    var propSet  = new Set(proposedGrid.map(function(r){return (r||[]).filter(Boolean).join('||');}));
    proposedGrid.forEach(function(row){
      var k=(row||[]).filter(Boolean).join('||'); if(!k) return;
      if(existSet.has(k)) diff.unchanged++;
      else diff.added.push(row.filter(Boolean).slice(0,3).join(' | '));
    });
    (existingGrid||[]).forEach(function(row){
      var k=(row||[]).filter(Boolean).join('||');
      if(k&&!propSet.has(k)&&k!==META_START&&k!==META_END&&!k.startsWith('PRINCIPLES')&&!k.startsWith('ASSIGNMENTS'))
        diff.removed.push(row.filter(Boolean).slice(0,3).join(' | '));
    });
    return diff;
  }

  // ── Apps Script integration ───────────────────────────────────────────────

  function getScriptUrl()    { return _load(SK.SCRIPT_URL,'') || ''; }
  function setScriptUrl(url) { _save(SK.SCRIPT_URL, url.trim()); }
  function getLastSync()     { return _load(SK.LAST_SYNC, null); }
  function setLastSync()     { _save(SK.LAST_SYNC, Date.now()); }

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

  function getFrameworkTabs()       { return window._SY_FW_TABS || []; }
  function setFrameworkTabs(tabs)   { window._SY_FW_TABS = tabs; }

  // ── Export ────────────────────────────────────────────────────────────────

  function _esc(v){
    v=String(v==null?'':v);
    if(v.indexOf(',')!==-1||v.indexOf('"')!==-1||v.indexOf('\n')!==-1) return '"'+v.replace(/"/g,'""')+'"';
    return v;
  }

  function exportCSV() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var REGS=['what','why','who','how'];
    var byDim={},dimOrder=[];
    principles.forEach(function(p){var d=p.dimensionHint||'Undimensioned';if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}byDim[d].push(p);});
    var lines=[['Dimension','ID','Category','Rule / Constraint','Move / Intervention','Metric / Proof'].map(_esc).join(',')];
    dimOrder.forEach(function(dim){
      byDim[dim].forEach(function(p){
        var pId='P-'+String(p.seq).padStart(2,'0');
        var pAs=assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={what:[],why:[],who:[],how:[]}; pAs.forEach(function(a){if(byReg[a.register])byReg[a.register].push(a);});
        REGS.forEach(function(reg,ri){
          var rAs=byReg[reg];
          if(!rAs.length){lines.push([ri===0?dim:'',pId,reg.toUpperCase()+'?','',ri===0?(p.move||'N/A'):'',ri===0?(p.metric||'N/A'):''].map(_esc).join(','));}
          else rAs.forEach(function(a,ai){
            var r=resolveNoteKey(a.noteKey);
            lines.push([ri===0&&ai===0?dim:'',ai===0?pId:'',ai===0?reg.toUpperCase()+'?':'',(r?r.text:a.noteKey),ri===0&&ai===0?(p.move||'N/A'):'',ri===0&&ai===0?(p.metric||'N/A'):''].map(_esc).join(','));
          });
        });
      });
    });
    return lines.join('\n');
  }

  function exportMarkdown() {
    var principles  = getPrinciples().filter(function(p){return p.named&&!p.archived;});
    var assignments = getAssignments().filter(function(a){return a.status==='confirmed';});
    var REGS=['what','why','who','how'];
    var byDim={},dimOrder=[];
    principles.forEach(function(p){var d=p.dimensionHint||'Undimensioned';if(!byDim[d]){byDim[d]=[];dimOrder.push(d);}byDim[d].push(p);});
    var lines=['# Design Framework\n'];
    dimOrder.forEach(function(dim){
      lines.push('\n## The '+dim+' Dimension\n');
      byDim[dim].forEach(function(p){
        lines.push('\n### P-'+String(p.seq).padStart(2,'0')+': '+p.name+'\n');
        var pAs=assignments.filter(function(a){return a.principleId===p.id;});
        var byReg={what:[],why:[],who:[],how:{}}; pAs.forEach(function(a){if(byReg[a.register])byReg[a.register].push(a);});
        REGS.forEach(function(reg){
          lines.push('**'+reg.toUpperCase()+'?**');
          var rAs=byReg[reg]||[];
          rAs.forEach(function(a){var r=resolveNoteKey(a.noteKey);if(r) lines.push('- '+r.text+' _('+r.tabName+')_');});
          if(!rAs.length) lines.push('- _No note assigned_');
          lines.push('');
        });
        lines.push('**Move / Intervention:** '+(p.move||'_To be defined_'));
        lines.push('**Metric / Proof:** '+(p.metric||'_To be defined_')+'\n');
      });
    });
    return lines.join('\n');
  }

  return {
    AUTO_THRESHOLD, SUGGEST_THRESHOLD, FRAMEWORK_PREFIX, COLORS,
    makeNoteKey, parseNoteKey, resolveNoteKey, getRowNoteKeys, bestCellIdx, hashText, colLetter, cellRef,
    getPrinciples, addPrinciple, updatePrinciple, deletePrinciple,
    getAssignments, getAssignment, setAssignment, confirmAssignment, rejectAssignment, updateAssignmentRegister,
    getChangedSources, acknowledgeChangedSource,
    suggestRegister, autoLabel, cosine, centroid, cluster, buildPrincipleVectors, computeAssignmentTiers,
    parseFrameworkTab, loadFromFrameworkTab, buildFrameworkGrid, diffFramework,
    getScriptUrl, setScriptUrl, getLastSync, setLastSync, writeFramework, getFrameworkTabs, setFrameworkTabs,
    exportCSV, exportMarkdown,
  };
})();
