(function () {
  'use strict';

  var PICKER_TOOLBAR_ID = 'print-picker-toolbar';
  var PICKER_STYLE_ID = 'print-picker-styles';

  var pickerActive = false;
  var hoveredBlock = null;
  var selectedElements = [];
  var suppressPickerEvents = false;

  // ========== 打印前准备 ==========
  function expandCollapsedContent() {
    var sels = ['[class*="show-more"]', '[class*="showMore"]', '[class*="expand"]',
      '[class*="read-more"]', '[class*="read-all"]', '[class*="full-article"]',
      'button[class*="more"]', 'a[class*="more"]', '[class*="unfold"]', '[class*="open"]'];
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

  function loadLazyImages() {
    var lazyAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-echo'];
    document.querySelectorAll('img').forEach(function (img) {
      for (var j = 0; j < lazyAttrs.length; j++) {
        var src = img.getAttribute(lazyAttrs[j]);
        if (src) { img.src = src; break; }
      }
      if (img.getAttribute('loading') === 'lazy') img.removeAttribute('loading');
    });
  }

  // ========== 样式表复制 ==========
  function copyStylesheets(targetDoc) {
    document.querySelectorAll('style').forEach(function (s) {
      if (s.id === PICKER_STYLE_ID) return;
      targetDoc.head.appendChild(s.cloneNode(true));
    });
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if (sheet.ownerNode && sheet.ownerNode.id === PICKER_STYLE_ID) continue;
      try {
        var rules = sheet.cssRules || sheet.rules;
        if (rules && rules.length > 0) {
          var css = '';
          for (var j = 0; j < rules.length; j++) {
            css += rules[j].cssText + '\n';
          }
          var style = targetDoc.createElement('style');
          style.textContent = css;
          targetDoc.head.appendChild(style);
        }
      } catch (e) {
        if (sheet.ownerNode && sheet.ownerNode.cloneNode) {
          targetDoc.head.appendChild(sheet.ownerNode.cloneNode(true));
        }
      }
    }
  }

  // ========== 祖先包装器（保持CSS选择器匹配） ==========
  function createAncestorWrapper(el, targetDoc) {
    var ancestors = [];
    var cur = el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      ancestors.unshift(cur);
      cur = cur.parentElement;
    }

    var root = targetDoc.createDocumentFragment();
    var current = root;

    ancestors.forEach(function (anc) {
      var wrapper = targetDoc.createElement(anc.tagName.toLowerCase());
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

    current.appendChild(clone);
    return root;
  }

  // ========== 打印核心 ==========
  function printSelectedElements() {
    if (selectedElements.length === 0) return;

    suppressPickerEvents = true;
    expandCollapsedContent();
    loadLazyImages();
    suppressPickerEvents = false;

    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:none;';
    document.body.appendChild(iframe);

    var doc = iframe.contentDocument;

    var baseEl = doc.createElement('base');
    baseEl.href = document.baseURI;
    doc.head.appendChild(baseEl);

    copyStylesheets(doc);

    var printStyle = doc.createElement('style');
    printStyle.textContent = [
      'body { margin:0; padding:0; background:white; color:black; line-height:1.6; }',
      '[data-print-wrap] { display:block!important; margin:0!important; padding:0!important; border:none!important; background:none!important; box-shadow:none!important; overflow:visible!important; width:auto!important; height:auto!important; max-width:100%!important; position:static!important; float:none!important; transform:none!important; }',
      '.print-page-break { page-break-after:always; }',
      '@media print {',
      '  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }',
      '  img { max-width:100%!important; max-height:22cm!important; object-fit:contain!important; page-break-inside:avoid!important; }',
      '  h1,h2,h3,h4,h5,h6 { page-break-after:avoid!important; page-break-inside:avoid!important; }',
      '  p,li,blockquote { orphans:3!important; widows:3!important; }',
      '  pre { white-space:pre-wrap!important; word-wrap:break-word!important; overflow:visible!important; page-break-inside:avoid!important; }',
      '  tr { page-break-inside:avoid!important; }',
      '  thead { display:table-header-group!important; }',
      '  @page { margin:2cm; size:auto; }',
      '}'
    ].join('\n');
    doc.head.appendChild(printStyle);

    selectedElements.forEach(function (sel, idx) {
      var wrapper = createAncestorWrapper(sel, doc);
      doc.body.appendChild(wrapper);
      if (idx < selectedElements.length - 1) {
        var pb = doc.createElement('div');
        pb.className = 'print-page-break';
        doc.body.appendChild(pb);
      }
    });

    var cleaned = false;
    var cleanup = function () {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };

    iframe.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 10000);

    setTimeout(function () {
      iframe.contentWindow.print();
    }, 200);
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
      '  .counter { color:#9ca3af; font-size:12px; min-width:80px; }',
      '  .counter b { color:#34a853; font-size:14px; }',
      '  .sep { width:1px; height:20px; background:rgba(255,255,255,0.15); }',
      '  .btn { padding:5px 14px; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:500; transition:background 0.15s,transform 0.1s; }',
      '  .btn:active { transform:scale(0.96); }',
      '  .btn-print { background:#34a853; color:#fff; } .btn-print:hover { background:#2d9249; }',
      '  .btn-clear { background:rgba(255,255,255,0.12); color:#ccc; } .btn-clear:hover { background:rgba(255,255,255,0.2); }',
      '  .btn-help { background:rgba(255,255,255,0.08); color:#999; } .btn-help:hover { background:rgba(255,255,255,0.15); color:#fff; }',
      '  .btn-exit { background:rgba(255,255,255,0.08); color:#999; } .btn-exit:hover { background:rgba(255,255,255,0.15); color:#fff; }',
      '  .tip { color:#666; font-size:11px; }',
      '</style>',
      '<div class="bar">',
      '  <span class="tip">\u70B9\u51FB\u9009\u62E9\u6253\u5370\u533A\u57DF</span>',
      '  <div class="sep"></div>',
      '  <span class="counter">\u5DF2\u9009 <b id="cnt">0</b> \u4E2A</span>',
      '  <div class="sep"></div>',
      '  <button class="btn btn-print" id="pp-print">\u6253\u5370</button>',
      '  <button class="btn btn-clear" id="pp-clear">\u6E05\u9664</button>',
      '  <button class="btn btn-help" id="pp-help">\u5E2E\u52A9</button>',
      '  <button class="btn btn-exit" id="pp-exit">\u9000\u51FA</button>',
      '</div>'
    ].join('\n');
    document.body.appendChild(host);

    shadow.getElementById('pp-print').addEventListener('click', function (e) { e.stopPropagation(); printSelectedElements(); });
    shadow.getElementById('pp-clear').addEventListener('click', function (e) { e.stopPropagation(); clearSelections(); });
    shadow.getElementById('pp-help').addEventListener('click', function (e) { e.stopPropagation(); window.open('https://jerrycoding.com/article/html-print/', '_blank'); });
    shadow.getElementById('pp-exit').addEventListener('click', function (e) { e.stopPropagation(); exitPickerMode(); });
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

  function onPickerHover(e) {
    if (!pickerActive || suppressPickerEvents) return;
    var target = e.target;
    if (isPickerUI(target)) return;
    var block = findPrintableBlock(target);
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

    var block = findPrintableBlock(e.target);
    if (!block) return;

    var idx = selectedElements.indexOf(block);
    if (idx !== -1) {
      selectedElements.splice(idx, 1);
      block.classList.remove('print-picker-selected');
      block.classList.remove('print-picker-hover');
      removeBadge(block);
      refreshBadges();
    } else {
      selectedElements.push(block);
      block.classList.remove('print-picker-hover');
      block.classList.add('print-picker-selected');
      addBadge(block);
      refreshBadges();
    }
    updateCounter();
  }

  function onPickerKeydown(e) {
    if (!pickerActive) return;
    if (e.key === 'Escape') { e.preventDefault(); exitPickerMode(); }
    if (e.key === 'Enter' && selectedElements.length > 0) { e.preventDefault(); printSelectedElements(); }
  }

  function clearSelections() {
    selectedElements.forEach(function (el) {
      el.classList.remove('print-picker-selected');
      el.classList.remove('print-picker-hover');
      removeBadge(el);
    });
    selectedElements = [];
    updateCounter();
  }

  function enterPickerMode() {
    if (pickerActive) return;
    pickerActive = true;
    selectedElements = [];
    hoveredBlock = null;
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
