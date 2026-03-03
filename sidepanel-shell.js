// ════════════════════════════════════════════════════════════════════════════
// sidepanel-shell.js — Sidebar shell
//
// LOAD ORDER (in index.html):
//   1. keyword-utils.js
//   2. sidepanel-utils.js
//   3. sidepanel-find-matches.js  — initFindMatchesTool()
//   4. sidepanel-clusters.js      — initClustersTool()
//   5. sidepanel-shell.js         — this file
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-shell.js v2]');

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

  sidebarBox.innerHTML =
    '<div id="pp-tool-nav">' +
      '<button class="pp-tool-btn pp-tool-btn-active" data-tool="find-matches">Find Matches</button>' +
      '<button class="pp-tool-btn" data-tool="clusters">Clusters</button>' +
    '</div>' +
    '<div id="pp-tool-pane-find-matches" class="pp-tool-pane pp-tool-pane-active"></div>' +
    '<div id="pp-tool-pane-clusters"     class="pp-tool-pane"></div>';

  const sidebarEl = document.getElementById('sidebar');

  const findMatchesAPI = initFindMatchesTool(
    document.getElementById('pp-tool-pane-find-matches'),
    sidebarEl
  );

  const clustersAPI = initClustersTool(
    document.getElementById('pp-tool-pane-clusters'),
    sidebarEl
  );

  const tools = {
    'find-matches': findMatchesAPI,
    'clusters':     clustersAPI,
  };

  let _activeTool = 'find-matches';

  document.getElementById('pp-tool-nav').addEventListener('click', e => {
    const btn = e.target.closest('.pp-tool-btn');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === _activeTool) return;

    if (typeof clearSelection === 'function') clearSelection();
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
