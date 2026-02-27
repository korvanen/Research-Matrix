'use strict';

// ════════════════════════════════════════════════════════════════════════════
// ☄️  GLOBAL SETTINGS — edit everything here, nowhere else needed
// ════════════════════════════════════════════════════════════════════════════

// ── CATEGORY PREFIX ────────────────────────────────────────────────────────
const CAT_PREFIX = 'PRINCIPLE ';

// ── SIDEBAR PANEL WIDTH ────────────────────────────────────────────────────
const PANEL_DEFAULT_FRACTION = 0.4;
const PANEL_MIN_PX           = 260;
const PANEL_MAX_FRACTION     = 0.80;
const PANEL_MIN_FRACTION     = 0.3;

// ── PLANE (CARD) PADDING ───────────────────────────────────────────────────
const PLANE_PAD_TOP_DIVISOR    = 50;
const PLANE_PAD_BOTTOM_DIVISOR = 10;
const PLANE_PAD_LEFT_DIVISOR   = 15;
const PLANE_PAD_RIGHT_DIVISOR  = 15;

// ── TABLE DIVIDER LINE THICKNESS ───────────────────────────────────────────
const CAT_DIVIDER_PX = 2;
const SUB_DIVIDER_PX = 1;

// ── STARTUP ANIMATION ──────────────────────────────────────────────────────
const PLANE_REVEAL_DELAY = 420;

// ── DUPLICATE THRESHOLD ────────────────────────────────────────────────────
const DUP_MIN_SHARED = 5;

// ── MINDMAP COLLISION SETTINGS ─────────────────────────────────────────────
const MM_PAD        = 8;
const MM_LINE_PAD   = 12;
const MM_ITERATIONS = 16;

// ── KEYWORD / NGRAM SETTINGS ───────────────────────────────────────────────
const KW_MIN_WORD_LENGTH  = 4;
const KW_MIN_SHARED       = 3;
const KW_COL_GROW_DEFAULT = 1;

// ── STOP WORDS ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'building','built','environment','architecture','architectural','planning',
  'residential','apartment','apartments','area','part','time','work','use',
  'paper','article','literature','practice','approach','model','system',
  'process','development','project','method','result','data','using','used',
  'also','within','between','among','example','context','only','claim','that',
  'housing','co-housing','cohousing','coliving','co-living','where','rarely','very'
]);

// ════════════════════════════════════════════════════════════════════════════
// END OF SETTINGS
// ════════════════════════════════════════════════════════════════════════════


function shift(hex,{h=0,s=0,l=0,a=1}={}){
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  let hh=0,ss=0,ll=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;ss=ll>.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:hh=((g-b)/d+(g<b?6:0))/6;break;case g:hh=((b-r)/d+2)/6;break;case b:hh=((r-g)/d+4)/6;break;}}
  hh=((hh*360+h)%360+360)%360;ss=Math.max(0,Math.min(100,ss*100+s));ll=Math.max(0,Math.min(100,ll*100+l));
  return a<1?`hsla(${hh.toFixed(1)},${ss.toFixed(1)}%,${ll.toFixed(1)}%,${a})`:`hsl(${hh.toFixed(1)},${ss.toFixed(1)}%,${ll.toFixed(1)}%)`;
}
function mkPlane(border){
  return{border,
    get bg(){return shift(this.border,{l:40})},get dot(){return this.border},
    get text(){return shift(this.border,{l:-20,s:-20})},get heading(){return shift(this.border,{l:-20,s:-20})},
    get label(){return shift(this.border,{l:-20,s:-20})},get rule(){return shift(this.border,{l:15})},
    get entryRule(){return shift(this.border,{l:20})},get hover(){return shift(this.border,{l:28,a:.55})},
    get shadow(){return shift(this.border,{a:.28})},get shadowFaint(){return shift(this.border,{l:10,a:.18})},
    get borderFaint(){return shift(this.border,{l:10,a:.5})},
    get clusterSeed(){return shift(this.border,{l:30,a:.65})},get clusterMatch(){return shift(this.border,{l:33,a:.40})},
  };
}
const PLANE_COLORS=[mkPlane('#81b29a'),{...mkPlane('#5a3f86'),get bg(){return shift(this.border,{l:60})}},mkPlane('#535fc1'),mkPlane('#bb463c')];

const XLSX_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vRKom5SD7yrnPoGV4pzsf4f20uv0nkrZXEDRA6_-g_ZTogUVBNPzeDAr4Przl7WA9Y07ev5XNuZbhTz/pub?output=xlsx';
const PLANES=[
  {tab:'VALUES',title:'The Dimension of Visions & Values'},
  {tab:'ORGANIZATIONAL',title:'The Organisational Dimension'},
  {tab:'RELATIONAL',title:'The Relational Dimension'},
  {tab:'PHYSICAL',title:'The Physical Dimension'},
];

const fmtCat=val=>CAT_PREFIX+val;

const MIN_KW     = KW_MIN_WORD_LENGTH;
const MIN_SHARED = KW_MIN_SHARED;
const COL_GROW_DEFAULT = KW_COL_GROW_DEFAULT;

let SCENE_W=1360,SCENE_H=960,PLANE_W=99999,PLANE_H=99999,PLANE_L=50,PLANE_T=0;

const DEFAULT_PANEL_W = Math.round(Math.max(PANEL_MIN_PX, Math.min(window.innerWidth * PANEL_MAX_FRACTION, window.innerWidth * PANEL_DEFAULT_FRACTION)));
const MIN_PANEL_W     = Math.round(window.innerWidth * PANEL_MIN_FRACTION);

const N=PLANES.length,VISIBLE=3;
const isPortrait=()=>window.innerWidth/window.innerHeight<1;
let order=[0,1,2,3],animating=false;

const stageEl=document.getElementById('stage'),sceneInner=document.getElementById('scene-inner');
const stackEl=document.getElementById('stack'),hintLabel=document.getElementById('hint-label');
const panelOpenBtn=document.getElementById('panel-open-btn');
const dotWindow=document.getElementById('dot-window'),arrLeft=document.getElementById('arr-left'),arrRight=document.getElementById('arr-right');
const statusEl=document.getElementById('status'),clusterPanel=document.getElementById('cluster-panel');
const panelBody=document.getElementById('panel-body'),panelSub=document.getElementById('panel-subtitle');
const panelClose=document.getElementById('panel-close'),hlToggle=document.getElementById('highlight-toggle');
const mmToggle=document.getElementById('mindmap-toggle'),mmWrap=document.getElementById('mindmap-wrap'),mmSvg=document.getElementById('mindmap-svg');
let mindmapOn=false;

let panelMode='related';
let _kwMinCount=1;
let _kwNgramSize=1;

function _hideKwSlider(){const w=document.getElementById('kw-slider-wrap');if(w)w.style.display='none';}

const setStatus=(m,err=false)=>{statusEl.textContent=m;statusEl.classList.toggle('err',err);statusEl.style.opacity='1'};
const escH=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const normStr=s=>String(s??'').toUpperCase().trim();
const fs=rem=>`calc(${rem}rem + var(--fs-bump))`;

function applyColors(el,c){
  const v={'--p-bg':c.bg,'--p-border':c.border,'--p-shadow':c.shadow,'--p-shadow-faint':c.shadowFaint,'--p-border-faint':c.borderFaint,'--p-heading':c.heading,'--p-text':c.text,'--p-label':c.label,'--p-rule':c.rule,'--p-entry-rule':c.entryRule,'--p-hover':c.hover,'--p-cluster-seed':c.clusterSeed,'--p-cluster-match':c.clusterMatch};
  Object.entries(v).forEach(([k,val])=>el.style.setProperty(k,val));
}

let fitDone=false;
function fitScene(animated=false){
  const sw=stageEl.clientWidth,sh=stageEl.clientHeight;
  SCENE_W=sw;SCENE_H=sh;
  sceneInner.style.cssText=`width:${sw}px;height:${sh}px;transform:translate(-50%,-50%)`;
  const sc=sceneInner.querySelector('.scene');if(sc)sc.style.cssText=`width:${sw}px;height:${sh}px`;
  stackEl.style.width=sw+'px';stackEl.style.height=sh+'px';
  const rootFs=parseFloat(getComputedStyle(document.documentElement).fontSize)||10;
  if(!fitDone){
    PLANE_W=sw;PLANE_H=sh;
    const padTop=Math.round((sw/PLANE_PAD_TOP_DIVISOR)/rootFs*10)/10;
    const padBot=Math.round((sw/PLANE_PAD_BOTTOM_DIVISOR)/rootFs*10)/10;
    const padLft=Math.round((sw/PLANE_PAD_LEFT_DIVISOR)/rootFs*10)/10;
    const padRgt=Math.round((sw/PLANE_PAD_RIGHT_DIVISOR)/rootFs*10)/10;
    document.querySelectorAll('.plane').forEach(pl=>{
      pl.style.setProperty('--plane-pad-top',padTop+'em');
      pl.style.setProperty('--plane-pad-bottom',padBot+'em');
      pl.style.setProperty('--plane-pad-left',padLft+'em');
      pl.style.setProperty('--plane-pad-right',padRgt+'em');
    });
    fitDone=true;
  }
  const nW=Math.min(PLANE_W,sw);
  const padLftEm=Math.round((sw/PLANE_PAD_LEFT_DIVISOR)/rootFs*10)/10;
  const padRgtEm=Math.round((sw/PLANE_PAD_RIGHT_DIVISOR)/rootFs*10)/10;

  PLANE_L=Math.round((sw-nW)/2);
  const trans=animated
    ?'opacity .4s ease,width .52s cubic-bezier(.4,0,.2,1),left .52s cubic-bezier(.4,0,.2,1)'
    :'none';
  document.querySelectorAll('.plane').forEach(pl=>{
    pl.style.transition=trans;
    pl.style.left=PLANE_L+'px';
    pl.style.top=PLANE_T+'px';
    pl.style.width=nW+'px';
    if(!parseFloat(pl.style.height))pl.style.height=PLANE_H+'px';
    pl.style.setProperty('--plane-pad-left',padLftEm+'em');
    pl.style.setProperty('--plane-pad-right',padRgtEm+'em');
    if(!animated)requestAnimationFrame(()=>{pl.style.transition='opacity .4s ease,width .52s cubic-bezier(.4,0,.2,1),left .52s cubic-bezier(.4,0,.2,1)';});
  });
  applyPositions(false);
  requestAnimationFrame(redrawSelectionOutline);
}
window.addEventListener('resize',()=>{fitScene(false);});

// ── PLANE ELEMENTS ─────────────────────────────────────────────────────
const planeEls=PLANES.map((p,pi)=>{
  const c=PLANE_COLORS[pi],el=document.createElement('div');
  el.className='plane';el.dataset.planeIdx=pi;applyColors(el,c);
  el.innerHTML=`<div class="plane-inner"><div class="plane-title">${p.title}</div>
      <div class="table-wrap" id="tw-${pi}">
        <div class="hdr-row" id="hr-${pi}"><div class="hdr-cat-spacer"></div><div class="hdr-sub-spacer"></div><div id="hc-${pi}" style="display:contents"></div></div>
        <div id="body-${pi}" style="display:contents"></div>
      </div></div>`;
  const nav=document.createElement('div');nav.className='plane-nav';
  const prevBtn=document.createElement('button');prevBtn.className='plane-nav-btn';
  prevBtn.innerHTML=`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  prevBtn.style.color=c.border;
  prevBtn.addEventListener('click',e=>{e.stopPropagation();if(!animating)bringToTop((order[0]+N-1)%N);});
  const nextBtn=document.createElement('button');nextBtn.className='plane-nav-btn';
  nextBtn.innerHTML=`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 1.5L7 5l-3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  nextBtn.style.color=c.border;
  nextBtn.addEventListener('click',e=>{e.stopPropagation();if(!animating)bringToTop((order[0]+1)%N);});
  nav.appendChild(prevBtn);nav.appendChild(nextBtn);
  el.appendChild(nav);stackEl.appendChild(el);return el;
});

// ── HELPERS ────────────────────────────────────────────────────────────
function extractTag(raw){
  const s=String(raw??'').trimEnd();
  const m=s.match(/^([\s\S]*?)(?:^| )(\([^()]+\))$/);
  if(!m)return{display:s,tag:''};
  return{display:m[1].trimEnd(),tag:m[2].slice(1,-1).trim()};
}
function extractKW(text){
  return[...new Set(
    String(text).toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/)
      .filter(w=>w.length>=MIN_KW&&!STOP_WORDS.has(w))
      .map(word=>word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word)
  )];
}
function extractNgrams(text,minN){
  const tokens=String(text).toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/)
    .filter(w=>w.length>=MIN_KW&&!STOP_WORDS.has(w))
    .map(word=>word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word);
  if(minN<=1)return[...new Set(tokens)];
  const grams=[];
  const MAX_GRAM=Math.min(tokens.length,5);
  for(let n=minN;n<=MAX_GRAM;n++){
    for(let i=0;i<=tokens.length-n;i++)grams.push(tokens.slice(i,i+n).join(' '));
  }
  return[...new Set(grams)];
}
function highlightKW(text,kwSet){
  if(!kwSet||!kwSet.size)return escH(text);
  const pat=new RegExp(`\\b(${[...kwSet].map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`,'gi');
  return escH(text).replace(pat,m=>`<mark class="kw">${m}</mark>`);
}
function emptyMsg(t='Click a cell to find related entries'){
  return`<div style="padding:24px 4px;font-size:${fs(.6)};color:rgba(0,0,0,.3);text-align:center;letter-spacing:.1em;text-transform:uppercase;">${t}</div>`;
}

