// =============================================================================
// 1. 常量与基础配置
// =============================================================================
const CLASSES = {
  BLOCK: "tf-fold-block",
  COLLAPSED: "is-collapsed",
  HEADER: "tf-fold-header",
  BTN: "tf-toggle-btn",
  BODY: "tf-fold-body",
  FOLDED: "folded"
};

const DEFAULT_SETTINGS = {
  isEnabled: true,
  collapseInitially: true,
  autoSave: false
};

// 不可折叠 / 受保护的标签、富文本编辑器、以及 PDF/阅读器专用渲染层选择器
const UNSAFE_SELECTORS = [
  "input",
  "textarea",
  "select",
  "button",
  "canvas",
  "svg",
  "iframe",
  "video",
  "audio",
  "[contenteditable='true']",
  ".monaco-editor",
  ".cm-editor",
  ".ace_editor",
  // PDF / CAJ 在线阅读器常见文本层
  ".textLayer",
  ".pdfViewer",
  ".flowpdf",
  ".flowpdf-content",
  ".kns-reader",
  "[data-page-no]"
].join(",");

const BASE_STYLES = `
  .${CLASSES.BLOCK} {
    display: block !important;
    border-radius: 5px !important;
    padding: 6px 10px !important;
    margin: 8px 0 !important;
    position: relative !important;
    transition: all 0.2s ease !important;
  }
  .${CLASSES.BLOCK}.${CLASSES.COLLAPSED} {
    padding: 4px 10px !important;
  }
  .${CLASSES.HEADER} {
    display: flex !important;
    align-items: center !important;
    user-select: none !important;
    margin-bottom: 4px !important;
  }
  .${CLASSES.BLOCK}.${CLASSES.COLLAPSED} .${CLASSES.HEADER} {
    margin-bottom: 0 !important;
  }
  .${CLASSES.BTN} {
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
  .${CLASSES.BODY}.${CLASSES.FOLDED} {
    display: none !important;
  }
  .${CLASSES.BODY} {
    display: block !important;
  }
`;

const FALLBACK_BLUE_CSS = `
.${CLASSES.BLOCK} {
  background-color: rgba(239, 246, 255, 0.85) !important;
  border-left: 4px solid #3b82f6 !important;
  border-top: 1px dashed #bfdbfe !important;
  border-right: 1px dashed #bfdbfe !important;
  border-bottom: 1px dashed #bfdbfe !important;
}
.${CLASSES.BLOCK}.${CLASSES.COLLAPSED} {
  background-color: rgba(241, 245, 249, 0.95) !important;
  border-left: 4px solid #64748b !important;
  border-top: 1px solid #cbd5e1 !important;
  border-right: 1px solid #cbd5e1 !important;
  border-bottom: 1px solid #cbd5e1 !important;
}
.${CLASSES.BTN} {
  border: 1px solid #93c5fd !important;
  background: #dbeafe !important;
  color: #1e40af !important;
}
.${CLASSES.BTN}:hover {
  background: #bfdbfe !important;
}`;

// =============================================================================
// 2. 扩展 API 安全封装
// =============================================================================
function safeStorageGet(keys, callback) {
  if (!chrome.runtime?.id) return;
  chrome.storage.local.get(keys, (res) => {
    if (chrome.runtime.lastError) return;
    callback(res);
  });
}

