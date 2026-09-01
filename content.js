/**
 * Text Folder - Content Script
 * 网页文本与代码块折叠拓展 (v1.0.2 - 经典高精度持久化记忆与无损复原修复版)
 * 
 * 核心设计：
 * 1. 高精度字符坐标树对齐：彻底修复偏移量错位，精准复原百度百科与 AI 代码块多级递进折叠。
 * 2. 语法高亮色彩完全隔离：锁定胶囊按钮独立中性色彩规范，杜绝继承 hljs-string/token 导致按钮被染色。
 * 3. 宿主色彩全透传：正文折叠容器 100% 继承宿主网页文字原色，白底黑字黑底白字自适应。
 * 4. 严格禁止嵌套折叠：折叠块内部彻底禁止再创建子折叠块，杜绝复杂 DOM 递归。
 * 5. 内部操作事件阻断：通过 isInternalAction 锁彻底隔绝 DOM 操作引起的重扫描。
 * 6. 物理坐标单轨对齐：基于 getBoundingClientRect 精准计算层级位移与首行去重。
 * 7. 跨异构边界防御：检测并拦截跨代码块边界框选，杜绝撕裂。
 */

// =============================================================================
// 1. 全局配置与样式常量
// =============================================================================

const CONFIG = {
  CLASSES: {
    BLOCK: "tf-fold-block",
    COLLAPSED: "is-collapsed",
    HEADER: "tf-fold-header",
    BTN: "tf-toggle-btn",
    BODY: "tf-fold-body",
    FOLDED: "folded"
  },
  DEFAULT_SETTINGS: {
    isEnabled: true,
    collapseInitially: true,
    autoSave: false
  },
  TIMING: {
    OBSERVER_DEBOUNCE: 180,
    TYPING_LOCK: 1500,
    URL_POLL_INTERVAL: 500,
    RESTORE_DELAYS: [100, 400, 900, 1800, 3000]
  },
  UI: {
    LEFT_HOTZONE_WIDTH: 14
  },
  SELECTORS: {
    CODE: "pre, code, code-block, [class*='segment-code'], [class*='code-block'], [class*='code_block'], .md-code-block, .ds-code-box, .cm-content, .highlight",
    TEXT: "p, div.ds-markdown-paragraph, div.para, [class*='para'], li, blockquote, h1, h2, h3, h4, h5, h6",
    SAFE_EDITABLE: ".markdown, pre, code, code-block, .cm-content, message-content, [data-message-author-role], .ds-markdown, .model-response-text, .RichText",
    UNSAFE: [
      "canvas", "svg", "iframe", "video", "audio",
      ".monaco-editor", ".ace_editor",
      "#prompt-textarea",
      "[data-writing-block-fullscreen-editor-region]",
      "[role='textbox']",
      "input", "textarea", "select"
    ].join(",")
  }
};

