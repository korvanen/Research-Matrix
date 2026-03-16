// ════════════════════════════════════════════════════════════════════════════
// utils-academic.js  —  Academic enhancements for Dimensional Framework
// v2 — fixes: no emojis, spreadsheet non-destructive screening,
//             cluster buttons moved to panel header, silhouette inline display
// ════════════════════════════════════════════════════════════════════════════
console.log('[utils-academic.js v2.0]');

window.AcademicUtils = (function () {
  'use strict';

  var SK = {
    SCREENING:      'df_screening_',
    ANNOTATION:     'df_annotation_',
    SAVED_SEARCHES: 'df_saved_searches',
    IMPORTED_DATA:  'df_imported_tabs',
    REFERENCES:     'df_references',
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DOI RESOLUTION
  // ══════════════════════════════════════════════════════════════════════════

  function normaliseDOI(raw) {
    if (!raw) return null;
    var m = String(raw).trim().match(/10\.\d{4,}\/\S+/);
    return m ? m[0].replace(/[.,;)\]]+$/, '') : null;
  }

  function resolveDOI(doi) {
    doi = normaliseDOI(doi);
    if (!doi) return Promise.reject(new Error('Invalid DOI'));
    return fetch('https://api.crossref.org/works/' + encodeURIComponent(doi),
      { headers: { 'User-Agent': 'DimensionalFramework/2.0' } })
      .then(function (r) { if (!r.ok) throw new Error('Crossref ' + r.status); return r.json(); })
      .then(function (data) {
        var w = data.message || {};
        return {
          doi:       doi,
          title:     (w.title || [])[0] || '',
          authors:   (w.author || []).map(function (a) { return [a.given, a.family].filter(Boolean).join(' '); }).join('; '),
          year:      String((w.published && (w.published['date-parts'] || [[]])[0][0]) || ''),
          journal:   (w['container-title'] || [])[0] || '',
          volume:    w.volume || '', issue: w.issue || '', pages: w.page || '',
          abstract:  (w.abstract || '').replace(/<\/?[^>]+>/g, '').trim(),
          url:       w.URL || ('https://doi.org/' + doi),
        };
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BIBTEX PARSER
  // ══════════════════════════════════════════════════════════════════════════

  function parseBibTeX(text) {
    var entries = [];
    text = text.replace(/%[^\n]*/g, '');
    var entryRe = /@(\w+)\s*\{([^,]+),([^@]*)/g, m;
    while ((m = entryRe.exec(text)) !== null) {
      var type = m[1].toLowerCase();
      if (type === 'string' || type === 'preamble' || type === 'comment') continue;
      var fields = {}, fm, fieldRe = /(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g;
      while ((fm = fieldRe.exec(m[3])) !== null) {
        fields[fm[1].toLowerCase()] = (fm[2] !== undefined ? fm[2] : fm[3] !== undefined ? fm[3] : fm[4] || '').replace(/\s+/g,' ').replace(/[{}]/g,'').trim();
      }
      var authors = (fields.author||'').split(/\s+and\s+/i).map(function(a){
        a = a.trim(); if (a.indexOf(',')!==-1){var p=a.split(',');return (p[1]||'').trim()+' '+p[0].trim();} return a;
      }).filter(Boolean).join('; ');
      entries.push({ type:type, citeKey:m[2].trim(), title:fields.title||'', authors:authors,
        year:fields.year||'', journal:fields.journal||fields.booktitle||'', volume:fields.volume||'',
        issue:fields.number||fields.issue||'', pages:fields.pages||'', doi:normaliseDOI(fields.doi||'')||'',
        url:fields.url||(fields.doi?'https://doi.org/'+fields.doi:''), abstract:fields.abstract||'',
        publisher:fields.publisher||'', keywords:fields.keywords||'' });
    }
    return entries;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. CSV PARSER
  // ══════════════════════════════════════════════════════════════════════════

  function parseCSVText(text) {
    var lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    function parseLine(line) {
      var f=[],cur='',inQ=false;
      for(var i=0;i<line.length;i++){var c=line[i];
        if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
        else if(c===','&&!inQ){f.push(cur);cur='';}else cur+=c;}
      f.push(cur); return f.map(function(x){return x.trim();});
    }
    var rows = lines.filter(function(l){return l.trim();}).map(parseLine);
    if (rows.length < 2) return [];
    var hdrs = rows[0].map(function(h){return h.toLowerCase().replace(/[^a-z0-9]/g,'');});
    var aliases = {
      title:['title','articlename','papertitle'],authors:['author','authors'],
      year:['year','pubyear','publicationyear'],journal:['journal','source','booktitle','venue'],
      doi:['doi'],abstract:['abstract','summary'],volume:['volume','vol'],
      issue:['issue','number'],pages:['pages','page'],keywords:['keywords','tags'],url:['url','link']
    };
    var colMap = {};
    hdrs.forEach(function(h,i){ Object.keys(aliases).forEach(function(f){
      if(aliases[f].indexOf(h)!==-1&&colMap[f]===undefined) colMap[f]=i;});});
    return rows.slice(1).map(function(row){
      var get=function(f){return colMap[f]!==undefined?(row[colMap[f]]||''):'';};
      return { title:get('title'), authors:get('authors'), year:get('year'), journal:get('journal'),
        doi:normaliseDOI(get('doi'))||'', abstract:get('abstract'), volume:get('volume'),
        issue:get('issue'), pages:get('pages'), keywords:get('keywords'),
        url:get('url')||(get('doi')?'https://doi.org/'+normaliseDOI(get('doi')):'') };
    }).filter(function(e){return e.title||e.doi;});
  }

  function citationsToGrid(entries, sourceName) {
    var flagRow   = ['CATEGORY','COLUMN','COLUMN','COLUMN','COLUMN','COLUMN','COLUMN','COLUMN','COLUMN'];
    var titleRow  = ['TITLE', sourceName||'Imported Data','','','','','','',''];
    var headerRow = ['HEADER ROW','','Title','Authors','Year','Journal / Source','DOI','Abstract','Keywords'];
    var dataRows  = entries.map(function(e,i){
      return ['Entry '+(i+1),'',e.title||'',e.authors||'',e.year||'',e.journal||'',
              e.doi||'',e.abstract||'',e.keywords||''];
    });
    return [flagRow, titleRow, headerRow].concat(dataRows);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. SCHEMA VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  var RECOMMENDED = ['title','authors','year','doi'];

  function validateSchema(headers) {
    if (!headers || !headers.length) return { valid:false, missing:RECOMMENDED, suggestions:[] };
    var lower = headers.map(function(h){return String(h).toLowerCase().trim();});
    var missing = RECOMMENDED.filter(function(col){return !lower.some(function(h){return h.includes(col);});});
    return { valid: missing.length===0, missing: missing,
      present: RECOMMENDED.filter(function(col){return !missing.includes(col);}),
      suggestions: [] };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SCREENING  (localStorage)
  // ══════════════════════════════════════════════════════════════════════════

  function _sk(tabIdx, rowIdx) { return SK.SCREENING + tabIdx + '_' + rowIdx; }
  function _ak(tabIdx, rowIdx) { return SK.ANNOTATION + tabIdx + '_' + rowIdx; }

  function parseScreening(raw) {
    if (!raw) return { status:'unscreened', reason:'' };
    try { var p=JSON.parse(raw); return { status:p.status||'unscreened', reason:p.reason||'' }; }
    catch(e) { return { status:raw, reason:'' }; }
  }

  function getScreeningStatus(ti, ri) {
    try { return parseScreening(localStorage.getItem(_sk(ti,ri))).status; } catch(e) { return 'unscreened'; }
  }
  function setScreeningStatus(ti, ri, status, reason) {
    try { localStorage.setItem(_sk(ti,ri), JSON.stringify({status:status,reason:reason||'',ts:Date.now()})); }
    catch(e) {}
  }
  function getAnnotation(ti, ri) { try { return localStorage.getItem(_ak(ti,ri))||''; } catch(e) { return ''; } }
  function setAnnotation(ti, ri, text) {
    try { if(text.trim()) localStorage.setItem(_ak(ti,ri),text); else localStorage.removeItem(_ak(ti,ri)); }
    catch(e) {}
  }

  function getScreeningProgress() {
    if (typeof window.TABS==='undefined'||!window.TABS.length) return null;
    var c={included:0,excluded:0,unscreened:0,total:0};
    window.TABS.forEach(function(tab,ti){
      var data=typeof processSheetData==='function'?processSheetData(tab.grid):null; if(!data) return;
      data.rows.forEach(function(_,ri){
        c.total++;
        var s=parseScreening(localStorage.getItem(_sk(ti,ri))).status;
        if(c[s]!==undefined) c[s]++; else c.unscreened++;
      });
    });
    return c;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. SAVED SEARCHES
  // ══════════════════════════════════════════════════════════════════════════

  function getSavedSearches() { try { return JSON.parse(localStorage.getItem(SK.SAVED_SEARCHES)||'[]'); } catch(e) { return []; } }
  function saveSearch(query, results) {
    var searches = getSavedSearches();
    var entry = { id:Date.now(), label:query, query:query, date:new Date().toISOString().split('T')[0],
      count:results.length };
    searches.unshift(entry);
    if (searches.length>50) searches=searches.slice(0,50);
    try { localStorage.setItem(SK.SAVED_SEARCHES, JSON.stringify(searches)); } catch(e) {}
    return entry;
  }
  function deleteSavedSearch(id) {
    try { localStorage.setItem(SK.SAVED_SEARCHES, JSON.stringify(getSavedSearches().filter(function(s){return s.id!==id;}))); }
    catch(e) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. SILHOUETTE SCORE
  // ══════════════════════════════════════════════════════════════════════════

  function cosineDist(a, b) {
    if (!a||!b||a.length!==b.length) return 1;
    var dot=0,na=0,nb=0;
    for(var i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
    var d=Math.sqrt(na)*Math.sqrt(nb); return d<1e-10?1:1-dot/d;
  }

  function computeSilhouette(clusters) {
    var all = clusters.filter(function(c){return c.items&&c.items.length;});
    if (all.length<2) return null;
    var scores=[];
    all.forEach(function(cluster,ci){
      cluster.items.forEach(function(item){
        if (!item.vec) return;
        var same=cluster.items.filter(function(x){return x!==item&&x.vec;});
        var a=same.length?same.reduce(function(s,x){return s+cosineDist(item.vec,x.vec);},0)/same.length:0;
        var b=Infinity;
        all.forEach(function(other,oi){
          if (oi===ci||!other.items.length) return;
          var ov=other.items.filter(function(x){return x.vec;});
          if (!ov.length) return;
          var md=ov.reduce(function(s,x){return s+cosineDist(item.vec,x.vec);},0)/ov.length;
          if (md<b) b=md;
        });
        if (b===Infinity) return;
        scores.push((b-a)/Math.max(a,b));
      });
    });
    if (!scores.length) return null;
    return scores.reduce(function(s,x){return s+x;},0)/scores.length;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. EXPORT UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  function downloadBlob(content, filename, mime) {
    var blob=new Blob([content],{type:mime||'text/plain'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},2000);
  }

  function escCSV(v) {
    v=String(v==null?'':v);
    if(v.indexOf(',')!==-1||v.indexOf('"')!==-1||v.indexOf('\n')!==-1) return '"'+v.replace(/"/g,'""')+'"';
    return v;
  }
  function rowsToCSV(headers, rows) {
    return [headers.map(escCSV).join(',')]
      .concat(rows.map(function(r){return r.map(escCSV).join(',');})).join('\n');
  }

  function exportClustersFromDOM() {
    var nests = document.querySelectorAll('.pp-cl-nest, [data-cluster-name]');
    var headers = ['cluster','sub_cluster','category','content'];
    var rows = [];
    if (!nests.length) {
      document.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function(card){
        rows.push(['','','',card.textContent.trim().slice(0,300)]);
      });
    } else {
      nests.forEach(function(nest){
        var cname=((nest.querySelector('[class*="nest-header"]')||{}).textContent||'').trim()||'(unnamed)';
        var subs=nest.querySelectorAll('.pp-cl-subnest,[data-sub-cluster]');
        if (subs.length) {
          subs.forEach(function(sub){
            var sname=((sub.querySelector('[class*="subnest-header"]')||{}).textContent||'').trim()||'(unnamed)';
            sub.querySelectorAll('.pp-cl-card,[class*="cl-card"]').forEach(function(card){
              var cat=((card.querySelector('[class*="card-cat"]')||{}).textContent||'').trim();
              rows.push([cname,sname,cat,card.textContent.trim().slice(0,300)]);
            });
          });
        } else {
          nest.querySelectorAll('.pp-cl-card,[class*="cl-card"]').forEach(function(card){
            var cat=((card.querySelector('[class*="card-cat"]')||{}).textContent||'').trim();
            rows.push([cname,'',cat,card.textContent.trim().slice(0,300)]);
          });
        }
      });
    }
    if (!rows.length) { alert('No cluster data found — run clustering first.'); return; }
    downloadBlob('# Clusters export\n# '+new Date().toISOString()+'\n'+rowsToCSV(headers,rows),
      'clusters-'+Date.now()+'.csv','text/csv');
  }

  function exportSpreadsheetCSV() {
    var headerRow=document.getElementById('header-row');
    var dataBody=document.getElementById('data-body');
    var catBody=document.getElementById('cat-body');
    if (!headerRow||!dataBody){alert('Spreadsheet not loaded.');return;}
    var headers=['Category'].concat(
      Array.from(headerRow.querySelectorAll('th')).map(function(th){return th.textContent.trim();})
    ).concat(['Screening','Note']);
    var catRows=Array.from(catBody?catBody.querySelectorAll('tr'):[]);
    var rows=Array.from(dataBody.querySelectorAll('tr')).map(function(tr,i){
      var cat=catRows[i]?Array.from(catRows[i].querySelectorAll('td')).map(function(td){return td.textContent.trim();}).join(' > '):'';
      var cells=Array.from(tr.querySelectorAll('td')).map(function(td){return td.textContent.trim();});
      var ti=tr.dataset.acadTabIdx, ri=tr.dataset.acadRowIdx;
      var sc=ti!==undefined?parseScreening(localStorage.getItem(_sk(ti,ri))).status:'';
      var an=ti!==undefined?getAnnotation(ti,ri):'';
      return [cat].concat(cells).concat([sc,an]);
    });
    downloadBlob(rowsToCSV(headers,rows),'spreadsheet-'+Date.now()+'.csv','text/csv');
  }

  function exportConceptMapPNG() {
    var canvas=document.getElementById('pp-cmap-canvas');
    if (!canvas){alert('Concept map not rendered yet.');return;}
    function doExport() {
      window.html2canvas(canvas,{backgroundColor:getComputedStyle(document.body).backgroundColor||'#fff',scale:2})
        .then(function(c){c.toBlob(function(blob){
          var url=URL.createObjectURL(blob),a=document.createElement('a');
          a.href=url;a.download='concept-map-'+Date.now()+'.png';
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          setTimeout(function(){URL.revokeObjectURL(url);},2000);
        });}).catch(function(e){alert('Export failed: '+e.message);});
    }
    if (window.html2canvas){doExport();return;}
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload=doExport;
    s.onerror=function(){alert('Could not load html2canvas. Use browser print (Ctrl+P) to save as PDF.');};
    document.head.appendChild(s);
  }

  function exportConceptMapSVG() {
    var world=document.getElementById('pp-cmap-world');
    if (!world){alert('Concept map not rendered yet.');return;}
    var rect=world.getBoundingClientRect();
    var ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('xmlns',ns);
    svg.setAttribute('width',rect.width||1200);
    svg.setAttribute('height',rect.height||800);
    svg.setAttribute('viewBox','0 0 '+(rect.width||1200)+' '+(rect.height||800));
    var fo=document.createElementNS(ns,'foreignObject');
    fo.setAttribute('x',0);fo.setAttribute('y',0);
    fo.setAttribute('width','100%');fo.setAttribute('height','100%');
    fo.appendChild(world.cloneNode(true));
    svg.appendChild(fo);
    downloadBlob(new XMLSerializer().serializeToString(svg),'concept-map-'+Date.now()+'.svg','image/svg+xml');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. METHODS BLURB
  // ══════════════════════════════════════════════════════════════════════════

  function generateMethodsBlurb(opts) {
    opts = opts||{};
    var today=new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'});
    var model=opts.model||'all-MiniLM-L6-v2 (Sentence Transformers)';
    var threshold=opts.threshold!==undefined?opts.threshold:0.40;
    var progress=getScreeningProgress();
    var entryCount=progress?progress.total:(opts.entryCount||0);
    var tabs=typeof window.TABS!=='undefined'?window.TABS.length:0;
    var tool=opts.toolName||'Dimensional Framework';
    var blurb='Literature was managed and analysed using '+tool+', a browser-based semantic research tool. ';
    if (entryCount){
      blurb+='A dataset of '+entryCount+' entr'+(entryCount===1?'y':'ies');
      if (tabs>1) blurb+=' across '+tabs+' dimensional tab'+(tabs===1?'':'s');
      blurb+=' was compiled. ';
    }
    blurb+='Semantic similarity was computed using the '+model+' embedding model, which maps text passages to a 384-dimensional vector space. ';
    blurb+='Matches were identified using cosine similarity with a minimum threshold of '+threshold.toFixed(2)+'. ';
    if (progress&&progress.included+progress.excluded>0){
      var screened=progress.included+progress.excluded;
      blurb+=screened+' entries were screened; '+progress.included+' included and '+progress.excluded+' excluded. ';
    }
    blurb+='Thematic clustering was performed using pairwise cosine distances between embedding vectors. ';
    blurb+='The concept map hierarchy was inferred from semantic distance with a parent-child threshold of 0.50. ';
    blurb+='Analysis was conducted on '+today+'.';
    return blurb;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. IMPORTED DATA
  // ══════════════════════════════════════════════════════════════════════════

  function saveImportedTabs(tabs) { try{localStorage.setItem(SK.IMPORTED_DATA,JSON.stringify(tabs));}catch(e){} }
  function loadImportedTabs() { try{return JSON.parse(localStorage.getItem(SK.IMPORTED_DATA)||'[]');}catch(e){return[];} }
  function clearImportedTabs() { try{localStorage.removeItem(SK.IMPORTED_DATA);}catch(e){} }

  function mergeImportedIntoTABS() {
    var imported=loadImportedTabs(); if (!imported.length) return;
    if (typeof window.TABS==='undefined') window.TABS=[];
    imported.forEach(function(tab){
      if (!window.TABS.some(function(t){return t.name===tab.name;})) window.TABS.push(tab);
    });
    window.dispatchEvent(new CustomEvent('sheet-loaded',{detail:{tabCount:window.TABS.length}}));
  }
  window.addEventListener('sheet-loaded', mergeImportedIntoTABS);
  document.addEventListener('DOMContentLoaded', function(){
    if (window.TABS&&window.TABS.length) mergeImportedIntoTABS();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED CSS INJECTOR
  // ══════════════════════════════════════════════════════════════════════════

  function _css(id, rules) {
    if (document.getElementById(id)) return;
    var s=document.createElement('style'); s.id=id; s.textContent=rules;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE A: INDEX — import panel, schema badge, methods blurb
  // ══════════════════════════════════════════════════════════════════════════

  function injectIndexFeatures() {
    if (!document.getElementById('sheet-load-btn')) return;

    _css('acad-index-styles', `
      .acad-import-section {
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.14));
      }
      .acad-section-label {
        font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        margin-bottom: 10px; display: block;
      }
      .acad-import-drop {
        border: 1px dashed var(--md-sys-color-outline, rgba(0,0,0,.38));
        border-radius: 6px; padding: 14px 16px; text-align: center; cursor: pointer;
        transition: border-color .18s, background .18s;
        font-size: 13px; color: var(--md-sys-color-on-surface-variant, #49454f);
        line-height: 1.5;
      }
      .acad-import-drop:hover, .acad-import-drop.drag-over {
        border-color: var(--md-sys-color-primary, #6750a4);
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 4%, transparent);
        color: var(--md-sys-color-on-surface, #1c1b1f);
      }
      .acad-import-drop b { color: var(--md-sys-color-primary, #6750a4); font-weight: 600; }
      .acad-import-msg {
        font-size: 12px; margin-top: 7px; min-height: 17px; letter-spacing: .01em;
        color: var(--md-sys-color-on-surface-variant, #49454f);
      }
      .acad-import-msg.ok  { color: #2e7d32; }
      .acad-import-msg.err { color: var(--md-sys-color-error, #b3261e); }
      .acad-clear-btn {
        display: none; margin-top: 6px;
        background: none; border: none; cursor: pointer; padding: 0;
        font-size: 11px; color: var(--md-sys-color-error, #b3261e);
        text-decoration: underline; letter-spacing: .01em;
      }
      .acad-schema-badge {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 500; padding: 4px 10px;
        border-radius: 6px; margin-top: 9px; line-height: 1.4;
      }
      .acad-schema-badge.ok      { background: rgba(46,125,50,.09);  color: #2e7d32; }
      .acad-schema-badge.warn    { background: rgba(230,81,0,.09);   color: #e65100; }
      .acad-schema-badge.missing { background: rgba(183,28,28,.09);  color: #b71c1c; }
      .acad-schema-hint {
        font-size: 11px; color: var(--md-sys-color-on-surface-variant, #49454f);
        margin-top: 4px; line-height: 1.4;
      }
      .acad-action-row {
        display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap;
      }
      .acad-action-btn {
        height: 36px; padding: 0 16px; border-radius: 18px; border: none; cursor: pointer;
        font-size: 13px; font-weight: 500; letter-spacing: .01em; white-space: nowrap;
        background: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
        transition: box-shadow .15s;
      }
      .acad-action-btn:hover { box-shadow: 0 1px 4px rgba(0,0,0,.2); }
      .acad-blurb-ta {
        display: none; width: 100%; margin-top: 10px;
        min-height: 90px; resize: vertical; font-size: 12px; line-height: 1.55;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.2));
        border-radius: 6px; padding: 8px 10px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        color: inherit; font-family: inherit; box-sizing: border-box;
      }
    `);

    var loaderEl = document.querySelector('.sheet-loader');
    if (!loaderEl) return;

    var sec = document.createElement('div');
    sec.className = 'acad-import-section';
    sec.innerHTML =
      '<span class="acad-section-label">Import from file</span>' +
      '<div class="acad-import-drop" id="acad-drop">Drop a <b>.bib</b> or <b>.csv</b> file here, or <b>click to browse</b></div>' +
      '<input type="file" id="acad-file-input" accept=".bib,.csv,.txt" style="display:none">' +
      '<div class="acad-import-msg" id="acad-import-msg"></div>' +
      '<button class="acad-clear-btn" id="acad-clear-btn">Clear imported data</button>' +
      '<div id="acad-schema-wrap"></div>' +
      '<div class="acad-action-row">' +
        '<button class="acad-action-btn" id="acad-blurb-btn">Generate methods blurb</button>' +
      '</div>' +
      '<textarea class="acad-blurb-ta" id="acad-blurb-ta" readonly></textarea>';

    loaderEl.appendChild(sec);

    var dropEl    = document.getElementById('acad-drop');
    var fileInput = document.getElementById('acad-file-input');
    var msgEl     = document.getElementById('acad-import-msg');
    var clearBtn  = document.getElementById('acad-clear-btn');
    var blurbBtn  = document.getElementById('acad-blurb-btn');
    var blurbTa   = document.getElementById('acad-blurb-ta');
    var schemaWrap= document.getElementById('acad-schema-wrap');

    var imported = loadImportedTabs();
    if (imported.length) {
      clearBtn.style.display = 'block';
      msgEl.textContent = imported.length + ' imported file(s) active';
      msgEl.className = 'acad-import-msg ok';
    }

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var text=e.target.result, name=file.name, entries=[];
        try {
          entries = name.toLowerCase().endsWith('.bib') ? parseBibTeX(text) : parseCSVText(text);
        } catch(err) {
          msgEl.textContent='Parse error: '+err.message; msgEl.className='acad-import-msg err'; return;
        }
        if (!entries.length) { msgEl.textContent='No entries found in file.'; msgEl.className='acad-import-msg err'; return; }
        var grid = citationsToGrid(entries, name.replace(/\.[^.]+$/,''));
        saveImportedTabs([{ name:'MX-'+name.replace(/[^a-zA-Z0-9]/g,'-').replace(/-+/g,'-'), grid:grid }]);
        msgEl.textContent=entries.length+' entries imported from '+name+'. Reloading...';
        msgEl.className='acad-import-msg ok';
        clearBtn.style.display='block';
        setTimeout(function(){location.reload();},900);
      };
      reader.readAsText(file);
    }

    dropEl.addEventListener('click', function(){fileInput.click();});
    fileInput.addEventListener('change', function(){handleFile(fileInput.files[0]);});
    dropEl.addEventListener('dragover', function(e){e.preventDefault();dropEl.classList.add('drag-over');});
    dropEl.addEventListener('dragleave', function(){dropEl.classList.remove('drag-over');});
    dropEl.addEventListener('drop', function(e){
      e.preventDefault();dropEl.classList.remove('drag-over');handleFile(e.dataTransfer.files[0]);
    });
    clearBtn.addEventListener('click', function(){
      clearImportedTabs();
      msgEl.textContent='Imported data cleared. Reloading...';
      msgEl.className='acad-import-msg';
      clearBtn.style.display='none';
      setTimeout(function(){location.reload();},700);
    });
    blurbBtn.addEventListener('click', function(){
      blurbTa.style.display='block';
      blurbTa.value=generateMethodsBlurb();
      blurbTa.select();
    });

    window.addEventListener('sheet-loaded', function(){
      if (!window.TABS||!window.TABS.length) return;
      var allHeaders=[];
      window.TABS.forEach(function(tab){
        var data=typeof processSheetData==='function'?processSheetData(tab.grid):null;
        if (data) allHeaders=allHeaders.concat(data.headers);
      });
      if (!allHeaders.length) return;
      var v=validateSchema(allHeaders);
      var cls=v.valid?'ok':(v.missing.length<=2?'warn':'missing');
      var icon=v.valid?'OK':'!';
      var msg=v.valid?'Schema valid — all recommended columns present':'Missing: '+v.missing.join(', ');
      schemaWrap.innerHTML='<span class="acad-schema-badge '+cls+'" title="Recommended columns: title, authors, year, doi">'+icon+' '+msg+'</span>';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE B: FIND MATCHES — saved searches + export + score colouring
  // ══════════════════════════════════════════════════════════════════════════

  function injectFindMatchesFeatures() {
    var searchBtn = document.getElementById('fm-search-btn');
    var inputEl   = document.getElementById('fm-input');
    if (!searchBtn || !inputEl) return;

    _css('acad-fm-styles', `
      .acad-fm-btn {
        flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 18px;
        border: 1px solid var(--md-sys-color-outline, rgba(0,0,0,.38));
        background: transparent; font-size: 13px; font-weight: 500; cursor: pointer;
        white-space: nowrap; transition: background .15s;
        color: var(--md-sys-color-primary, #6750a4);
      }
      .acad-fm-btn:hover { background: color-mix(in srgb, var(--md-sys-color-primary,#6750a4) 8%, transparent); }
      .acad-fm-btn:disabled { opacity: .38; cursor: not-allowed; }
      .acad-fm-btn.secondary { color: var(--md-sys-color-on-surface-variant, #49454f); }
      .acad-fm-btn.secondary:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface,#000) 6%, transparent); }
      .acad-saved-section { border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.12)); }
      .acad-saved-label { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant); padding: 10px 16px 4px; display: block; }
      .acad-saved-item {
        display: flex; align-items: center; padding: 5px 16px 5px 12px; gap: 6px; cursor: pointer;
        background: none; border: none; width: 100%; text-align: left;
        transition: background .1s;
      }
      .acad-saved-item:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface,#000) 5%, transparent); }
      .acad-saved-query { flex: 1; font-size: 12px; font-weight: 500; color: var(--md-sys-color-on-surface);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .acad-saved-meta  { font-size: 10px; color: var(--md-sys-color-on-surface-variant); white-space: nowrap; }
      .acad-saved-del   { width: 22px; height: 22px; border-radius: 50%; border: none; background: none;
        cursor: pointer; color: var(--md-sys-color-on-surface-variant); font-size: 14px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: color .1s; }
      .acad-saved-del:hover { color: var(--md-sys-color-error, #b3261e); }
      .acad-saved-empty { font-size: 11px; color: var(--md-sys-color-on-surface-variant);
        padding: 4px 16px 8px; font-style: italic; }
      .fm-score-label.hi  { color: #2e7d32 !important; font-weight: 700 !important; }
      .fm-score-label.mid { color: var(--md-sys-color-primary, #6750a4) !important; font-weight: 600 !important; }
    `);

    var searchBar = document.querySelector('.fm-search-bar');
    if (searchBar) {
      var saveBtn = document.createElement('button');
      saveBtn.className = 'acad-fm-btn'; saveBtn.id = 'acad-save-btn';
      saveBtn.textContent = 'Save search'; saveBtn.disabled = true;

      var exportBtn = document.createElement('button');
      exportBtn.className = 'acad-fm-btn secondary'; exportBtn.id = 'acad-export-btn';
      exportBtn.textContent = 'Export CSV'; exportBtn.disabled = true;

      searchBar.appendChild(saveBtn);
      searchBar.appendChild(exportBtn);

      var resultsEl = document.getElementById('fm-results');

      // Colour-code scores after results render
      if (resultsEl) {
        new MutationObserver(function(){
          resultsEl.querySelectorAll('.fm-score-label').forEach(function(el){
            var v=parseFloat(el.textContent)||0;
            el.classList.remove('hi','mid');
            if (v>=0.75) el.classList.add('hi');
            else if (v>=0.50) el.classList.add('mid');
          });
          // enable save/export if there are result cards
          var hasResults = resultsEl.querySelectorAll('.fm-card').length > 0;
          saveBtn.disabled = exportBtn.disabled = !hasResults;
        }).observe(resultsEl, {childList:true, subtree:true});
      }

      saveBtn.addEventListener('click', function(){
        var query=inputEl.value.trim(); if (!query) return;
        var cards=resultsEl?resultsEl.querySelectorAll('.fm-card'):[];
        saveSearch(query, Array.from(cards));
        renderSavedSearches();
        saveBtn.textContent='Saved';
        setTimeout(function(){saveBtn.textContent='Save search';},1500);
      });

      exportBtn.addEventListener('click', function(){
        var query=inputEl.value.trim();
        var cards=resultsEl?Array.from(resultsEl.querySelectorAll('.fm-card')):[];
        var headers=['rank','score','category','content'];
        var rows=cards.map(function(card,i){
          var scoreEl=card.querySelector('.fm-score-label');
          var catEl=card.querySelector('.fm-cat-tag');
          var valEl=card.querySelector('.fm-cell-value');
          return [i+1,scoreEl?scoreEl.textContent:'',catEl?catEl.textContent:'',valEl?valEl.textContent:''];
        });
        downloadBlob('# Query: '+query+'\n# Date: '+new Date().toISOString()+'\n'+rowsToCSV(headers,rows),
          'search-'+query.slice(0,24).replace(/\W+/g,'_')+'-'+Date.now()+'.csv','text/csv');
      });
    }

    // Saved searches in the side panel
    var panelBody = document.querySelector('.pp-side-panel-body');
    if (panelBody) {
      var sec = document.createElement('div');
      sec.className = 'acad-saved-section'; sec.id = 'acad-saved-section';
      panelBody.appendChild(sec);
      renderSavedSearches();
    }

    function renderSavedSearches() {
      var container = document.getElementById('acad-saved-section');
      if (!container) return;
      var searches = getSavedSearches();
      container.innerHTML = '<span class="acad-saved-label">Saved searches</span>';
      if (!searches.length) {
        container.innerHTML += '<div class="acad-saved-empty">No saved searches yet</div>';
        return;
      }
      searches.forEach(function(s){
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;';
        var btn = document.createElement('button');
        btn.className = 'acad-saved-item';
        btn.innerHTML =
          '<span class="acad-saved-query">'+s.query+'</span>' +
          '<span class="acad-saved-meta">'+s.count+' &middot; '+s.date+'</span>';
        btn.addEventListener('click', function(){if(inputEl) inputEl.value=s.query;});
        var del = document.createElement('button');
        del.className='acad-saved-del'; del.textContent='x'; del.title='Delete';
        del.addEventListener('click', function(e){
          e.stopPropagation(); deleteSavedSearch(s.id); renderSavedSearches();
        });
        row.appendChild(btn); row.appendChild(del);
        container.appendChild(row);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE C: SPREADSHEET — non-destructive screening overlay + DOI links + progress bar
  // Strategy: never touch the table structure. Use a floating popover triggered
  // by right-click or shift-click on any data row.
  // ══════════════════════════════════════════════════════════════════════════

  function injectSpreadsheetFeatures() {
    // Wait for data-body to be populated
    function waitForData() {
      var dataBody = document.getElementById('data-body');
      if (!dataBody) { setTimeout(waitForData, 200); return; }

      // Watch for rows being added
      var observer = new MutationObserver(function() { attachRowHandlers(); updateProgressBar(); });
      observer.observe(dataBody, { childList: true });
      attachRowHandlers();

      _css('acad-ss-styles', `
        .acad-screen-pop {
          position: fixed; z-index: 9999;
          background: var(--md-sys-color-surface-container, #f7f2fa);
          border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.18));
          border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.18);
          padding: 12px 14px; min-width: 200px; display: none;
        }
        .acad-screen-pop.open { display: block; }
        .acad-screen-pop-label {
          font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          color: var(--md-sys-color-on-surface-variant); margin-bottom: 9px;
        }
        .acad-screen-btns { display: flex; gap: 6px; }
        .acad-screen-btn {
          flex: 1; height: 30px; border-radius: 15px; border: 1px solid transparent;
          font-size: 12px; font-weight: 500; cursor: pointer; transition: box-shadow .1s;
        }
        .acad-screen-btn.inc { background: rgba(46,125,50,.1);  color: #2e7d32; border-color: rgba(46,125,50,.3); }
        .acad-screen-btn.exc { background: rgba(183,28,28,.1); color: #b71c1c; border-color: rgba(183,28,28,.3); }
        .acad-screen-btn.un  { background: var(--md-sys-color-surface-container-high,#ece6f0); color: var(--md-sys-color-on-surface-variant); }
        .acad-screen-btn:hover { box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .acad-note-label {
          font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
          color: var(--md-sys-color-on-surface-variant); margin-top: 9px; margin-bottom: 4px;
          display: block;
        }
        .acad-note-ta {
          width: 100%; min-height: 48px; resize: vertical; box-sizing: border-box;
          border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.18));
          border-radius: 5px; padding: 5px 7px; font-size: 12px;
          background: transparent; color: inherit; font-family: inherit;
        }
        .acad-note-ta:focus { outline: none; border-color: var(--md-sys-color-primary, #6750a4); }
        .acad-screen-tip {
          font-size: 10px; color: var(--md-sys-color-on-surface-variant);
          text-align: right; margin-top: 7px; letter-spacing: .02em;
        }
        #data-body tr { cursor: context-menu; }
        #data-body tr[data-screen="included"] { background: rgba(46,125,50,.055) !important; }
        #data-body tr[data-screen="excluded"] { background: rgba(183,28,28,.055) !important; }
        .acad-doi-link {
          color: var(--md-sys-color-primary, #6750a4); text-decoration: none; font-weight: 500;
        }
        .acad-doi-link:hover { text-decoration: underline; }
        .acad-fetch-btn {
          font-size: 10px; color: var(--md-sys-color-secondary, #625b71);
          background: none; border: none; cursor: pointer; padding: 0 4px;
          text-decoration: underline; letter-spacing: .01em;
        }
        .acad-progress {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
          height: 26px; display: flex; align-items: center; gap: 10px; padding: 0 14px;
          background: var(--md-sys-color-surface-container, #f7f2fa);
          border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.1));
          font-size: 11px; color: var(--md-sys-color-on-surface-variant);
        }
        .acad-prog-track {
          flex: 1; height: 4px; border-radius: 2px;
          background: var(--md-sys-color-secondary-container, #e8def8); overflow: hidden;
        }
        .acad-prog-inc { height: 100%; background: #4caf50; float: left; transition: width .3s; }
        .acad-prog-exc { height: 100%; background: #ef9a9a; float: left; transition: width .3s; }
        .acad-prog-export {
          height: 22px; padding: 0 10px; border-radius: 11px;
          border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.2));
          background: transparent; font-size: 11px; cursor: pointer; color: inherit;
          white-space: nowrap; flex-shrink: 0;
        }
      `);

      // Floating popover
      var pop = document.createElement('div');
      pop.className = 'acad-screen-pop'; pop.id = 'acad-screen-pop';
      pop.innerHTML =
        '<div class="acad-screen-pop-label">Screening decision</div>' +
        '<div class="acad-screen-btns">' +
          '<button class="acad-screen-btn inc" data-s="included">Include</button>' +
          '<button class="acad-screen-btn exc" data-s="excluded">Exclude</button>' +
          '<button class="acad-screen-btn un"  data-s="unscreened">Reset</button>' +
        '</div>' +
        '<span class="acad-note-label">Note</span>' +
        '<textarea class="acad-note-ta" id="acad-note-ta" placeholder="Optional reason or note..."></textarea>' +
        '<div class="acad-screen-tip">Right-click any row to screen it</div>';
      document.body.appendChild(pop);

      var _activeTr = null, _activeTi = null, _activeRi = null;

      pop.querySelectorAll('.acad-screen-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (_activeTi===null) return;
          var note = document.getElementById('acad-note-ta').value;
          setScreeningStatus(_activeTi, _activeRi, btn.dataset.s, note);
          setAnnotation(_activeTi, _activeRi, note);
          if (_activeTr) _activeTr.dataset.screen = btn.dataset.s;
          updateProgressBar();
          closePop();
        });
      });

      document.addEventListener('click', function(e){
        if (!pop.contains(e.target)) closePop();
      });
      document.addEventListener('keydown', function(e){ if(e.key==='Escape') closePop(); });

      function closePop() { pop.classList.remove('open'); _activeTi=_activeTr=null; }

      function openPop(tr, ti, ri, x, y) {
        _activeTr=tr; _activeTi=ti; _activeRi=ri;
        document.getElementById('acad-note-ta').value=getAnnotation(ti,ri);
        var pw=210, ph=180;
        var left=Math.min(x, window.innerWidth-pw-8);
        var top =Math.min(y, window.innerHeight-ph-8);
        pop.style.left=left+'px'; pop.style.top=top+'px';
        pop.classList.add('open');
      }

      // Progress bar
      var progBar = document.createElement('div');
      progBar.className='acad-progress'; progBar.id='acad-progress';
      progBar.innerHTML=
        '<span id="acad-prog-label">Screening</span>' +
        '<div class="acad-prog-track"><div class="acad-prog-inc" id="acad-prog-inc" style="width:0"></div>' +
        '<div class="acad-prog-exc" id="acad-prog-exc" style="width:0"></div></div>' +
        '<span id="acad-prog-pct"></span>' +
        '<button class="acad-prog-export" id="acad-prog-export">Export CSV</button>';
      document.body.appendChild(progBar);
      document.getElementById('acad-prog-export').addEventListener('click', exportSpreadsheetCSV);

      function updateProgressBar() {
        var p=getScreeningProgress(); if (!p||!p.total) return;
        var screened=p.included+p.excluded;
        document.getElementById('acad-prog-label').textContent=
          p.included+' in  '+p.excluded+' out  '+p.unscreened+' pending';
        document.getElementById('acad-prog-inc').style.width=(p.included/p.total*100)+'%';
        document.getElementById('acad-prog-exc').style.width=(p.excluded/p.total*100)+'%';
        document.getElementById('acad-prog-pct').textContent=Math.round(screened/p.total*100)+'%';
      }
      window.updateProgressBar = updateProgressBar;

      var _rowsProcessed = 0;

      function attachRowHandlers() {
        var dataBody = document.getElementById('data-body');
        if (!dataBody) return;
        var rows = dataBody.querySelectorAll('tr');

        rows.forEach(function(tr, i) {
          if (tr.dataset.acadDone) return;
          tr.dataset.acadDone = '1';

          // Use global tab index from TABS; default 0 for single-tab sheets
          var ti = tr.dataset.acadTabIdx !== undefined ? parseInt(tr.dataset.acadTabIdx) : 0;
          var ri = i;
          tr.dataset.acadTabIdx = ti;
          tr.dataset.acadRowIdx = ri;

          // Apply saved screen colour
          var status = getScreeningStatus(ti, ri);
          if (status !== 'unscreened') tr.dataset.screen = status;

          // Right-click to screen
          tr.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            openPop(tr, ti, ri, e.clientX, e.clientY);
          });

          // DOI-linkify cells
          tr.querySelectorAll('td').forEach(function(td) {
            var doi = normaliseDOI(td.textContent.trim());
            if (!doi) return;
            var link = document.createElement('a');
            link.className='acad-doi-link'; link.href='https://doi.org/'+doi;
            link.target='_blank'; link.rel='noopener'; link.textContent=doi;
            var fetchBtn = document.createElement('button');
            fetchBtn.className='acad-fetch-btn'; fetchBtn.textContent='fetch';
            fetchBtn.addEventListener('click', function(e) {
              e.stopPropagation(); fetchBtn.textContent='...'; fetchBtn.disabled=true;
              resolveDOI(doi).then(function(meta){
                fetchBtn.textContent='fetched';
                fetchBtn.title=[meta.title,meta.authors,meta.year,meta.journal].filter(Boolean).join(' | ');
              }).catch(function(){fetchBtn.textContent='error';});
            });
            td.textContent=''; td.appendChild(link); td.appendChild(document.createTextNode(' ')); td.appendChild(fetchBtn);
          });
        });

        updateProgressBar();
      }
    }

    waitForData();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE D: CLUSTERS — move rail buttons into panel header + silhouette in subtitle
  // ══════════════════════════════════════════════════════════════════════════

  function injectClusterFeatures() {
    if (!document.getElementById('cl-pane')) return;

    _css('acad-cl-styles', `
      .acad-cl-header-actions {
        display: flex; align-items: center; gap: 4px; margin-top: 6px;
      }
      .acad-cl-hdr-btn {
        height: 28px; padding: 0 10px; border-radius: 14px;
        border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.18));
        background: transparent; font-size: 11px; font-weight: 600; letter-spacing: .04em;
        color: var(--md-sys-color-on-surface-variant); cursor: pointer;
        display: inline-flex; align-items: center; gap: 5px;
        transition: background .12s, color .12s;
      }
      .acad-cl-hdr-btn:hover {
        background: var(--md-sys-color-surface-container-high, #ece6f0);
        color: var(--md-sys-color-on-surface);
      }
      .acad-sil-inline {
        font-size: 11px; font-weight: 600; letter-spacing: .02em;
        color: var(--md-sys-color-on-surface-variant); margin-left: 2px;
        white-space: nowrap;
      }
      .acad-sil-inline .sil-val { font-variant-numeric: tabular-nums; }
      .acad-sil-inline.good .sil-val { color: #2e7d32; }
      .acad-sil-inline.ok   .sil-val { color: var(--md-sys-color-primary, #6750a4); }
      .acad-sil-inline.poor .sil-val { color: var(--md-sys-color-on-surface-variant); }
    `);

    // Wait for the panel header to exist (initClustersTool creates it)
    function tryMoveButtons() {
      var panelHeader = document.querySelector('.pp-side-panel-header');
      var sheetBtn    = document.getElementById('pp-cl-sheet-btn');
      var exportBtn   = document.getElementById('pp-cl-export-btn');
      if (!panelHeader || !sheetBtn || !exportBtn) {
        setTimeout(tryMoveButtons, 80);
        return;
      }

      // Create a row of action buttons in the panel header
      var row = document.createElement('div');
      row.className = 'acad-cl-header-actions';

      // Clone original buttons as styled compact versions
      function makeHdrBtn(label, svgInner, clickFn) {
        var btn = document.createElement('button');
        btn.className = 'acad-cl-hdr-btn';
        btn.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+svgInner+'</svg>'+
          label;
        btn.addEventListener('click', clickFn);
        return btn;
      }

      // Table toggle — forward click to original button
      var tblBtn = makeHdrBtn('Table',
        '<rect x="1.5" y="1.5" width="15" height="15" rx="2"/><line x1="1.5" y1="6.5" x2="16.5" y2="6.5"/><line x1="1.5" y1="11.5" x2="16.5" y2="11.5"/><line x1="7" y1="6.5" x2="7" y2="16.5"/>',
        function() { sheetBtn.click(); }
      );

      // CSV export
      var csvBtn = makeHdrBtn('Export CSV',
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        function() { exportClustersFromDOM(); }
      );

      row.appendChild(tblBtn);
      row.appendChild(csvBtn);

      // Silhouette score placeholder (filled after compute)
      var silEl = document.createElement('span');
      silEl.id = 'acad-sil-inline';
      silEl.className = 'acad-sil-inline';
      row.appendChild(silEl);

      panelHeader.appendChild(row);

      // Hide original rail buttons (they still work, we just don't show them)
      sheetBtn.style.display  = 'none';
      exportBtn.style.display = 'none';
    }

    tryMoveButtons();

    // Compute silhouette and show inline
    function trySilhouette() {
      var rows = typeof window._bridgeRows !== 'undefined' ? window._bridgeRows : null;
      if (!rows || !rows.length) return;
      var nests = document.querySelectorAll('.pp-cl-nest, [data-cluster-name]');
      if (!nests.length) return;
      var clusters = [];
      nests.forEach(function(nest) {
        var items = [];
        nest.querySelectorAll('.pp-cl-card, [class*="cl-card"]').forEach(function(card) {
          var text = card.textContent.trim().slice(0,200);
          var row  = rows.find(function(r){
            var cells=(r.row&&r.row.cells)?r.row.cells:(r.cells||[]);
            return cells.some(function(c){return c&&text.includes(c.slice(0,30));});
          });
          if (row&&row.vec) items.push({vec:row.vec});
        });
        if (items.length>=2) clusters.push({items:items});
      });
      if (clusters.length<2) return;
      var score = computeSilhouette(clusters);
      if (score===null) return;
      var silEl = document.getElementById('acad-sil-inline');
      if (!silEl) return;
      var cls  = score>=0.5?'good':score>=0.25?'ok':'poor';
      var desc = score>=0.5?'strong':score>=0.25?'moderate':'weak';
      silEl.className = 'acad-sil-inline ' + cls;
      silEl.innerHTML =
        'Silhouette <span class="sil-val">'+score.toFixed(3)+'</span>' +
        ' <span style="font-weight:400;opacity:.7">('+desc+')</span>';
      silEl.title = 'Silhouette score: 1.0 = perfectly separated, 0.0 = overlapping, -1.0 = wrong assignments';
    }

    window.addEventListener('embedding-complete', function(){ setTimeout(trySilhouette, 2000); });
    document.addEventListener('embeddings-ready',  function(){ setTimeout(trySilhouette, 2000); });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE E: CONCEPT MAP — export buttons
  // ══════════════════════════════════════════════════════════════════════════

  function injectConceptMapFeatures() {
    function tryInject() {
      var head = document.getElementById('pp-cmap-head');
      if (!head) { setTimeout(tryInject, 100); return; }

      _css('acad-cm-styles', `
        .acad-cm-export-row { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
        .acad-cm-btn {
          height: 26px; padding: 0 11px; border-radius: 13px;
          border: 1px solid var(--md-sys-color-outline-variant, rgba(0,0,0,.2));
          background: transparent; font-size: 11px; font-weight: 600;
          letter-spacing: .03em; color: var(--md-sys-color-on-surface-variant);
          cursor: pointer; transition: background .12s, color .12s;
        }
        .acad-cm-btn:hover {
          background: var(--md-sys-color-surface-container-high, #ece6f0);
          color: var(--md-sys-color-on-surface);
        }
      `);

      var row = document.createElement('div');
      row.className = 'acad-cm-export-row';

      var pngBtn = document.createElement('button');
      pngBtn.className='acad-cm-btn'; pngBtn.textContent='Export PNG';
      pngBtn.addEventListener('click', exportConceptMapPNG);

      var svgBtn = document.createElement('button');
      svgBtn.className='acad-cm-btn'; svgBtn.textContent='Export SVG';
      svgBtn.addEventListener('click', exportConceptMapSVG);

      row.appendChild(pngBtn); row.appendChild(svgBtn);
      head.appendChild(row);
    }
    tryInject();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REFERENCE MANAGEMENT — RIS parser, APA formatter, library, matching
  // ══════════════════════════════════════════════════════════════════════════

  // ── RIS Parser ─────────────────────────────────────────────────
  function parseRIS(text) {
    var entries = [];
    var blocks = text.split(/\nER\s*-/).filter(function(b){return b.trim();});
    for (var bi = 0; bi < blocks.length; bi++) {
      var f = {}, lines = blocks[bi].split('\n');
      for (var li = 0; li < lines.length; li++) {
        var m = lines[li].match(/^([A-Z][A-Z0-9])\s*-\s*(.*)$/);
        if (!m) continue;
        var tag = m[1].trim(), val = m[2].trim();
        if (tag==='AU'||tag==='A1') { f.authorList = f.authorList||[]; f.authorList.push(val); }
        else if (tag==='TI'||tag==='T1') f.title = val;
        else if (tag==='PY'||tag==='Y1') f.year = val.replace(/\/.*/, '');
        else if (tag==='JO'||tag==='JF'||tag==='T2') f.journal = f.journal || val;
        else if (tag==='VL') f.volume = val;
        else if (tag==='IS') f.issue = val;
        else if (tag==='SP') f.startpage = val;
        else if (tag==='EP') f.endpage = val;
        else if (tag==='DO') f.doi = normaliseDOI(val) || '';
        else if (tag==='PB') f.publisher = val;
        else if (tag==='AB') f.abstract = val;
        else if (tag==='KW') { f.keywords = f.keywords ? f.keywords+'; '+val : val; }
        else if (tag==='UR') f.url = val;
      }
      if (f.title || f.authorList) {
        var authors = (f.authorList||[]).map(function(a){
          a = a.trim();
          if (a.indexOf(',')!==-1) { var p=a.split(','); return (p[1]||'').trim()+' '+p[0].trim(); }
          return a;
        }).filter(Boolean).join('; ');
        var pages = (f.startpage && f.endpage) ? f.startpage+'-'+f.endpage : f.startpage||'';
        entries.push({
          title: f.title||'', authors: authors, year: f.year||'',
          journal: f.journal||'', volume: f.volume||'', issue: f.issue||'',
          pages: pages, doi: f.doi||'', publisher: f.publisher||'',
          abstract: f.abstract||'', keywords: f.keywords||'',
          url: f.url || (f.doi ? 'https://doi.org/'+f.doi : ''),
        });
      }
    }
    return entries;
  }

  // ── Surname extractor ──────────────────────────────────────────
  function _extractSurname(authorStr) {
    var s = authorStr.trim();
    // "First Last" → "Last";  "Last, First" → "Last"
    if (s.indexOf(',') !== -1) return s.split(',')[0].trim();
    var parts = s.split(/\s+/);
    return parts[parts.length - 1];
  }

  // ── Build in-text key from surnames + year ─────────────────────
  function _buildInTextKey(surnames, year) {
    if (surnames.length === 1) return surnames[0] + ', ' + year;
    if (surnames.length === 2) return surnames[0] + ' & ' + surnames[1] + ', ' + year;
    return surnames[0] + ' et al., ' + year;
  }

  // ── Format parsed entry → APA 7th ed ──────────────────────────
  function formatAPA(entry) {
    // entry: { authors, year, title, journal, volume, issue, pages, doi, publisher }
    // authors is semicolon-separated "First Last; First Last" or similar
    var rawAuthors = (entry.authors||'').split(/\s*;\s*/).filter(Boolean);
    var surnames = rawAuthors.map(_extractSurname);
    var formatted = rawAuthors.map(function(a) {
      var sur = _extractSurname(a);
      var rest = a.replace(sur, '').replace(',', '').trim();
      var initials = rest.split(/[\s.]+/).filter(Boolean).map(function(n){
        return n[0].toUpperCase() + '.';
      }).join(' ');
      return initials ? sur + ', ' + initials : sur;
    });

    var authPart = '';
    if (formatted.length === 1) authPart = formatted[0];
    else if (formatted.length === 2) authPart = formatted[0] + ' & ' + formatted[1];
    else if (formatted.length <= 20) authPart = formatted.slice(0,-1).join(', ') + ', & ' + formatted[formatted.length-1];
    else authPart = formatted.slice(0,19).join(', ') + ', ... ' + formatted[formatted.length-1];

    var apa = authPart + ' (' + (entry.year||'n.d.') + '). ' + (entry.title||'Untitled') + '.';
    if (entry.journal) {
      apa += ' *' + entry.journal + '*';
      if (entry.volume) apa += ', *' + entry.volume + '*';
      if (entry.issue)  apa += '(' + entry.issue + ')';
      if (entry.pages)  apa += ', ' + entry.pages;
      apa += '.';
    } else if (entry.publisher) {
      apa += ' ' + entry.publisher + '.';
    }
    if (entry.doi) {
      var d = entry.doi.replace(/^https?:\/\/doi\.org\//, '');
      apa += ' https://doi.org/' + d;
    }

    var inTextKey = _buildInTextKey(surnames, entry.year || 'n.d.');
    return { apa: apa, inTextKey: inTextKey, surnames: surnames, year: entry.year||'' };
  }

  // ── Auto-extract in-text key from pasted APA string ────────────
  function extractKeyFromAPA(apaText) {
    var mYear = apaText.match(/\((\d{4}[a-z]?)\)/);
    if (!mYear) return null;
    var year = mYear[1];
    var before = apaText.slice(0, mYear.index).trim().replace(/,\s*$/, '');
    // Split on & to get author groups
    var chunks = before.split(/,?\s*&\s*/);
    var surnames = [];
    for (var i = 0; i < chunks.length; i++) {
      var parts = chunks[i].split(',').map(function(s){return s.trim();});
      // Surname is the first meaningful multi-char token (skip initials like "L.")
      var tokens = parts[0].split(/\s+/).filter(function(s){
        return s.length > 1 && !/^[A-Z]\.?$/.test(s);
      });
      if (tokens.length) surnames.push(tokens[tokens.length - 1]);
    }
    if (!surnames.length) return null;
    return { key: _buildInTextKey(surnames, year), surnames: surnames, year: year };
  }

  // ── Reference library — localStorage persistence ───────────────
  function _loadRefs() {
    try { return JSON.parse(localStorage.getItem(SK.REFERENCES) || '[]'); }
    catch(e) { return []; }
  }
  function _saveRefs(refs) {
    try { localStorage.setItem(SK.REFERENCES, JSON.stringify(refs)); } catch(e){}
  }

  function getReferences() { return _loadRefs(); }

  // Add a fully-formed reference: { apa, inTextKey, year, doi? }
  // Returns the reference if added, null if duplicate
  function addReference(ref) {
    var refs = _loadRefs();
    var nk = ref.inTextKey.toLowerCase().replace(/\s+/g,' ').trim();
    for (var i=0;i<refs.length;i++) {
      if (refs[i].inTextKey.toLowerCase().replace(/\s+/g,' ').trim()===nk) return null;
    }
    refs.push(ref);
    _saveRefs(refs);
    return ref;
  }

  // Remove by inTextKey
  function removeReference(inTextKey) {
    var refs = _loadRefs();
    var nk = inTextKey.toLowerCase().replace(/\s+/g,' ').trim();
    refs = refs.filter(function(r){ return r.inTextKey.toLowerCase().replace(/\s+/g,' ').trim() !== nk; });
    _saveRefs(refs);
  }

  // Import from BibTeX or RIS text — returns count added
  function importReferences(text) {
    var entries = parseBibTeX(text);
    if (!entries.length) entries = parseRIS(text);
    if (!entries.length) return 0;
    var count = 0;
    for (var i = 0; i < entries.length; i++) {
      var formatted = formatAPA(entries[i]);
      if (addReference({ apa: formatted.apa, inTextKey: formatted.inTextKey, year: formatted.year, doi: entries[i].doi||'' })) count++;
    }
    return count;
  }

  // Import from a pasted APA string
  function importAPAString(apaText) {
    var extracted = extractKeyFromAPA(apaText);
    if (!extracted) return null;
    return addReference({ apa: apaText.trim(), inTextKey: extracted.key, year: extracted.year, doi: '' });
  }

  // Manual assignment override: store overrides separately
  // _refOverrides: { citationKey: inTextKey-of-reference }
  var _overrideKey = 'df_ref_overrides';
  function _loadOverrides() { try{return JSON.parse(localStorage.getItem(_overrideKey)||'{}');}catch(e){return {};} }
  function _saveOverrides(o) { try{localStorage.setItem(_overrideKey,JSON.stringify(o));}catch(e){} }
  function setRefOverride(citeKey, refInTextKey) {
    var o = _loadOverrides(); o[citeKey.toLowerCase().trim()] = refInTextKey; _saveOverrides(o);
  }
  function clearRefOverride(citeKey) {
    var o = _loadOverrides(); delete o[citeKey.toLowerCase().trim()]; _saveOverrides(o);
  }

  // Match a citation key to a reference
  // Returns the reference object or null
  function matchReference(citeKey) {
    if (!citeKey) return null;
    var nk = citeKey.toLowerCase().replace(/\s+/g,' ').trim();
    // Check overrides first
    var overrides = _loadOverrides();
    var overrideTarget = overrides[nk];
    var refs = _loadRefs();
    if (overrideTarget) {
      var ot = overrideTarget.toLowerCase().replace(/\s+/g,' ').trim();
      for (var i=0;i<refs.length;i++) {
        if (refs[i].inTextKey.toLowerCase().replace(/\s+/g,' ').trim()===ot) return refs[i];
      }
    }
    // Auto-match
    for (var j=0;j<refs.length;j++) {
      if (refs[j].inTextKey.toLowerCase().replace(/\s+/g,' ').trim()===nk) return refs[j];
    }
    return null;
  }

  // Get all unique citation keys from loaded entries + their match status
  function getRefMatchSummary() {
    if (typeof window.TABS==='undefined'||!window.TABS.length) return {matched:0,unmatched:0,total:0,keys:[]};
    var keySet = {};
    var SY = window.SynthesisData;
    if (!SY) return {matched:0,unmatched:0,total:0,keys:[]};
    var noteKeys = SY.getRowNoteKeys ? SY.getRowNoteKeys() : [];
    noteKeys.forEach(function(nk){
      var r = SY.resolveNoteKey(nk); if (!r||!r.text) return;
      var cites = typeof extractAllCitations==='function' ? extractAllCitations(r.text) : [];
      cites.forEach(function(c){ keySet[c.key] = true; });
    });
    var allKeys = Object.keys(keySet);
    var matched = 0, unmatched = 0;
    allKeys.forEach(function(k){ if (matchReference(k)) matched++; else unmatched++; });
    return { matched:matched, unmatched:unmatched, total:allKeys.length, keys:allKeys };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-INIT
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
    resolveDOI:resolveDOI, parseBibTeX:parseBibTeX, parseRIS:parseRIS, parseCSVText:parseCSVText,
    citationsToGrid:citationsToGrid, validateSchema:validateSchema,
    getScreeningStatus:getScreeningStatus, setScreeningStatus:setScreeningStatus,
    getScreeningProgress:getScreeningProgress, getAnnotation:getAnnotation, setAnnotation:setAnnotation,
    getSavedSearches:getSavedSearches, saveSearch:saveSearch, deleteSavedSearch:deleteSavedSearch,
    computeSilhouette:computeSilhouette, exportClustersFromDOM:exportClustersFromDOM,
    exportSpreadsheetCSV:exportSpreadsheetCSV, exportConceptMapPNG:exportConceptMapPNG,
    exportConceptMapSVG:exportConceptMapSVG, generateMethodsBlurb:generateMethodsBlurb,
    downloadBlob:downloadBlob, rowsToCSV:rowsToCSV,
    loadImportedTabs:loadImportedTabs, clearImportedTabs:clearImportedTabs, normaliseDOI:normaliseDOI,
    // Reference management
    formatAPA:formatAPA, extractKeyFromAPA:extractKeyFromAPA, parseRIS:parseRIS,
    getReferences:getReferences, addReference:addReference, removeReference:removeReference,
    importReferences:importReferences, importAPAString:importAPAString,
    matchReference:matchReference, setRefOverride:setRefOverride, clearRefOverride:clearRefOverride,
    getRefMatchSummary:getRefMatchSummary,
  };
})();
