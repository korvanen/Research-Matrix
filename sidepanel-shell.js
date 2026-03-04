// sidepanel-shell.js — Sidebar shell v7
//
// v7: clusters and concept-map tools removed from sidebar.
//     Their tabs are replaced with "Open" buttons that navigate
//     to clusters.html / concept-map.html in the same tab.
// ════════════════════════════════════════════════════════════════════════════
console.log('[sidepanel-shell.js vMOARE]');

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
      '<button class="pp-tool-btn pp-tool-nav-external" data-href="concept-map.html">Concept Map ↗</button>' +
      '<button class="pp-tool-btn pp-tool-nav-external" data-href="clusters.html">Clusters ↗</button>' +
    '</div>' +
    '<div id="pp-tool-pane-find-matches" class="pp-tool-pane pp-tool-pane-active"></div>';

  const sidebarEl = document.getElementById('sidebar');

  const findMatchesAPI = initFindMatchesTool(
    document.getElementById('pp-tool-pane-find-matches'), sidebarEl
  );

  const tools = {
    'find-matches': findMatchesAPI,
  };

  let _activeTool = 'find-matches';

  document.getElementById('pp-tool-nav').addEventListener('click', e => {
    const btn = e.target.closest('.pp-tool-btn');
    if (!btn) return;

    // External navigation buttons — go to the tool page in the same tab
    if (btn.classList.contains('pp-tool-nav-external')) {
      window.location.href = btn.dataset.href;
      return;
    }

    const tool = btn.dataset.tool;
    if (!tool || tool === _activeTool) return;

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
