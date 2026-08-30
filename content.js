// =============================================================================
// 1. 配置与样式常量
// =============================================================================

/**
 * 插件运行时核心配置项
 */
const CONFIG = {
  // DOM 折叠容器所用的 CSS 类名定义
  CLASSES: {
    BLOCK: "tf-fold-block",       // 折叠块根容器
    COLLAPSED: "is-collapsed",   // 折叠状态标记
    HEADER: "tf-fold-header",     // 顶部操作栏
    BTN: "tf-toggle-btn",         // 展开/收起切换按钮
    BODY: "tf-fold-body",         // 折叠内容包裹体
    FOLDED: "folded"              // 内容隐藏状态
  },

  // 用户默认配置
  DEFAULT_SETTINGS: {
    isEnabled: true,              // 是否启用插件功能
    collapseInitially: true,      // 创建折叠区域时是否默认收起
    autoSave: false               // 是否开启页面折叠记忆（刷新后保留）
  },

  // 单个浏览器存储历史记忆的最大页面数（超过后按 LRU 清理）
  MAX_SAVED_PAGES: 500,

  // 不允许注入折叠操作的黑名单选择器（编辑器、输入控件、富媒体与专用阅读器图层）
  UNSAFE_SELECTORS: [
    "input", "textarea", "select", "button", "canvas", "svg", "iframe",
    "video", "audio", "[contenteditable='true']", ".monaco-editor",
    ".cm-editor", ".ace_editor", ".textLayer", ".pdfViewer",
    ".flowpdf", ".flowpdf-content", ".kns-reader", "[data-page-no]"
  ].join(",")
};

/**
 * 样式注入模板
 */
const STYLES = {
  // 核心功能性样式（保证折叠展开的基础布局与过渡）
  BASE: `
    .${CONFIG.CLASSES.BLOCK} {
      display: block !important;
      border-radius: 5px !important;
      padding: 6px 10px !important;
      margin: 6px 0 !important;
      position: relative !important;
      transition: all 0.2s ease !important;
    }
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} { padding: 4px 10px !important; }
    .${CONFIG.CLASSES.HEADER} {
      display: flex !important;
      align-items: center !important;
      user-select: none !important;
      margin-bottom: 4px !important;
    }
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} .${CONFIG.CLASSES.HEADER} { margin-bottom: 0 !important; }
    .${CONFIG.CLASSES.BTN} {
      cursor: pointer !important;
      font-size: 12px !important;
      font-family: inherit !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      transition: background 0.15s ease !important;
    }
    .${CONFIG.CLASSES.BODY}.${CONFIG.CLASSES.FOLDED} { display: none !important; }
    .${CONFIG.CLASSES.BODY} { display: block !important; }
  `,

  // 默认主题样式（经典冰蓝）
  FALLBACK_BLUE: `
    .${CONFIG.CLASSES.BLOCK} {
      background-color: rgba(239, 246, 255, 0.85) !important;
      border-left: 4px solid #3b82f6 !important;
      border-top: 1px dashed #bfdbfe !important;
      border-right: 1px dashed #bfdbfe !important;
      border-bottom: 1px dashed #bfdbfe !important;
    }
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
      background-color: rgba(241, 245, 249, 0.95) !important;
      border-left: 4px solid #64748b !important;
      border-top: 1px solid #cbd5e1 !important;
      border-right: 1px solid #cbd5e1 !important;
      border-bottom: 1px solid #cbd5e1 !important;
    }
    .${CONFIG.CLASSES.BTN} {
      border: 1px solid #93c5fd !important;
      background: #dbeafe !important;
      color: #1e40af !important;
    }
    .${CONFIG.CLASSES.BTN}:hover { background: #bfdbfe !important; }
  `
};

// =============================================================================
// 2. 工具与 Chrome Storage Promise 封装
// =============================================================================