function safeSendMessage(msg) {
  if (!chrome.runtime?.id) return;
  try {
    chrome.runtime.sendMessage(msg, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch (e) {}
}

// =============================================================================
// 3. 样式注入
// =============================================================================
const baseStyle = document.createElement("style");
baseStyle.id = "tf-base-style";
baseStyle.textContent = BASE_STYLES;
document.head.appendChild(baseStyle);

const customStyle = document.createElement("style");
customStyle.id = "tf-custom-style";
document.head.appendChild(customStyle);

safeStorageGet({ customCss: FALLBACK_BLUE_CSS }, (res) => {
  customStyle.textContent = res?.customCss || FALLBACK_BLUE_CSS;
});

// =============================================================================
// 4. 选区安全审查与防嵌套机制
// =============================================================================
let rightClickedElement = null;
let lastHoveredElement = null;
let cachedRange = null;

// 校验单个 DOM 节点是否位于保护/危险区域
function isNodeUnsafe(node) {
  if (!node) return true;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el) return true;

  // 1. 命中黑名单标签或阅读器/编辑器容器
  if (el.closest(UNSAFE_SELECTORS)) return true;

  // 2. 检查元素自身是否带有不可选中属性
  try {
    const style = window.getComputedStyle(el);
    if (style.userSelect === "none") return true;
    
    // PDF 阅读器特征：绝对定位的微型文字碎片，禁止注入块级元素破坏排版
    const isAbsPos = style.position === "absolute" || style.position === "fixed";
    if (isAbsPos && (el.classList.contains("textLayer") || el.parentElement?.classList.contains("textLayer"))) {
      return true;
    }
  } catch (e) {}

  return false;
}

// 判定整个 Range 选区是否合法安全
function isSelectionSafe(range) {
  if (!range || range.collapsed) return false;

  // 1. 选区文本长度有效性快速前置校验（无实际文本直接拦截）
  const selectedText = range.toString().trim();
  if (selectedText.length < 2) {
    return false;
  }

  // 2. 节点安全性检测
  if (isNodeUnsafe(range.startContainer) || isNodeUnsafe(range.endContainer)) {
    return false;
  }

  const commonAncestor = range.commonAncestorContainer;
  const ancestorEl = commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement;
  if (ancestorEl && isNodeUnsafe(ancestorEl)) {
    return false;
  }

  // 3. 表格越界保护：禁止选区跨越 table 边界
  const startTable = range.startContainer.parentElement?.closest("table");
  const endTable = range.endContainer.parentElement?.closest("table");
  if (startTable !== endTable) {
    return false;
  }

  return true;
}

function isInsideFoldBlock(node) {
  if (!node) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return Boolean(el?.closest(`.${CLASSES.BLOCK}`));
}

function rangeOverlapsFoldBlock(range) {
  if (!range) return true;

  if (isInsideFoldBlock(range.startContainer) || isInsideFoldBlock(range.endContainer)) {
    return true;
  }

  const commonAncestor = range.commonAncestorContainer;
  const element = commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement;
  if (element && element.closest(`.${CLASSES.BLOCK}`)) return true;

  if (element) {
    const existingFolds = element.querySelectorAll(`.${CLASSES.BLOCK}`);
    for (const fold of existingFolds) {
      if (range.intersectsNode(fold)) return true;
    }
  }

  return false;
}

function updateSelectionCache() {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (isSelectionSafe(range) && !rangeOverlapsFoldBlock(range)) {
      cachedRange = range.cloneRange();
    } else {
      cachedRange = null;
    }
  }
}

function syncContextMenu(e) {
  rightClickedElement = e.target;
  const foldTarget = rightClickedElement?.closest(`.${CLASSES.BLOCK}`);
  
  // 如果在不可折叠区域且没有已有折叠块，右键菜单不显示“设置为可折叠”
  const currentSel = window.getSelection();
  const validSelection = currentSel && !currentSel.isCollapsed && currentSel.rangeCount > 0 
    ? isSelectionSafe(currentSel.getRangeAt(0)) 
    : false;

  let title = "设置为可折叠区域 (Alt+Q)";
  if (foldTarget) {
    title = "取消该折叠区域 (Alt+W)";
  } else if (!validSelection && !cachedRange) {
    title = "当前区域不可折叠";
  }

  safeSendMessage({
    action: "UPDATE_MENU_TITLE",
    title
  });
}

document.addEventListener("mouseover", (e) => {
  lastHoveredElement = e.target;
}, true);

document.addEventListener("mouseup", updateSelectionCache);
document.addEventListener("keyup", updateSelectionCache);

document.addEventListener("pointerdown", (e) => {
  if (e.button === 2) syncContextMenu(e);
}, true);

document.addEventListener("contextmenu", (e) => {
  syncContextMenu(e);
  updateSelectionCache();
}, true);

