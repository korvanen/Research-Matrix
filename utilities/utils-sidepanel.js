// ════════════════════════════════════════════════════════════════
// utils-panel.js — reusable draggable/resizable side panel
//
// Usage:
//   const panel = createSidePanel(hostEl, options);
//   panel.open();
//   panel.close();
//   panel.toggle();
//   panel.setContent(domElement);
//   panel.el          → the panel root element
//   panel.bodyEl      → the content area element
//
// Options:
//   side               'right' | 'left'          default: 'right'
//   defaultFraction    fraction of host width     default: 0.60
//   minFraction        minimum width fraction     default: 0
//   maxFraction        maximum width fraction     default: 1
//   snapCloseFraction  snap-to-closed threshold   default: 0.15
//   overlapFraction    when panel starts floating default: 0.50
//   fullscreenFraction when panel fills host      default: 0.95
//   twoPosition        portrait mode (open/close  default: false
//                      only, no drag)
//   animDuration       animation ms               default: 320
//   onResize(w)        called every frame during  default: null
//                      drag or animation
//   onOpen()           called when fully open     default: null
//   onClose()          called when fully closed   default: null
// ════════════════════════════════════════════════════════════════

function createSidePanel(hostEl, options) {
  options = Object.assign({
    side:               'right',
    defaultFraction:    0.60,
    minFraction:        0,
    maxFraction:        1,
    snapCloseFraction:  0.15,
    overlapFraction:    0.50,
    fullscreenFraction: 0.95,
    twoPosition:        false,
    animDuration:       320,
    onResize:           null,
    onOpen:             null,
    onClose:            null,
  }, options || {});

  // ── Derived dimensions ──────────────────────────────────────────
  function hostW()        { return hostEl.getBoundingClientRect().width || window.innerWidth; }
  function defaultW()     { return Math.round(hostW() * options.defaultFraction); }
  function minW()         { return Math.round(hostW() * options.minFraction); }
  function maxW()         { return Math.round(hostW() * options.maxFraction); }
  function snapCloseW()   { return Math.round(hostW() * options.snapCloseFraction); }
  function overlapW()     { return Math.round(hostW() * options.overlapFraction); }
  function fullscreenW()  { return Math.round(hostW() * options.fullscreenFraction); }
  function handleW()      { return Math.max(16, Math.round(hostW() * 0.012)); }

  // ── Build DOM ───────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = 'ds-panel ds-panel--' + options.side;

  const handle = document.createElement('div');
  handle.className = 'ds-panel-handle';
  handle.innerHTML = `
    <div class="ds-panel-arrows">
      <button class="ds-panel-arrow ds-panel-arrow--open"  aria-label="Open panel">
        <svg viewBox="0 0 10 16" fill="none">
          <polyline points="${options.side === 'right' ? '7,2 2,8 7,14' : '3,2 8,8 3,14'}"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="ds-panel-arrow ds-panel-arrow--close" aria-label="Close panel">
        <svg viewBox="0 0 10 16" fill="none">
          <polyline points="${options.side === 'right' ? '3,2 8,8 3,14' : '7,2 2,8 7,14'}"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>`;

  // Fixed-position handle clone — shown when panel is too narrow
  // to contain its own handle
  const handleFixed = document.createElement('div');
  handleFixed.className = 'ds-panel-handle ds-panel-handle--fixed ds-panel--' + options.side;
  handleFixed.innerHTML = handle.innerHTML;

  const body = document.createElement('div');
  body.className = 'ds-panel-body';

  if (options.side === 'right') {
    panel.appendChild(handle);
    panel.appendChild(body);
  } else {
    panel.appendChild(body);
    panel.appendChild(handle);
  }

  hostEl.appendChild(panel);
  document.body.appendChild(handleFixed);

  // ── CSS variable helpers ─────────────────────────────────────────
  function setCSSVar(name, value) {
    hostEl.style.setProperty(name, value);
  }

  // ── Overlap state ────────────────────────────────────────────────
  function applyOverlapState(w) {
    const ol = overlapW(), fs = fullscreenW();
    if (w >= fs) {
      panel.classList.add('is-overlapping', 'is-fullscreen');
      setCSSVar('--panel-reserved', ol + 'px');
      setCSSVar('--panel-intrusion', '0px');
    } else if (w >= ol) {
      panel.classList.add('is-overlapping');
      panel.classList.remove('is-fullscreen');
      setCSSVar('--panel-reserved', ol + 'px');
      setCSSVar('--panel-intrusion', (w - ol) + 'px');
    } else {
      panel.classList.remove('is-overlapping', 'is-fullscreen');
      setCSSVar('--panel-reserved', w + 'px');
      setCSSVar('--panel-intrusion', '0px');
    }
  }

  // ── Arrow visibility ─────────────────────────────────────────────
  function updateArrows(w) {
    const isClosed     = w <= minW() + 4;
    const isFullscreen = w >= fullscreenW() - 4;
    [handle, handleFixed].forEach(h => {
      h.querySelector('.ds-panel-arrow--open')?.classList.toggle('visible', isClosed);
      h.querySelector('.ds-panel-arrow--close')?.classList.toggle('visible', isFullscreen);
    });
  }

  // ── Fixed handle positioning ─────────────────────────────────────
  function positionFixedHandle() {
    const rect = panel.getBoundingClientRect();
    const hw   = handleW();
    handleFixed.style.width  = hw + 'px';
    handleFixed.style.height = rect.height + 'px';
    handleFixed.style.top    = rect.top + 'px';
    if (options.side === 'right') {
      handleFixed.style.left  = rect.left + 'px';
      handleFixed.style.right = '';
    } else {
      handleFixed.style.right = (window.innerWidth - rect.right) + 'px';
      handleFixed.style.left  = '';
    }
    const useFixed = Math.round(rect.width) < hw + 2;
    handleFixed.classList.toggle('active', useFixed);
    handle.style.opacity = useFixed ? '0' : '1';
  }

  // ── Set width (instant) ──────────────────────────────────────────
  function setWidth(w) {
    panel.style.width = w + 'px';
    handle.style.width = handleW() + 'px';
    applyOverlapState(w);
    updateArrows(w);
    positionFixedHandle();
    if (options.onResize) options.onResize(w);
  }

  // ── Animation ────────────────────────────────────────────────────
  let _rafId = null;

  function animateTo(targetW, onDone) {
    if (_rafId) cancelAnimationFrame(_rafId);
    const startW    = parseFloat(panel.style.width) || panel.getBoundingClientRect().width;
    const distance  = targetW - startW;
    const duration  = options.animDuration;
    const startTime = performance.now();
    const ease      = t => 1 - Math.pow(1 - t, 3.5);

    updateArrows(targetW);

    if (options.twoPosition) {
      panel.classList.add('is-overlapping');
      setCSSVar('--panel-reserved', '0px');
      setCSSVar('--panel-intrusion', '0px');
      if (targetW >= fullscreenW()) panel.classList.add('is-fullscreen');
      else panel.classList.remove('is-fullscreen');
    }

    function tick(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const w = Math.round(startW + distance * ease(t));
      setWidth(w);
      if (t < 1) {
        _rafId = requestAnimationFrame(tick);
      } else {
        setWidth(targetW);
        if (options.twoPosition && targetW <= minW()) {
          panel.classList.remove('is-overlapping', 'is-fullscreen');
          setCSSVar('--panel-reserved', '0px');
        }
        if (onDone) onDone();
      }
    }
    _rafId = requestAnimationFrame(tick);
  }

  // ── Drag ─────────────────────────────────────────────────────────
  let _dragging = false, _startX = 0, _startW = 0;

  function onDragStart(e) {
    if (e.target.closest('.ds-panel-arrow')) return;
    if (options.twoPosition) return;
    _dragging = true;
    _startX   = e.clientX;
    _startW   = panel.offsetWidth;
    handle.classList.add('dragging');
    handleFixed.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!_dragging) return;
    const delta = options.side === 'right' ? _startX - e.clientX : e.clientX - _startX;
    const w     = Math.min(maxW(), Math.max(minW(), _startW + delta));
    setWidth(w);
  }

  function onDragEnd() {
    if (!_dragging) return;
    _dragging = false;
    handle.classList.remove('dragging');
    handleFixed.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    const w = panel.offsetWidth;
    if      (w >= fullscreenW()) animateTo(maxW(),     () => options.onOpen  && options.onOpen());
    else if (w <= snapCloseW())  animateTo(minW(),     () => options.onClose && options.onClose());
    else { updateArrows(w); positionFixedHandle(); }
  }

  [handle, handleFixed].forEach(h => h.addEventListener('mousedown', onDragStart));
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);

  // ── Arrow clicks ─────────────────────────────────────────────────
  function onArrowClick(e) {
    const btn = e.target.closest('.ds-panel-arrow');
    if (!btn) return;
    e.stopPropagation();
    if (btn.classList.contains('ds-panel-arrow--open')) {
      api.open();
    } else if (btn.classList.contains('ds-panel-arrow--close')) {
      api.close();
    }
  }
  handle.addEventListener('click', onArrowClick);
  handleFixed.addEventListener('click', onArrowClick);

  // ── Resize observer — reposition fixed handle on host resize ─────
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const w = panel.offsetWidth;
      if (options.twoPosition) {
        const isOpen = w >= fullscreenW() - 4;
        panel.style.width = isOpen ? maxW() + 'px' : minW() + 'px';
      } else {
        panel.style.width = Math.min(maxW(), Math.max(minW(), w)) + 'px';
      }
      setWidth(panel.offsetWidth);
    }).observe(hostEl);
  }

  // ── Public API ───────────────────────────────────────────────────
  const api = {
    el:     panel,
    bodyEl: body,

    open(fraction) {
      const w = fraction
        ? Math.round(hostW() * fraction)
        : (options.twoPosition ? maxW() : defaultW());
      animateTo(w, () => options.onOpen && options.onOpen());
    },

    close() {
      animateTo(minW(), () => options.onClose && options.onClose());
    },

    toggle() {
      const w = panel.offsetWidth;
      if (w <= minW() + 4) api.open();
      else api.close();
    },

    // Replace panel body content with a DOM element or HTML string
    setContent(content) {
      body.innerHTML = '';
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof Element) {
        body.appendChild(content);
      }
    },

    // Append to panel body without clearing existing content
    appendContent(content) {
      if (typeof content === 'string') {
        body.insertAdjacentHTML('beforeend', content);
      } else if (content instanceof Element) {
        body.appendChild(content);
      }
    },

    // Get current width in px
    getWidth() {
      return panel.offsetWidth;
    },

    // Manually set width (useful for restoring saved state)
    setWidth(w) {
      setWidth(Math.min(maxW(), Math.max(minW(), w)));
    },

    // Clean up all event listeners and remove elements from DOM
    destroy() {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup',   onDragEnd);
      if (_rafId) cancelAnimationFrame(_rafId);
      panel.remove();
      handleFixed.remove();
    },
  };

  // ── Initial state ─────────────────────────────────────────────────
  const initW = options.twoPosition ? minW() : defaultW();
  setWidth(initW);

  return api;
}