const Utils = {
  /**
   * 获取安全的 Element 节点（若传入为 TextNode 则返回其父级 Element）
   */
  getSafeElement(target) {
    if (!target) return null;
    return target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement || null;
  },

  /**
   * 异步获取 Storage 本地配置
   */
  async getStorage(keys) {
    if (!chrome.runtime?.id) return {};
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(chrome.runtime.lastError ? {} : res));
    });
  },

  /**
   * 异步设置 Storage 本地配置
   */
  async setStorage(items) {
    if (!chrome.runtime?.id) return;
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  },

  /**
   * 异步删除 Storage 键名
   */
  async removeStorage(keys) {
    if (!chrome.runtime?.id) return;
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  },

  /**
   * 发送运行时安全消息（捕获扩展上下文失效异常）
   */
  sendMessage(msg) {
    if (!chrome.runtime?.id) return;
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }
};

// =============================================================================
// 3. 用户交互状态中心
// =============================================================================

/**
 * 维护当前前台交互时的全局临时上下文
 */
const UIState = {
  rightClickedElement: null, // 用户最后一次右键点击的目标节点
  lastHoveredElement: null,  // 鼠标最后滑过的目标节点（快捷键还原备选点）
  cachedRange: null,         // 缓存的有效选区对象

  clearSelectionCache() {
    this.cachedRange = null;
  }
};

// =============================================================================
// 4. DOM 操作与选区安全引擎
// =============================================================================

