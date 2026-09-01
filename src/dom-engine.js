/**
 * Text Folder - DOMEngine
 * 折叠 UI 构建、物理坐标对齐、防段落截断与 DOM 提取解包
 */

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
      if (range.startContainer === range.endContainer && (range.endOffset - range.startOffset === 1)) {
        return range;
      }

      const startEl = Utils.getSafeElement(range.startContainer);
      const endEl = Utils.getSafeElement(range.endContainer);

      const startCode = startEl?.closest(CONFIG.SELECTORS.CODE);
      const endCode = endEl?.closest(CONFIG.SELECTORS.CODE);

      if (startCode && startCode === endCode) {
        return range;
      }

      const startBlock = startEl?.closest(CONFIG.SELECTORS.TEXT);
      const endBlock = endEl?.closest(CONFIG.SELECTORS.TEXT);

      if (startBlock && startBlock === endBlock) {
        return range;
      }

      const commonAncestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

      const getTopBlockChild = (node, ancestor) => {
        let curr = Utils.getSafeElement(node);
        if (!curr || !ancestor || curr === ancestor) return curr;
        while (curr && curr.parentElement && curr.parentElement !== ancestor && curr.parentElement !== document.body) {
          curr = curr.parentElement;
        }
        return curr;
      };

      const startTop = startBlock || getTopBlockChild(startEl, commonAncestor);
      const endTop = endBlock || getTopBlockChild(endEl, commonAncestor);

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
        parent.normalize();

        PersistenceManager.removeFoldRecord(target.dataset.tfId);
      }
    } catch (e) {
      console.error(e);
    } finally {
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

      if (scrollToView && willCollapse) {
        wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      PersistenceManager.updateFoldStateOnly(wrapper.dataset.tfId, willCollapse);
    } finally {
      setTimeout(() => { UIState.isInternalAction = false; }, 50);
    }
  }
};