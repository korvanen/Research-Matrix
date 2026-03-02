// ════════════════════════════════════════════════════════════════════════════
// panel.js — Sidebar shell
//
// Builds the tool navigation bar and delegates to per-tool init functions.
//
// LOAD ORDER (in index.html):
//   1. keyword-utils.js      — panelExtractKW, buildRowIndex, findMatches
//   2. panel-utils.js        — panelEscH, panelHighlight, panelThemeVars,
//                              buildPill, panelGoTo, attachGoTo,
//                              parseCitation, citationPillHtml
//   3. panel-find-matches.js — initFindMatchesTool()
//   4. panel-keywords.js     — initKeywordsTool()
//   5. panel.js              — this file
// ════════════════════════════════════════════════════════════════════════════
console.log('[panel.js v2]');

document.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    const box = document.getElementById('sidebar-box');
    if (!box) return;
    clearInterval(wait);
    initPanel(box);
  }, 50);
});

function initPanel(sidebarBox) {
  sidebarBox.style.pointerEvents = 'auto';
  sidebarBox.style.overflow      = 'hidden';
  sidebarBox.style.display       = 'flex';
  sidebarBox.style.flexDirection = 'column';

  // ── Build tool nav + pane scaffold ───────────────────────────────────────
  sidebarBox.innerHTML =
    '<div id="pp-tool-nav">' +
      '<button class="pp-tool-btn pp-tool-btn-active" data-tool="find-matches">Find Matches</button>' +
      '<button class="pp-tool-btn" data-tool="keywords">Keywords</button>' +
    '</div>' +
    '<div id="pp-tool-pane-find-matches" class="pp-tool-pane pp-tool-pane-active"></div>' +
    '<div id="pp-tool-pane-keywords"     class="pp-tool-pane"></div>';

  const sidebarEl = document.getElementById('sidebar');

  // ── Init each tool into its pane ─────────────────────────────────────────
  const findMatchesAPI = initFindMatchesTool(
    document.getElementById('pp-tool-pane-find-matches'),
    sidebarEl
  );
  const keywordsAPI = initKeywordsTool(
    document.getElementById('pp-tool-pane-keywords'),
    sidebarEl
  );

  // Map tool id → { reset } API returned by each tool's init
  const tools = {
    'find-matches': findMatchesAPI,
    'keywords':     keywordsAPI,
  };

  // ── Tool switching ────────────────────────────────────────────────────────
  let _activeTool = 'find-matches';

  document.getElementById('pp-tool-nav').addEventListener('click', e => {
    const btn = e.target.closest('.pp-tool-btn');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === _activeTool) return;

    // Deselect everything in the grid
    if (typeof clearSelection === 'function') clearSelection();

    // Reset the tool we're leaving
    tools[_activeTool]?.reset?.();

    _activeTool = tool;

    document.querySelectorAll('.pp-tool-btn').forEach(b =>
      b.classList.toggle('pp-tool-btn-active', b.dataset.tool === tool)
    );
    document.querySelectorAll('.pp-tool-pane').forEach(p =>
      p.classList.toggle('pp-tool-pane-active', p.id === 'pp-tool-pane-' + tool)
    );
  });
}