const DOMEngine = {
  /**
   * 校验节点是否位于不可折叠区域（黑名单选择器、不可选文本、绝对定位层等）
   */
  isNodeUnsafe(node) {
    if (!node) return true;
    const el = Utils.getSafeElement(node);
    if (!el) return true;

    // 1. 命中黑名单标签或容器
    if (el.closest?.(CONFIG.UNSAFE_SELECTORS)) return true;

    // 2. 检查 CSS 特殊属性限制
    try {
      const style = window.getComputedStyle(el);
      if (style.userSelect === "none") return true;

      // 避免破坏 PDF 选区或绝对定位图层
      const isAbsPos = style.position === "absolute" || style.position === "fixed";
      if (isAbsPos && (el.classList.contains("textLayer") || el.parentElement?.classList.contains("textLayer"))) {
        return true;
      }
    } catch (e) {}

    return false;
  },

  /**
   * 校验选区 (Range) 的有效性与安全性
   */
  isSelectionSafe(range) {
    if (!range || range.collapsed) return false;
    if (range.toString().trim().length < 2) return false; // 忽略单个无意义字符

    // 起止节点必须安全
    if (this.isNodeUnsafe(range.startContainer) || this.isNodeUnsafe(range.endContainer)) return false;

    // 公共祖先必须安全
    const ancestorEl = Utils.getSafeElement(range.commonAncestorContainer);
    if (ancestorEl && this.isNodeUnsafe(ancestorEl)) return false;

    // 禁止跨越表格 (Table) 结构造成 DOM 解析错乱
    const startTable = Utils.getSafeElement(range.startContainer)?.closest?.("table");
    const endTable = Utils.getSafeElement(range.endContainer)?.closest?.("table");
    return startTable === endTable;
  },

  /**
   * 检查节点是否已经处于折叠块内部
   */
  isInsideFoldBlock(node) {
    if (!node) return false;
    return Boolean(Utils.getSafeElement(node)?.closest?.(`.${CONFIG.CLASSES.BLOCK}`));
  },

  /**
   * 防止折叠块嵌套与交叉重叠
   */
  rangeOverlapsFoldBlock(range) {
    if (!range) return true;
    if (this.isInsideFoldBlock(range.startContainer) || this.isInsideFoldBlock(range.endContainer)) return true;

    const element = Utils.getSafeElement(range.commonAncestorContainer);
    if (element && element.closest?.(`.${CONFIG.CLASSES.BLOCK}`)) return true;

    if (element) {
      const existingFolds = element.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`);
      for (const fold of existingFolds) {
        if (range.intersectsNode(fold)) return true;
      }
    }
    return false;
  },

  /**
   * 创建折叠组件的 DOM 框架 (Wrapper + Header + Body)
   */
  buildFoldUI(isCollapsed) {
    const wrapper = document.createElement("div");
    wrapper.className = CONFIG.CLASSES.BLOCK;

    const header = document.createElement("div");
    header.className = CONFIG.CLASSES.HEADER;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = CONFIG.CLASSES.BTN;

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
    return { wrapper, header, toggleBtn, body };
  },

  /**
   * 清理提取内容后在父级遗留的幽灵空白段落
   */
  cleanEmptyGhostParagraphs(container) {
    if (!container || container === document.body) return;
    const blocks = container.querySelectorAll("p, div.para, .para, div");
    blocks.forEach((el) => {
      if (!el.classList.contains(CONFIG.CLASSES.BLOCK) && !el.closest(`.${CONFIG.CLASSES.BLOCK}`)) {
        if (!el.innerHTML.trim() || !el.textContent.trim()) el.remove();
      }
    });
  },

  /**
   * 将选区内容提取并转化为可折叠容器
   */
  createFoldFromRange(range, isCollapsed = true) {
    if (!range || !this.isSelectionSafe(range) || this.rangeOverlapsFoldBlock(range)) return null;

    const { wrapper, body } = this.buildFoldUI(isCollapsed);
    try {
      const parentContainer = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

      // 提取选区内的 DOM 片段
      const extracted = range.extractContents();
      if (!extracted.textContent?.trim()) {
        range.insertNode(extracted); // 无文本时回滚
        return null;
      }

      body.appendChild(extracted);
      wrapper.appendChild(body);
      range.insertNode(wrapper); // 插入包装后的折叠块

      this.cleanEmptyGhostParagraphs(parentContainer);
    } catch (err) {
      return null;
    }
    return wrapper;
  },

  /**
   * 还原折叠块：解包并无痕归还原生 DOM
   */
  restoreFold(wrapper) {
    if (!wrapper) return;
    try {
      const target = wrapper.closest(`.${CONFIG.CLASSES.BLOCK}`) || wrapper;
      const body = target.querySelector(`.${CONFIG.CLASSES.BODY}`);
      const parent = target.parentNode;

      if (body && parent) {
        // 将 Body 中的全部子节点插回到原生父容器中
        while (body.firstChild) {
          parent.insertBefore(body.firstChild, target);
        }
        parent.removeChild(target);
        parent.normalize(); // 合并碎裂的文本节点
        PersistenceManager.savePageState(); // 同步更新持久化状态
      }
    } catch (e) {}
  }
};

// =============================================================================
// 5. 字符流锚点与状态持久化引擎
// =============================================================================

const PersistenceManager = {
  /**
   * 生成当前页面专属的 Storage 存储 Key（忽略 Hash 与 Query 参数）
   */
  getStorageKey() {
    const url = new URL(window.location.href);
    return "tf_store_" + url.origin + decodeURIComponent(url.pathname);
  },

  /**
   * 构建整页纯文本流与 DOM TextNode 映射表（用于精准脱离 CSS 路径的文本定位）
   */
  getTextStream(includeFoldBodies = true) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // 排除脚本、样式及内部操作按钮文本
        if (node.parentElement?.closest?.(`script, style, noscript, textarea, [data-page-no]`)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.parentElement?.closest?.(`.${CONFIG.CLASSES.HEADER}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!includeFoldBodies && node.parentElement?.closest?.(`.${CONFIG.CLASSES.BLOCK}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let text = "";
    const charMap = []; // 字符流索引 -> { node: DOMTextNode, offset: 节点内偏移, foldBlock }
    let node;

    while ((node = walker.nextNode())) {
      const raw = node.textContent;
      const foldBlock = node.parentElement?.closest?.(`.${CONFIG.CLASSES.BLOCK}`);
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        // 压缩连续空格以抵御 HTML 渲染差异
        if (/\s/.test(ch)) {
          if (text.length === 0 || text[text.length - 1] !== " ") {
            text += " ";
            charMap.push({ node, offset: i, foldBlock });
          }
        } else {
          text += ch;
          charMap.push({ node, offset: i, foldBlock });
        }
      }
    }
    return { text, charMap };
  },

  /**
   * 三元上下文特征加权匹配算法（Prefix + Exact + Suffix）
   * 即使文本内部发生微小变动或排版调整，也能依托上下文精准锚定
   */
  findBestAnchorMatch(fullText, exact, prefix, suffix) {
    if (!exact) return null;

    let matches = [];
    let pos = fullText.indexOf(exact);
    let matchLen = exact.length;

    // 阶段 1：完全精准匹配
    while (pos !== -1) {
      matches.push(pos);
      pos = fullText.indexOf(exact, pos + 1);
    }

    // 阶段 2：模糊匹配降级策略（头部与尾部双锚点探测）
    if (matches.length === 0 && exact.length > 20) {
      const head = exact.slice(0, 15);
      const tail = exact.slice(-15);
      let hPos = fullText.indexOf(head);
      while (hPos !== -1) {
        const estimatedTailPos = fullText.indexOf(tail, hPos);
        if (estimatedTailPos !== -1 && (estimatedTailPos - hPos) < exact.length * 1.5) {
          matches.push(hPos);
          matchLen = (estimatedTailPos + tail.length) - hPos;
        }
        hPos = fullText.indexOf(head, hPos + 1);
      }
    }

    if (matches.length === 0) return null;

    let bestMatch = null;
    let highestScore = -1;

    // 阶段 3：计算上下文环境得分（加权前缀和后缀吻合度）
    for (const startIdx of matches) {
      let score = 0;
      const endIdx = startIdx + matchLen;

      if (prefix) {
        const textBefore = fullText.slice(Math.max(0, startIdx - prefix.length - 15), startIdx);
        if (textBefore.includes(prefix)) score += 50;
      } else {
        score += 10;
      }

      if (suffix) {
        const textAfter = fullText.slice(endIdx, Math.min(fullText.length, endIdx + suffix.length + 15));
        if (textAfter.includes(suffix)) score += 50;
      } else {
        score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = { start: startIdx, end: Math.min(fullText.length, endIdx) };
      }
    }
    return bestMatch;
  },

  /**
   * 保存当前页面折叠状态到本地缓存
   */
  async savePageState() {
    const res = await Utils.getStorage({ autoSave: CONFIG.DEFAULT_SETTINGS.autoSave });
    if (!res?.autoSave) return;

    const wrappers = Array.from(document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`));
    const key = this.getStorageKey();

    if (wrappers.length === 0) {
      await Utils.removeStorage(key);
      return;
    }

    const { text, charMap } = this.getTextStream(true);
    const records = [];

    wrappers.forEach((w) => {
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < charMap.length; i++) {
        if (charMap[i].foldBlock === w) {
          if (startIdx === -1) startIdx = i;
          endIdx = i;
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        const exact = text.slice(startIdx, endIdx + 1).trim();
        if (exact.length >= 2) {
          const prefix = text.slice(Math.max(0, startIdx - 35), startIdx).trim();
          const suffix = text.slice(endIdx + 1, Math.min(text.length, endIdx + 1 + 35)).trim();
          const body = w.querySelector(`.${CONFIG.CLASSES.BODY}`);

          records.push({
            prefix,
            exact,
            suffix,
            isCollapsed: body ? body.classList.contains(CONFIG.CLASSES.FOLDED) : true
          });
        }
      }
    });

    if (records.length === 0) {
      await Utils.removeStorage(key);
      return;
    }

    // LRU 淘汰检查：确保数据条目不超过限制
    const allData = await Utils.getStorage(null);
    const storeEntries = Object.entries(allData)
      .filter(([k]) => k.startsWith("tf_store_"))
      .map(([k, val]) => ({ key: k, updatedAt: val?.updatedAt || 0 }));

    if (storeEntries.length >= CONFIG.MAX_SAVED_PAGES) {
      storeEntries.sort((a, b) => a.updatedAt - b.updatedAt);
      const keysToRemove = storeEntries
        .slice(0, storeEntries.length - CONFIG.MAX_SAVED_PAGES + 1)
        .map((item) => item.key);
      await Utils.removeStorage(keysToRemove);
    }

    await Utils.setStorage({ [key]: { updatedAt: Date.now(), data: records } });
  },

  /**
   * 从缓存中重放并恢复页面的折叠状态
   */
  async restorePageState() {
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled || !settings?.autoSave) return;

    const key = this.getStorageKey();
    const data = await Utils.getStorage([key]);
    const payload = data[key];
    const records = Array.isArray(payload) ? payload : payload?.data;
    if (!records?.length) return;

    // 1. 在干净的 DOM 树上提取文本映射表
    const { text, charMap } = this.getTextStream(false);
    const plannedTasks = [];

    records.forEach((rec) => {
      const match = this.findBestAnchorMatch(text, rec.exact, rec.prefix, rec.suffix);
      if (match && match.start < charMap.length && match.end <= charMap.length) {
        const startChar = charMap[match.start];
        const endChar = charMap[match.end - 1];

        if (startChar && endChar) {
          try {
            const range = document.createRange();
            range.setStart(startChar.node, startChar.offset);
            range.setEnd(endChar.node, endChar.offset + 1);

            if (DOMEngine.isSelectionSafe(range)) {
              plannedTasks.push({
                startIdx: match.start,
                range,
                isCollapsed: rec.isCollapsed
              });
            }
          } catch (e) {}
        }
      }
    });

    // 2. 逆向拓扑排序（自底向上包裹，防止先序节点 DOM 变更破坏后续节点 Range 的 offset）
    plannedTasks.sort((a, b) => b.startIdx - a.startIdx);
    plannedTasks.forEach((task) => {
      if (!DOMEngine.rangeOverlapsFoldBlock(task.range)) {
        DOMEngine.createFoldFromRange(task.range, task.isCollapsed);
      }
    });
  }
};