// ── PARSE TAB ──────────────────────────────────────────────────────────
function parseTab(ws){
  const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(aoa.length<2)return{cats:[],cols:[]};
  const row0=aoa[0];
  const includedCols=new Set();
  row0.forEach((cell,ci)=>{if(String(cell??'').toUpperCase().includes('COLUMN'))includedCols.add(ci);});
  let hdrRowIdx=-1;
  for(let ri=0;ri<aoa.length;ri++){if(String(aoa[ri][0]??'').trim()==='HEADER ROW'){hdrRowIdx=ri;break;}}
  if(hdrRowIdx<0||hdrRowIdx>=aoa.length-1)return{cats:[],cols:[]};
  const hdrRow=aoa[hdrRowIdx];
  const cols=[];
  for(let ci=3;ci<hdrRow.length;ci++){
    if(!includedCols.has(ci))continue;
    cols.push({ci,label:String(hdrRow[ci]??'').trim()||`Col ${ci}`,searchable:false,description:''});
  }
  const colDescriptions={};
  for(let ri=aoa.length-1;ri>=0;ri--){
    const row=aoa[ri];if(!row)continue;
    if(String(row[0]??'').trim()==='HEADER INFO'){
      cols.forEach(col=>{const desc=String(row[col.ci]??'').trim();if(desc)colDescriptions[col.ci]=desc;});
      break;
    }
  }
  cols.forEach(col=>{if(colDescriptions[col.ci])col.description=colDescriptions[col.ci];});
  const catOrder=[],catMap={};
  for(let ri=hdrRowIdx+1;ri<aoa.length;ri++){
    const row=aoa[ri];
    if(!row||row.every(c=>String(c??'').trim()===''))continue;
    if(String(row[0]??'').trim()==='HEADER INFO')continue;
    const catVal=String(row[1]??'').trim();if(!catVal)continue;
    const subVal=String(row[2]??'').trim();
    if(!catMap[catVal]){catMap[catVal]={subOrder:[],subMap:{}};catOrder.push(catVal);}
    const cm=catMap[catVal];
    if(!cm.subMap[subVal]){cm.subMap[subVal]=[];cm.subOrder.push(subVal);}
    const values={};const tags={};
    cols.forEach(col=>{
      const raw=String(row[col.ci]??'').trim();
      const{display,tag}=extractTag(raw);
      values[col.ci]=display;if(tag)tags[col.ci]=tag;
    });
    cm.subMap[subVal].push({id:String(ri-hdrRowIdx),values,tags});
  }
  return{cats:catOrder.map(val=>({val,subs:catMap[val].subOrder.map(sv=>({val:sv,entries:catMap[val].subMap[sv]}))})),cols};
}

// ── HEADER TOOLTIP ─────────────────────────────────────────────────────
const hdrTooltipEl=(()=>{const t=document.createElement('div');t.className='hdr-tooltip';document.body.appendChild(t);return t;})();
let hdrTipTimer=null;
function showHdrTip(text,x,y){
  clearTimeout(hdrTipTimer);
  hdrTipTimer=setTimeout(()=>{
    hdrTooltipEl.textContent=text;
    const tw=220,pad=10;
    let lx=x-tw/2,ly=y+14;
    lx=Math.max(pad,Math.min(window.innerWidth-tw-pad,lx));
    if(ly+80>window.innerHeight)ly=y-80;
    hdrTooltipEl.style.left=lx+'px';hdrTooltipEl.style.top=ly+'px';
    hdrTooltipEl.classList.add('visible');
  },1500);
}
function hideHdrTip(){clearTimeout(hdrTipTimer);hdrTooltipEl.classList.remove('visible');}

// ── FILL PLANE ─────────────────────────────────────────────────────────
function fillPlane(pi,parsed){
  const{cats,cols}=parsed;
  planeEls[pi]._cols=cols;
  cols.forEach(col=>{col._grow=COL_GROW_DEFAULT;});

  const tw=document.getElementById(`tw-${pi}`);

  tw.style.setProperty('--col-count',cols.length);
  tw.style.setProperty('--cat-divider-px', CAT_DIVIDER_PX+'px');
  tw.style.setProperty('--sub-divider-px', SUB_DIVIDER_PX+'px');

requestAnimationFrame(()=>requestAnimationFrame(()=>{
const hdrCell=document.querySelector(`#hc-${pi} .hdr-cell`);
const hdrH=hdrCell?hdrCell.offsetHeight:0;
tw.style.setProperty('--scrollbar-top-offset', Math.round(hdrH)+'px');
}));

  // ── Header ──────────────────────────────────────────────────────────
  const hc=document.getElementById(`hc-${pi}`);hc.innerHTML='';
  cols.forEach(col=>{
    const cell=document.createElement('div');
    cell.className='hdr-cell'+(col.searchable?' srch-on':'');
    const name=document.createElement('span');name.className='hdr-cell-name';name.textContent=col.label;
    const pill=document.createElement('span');pill.className='srch-pill';pill.textContent='Included in match';
    cell.appendChild(name);cell.appendChild(pill);
    if(col.description){
      cell.addEventListener('mouseenter',e=>showHdrTip(col.description,e.clientX,e.clientY));
      cell.addEventListener('mousemove',e=>{
        clearTimeout(hdrTipTimer);
        hdrTipTimer=setTimeout(()=>{
          hdrTooltipEl.textContent=col.description;
          const tw=220,pad=10;let lx=e.clientX-tw/2,ly=e.clientY+14;
          lx=Math.max(pad,Math.min(window.innerWidth-tw-pad,lx));
          if(ly+80>window.innerHeight)ly=e.clientY-80;
          hdrTooltipEl.style.left=lx+'px';hdrTooltipEl.style.top=ly+'px';
          hdrTooltipEl.classList.add('visible');
        },1500);
      });
      cell.addEventListener('mouseleave',hideHdrTip);
    }
    cell.addEventListener('click',()=>{
      col.searchable=!col.searchable;
      const colLabel=col.label;
      PLANES.forEach((_,opi)=>{
        (planeEls[opi]._cols||[]).forEach(oc=>{
          if(oc.label!==colLabel)return;
          oc.searchable=col.searchable;
          const oh=document.getElementById(`hc-${opi}`);
          const mh=[...(oh?.querySelectorAll('.hdr-cell')||[])].find(h=>h.querySelector('.hdr-cell-name')?.textContent===colLabel);
          if(mh){mh.classList.remove('srch-on');if(col.searchable){void mh.offsetWidth;mh.classList.add('srch-on');}}
        });
        recomputeRowKW(opi);
        updateNonSearchableRows(opi);
      });
      if(panelMode==='related')reapplySelection();
      else if(panelMode==='duplicates')runDuplicates();
      else if(panelMode==='keywords')runKeywords();
    });
    hc.appendChild(cell);
  });

  // ── Body ─────────────────────────────────────────────────────────────
  const body=document.getElementById(`body-${pi}`);body.innerHTML='';
  if(!cats.length){
    const nd=document.createElement('div');nd.className='no-data';
    nd.style.gridColumn='1 / -1';nd.textContent='No data found';
    body.appendChild(nd);return;
  }

  cats.forEach(({val:catVal,subs},catIdx)=>{
    const isLastCat=catIdx===cats.length-1;
    const entryRowCount=subs.reduce((s,sb)=>s+sb.entries.length,0);
    const subDividerCount=subs.length-1;
    const catRowSpan=entryRowCount+subDividerCount;

    const cg=document.createElement('div');cg.className='cat-group';

    const cl=document.createElement('div');cl.className='cat-label';
    cl.textContent=fmtCat(catVal);
    cl.style.gridColumn='1';
    cl.style.gridRow=`span ${catRowSpan}`;
    cl.style.cursor='pointer';
    cl.addEventListener('click',ev=>{
      ev.stopPropagation();
      if(panelMode==='duplicates'||panelMode==='keywords')return;
      if(!hasSearchableCols(pi))return;
      if(selectionLevel==='cat'&&selActiveCat&&selActiveCat.pi===pi&&selActiveCat.catVal===catVal){
        clearAll();showPanelEmpty();return;
      }
      selectCatGroup(pi,catVal);
    });

    const cr=document.createElement('div');cr.className='cat-right';

    subs.forEach(({val:subVal,entries},subIdx)=>{
      const isLastSub=subIdx===subs.length-1;
      const subRowSpan=entries.length;

      const sg=document.createElement('div');sg.className='sub-group';

      const sl=document.createElement('div');sl.className='sub-label';
      sl.textContent=subVal;
      sl.style.gridColumn='2';
      sl.style.gridRow=`span ${subRowSpan}`;
      sl.style.cursor='pointer';
      sl.addEventListener('click',ev=>{
        ev.stopPropagation();
        if(panelMode==='duplicates'||panelMode==='keywords')return;
        if(!hasSearchableCols(pi))return;
        if(selectionLevel==='sub'&&selActiveSub&&selActiveSub.pi===pi&&selActiveSub.catVal===catVal&&selActiveSub.subVal===subVal){
          clearAll();showPanelEmpty();return;
        }
        selectSubGroup(pi,catVal,subVal);
      });

      const se=document.createElement('div');se.className='sub-entries';

      entries.forEach((e,entryIdx)=>{
        const isLastEntry=entryIdx===entries.length-1;
        const row=document.createElement('div');
        row.className='entry-row';
        if(!isLastEntry||!isLastSub||!isLastCat)row.classList.add('entry-border-bottom');
        row.dataset.planeIdx=pi;row.dataset.catVal=catVal;row.dataset.subVal=subVal;row.dataset.entryId=e.id;
        row.dataset.keywords=extractKW(cols.filter(c=>c.searchable).map(c=>e.values[c.ci]||'').join(' ')).join(' ');
        row.dataset.tags=JSON.stringify(e.tags||{});
        cols.forEach(col=>{
          const ec=document.createElement('div');
          ec.className='ecell'+(col.searchable?'':' not-searchable');
          ec.dataset.ci=col.ci;ec.dataset.planeIdx=pi;ec.dataset.entryId=e.id;
          const txt=document.createElement('span');txt.className='ecell-text';txt.textContent=e.values[col.ci]||'';
          ec.appendChild(txt);
          ec.addEventListener('click',ev=>{
            ev.stopPropagation();
            if(panelMode==='duplicates'||panelMode==='keywords')return;
            if(!col.searchable)return;
            selectCell(ec);
          });
          row.appendChild(ec);
        });
        se.appendChild(row);
      });

      if(!isLastSub){
        const subDiv=document.createElement('div');
        subDiv.className='sub-divider';
        subDiv.style.gridColumn='2 / -1';
        se.appendChild(subDiv);
      }

      sg.appendChild(sl);sg.appendChild(se);cr.appendChild(sg);
    });

    if(!isLastCat){
      const divider=document.createElement('div');
      divider.className='cat-divider';
      divider.style.gridColumn='1 / -1';
      cg._divider=divider;
    }

    cg.appendChild(cl);cg.appendChild(cr);body.appendChild(cg);

    if(cg._divider)body.appendChild(cg._divider);
  });

  updateNonSearchableRows(pi);
}

function recomputeRowKW(pi){
  const cols=planeEls[pi]._cols||[];
  document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"]`).forEach(row=>{
    row.dataset.keywords=extractKW(cols.filter(c=>c.searchable).map(c=>row.querySelector(`.ecell[data-ci="${c.ci}"] .ecell-text`)?.textContent||'').join(' ')).join(' ');
  });
}

function updateNonSearchableRows(pi){
  const cols=planeEls[pi]._cols||[];
  const anySearchable=cols.some(c=>c.searchable);
  document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"]`).forEach(row=>{
    row.classList.toggle('row-no-search',!anySearchable);
  });
  document.querySelectorAll(`.ecell[data-plane-idx="${pi}"]`).forEach(ec=>{
    const ci=parseInt(ec.dataset.ci);
    const col=cols.find(c=>c.ci===ci);
    ec.classList.toggle('col-unsearchable',col?!col.searchable:false);
  });
}

// ── SELECTION ──────────────────────────────────────────────────────────
let activeSeedCells=new Set();
let hlOn=true;

let selectionLevel='none';
let selActiveCat=null;
let selActiveSub=null;

function applyHlState(){
  document.querySelectorAll('#panel-body mark.kw,#mindmap-wrap mark.kw').forEach(m=>{
    m.style.borderBottomColor=hlOn?'':'transparent';m.style.fontWeight=hlOn?'':'inherit';
  });
}

function hasSearchableCols(pi){
  return(planeEls[pi]._cols||[]).some(c=>c.searchable);
}