// =============================================================================
// 5. 折叠组件构建与还原
// =============================================================================
function buildFoldUI(isCollapsed) {
  const wrapper = document.createElement("div");
  wrapper.className = CLASSES.BLOCK;

  const header = document.createElement("div");
  header.className = CLASSES.HEADER;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = CLASSES.BTN;

  const body = document.createElement("div");
  body.className = CLASSES.BODY;

  if (isCollapsed) {
    wrapper.classList.add(CLASSES.COLLAPSED);
    body.classList.add(CLASSES.FOLDED);
    toggleBtn.innerHTML = "▶ <span>已折叠内容 (点击展开)</span>";
  } else {
    toggleBtn.innerHTML = "▼ <span>收起此段</span>";
  }

  header.appendChild(toggleBtn);
  wrapper.appendChild(header);

  return { wrapper, header, toggleBtn, body };
}

function createFoldFromRange(range, isCollapsed = true) {
  if (!range || !isSelectionSafe(range) || rangeOverlapsFoldBlock(range)) return null;

  const { wrapper, toggleBtn, body } = buildFoldUI(isCollapsed);

  try {
    const extracted = range.extractContents();

    // 熔断保护：如果提取出的内容没有任何实质文字（如 PDF 假文本层），立即还原并退出
    if (!extracted.textContent || extracted.textContent.trim().length === 0) {
      range.insertNode(extracted);
      return null;
    }

    body.appendChild(extracted);
    wrapper.appendChild(body);
    range.insertNode(wrapper);
  } catch (err) {
    console.error("[TextFolder] 折叠包裹失败:", err);
    return null;
  }

  toggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const willCollapse = !body.classList.contains(CLASSES.FOLDED);
    body.classList.toggle(CLASSES.FOLDED, willCollapse);
    wrapper.classList.toggle(CLASSES.COLLAPSED, willCollapse);

    toggleBtn.innerHTML = willCollapse 
      ? "▶ <span>已折叠内容 (点击展开)</span>" 
      : "▼ <span>收起此段</span>";

    savePageState();
  });

  return wrapper;
}

function executeMakeFoldable() {
  safeStorageGet(DEFAULT_SETTINGS, (res) => {
    if (!res?.isEnabled) return;

    let targetRange = null;
    const currentSel = window.getSelection();

    if (currentSel && !currentSel.isCollapsed && currentSel.rangeCount > 0) {
      targetRange = currentSel.getRangeAt(0);
    } else if (cachedRange) {
      targetRange = cachedRange;
    }

    if (!targetRange || targetRange.collapsed) return;
    if (!isSelectionSafe(targetRange) || rangeOverlapsFoldBlock(targetRange)) return;

    const wrapper = createFoldFromRange(targetRange, res.collapseInitially);
    if (currentSel) currentSel.removeAllRanges();
    cachedRange = null;

    if (wrapper) savePageState();
  });
}

function executeRestore(wrapper) {
  if (!wrapper) return;

  const target = wrapper.closest(`.${CLASSES.BLOCK}`) || wrapper;
  const body = target.querySelector(`.${CLASSES.BODY}`);
  const parent = target.parentNode;

  if (body && parent) {
    while (body.firstChild) {
      parent.insertBefore(body.firstChild, target);
    }
    parent.removeChild(target);
    parent.normalize();
    savePageState();
  }
}

function findTargetFoldBlockForRestore() {
  if (lastHoveredElement) {
    const fold = lastHoveredElement.closest(`.${CLASSES.BLOCK}`);
    if (fold) return fold;
  }

  const sel = window.getSelection();
  if (sel?.anchorNode) {
    const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
    const fold = el?.closest(`.${CLASSES.BLOCK}`);
    if (fold) return fold;
  }

  if (document.activeElement) {
    const fold = document.activeElement.closest(`.${CLASSES.BLOCK}`);
    if (fold) return fold;
  }

  if (rightClickedElement) {
    const fold = rightClickedElement.closest(`.${CLASSES.BLOCK}`);
    if (fold) return fold;
  }

  return null;
}

// =============================================================================
// 6. 持久化存储与状态恢复
// =============================================================================
function getStorageKey() {
  const url = new URL(window.location.href);
  return "tf_store_" + url.origin + decodeURIComponent(url.pathname);
}