const STYLES = {
  BASE: `
    /* 核心折叠容器 (透传宿主文字颜色) */
    .${CONFIG.CLASSES.BLOCK} {
      display: block !important;
      border-radius: 6px !important;
      padding: 6px 12px 8px ${CONFIG.UI.LEFT_HOTZONE_WIDTH}px !important;
      margin: 6px 0 !important;
      position: relative !important;
      box-sizing: border-box !important;
      width: 100% !important;
      clear: both !important;
      background-color: rgba(59, 130, 246, 0.06) !important;
      border-left: 3px solid #3b82f6 !important;
      border-top: 1px dashed rgba(59, 130, 246, 0.2) !important;
      border-right: 1px dashed rgba(59, 130, 246, 0.2) !important;
      border-bottom: 1px dashed rgba(59, 130, 246, 0.2) !important;
      color: inherit !important;
    }

    /* 代码块内部内嵌折叠 */
    pre .${CONFIG.CLASSES.BLOCK},
    code .${CONFIG.CLASSES.BLOCK},
    code-block .${CONFIG.CLASSES.BLOCK},
    div[class*="code"] .${CONFIG.CLASSES.BLOCK},
    [class*="segment-code"] .${CONFIG.CLASSES.BLOCK},
    .md-code-block .${CONFIG.CLASSES.BLOCK},
    .ds-code-box .${CONFIG.CLASSES.BLOCK},
    .cm-content .${CONFIG.CLASSES.BLOCK} {
      width: calc(100% - var(--tf-indent-offset, 0px)) !important;
      background-color: transparent !important;
      border-top: none !important;
      border-right: none !important;
      border-bottom: none !important;
      border-left: 2px solid rgba(59, 130, 246, 0.5) !important;
      padding: 2px 0 2px 8px !important;
      margin-top: 2px !important;
      margin-bottom: 2px !important;
      margin-right: 0 !important;
      margin-left: var(--tf-indent-offset, 0px) !important;
      box-shadow: none !important;
      color: inherit !important;
    }

    /* 代码块内部收起态 */
    pre .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    code .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    code-block .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    div[class*="code"] .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    [class*="segment-code"] .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    .md-code-block .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    .ds-code-box .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
      background-color: transparent !important;
      border-left-color: #64748b !important;
      padding: 1px 0 !important;
      margin-top: 1px !important;
      margin-bottom: 1px !important;
      margin-right: 0 !important;
      margin-left: var(--tf-indent-offset, 0px) !important;
    }

    /* 左侧边缘快捷交互热区 */
    .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED})::before {
      content: "" !important;
      position: absolute !important;
      top: 0 !important;
      left: -3px !important;
      width: ${CONFIG.UI.LEFT_HOTZONE_WIDTH}px !important;
      height: 100% !important;
      cursor: pointer !important;
      z-index: 15 !important;
    }
    .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED}):hover {
      border-left-color: #2563eb !important;
    }

    /* 正文紧凑收起态 */
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
      padding: 2px 6px !important;
      margin: 2px 0 !important;
      background-color: rgba(100, 116, 139, 0.1) !important;
      border-left-color: #64748b !important;
    }
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} .${CONFIG.CLASSES.HEADER} {
      margin-bottom: 0 !important;
    }

    /* 段落收起时间距消除 */
    p:has(> .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED}),
    div:has(> .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED}) {
      margin-bottom: 2px !important;
    }

    /* 跨平台代码等宽字体栈与字号锁定 */
    .${CONFIG.CLASSES.BODY} code,
    .${CONFIG.CLASSES.BODY} pre,
    .${CONFIG.CLASSES.BODY} code-block,
    pre .${CONFIG.CLASSES.BODY},
    .${CONFIG.CLASSES.BODY} div[class*="code"],
    .${CONFIG.CLASSES.BODY} [class*="segment-code"],
    .${CONFIG.CLASSES.BODY} .md-code-block,
    .${CONFIG.CLASSES.BODY} .ds-code-box,
    .${CONFIG.CLASSES.BODY} .cm-content {
      font-family: "Google Sans Code", "Roboto Mono", "Fira Code", "Fira Mono", Menlo, Monaco, Consolas, "Cascadia Mono", "Ubuntu Mono", "DejaVu Sans Mono", "Liberation Mono", "JetBrains Mono", monospace !important;
      font-size: 12.5px !important;
      line-height: 1.6 !important;
    }

    .${CONFIG.CLASSES.BODY} pre *,
    .${CONFIG.CLASSES.BODY} code *,
    .${CONFIG.CLASSES.BODY} code-block *,
    .${CONFIG.CLASSES.BODY} div[class*="code"] *,
    .${CONFIG.CLASSES.BODY} [class*="segment-code"] *,
    .${CONFIG.CLASSES.BODY} .md-code-block *,
    .${CONFIG.CLASSES.BODY} .ds-code-box * {
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
    }

    .${CONFIG.CLASSES.BODY} pre,
    .${CONFIG.CLASSES.BODY} code-block,
    .${CONFIG.CLASSES.BODY} div[class*="code"],
    .${CONFIG.CLASSES.BODY} [class*="segment-code"],
    .${CONFIG.CLASSES.BODY} .md-code-block,
    .${CONFIG.CLASSES.BODY} .ds-code-box,
    pre .${CONFIG.CLASSES.BODY} {
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }

    /* 行内代码独立边距保护 */
    .${CONFIG.CLASSES.BODY} p > code,
    .${CONFIG.CLASSES.BODY} li > code,
    .${CONFIG.CLASSES.BODY} span > code {
      display: inline-block !important;
      white-space: normal !important;
      padding: 0.15em 0.35em !important;
      font-size: 0.9em !important;
    }

    /* 内部 UI 控制组件：标准中性色定义，拒绝继承高亮色 */
    .${CONFIG.CLASSES.HEADER} {
      display: flex !important;
      align-items: center !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      margin-bottom: 4px !important;
    }

    .${CONFIG.CLASSES.BTN} {
      cursor: pointer !important;
      font-size: 12px !important;
      line-height: 1.2 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-weight: 500 !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      border: 1px solid rgba(125, 125, 125, 0.3) !important;
      background: rgba(125, 125, 125, 0.15) !important;
      color: #334155 !important;
      opacity: 0.95 !important;
      position: relative !important;
      z-index: 10 !important;
      pointer-events: auto !important;
      transition: all 0.15s ease !important;
      text-decoration: none !important;
      font-style: normal !important;
    }
    .${CONFIG.CLASSES.BTN} * {
      color: inherit !important;
      font-style: normal !important;
    }
    .${CONFIG.CLASSES.BTN}:hover {
      background: rgba(125, 125, 125, 0.25) !important;
      opacity: 1 !important;
    }

    /* 代码块与语法高亮容器内：强制锁定浅白灰中性色，彻底隔绝高亮标签颜色穿透 */
    pre .${CONFIG.CLASSES.BTN},
    code .${CONFIG.CLASSES.BTN},
    code-block .${CONFIG.CLASSES.BTN},
    div[class*="code"] .${CONFIG.CLASSES.BTN},
    [class*="segment-code"] .${CONFIG.CLASSES.BTN},
    .md-code-block .${CONFIG.CLASSES.BTN},
    .ds-code-box .${CONFIG.CLASSES.BTN},
    .cm-content .${CONFIG.CLASSES.BTN},
    [class*="hljs"] .${CONFIG.CLASSES.BTN},
    [class*="token"] .${CONFIG.CLASSES.BTN} {
      color: #e2e8f0 !important;
      background: rgba(255, 255, 255, 0.12) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    pre .${CONFIG.CLASSES.BTN}:hover,
    code .${CONFIG.CLASSES.BTN}:hover,
    code-block .${CONFIG.CLASSES.BTN}:hover,
    div[class*="code"] .${CONFIG.CLASSES.BTN}:hover,
    [class*="segment-code"] .${CONFIG.CLASSES.BTN}:hover,
    .md-code-block .${CONFIG.CLASSES.BTN}:hover,
    .ds-code-box .${CONFIG.CLASSES.BTN}:hover {
      background: rgba(255, 255, 255, 0.2) !important;
    }

    .${CONFIG.CLASSES.BODY}.${CONFIG.CLASSES.FOLDED} { display: none !important; }
    
    .${CONFIG.CLASSES.BODY} {
      display: block !important;
      margin-top: 4px !important;
      color: inherit !important;
    }

    /* 暗色模式媒体查询 */
    @media (prefers-color-scheme: dark) {
      .${CONFIG.CLASSES.BLOCK} {
        background-color: rgba(255, 255, 255, 0.04) !important;
        border-left: 3px solid #60a5fa !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
        background-color: rgba(0, 0, 0, 0.3) !important;
        border-left: 3px solid #94a3b8 !important;
      }
      .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED}):hover {
        border-left-color: #93c5fd !important;
      }
      .${CONFIG.CLASSES.BTN} {
        color: #e2e8f0 !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .${CONFIG.CLASSES.BTN}:hover {
        background: rgba(255, 255, 255, 0.2) !important;
      }
    }

    /* 列表边距保护 */
    .${CONFIG.CLASSES.BODY} li { margin-left: 1.8em !important; padding-left: 0.2em !important; list-style-position: outside !important; }
    .${CONFIG.CLASSES.BODY} ol, .${CONFIG.CLASSES.BODY} ul { padding-left: 1.8em !important; margin: 4px 0 !important; }
    .${CONFIG.CLASSES.BODY} > *:first-child { margin-top: 0 !important; }
    .${CONFIG.CLASSES.BODY} > *:last-child { margin-bottom: 0 !important; }
  `
};