function setSeedCells(ecells){
  activeSeedCells.forEach(ec=>ec.classList.remove('seed-cell','sel-group-member'));
  activeSeedCells.clear();
  clearMatchState();
  document.querySelectorAll('.entry-row.sel-row').forEach(el=>el.classList.remove('sel-row','sel-group-row'));
  document.querySelectorAll('.ecell.col-off-dim').forEach(ec=>ec.classList.remove('col-off-dim'));

  const isGroup=(selectionLevel==='sub'||selectionLevel==='cat');
  ecells.forEach(ec=>{
    activeSeedCells.add(ec);
    ec.classList.add('seed-cell');
    if(isGroup)ec.classList.add('sel-group-member');
  });

  if(ecells.length>0){
    const seedRows=[...new Set(ecells.map(ec=>ec.closest('.entry-row')).filter(Boolean))];
    seedRows.forEach(r=>{
      r.classList.add('sel-row');
      if(isGroup)r.classList.add('sel-group-row');
    });

    document.querySelectorAll('.entry-row').forEach(r=>{
      r.classList.toggle('muted',!seedRows.includes(r));
    });

    if(selectionLevel==='cell'){
      seedRows.forEach(r=>{
        r.querySelectorAll('.ecell').forEach(ec=>{
          if(!activeSeedCells.has(ec))ec.classList.add('col-off-dim');
        });
      });
    }

    if(isGroup){
      requestAnimationFrame(()=>requestAnimationFrame(()=>applyGroupOutline()));
    }
  }

  if(activeSeedCells.size>0)runCluster();
  else showPanelEmpty();
}

function redrawSelectionOutline(){
  if(selectionLevel==='none'||selectionLevel==='cell')return;
  if(activeSeedCells.size)requestAnimationFrame(()=>requestAnimationFrame(()=>applyGroupOutline()));
}

function clearGroupOutline(){
  document.querySelectorAll('.sel-outline-div').forEach(el=>el.remove());
}

function applyGroupOutline(){
  clearGroupOutline();
  if(!activeSeedCells.size)return;

  const firstEc=[...activeSeedCells][0];
  const pi=parseInt(firstEc.dataset.planeIdx);
  const tableWrap=document.getElementById(`tw-${pi}`);
  if(!tableWrap)return;

  function offsetRelTo(el){
    let x=0,y=0,cur=el;
    while(cur&&cur!==tableWrap){x+=cur.offsetLeft;y+=cur.offsetTop;cur=cur.offsetParent;}
    return{x,y,w:el.offsetWidth,h:el.offsetHeight};
  }

  const seedRows=[...new Set([...activeSeedCells].map(ec=>ec.closest('.entry-row')).filter(Boolean))];

  const rowRects=seedRows.map(r=>offsetRelTo(r));
  const minT=Math.min(...rowRects.map(r=>r.y));
  const maxB=Math.max(...rowRects.map(r=>r.y+r.h));

  let minL=Infinity,maxR=-Infinity;
  const pi2=parseInt(firstEc.dataset.planeIdx);
  const searchableCis=new Set((planeEls[pi2]._cols||[]).filter(c=>c.searchable).map(c=>c.ci));
  seedRows.forEach(row=>{
    const cells=[...row.querySelectorAll('.ecell')].filter(ec=>searchableCis.has(parseInt(ec.dataset.ci)));
    if(!cells.length)return;
    cells.forEach(ec=>{
      const r=offsetRelTo(ec);
      if(r.x<minL)minL=r.x;
      if(r.x+r.w>maxR)maxR=r.x+r.w;
    });
  });
  if(minL===Infinity)return;

  const PAD=1;
  const div=document.createElement('div');
  div.className='sel-outline-div';
  div.style.cssText=`position:absolute;pointer-events:none;z-index:3;`
    +`left:${minL-PAD}px;top:${minT-PAD}px;`
    +`width:${maxR-minL+PAD*2}px;height:${maxB-minT+PAD*2}px;`;
  tableWrap.appendChild(div);
}

function reapplySelection(){
  if(selectionLevel==='none'){if(activeSeedCells.size>0)runCluster();return;}
  if(selectionLevel==='cat'&&selActiveCat){
    selectCatGroup(selActiveCat.pi,selActiveCat.catVal);
  } else if(selectionLevel==='sub'&&selActiveSub){
    selectSubGroup(selActiveSub.pi,selActiveSub.catVal,selActiveSub.subVal);
  } else if(selectionLevel==='cell'){
    const stillValid=[...activeSeedCells].filter(ec=>{
      const pi=parseInt(ec.dataset.planeIdx);
      const ci=parseInt(ec.dataset.ci);
      return(planeEls[pi]._cols||[]).some(c=>c.ci===ci&&c.searchable);
    });
    if(stillValid.length>0){
      selectCell(stillValid[0]);
    } else {
      clearAll();showPanelEmpty();
    }
  }
}

function selectCell(ecell){
  selectionLevel='cell';
  selActiveCat=null;
  selActiveSub=null;
  clearCatSubHighlights();
  setSeedCells([ecell]);
}

function selectSubGroup(pi,catVal,subVal){
  selectionLevel='sub';
  selActiveCat={pi,catVal};
  selActiveSub={pi,catVal,subVal};
  highlightCatSubLabels();
  const ecells=[];
  document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"][data-cat-val="${CSS.escape(catVal)}"][data-sub-val="${CSS.escape(subVal)}"]`).forEach(row=>{
    (planeEls[pi]._cols||[]).forEach(col=>{
      if(!col.searchable)return;
      const ec=row.querySelector(`.ecell[data-ci="${col.ci}"]`);
      if(ec)ecells.push(ec);
    });
  });
  if(ecells.length===0){clearAll();showPanelEmpty();return;}
  setSeedCells(ecells);
}

function selectCatGroup(pi,catVal){
  selectionLevel='cat';
  selActiveCat={pi,catVal};
  selActiveSub=null;
  highlightCatSubLabels();
  const ecells=[];
  document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"][data-cat-val="${CSS.escape(catVal)}"]`).forEach(row=>{
    (planeEls[pi]._cols||[]).forEach(col=>{
      if(!col.searchable)return;
      const ec=row.querySelector(`.ecell[data-ci="${col.ci}"]`);
      if(ec)ecells.push(ec);
    });
  });
  if(ecells.length===0){clearAll();showPanelEmpty();return;}
  setSeedCells(ecells);
}

function highlightCatSubLabels(){
  document.querySelectorAll('.cat-label.sel-active,.sub-label.sel-active').forEach(el=>el.classList.remove('sel-active'));
  if(selectionLevel==='cat'&&selActiveCat){
    const pi=selActiveCat.pi;
    document.querySelectorAll(`#body-${pi} .cat-group`).forEach(cg=>{
      const cl=cg.querySelector('.cat-label');
      if(cl&&cl.textContent.trim()===fmtCat(selActiveCat.catVal)){
        cl.classList.add('sel-active');
        cg.querySelectorAll('.sub-label').forEach(sl=>sl.classList.add('sel-active'));
      }
    });
  } else if(selectionLevel==='sub'&&selActiveSub){
    const pi=selActiveSub.pi;
    document.querySelectorAll(`#body-${pi} .sub-group`).forEach(sg=>{
      const sl=sg.querySelector('.sub-label');
      if(sl&&sl.textContent.trim()===selActiveSub.subVal){
        const cg=sg.closest('.cat-group');
        const cl=cg&&cg.querySelector('.cat-label');
        if(cl&&cl.textContent.trim()===fmtCat(selActiveSub.catVal))sl.classList.add('sel-active');
      }
    });
  }
}

function clearCatSubHighlights(){
  document.querySelectorAll('.cat-label.sel-active,.sub-label.sel-active').forEach(el=>el.classList.remove('sel-active'));
}

function toggleCell(ecell){
  selectCell(ecell);
}

function clearMatchState(){
  document.querySelectorAll('.entry-row.muted').forEach(r=>r.classList.remove('muted'));
  document.querySelectorAll('.ecell.match-cell').forEach(ec=>ec.classList.remove('match-cell'));
  document.querySelectorAll('.ecell.col-off-dim').forEach(ec=>ec.classList.remove('col-off-dim'));
  clearGroupOutline();
}
function clearAll(){
  selectionLevel='none';selActiveCat=null;selActiveSub=null;
  clearCatSubHighlights();
  activeSeedCells.forEach(ec=>ec.classList.remove('seed-cell'));
  activeSeedCells.clear();clearMatchState();
  document.querySelectorAll('.entry-row.sel-row,.sub-entries.sel-group,.cat-right.sel-group-cat,.sub-group.sel-sub-group').forEach(el=>{
    el.classList.remove('sel-row','sel-group-row','sel-group','sel-group-cat','sel-sub-group');
  });
}
function showPanelEmpty(msg){
  const def=panelMode==='duplicates'?'Select columns to scan for duplicates':panelMode==='keywords'?'Keyword frequency analysis':'Click a cell to find related entries';
  panelSub.textContent=msg||def;
  panelBody.innerHTML=emptyMsg(msg||def);
  panelBody.style.display='';
  if(window._phToolsRow)window._phToolsRow.style.display='none';
  
  mindmapOn=false;window._setViewPill&&window._setViewPill(false,false);
  mmWrap.classList.remove('visible');mmWrap.innerHTML='';
  mmToggle.style.display=panelMode==='related'?'':'none';
  window._activeMmCardRects=null;window._activeMmRedrawArrows=null;window._activeMmCardPositions=null;
  const lp=document.getElementById('mm-layer-picker');
  if(lp)lp.style.display='none';
  _hideKwSlider();
}

// ── TRIPLE HEADER ──────────────────────────────────────────────────────
function buildDualHeader(){
  const panelHead=document.getElementById('panel-head');
  const oldText=document.getElementById('panel-head-text');
  const closeBtn=document.getElementById('panel-close');
  const toolbar=document.getElementById('panel-toolbar');

  const btnBar=document.createElement('div');
  btnBar.id='ph-btn-bar';

  const pill=document.createElement('div');
  pill.id='ph-toggle-pill';

  const MODES=[
    {id:'ph-btn-rel', mode:'related',    label:'Matches'},
    {id:'ph-btn-dup', mode:'duplicates', label:'Duplicates'},
    {id:'ph-btn-kw',  mode:'keywords',   label:'Keywords'},
  ];

  const btnEls={};
  MODES.forEach(({id,mode,label})=>{
    const btn=document.createElement('button');
    btn.id=id; btn.className='ph-mode-btn'+(mode==='related'?' active':'');
    btn.textContent=label;
    btn.addEventListener('click',()=>switchTo(mode));
    pill.appendChild(btn);
    btnEls[mode]=btn;
  });

  btnBar.appendChild(pill);
  oldText&&oldText.remove();

  const pillInd=document.createElement('div');
  pillInd.className='ph-pill-ind';
  pill.insertBefore(pillInd,pill.firstChild);

  function updatePillIndicator(activeMode,animate=true){
    const activeBtn=btnEls[activeMode];
    if(!activeBtn)return;
    if(!animate)pillInd.style.transition='none';
    pillInd.style.left=activeBtn.offsetLeft+'px';
    pillInd.style.width=activeBtn.offsetWidth+'px';
    if(!animate)requestAnimationFrame(()=>{pillInd.style.transition='';});
  }
  window._updatePillIndicator=updatePillIndicator;
  updatePillIndicator('related',false);
  if(window.ResizeObserver){
    new ResizeObserver(()=>updatePillIndicator(panelMode,false)).observe(pill);
  }

  panelHead.style.cssText='padding:0;flex-shrink:0;border-bottom:1px solid rgba(0,0,0,.08);display:flex;flex-direction:column;gap:0;';
  const topRow=document.createElement('div');
  topRow.style.cssText='display:flex;align-items:center;gap:0;padding:10px 12px 10px 14px;';
  topRow.appendChild(btnBar);
  topRow.appendChild(closeBtn);
  closeBtn.style.cssText='flex-shrink:0;margin-left:10px;';
  panelHead.insertBefore(topRow,panelHead.firstChild);

  const subBar=document.createElement('div');
  subBar.id='ph-sub-bar';
  subBar.style.cssText='padding:4px 16px 8px;display:flex;flex-direction:column;gap:4px;';
  subBar.appendChild(panelSub);

  const toolsRow=document.createElement('div');
  toolsRow.id='ph-tools-row';
  toolsRow.style.cssText='display:none;align-items:center;gap:6px;';

  hlToggle.innerHTML='';
  hlToggle.style.cssText='';
  hlToggle.className='';
  hlToggle.id='highlight-toggle';
  const hlInd=document.createElement('div');hlInd.className='vp-ind';
  const hlBtnShow=document.createElement('button');hlBtnShow.className='vp-btn active';hlBtnShow.textContent='Show Keywords';
  const hlBtnHide=document.createElement('button');hlBtnHide.className='vp-btn';hlBtnHide.textContent='Hide Keywords';
  hlToggle.appendChild(hlInd);hlToggle.appendChild(hlBtnShow);hlToggle.appendChild(hlBtnHide);

  function setHlPill(showing,animate=true){
    hlBtnShow.classList.toggle('active',showing);
    hlBtnHide.classList.toggle('active',!showing);
    const active=showing?hlBtnShow:hlBtnHide;
    if(!animate)hlInd.style.transition='none';
    hlInd.style.left=active.offsetLeft+'px';
    hlInd.style.width=active.offsetWidth+'px';
    if(!animate)requestAnimationFrame(()=>{hlInd.style.transition='';});
  }
  window._setHlPill=setHlPill;
  setHlPill(true,false);
  if(window.ResizeObserver){new ResizeObserver(()=>setHlPill(hlOn,false)).observe(hlToggle);}

  hlBtnShow.addEventListener('click',()=>{if(hlOn)return;hlOn=true;setHlPill(true);applyHlState&&applyHlState();});
  hlBtnHide.addEventListener('click',()=>{if(!hlOn)return;hlOn=false;setHlPill(false);applyHlState&&applyHlState();});
  hlToggle._pill=true;

  toolsRow.appendChild(hlToggle);
  toolsRow.appendChild(mmToggle);
  subBar.appendChild(toolsRow);
  window._phToolsRow=toolsRow;

  if(toolbar)subBar.appendChild(toolbar);
  panelHead.appendChild(subBar);

  function switchTo(mode){
    if(panelMode===mode)return;
    panelMode=mode;
    mindmapOn=false;
    window._setViewPill&&window._setViewPill(false,false);
    mmWrap.classList.remove('visible');
    panelBody.style.display='';
    const lp=document.getElementById('mm-layer-picker');
    if(lp)lp.style.display='none';
    Object.entries(btnEls).forEach(([m,b])=>b.classList.toggle('active',m===mode));
    window._updatePillIndicator&&window._updatePillIndicator(mode);
    clearAll();
    if(mode==='related')     {_hideKwSlider();showPanelEmpty();}
    else if(mode==='duplicates') {_hideKwSlider();runDuplicates();}
    else if(mode==='keywords')   runKeywords();
  }

  const layerPicker=document.createElement('div');
  layerPicker.id='mm-layer-picker';
  layerPicker.style.cssText='display:none;gap:5px;margin-top:6px;';
  [1,2,3,4,5].forEach(n=>{
    const btn=document.createElement('button');
    btn.className='mm-layer-btn'+(n===MAX_LAYERS?' active':'');
    btn.textContent=n;
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      MAX_LAYERS=n;
      layerPicker.querySelectorAll('.mm-layer-btn').forEach(b=>b.classList.toggle('active',parseInt(b.textContent)===n));
      if(mindmapOn)renderMindmap();
    });
    layerPicker.appendChild(btn);
  });
  subBar.appendChild(layerPicker);
}

