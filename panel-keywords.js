// ════════════════════════════════════════════════════════════════════════════
// panel-keywords.js — "Keywords" sidebar tool
//
// Exported global: initKeywordsTool(paneEl, sidebarEl) → { reset }
//
// Depends on (loaded before this file):
//   keyword-utils.js  — panelExtractKW, (future: buildKeywordIndex, rankKeywords, etc.)
//   panel-utils.js    — panelEscH, panelThemeVars
//   script.js         — TABS, activeTab, processSheetData
// ════════════════════════════════════════════════════════════════════════════
console.log('[panel-keywords.js v1]');

function initKeywordsTool(paneEl, sidebarEl) {

  paneEl.innerHTML =
    '<div id="pp-kw-body">' +
      '<div class="pp-empty pp-kw-empty">Keywords tool coming soon</div>' +
    '</div>';

  // ── Styles ─────────────────────────────────────────────────────────────────
  if (!document.getElementById('pp-keywords-styles')) {
    const style = document.createElement('style');
    style.id = 'pp-keywords-styles';
    style.textContent = `
#pp-kw-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.pp-kw-empty {
  /* inherits .pp-empty from style.css */
}
`;
    document.head.appendChild(style);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function reset() {
    // Nothing to clear yet — expand this as the tool is built out
  }

  return { reset };
}