// =============================================================================
// 2. 通用工具库
// =============================================================================

const Utils = {
  getSafeElement: (node) => (!node ? null : (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || null)),

  cleanText: (str) => (str || "").replace(/\u00a0/g, " ").replace(/[ \t\r\n]+/g, " ").trim(),

  async getStorage(keys) {
    if (!chrome.runtime?.id) return {};
    return new Promise(resolve => chrome.storage.local.get(keys, res => resolve(chrome.runtime.lastError ? {} : res)));
  },

  async setStorage(items) {
    if (!chrome.runtime?.id) return;
    return new Promise(resolve => chrome.storage.local.set(items, resolve));
  },

  async removeStorage(keys) {
    if (!chrome.runtime?.id) return;
    return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  },

  sendMessage(msg) {
    if (!chrome.runtime?.id) return;
    try { chrome.runtime.sendMessage(msg, () => chrome.runtime.lastError); } catch (e) {}
  }
};

// =============================================================================
// 3. 全局交互状态
// =============================================================================

const UIState = {
  rightClickedElement: null,
  lastHoveredElement: null,
  cachedRange: null,
  isSendingMessage: false,
  isInternalAction: false,

  clearSelectionCache() {
    this.cachedRange = null;
  },

  lockTyping() {
    this.isSendingMessage = true;
    setTimeout(() => { this.isSendingMessage = false; }, CONFIG.TIMING.TYPING_LOCK);
  }
};

// =============================================================================
// 4. DOM 提取与折叠结构引擎
// =============================================================================