// ── FIND DUPLICATES ────────────────────────────────────────────────────
function runDuplicates(){
  const cells=[];
  PLANES.forEach((_,pi)=>{
    document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"]`).forEach(row=>{
      (planeEls[pi]._cols||[]).forEach(col=>{
        if(!col.searchable)return;
        const text=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';
        if(!text.trim())return;
        cells.push({
          key:`${pi}-${row.dataset.entryId}-${col.ci}`,
          pi,entryId:row.dataset.entryId,ci:col.ci,
          colLabel:col.label,cat:row.dataset.catVal||'',sub:row.dataset.subVal||'',
          text,kws:new Set(extractKW(text)),
        });
      });
    });
  });

  if(!cells.length){
    panelSub.textContent='Select columns in the header to scan';
    panelBody.innerHTML=emptyMsg('Select columns in the header to scan for duplicates');
    if(window._phToolsRow)window._phToolsRow.style.display='none';
    return;
  }

  const parent=cells.map((_,i)=>i);
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function union(a,b){parent[find(a)]=find(b);}

  const pairShared=new Map();
  for(let i=0;i<cells.length;i++){
    for(let j=i+1;j<cells.length;j++){
      if(cells[i].key===cells[j].key)continue;
      const shared=new Set([...cells[i].kws].filter(k=>cells[j].kws.has(k)));
      if(shared.size>=DUP_MIN_SHARED){
        union(i,j);
        pairShared.set(`${i}-${j}`,shared);
      }
    }
  }

  const clusterMap=new Map();
  cells.forEach((_,i)=>{const r=find(i);if(!clusterMap.has(r))clusterMap.set(r,[]);clusterMap.get(r).push(i);});
  const clusters=[...clusterMap.values()].filter(g=>g.length>1);

  panelSub.textContent=clusters.length
    ?`${clusters.length} similarity group${clusters.length===1?'':'s'} found`
    :'No duplicates found';
  panelBody.innerHTML='';
  if(window._phToolsRow)window._phToolsRow.style.display='none';

  if(!clusters.length){
    panelBody.insertAdjacentHTML('beforeend',emptyMsg('No duplicates found in selected columns'));
    return;
  }

  clusters.forEach((group,gi)=>{
    const firstPi=cells[group[0]].pi;
    const c=PLANE_COLORS[firstPi];
    const wrap=document.createElement('div');
    wrap.className='dup-cluster';
    wrap.style.cssText=`width:100%;flex-basis:100%;display:flex;flex-direction:column;gap:6px;border:2px solid ${c.border};border-radius:10px;padding:8px 8px 10px;background:${c.bg};box-shadow:0 2px 14px ${c.shadow};`;
    const clabel=document.createElement('div');
    clabel.className='dup-cluster-label';
    clabel.style.cssText=`font-size:${fs(.34)};font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${c.border};margin-bottom:2px;opacity:.75;`;
    clabel.textContent=`Group ${gi+1} · ${group.length} similar entries`;
    wrap.appendChild(clabel);
    const cardsRow=document.createElement('div');
    cardsRow.style.cssText='display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;';
    group.forEach(idx=>{
      const cell=cells[idx];const pc=PLANE_COLORS[cell.pi];
      const allShared=new Set();
      group.forEach(oidx=>{
        if(oidx===idx)return;
        const k=idx<oidx?`${idx}-${oidx}`:`${oidx}-${idx}`;
        (pairShared.get(k)||new Set()).forEach(w=>allShared.add(w));
      });
      const card=document.createElement('div');card.className='pe';card.style.cssText='cursor:default;';
      [['--g-bg',pc.bg],['--g-border',pc.border],['--g-shadow',pc.shadow],
       ['--g-heading',pc.heading],['--g-text',pc.text],['--g-label',pc.label],['--g-rule',pc.rule]]
        .forEach(([k,v])=>card.style.setProperty(k,v));
      const head=document.createElement('div');head.className='pe-head';
      head.innerHTML=`<div class="pe-dot"></div><div class="pe-dim">${escH(cell.colLabel)}</div><div class="pe-cat-line">${escH(PLANES[cell.pi].title)}</div>`;
      const body=document.createElement('div');body.className='pe-body';
      const field=document.createElement('div');field.className='pe-field srch';
      field.innerHTML=highlightKW(cell.text,allShared);
      body.appendChild(field);
      if(cell.cat||cell.sub){
        const loc=document.createElement('div');loc.className='pe-field';
        loc.style.cssText=`opacity:.5;font-size:${fs(.5)};margin-top:4px;`;
        loc.textContent=[fmtCat(cell.cat),cell.sub].filter(Boolean).join(' · ');
        body.appendChild(loc);
      }
      card.appendChild(head);card.appendChild(body);
      cardsRow.appendChild(card);
    });
    wrap.appendChild(cardsRow);
    panelBody.appendChild(wrap);
  });

  if(panelBody.querySelector('mark.kw')){
    if(window._phToolsRow)window._phToolsRow.style.display='flex';
    mmToggle.style.display='none';
    hlOn=true;window._setHlPill&&window._setHlPill(true,false);
    applyHlState&&applyHlState();
  }
}

// ── RUN KEYWORDS ───────────────────────────────────────────────────────
function runKeywords(){
  if(window._phToolsRow)window._phToolsRow.style.display='none';
  
  panelBody.innerHTML='';

  function buildMaps(ngramSize){
    const globalMap=new Map();
    const subMap=new Map();
    const subOrd=[];
    PLANES.forEach((_,pi)=>{
      const cols=planeEls[pi]._cols||[];
      document.querySelectorAll(`.entry-row[data-plane-idx="${pi}"]`).forEach(row=>{
        const sub=row.dataset.subVal||'(no subcategory)';
        if(!subMap.has(sub)){subMap.set(sub,new Map());subOrd.push(sub);}
        const kwm=subMap.get(sub);
        cols.forEach(col=>{
          const text=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';
          extractNgrams(text,ngramSize).forEach(kw=>{
            kwm.set(kw,(kwm.get(kw)||0)+1);
            globalMap.set(kw,(globalMap.get(kw)||0)+1);
          });
        });
      });
    });
    return{globalMap,subMap,subOrd};
  }

  let{globalMap:globalKwMap,subMap:subKwMap,subOrd:subOrder}=buildMaps(_kwNgramSize);
  let activeSubs=subOrder.filter(s=>subKwMap.get(s)?.size>0);

  if(!activeSubs.length){
    panelSub.textContent='No keywords found';
    panelBody.innerHTML=emptyMsg('No keywords found');
    _hideKwSlider();
    return;
  }

  activeSubs.sort((a,b)=>a.localeCompare(b));
  let globalMax=[...globalKwMap.values()].reduce((m,v)=>Math.max(m,v),1);
  _kwMinCount=Math.max(1,Math.min(_kwMinCount,globalMax));

  _showKwSliders(globalMax);

  function renderRows(minCount){
    panelBody.innerHTML='';
    const totalVisible=[...globalKwMap.entries()].filter(([,c])=>c>=minCount).length;
    const wordLabel=_kwNgramSize===1?'keyword':_kwNgramSize===2?'phrase (2 words)':_kwNgramSize===3?'phrase (3 words)':`${_kwNgramSize}-word phrase`;
    panelSub.textContent=`${totalVisible} ${wordLabel}${totalVisible!==1?'s':''} · min count ${minCount}`;

    const rowWrap=document.createElement('div');
    rowWrap.style.cssText='width:100%;flex-basis:100%;display:flex;flex-direction:row;align-items:flex-start;gap:8px;';
    panelBody.appendChild(rowWrap);

    activeSubs.forEach(sub=>{
      const kwm=subKwMap.get(sub);
      const ranked=[...kwm.entries()]
        .filter(([kw])=>(globalKwMap.get(kw)||0)>=minCount)
        .sort((a,b)=>{
          const gd=(globalKwMap.get(b[0])||0)-(globalKwMap.get(a[0])||0);
          return gd!==0?gd:a[0].localeCompare(b[0]);
        });

      const section=document.createElement('div');
      section.className='kw-section';
      section.style.cssText='flex:1;min-width:0;';

      const hdr=document.createElement('div');
      hdr.className='kw-section-hdr';
      hdr.style.cssText='background:rgba(0,0,0,.05);border:1.5px solid rgba(0,0,0,.14);border-radius:7px 7px 0 0;padding:6px 10px 5px;';
      hdr.innerHTML=`<span style="color:rgba(0,0,0,.55);font-size:${fs(.44)};font-weight:700;letter-spacing:.16em;text-transform:uppercase;">${escH(sub)}</span>`;
      section.appendChild(hdr);

      const table=document.createElement('div');
      table.className='kw-table';
      table.style.cssText='border:1.5px solid rgba(0,0,0,.14);border-top:none;border-radius:0 0 7px 7px;overflow:hidden;';

      if(ranked.length===0){
        const empty=document.createElement('div');
        empty.style.cssText=`padding:6px 10px;font-size:${fs(.5)};color:rgba(0,0,0,.25);font-style:italic;text-align:center;`;
        empty.textContent='—';
        table.appendChild(empty);
      } else {
        const byWc=new Map();
        ranked.forEach(([kw,localCount])=>{
          const wc=kw.split(' ').length;
          if(!byWc.has(wc))byWc.set(wc,[]);
          byWc.get(wc).push([kw,localCount]);
        });
        const wcGroups=[...byWc.keys()].sort((a,b)=>a-b);
        let rowIdx=0;
        wcGroups.forEach((wc,gi)=>{
          const grpHdr=document.createElement('div');
          grpHdr.style.cssText=`padding:3px 8px 2px;font-size:${fs(.34)};font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,0,0,.3);`
            +(gi>0?'border-top:1px solid rgba(0,0,0,.1);margin-top:2px;':'');
          grpHdr.textContent=wc===1?'1 word':`${wc} words`;
          table.appendChild(grpHdr);
          byWc.get(wc).forEach(([kw,localCount])=>{
            const globalCount=globalKwMap.get(kw)||localCount;
            const row=document.createElement('div');
            row.className='kw-row';
            row.style.cssText='display:flex;align-items:center;padding:4px 8px;gap:6px;min-height:20px;'
              +`background:${rowIdx%2===0?'rgba(0,0,0,.025)':'transparent'};`
              +`border-top:${rowIdx>0?'1px solid rgba(0,0,0,.07)':''};`;
            row.innerHTML=
              `<span style="flex:1;font-size:${fs(.52)};color:rgba(0,0,0,.65);font-weight:500;letter-spacing:.04em;padding:2px 0;line-height:1.35;word-break:break-word;overflow-wrap:break-word;">${escH(kw)}</span>`
              +`<span style="flex-shrink:0;font-size:${fs(.48)};font-weight:700;letter-spacing:.06em;color:rgba(0,0,0,.35);min-width:18px;text-align:right;line-height:1;align-self:center;" title="local:${localCount} · global:${globalCount}">${globalCount}</span>`;
            table.appendChild(row);
            rowIdx++;
          });
        });
      }

      section.appendChild(table);
      rowWrap.appendChild(section);
    });
  }

  window._kwRenderRows=renderRows;

  window._kwRebuildAndRender=function(ngramSize){
    const built=buildMaps(ngramSize);
    globalKwMap=built.globalMap;
    subKwMap=built.subMap;
    activeSubs=built.subOrd.filter(s=>built.subMap.get(s)?.size>0);
    activeSubs.sort((a,b)=>a.localeCompare(b));
    globalMax=[...globalKwMap.values()].reduce((m,v)=>Math.max(m,v),1);
    _kwMinCount=Math.max(1,Math.min(_kwMinCount,globalMax));
    const countSlider=document.getElementById('kw-count-slider');
    const countLbl=document.getElementById('kw-count-lbl');
    if(countSlider){countSlider.max=String(globalMax);countSlider.value=String(_kwMinCount);}
    if(countLbl)countLbl.textContent=`min ${_kwMinCount}`;
    renderRows(_kwMinCount);
  };

  renderRows(_kwMinCount);
}

