(function () {
  'use strict';

  var PICKER_TOOLBAR_ID = 'print-picker-toolbar';
  var PICKER_STYLE_ID = 'print-picker-styles';
  var PRINT_STYLE_ID = 'print-helper-styles';
  var PRINT_ORDER_CONTAINER = 'print-order-container';
  var RELEASES_PAGE_URL = 'https://github.com/DreamerLS1994/htmlprint/releases';
  var printStylesInjected = false;

  var pickerActive = false;
  var hoveredBlock = null;
  var selectedElements = [];
  var suppressPickerEvents = false;
  var selectionHistory = [];
  var dragFromIndex = -1;
  var MAX_HISTORY = 30;

  // ========== 打印前准备 ==========
  function expandCollapsedContent() {
    var sels = ['button[class*="show-more"]', 'button[class*="showMore"]', 'button[class*="expand"]',
      'button[class*="read-more"]', 'button[class*="read-all"]', 'button[class*="unfold"]',
      'div[class*="show-more"]', 'div[class*="expand"]', 'span[class*="show-more"]', 'span[class*="expand"]'];
    for (var i = 0; i < sels.length; i++) {
      var els = document.querySelectorAll(sels[i]);
      for (var j = 0; j < els.length; j++) { try { els[j].click(); } catch (_) { } }
    }
    document.querySelectorAll('[style*="max-height"]').forEach(function (el) {
      el.style.removeProperty('max-height');
      el.style.setProperty('overflow', 'visible', 'important');
    });
    document.querySelectorAll('.collapsed, [class*="collapse"]').forEach(function (el) {
      el.classList.remove('collapsed');
      el.style.removeProperty('max-height');
      el.style.setProperty('overflow', 'visible', 'important');
    });
  }

  function loadLazyImages(root) {
    var lazyAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-echo'];
    var scope = root || document;
    var images;
    if (scope.tagName === 'IMG') images = [scope];
    else if (scope.querySelectorAll) images = Array.prototype.slice.call(scope.querySelectorAll('img'));
    else images = [];

    images.forEach(function (img) {
      var lazySrc = null;
      for (var j = 0; j < lazyAttrs.length; j++) {
        var src = img.getAttribute(lazyAttrs[j]);
        if (src) { lazySrc = src; break; }
      }
      if (lazySrc) img.src = lazySrc;
      var lazySrcset = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
      if (lazySrcset) img.setAttribute('srcset', lazySrcset);
      else if (lazySrc && img.getAttribute('srcset')) img.removeAttribute('srcset');
      if (img.getAttribute('loading') === 'lazy') img.removeAttribute('loading');
    });

    if (scope.querySelectorAll) {
      Array.prototype.forEach.call(scope.querySelectorAll('picture source'), function (source) {
        var lazySrcset = source.getAttribute('data-srcset') || source.getAttribute('data-lazy-srcset');
        if (lazySrcset) source.setAttribute('srcset', lazySrcset);
      });
    }
  }

  // ========== 打印样式注入 ==========
  function injectPrintStyles() {
    if (printStylesInjected) return;
    if (document.getElementById(PRINT_STYLE_ID)) { printStylesInjected = true; return; }
    var style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = [
      '@media print {',
      '  html, body { margin:0!important; padding:0!important; background:white!important; color:black!important; line-height:1.6!important; overflow:visible!important; width:auto!important; height:auto!important; }',
      '  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }',
      '  [data-print-wrap] { display:block!important; margin:0!important; padding:0!important; border:none!important; background:none!important; box-shadow:none!important; overflow:visible!important; width:auto!important; height:auto!important; max-width:100%!important; position:static!important; float:none!important; transform:none!important; }',
      '  #' + PICKER_TOOLBAR_ID + ' { display:none!important; }',
      '  .print-picker-badge { display:none!important; }',
      '  .print-picker-hover, .print-picker-selected { outline:none!important; }',
      '  .print-page-break { page-break-after:always!important; }',
      '  #' + PRINT_ORDER_CONTAINER + ' > :last-child { page-break-after:auto!important; }',
      '  img { max-width:100%!important; max-height:22cm!important; object-fit:contain!important; page-break-inside:avoid!important; }',
      '  h1,h2,h3,h4,h5,h6 { page-break-after:avoid!important; page-break-inside:avoid!important; }',
      '  p,li,blockquote { orphans:3!important; widows:3!important; }',
      '  pre { white-space:pre-wrap!important; word-wrap:break-word!important; overflow:visible!important; page-break-inside:avoid!important; }',
      '  tr { page-break-inside:avoid!important; }',
      '  thead { display:table-header-group!important; }',
      '  @page { margin:2cm; size:auto; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
    printStylesInjected = true;
  }

  // ========== 祖先包装器（保持CSS选择器匹配） ==========
  function createAncestorWrapper(el) {
    var ancestors = [];
    var cur = el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      ancestors.unshift(cur);
      cur = cur.parentElement;
    }

    var root = document.createDocumentFragment();
    var current = root;

    ancestors.forEach(function (anc) {
      var wrapper = document.createElement(anc.tagName.toLowerCase());
      wrapper.className = anc.className;
      if (anc.id) wrapper.id = anc.id;
      wrapper.setAttribute('data-print-wrap', '');
      for (var i = 0; i < anc.attributes.length; i++) {
        var attr = anc.attributes[i];
        if (attr.name !== 'class' && attr.name !== 'id' && attr.name !== 'style') {
          if (attr.name.startsWith('data-') || attr.name.startsWith('role') || attr.name.startsWith('aria-')) {
            wrapper.setAttribute(attr.name, attr.value);
          }
        }
      }
      current.appendChild(wrapper);
      current = wrapper;
    });

    var clone = el.cloneNode(true);
    clone.classList.remove('print-picker-selected');
    clone.classList.remove('print-picker-hover');
    var badges = clone.querySelectorAll('.print-picker-badge');
    for (var k = 0; k < badges.length; k++) badges[k].remove();

    clone = copyCanvasContent(el, clone);
    syncFormValues(el, clone);

    current.appendChild(clone);
    return root;
  }

  function copyCanvasContent(sourceRoot, cloneRoot) {
    if (sourceRoot.tagName === 'CANVAS' && cloneRoot.tagName === 'CANVAS') {
      var rootImage = canvasToImage(sourceRoot);
      return rootImage || cloneRoot;
    }

    var originals = sourceRoot.querySelectorAll('canvas');
    var clones = cloneRoot.querySelectorAll('canvas');
    var count = Math.min(originals.length, clones.length);
    for (var i = 0; i < count; i++) {
      var img = canvasToImage(originals[i]);
      if (img && clones[i].parentNode) clones[i].parentNode.replaceChild(img, clones[i]);
    }
    return cloneRoot;
  }

  function canvasToImage(canvas) {
    if (!canvas.width || !canvas.height) return null;
    var dataUrl;
    try { dataUrl = canvas.toDataURL('image/png'); } catch (_) { return null; }

    var img = document.createElement('img');
    img.src = dataUrl;
    if (typeof canvas.className === 'string') img.className = canvas.className;
    if (canvas.id) img.id = canvas.id;
    img.style.cssText = canvas.style.cssText;
    if (canvas.clientWidth) img.style.width = canvas.clientWidth + 'px';
    if (canvas.clientHeight) img.style.height = canvas.clientHeight + 'px';
    img.setAttribute('data-print-canvas', '');
    return img;
  }

  function syncFormValues(sourceRoot, cloneRoot) {
    var selector = 'input, textarea, select';
    var originals = collectFormElements(sourceRoot, selector);
    var clones = collectFormElements(cloneRoot, selector);
    var count = Math.min(originals.length, clones.length);

    for (var i = 0; i < count; i++) {
      var src = originals[i];
      var dst = clones[i];
      if (src.tagName === 'INPUT') {
        if (src.type === 'checkbox' || src.type === 'radio') {
          dst.checked = src.checked;
        } else if (src.type !== 'file') {
          dst.value = src.value;
          dst.setAttribute('value', src.value);
        }
      } else if (src.tagName === 'TEXTAREA') {
        dst.textContent = src.value;
        dst.value = src.value;
      } else if (src.tagName === 'SELECT') {
        for (var j = 0; j < src.options.length && j < dst.options.length; j++) {
          dst.options[j].selected = src.options[j].selected;
        }
      }
    }
  }

  function collectFormElements(root, selector) {
    var list = [];
    if (root.nodeType === 1 && root.matches && root.matches(selector)) list.push(root);
    if (root.querySelectorAll) {
      var found = root.querySelectorAll(selector);
      for (var i = 0; i < found.length; i++) list.push(found[i]);
    }
    return list;
  }

  // ========== 打印核心 ==========
  function printSelectedElements() {
    selectedElements = selectedElements.filter(function (el) {
      return document.documentElement.contains(el);
    });
    if (selectedElements.length === 0) return;

    suppressPickerEvents = true;
    expandCollapsedContent();
    selectedElements.forEach(function (el) { loadLazyImages(el); });
    suppressPickerEvents = false;

    var container = document.createElement('div');
    container.id = PRINT_ORDER_CONTAINER;

    selectedElements.forEach(function (sel, idx) {
      var wrapper = createAncestorWrapper(sel);
      container.appendChild(wrapper);
      if (idx < selectedElements.length - 1) {
        var pb = document.createElement('div');
        pb.className = 'print-page-break';
        container.appendChild(pb);
      }
    });
    document.body.appendChild(container);

    var hiddenEls = [];
    var children = document.body.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.id === PRINT_ORDER_CONTAINER) continue;
      hiddenEls.push({ el: child, cssText: child.style.cssText });
      child.style.setProperty('display', 'none', 'important');
    }

    var styleBackups = [];
    styleBackups.push({ el: document.body, cssText: document.body.style.cssText });
    document.body.style.setProperty('margin', '0', 'important');
    document.body.style.setProperty('padding', '0', 'important');
    document.body.style.setProperty('overflow', 'visible', 'important');
    document.body.style.setProperty('width', 'auto', 'important');
    document.body.style.setProperty('height', 'auto', 'important');

    injectPrintStyles();
    window.print();

    var done = function () {
      styleBackups.forEach(function (b) { b.el.style.cssText = b.cssText; });
      hiddenEls.forEach(function (item) { item.el.style.cssText = item.cssText; });
      container.remove();
      var ps = document.getElementById(PRINT_STYLE_ID);
      if (ps) ps.remove();
      printStylesInjected = false;
      window.removeEventListener('afterprint', done);
      clearTimeout(ft);
    };
    window.addEventListener('afterprint', done);
    var ft = setTimeout(done, 5000);
  }

  // ================================================================
  // ========== 选择打印模式 ==========
  // ================================================================

  function findPrintableBlock(el) {
    if (isPickerUI(el)) return null;
    var skipTags = ['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'U', 'SMALL', 'SUB', 'SUP', 'LABEL', 'SVG', 'PATH', 'BR', 'WBR'];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName;
      if (tag === 'ARTICLE' || tag === 'MAIN') return current;
      if (tag === 'SECTION' || tag === 'ASIDE' || tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER') return current;
      if (tag === 'DIV') {
        var textLen = current.textContent.trim().length;
        var childCount = current.children.length;
        if (textLen > 30 && childCount > 0) return current;
      }
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TABLE', 'FIGURE', 'FORM', 'UL', 'OL', 'DL'].indexOf(tag) !== -1) {
        return current;
      }
      if (skipTags.indexOf(tag) !== -1) { current = current.parentElement; continue; }
      current = current.parentElement;
    }
    if (el.tagName === 'DIV') return el;
    return el.parentElement && el.parentElement !== document.body ? el.parentElement : el;
  }

  function isPickerUI(el) {
    var current = el;
    while (current) {
      if (current.id === PICKER_TOOLBAR_ID || current.id === PICKER_STYLE_ID) return true;
      current = current.parentElement;
    }
    return false;
  }

  function injectPickerStyles() {
    if (document.getElementById(PICKER_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = PICKER_STYLE_ID;
    style.textContent = [
      '.print-picker-hover { outline:3px dashed #4285f4!important; outline-offset:2px!important; cursor:crosshair!important; transition:outline 0.15s!important; }',
      '.print-picker-selected { outline:3px solid #34a853!important; outline-offset:2px!important; position:relative!important; }',
      '.print-picker-badge { position:absolute!important; top:-10px!important; right:-10px!important; background:#34a853!important; color:#fff!important; border-radius:50%!important; width:22px!important; height:22px!important; line-height:22px!important; text-align:center!important; font-size:12px!important; font-weight:bold!important; z-index:2147483646!important; pointer-events:none!important; font-family:-apple-system,sans-serif!important; }',
      '@media print { .print-picker-hover, .print-picker-selected { outline:none!important; } .print-picker-badge { display:none!important; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function removePickerStyles() {
    var s = document.getElementById(PICKER_STYLE_ID);
    if (s) s.remove();
  }

  function addBadge(el) {
    if (el.querySelector('.print-picker-badge')) return;
    var badge = document.createElement('span');
    badge.className = 'print-picker-badge';
    el.appendChild(badge);
  }

  function removeBadge(el) {
    var badge = el.querySelector('.print-picker-badge');
    if (badge) badge.remove();
  }

  function refreshBadges() {
    selectedElements.forEach(function (el, idx) {
      var badge = el.querySelector('.print-picker-badge');
      if (badge) badge.textContent = idx + 1;
    });
  }

  function createToolbar() {
    var host = document.createElement('div');
    host.id = PICKER_TOOLBAR_ID;
    host.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;';
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = [
      '<style>',
      '  :host { all:initial; }',
      '  .bar { display:flex; align-items:center; gap:8px; padding:8px 16px; background:rgba(30,30,30,0.92); backdrop-filter:blur(8px); border-radius:10px; box-shadow:0 4px 24px rgba(0,0,0,0.3); color:#fff; font-size:13px; white-space:nowrap; user-select:none; }',
      '  .counter { color:#9ca3af; font-size:12px; min-width:80px; cursor:pointer; }',
      '  .counter:hover { color:#d1d5db; }',
      '  .counter b { color:#34a853; font-size:14px; }',
      '  .sep { width:1px; height:20px; background:rgba(255,255,255,0.15); }',
      '  .btn { padding:5px 14px; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:500; transition:background 0.15s,transform 0.1s; }',
      '  .btn:active { transform:scale(0.96); }',
      '  .btn-print { background:#34a853; color:#fff; } .btn-print:hover { background:#2d9249; }',
      '  .btn-clear { background:rgba(255,255,255,0.12); color:#ccc; } .btn-clear:hover { background:rgba(255,255,255,0.2); }',
      '  .btn-help { background:rgba(255,255,255,0.08); color:#999; } .btn-help:hover { background:rgba(255,255,255,0.15); color:#fff; }',
      '  .btn-update { background:rgba(255,255,255,0.08); color:#999; } .btn-update:hover { background:rgba(255,255,255,0.15); color:#fff; }',
      '  .btn-exit { background:rgba(255,255,255,0.08); color:#999; } .btn-exit:hover { background:rgba(255,255,255,0.15); color:#fff; }',
      '  .tip { color:#666; font-size:11px; }',
      '  .panel { display:none; width:340px; margin:8px auto 0; padding:6px; background:rgba(30,30,30,0.92); backdrop-filter:blur(8px); border-radius:10px; box-shadow:0 4px 24px rgba(0,0,0,0.3); max-height:260px; overflow:auto; }',
      '  .panel.open { display:block; }',
      '  .panel-hint { padding:4px 8px 6px; color:#777; font-size:11px; }',
      '  .list-empty { padding:8px; color:#777; font-size:12px; }',
      '  .item { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; color:#ddd; font-size:12px; cursor:grab; }',
      '  .item:hover { background:rgba(255,255,255,0.08); }',
      '  .item.dragging { opacity:0.4; }',
      '  .item .idx { flex:0 0 18px; height:18px; border-radius:50%; background:#34a853; color:#fff; font-size:11px; line-height:18px; text-align:center; }',
      '  .item .name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '  .item .del { flex:0 0 auto; border:none; background:transparent; color:#888; cursor:pointer; font-size:14px; line-height:1; padding:2px 4px; }',
      '  .item .del:hover { color:#ff6b6b; }',
      '</style>',
      '<div class="bar">',
      '  <span class="tip">\u70B9\u51FB\u9009\u62E9 \u00B7 Alt \u6269\u5927 \u00B7 Shift \u7CBE\u786E</span>',
      '  <div class="sep"></div>',
      '  <span class="counter" id="pp-counter" title="\u67E5\u770B\u548C\u8C03\u6574\u5DF2\u9009\u533A\u57DF">\u5DF2\u9009 <b id="cnt">0</b> \u4E2A</span>',
      '  <div class="sep"></div>',
      '  <button class="btn btn-print" id="pp-print">\u6253\u5370</button>',
      '  <button class="btn btn-clear" id="pp-clear">\u6E05\u9664</button>',
      '  <button class="btn btn-help" id="pp-help">\u5E2E\u52A9</button>',
      '  <button class="btn btn-update" id="pp-update">\u68C0\u67E5\u66F4\u65B0</button>',
      '  <button class="btn btn-exit" id="pp-exit">\u9000\u51FA</button>',
      '</div>',
      '<div class="panel" id="pp-panel">',
      '  <div class="panel-hint">\u62D6\u62FD\u8C03\u6574\u6253\u5370\u987A\u5E8F\uFF0C\u70B9\u51FB \u00D7 \u79FB\u9664</div>',
      '  <div id="pp-list"></div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(host);

    shadow.getElementById('pp-print').addEventListener('click', function (e) { e.stopPropagation(); printSelectedElements(); });
    shadow.getElementById('pp-clear').addEventListener('click', function (e) { e.stopPropagation(); clearSelections(); });
    shadow.getElementById('pp-help').addEventListener('click', function (e) { e.stopPropagation(); window.open('https://github.com/DreamerLS1994/htmlprint/blob/master/docs/USAGE.md', '_blank'); });
    shadow.getElementById('pp-update').addEventListener('click', function (e) { e.stopPropagation(); checkUpdate(); });
    shadow.getElementById('pp-exit').addEventListener('click', function (e) { e.stopPropagation(); exitPickerMode(); });
    shadow.getElementById('pp-counter').addEventListener('click', function (e) { e.stopPropagation(); toggleSelectionPanel(); });

    var list = shadow.getElementById('pp-list');
    list.addEventListener('click', onListClick);
    list.addEventListener('dragstart', onListDragStart);
    list.addEventListener('dragend', onListDragEnd);
    list.addEventListener('dragover', onListDragOver);
    list.addEventListener('drop', onListDrop);

    renderSelectionList();
  }

  function toggleSelectionPanel() {
    var host = document.getElementById(PICKER_TOOLBAR_ID);
    if (!host || !host.shadowRoot) return;
    var panel = host.shadowRoot.getElementById('pp-panel');
    if (panel) panel.classList.toggle('open');
  }

  function getElementLabel(el) {
    var heading = el.querySelector ? el.querySelector('h1,h2,h3,h4,h5,h6') : null;
    var text = (heading && heading.textContent) || el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '';
    text = String(text).replace(/\s+/g, ' ').trim();
    if (!text) {
      var img = el.querySelector ? el.querySelector('img[alt]') : null;
      if (img) text = String(img.getAttribute('alt') || '').trim();
    }
    if (!text) return el.tagName.toLowerCase();
    return text.length > 32 ? text.slice(0, 32) + '\u2026' : text;
  }

  function renderSelectionList() {
    var host = document.getElementById(PICKER_TOOLBAR_ID);
    if (!host || !host.shadowRoot) return;
    var list = host.shadowRoot.getElementById('pp-list');
    if (!list) return;

    list.textContent = '';
    if (selectedElements.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.textContent = '\u8FD8\u6CA1\u6709\u9009\u62E9\u533A\u57DF';
      list.appendChild(empty);
      return;
    }

    selectedElements.forEach(function (el, idx) {
      var item = document.createElement('div');
      item.className = 'item';
      item.draggable = true;
      item.setAttribute('data-index', String(idx));

      var idxNode = document.createElement('span');
      idxNode.className = 'idx';
      idxNode.textContent = String(idx + 1);

      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = getElementLabel(el);

      var del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.title = '\u79FB\u9664\u6B64\u533A\u57DF';
      del.textContent = '\u00D7';

      item.appendChild(idxNode);
      item.appendChild(name);
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function findListItem(target) {
    return target && target.closest ? target.closest('.item') : null;
  }

  function onListClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('.del') : null;
    if (!btn) return;
    e.stopPropagation();
    var item = findListItem(btn);
    if (!item) return;
    removeSelectionAt(parseInt(item.getAttribute('data-index'), 10));
  }

  function onListDragStart(e) {
    var item = findListItem(e.target);
    if (!item) return;
    dragFromIndex = parseInt(item.getAttribute('data-index'), 10);
    item.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragFromIndex)); } catch (_) { }
    }
  }

  function onListDragEnd() {
    var host = document.getElementById(PICKER_TOOLBAR_ID);
    if (host && host.shadowRoot) {
      var dragging = host.shadowRoot.querySelectorAll('.item.dragging');
      for (var i = 0; i < dragging.length; i++) dragging[i].classList.remove('dragging');
    }
    dragFromIndex = -1;
  }

  function onListDragOver(e) {
    if (findListItem(e.target)) e.preventDefault();
  }

  function onListDrop(e) {
    e.preventDefault();
    var item = findListItem(e.target);
    if (!item) return;
    var to = parseInt(item.getAttribute('data-index'), 10);
    moveSelection(dragFromIndex, to);
    dragFromIndex = -1;
  }

  function snapshotSelection() {
    selectionHistory.push(selectedElements.slice());
    if (selectionHistory.length > MAX_HISTORY) selectionHistory.shift();
  }

  function decorateSelection(el) {
    if (!el || !document.documentElement.contains(el)) return;
    el.classList.add('print-picker-selected');
    addBadge(el);
  }

  function clearSelectionMarks() {
    selectedElements.forEach(function (el) {
      el.classList.remove('print-picker-selected');
      el.classList.remove('print-picker-hover');
      removeBadge(el);
    });
  }

  function addSelection(block) {
    snapshotSelection();
    var related = selectedElements.filter(function (el) {
      return el === block || el.contains(block) || block.contains(el);
    });
    related.forEach(function (el) {
      el.classList.remove('print-picker-selected');
      removeBadge(el);
    });
    selectedElements = selectedElements.filter(function (el) {
      return related.indexOf(el) === -1;
    });
    selectedElements.push(block);
    block.classList.remove('print-picker-hover');
    block.classList.add('print-picker-selected');
    addBadge(block);
    refreshBadges();
    updateCounter();
    renderSelectionList();
  }

  function removeSelection(block) {
    var idx = selectedElements.indexOf(block);
    if (idx === -1) return;
    snapshotSelection();
    selectedElements.splice(idx, 1);
    block.classList.remove('print-picker-selected');
    block.classList.remove('print-picker-hover');
    removeBadge(block);
    refreshBadges();
    updateCounter();
    renderSelectionList();
  }

  function removeSelectionAt(idx) {
    var el = selectedElements[idx];
    if (!el) return;
    removeSelection(el);
  }

  function moveSelection(from, to) {
    if (from === to || from < 0 || to < 0) return;
    if (from >= selectedElements.length || to >= selectedElements.length) return;
    snapshotSelection();
    var moved = selectedElements.splice(from, 1)[0];
    selectedElements.splice(to, 0, moved);
    refreshBadges();
    renderSelectionList();
  }

  function undoSelection() {
    if (selectionHistory.length === 0) return;
    var previous = selectionHistory.pop();
    clearSelectionMarks();
    selectedElements = previous.filter(function (el) {
      return el && document.documentElement.contains(el);
    });
    selectedElements.forEach(decorateSelection);
    refreshBadges();
    updateCounter();
    renderSelectionList();
    hoveredBlock = null;
  }

  function checkUpdate() {
    var host = document.getElementById(PICKER_TOOLBAR_ID);
    if (!host || !host.shadowRoot) return;
    var btn = host.shadowRoot.getElementById('pp-update');
    if (!btn) return;
    var oldText = btn.textContent;
    btn.textContent = '检查中...';
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: 'CHECK_UPDATE' }, function (resp) {
      btn.textContent = oldText;
      btn.disabled = false;
      if (!resp) { alert('检查更新失败：扩展未响应'); return; }
      if (resp.code === 'NO_RELEASE') {
        if (confirm('当前还没有发布版本。\n\n是否打开 GitHub Releases 页面查看？')) {
          window.open(RELEASES_PAGE_URL, '_blank');
        }
        return;
      }
      if (resp.hasUpdate) {
        if (confirm('发现新版本！\n\n当前版本：' + resp.current + '\n最新版本：' + resp.latest + '\n\n点击确定打开下载页面。')) {
          window.open(resp.url, '_blank');
        }
        return;
      }
      if (resp.isAhead) {
        alert('当前版本（' + resp.current + '）高于线上最新发布（' + resp.latest + '），可能正在使用开发版本。');
        return;
      }
      if (resp.code === 'RATE_LIMITED' || resp.code === 'FORBIDDEN') {
        if (confirm(describeUpdateError(resp.code, resp) + '\n\n是否打开 GitHub Releases 页面手动下载？')) {
          window.open(RELEASES_PAGE_URL, '_blank');
        }
        return;
      }
      if (resp.code) {
        alert('检查更新失败：' + describeUpdateError(resp.code, resp));
        return;
      }
      alert('当前已是最新版本（' + resp.current + '）');
    });
  }

  function describeUpdateError(code, resp) {
    if (code === 'RATE_LIMITED') {
      var resetTime = formatResetTime(resp && resp.resetAt);
      return 'GitHub 接口请求次数已用完' + (resetTime ? '，预计 ' + resetTime + ' 后恢复' : '，请稍后再试');
    }
    if (code === 'FORBIDDEN') return 'GitHub 拒绝了请求，可能由网络代理或访问限制导致';
    if (code && code.indexOf('HTTP_ERROR_') === 0) return 'GitHub 接口请求失败';
    if (code === 'INVALID_RELEASE') return '发布信息格式异常';
    return '网络错误，请检查网络后重试';
  }

  function formatResetTime(timestamp) {
    if (!timestamp || timestamp <= Date.now()) return '';
    var date = new Date(timestamp);
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
  }

  function removeToolbar() {
    var t = document.getElementById(PICKER_TOOLBAR_ID);
    if (t) t.remove();
  }

  function updateCounter() {
    var host = document.getElementById(PICKER_TOOLBAR_ID);
    if (!host) return;
    var cnt = host.shadowRoot.getElementById('cnt');
    if (cnt) cnt.textContent = selectedElements.length;
  }

  function resolveBlock(target, event) {
    if (event && event.altKey) {
      var base = findSelectedAncestor(target) || findPrintableBlock(target);
      return base ? expandBlockUp(base) : null;
    }
    if (event && event.shiftKey) {
      if (!target || target === document.body || target === document.documentElement) return findPrintableBlock(target);
      if (target.tagName === 'SVG' || target.tagName === 'PATH' || target.tagName === 'USE') return findPrintableBlock(target);
      return target;
    }
    return findPrintableBlock(target);
  }

  function findSelectedAncestor(target) {
    var cur = target;
    while (cur && cur !== document.body) {
      if (selectedElements.indexOf(cur) !== -1) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function expandBlockUp(el) {
    var cur = el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (!isPickerUI(cur)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function onPickerHover(e) {
    if (!pickerActive || suppressPickerEvents) return;
    var target = e.target;
    if (isPickerUI(target)) return;
    var block = resolveBlock(target, e);
    if (!block || block === hoveredBlock) return;
    if (hoveredBlock && !hoveredBlock.classList.contains('print-picker-selected')) {
      hoveredBlock.classList.remove('print-picker-hover');
    }
    hoveredBlock = block;
    if (!block.classList.contains('print-picker-selected')) {
      block.classList.add('print-picker-hover');
    }
  }

  function onPickerHoverOut(e) {
    if (!pickerActive) return;
    if (hoveredBlock && !hoveredBlock.classList.contains('print-picker-selected')) {
      hoveredBlock.classList.remove('print-picker-hover');
    }
    hoveredBlock = null;
  }

  function onPickerClick(e) {
    if (!pickerActive || suppressPickerEvents) return;
    if (isPickerUI(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var block = resolveBlock(e.target, e);
    if (!block) return;

    if (selectedElements.indexOf(block) !== -1) removeSelection(block);
    else addSelection(block);
  }

  function onPickerKeydown(e) {
    if (!pickerActive) return;
    if (e.key === 'Escape') { e.preventDefault(); exitPickerMode(); return; }
    if (isEditableTarget(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      undoSelection();
      return;
    }
    if (e.key === 'Enter' && selectedElements.length > 0) { e.preventDefault(); printSelectedElements(); }
  }

  function isEditableTarget(target) {
    if (!target) return false;
    var tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable === true;
  }

  function clearSelections() {
    if (selectedElements.length === 0) return;
    snapshotSelection();
    clearSelectionMarks();
    selectedElements = [];
    updateCounter();
    renderSelectionList();
  }

  function enterPickerMode() {
    if (pickerActive) return;
    pickerActive = true;
    selectedElements = [];
    selectionHistory = [];
    hoveredBlock = null;
    dragFromIndex = -1;
    injectPickerStyles();
    createToolbar();
    document.addEventListener('mouseover', onPickerHover, true);
    document.addEventListener('mouseout', onPickerHoverOut, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeydown, true);
    document.body.style.cursor = 'crosshair';
  }

  function exitPickerMode() {
    if (!pickerActive) return;
    pickerActive = false;
    clearSelections();
    removeToolbar();
    removePickerStyles();
    document.removeEventListener('mouseover', onPickerHover, true);
    document.removeEventListener('mouseout', onPickerHoverOut, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeydown, true);
    document.body.style.cursor = '';
    hoveredBlock = null;
    selectionHistory = [];
    dragFromIndex = -1;
  }


  // ========== 消息监听 ==========
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'PICK_PRINT') {
      enterPickerMode();
      sendResponse({ success: true });
      return false;
    }
    if (message.type === 'EXIT_PICKER') {
      exitPickerMode();
      sendResponse({ success: true });
      return false;
    }
  });

})();