const DOMEngine = {
  isNodeUnsafe(node) {
    if (!node) return true;
    const el = Utils.getSafeElement(node);
    if (!el) return true;

    if (el.matches?.("input, textarea, select")) return true;
    if (el.closest?.(CONFIG.SELECTORS.UNSAFE)) return true;
    if (el.isContentEditable && el === document.activeElement && !el.closest(CONFIG.SELECTORS.SAFE_EDITABLE)) return true;
    try { if (window.getComputedStyle(el).userSelect === "none") return true; } catch (e) {}
    return false;
  },

  isCrossBoundarySelection(range) {
    if (!range || range.collapsed) return false;

    const startEl = Utils.getSafeElement(range.startContainer);
    const endEl = Utils.getSafeElement(range.endContainer);
    if (!startEl || !endEl) return false;

    return startEl.closest(CONFIG.SELECTORS.CODE) !== endEl.closest(CONFIG.SELECTORS.CODE);
  },

  isSelectionSafe(range) {
    if (!range || range.toString().trim().length < 1) return false;
    if (this.isNodeUnsafe(range.startContainer) || this.isNodeUnsafe(range.endContainer)) return false;

    const startEl = Utils.getSafeElement(range.startContainer);
    const endEl = Utils.getSafeElement(range.endContainer);
    const ancestorEl = Utils.getSafeElement(range.commonAncestorContainer);

    // 严禁嵌套约束
    if (startEl?.closest(`.${CONFIG.CLASSES.BLOCK}`) || endEl?.closest(`.${CONFIG.CLASSES.BLOCK}`) || ancestorEl?.closest(`.${CONFIG.CLASSES.BLOCK}`)) {
      return false;
    }

    if (ancestorEl && this.isNodeUnsafe(ancestorEl)) return false;

    if (startEl?.closest?.("table") !== endEl?.closest?.("table")) return false;

    return !this.isCrossBoundarySelection(range);
  },

  calculateVisualOffset(range) {
    try {
      const startEl = Utils.getSafeElement(range.startContainer);
      const codeBox = startEl?.closest(CONFIG.SELECTORS.CODE);
      if (!codeBox) return 0;

      const codeRect = codeBox.getBoundingClientRect();
      const rangeRects = range.getClientRects();
      const firstRect = rangeRects.length > 0 ? rangeRects[0] : range.getBoundingClientRect();

      const paddingLeft = parseFloat(window.getComputedStyle(codeBox).paddingLeft) || 0;

      if (firstRect && firstRect.left > 0) {
        const visualDiff = firstRect.left - (codeRect.left + paddingLeft);
        if (visualDiff > 3) return Math.round(visualDiff);
      }
      return 0;
    } catch (e) {
      return 0;
    }
  },

  smartSniffTargetRange(customTargetEl, cachedSelection) {
    if (cachedSelection && this.isSelectionSafe(cachedSelection)) return cachedSelection;

    const targetNode = customTargetEl || UIState.rightClickedElement || UIState.lastHoveredElement;
    if (!targetNode) return null;

    const el = Utils.getSafeElement(targetNode);
    if (!el || this.isNodeUnsafe(el) || el.closest(`.${CONFIG.CLASSES.BLOCK}`)) return null;

    const targetBlock = el.closest(CONFIG.SELECTORS.CODE) || el.closest(CONFIG.SELECTORS.TEXT);
    if (targetBlock && !this.isNodeUnsafe(targetBlock) && !targetBlock.closest(`.${CONFIG.CLASSES.BLOCK}`)) {
      try {
        const autoRange = document.createRange();
        autoRange.selectNode(targetBlock);
        if (this.isSelectionSafe(autoRange)) return autoRange;
      } catch (e) {}
    }
    return null;
  },

  expandRangeToEnclosingBlocks(range, isManualSelection = false) {
    try {
      const startEl = Utils.getSafeElement(range.startContainer);
      const endEl = Utils.getSafeElement(range.endContainer);

      // 手动框选或恢复时保持精确选区，不向外扩展
      if (isManualSelection) return range;

      if (startEl === endEl && (startEl?.matches?.(CONFIG.SELECTORS.TEXT) || startEl?.matches?.(CONFIG.SELECTORS.CODE))) {
        return range;
      }

      const commonAncestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

      const singleBlock = commonAncestor?.closest?.(CONFIG.SELECTORS.TEXT) || commonAncestor?.closest?.(CONFIG.SELECTORS.CODE);
      if (singleBlock && !singleBlock.closest(`.${CONFIG.CLASSES.BLOCK}`)) {
        const expanded = range.cloneRange();
        expanded.selectNode(singleBlock);
        return expanded;
      }

      const getTopChild = (node, ancestor) => {
        let curr = Utils.getSafeElement(node);
        if (!curr || !ancestor || curr === ancestor) return curr;
        while (curr && curr.parentElement && curr.parentElement !== ancestor && curr.parentElement !== document.body) {
          curr = curr.parentElement;
        }
        return curr;
      };

      const startTop = getTopChild(startEl, commonAncestor);
      const endTop = getTopChild(endEl, commonAncestor);

      if (startTop && endTop && startTop !== commonAncestor && endTop !== commonAncestor && startTop.parentElement === endTop.parentElement) {
        const expanded = range.cloneRange();
        expanded.setStartBefore(startTop);
        expanded.setEndAfter(endTop);
        return expanded;
      }
    } catch (e) {}
    return range;
  },

  buildFoldUI(isCollapsed, foldId, indentOffsetPx = 0) {
    const wrapper = document.createElement("div");
    wrapper.className = CONFIG.CLASSES.BLOCK;
    wrapper.dataset.tfId = foldId || ("tf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7));

    if (indentOffsetPx > 0) {
      wrapper.style.setProperty("--tf-indent-offset", `${indentOffsetPx}px`);
    }

    const header = document.createElement("div");
    header.className = CONFIG.CLASSES.HEADER;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = CONFIG.CLASSES.BTN;
    toggleBtn.type = "button";

    const body = document.createElement("div");
    body.className = CONFIG.CLASSES.BODY;

    if (isCollapsed) {
      wrapper.classList.add(CONFIG.CLASSES.COLLAPSED);
      body.classList.add(CONFIG.CLASSES.FOLDED);
      toggleBtn.innerHTML = "▶ <span>已折叠内容 (点击展开)</span>";
    } else {
      toggleBtn.innerHTML = "▼ <span>收起此段</span>";
    }

    header.appendChild(toggleBtn);
    wrapper.appendChild(header);
    return { wrapper, header, toggleBtn, body, foldId: wrapper.dataset.tfId };
  },

  cleanEmptyGhostNodes(wrapper) {
    if (!wrapper || !wrapper.parentElement || wrapper.closest(CONFIG.SELECTORS.CODE)) return;

    const isEffectivelyEmpty = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.classList.contains(CONFIG.CLASSES.BLOCK) || node.querySelector(`.${CONFIG.CLASSES.BLOCK}`)) return false;
      if (node.querySelector("img, video, canvas, svg, input, button, textarea, br, hr")) return false;
      return (node.textContent || "").trim().length === 0;
    };

    ["nextElementSibling", "previousElementSibling"].forEach(dir => {
      let target = wrapper[dir];
      while (target && isEffectivelyEmpty(target)) {
        const toRemove = target;
        target = target[dir];
        toRemove.remove();
      }
    });
  },

  trimLeadingWhitespace(fragment) {
    let curr = fragment.firstChild;
    while (curr) {
      if (curr.nodeType === Node.TEXT_NODE) {
        if (/^[ \t\u00a0]+/.test(curr.textContent)) {
          curr.textContent = curr.textContent.replace(/^[ \t\u00a0]+/, "");
        }
        if (curr.textContent.length > 0) break;
      } else if (curr.nodeType === Node.ELEMENT_NODE && curr.firstChild) {
        this.trimLeadingWhitespace(curr);
        if (curr.textContent.trim().length > 0) break;
      }
      curr = curr.nextSibling;
    }
  },

  createFoldFromRange(rawRange, isCollapsed = true, presetId = null, isManualSelection = false) {
    const range = this.expandRangeToEnclosingBlocks(rawRange, isManualSelection);
    if (!range || !this.isSelectionSafe(range)) return null;

    UIState.isInternalAction = true;
    try {
      const indentOffsetPx = this.calculateVisualOffset(range);
      const exact = Utils.cleanText(range.toString());
      const { wrapper, body, foldId } = this.buildFoldUI(isCollapsed, presetId, indentOffsetPx);

      const extracted = range.extractContents();
      if (!extracted.textContent?.trim()) {
        range.insertNode(extracted);
        return null;
      }

      if (indentOffsetPx > 0) {
        this.trimLeadingWhitespace(extracted);
      }

      body.appendChild(extracted);
      wrapper.appendChild(body);
      range.insertNode(wrapper);

      this.cleanEmptyGhostNodes(wrapper);
      PersistenceManager.registerFoldRecord(foldId, { id: foldId, exact, isCollapsed, indentOffsetPx });
      return wrapper;
    } catch (err) {
      return null;
    } finally {
      setTimeout(() => { UIState.isInternalAction = false; }, 50);
    }
  },

  restoreFold(wrapper) {
    if (!wrapper) return;
    UIState.isInternalAction = true;
    try {
      const target = wrapper.closest(`.${CONFIG.CLASSES.BLOCK}`) || wrapper;
      const body = target.querySelector(`.${CONFIG.CLASSES.BODY}`);
      const parent = target.parentNode;

      if (body && parent) {
        const frag = document.createDocumentFragment();
        while (body.firstChild) {
          frag.appendChild(body.firstChild);
        }
        parent.insertBefore(frag, target);
        parent.removeChild(target);
        PersistenceManager.removeFoldRecord(target.dataset.tfId);
      }
    } catch (e) {} finally {
      setTimeout(() => { UIState.isInternalAction = false; }, 50);
    }
  },

  toggleFoldBlock(wrapper, scrollToView = false) {
    if (!wrapper) return;
    UIState.isInternalAction = true;
    try {
      const body = wrapper.querySelector(`.${CONFIG.CLASSES.BODY}`);
      const headerBtn = wrapper.querySelector(`.${CONFIG.CLASSES.HEADER} .${CONFIG.CLASSES.BTN}`);
      if (!body) return;

      const willCollapse = !body.classList.contains(CONFIG.CLASSES.FOLDED);
      body.classList.toggle(CONFIG.CLASSES.FOLDED, willCollapse);
      wrapper.classList.toggle(CONFIG.CLASSES.COLLAPSED, willCollapse);

      if (headerBtn) {
        headerBtn.innerHTML = willCollapse ? "▶ <span>已折叠内容 (点击展开)</span>" : "▼ <span>收起此段</span>";
      }

      if (scrollToView && willCollapse) wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
      PersistenceManager.updateFoldStateOnly(wrapper.dataset.tfId, willCollapse);
    } finally {
      setTimeout(() => { UIState.isInternalAction = false; }, 50);
    }
  }
};