// ── KEYWORD SLIDERS ────────────────────────────────────────────────────
function _showKwSliders(globalMax){
  let wrap=document.getElementById('kw-slider-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='kw-slider-wrap';
    wrap.style.cssText='display:flex;flex-direction:row;gap:10px;margin-top:4px;';

    function makeSliderCol(id,lblId,labelText,min,max,val,onChange){
      const col=document.createElement('div');
      col.style.cssText='flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;';

      const lbl=document.createElement('span');
      lbl.id=lblId;
      lbl.style.cssText=`font-size:${fs(.36)};font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(0,0,0,.35);white-space:nowrap;`;
      lbl.textContent=labelText;

      const slider=document.createElement('input');
      slider.id=id;slider.type='range';
      slider.min=String(min);slider.max=String(max);slider.value=String(val);
      slider.style.cssText='width:100%;accent-color:rgba(0,0,0,.4);cursor:pointer;margin:0;';
      slider.addEventListener('input',()=>onChange(parseInt(slider.value),lbl));

      col.appendChild(lbl);col.appendChild(slider);
      return col;
    }

    const countCol=makeSliderCol(
      'kw-count-slider','kw-count-lbl',`min ${_kwMinCount}`,
      1,globalMax,_kwMinCount,
      (v,lbl)=>{_kwMinCount=v;lbl.textContent=`min ${v}`;window._kwRenderRows&&window._kwRenderRows(v);}
    );

    const MAX_NGRAM=5;
    const ngramCol=makeSliderCol(
      'kw-ngram-slider','kw-ngram-lbl',`${_kwNgramSize} word${_kwNgramSize===1?'':'s'}`,
      1,MAX_NGRAM,_kwNgramSize,
      (v,lbl)=>{_kwNgramSize=v;lbl.textContent=`${v} word${v===1?'':'s'}`;window._kwRebuildAndRender&&window._kwRebuildAndRender(v);}
    );

    wrap.appendChild(countCol);
    wrap.appendChild(ngramCol);

    const subBar=document.getElementById('ph-sub-bar');
    if(subBar)subBar.appendChild(wrap);
  }

  const countSlider=document.getElementById('kw-count-slider');
  const countLbl=document.getElementById('kw-count-lbl');
  const ngramSlider=document.getElementById('kw-ngram-slider');
  const ngramLbl=document.getElementById('kw-ngram-lbl');
  if(countSlider){countSlider.max=String(globalMax);countSlider.value=String(_kwMinCount);}
  if(countLbl)countLbl.textContent=`min ${_kwMinCount}`;
  if(ngramSlider)ngramSlider.value=String(_kwNgramSize);
  if(ngramLbl)ngramLbl.textContent=`${_kwNgramSize} word${_kwNgramSize===1?'':'s'}`;
  wrap.style.display='flex';
}