// =============================================================================
// 6. 前台控制器与事件总线
// =============================================================================

const AppController = {
  customStyleEl: null,

  /**
   * 初始化注入扩展专属 CSS 样式
   */
  initStyles() {
    const baseStyle = document.createElement("style");
    baseStyle.id = "tf-base-style";
    baseStyle.textContent = STYLES.BASE;
    document.head.appendChild(baseStyle);

    this.customStyleEl = document.createElement("style");
    this.customStyleEl.id = "tf-custom-style";
    document.head.appendChild(this.customStyleEl);

    Utils.getStorage({ customCss: STYLES.FALLBACK_BLUE }).then((res) => {
      this.customStyleEl.textContent = res?.customCss || STYLES.FALLBACK_BLUE;
    });
  },

  /**
   * 更新并缓存当前合法选区
   */
  updateSelectionCache() {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (DOMEngine.isSelectionSafe(range) && !DOMEngine.rangeOverlapsFoldBlock(range)) {
        UIState.cachedRange = range.cloneRange();
        return;
      }
    }
    UIState.clearSelectionCache();
  },

  /**
   * 动态同步右键菜单文案（根据当前选中/点击的区域动态调整）
   */
  syncContextMenu(e) {
    UIState.rightClickedElement = Utils.getSafeElement(e.target);
    const foldTarget = UIState.rightClickedElement?.closest?.(`.${CONFIG.CLASSES.BLOCK}`);

    const currentSel = window.getSelection();
    const validSelection = currentSel && !currentSel.isCollapsed && currentSel.rangeCount > 0 
      ? DOMEngine.isSelectionSafe(currentSel.getRangeAt(0)) 
      : false;

    let title = "设置为可折叠区域";
    if (foldTarget) {
      title = "取消该折叠区域";
    } else if (!validSelection && !UIState.cachedRange) {
      title = "当前区域不可折叠";
    }

    Utils.sendMessage({ action: "UPDATE_MENU_TITLE", title });
  },

  /**
   * 执行折叠区域创建
   */
  async executeMakeFoldable() {
    const res = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!res?.isEnabled) return;

    let targetRange = null;
    const currentSel = window.getSelection();

    if (currentSel && !currentSel.isCollapsed && currentSel.rangeCount > 0) {
      targetRange = currentSel.getRangeAt(0);
    } else if (UIState.cachedRange) {
      targetRange = UIState.cachedRange;
    }

    if (!targetRange || targetRange.collapsed) return;
    if (!DOMEngine.isSelectionSafe(targetRange) || DOMEngine.rangeOverlapsFoldBlock(targetRange)) return;

    const wrapper = DOMEngine.createFoldFromRange(targetRange, res.collapseInitially);
    if (currentSel) currentSel.removeAllRanges();
    UIState.clearSelectionCache();

    if (wrapper) PersistenceManager.savePageState();
  },

  /**
   * 寻找快捷键还原折叠块时的候选目标
   */
  findTargetFoldBlockForRestore() {
    const candidates = [
      UIState.lastHoveredElement,
      window.getSelection()?.anchorNode,
      document.activeElement,
      UIState.rightClickedElement
    ];

    for (const target of candidates) {
      if (target) {
        const fold = Utils.getSafeElement(target)?.closest?.(`.${CONFIG.CLASSES.BLOCK}`);
        if (fold) return fold;
      }
    }
    return null;
  },

  /**
   * 绑定 DOM 事件监听与 Chrome 运行时消息
   */
  bindEvents() {
    // 监听鼠标轨迹与选区状态
    document.addEventListener("mouseover", (e) => {
      UIState.lastHoveredElement = Utils.getSafeElement(e.target);
    }, true);

    document.addEventListener("mouseup", () => this.updateSelectionCache());
    document.addEventListener("keyup", () => this.updateSelectionCache());

    document.addEventListener("pointerdown", (e) => {
      if (e.button === 2) this.syncContextMenu(e);
    }, true);

    document.addEventListener("contextmenu", (e) => {
      this.syncContextMenu(e);
      this.updateSelectionCache();
    }, true);

    // 统一委托折叠块展开/收起按钮点击事件
    document.addEventListener("click", (e) => {
      const toggleBtn = Utils.getSafeElement(e.target)?.closest?.(`.${CONFIG.CLASSES.BTN}`);
      if (!toggleBtn) return;

      const wrapper = toggleBtn.closest(`.${CONFIG.CLASSES.BLOCK}`);
      const body = wrapper?.querySelector(`.${CONFIG.CLASSES.BODY}`);
      if (!wrapper || !body) return;

      e.preventDefault();
      e.stopPropagation();

      const willCollapse = !body.classList.contains(CONFIG.CLASSES.FOLDED);
      body.classList.toggle(CONFIG.CLASSES.FOLDED, willCollapse);
      wrapper.classList.toggle(CONFIG.CLASSES.COLLAPSED, willCollapse);

      toggleBtn.innerHTML = willCollapse 
        ? "▶ <span>已折叠内容 (点击展开)</span>" 
        : "▼ <span>收起此段</span>";

      PersistenceManager.savePageState();
    });

    // 监听来自 Background 或 Popup 的调度指令
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req) => {
        switch (req.action) {
          case "TRIGGER_CONTEXT_ACTION": {
            const foldWrapper = UIState.rightClickedElement?.closest?.(`.${CONFIG.CLASSES.BLOCK}`);
            foldWrapper ? DOMEngine.restoreFold(foldWrapper) : this.executeMakeFoldable();
            break;
          }
          case "COMMAND_FOLD":
            this.executeMakeFoldable();
            break;
          case "COMMAND_RESTORE": {
            const targetFold = this.findTargetFoldBlockForRestore();
            if (targetFold) DOMEngine.restoreFold(targetFold);
            break;
          }
          case "CLEAR_PAGE_FOLDS": {
            document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach((w) => DOMEngine.restoreFold(w));
            Utils.removeStorage(PersistenceManager.getStorageKey());
            break;
          }
          case "APPLY_CUSTOM_CSS":
            if (this.customStyleEl) this.customStyleEl.textContent = req.css;
            break;
        }
      });
    }

    // 页面加载与路由跳转防抖恢复调度
    let restoreTimer = null;
    const scheduleRestore = () => {
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => PersistenceManager.restorePageState(), 250);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scheduleRestore);
    } else {
      scheduleRestore();
    }

    // SPA 路由劫持监听（无 DOM 轮询性能损耗）
    window.addEventListener("popstate", scheduleRestore);
    window.addEventListener("hashchange", scheduleRestore);

    ["pushState", "replaceState"].forEach((method) => {
      const original = history[method];
      if (typeof original === "function") {
        history[method] = function (...args) {
          const res = original.apply(this, args);
          scheduleRestore();
          return res;
        };
      }
    });
  },

  /**
   * 应用入口
   */
  start() {
    this.initStyles();
    this.bindEvents();
  }
};

// 启动控制器
AppController.start();