// =============================================================================
// 5. 经典绝对精度持久化记忆与复原引擎
// =============================================================================

const PersistenceManager = {
  localCacheRecords: [],
  isRestoring: false,

  getStorageKey: () => "tf_store_" + window.location.origin + decodeURIComponent(window.location.pathname) + window.location.search,

  async initCache() {
    const key = this.getStorageKey();
    const payload = (await Utils.getStorage([key]))[key];
    this.localCacheRecords = Array.isArray(payload?.data) ? payload.data : [];
  },

  registerFoldRecord(foldId, record) {
    if (!this.localCacheRecords) this.localCacheRecords = [];
    const idx = this.localCacheRecords.findIndex(r => r.id === foldId);
    idx >= 0 ? (this.localCacheRecords[idx] = record) : this.localCacheRecords.push(record);
    this.persistCache();
  },

  updateFoldStateOnly(foldId, isCollapsed) {
    if (!this.localCacheRecords) return;
    const item = this.localCacheRecords.find(r => r.id === foldId);
    if (item) {
      item.isCollapsed = isCollapsed;
      this.persistCache();
    }
  },

  removeFoldRecord(foldId) {
    if (!this.localCacheRecords) return;
    this.localCacheRecords = this.localCacheRecords.filter(r => r.id !== foldId);
    this.persistCache();
  },

  async persistCache() {
    const settings = await Utils.getStorage({ autoSave: CONFIG.DEFAULT_SETTINGS.autoSave });
    if (!settings?.autoSave) return;
    const key = this.getStorageKey();
    if (!this.localCacheRecords || !this.localCacheRecords.length) return Utils.removeStorage(key);
    await Utils.setStorage({ [key]: { updatedAt: Date.now(), data: this.localCacheRecords } });
  },

  findBestAnchorMatch(fullText, exact) {
    if (!exact || exact.length < 2) return null;

    const pos = fullText.indexOf(exact);
    if (pos !== -1) return { start: pos, end: pos + exact.length };

    const headLen = Math.min(30, Math.floor(exact.length / 2));
    const tailLen = Math.min(30, Math.floor(exact.length / 2));
    const head = exact.slice(0, headLen);
    const tail = exact.slice(-tailLen);

    let hPos = fullText.indexOf(head);
    while (hPos !== -1) {
      const estimatedTailPos = fullText.indexOf(tail, hPos);
      if (estimatedTailPos !== -1 && (estimatedTailPos - hPos) <= exact.length * 1.6) {
        return { start: hPos, end: estimatedTailPos + tail.length };
      }
      hPos = fullText.indexOf(head, hPos + 1);
    }
    return null;
  },

  // 严格基于 (TextNode, 原始真实Offset) 映射复原，确保 100% 绝对精度
  async restorePageState() {
    if (this.isRestoring || UIState.isSendingMessage || UIState.isInternalAction) return false;
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled || !settings?.autoSave || !this.localCacheRecords?.length) return false;

    const rootContainer = document.body;
    const existingIds = new Set(Array.from(rootContainer.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`)).map(el => el.dataset.tfId));
    const pending = this.localCacheRecords.filter(rec => !existingIds.has(rec.id));
    
    if (!pending.length) return true;

    this.isRestoring = true;
    try {
      const walker = document.createTreeWalker(rootContainer, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (node.parentElement?.closest(`script, style, .${CONFIG.CLASSES.BLOCK}, textarea, input, [data-writing-block-fullscreen-editor-region]`)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let fullText = "";
      const charMap = [];
      let node;
      while ((node = walker.nextNode())) {
        const raw = node.textContent;
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (ch === "\u00a0" || /[ \t\r\n]/.test(ch)) {
            if (fullText.length === 0 || fullText[fullText.length - 1] !== " ") {
              fullText += " ";
              charMap.push({ node, offset: i });
            }
          } else {
            fullText += ch;
            charMap.push({ node, offset: i });
          }
        }
      }

      const tasks = [];
      pending.forEach(rec => {
        const match = this.findBestAnchorMatch(fullText, rec.exact);
        if (match && match.start < charMap.length && match.end <= charMap.length) {
          const sC = charMap[match.start];
          const eC = charMap[match.end - 1];
          if (sC && eC) {
            try {
              const range = document.createRange();
              range.setStart(sC.node, sC.offset);
              range.setEnd(eC.node, Math.min(eC.offset + 1, eC.node.textContent.length));
              if (DOMEngine.isSelectionSafe(range)) {
                tasks.push({ startIdx: match.start, range, id: rec.id, isCollapsed: rec.isCollapsed });
              }
            } catch (e) {}
          }
        }
      });

      if (tasks.length) {
        tasks.sort((a, b) => b.startIdx - a.startIdx);
        requestAnimationFrame(() => {
          // 关键：恢复时显式指定 isManualSelection = true，防止二次贪婪外扩
          tasks.forEach(t => DOMEngine.createFoldFromRange(t.range, t.isCollapsed, t.id, true));
        });
      }
    } finally {
      this.isRestoring = false;
    }
    return true;
  }
};

// =============================================================================
// 6. 顶层控制器与生命周期管理
// =============================================================================

const AppController = {
  customStyleEl: null,
  domObserver: null,
  observerTimer: null,
  lastUrl: window.location.href,

  initStyles() {
    const baseStyle = document.createElement("style");
    baseStyle.textContent = STYLES.BASE;
    document.head.appendChild(baseStyle);

    this.customStyleEl = document.createElement("style");
    document.head.appendChild(this.customStyleEl);

    Utils.getStorage({ customCss: "" }).then(res => {
      if (res?.customCss && !res.customCss.includes("rgba(239, 246, 255")) {
        this.customStyleEl.textContent = res.customCss;
      }
    });
  },

  updateDeepSelection() {
    let sel = window.getSelection();
    let range = (sel && !sel.isCollapsed && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
    if (!range && document.activeElement?.shadowRoot) {
      sel = document.activeElement.shadowRoot.getSelection?.();
      range = (sel && !sel.isCollapsed && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
    }
    UIState.cachedRange = (range && DOMEngine.isSelectionSafe(range)) ? range.cloneRange() : null;
    return UIState.cachedRange;
  },

  async syncContextMenu(e) {
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled) return;
    
    UIState.rightClickedElement = Utils.getSafeElement(e.target);
    const foldTarget = UIState.rightClickedElement?.closest(`.${CONFIG.CLASSES.BLOCK}`);
    const effectiveRange = DOMEngine.smartSniffTargetRange(UIState.rightClickedElement, this.updateDeepSelection());

    Utils.sendMessage({
      action: "UPDATE_MENU_TITLE",
      title: foldTarget ? "取消该折叠区域" : (effectiveRange ? "设置为可折叠区域" : "当前区域不可折叠")
    });
  },

  async executeCreateFold(targetRange, isManualSelection = false) {
    if (!targetRange) return;
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled) return;

    DOMEngine.createFoldFromRange(targetRange, settings.collapseInitially, null, isManualSelection);
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    UIState.clearSelectionCache();
  },

  bindMouseEvents() {
    document.addEventListener("mouseover", e => UIState.lastHoveredElement = Utils.getSafeElement(e.target), true);
    document.addEventListener("mouseup", () => this.updateDeepSelection(), true);
    document.addEventListener("pointerdown", e => {
      if (e.button === 2) {
        this.updateDeepSelection();
        this.syncContextMenu(e);
      }
    }, true);
    document.addEventListener("contextmenu", e => this.syncContextMenu(e), true);
  },

  bindKeyboardEvents() {
    document.addEventListener("keyup", () => this.updateDeepSelection(), true);
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && Utils.getSafeElement(e.target)?.closest("textarea, input, [contenteditable='true']")) {
        UIState.lockTyping();
      }
    }, true);
  },

  bindClickEvents() {
    document.addEventListener("click", e => {
      const targetEl = Utils.getSafeElement(e.target);
      
      if (targetEl?.closest("button[data-testid='send-button'], button[aria-label='发送提示词'], form button[type='submit']")) {
        UIState.lockTyping();
      }

      const toggleBtn = targetEl?.closest(`.${CONFIG.CLASSES.BTN}`);
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        DOMEngine.toggleFoldBlock(toggleBtn.closest(`.${CONFIG.CLASSES.BLOCK}`), false);
        return;
      }

      const foldBlock = targetEl?.closest(`.${CONFIG.CLASSES.BLOCK}`);
      if (foldBlock && !foldBlock.classList.contains(CONFIG.CLASSES.COLLAPSED)) {
        if (e.clientX >= foldBlock.getBoundingClientRect().left - 4 && e.clientX <= foldBlock.getBoundingClientRect().left + CONFIG.UI.LEFT_HOTZONE_WIDTH) {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            DOMEngine.toggleFoldBlock(foldBlock, true);
          }
        }
      }
    }, true);
  },

  bindExtensionMessages() {
    chrome.runtime?.onMessage?.addListener((req, sender, sendResponse) => {
      const hasManualRange = !!UIState.cachedRange;
      const activeRange = DOMEngine.smartSniffTargetRange(UIState.lastHoveredElement, this.updateDeepSelection());
      
      switch (req.action) {
        case "TRIGGER_CONTEXT_ACTION":
          const foldWrapper = UIState.rightClickedElement?.closest(`.${CONFIG.CLASSES.BLOCK}`);
          if (foldWrapper) DOMEngine.restoreFold(foldWrapper);
          else if (activeRange) this.executeCreateFold(activeRange, hasManualRange);
          break;
        case "COMMAND_FOLD":
          if (activeRange) this.executeCreateFold(activeRange, hasManualRange);
          break;
        case "COMMAND_RESTORE":
          DOMEngine.restoreFold(UIState.lastHoveredElement?.closest(`.${CONFIG.CLASSES.BLOCK}`));
          break;
        case "CLEAR_PAGE_FOLDS":
          PersistenceManager.localCacheRecords = [];
          Utils.removeStorage(PersistenceManager.getStorageKey());
          document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
          break;
        case "APPLY_CUSTOM_CSS":
          if (this.customStyleEl) this.customStyleEl.textContent = req.css;
          break;
      }
      sendResponse?.({ success: true });
      return true;
    });

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.isEnabled) {
          if (changes.isEnabled.newValue === false) {
            document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
          } else if (changes.isEnabled.newValue === true) {
            PersistenceManager.restorePageState();
          }
        }
      });
    }
  },

  initDOMObserver() {
    this.domObserver = new MutationObserver(mutations => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
        PersistenceManager.initCache().then(() => PersistenceManager.restorePageState());
        return;
      }

      if (UIState.isInternalAction || PersistenceManager.isRestoring || UIState.isSendingMessage || !PersistenceManager.localCacheRecords?.length) return;

      const existingIds = new Set(Array.from(document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`)).map(el => el.dataset.tfId));
      if (!PersistenceManager.localCacheRecords.some(rec => !existingIds.has(rec.id))) return;

      if (!mutations.some(m => !Utils.getSafeElement(m.target)?.closest(`.${CONFIG.CLASSES.BLOCK}`))) return;

      clearTimeout(this.observerTimer);
      this.observerTimer = setTimeout(() => PersistenceManager.restorePageState(), CONFIG.TIMING.OBSERVER_DEBOUNCE);
    });

    this.domObserver.observe(document.body, { childList: true, subtree: true });
  },

  start() {
    this.initStyles();
    this.bindMouseEvents();
    this.bindKeyboardEvents();
    this.bindClickEvents();
    this.bindExtensionMessages();
    this.initDOMObserver();
    
    const triggerPageRestore = () => {
      PersistenceManager.initCache().then(() => {
        if (!PersistenceManager.localCacheRecords.length) return;
        CONFIG.TIMING.RESTORE_DELAYS.forEach(delay => setTimeout(() => PersistenceManager.restorePageState(), delay));
      });
    };

    triggerPageRestore();

    window.addEventListener("popstate", triggerPageRestore);
    window.addEventListener("hashchange", triggerPageRestore);

    setInterval(() => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        triggerPageRestore();
      }
    }, CONFIG.TIMING.URL_POLL_INTERVAL);
  }
};

// 启动应用
AppController.start();