// ── RUN CLUSTER (Related mode) ─────────────────────────────────────────
function runCluster(){
  if(activeSeedCells.size===0){clearAll();showPanelEmpty();return;}
  const allSeedKws=new Set();
  activeSeedCells.forEach(ec=>{extractKW(ec.querySelector('.ecell-text')?.textContent||'').forEach(k=>allSeedKws.add(k));});
  const seedRows=new Set();const seedCellKeys=new Set();
  activeSeedCells.forEach(ec=>{const r=ec.closest('.entry-row');if(r)seedRows.add(r);seedCellKeys.add(`${ec.dataset.planeIdx}-${ec.dataset.entryId}-${ec.dataset.ci}`);});
  document.querySelectorAll('.entry-row').forEach(r=>r.classList.toggle('muted',!seedRows.has(r)));
  document.querySelectorAll('.ecell.match-cell').forEach(ec=>ec.classList.remove('match-cell'));
  const byPlane=new Map();let total=0;const matchedKws=new Set();let delay=0;const seenMatchRows=new Set();
  if(allSeedKws.size>=1){
    document.querySelectorAll('.entry-row').forEach(row=>{
      if(seedRows.has(row)){
        const rpi=parseInt(row.dataset.planeIdx);const rCols=planeEls[rpi]._cols||[];
        const hasNonSeedSearchable=rCols.some(col=>{if(!col.searchable)return false;return !seedCellKeys.has(`${row.dataset.planeIdx}-${row.dataset.entryId}-${col.ci}`);});
        if(!hasNonSeedSearchable)return;
      }
      const rowKey=`${row.dataset.planeIdx}-${row.dataset.entryId}`;
      if(seenMatchRows.has(rowKey))return;seenMatchRows.add(rowKey);
      const rpi=parseInt(row.dataset.planeIdx);const rCols=planeEls[rpi]._cols||[];
      const sharedByCi={};let sharedCount=0;
      rCols.forEach(col=>{
        if(!col.searchable)return;
        const cellKey=`${row.dataset.planeIdx}-${row.dataset.entryId}-${col.ci}`;
        if(seedCellKeys.has(cellKey))return;
        const cellText=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';
        const cellKws=new Set(extractKW(cellText));
        cellKws.forEach(k=>{if(allSeedKws.has(k)){if(!sharedByCi[col.ci])sharedByCi[col.ci]=new Set();if(!sharedByCi[col.ci].has(k)){sharedByCi[col.ci].add(k);sharedCount++;matchedKws.add(k);}}});
      });
      if(sharedCount<MIN_SHARED)return;
      row.classList.remove('muted');
      Object.keys(sharedByCi).forEach(ci=>{const ec=row.querySelector(`.ecell[data-ci="${ci}"]`);if(ec){ec.classList.add('match-cell');ec.style.setProperty('--gd',`${Math.min(delay,1.2)}s`);}});
      delay+=0.08;total++;
      if(!byPlane.has(rpi))byPlane.set(rpi,[]);
      const rowTags=JSON.parse(row.dataset.tags||'{}');const fv={},ftags={};
      rCols.forEach(col=>{fv[col.ci]=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';if(rowTags[col.ci])ftags[col.ci]=rowTags[col.ci];});
      byPlane.get(rpi).push({id:row.dataset.entryId,cat:row.dataset.catVal,sub:row.dataset.subVal,fv,ftags,cols:rCols,sharedByCi});
    });
  }
  buildPanel(byPlane,matchedKws,total,allSeedKws);
}

// ── BUILD PANEL (Related mode) ─────────────────────────────────────────
function buildPanel(byPlane,matchedKws,total,allKws){
  const allSelectedEmpty=[...activeSeedCells].every(ec=>(ec.querySelector('.ecell-text')?.textContent||'').trim()==='');
  if(allSelectedEmpty){
    panelSub.textContent='';panelBody.innerHTML=emptyMsg('The cell is empty — select a different cell');
    if(window._phToolsRow)window._phToolsRow.style.display='none';
    const wasOpen=clusterPanel.classList.contains('open');
    clusterPanel.classList.add('open');syncPanelBtn();if(!wasOpen&&!isPortrait())setTimeout(fitScene,540);return;
  }
  panelSub.textContent=total?`${total} match${total===1?'':'es'} · shared: ${[...matchedKws].slice(0,4).join(', ')}`:'No related entries found';
  panelBody.innerHTML='';

  const seedsByPlane=new Map();
  activeSeedCells.forEach(ec=>{const pi=parseInt(ec.dataset.planeIdx);if(!seedsByPlane.has(pi))seedsByPlane.set(pi,[]);seedsByPlane.get(pi).push(ec);});
  seedsByPlane.forEach((cells,pi)=>{
    const sc=PLANE_COLORS[pi];
    const card=document.createElement('div');card.className='seed-card';
    [['--sc-bg',sc.bg],['--sc-border',sc.border],['--sc-shadow',sc.shadow],['--sc-text',sc.text],['--sc-label',sc.label]].forEach(([k,v])=>card.style.setProperty(k,v));
    const seedCols=planeEls[pi]._cols||[];
    const seedRows=[...new Set(cells.map(ec=>ec.closest('.entry-row')).filter(Boolean))];
    const selCIs=new Set(cells.map(ec=>parseInt(ec.dataset.ci)));
    const colOrder=new Map(seedCols.map((c,idx)=>[c.ci,idx]));
    const orderedSel=[...selCIs].sort((a,b)=>(colOrder.get(a)??0)-(colOrder.get(b)??0));
    let sFields='';
    orderedSel.forEach(ci=>{
      const col=seedCols.find(c=>c.ci===ci);if(!col)return;
      const vals=[...new Set(seedRows.map(row=>row.querySelector(`.ecell[data-ci="${ci}"] .ecell-text`)?.textContent||'').filter(v=>v.trim()))];
      vals.forEach((val,vi)=>{
        const rowTags=JSON.parse(seedRows[vi]?.dataset.tags||'{}');
        const tag=rowTags&&rowTags[ci]?rowTags[ci]:'';
        const kwSet=new Set(extractKW(val));
        let inner=`<span class="sc-flabel">${escH(col.label)}</span>${highlightKW(val,kwSet)}`;
        if(tag)inner+=`<span class="cell-tag">${escH(tag)}</span>`;
        sFields+=`<div class="sc-field srch">${inner}</div>`;
      });
    });
    const headCat=seedRows[0]?.dataset.catVal||'';
    const headSub=seedRows[0]?.dataset.subVal||'';
    if(sFields){
      card.innerHTML=`<div class="sc-head"><div class="sc-dot"></div><div class="sc-label">${escH(PLANES[pi].title)}</div><span class="sc-badge">Selected</span><div class="sc-cat">${escH(fmtCat(headCat))}${headSub?' · '+escH(headSub):''}</div></div><div class="sc-body">${sFields}</div>`;
      panelBody.appendChild(card);
    }
  });

  if(!byPlane.size){
    panelBody.insertAdjacentHTML('beforeend',emptyMsg('No matches found'));
    if(window._phToolsRow)window._phToolsRow.style.display='none';
  } else {
    let globalDelay=0;
    [...byPlane.keys()].sort((a,b)=>a-b).forEach(pi=>{
      const entries=byPlane.get(pi);const c=PLANE_COLORS[pi];
      entries.forEach(e=>{
        const matchedCols=e.cols.filter(col=>{if(!col.searchable||!(e.fv[col.ci]||''))return false;return e.sharedByCi&&e.sharedByCi[col.ci];});
        const nonSearchableCols=e.cols.filter(col=>!col.searchable&&(e.fv[col.ci]||''));
        if(!matchedCols.length)return;
        const pill=document.createElement('div');
        pill.style.cssText='width:100%;display:flex;align-items:center;gap:6px;margin-top:6px;margin-bottom:2px;flex-basis:100%;';
        pill.innerHTML=`<span style="font-size:${fs(.36)};font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${c.border};background:${c.bg};border:1.5px solid ${c.border};border-radius:20px;padding:3px 10px;white-space:nowrap;">${escH(PLANES[pi].title)} · ${escH(fmtCat(e.cat))}${e.sub?' · '+escH(e.sub):''}</span><span style="flex:1;height:1.5px;background:${c.border};opacity:.18;border-radius:1px;"></span>`;
        panelBody.appendChild(pill);
        matchedCols.forEach(col=>{
          const card=document.createElement('div');card.className='pe';card.style.setProperty('--ed',`${globalDelay}ms`);
          [['--g-bg',c.bg],['--g-border',c.border],['--g-shadow',c.shadow],['--g-heading',c.heading],['--g-text',c.text],['--g-label',c.label],['--g-rule',c.rule]].forEach(([k,v])=>card.style.setProperty(k,v));
          globalDelay+=60;
          const head=document.createElement('div');head.className='pe-head';
          head.innerHTML=`<div class="pe-dot"></div><div class="pe-dim">${escH(col.label)}</div>`;
          const body=document.createElement('div');body.className='pe-body';
          const val=e.fv[col.ci]||'';const matchedSet=e.sharedByCi[col.ci];const tag=(e.ftags&&e.ftags[col.ci])?e.ftags[col.ci]:'';
          const field=document.createElement('div');field.className='pe-field srch';
          let html=highlightKW(val,matchedSet);if(tag)html+=`<span class="cell-tag">${escH(tag)}</span>`;
          field.innerHTML=html;body.appendChild(field);
          nonSearchableCols.forEach(nsCol=>{
            const nsVal=e.fv[nsCol.ci]||'';if(!nsVal)return;
            const nsField=document.createElement('div');nsField.className='pe-field';
            const nsTag=(e.ftags&&e.ftags[nsCol.ci])?e.ftags[nsCol.ci]:'';
            let nsHtml=`<span class="pe-flabel">${escH(nsCol.label)}</span>${escH(nsVal)}`;
            if(nsTag)nsHtml+=`<span class="cell-tag">${escH(nsTag)}</span>`;
            nsField.innerHTML=nsHtml;body.appendChild(nsField);
          });
          const gotoBtn=document.createElement('button');gotoBtn.className='pe-goto';gotoBtn.textContent='Go to cell';
          body.appendChild(gotoBtn);card.appendChild(head);card.appendChild(body);
          let tileHoverTimer=null;
          card.addEventListener('mouseenter',()=>{tileHoverTimer=setTimeout(()=>{panelBody.querySelectorAll('.pe-goto').forEach(b=>b.classList.remove('visible'));gotoBtn.classList.add('visible');},600);});
          card.addEventListener('mouseleave',()=>{clearTimeout(tileHoverTimer);if(!gotoBtn.matches(':hover'))gotoBtn.classList.remove('visible');});
          gotoBtn.addEventListener('mouseleave',()=>{gotoBtn.classList.remove('visible');});
          gotoBtn.addEventListener('click',ev=>{
            ev.stopPropagation();
            const targetRow=document.querySelector(`.entry-row[data-plane-idx="${pi}"][data-entry-id="${e.id}"]`);
            if(!targetRow)return;
            clearAll();if(order[0]!==pi)bringToTop(pi);
            setTimeout(()=>{const ec=targetRow.querySelector(`.ecell[data-ci="${col.ci}"]`);if(ec)toggleCell(ec);},order[0]===pi?0:700);
          });
          panelBody.appendChild(card);
        });
      });
    });
  }

  const hasHL=!!panelBody.querySelector('mark.kw');
  if(hasHL){
    hlOn=true;window._setHlPill&&window._setHlPill(true,false);
    applyHlState&&applyHlState();
  }

  if(total>0){
    if(window._phToolsRow)window._phToolsRow.style.display='flex';
    mmToggle.style.display='';
    if(mindmapOn)renderMindmap();
  } else {
    mindmapOn=false;window._setViewPill&&window._setViewPill(false,false);
    panelBody.style.display='';mmWrap.classList.remove('visible');
    if(window._phToolsRow)window._phToolsRow.style.display=hasHL?'flex':'none';
  }

  const wasOpen=clusterPanel.classList.contains('open');
  clusterPanel.classList.add('open');syncPanelBtn();if(!wasOpen&&!isPortrait())setTimeout(fitScene,540);
}

// ── VIEW PILL (Tiles | Mindmap) ────────────────────────────────────────
(()=>{
  const el=mmToggle;
  el.innerHTML='';
  const ind=document.createElement('div');ind.className='vp-ind';el.appendChild(ind);
  const btnTiles=document.createElement('button');btnTiles.className='vp-btn active';btnTiles.textContent='Tiles';el.appendChild(btnTiles);
  const btnMM=document.createElement('button');btnMM.className='vp-btn';btnMM.textContent='Mindmap';el.appendChild(btnMM);

  function setViewPill(toMindmap,animate=true){
    btnTiles.classList.toggle('active',!toMindmap);
    btnMM.classList.toggle('active',toMindmap);
    const active=toMindmap?btnMM:btnTiles;
    if(!animate)ind.style.transition='none';
    ind.style.left=active.offsetLeft+'px';
    ind.style.width=active.offsetWidth+'px';
    if(!animate)requestAnimationFrame(()=>{ind.style.transition='';});
  }
  window._setViewPill=setViewPill;
  setViewPill(false,false);
  if(window.ResizeObserver){
    new ResizeObserver(()=>setViewPill(mindmapOn,false)).observe(el);
  }

  btnTiles.addEventListener('click',()=>{
    if(!mindmapOn)return;
    mindmapOn=false;
    setViewPill(false);
    const lp=document.getElementById('mm-layer-picker');
    if(lp)lp.style.display='none';
    panelBody.style.display='';mmWrap.classList.remove('visible');
  });
  btnMM.addEventListener('click',()=>{
    if(mindmapOn)return;
    mindmapOn=true;
    setViewPill(true);
    const lp=document.getElementById('mm-layer-picker');
    if(lp)lp.style.display=(panelMode==='related')?'flex':'none';
    panelBody.style.display='none';mmWrap.classList.add('visible');renderMindmap();
  });
})();

// ── MINDMAP ────────────────────────────────────────────────────────────
let MAX_LAYERS=3;
let _mmCache=null;

function getLayerMatches(sourceEntry,sourcePlaneIdx,existingKeys){
  const sourceKws=new Set();
  const cols=planeEls[sourcePlaneIdx]._cols||[];
  cols.forEach(col=>{if(!col.searchable)return;if(!sourceEntry.sharedByCi||!sourceEntry.sharedByCi[col.ci])return;extractKW(sourceEntry.fv?.[col.ci]||'').forEach(k=>sourceKws.add(k));});
  if(!sourceKws.size)return[];
  const results=[];const seen=new Set();
  document.querySelectorAll('.entry-row').forEach(row=>{
    const rpi=parseInt(row.dataset.planeIdx);const uKey=`${rpi}-${row.dataset.entryId}`;
    if(existingKeys.has(uKey)||seen.has(uKey))return;seen.add(uKey);
    const rCols=planeEls[rpi]._cols||[];const sharedByCi={};let sharedCount=0;
    rCols.forEach(col=>{
      if(!col.searchable)return;
      const cellKws=new Set(extractKW(row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||''));
      cellKws.forEach(k=>{if(sourceKws.has(k)){if(!sharedByCi[col.ci])sharedByCi[col.ci]=new Set();sharedByCi[col.ci].add(k);sharedCount++;}});
    });
    if(sharedCount<MIN_SHARED)return;
    const rowTags=JSON.parse(row.dataset.tags||'{}');const fv={},ftags={};
    rCols.forEach(col=>{fv[col.ci]=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';if(rowTags[col.ci])ftags[col.ci]=rowTags[col.ci];});
    results.push({id:row.dataset.entryId,cat:row.dataset.catVal,sub:row.dataset.subVal,fv,ftags,cols:rCols,sharedByCi,planeIdx:rpi,uniqueKey:uKey});
  });
  return results;
}

function renderMindmap(){
  mmWrap.innerHTML='';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.id='mindmap-svg';svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
  mmWrap.appendChild(svg);
  if(!activeSeedCells.size){mmWrap.innerHTML=`<div style="padding:24px;font-size:${fs(.6)};color:rgba(0,0,0,.3);text-align:center;letter-spacing:.1em;text-transform:uppercase;">Select a cell first</div>`;return;}

  const W=mmWrap.clientWidth||380,H=mmWrap.clientHeight||500;
  const cx=W/2,cy=H/2;

  const cardPositions=new Map();
  const connections=[];
  const cardRects=new Map();
  window._activeMmCardRects=cardRects;
  
  const currentSeedKey=[...activeSeedCells].map(ec=>`${ec.dataset.planeIdx}-${ec.dataset.entryId}-${ec.dataset.ci}`).sort().join('|');
  const useCache=_mmCache&&_mmCache.seedKey===currentSeedKey;
  if(useCache)_mmCache.positions.forEach((v,k)=>cardPositions.set(k,v));

  const CARD_W=160,CARD_H_EST=90,SEED_KEY='seed';

  function redrawArrows(){
    while(svg.firstChild)svg.removeChild(svg.firstChild);
    connections.forEach(({fromKey,toKey,color,dashed})=>{const a=cardPositions.get(fromKey),b=cardPositions.get(toKey);if(a&&b)drawArrow(svg,a.cx,a.cy,b.cx,b.cy,color,dashed);});
  }
  window._activeMmRedrawArrows=redrawArrows;
  window._activeMmCardPositions=cardPositions;

  function clampToCanvas(x,y,w,h){
    return[Math.max(0,Math.min(mmWrap.clientWidth-w,x)),Math.max(0,Math.min(mmWrap.clientHeight-h,y))];
  }

  function pushOthers(dragKey){
    for(let pass=0;pass<MM_ITERATIONS;pass++){
      let anyMoved=false;
      for(const[ka,ra] of cardRects){
        if(ka===dragKey)continue;
        for(const[kb,rb] of cardRects){
          if(kb===ka)continue;
          if(!(ra.x<rb.x+rb.w+MM_PAD&&ra.x+ra.w+MM_PAD>rb.x&&
               ra.y<rb.y+rb.h+MM_PAD&&ra.y+ra.h+MM_PAD>rb.y))continue;
          const moveRight = rb.x+rb.w+MM_PAD - ra.x;
          const moveLeft  = ra.x+ra.w+MM_PAD - rb.x;
          const moveDown  = rb.y+rb.h+MM_PAD - ra.y;
          const moveUp    = ra.y+ra.h+MM_PAD - rb.y;
          const minH=Math.min(moveRight,moveLeft);
          const minV=Math.min(moveDown,moveUp);
          let nx=ra.x,ny=ra.y;
          if(minH<=minV){nx += moveRight<moveLeft ? moveRight : -moveLeft;}
          else          {ny += moveDown <moveUp   ? moveDown  : -moveUp;}
          const[cx2,cy2]=clampToCanvas(nx,ny,ra.w,ra.h);
          if(cx2===ra.x&&cy2===ra.y)continue;
          ra.x=cx2;ra.y=cy2;
          cardRects.set(ka,ra);
          const el=mmWrap.querySelector(`[data-mmkey="${ka}"]`);
          if(el){el.style.left=cx2+'px';el.style.top=cy2+'px';}
          const pos={cx:cx2+ra.w/2,cy:cy2+ra.h/2};
          cardPositions.set(ka,pos);
          if(_mmCache&&_mmCache.seedKey===currentSeedKey)_mmCache.positions.set(ka,pos);
          anyMoved=true;
        }
      }
      if(!anyMoved)break;
    }
  }

  function makeDraggable(el,key){
    el.dataset.mmkey=key;
    let dragging=false,ox=0,oy=0,startL=0,startT=0;
    el.addEventListener('mousedown',e=>{
      if(e.button!==0)return;dragging=true;ox=e.clientX;oy=e.clientY;
      startL=parseFloat(el.style.left)||0;startT=parseFloat(el.style.top)||0;
      el.style.zIndex=999;el.style.transition='none';e.preventDefault();e.stopPropagation();
    });
    document.addEventListener('mousemove',e=>{
      if(!dragging)return;
      const w=el.offsetWidth||CARD_W,h=el.offsetHeight||CARD_H_EST;
      const[newL,newT]=clampToCanvas(startL+(e.clientX-ox),startT+(e.clientY-oy),w,h);
      el.style.left=newL+'px';el.style.top=newT+'px';
      cardRects.set(key,{x:newL,y:newT,w,h});
      const pos={cx:newL+w/2,cy:newT+h/2};
      cardPositions.set(key,pos);
      if(_mmCache&&_mmCache.seedKey===currentSeedKey)_mmCache.positions.set(key,pos);
      pushOthers(key);
      redrawArrows();
    });
    document.addEventListener('mouseup',()=>{
      if(!dragging)return;
      dragging=false;el.style.zIndex='';
      for(const[k,r] of cardRects){
        const pos={cx:r.x+r.w/2,cy:r.y+r.h/2};
        cardPositions.set(k,pos);
        if(_mmCache&&_mmCache.seedKey===currentSeedKey)_mmCache.positions.set(k,pos);
      }
      redrawArrows();
    });
  }

  function makeCard(entry,col,planeIdx,layer,cardKey,parentKey,isSeed){
    const c=PLANE_COLORS[planeIdx];
    const card=document.createElement('div');
    card.className='mm-card'+(layer>=2?' layer2':'');
    const borderPx=layer===0?'2px':'1.5px';const zIdx=Math.max(1,10-layer*2);
    const headOp=layer>=2?';opacity:.85':'';const bodyOp=layer>=2?';opacity:.9':'';
    card.style.cssText=`width:${CARD_W}px;z-index:${zIdx};border:${borderPx} solid ${c.border};box-shadow:0 ${layer===0?4:layer===1?3:2}px ${layer===0?20:layer===1?14:10}px ${c.shadow};background:${c.bg};cursor:grab`;
    let bodyHtml='';
    if(isSeed){
      if(selectionLevel==='cat'&&selActiveCat){
        bodyHtml=`<div class="mm-card-field" style="font-weight:600;opacity:.75;">${escH(fmtCat(selActiveCat.catVal))}</div>`;
      } else if(selectionLevel==='sub'&&selActiveSub){
        bodyHtml=`<div class="mm-card-field" style="font-weight:600;opacity:.75;">${escH(fmtCat(selActiveSub.catVal))} · ${escH(selActiveSub.subVal)}</div>`;
      } else {
        [...activeSeedCells].forEach(ec=>{
          const ci=parseInt(ec.dataset.ci);const seedCol=planeEls[planeIdx]._cols?.find(c=>c.ci===ci);if(!seedCol)return;
          const val=ec.querySelector('.ecell-text')?.textContent||'';if(!val.trim())return;
          bodyHtml+=`<div class="mm-card-field"><span class="mm-card-label">${escH(seedCol.label)}</span><span class="mm-card-value">${escH(val)}</span></div>`;
        });
        bodyHtml=bodyHtml||'<em style="opacity:.4">selected</em>';
      }
    } else {
      const val=entry.fv[col.ci]||'';const matched=entry.sharedByCi[col.ci];
      bodyHtml=`<div class="mm-card-field"><span class="mm-card-label">${escH(col.label)}</span>${highlightKW(val,matched)}</div>`;
    }
    const gotoHtml=isSeed?'':`<button class="mm-goto">Go to cell</button>`;
    const headContent=isSeed
      ?`<span style="font-size:${fs(.3)};font-weight:700;letter-spacing:.18em;background:rgba(255,255,255,.22);color:#fff;border-radius:20px;padding:2px 8px;">SELECTED</span>`
      :``;
    card.innerHTML=`<div class="mm-card-head" style="background:${c.border}${headOp};display:flex;align-items:center;justify-content:${isSeed?'center':'flex-start'};min-height:${isSeed?'22px':'6px'};padding:${isSeed?'5px 10px':'0'};">${headContent}</div><div class="mm-card-body" style="color:${c.text}${bodyOp}">${bodyHtml}${gotoHtml}</div>`;
    if(!isSeed){
      let hoverTimer=null;const btn=card.querySelector('.mm-goto');
      card.addEventListener('mouseenter',()=>{hoverTimer=setTimeout(()=>{mmWrap.querySelectorAll('.mm-goto').forEach(b=>b.classList.remove('visible'));if(btn)btn.classList.add('visible');},600);});
      card.addEventListener('mouseleave',()=>{clearTimeout(hoverTimer);if(btn&&!btn.matches(':hover'))btn.classList.remove('visible');});
      if(btn){
        btn.addEventListener('mouseleave',()=>{btn.classList.remove('visible');});
        btn.addEventListener('click',ev=>{
          ev.stopPropagation();
          const targetRow=document.querySelector(`.entry-row[data-plane-idx="${planeIdx}"][data-entry-id="${entry.id}"]`);
          if(!targetRow)return;clearAll();if(order[0]!==planeIdx)bringToTop(planeIdx);
          setTimeout(()=>{const ec=targetRow.querySelector(`.ecell[data-ci="${col.ci}"]`);if(ec){toggleCell(ec);setTimeout(()=>{mindmapOn=true;window._setViewPill&&window._setViewPill(true);panelBody.style.display='none';mmWrap.classList.add('visible');renderMindmap();},50);}},order[0]===planeIdx?0:700);
        });
      }
    }
    mmWrap.appendChild(card);makeDraggable(card,cardKey);return card;
  }

  const seedCellArr=[...activeSeedCells];const seedPi=parseInt(seedCellArr[0].dataset.planeIdx);
  const seedRow=seedCellArr[0].closest('.entry-row');const allSeedKws=new Set();
  seedCellArr.forEach(ec=>{extractKW(ec.querySelector('.ecell-text')?.textContent||'').forEach(k=>allSeedKws.add(k));});
  const seedEntry={id:seedRow?.dataset.entryId,fv:{},sharedByCi:{}};
  const seedCard=makeCard(seedEntry,null,seedPi,0,SEED_KEY,null,true);

  const existingKeys=new Set();existingKeys.add(`${seedPi}-${seedRow?.dataset.entryId}`);
  const layerEntries=[];
  const layer1=[];const seenL1=new Set();
  document.querySelectorAll('.entry-row').forEach(row=>{
    const rpi=parseInt(row.dataset.planeIdx);const uKey=`${rpi}-${row.dataset.entryId}`;
    if(seenL1.has(uKey))return;seenL1.add(uKey);
    const rCols=planeEls[rpi]._cols||[];const sharedByCi={};let sharedCount=0;
    rCols.forEach(col=>{
      if(!col.searchable)return;
      const isSeedCell=[...activeSeedCells].some(ec=>parseInt(ec.dataset.planeIdx)===rpi&&ec.dataset.entryId===row.dataset.entryId&&parseInt(ec.dataset.ci)===col.ci);
      if(isSeedCell)return;
      const cellKws=new Set(extractKW(row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||''));
      cellKws.forEach(k=>{if(allSeedKws.has(k)){if(!sharedByCi[col.ci])sharedByCi[col.ci]=new Set();sharedByCi[col.ci].add(k);sharedCount++;}});
    });
    if(sharedCount<MIN_SHARED)return;
    if(row===seedRow&&!Object.keys(sharedByCi).length)return;
    const rowTags=JSON.parse(row.dataset.tags||'{}');const fv={},ftags={};
    rCols.forEach(col=>{fv[col.ci]=row.querySelector(`.ecell[data-ci="${col.ci}"] .ecell-text`)?.textContent||'';if(rowTags[col.ci])ftags[col.ci]=rowTags[col.ci];});
    layer1.push({id:row.dataset.entryId,cat:row.dataset.catVal,sub:row.dataset.subVal,fv,ftags,cols:rCols,sharedByCi,planeIdx:rpi});
    existingKeys.add(uKey);
  });
  layerEntries.push(layer1);
  for(let l=2;l<=MAX_LAYERS;l++){
    const prevLayer=layerEntries[l-2];const thisLayer=[];
    prevLayer.forEach(parentEntry=>{
      getLayerMatches(parentEntry,parentEntry.planeIdx,new Set(existingKeys)).forEach(m=>{
        if(!existingKeys.has(m.uniqueKey)){existingKeys.add(m.uniqueKey);thisLayer.push({...m,_parentId:`${parentEntry.planeIdx}-${parentEntry.id}`});}
      });
    });
    layerEntries.push(thisLayer);
  }

  requestAnimationFrame(()=>{
    const sH=seedCard.offsetHeight||CARD_H_EST;
    if(useCache&&cardPositions.has(SEED_KEY)){
      const saved=cardPositions.get(SEED_KEY);
      seedCard.style.left=(saved.cx-CARD_W/2)+'px';seedCard.style.top=(saved.cy-sH/2)+'px';
    } else {
      const sx=Math.max(0,Math.min(mmWrap.clientWidth-CARD_W,cx-CARD_W/2));
      const sy=Math.max(0,Math.min(mmWrap.clientHeight-sH,cy-sH/2));
      seedCard.style.left=sx+'px';seedCard.style.top=sy+'px';
      cardPositions.set(SEED_KEY,{cx,cy:sy+sH/2});
    }
    const seedLeft=parseFloat(seedCard.style.left)||0,seedTop=parseFloat(seedCard.style.top)||0;
    cardRects.set(SEED_KEY,{x:seedLeft,y:seedTop,w:CARD_W,h:sH});

    const baseRing=Math.min(W,H)*0.32,SPREAD=0.45;
    layerEntries.forEach((entries,layerIdx)=>{
      const layer=layerIdx+1,ringR=baseRing*layer,nEntries=entries.length;
      entries.forEach((entry,i)=>{
        const matchedCols=entry.cols.filter(col=>col.searchable&&(entry.fv[col.ci]||'')&&entry.sharedByCi[col.ci]);
        let angle;
        if(layer===1){angle=(2*Math.PI*i/nEntries)-Math.PI/2;}
        else{const pp=cardPositions.get(entry._parentId);angle=pp?Math.atan2(pp.cy-cy,pp.cx-cx):(2*Math.PI*i/nEntries)-Math.PI/2;angle+=(i%2===0?1:-1)*SPREAD*Math.ceil(i/2);}
        const entryKey=`${entry.planeIdx}-${entry.id}`;
        matchedCols.forEach((col,colIdx)=>{
          const cardKey=colIdx===0?entryKey:`${entryKey}-${colIdx}`;
          const parentKey=layer===1?SEED_KEY:entry._parentId||SEED_KEY;
          const card=makeCard(entry,col,entry.planeIdx,layer,cardKey,parentKey,false);
          requestAnimationFrame(()=>{
            const pH=card.offsetHeight||CARD_H_EST;
            if(useCache&&cardPositions.has(cardKey)){
              const saved=cardPositions.get(cardKey);const x=saved.cx-CARD_W/2,y=saved.cy-pH/2;
              card.style.left=x+'px';card.style.top=y+'px';
              cardRects.set(cardKey,{x,y,w:CARD_W,h:pH});
              connections.push({fromKey:parentKey,toKey:cardKey,color:PLANE_COLORS[entry.planeIdx].border,dashed:layer>=2});
              redrawArrows();return;
            }
            let x=Math.max(0,Math.min(mmWrap.clientWidth-CARD_W,cx+ringR*Math.cos(angle)-CARD_W/2));
            let y=Math.max(0,Math.min(mmWrap.clientHeight-pH,cy+ringR*Math.sin(angle)-pH/2+(colIdx*(pH+8))));
            for(let iter=0;iter<MM_ITERATIONS;iter++){
              let moved=false;
              for(const[,other] of cardRects){
                if(!(x<other.x+other.w+MM_PAD&&x+CARD_W+MM_PAD>other.x&&y<other.y+other.h+MM_PAD&&y+pH+MM_PAD>other.y))continue;
                const dL=(other.x+other.w+MM_PAD)-x,dR=(x+CARD_W+MM_PAD)-other.x;
                const dU=(other.y+other.h+MM_PAD)-y,dD=(y+pH+MM_PAD)-other.y;
                const minH=Math.min(dL,dR),minV=Math.min(dU,dD);
                if(minH<=minV){x+=dL<dR?-dL:dR;}else{y+=dU<dD?-dU:dD;}
                const[cx4,cy4]=clampToCanvas(x,y,CARD_W,pH);x=cx4;y=cy4;
                moved=true;
              }
              if(!moved)break;
            }
            card.style.left=x+'px';card.style.top=y+'px';
            cardRects.set(cardKey,{x,y,w:CARD_W,h:pH});
            cardPositions.set(cardKey,{cx:x+CARD_W/2,cy:y+pH/2});
            connections.push({fromKey:parentKey,toKey:cardKey,color:PLANE_COLORS[entry.planeIdx].border,dashed:layer>=2});
            redrawArrows();
          });
        });
      });
    });
    setTimeout(()=>{
      _mmCache={seedKey:currentSeedKey,positions:new Map(cardPositions)};
    },400);
  });
}

function drawArrow(svg,x1,y1,x2,y2,color,dashed){
  const ns='http://www.w3.org/2000/svg';
  const markerId=`arr-${color.replace(/[^a-z0-9]/gi,'_')}`;
  let defs=svg.querySelector('defs');
  if(!defs){defs=document.createElementNS(ns,'defs');svg.insertBefore(defs,svg.firstChild);}
  if(!defs.querySelector(`#${markerId}`)){
    const marker=document.createElementNS(ns,'marker');
    marker.setAttribute('id',markerId);marker.setAttribute('markerWidth','7');
    marker.setAttribute('markerHeight','7');
    marker.setAttribute('refX','6');marker.setAttribute('refY','3.5');marker.setAttribute('orient','auto');
    const poly=document.createElementNS(ns,'polygon');
    poly.setAttribute('points','0 0, 7 3.5, 0 7');
    poly.setAttribute('fill',color);
    poly.setAttribute('opacity',dashed?'0.38':'0.55');
    marker.appendChild(poly);defs.appendChild(marker);
  }
  const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1;
  const cpx=mx-dy*0.15,cpy=my+dx*0.15;
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`);
  path.setAttribute('fill','none');path.setAttribute('stroke',color);
  path.setAttribute('stroke-width',dashed?'1':'1.5');
  path.setAttribute('stroke-opacity',dashed?'0.38':'0.55');
  if(dashed)path.setAttribute('stroke-dasharray','4,3');
  path.setAttribute('marker-end',`url(#${markerId})`);
  svg.appendChild(path);
}

// ── PANEL CONTROLS ─────────────────────────────────────────────────────
function closePanelCompletely(){
  clearAll();if(window._phToolsRow)window._phToolsRow.style.display='none';
  mindmapOn=false;window._setViewPill&&window._setViewPill(false,false);panelBody.style.display='';mmWrap.classList.remove('visible');
  window._activeMmCardRects=null;window._activeMmRedrawArrows=null;window._activeMmCardPositions=null;
  clusterPanel.classList.remove('open');panelBody.innerHTML='';
  syncPanelBtn();if(!isPortrait())setTimeout(()=>fitScene(true),20);
}
function syncPanelBtn(){
  const o=clusterPanel.classList.contains('open');
  panelOpenBtn.classList.toggle('active',o);panelOpenBtn.setAttribute('aria-pressed',o);
}

(()=>{
  const grip=document.getElementById('panel-grip');
  let dragging=false,startX=0,startW=0;

  const MAX_W=Math.round(window.innerWidth * PANEL_MAX_FRACTION);
  grip.addEventListener('mousedown',e=>{e.preventDefault();dragging=true;startX=e.clientX;startW=clusterPanel.offsetWidth;document.body.style.cursor='ew-resize';document.body.style.userSelect='none';clusterPanel.style.transition='none';});
  
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const delta=startX-e.clientX;
    const newW=Math.max(MIN_PANEL_W,Math.min(MAX_W,startW+delta));
    const widthDelta=newW-clusterPanel.offsetWidth;
    clusterPanel.style.setProperty('--panel-w',newW+'px');
    fitScene(true);
    redrawSelectionOutline();
    if(widthDelta!==0&&mindmapOn){
      const canvasW=mmWrap.clientWidth;
      let anyMoved=false;
      for(const[k,r] of (window._activeMmCardRects||new Map())){
        const el=mmWrap.querySelector(`[data-mmkey="${k}"]`);if(!el)continue;
        const cardW=r.w||160;
        const maxX=canvasW-cardW;
        if((r.x||0)>maxX){
          const nx=Math.max(0,maxX);
          el.style.left=nx+'px';
          r.x=nx;
          const posMap=window._activeMmCardPositions;
          if(posMap)posMap.set(k,{cx:nx+cardW/2,cy:(posMap.get(k)?.cy??r.y+(r.h||90)/2)});
          anyMoved=true;
        }
      }
      if(anyMoved)window._activeMmRedrawArrows?.();
    }
  });
  
  document.addEventListener('mouseup',()=>{if(!dragging)return;dragging=false;document.body.style.cursor='';document.body.style.userSelect='';clusterPanel.style.transition='';});
})();

panelClose.addEventListener('click',closePanelCompletely);
panelOpenBtn.addEventListener('click',()=>{
  if(clusterPanel.classList.contains('open')){closePanelCompletely();return;}
  showPanelEmpty();clusterPanel.classList.add('open');syncPanelBtn();if(!isPortrait())setTimeout(fitScene,540);
});
stackEl.addEventListener('click',e=>{
  const isInteractive=e.target.closest('.ecell,.resize-handle,.hdr-cell,.cat-label,.sub-label');
  if(!isInteractive){if(activeSeedCells.size>0||selectionLevel!=='none'){clearAll();showPanelEmpty();}}
});

// ── LOAD DATA ──────────────────────────────────────────────────────────
async function loadData(){
  try{
    setStatus('Fetching spreadsheet…');
    const res=await fetch(XLSX_URL,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
    setStatus('Parsing…');
    const wb=XLSX.read(await res.arrayBuffer(),{type:'array'});
    const findTab=t=>{const tn=normStr(t);return wb.SheetNames.find(n=>normStr(n)===tn)||wb.SheetNames.find(n=>normStr(n).includes(tn)||tn.includes(normStr(n)));};
    let total=0;
    for(let pi=0;pi<PLANES.length;pi++){
      const tn=findTab(PLANES[pi].tab);
      if(!tn){document.getElementById(`body-${pi}`).innerHTML=`<div class="no-data" style="color:#c0392b">Tab "${PLANES[pi].tab}" not found</div>`;continue;}
      const parsed=parseTab(wb.Sheets[tn]);fillPlane(pi,parsed);
      total+=parsed.cats.reduce((s,c)=>s+c.subs.reduce((ss,sb)=>ss+sb.entries.length,0),0);
    }
    setStatus(`${total} entr${total!==1?'ies':'y'} loaded`);
    setTimeout(()=>{statusEl.style.opacity='0';},3000);
  }catch(err){console.error(err);setStatus(`Load failed: ${err.message}`,true);}
}

// ── CAROUSEL ───────────────────────────────────────────────────────────
const dotEls=PLANES.map((p,i)=>{
  const d=document.createElement('div');d.className='dot';d.style.background=PLANE_COLORS[i].dot;
  dotWindow.appendChild(d);
  d.addEventListener('click',e=>{e.stopPropagation();if(!animating)bringToTop(i);});
  d.addEventListener('mouseenter',()=>{hintLabel.textContent=p.title.toUpperCase();hintLabel.style.color='rgba(0,0,0,.55)';});
  d.addEventListener('mouseleave',refreshHint);
  return d;
});
arrLeft.addEventListener('click',()=>{if(!animating)bringToTop((order[0]+N-1)%N);});
arrRight.addEventListener('click',()=>{if(!animating)bringToTop((order[0]+1)%N);});

function renderCarousel(){
  dotEls.forEach((d,i)=>{const isActive=order[0]===i;d.style.display='block';d.style.opacity=isActive?'1':'0.28';d.style.transform=`scale(${isActive?1.55:1})`;d.classList.toggle('active',isActive);});
}
function refreshHint(){hintLabel.textContent=PLANES[order[0]].title.toUpperCase();hintLabel.style.color='rgba(0,0,0,.3)';}
function syncUI(){
  planeEls.forEach((el,i)=>{el.dataset.top=order[0]===i?'true':'false';});
  renderCarousel();refreshHint();
}

// ── ANIMATION ──────────────────────────────────────────────────────────
const ANIM={rise:200,land:220,easeRise:'cubic-bezier(.34,1.4,.64,1)',easeLand:'cubic-bezier(.22,1,.36,1)'};
const RISE_PX=40;

function stackOpacity(sp){return sp===0?'1':'0';}

function applyPositions(animated=true){
  order.forEach((pi,sp)=>{
    const el=planeEls[pi],isFront=sp===0;
    el.style.transition=animated?`transform ${ANIM.land}ms ${ANIM.easeLand}, opacity ${ANIM.land}ms ease`:'none';
    el.style.transform='none';
    el.style.zIndex=N-sp;
    el.style.opacity=stackOpacity(sp);
    el.style.pointerEvents=isFront?'':'none';
  });
  syncUI();
}

function bringToTop(target){
  if(order[0]===target||animating)return;
  animating=true;
  const targetEl=planeEls[target];
  order.forEach((pi,sp)=>{
    const el=planeEls[pi];
    el.style.transition='none';
    el.style.transform='none';
    el.style.zIndex=N-sp;
    el.style.opacity=stackOpacity(sp);
    el.style.pointerEvents='none';
  });
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    planeEls[order[0]].style.transition=`opacity ${ANIM.rise}ms ease, transform ${ANIM.rise}ms ${ANIM.easeRise}`;
    planeEls[order[0]].style.opacity='0';
    planeEls[order[0]].style.transform='scale(0.97)';
    targetEl.style.transition='none';
    targetEl.style.transform='scale(0.96)';
    targetEl.style.opacity='0';
    targetEl.style.zIndex=N+1;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      targetEl.style.transition=`transform ${ANIM.rise}ms ${ANIM.easeRise}, opacity ${ANIM.rise}ms ease`;
      targetEl.style.transform='scale(1)';
      targetEl.style.opacity='1';
      setTimeout(()=>{
        const idx=order.indexOf(target);
        order.splice(idx,1);
        order.unshift(target);
        order.forEach((pi,sp)=>{
          const el=planeEls[pi],isFront=sp===0;
          el.style.transition=`transform ${ANIM.land}ms ${ANIM.easeLand}, opacity ${ANIM.land}ms ease`;
          el.style.transform='none';
          el.style.zIndex=N-sp;
          el.style.opacity=stackOpacity(sp);
          el.style.pointerEvents=isFront?'':'none';
        });
        syncUI();
        setTimeout(()=>{animating=false;},ANIM.land);
      },ANIM.rise);
    }));
  }));
}