function savePageState() {
  safeStorageGet({ autoSave: DEFAULT_SETTINGS.autoSave }, (res) => {
    if (!res?.autoSave) return;

    const wrappers = document.querySelectorAll(`.${CLASSES.BLOCK}`);
    const records = [];

    wrappers.forEach((w) => {
      const body = w.querySelector(`.${CLASSES.BODY}`);
      if (body) {
        const rawText = body.textContent || "";
        const cleanText = rawText.replace(/\s+/g, " ").trim();
        if (cleanText.length >= 2) {
          records.push({
            prefix: cleanText.slice(0, 35),
            suffix: cleanText.length > 35 ? cleanText.slice(-35) : "",
            fullLength: cleanText.length,
            isCollapsed: body.classList.contains(CLASSES.FOLDED)
          });
        }
      }
    });

    const key = getStorageKey();
    if (records.length === 0) {
      if (chrome.runtime?.id) chrome.storage.local.remove(key);
    } else {
      if (chrome.runtime?.id) chrome.storage.local.set({ [key]: records });
    }
  });
}

function restorePageState() {
  safeStorageGet(DEFAULT_SETTINGS, (settings) => {
    if (!settings?.isEnabled || !settings?.autoSave) return;

    const key = getStorageKey();
    safeStorageGet([key], (data) => {
      const records = data[key];
      if (!records || !Array.isArray(records) || records.length === 0) return;

      records.forEach((rec) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (node.parentElement?.closest(`.${CLASSES.BLOCK}, script, style, noscript, textarea`)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const textNodes = [];
        let fullString = "";
        let currentNode;

        while ((currentNode = walker.nextNode())) {
          const text = currentNode.textContent;
          textNodes.push({
            node: currentNode,
            start: fullString.length,
            end: fullString.length + text.length
          });
          fullString += text;
        }

        const normFullString = fullString.replace(/\s+/g, " ");
        const matchIndex = normFullString.indexOf(rec.prefix);
        if (matchIndex === -1) return;

        let startPos = null;
        let endPos = null;
        const targetEndOffset = Math.min(fullString.length, matchIndex + rec.fullLength);

        for (const item of textNodes) {
          if (!startPos && matchIndex >= item.start && matchIndex <= item.end) {
            startPos = { node: item.node, offset: matchIndex - item.start };
          }
          if (!endPos && targetEndOffset >= item.start && targetEndOffset <= item.end) {
            endPos = { node: item.node, offset: targetEndOffset - item.start };
          }
          if (startPos && endPos) break;
        }

        if (startPos && endPos) {
          try {
            const range = document.createRange();
            range.setStart(startPos.node, startPos.offset);
            range.setEnd(endPos.node, endPos.offset);

            if (isSelectionSafe(range) && !rangeOverlapsFoldBlock(range)) {
              createFoldFromRange(range, rec.isCollapsed);
            }
          } catch (e) {
            console.warn("[TextFolder] 恢复失败:", e);
          }
        }
      });
    });
  });
}

// =============================================================================
// 7. 消息分发中心与初始化
// =============================================================================
if (chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((req) => {
    switch (req.action) {
      case "TRIGGER_CONTEXT_ACTION": {
        const foldWrapper = rightClickedElement?.closest(`.${CLASSES.BLOCK}`);
        foldWrapper ? executeRestore(foldWrapper) : executeMakeFoldable();
        break;
      }
      case "COMMAND_FOLD":
        executeMakeFoldable();
        break;
      case "COMMAND_RESTORE": {
        const targetFold = findTargetFoldBlockForRestore();
        if (targetFold) executeRestore(targetFold);
        break;
      }
      case "CLEAR_ALL_PAGE_FOLDS": {
        document.querySelectorAll(`.${CLASSES.BLOCK}`).forEach((w) => executeRestore(w));
        const key = getStorageKey();
        if (chrome.runtime?.id) chrome.storage.local.remove(key);
        break;
      }
      case "APPLY_CUSTOM_CSS":
        customStyle.textContent = req.css;
        break;
    }
  });
}

let restoreTimer = null;
function scheduleRestore() {
  clearTimeout(restoreTimer);
  restoreTimer = setTimeout(restorePageState, 300);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleRestore);
} else {
  scheduleRestore();
}