// ── INIT ───────────────────────────────────────────────────────────────
clusterPanel.style.setProperty('--panel-w',`${Math.max(MIN_PANEL_W,DEFAULT_PANEL_W)}px`);
applyPositions(false);renderCarousel();refreshHint();

buildDualHeader();
clusterPanel.classList.add('open');syncPanelBtn();showPanelEmpty();

(()=>{
  const bb=document.querySelector('.bottom-bar');
  if(bb&&stageEl&&!stageEl.contains(bb))stageEl.appendChild(bb);
})();

planeEls.forEach(pl=>{pl.style.opacity='0';pl.style.transition='none';});

setTimeout(()=>{
  fitScene();
  const frontPi=order[0];
  planeEls[frontPi].style.transition='opacity .55s cubic-bezier(.4,0,.2,1)';
  planeEls[frontPi].style.opacity='1';
},PLANE_REVEAL_DELAY);

loadData();

// ── FONT SCALE BUTTONS ─────────────────────────────────────────────────
(()=>{
  const bottomBar=document.querySelector('.bottom-bar');
  if(!bottomBar)return;
  const FS_STEP=0.07,FS_DOWN=3,FS_UP=6;
  const root=document.documentElement;
  const baseRem=parseFloat(getComputedStyle(root).getPropertyValue('--fs-bump'))||0;
  let steps=0;

  const wrap=document.createElement('div');
  wrap.id='fs-btn-wrap';
  wrap.style.cssText='display:flex;align-items:center;gap:0;position:absolute;left:2.4em;'
    +'top:50%;transform:translateY(-50%);z-index:10;';

  function mkScaleBtn(label,title,onClick){
    const b=document.createElement('button');
    b.textContent=label;b.title=title;
    b.style.cssText='display:flex;align-items:center;justify-content:center;'
      +'height:clamp(20px,1.8vw,28px);padding:0 clamp(6px,0.6vw,10px);'
      +'border:1.5px solid rgba(0,0,0,.14);background:transparent;'
      +'cursor:pointer;font-family:Inter,sans-serif;font-size:clamp(8px,0.7vw,12px);'
      +'font-weight:700;color:rgba(0,0,0,.38);transition:background .15s,color .15s,border-color .15s;'
      +'letter-spacing:.04em;line-height:1;white-space:nowrap;';
    b.addEventListener('mouseenter',()=>{b.style.background='rgba(0,0,0,.05)';b.style.color='rgba(0,0,0,.65)';b.style.borderColor='rgba(0,0,0,.22)';});
    b.addEventListener('mouseleave',()=>{b.style.background='';b.style.color='rgba(0,0,0,.38)';b.style.borderColor='rgba(0,0,0,.14)';});
    b.addEventListener('click',onClick);
    return b;
  }

  const btnMinus=mkScaleBtn('A−','Decrease text size',()=>{
    if(steps<=-FS_DOWN)return;steps--;apply();
  });
  btnMinus.style.borderRadius='5px 0 0 5px';

  const btnPlus=mkScaleBtn('A+','Increase text size',()=>{
    if(steps>=FS_UP)return;steps++;apply();
  });
  btnPlus.style.borderRadius='0 5px 5px 0';
  btnPlus.style.borderLeft='none';

  function apply(){
    const val=(baseRem+steps*FS_STEP).toFixed(3)+'rem';
    root.style.setProperty('--fs-bump',val);
    btnMinus.style.opacity=steps<=-FS_DOWN?'0.3':'1';
    btnPlus.style.opacity=steps>=FS_UP?'0.3':'1';
  }
  apply();

  wrap.appendChild(btnMinus);wrap.appendChild(btnPlus);
  bottomBar.style.position='relative';
  bottomBar.appendChild(wrap);
})();

// ── MOBILE OVERLAY BUTTON ──
function applyOverlayMode(){
  const portrait=isPortrait();
  document.body.classList.toggle('overlay-panel',portrait);
  let btn=document.getElementById('mobile-panel-btn');
  if(portrait&&!btn){
    btn=document.createElement('button');
    btn.id='mobile-panel-btn';
    btn.setAttribute('aria-label','Toggle sidebar');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`;
    btn.addEventListener('click',()=>{
      const isOpen=clusterPanel.classList.contains('open');
      if(isOpen){
        clusterPanel.classList.remove('open');
        syncPanelBtn();
      } else {
        clusterPanel.classList.add('open');
        syncPanelBtn();
        if(activeSeedCells.size>0){
          runCluster();
        } else if(panelMode==='duplicates'){
          runDuplicates();
        } else if(panelMode==='keywords'){
          runKeywords();
        } else {
          showPanelEmpty();
        }
        requestAnimationFrame(()=>{
          window._updatePillIndicator&&window._updatePillIndicator(panelMode,false);
          window._setHlPill&&window._setHlPill(hlOn,false);
          window._setViewPill&&window._setViewPill(mindmapOn,false);
        });
      }
    });
    document.body.appendChild(btn);
  }
  if(!portrait&&btn)btn.style.display='none';
  if(portrait&&btn)btn.style.display='';
}
window.addEventListener('resize',applyOverlayMode);
applyOverlayMode();